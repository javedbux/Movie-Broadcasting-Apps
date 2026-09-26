import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Lock,
  Unlock,
  RefreshCw,
  Users,
  Smartphone,
  Laptop,
  Tv,
  Film,
  Sparkles,
  Coffee,
  MessageSquare,
  Send,
  Radio,
  Sliders,
  AlertTriangle,
  QrCode,
  Gauge,
  Headphones,
} from 'lucide-react';
import { CinemaSyncClient } from '../services/websocket';
import { Viewer, PlaybackState, ChatMessage } from '../types';

interface HostConsoleProps {
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
}

export const HostConsole: React.FC<HostConsoleProps> = ({
  syncClient,
  movie,
  playback,
  viewers,
  messages,
  pendingPauseRequest,
  onClearPauseRequest,
  onOpenMovieSelector,
  onOpenQrModal,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(playback.isPlaying);
  const [currentTime, setCurrentTime] = useState<number>(playback.currentTime);
  const [duration, setDuration] = useState<number>(movie.duration || 100);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(playback.playbackRate || 1.0);
  const [isHostLocked, setIsHostLocked] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>('');
  const [resyncNotif, setResyncNotif] = useState<boolean>(false);

  const [videoError, setVideoError] = useState<string | null>(null);

  // Sync internal video player when movie changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    setVideoError(null);

    const handleLoadedMetadata = () => {
      setDuration(vid.duration || movie.duration || 100);
      if (playback.currentTime > 0) {
        try {
          vid.currentTime = playback.currentTime;
        } catch (e) {
          // ignore seek error
        }
      }
      if (playback.isPlaying) {
        vid.play().catch(() => {});
      }
    };

    vid.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    return () => {
      vid.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [movie.url]);

  // Periodic heartbeat from host to maintain sync precision across clients
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        const curr = videoRef.current.currentTime;
        setCurrentTime(curr);
        syncClient.updatePlayback(true, curr, videoRef.current.playbackRate, 'heartbeat');
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [syncClient]);

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;

    if (vid.paused) {
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            syncClient.updatePlayback(true, vid.currentTime, playbackRate, 'host_play');
          })
          .catch((err) => {
            console.warn('Play error handled safely:', err);
            // If the source had an issue, fallback to local video
            if (vid.error || !vid.currentSrc || err.name === 'NotSupportedError') {
              setVideoError('Source unavailable. Switched to high-reliability local backup.');
              vid.src = '/videos/oceans.mp4';
              vid.load();
              vid.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          });
      }
    } else {
      vid.pause();
      setIsPlaying(false);
      syncClient.updatePlayback(false, vid.currentTime, playbackRate, 'host_pause');
    }
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    const clampedTime = Math.max(0, Math.min(time, duration));
    videoRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    syncClient.updatePlayback(
      !videoRef.current.paused,
      clampedTime,
      playbackRate,
      'host_seek'
    );
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    handleSeek(videoRef.current.currentTime + seconds);
  };

  const handleRateChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    syncClient.updatePlayback(
      !videoRef.current.paused,
      videoRef.current.currentTime,
      rate,
      'host_rate_change'
    );
  };

  const handleForceResyncAll = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    syncClient.updatePlayback(!videoRef.current.paused, curr, playbackRate, 'force_resync');
    setResyncNotif(true);
    setTimeout(() => setResyncNotif(false), 2500);
  };

  const handleAcceptPause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      syncClient.updatePlayback(false, videoRef.current.currentTime, playbackRate, 'accepted_pause_request');
    }
    onClearPauseRequest();
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    syncClient.sendChat(chatInput.trim());
    setChatInput('');
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      const remM = m % 60;
      return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getDeviceIcon = (device: string) => {
    const d = device.toLowerCase();
    if (d.includes('phone') || d.includes('ios') || d.includes('android') || d.includes('mobile')) {
      return <Smartphone className="w-3.5 h-3.5 text-sky-400" />;
    }
    if (d.includes('tv')) {
      return <Tv className="w-3.5 h-3.5 text-purple-400" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      {/* Pause Request Alert Banner */}
      {pendingPauseRequest && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 gap-3">
          <div className="flex items-center space-x-3 text-amber-200">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {pendingPauseRequest.senderName} requested a pause
              </p>
              <p className="text-xs text-amber-300/80">
                Reason: "{pendingPauseRequest.reason}"
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAcceptPause}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition shadow-md"
            >
              Pause Playback Now
            </button>
            <button
              onClick={onClearPauseRequest}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Video Player + Director Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Master Player & Scrubber */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl group">
            <video
              ref={videoRef}
              key={movie.url}
              className="w-full h-full object-contain cursor-pointer"
              onClick={handleTogglePlay}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration || movie.duration || 100);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={(e) => {
                console.warn('Video error on HostConsole, using local fallback:', e);
                if (videoRef.current && !videoRef.current.src.includes('oceans.mp4')) {
                  setVideoError('Remote stream not reachable. Switched to local offline backup.');
                  videoRef.current.src = '/videos/oceans.mp4';
                  videoRef.current.load();
                  if (isPlaying) {
                    videoRef.current.play().catch(() => {});
                  }
                }
              }}
              playsInline
              preload="auto"
            >
              <source src={movie.url} type={movie.type || 'video/mp4'} />
              <source src="/videos/oceans.mp4" type="video/mp4" />
            </video>

            {videoError && (
              <div className="absolute top-14 left-3 right-3 bg-amber-950/80 border border-amber-500/50 backdrop-blur-md p-2 rounded-xl text-[11px] text-amber-200 flex items-center justify-between">
                <span>{videoError}</span>
                <button
                  onClick={() => setVideoError(null)}
                  className="text-amber-400 hover:text-white font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Broadcast Live Indicator Overlay */}
            <div className="absolute top-3 left-3 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <Radio className="w-3.5 h-3.5 text-red-500" />
              <span>DIRECTOR BROADCAST</span>
            </div>

            {/* Resync Feedback Notification */}
            {resyncNotif && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                <div className="bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 font-semibold text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Master Resync Packet Broadcast to All Devices</span>
                </div>
              </div>
            )}

            {/* Quick overlay controls when hovering */}
            <div className="absolute top-3 right-3 flex items-center space-x-2 opacity-90 hover:opacity-100 transition">
              <button
                onClick={onOpenMovieSelector}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 text-white text-xs font-medium backdrop-blur-md shadow-md transition"
              >
                <Film className="w-3.5 h-3.5 text-red-400" />
                <span>Switch Movie</span>
              </button>
            </div>
          </div>

          {/* Master Director Control Bar */}
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-3">
            {/* Scrubber & Timestamps */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="text-white font-medium">{formatTime(currentTime)}</span>
                <span className="text-slate-500">Duration: {formatTime(duration)}</span>
              </div>
              <div className="relative group/timeline flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600 hover:h-2.5 transition-all"
                />
              </div>
            </div>

            {/* Playback Button Deck */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Playback core */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleSkip(-10)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Rewind 10 seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-12 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-950/50 transition-transform active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Forward 10 seconds"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Speed buttons */}
                <div className="hidden sm:flex items-center p-0.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono">
                  {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`px-2 py-1 rounded-lg transition ${
                        playbackRate === rate
                          ? 'bg-red-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Authority & Volume & Sync actions */}
              <div className="flex items-center space-x-2">
                {/* Volume slider */}
                <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-950 rounded-xl border border-slate-800">
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
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
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
                    className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                </div>

                {/* Force Resync Button */}
                <button
                  onClick={handleForceResyncAll}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition"
                  title="Force all connected viewer screens to align to current frame"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Resync All</span>
                </button>

                {/* Host Control Lock */}
                <button
                  onClick={() => setIsHostLocked(!isHostLocked)}
                  className={`p-2 rounded-xl border transition ${
                    isHostLocked
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title={
                    isHostLocked
                      ? 'Host Authority Locked (Viewers cannot seek/pause)'
                      : 'Free Control (Viewers can pause/seek)'
                  }
                >
                  {isHostLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
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
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Connected Devices Monitor & Live Room Chat */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Connected Viewers Telemetry Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-semibold text-white">Viewer Devices</h4>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {viewers.length}
                </span>
              </div>
              <button
                onClick={onOpenQrModal}
                className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center space-x-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pair QR</span>
              </button>
            </div>

            {/* Viewer list with live drift and mode */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {viewers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs space-y-1">
                  <p>No viewers connected yet.</p>
                  <p className="text-[11px] text-slate-600">
                    Scan QR code or open a new browser tab to join!
                  </p>
                </div>
              ) : (
                viewers.map((viewer) => {
                  const driftAbs = Math.abs(viewer.drift);
                  const isSyncGood = driftAbs < 35;
                  const isSyncFair = driftAbs >= 35 && driftAbs < 180;

                  return (
                    <div
                      key={viewer.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                          {getDeviceIcon(viewer.device)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-medium text-slate-200 truncate">
                              {viewer.name}
                            </span>
                            {viewer.isHost && (
                              <span className="text-[10px] bg-red-600/30 text-red-400 px-1.5 py-0.2 rounded font-bold">
                                HOST
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="truncate">{viewer.device}</span>
                            <span>•</span>
                            {viewer.mode === 'audio-only' ? (
                              <span className="text-amber-400 flex items-center space-x-0.5">
                                <Headphones className="w-3 h-3" />
                                <span>Headphone Only</span>
                              </span>
                            ) : (
                              <span className="text-sky-400">Full Video</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Drift & Ping telemetry */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end space-x-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSyncGood
                                ? 'bg-emerald-400'
                                : isSyncFair
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span className="font-mono text-[11px] text-slate-300">
                            {driftAbs}ms
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {viewer.ping || 10}ms RTT
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Room Chat & Quick Reaction Tray */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 flex-1 flex flex-col justify-between">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
              <MessageSquare className="w-4 h-4 text-red-500" />
              <h4 className="text-sm font-semibold text-white">Live Room Chat</h4>
            </div>

            {/* Chat message stream */}
            <div className="space-y-2 overflow-y-auto max-h-44 pr-1 text-xs flex-1">
              {messages.length === 0 ? (
                <p className="text-slate-500 text-center py-4 text-[11px]">
                  No messages yet. Send a greeting to viewers!
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-xl ${
                      m.type === 'system'
                        ? 'bg-slate-950/40 text-slate-400 text-[11px] italic border border-slate-800/40'
                        : 'bg-slate-950/80 text-slate-200 border border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                      <span className="font-semibold text-slate-400">{m.senderName}</span>
                      <span>
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="break-words">{m.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat input form */}
            <form onSubmit={handleSendChat} className="flex items-center space-x-2 pt-2">
              <input
                type="text"
                placeholder="Broadcast a note to viewers..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition shadow-md shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
