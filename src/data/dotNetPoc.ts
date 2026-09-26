export interface DotNetCodeFile {
  filename: string;
  language: string;
  description: string;
  code: string;
}

export const ARCHITECTURE_OVERVIEW = {
  title: 'Windows .NET 8 Local Movie Broadcast Architecture',
  summary:
    'A high-performance Windows desktop application acting as an in-home micro-CDN and synchronization orchestrator. The host streams local movie files via Kestrel/FFmpeg and synchronizes connected browser devices without requiring any app installations on clients.',
  components: [
    {
      name: 'Windows Host (.NET 8 WinUI / WPF)',
      role: 'Director Console & Server Host',
      details:
        'Runs embedded ASP.NET Core Kestrel server on port 8080. Manages local movie file handles, renders master UI, displays room QR code, and monitors client latency.',
    },
    {
      name: 'FFmpeg Remux / Stream Engine',
      role: 'Zero-Copy Local Video Transcoder',
      details:
        'Pipes local files (MP4, MKV, AVI, HEVC) into fragmented MP4 / HLS / Byte-range HTTP chunks on-the-fly with Intel QSV or NVIDIA NVENC hardware acceleration.',
    },
    {
      name: 'WebSocket Low-Latency Sync Hub',
      role: 'Server-Authoritative Clock & Transport',
      details:
        'Handles NTP 4-timestamp handshake, sub-millisecond clock drift compensation, and broadcasts master Play/Pause/Seek/Rate events.',
    },
    {
      name: 'Zero-Install Web Clients',
      role: 'Viewer Devices (Phones, Laptops, TVs)',
      details:
        'HTML5 Video / AudioContext client running in Safari/Chrome. Auto-adjusts playback rate by ±2.5% for jitter-free lip-sync or runs in Headphone-Only silent mode.',
    },
  ],
};

