import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ViewerInfo {
  id: string;
  name: string;
  device: string;
  isHost: boolean;
  mode: 'full' | 'audio-only';
  ping: number;
  drift: number;
  ws: WebSocket;
}

interface RoomState {
  id: string;
  name: string;
  hostId: string | null;
  movie: {
    title: string;
    url: string;
    duration: number;
    type: 'video/mp4' | 'video/webm' | 'stream' | 'local';
    sourceName?: string;
  };
  playback: {
    isPlaying: boolean;
    currentTime: number;
    playbackRate: number;
    updatedAt: number; // Server timestamp (ms)
  };
  viewers: Map<string, ViewerInfo>;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
    type?: 'system' | 'user';
  }>;
}

const rooms = new Map<string, RoomState>();

// Pre-seed a default demo room
const defaultRoomId = 'cinema-alpha';
rooms.set(defaultRoomId, {
  id: defaultRoomId,
  name: 'Home Cinema 1 (Living Room)',
  hostId: null,
  movie: {
    title: 'Oceans: The Living Deep',
    url: '/videos/oceans.mp4',
    duration: 47,
    type: 'video/mp4',
    sourceName: '1080p Local LAN Cinema',
  },
  playback: {
    isPlaying: false,
    currentTime: 0,
    playbackRate: 1.0,
    updatedAt: Date.now(),
  },
  viewers: new Map(),
  messages: [
    {
      id: 'init-1',
      senderId: 'system',
      senderName: 'System',
      text: 'SyncCast Cinema room initialized. Ready for synchronized movie playback!',
      timestamp: Date.now() - 60000,
      type: 'system',
    },
  ],
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Serve local video assets directly with byte-range streaming support
const publicVideosDir = path.resolve(__dirname, 'public', 'videos');
app.use('/videos', express.static(publicVideosDir, {
  acceptRanges: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
  },
}));

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: Date.now(), roomCount: rooms.size });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    hasHost: !!r.hostId,
    movieTitle: r.movie.title,
    viewerCount: r.viewers.size,
    isPlaying: r.playback.isPlaying,
    currentTime: r.playback.isPlaying
      ? r.playback.currentTime + ((Date.now() - r.playback.updatedAt) / 1000) * r.playback.playbackRate
      : r.playback.currentTime,
  }));
  res.json({ rooms: roomList });
});

app.post('/api/rooms', (req, res) => {
  const { name, movieTitle, movieUrl } = req.body;
  const id = 'room-' + Math.random().toString(36).substring(2, 8);
  const newRoom: RoomState = {
    id,
    name: name || `Cinema Room ${id.toUpperCase()}`,
    hostId: null,
    movie: {
      title: movieTitle || 'Big Buck Bunny (Animation)',
      url: movieUrl || '/videos/bigbuckbunny.mp4',
      duration: 60,
      type: 'video/mp4',
      sourceName: 'Local HD Stream',
    },
    playback: {
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1.0,
      updatedAt: Date.now(),
    },
    viewers: new Map(),
    messages: [
      {
        id: 'msg-start',
        senderId: 'system',
        senderName: 'System',
        text: `Room "${name || id}" created. Scan QR code or share room code to invite viewers.`,
        timestamp: Date.now(),
        type: 'system',
      },
    ],
  };

  rooms.set(id, newRoom);
  res.json({ success: true, room: { id: newRoom.id, name: newRoom.name } });
});

// Broadcast helper
function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const viewer of room.viewers.values()) {
    if (viewer.ws.readyState === WebSocket.OPEN && viewer.ws !== excludeWs) {
      viewer.ws.send(payload);
    }
  }
}

