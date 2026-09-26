import React from 'react';
import { HostConsole } from './HostConsole';
import { ViewerScreen } from './ViewerScreen';
import { CinemaSyncClient } from '../services/websocket';
import { PlaybackState, Viewer, ChatMessage } from '../types';
import { Layers, Smartphone, Tv, Sparkles, Wifi } from 'lucide-react';

interface SplitSimulatorProps {
  syncClient: CinemaSyncClient;
  movie: {
    title: string;
    url: string;
    duration: number;
    type: string;
    sourceName?: string;
  };
  playback: PlaybackState;
  viewers: Viewer[];
  messages: ChatMessage[];
  pendingPauseRequest: { senderName: string; reason: string } | null;
  onClearPauseRequest: () => void;
  onOpenMovieSelector: () => void;
  onOpenQrModal: () => void;
  rtt: number;
}

export const SplitSimulator: React.FC<SplitSimulatorProps> = ({
  syncClient,
  movie,
  playback,
  viewers,
  messages,
  pendingPauseRequest,
  onClearPauseRequest,
  onOpenMovieSelector,
  onOpenQrModal,
  rtt,
}) => {
  return (
    <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-3 space-y-4">
      {/* Banner explaining the test lab */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl text-xs gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">
              Multi-Device Live Sync Simulator
            </h4>
            <p className="text-slate-300 text-[11px]">
              Host Console (Left) broadcasting live to a Connected Mobile Viewer (Right). Test play/pause, seek, audio-only headphone mode, and reaction bursts simultaneously!
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            <span>LAN Latency: {rtt || 12}ms</span>
          </div>
        </div>
      </div>

      {/* Side-by-side Dual View */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Host Console (7 cols) */}
        <div className="xl:col-span-7 bg-slate-950/60 rounded-3xl border border-slate-800 p-2 sm:p-3 shadow-2xl relative">
          <div className="flex items-center space-x-2 px-3 py-1.5 mb-2 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-semibold text-white">
            <Tv className="w-4 h-4 text-red-500" />
            <span>HOST BROADCASTER (PC / Laptop Screen)</span>
          </div>
          <HostConsole
            syncClient={syncClient}
            movie={movie}
            playback={playback}
            viewers={viewers}
            messages={messages}
            pendingPauseRequest={pendingPauseRequest}
            onClearPauseRequest={onClearPauseRequest}
            onOpenMovieSelector={onOpenMovieSelector}
            onOpenQrModal={onOpenQrModal}
          />
        </div>

        {/* Right Column: Simulated Phone Viewer (5 cols) */}
        <div className="xl:col-span-5 bg-slate-950/60 rounded-3xl border border-slate-800 p-2 sm:p-3 shadow-2xl flex flex-col items-center">
          <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-semibold text-white">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>SIMULATED VIEWER PHONE (iOS / Android)</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Zero Install</span>
          </div>

          {/* Smartphone Bezel Mockup */}
          <div className="w-full max-w-[440px] rounded-[36px] bg-slate-950 border-[6px] border-slate-800 shadow-2xl p-2.5 relative overflow-hidden">
            {/* Notch / Dynamic Island */}
            <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-2 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-950" />
            </div>

            <ViewerScreen
              syncClient={syncClient}
              movie={movie}
              playback={playback}
              messages={messages}
              viewerName="Phone Viewer (Sim)"
              rtt={rtt}
            />

            {/* Bottom Home Indicator Bar */}
            <div className="w-28 h-1 bg-slate-700/60 rounded-full mx-auto mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
};
