import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  FileCode,
  HardDrive,
  Cpu,
  Wifi,
  Radio,
  Server,
  Download,
  Terminal,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DOTNET_FILES, ARCHITECTURE_OVERVIEW } from '../data/dotNetPoc';

export const DotNetArchitectureViewer: React.FC = () => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const activeFile = DOTNET_FILES[selectedFileIndex];

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAll = () => {
    const combined = DOTNET_FILES.map(
      (f) => `// =================== FILE: ${f.filename} ===================\n// ${f.description}\n\n${f.code}\n\n`
    ).join('\n');

    const blob = new Blob([combined], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SyncCinema_DotNet8_PoC_Suite.cs';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Title & Overview Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Code2 className="w-3.5 h-3.5" />
              <span>Full System Architecture & .NET 8 PoC</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Windows C# / .NET 8 Local Broadcaster
            </h2>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              {ARCHITECTURE_OVERVIEW.summary}
            </p>
          </div>

          <button
            onClick={handleDownloadAll}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-950/60 transition self-start md:self-center shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export .NET 8 Codebase</span>
          </button>
        </div>

        {/* Visual Architecture Diagram */}
        <div className="mt-6 pt-6 border-t border-slate-800/80">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Architecture Flowchart (Local Offline LAN)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            {/* Box 1: Local Movie File */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center space-x-2 text-rose-400 font-semibold mb-2">
                <HardDrive className="w-4 h-4" />
                <span>1. Local Movie Source</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Any local .mp4, .mkv, or .avi stored on PC drive. No cloud uploads or external internet bandwidth consumed.
              </p>
              <div className="mt-3 text-[10px] font-mono text-slate-500">
                Direct Disk I/O (Async Stream)
              </div>
            </div>

            {/* Box 2: Windows App + Kestrel */}
            <div className="p-3.5 bg-slate-950/70 border border-indigo-500/40 rounded-2xl flex flex-col justify-between relative">
              <div className="flex items-center space-x-2 text-indigo-400 font-semibold mb-2">
                <Server className="w-4 h-4" />
                <span>2. .NET 8 Host Server</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Embedded Kestrel on 0.0.0.0:8080. FFmpeg on-the-fly container remuxing + WebSocket sync broadcaster.
              </p>
              <div className="mt-3 text-[10px] font-mono text-indigo-400">
                Kestrel HTTP 206 + WebSockets
              </div>
            </div>

            {/* Box 3: Wi-Fi Router / LAN */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold mb-2">
                <Wifi className="w-4 h-4" />
                <span>3. In-Home Wi-Fi Network</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Sub-5ms LAN transmission. NTP 4-timestamp exchange every 3s continuously computes clock drift.
              </p>
              <div className="mt-3 text-[10px] font-mono text-emerald-400">
                ZeroConf / QR Code Pairing
              </div>
            </div>

            {/* Box 4: Viewers */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center space-x-2 text-sky-400 font-semibold mb-2">
                <Radio className="w-4 h-4" />
                <span>4. Viewer Devices</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Safari, Chrome, TV browsers. Dynamic ±2.5% rate slipstream for jitter-free lip-sync or Headphone-only mode.
              </p>
              <div className="mt-3 text-[10px] font-mono text-sky-400">
                Zero-Install Web Clients
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code File Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: File List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span>C# Source Code Modules</span>
            </h3>

            <div className="space-y-1.5">
              {DOTNET_FILES.map((file, idx) => (
                <button
                  key={file.filename}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between text-xs ${
                    selectedFileIndex === idx
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white font-medium shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-mono font-semibold text-white">{file.filename}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {file.description}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      selectedFileIndex === idx ? 'text-indigo-400 translate-x-1' : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Terminal Guide */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold">
              <Terminal className="w-4 h-4" />
              <span>How to Run on Windows</span>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              <p className="text-slate-500"># 1. Create project</p>
              <p className="text-indigo-300">dotnet new web -n SyncCinema</p>
              <p className="text-slate-500 mt-2"># 2. Add dependencies</p>
              <p className="text-indigo-300">dotnet add package QRCoder</p>
              <p className="text-slate-500 mt-2"># 3. Start local server</p>
              <p className="text-indigo-300">dotnet run --urls=http://0.0.0.0:8080</p>
            </div>
          </div>
        </div>

        {/* Right Column: Code Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
          {/* File Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span className="font-mono font-semibold text-xs text-white">
                {activeFile.filename}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono uppercase">
                {activeFile.language}
              </span>
            </div>

            <button
              onClick={() => handleCopy(activeFile.code)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="p-4 overflow-x-auto max-h-[550px] overflow-y-auto font-mono text-[12px] leading-relaxed text-slate-300 bg-slate-950">
            <pre className="whitespace-pre">
              <code>{activeFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
