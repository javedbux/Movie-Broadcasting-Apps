import React, { useState } from 'react';
import {
  Film,
  Tv,
  Smartphone,
  Layers,
  Code2,
  QrCode,
  Copy,
  Check,
  Wifi,
  Sparkles,
  Users,
} from 'lucide-react';
import { ConnectionStatus } from '../services/websocket';

export type ActiveTab = 'host' | 'viewer' | 'simulator' | 'dotnet-architecture';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  roomId: string;
  movieTitle: string;
  viewerCount: number;
  connectionStatus: ConnectionStatus;
  ping: number;
  onOpenQrModal: () => void;
  onOpenMovieSelector: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  roomId,
  movieTitle,
  viewerCount,
  connectionStatus,
  ping,
  onOpenQrModal,
  onOpenMovieSelector,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColors = {
    connected: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    connecting: 'bg-amber-400 animate-pulse',
    reconnecting: 'bg-amber-500 animate-ping',
    disconnected: 'bg-rose-500',
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Room Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white shadow-lg shadow-red-950/40">
              <Film className="w-5 h-5 fill-white/20" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-slate-950 flex items-center justify-center p-0.5">
                <div className={`w-full h-full rounded-full ${statusColors[connectionStatus]}`} />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-white text-base tracking-tight flex items-center gap-1.5">
                  SyncCast <span className="text-red-500 font-light">Cinema</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-red-500/10 text-red-400 font-mono font-medium px-2 py-0.5 rounded-full border border-red-500/20">
                  LAN Broadcaster
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="text-slate-300 truncate max-w-[140px] sm:max-w-[220px]">
                  {movieTitle}
                </span>
                <span className="text-slate-600">•</span>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center space-x-1 hover:text-white transition font-mono text-[11px]"
                  title="Click to copy Room Code"
                >
                  <span className="text-slate-500">ROOM:</span>
                  <span className="text-red-400 font-bold">{roomId.toUpperCase()}</span>
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick action buttons on mobile */}
          <div className="flex items-center space-x-1 md:hidden">
            <button
              onClick={onOpenQrModal}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center justify-center">
          <nav className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-800/90 shadow-inner overflow-x-auto text-xs font-medium">
            <button
              onClick={() => setActiveTab('host')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                activeTab === 'host'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Director Console</span>
            </button>

            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                activeTab === 'viewer'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Viewer Screen</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Multi-Device Lab</span>
            </button>

            <button
              onClick={() => setActiveTab('dotnet-architecture')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                activeTab === 'dotnet-architecture'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>.NET 8 PoC</span>
            </button>
          </nav>
        </div>

        {/* Status / Quick Action Tray */}
        <div className="hidden md:flex items-center space-x-3">
          {/* Viewers Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-red-400" />
            <span className="font-semibold text-white">{viewerCount}</span>
            <span className="text-slate-500">connected</span>
          </div>

          {/* Ping indicator */}
          <div className="flex items-center space-x-1.5 px-2 py-1 bg-slate-900/60 border border-slate-800/60 rounded-lg text-[11px] text-slate-400">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="font-mono text-emerald-400">{ping || 12}ms</span>
          </div>

          {/* Change movie trigger */}
          <button
            onClick={onOpenMovieSelector}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700/80 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>Select Movie</span>
          </button>

          {/* Pair devices QR trigger */}
          <button
            onClick={onOpenQrModal}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md transition"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Pair Devices</span>
          </button>
        </div>
      </div>
    </header>
  );
};
