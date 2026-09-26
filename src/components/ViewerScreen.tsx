import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Headphones,
  Film,
  Sparkles,
  Sliders,
  Radio,
  Coffee,
  MessageSquare,
  Send,
  Zap,
  Check,
  AlertCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { CinemaSyncClient } from '../services/websocket';
import { PlaybackState, ChatMessage } from '../types';

interface ViewerScreenProps {
  syncClient: CinemaSyncClient;
  movie: {
    title: string;
    url: string;
    duration: number;
    type: string;
    sourceName?: string;
  };
  playback: PlaybackState;
  messages: ChatMessage[];
  viewerName: string;
  rtt: number;
}

export const ViewerScreen: React.FC<ViewerScreenProps> = ({
  syncClient,
  movie,
  playback,
  messages,
  viewerName,
  rtt,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<'full' | 'audio-only'>('full');
  const [driftMs, setDriftMs] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [bluetoothOffsetMs, setBluetoothOffsetMs] = useState<number>(0); // Calibration offset
  const [hasStartedPlayback, setHasStartedPlayback] = useState<boolean>(false);
  const [pauseReasonModal, setPauseReasonModal] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('bathroom break');
  const [pauseSent, setPauseSent] = useState<boolean>(false);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatText, setChatText] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'locked' | 'aligning' | 'recalibrating'>('locked');

  // Master Synchronization Loop
  const synchronizeToHost = useCallback(() => {
    if (!videoRef.current) return;
    const vid = videoRef.current;

    // Target time from authoritative host clock + user Bluetooth compensation
    const targetBaseTime = syncClient.calculateTargetPlaybackTime(playback);
    const targetCalibratedTime = Math.max(0, targetBaseTime + bluetoothOffsetMs / 1000);
    const currentVidTime = vid.currentTime;

    const deltaSec = currentVidTime - targetCalibratedTime;
    const currentDrift = Math.round(deltaSec * 1000);
    setDriftMs(currentDrift);

    // Sync state reporting to server
    syncClient.sendTelemetry(currentDrift, mode);

    // If host is paused, pause client
    if (!playback.isPlaying) {
      if (!vid.paused) {
        vid.pause();
      }
      if (Math.abs(deltaSec) > 0.08) {
        vid.currentTime = targetCalibratedTime;
      }
      setSyncStatus('locked');
      return;
    }

    // Host is playing - make sure client is playing
    if (vid.paused && hasStartedPlayback) {
      vid.play().catch(() => {});
    }

    // Only adjust time/rate if video metadata is ready
    if (vid.readyState >= 1) {
      // Adaptive Clock & Rate Drift Correction Algorithm:
      const absDrift = Math.abs(currentDrift);

      if (absDrift < 35) {
        // Perfect lip-sync lock
        vid.playbackRate = playback.playbackRate;
        setSyncStatus('locked');
      } else if (absDrift >= 35 && absDrift <= 220) {
        // Gentle micro-adjustment without audio distortion
        setSyncStatus('aligning');
        const rateAdjustment = currentDrift > 0 ? -0.03 : 0.03;
        vid.playbackRate = Math.max(0.9, Math.min(1.1, playback.playbackRate + rateAdjustment));
      } else {
        // Significant drift - perform discrete jump
        setSyncStatus('recalibrating');
        try {
          vid.currentTime = targetCalibratedTime;
        } catch (e) {
          // ignore seek error
        }
        vid.playbackRate = playback.playbackRate;
      }
    }
  }, [syncClient, playback, bluetoothOffsetMs, mode, hasStartedPlayback]);

  // Run synchronization check at 5Hz (every 200ms)
  useEffect(() => {
    const timer = setInterval(() => {
      synchronizeToHost();
    }, 200);

    return () => clearInterval(timer);
  }, [synchronizeToHost]);

  // Handle movie URL updates
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handleLoaded = () => {
      if (playback.currentTime > 0) {
        try {
          vid.currentTime = playback.currentTime;
        } catch (e) {
          // ignore
        }
      }
      if (playback.isPlaying && hasStartedPlayback) {
        vid.play().catch(() => {});
      }
    };

    vid.addEventListener('loadedmetadata', handleLoaded, { once: true });
    return () => {
      vid.removeEventListener('loadedmetadata', handleLoaded);
    };
  }, [movie.url, hasStartedPlayback]);

  const handleStartViewer = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = syncClient.calculateTargetPlaybackTime(playback);
      videoRef.current.play().then(() => {
        setHasStartedPlayback(true);
      }).catch((e) => {
        console.warn('Playback gesture required:', e);
        setHasStartedPlayback(true);
      });
    }
  };

  const handleReactionClick = (emoji: string) => {
    syncClient.sendReaction(emoji);
  };

  const handleSendPauseRequest = (e: React.FormEvent) => {
    e.preventDefault();
    syncClient.requestPause(pauseReason);
    setPauseSent(true);
    setTimeout(() => {
      setPauseSent(false);
      setPauseReasonModal(false);
    }, 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    syncClient.sendChat(chatText.trim());
    setChatText('');
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const driftAbs = Math.abs(driftMs);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Mode Selector Pill: Full Video vs Headphone-Only Silent Cinema */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80 w-full sm:w-auto">
          <button
            onClick={() => setMode('full')}
            className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'full'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Full Cinema (Video + Audio)</span>
          </button>

          <button
            onClick={() => setMode('audio-only')}
            className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              mode === 'audio-only'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400/90 hover:text-amber-300'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Silent Cinema (Headphone Mode)</span>
          </button>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'locked'
                  ? 'bg-emerald-400 animate-pulse'
                  : syncStatus === 'aligning'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="font-medium text-slate-200">
              {syncStatus === 'locked'
                ? 'Lip-Sync Locked'
                : syncStatus === 'aligning'
                ? 'Micro-Aligning'
                : 'Resyncing'}
            </span>
            <span className="font-mono text-slate-400 text-[11px]">({driftAbs}ms)</span>
          </div>

          <div className="hidden sm:flex items-center space-x-1 text-slate-400 text-xs font-mono">
            <span>Ping:</span>
            <span className="text-emerald-400">{rtt || 12}ms</span>
          </div>
        </div>
      </div>

      {/* Main Player Area */}
      <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl">
        {/* The underlying HTML5 Video Element (plays video or audio track) */}
        <video
          ref={videoRef}
          key={movie.url}
          playsInline
          className={`w-full aspect-video object-contain bg-black ${
            mode === 'audio-only' ? 'opacity-20 filter blur-xs' : 'opacity-100'
          }`}
          onError={(e) => {
            console.warn('Video error on ViewerScreen, falling back to local copy:', e);
            if (videoRef.current && !videoRef.current.src.includes('oceans.mp4')) {
              videoRef.current.src = '/videos/oceans.mp4';
              videoRef.current.load();
              if (playback.isPlaying) {
                videoRef.current.play().catch(() => {});
              }
            }
          }}
          preload="auto"
        >
          <source src={movie.url} type={movie.type || 'video/mp4'} />
          <source src="/videos/oceans.mp4" type="video/mp4" />
        </video>

        {/* First-time Click-to-Sync Overlay if browser blocked autoplay */}
        {!hasStartedPlayback && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-950/60 mb-4 animate-bounce">
              <Play className="w-8 h-8 fill-current ml-1" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              Join Broadcast: {movie.title}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-5">
              Click to synchronize audio & video with the Director Console on the local network.
            </p>
            <button
              onClick={handleStartViewer}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm shadow-xl transition-transform active:scale-95"
            >
              Start Synchronized Playback
            </button>
          </div>
        )}

        {/* HEADPHONE-ONLY / SILENT CINEMA AMBIENT OVERLAY */}
        {mode === 'audio-only' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/95 backdrop-blur-md">
            <div className="w-full flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-amber-400 font-semibold bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-full">
                <Headphones className="w-4 h-4 animate-bounce" />
                <span>SILENT CINEMA • HEADPHONE STREAM ACTIVE</span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                OLED Energy Saver Active
              </span>
            </div>

            {/* Pulsing Audio Equalizer Visualizer */}
            <div className="flex flex-col items-center space-y-4 my-auto">
              <div className="flex items-end justify-center space-x-1.5 h-24 w-64 px-4 py-2 bg-slate-950/60 rounded-2xl border border-slate-800">
                {[45, 80, 60, 95, 40, 75, 90, 55, 100, 70, 85, 50, 90, 65].map((h, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-gradient-to-t from-amber-600 via-rose-500 to-red-400 transition-all duration-150"
                    style={{
                      height: playback.isPlaying ? `${h}%` : '8%',
                      animation: playback.isPlaying ? `soundBar ${0.8 + (i % 5) * 0.2}s infinite ease-in-out` : 'none',
                    }}
                  />
                ))}
              </div>

              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-white">{movie.title}</h4>
                <p className="text-xs text-slate-400">
                  Audio streaming into your personal headphones in frame-perfect sync with TV screen
                </p>
              </div>
            </div>

            {/* Bluetooth Delay Calibration Box */}
            <div className="w-full max-w-md bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Bluetooth Headphone Delay Compensation</span>
                </div>
                <span className="font-mono text-amber-400 text-xs">
                  {bluetoothOffsetMs > 0 ? `+${bluetoothOffsetMs}` : bluetoothOffsetMs}ms
                </span>
              </div>

              <input
                type="range"
                min={-250}
                max={300}
                step={10}
                value={bluetoothOffsetMs}
                onChange={(e) => setBluetoothOffsetMs(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                <button
                  onClick={() => setBluetoothOffsetMs(0)}
                  className={`px-2 py-0.5 rounded border ${
                    bluetoothOffsetMs === 0
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Wired (0ms)
                </button>
                <button
                  onClick={() => setBluetoothOffsetMs(140)}
                  className={`px-2 py-0.5 rounded border ${
                    bluetoothOffsetMs === 140
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  AirPods (140ms)
                </button>
                <button
                  onClick={() => setBluetoothOffsetMs(190)}
                  className={`px-2 py-0.5 rounded border ${
                    bluetoothOffsetMs === 190
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Sony XM4/5 (190ms)
                </button>
                <button
                  onClick={() => setBluetoothOffsetMs(240)}
                  className={`px-2 py-0.5 rounded border ${
                    bluetoothOffsetMs === 240
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  TWS (240ms)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Viewer Bottom Floating Bar */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between p-2.5 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center space-x-3">
            {/* Host State indicator */}
            <div className="flex items-center space-x-1.5 text-slate-300">
              {playback.isPlaying ? (
                <div className="flex items-center space-x-1 text-emerald-400">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="font-semibold">Playing</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 text-amber-400">
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span className="font-semibold">Paused by Host</span>
                </div>
              )}
            </div>

            {/* Viewer Personal Volume */}
            <div className="flex items-center space-x-1.5 pl-3 border-l border-slate-800">
              <button
                onClick={() => {
                  if (!videoRef.current) return;
                  const next = !isMuted;
                  videoRef.current.muted = next;
                  setIsMuted(next);
                }}
                className="text-slate-400 hover:text-white transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = false;
                    setIsMuted(false);
                  }
                }}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Request Pause button */}
            <button
              onClick={() => setPauseReasonModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition"
              title="Request the host to pause for a break"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>Ask Pause</span>
            </button>

            {/* Toggle Room Chat Drawer */}
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-slate-300 hover:text-white transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Chat</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={() => {
                if (videoRef.current) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    videoRef.current.requestFullscreen();
                  }
                }
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Reaction Quick Bar */}
      <div className="flex items-center justify-between p-3 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
        <span className="text-xs font-medium text-slate-400 flex items-center space-x-1">
          <Sparkles className="w-3.5 h-3.5 text-red-500" />
          <span className="hidden sm:inline">Broadcast Reaction:</span>
        </span>

        <div className="flex items-center space-x-2">
          {['🍿', '🔥', '😂', '😱', '❤️', '👏', '🤫'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReactionClick(emoji)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500 hover:scale-115 active:scale-95 transition-all text-xl flex items-center justify-center shadow-md select-none"
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Drawer if expanded */}
      {chatOpen && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="font-semibold text-white">Movie Party Chat</span>
            <button
              onClick={() => setChatOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                  <span className="font-semibold text-slate-400">{m.senderName}</span>
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p>{m.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendChat} className="flex items-center space-x-2 pt-1">
            <input
              type="text"
              placeholder="Say something to the room..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Request Pause Modal */}
      {pauseReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100 space-y-3">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
              <Coffee className="w-4 h-4" />
              <span>Ask Host to Pause</span>
            </div>

            <p className="text-xs text-slate-400">
              Sends an interactive alert on the Director's screen so they can pause the movie for you.
            </p>

            <form onSubmit={handleSendPauseRequest} className="space-y-3">
              <div className="space-y-1.5">
                {['Bathroom break', 'Snack / drink refill', 'Doorbell', 'Quick question'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPauseReason(r)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition ${
                      pauseReason === r
                        ? 'border-amber-500 bg-amber-950/30 text-amber-300 font-medium'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPauseReasonModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pauseSent}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1"
                >
                  {pauseSent ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{pauseSent ? 'Request Sent!' : 'Send Alert'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