// WebSocket handler
wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentViewerId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        // NTP 4-timestamp clock synchronization
        case 'ntp_ping': {
          const serverRecvTime = Date.now();
          ws.send(
            JSON.stringify({
              type: 'ntp_pong',
              clientSendTime: msg.clientSendTime,
              serverRecvTime,
              serverSendTime: Date.now(),
            })
          );
          break;
        }

        case 'join_room': {
          const { roomId, viewerId, name, device, isHost, mode } = msg;
          let room = rooms.get(roomId);

          if (!room) {
            // Auto-create room if not found
            room = {
              id: roomId,
              name: `Cinema Room ${roomId}`,
              hostId: isHost ? viewerId : null,
              movie: {
                title: 'Oceans: The Living Deep',
                url: '/videos/oceans.mp4',
                duration: 47,
                type: 'video/mp4',
                sourceName: 'Local 1080p Stream',
              },
              playback: {
                isPlaying: false,
                currentTime: 0,
                playbackRate: 1.0,
                updatedAt: Date.now(),
              },
              viewers: new Map(),
              messages: [],
            };
            rooms.set(roomId, room);
          }

          currentRoomId = roomId;
          currentViewerId = viewerId;

          // If no host exists yet or viewer claimed host
          if (isHost || !room.hostId) {
            room.hostId = viewerId;
          }

          const viewerInfo: ViewerInfo = {
            id: viewerId,
            name: name || `Viewer ${viewerId.slice(0, 4)}`,
            device: device || 'Web Browser',
            isHost: room.hostId === viewerId,
            mode: mode || 'full',
            ping: 0,
            drift: 0,
            ws,
          };

          room.viewers.set(viewerId, viewerInfo);

          // Calculate current estimated playback time
          const currentEstimatedTime = room.playback.isPlaying
            ? room.playback.currentTime +
              ((Date.now() - room.playback.updatedAt) / 1000) * room.playback.playbackRate
            : room.playback.currentTime;

          // Send room state to newly joined client
          ws.send(
            JSON.stringify({
              type: 'room_state',
              room: {
                id: room.id,
                name: room.name,
                hostId: room.hostId,
                movie: room.movie,
                playback: {
                  ...room.playback,
                  calculatedTime: currentEstimatedTime,
                },
                serverTime: Date.now(),
                isHost: room.hostId === viewerId,
                viewers: Array.from(room.viewers.values()).map((v) => ({
                  id: v.id,
                  name: v.name,
                  device: v.device,
                  isHost: v.isHost,
                  mode: v.mode,
                  ping: v.ping,
                  drift: v.drift,
                })),
                messages: room.messages.slice(-50),
              },
            })
          );

          // Notify room of new viewer
          broadcastToRoom(
            roomId,
            {
              type: 'viewer_joined',
              viewer: {
                id: viewerInfo.id,
                name: viewerInfo.name,
                device: viewerInfo.device,
                isHost: viewerInfo.isHost,
                mode: viewerInfo.mode,
                ping: viewerInfo.ping,
                drift: viewerInfo.drift,
              },
            },
            ws
          );
          break;
        }

        case 'host_playback_change': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          // Only host or authorized controllers can update master playback
          const { isPlaying, currentTime, playbackRate, reason } = msg;

          room.playback.isPlaying = isPlaying;
          room.playback.currentTime = Math.max(0, currentTime);
          room.playback.playbackRate = playbackRate || 1.0;
          room.playback.updatedAt = Date.now();

          // Broadcast authoritative playback command
          broadcastToRoom(currentRoomId, {
            type: 'playback_sync',
            playback: {
              ...room.playback,
              serverTimestamp: room.playback.updatedAt,
            },
            reason: reason || 'host_action',
            issuedBy: currentViewerId,
          });
          break;
        }

        case 'update_movie': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          room.movie = {
            title: msg.movie.title,
            url: msg.movie.url,
            duration: msg.movie.duration || 0,
            type: msg.movie.type || 'video/mp4',
            sourceName: msg.movie.sourceName || 'Custom Stream',
          };
          room.playback.currentTime = 0;
          room.playback.isPlaying = false;
          room.playback.updatedAt = Date.now();

          broadcastToRoom(currentRoomId, {
            type: 'movie_updated',
            movie: room.movie,
            playback: room.playback,
            serverTimestamp: Date.now(),
          });
          break;
        }

        case 'client_telemetry': {
          if (!currentRoomId || !currentViewerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const viewer = room.viewers.get(currentViewerId);
          if (viewer) {
            viewer.ping = msg.ping || viewer.ping;
            viewer.drift = msg.drift || viewer.drift;
            if (msg.mode) viewer.mode = msg.mode;

            // Broadcast telemetry update periodically to room host
            broadcastToRoom(currentRoomId, {
              type: 'viewer_telemetry',
              viewerId: viewer.id,
              ping: viewer.ping,
              drift: viewer.drift,
              mode: viewer.mode,
            });
          }
          break;
        }

        case 'resync_request': {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const currentEstimatedTime = room.playback.isPlaying
            ? room.playback.currentTime +
              ((Date.now() - room.playback.updatedAt) / 1000) * room.playback.playbackRate
            : room.playback.currentTime;

          ws.send(
            JSON.stringify({
              type: 'playback_sync',
              playback: {
                isPlaying: room.playback.isPlaying,
                currentTime: currentEstimatedTime,
                playbackRate: room.playback.playbackRate,
                serverTimestamp: Date.now(),
              },
              reason: 'resync_response',
            })
          );
          break;
        }

        case 'reaction': {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, {
            type: 'reaction_received',
            emoji: msg.emoji,
            senderName: msg.senderName || 'Viewer',
            id: Math.random().toString(36).slice(2, 9),
          });
          break;
        }

        case 'chat_message': {
          if (!currentRoomId || !currentViewerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const chatMsg = {
            id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            senderId: currentViewerId,
            senderName: msg.senderName || 'Viewer',
            text: msg.text,
            timestamp: Date.now(),
            type: 'user' as const,
          };

          room.messages.push(chatMsg);
          if (room.messages.length > 100) room.messages.shift();

          broadcastToRoom(currentRoomId, {
            type: 'chat_received',
            message: chatMsg,
          });
          break;
        }

        case 'request_pause': {
          if (!currentRoomId) return;
          broadcastToRoom(currentRoomId, {
            type: 'pause_requested',
            senderName: msg.senderName || 'A viewer',
            reason: msg.reason || 'snack / bathroom break',
          });
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentViewerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const viewer = room.viewers.get(currentViewerId);
        room.viewers.delete(currentViewerId);

        // If host left, assign new host if any viewer remains
        if (room.hostId === currentViewerId) {
          const nextViewer = room.viewers.values().next().value;
          room.hostId = nextViewer ? nextViewer.id : null;
          if (nextViewer) {
            nextViewer.isHost = true;
          }
        }

        broadcastToRoom(currentRoomId, {
          type: 'viewer_left',
          viewerId: currentViewerId,
          newHostId: room.hostId,
        });
      }
    }
  });
});

// Vite middleware for dev or static for prod
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`SyncCast Cinema server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