export const DOTNET_FILES: DotNetCodeFile[] = [
  {
    filename: 'Program.cs',
    language: 'csharp',
    description: 'ASP.NET Core Kestrel Host with WebSockets & Static File Streaming in .NET 8',
    code: `// ============================================================================
// SyncCinema Windows Host - Program.cs (.NET 8 Minimal API + Kestrel)
// ============================================================================
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SyncCinema.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to bind to all local network interfaces (0.0.0.0:8080)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Listen(IPAddress.Any, 8080);
    options.Limits.MaxRequestBodySize = null; // Support large movie file uploads
});

builder.Services.AddSingleton<CinemaRoomManager>();
builder.Services.AddSingleton<FFmpegTranscoderService>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

app.UseCors();
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(15)
});

// Serve embedded React/HTML5 Web Client
app.UseDefaultFiles();
app.UseStaticFiles();

// WebSocket Endpoint for Real-time Cinema Sync & NTP Handshake
app.Map("/ws", async (HttpContext context, CinemaRoomManager roomManager) =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        await roomManager.HandleClientAsync(webSocket, context);
    }
    else
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
    }
});

// Video Stream Range Requests (HTTP 206 Partial Content for instant seeking)
app.MapGet("/api/video/stream", async (HttpContext ctx, FFmpegTranscoderService transcoder) =>
{
    await transcoder.ServeVideoStreamAsync(ctx);
});

// Get Local Machine LAN IP for pairing QR codes
app.MapGet("/api/network/info", () =>
{
    var localIp = NetworkInterface.GetAllNetworkInterfaces()
        .Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
        .SelectMany(n => n.GetIPProperties().UnicastAddresses)
        .FirstOrDefault(a => a.Address.AddressFamily == AddressFamily.InterNetwork)?
        .Address.ToString() ?? "127.0.0.1";

    return Results.Ok(new
    {
        LocalIp = localIp,
        Port = 8080,
        JoinUrl = $"http://{localIp}:8080"
    });
});

Console.WriteLine(">>> SyncCinema Broadcaster running on http://0.0.0.0:8080");
app.Run();
`,
  },
  {
    filename: 'WebSocketSyncHub.cs',
    language: 'csharp',
    description: 'NTP-based Clock Synchronization & Broadcast Manager',
    code: `// ============================================================================
// SyncCinema - WebSocketSyncHub.cs
// High-throughput WebSocket engine with sub-frame synchronization
// ============================================================================
namespace SyncCinema.Services;

using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

public record PlaybackState(
    bool IsPlaying,
    double CurrentTimeSeconds,
    double PlaybackRate,
    long ServerTimestampMs
);

public class ConnectedClient
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public WebSocket Socket { get; set; } = null!;
    public string DeviceName { get; set; } = "Browser Client";
    public string Mode { get; set; } = "full"; // "full" or "audio-only"
    public double LatencyMs { get; set; }
    public double DriftMs { get; set; }
}

public class CinemaRoomManager
{
    private readonly ConcurrentDictionary<string, ConnectedClient> _clients = new();
    private PlaybackState _currentState = new(false, 0.0, 1.0, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    private readonly object _stateLock = new();

    public PlaybackState GetCurrentState()
    {
        lock (_stateLock)
        {
            if (_currentState.IsPlaying)
            {
                var elapsed = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - _currentState.ServerTimestampMs) / 1000.0;
                return _currentState with { CurrentTimeSeconds = _currentState.CurrentTimeSeconds + (elapsed * _currentState.PlaybackRate) };
            }
            return _currentState;
        }
    }

    public async Task HandleClientAsync(WebSocket socket, HttpContext context)
    {
        var client = new ConnectedClient { Socket = socket };
        _clients.TryAdd(client.Id, client);

        var buffer = new byte[1024 * 4];

        try
        {
            // Send initial state upon connection
            await SendJsonAsync(socket, new
            {
                type = "room_state",
                playback = GetCurrentState(),
                serverTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                clientId = client.Id
            });

            while (socket.State == WebSocketState.Open)
            {
                var result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;
                var type = root.GetProperty("type").GetString();

                switch (type)
                {
                    // High-accuracy NTP 4-timestamp clock alignment
                    case "ntp_ping":
                        var clientSendTime = root.GetProperty("clientSendTime").GetInt64();
                        var serverRecvTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                        await SendJsonAsync(socket, new
                        {
                            type = "ntp_pong",
                            clientSendTime,
                            serverRecvTime,
                            serverSendTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                        });
                        break;

                    // Host Play/Pause/Seek updates
                    case "host_playback_change":
                        var isPlaying = root.GetProperty("isPlaying").GetBoolean();
                        var currentTime = root.GetProperty("currentTime").GetDouble();
                        var rate = root.TryGetProperty("playbackRate", out var r) ? r.GetDouble() : 1.0;

                        lock (_stateLock)
                        {
                            _currentState = new PlaybackState(
                                isPlaying,
                                currentTime,
                                rate,
                                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                            );
                        }

                        // Broadcast to all viewers with authoritative server timestamp
                        await BroadcastAsync(new
                        {
                            type = "playback_sync",
                            playback = _currentState
                        });
                        break;

                    case "client_telemetry":
                        client.LatencyMs = root.GetProperty("ping").GetDouble();
                        client.DriftMs = root.GetProperty("drift").GetDouble();
                        if (root.TryGetProperty("mode", out var m)) client.Mode = m.GetString() ?? "full";
                        break;
                }
            }
        }
        finally
        {
            _clients.TryRemove(client.Id, out _);
            await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
        }
    }

    private async Task BroadcastAsync(object payload)
    {
        var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
        var segment = new ArraySegment<byte>(bytes);

        foreach (var c in _clients.Values)
        {
            if (c.Socket.State == WebSocketState.Open)
            {
                await c.Socket.SendAsync(segment, WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }
    }

    private static async Task SendJsonAsync(WebSocket ws, object obj)
    {
        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
`,
  },
  {
    filename: 'FFmpegTranscoder.cs',
    language: 'csharp',
    description: 'Hardware-Accelerated On-The-Fly Movie Streaming Service',
    code: `// ============================================================================
// SyncCinema - FFmpegTranscoder.cs
// Automatic FFmpeg remuxing / byte-range streaming for MKV, MP4, AVI, HEVC
// ============================================================================
namespace SyncCinema.Services;

using System.Diagnostics;
using Microsoft.AspNetCore.Http;

public class FFmpegTranscoderService
{
    private string _currentMovieFilePath = @"C:\\Movies\\SampleMovie.mkv";

    public void SetMoviePath(string path)
    {
        if (File.Exists(path))
        {
            _currentMovieFilePath = path;
        }
    }

    public async Task ServeVideoStreamAsync(HttpContext context)
    {
        if (!File.Exists(_currentMovieFilePath))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        var ext = Path.GetExtension(_currentMovieFilePath).ToLowerInvariant();

        // Native MP4/WebM can be served directly with standard HTTP 206 Partial Content
        if (ext == ".mp4" || ext == ".webm")
        {
            await ServeStaticRangeAsync(context, _currentMovieFilePath);
            return;
        }

        // For non-browser containers (MKV, AVI, TS, AC3), remux container to MP4 via FFmpeg pipe
        context.Response.ContentType = "video/mp4";
        context.Response.Headers.Append("Accept-Ranges", "none");

        var ffmpegArgs = $"-re -i \\"{_currentMovieFilePath}\\" " +
                         $"-c:v copy -c:a aac -b:a 192k " +
                         $"-movflags frag_keyframe+empty_moov+default_base_moof " +
                         $"-f mp4 -";

        var startInfo = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            Arguments = ffmpegArgs,
            RedirectStandardOutput = true,
            RedirectStandardError = false,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo);
        if (process != null)
        {
            await process.StandardOutput.BaseStream.CopyToAsync(context.Response.Body);
            await process.WaitForExitAsync();
        }
    }

    private static async Task ServeStaticRangeAsync(HttpContext context, string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        var totalBytes = fileInfo.Length;
        context.Response.Headers.Append("Accept-Ranges", "bytes");

        var rangeHeader = context.Request.Headers["Range"].ToString();
        if (string.IsNullOrEmpty(rangeHeader))
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentLength = totalBytes;
            using var fs = File.OpenRead(filePath);
            await fs.CopyToAsync(context.Response.Body);
            return;
        }

        // Parse Range: bytes=start-end
        var range = rangeHeader.Replace("bytes=", "").Split('-');
        var start = long.Parse(range[0]);
        var end = range.Length > 1 && !string.IsNullOrEmpty(range[1]) ? long.Parse(range[1]) : totalBytes - 1;
        var length = end - start + 1;

        context.Response.StatusCode = StatusCodes.Status206PartialContent;
        context.Response.Headers.Append("Content-Range", $"bytes {start}-{end}/{totalBytes}");
        context.Response.ContentLength = length;

        using var stream = File.OpenRead(filePath);
        stream.Seek(start, SeekOrigin.Begin);

        var buffer = new byte[64 * 1024];
        long bytesRemaining = length;
        while (bytesRemaining > 0)
        {
            var read = await stream.ReadAsync(buffer, 0, (int)Math.Min(buffer.Length, bytesRemaining));
            if (read == 0) break;
            await context.Response.Body.WriteAsync(buffer, 0, read);
            bytesRemaining -= read;
        }
    }
}
`,
  },
  {
    filename: 'MainWindow.xaml.cs',
    language: 'csharp',
    description: 'WPF / WinUI Director Interface with QR Code Generator',
    code: `// ============================================================================
// SyncCinema - MainWindow.xaml.cs (WPF / WinUI 3 Director UI)
// ============================================================================
using System.Windows;
using Microsoft.Win32;
using QRCoder;
using System.Drawing;
using System.IO;
using System.Windows.Media.Imaging;

namespace SyncCinema
{
    public partial class MainWindow : Window
    {
        private string? _selectedFile;

        public MainWindow()
        {
            InitializeComponent();
            GeneratePairingQrCode("http://192.168.1.150:8080");
        }

        private void SelectMovie_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new OpenFileDialog
            {
                Filter = "Movie Files (*.mp4;*.mkv;*.webm;*.avi)|*.mp4;*.mkv;*.webm;*.avi|All Files (*.*)|*.*",
                Title = "Select Movie to Broadcast over LAN"
            };

            if (dialog.ShowDialog() == true)
            {
                _selectedFile = dialog.FileName;
                TxtMovieTitle.Text = Path.GetFileName(_selectedFile);
                TxtMoviePath.Text = _selectedFile;
                MediaPreview.Source = new Uri(_selectedFile);
            }
        }

        private void GeneratePairingQrCode(string url)
        {
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(url, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            byte[] qrCodeBytes = qrCode.GetGraphic(20);

            using var ms = new MemoryStream(qrCodeBytes);
            var bitmapImage = new BitmapImage();
            bitmapImage.BeginInit();
            bitmapImage.StreamSource = ms;
            bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
            bitmapImage.EndInit();

            ImgQrCode.Source = bitmapImage;
            TxtJoinUrl.Text = url;
        }

        private void BtnMasterPlay_Click(object sender, RoutedEventArgs e) => MediaPreview.Play();
        private void BtnMasterPause_Click(object sender, RoutedEventArgs e) => MediaPreview.Pause();
    }
}
`,
  },
  {
    filename: 'protocol-spec.md',
    language: 'markdown',
    description: 'LAN Broadcast & Sub-Frame Drift Compensation Protocol Spec',
    code: `# SyncCinema Network Protocol Specification

## 1. Clock Synchronization (NTP 4-Timestamp Method)
Every 3 seconds, each viewer exchanges high-resolution monotonic timestamps with the host:
- **T0**: Client sends \`ntp_ping\` (Client timestamp)
- **T1**: Server receives \`ntp_ping\` (Server timestamp)
- **T2**: Server responds \`ntp_pong\` (Server timestamp)
- **T3**: Client receives \`ntp_pong\` (Client timestamp)

\`\`\`
Round-Trip-Time (RTT) = (T3 - T0) - (T2 - T1)
Clock Offset          = ((T1 - T0) + (T2 - T3)) / 2
Estimated Server Time = ClientLocalTime + Clock Offset
\`\`\`

## 2. Dynamic Drift Recovery Algorithm
The client compares its current HTML5 video \`currentTime\` with the projected host time:

| Drift Delta | Status | Action |
|---|---|---|
| **< 30 ms** | Lip-Sync Locked 🟢 | No action. Audio and video in perfect lock. |
| **30 ms - 200 ms** | Minor Lag 🟡 | Micro-adjust \`playbackRate\` by ±2.5% to smoothly drift back into sync without audio pitch distortion. |
| **> 200 ms** | Desynced 🔴 | Perform discrete seek to master frame. |

## 3. Headphone-Only Silent Cinema Calibration
Bluetooth A2DP headsets (AirPods, Sony WH-1000XM, etc.) introduce 80ms - 220ms of hardware audio decode delay.
SyncCinema provides a viewer-side delay calibration slider:
\`\`\`javascript
targetPlayTime = projectedHostTime + (userBluetoothOffsetMs / 1000);
\`\`\`
`,
  },
];
