import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header, ActiveTab } from './components/Header';
import { HostConsole } from './components/HostConsole';
import { ViewerScreen } from './components/ViewerScreen';
import { SplitSimulator } from './components/SplitSimulator';
import { DotNetArchitectureViewer } from './components/DotNetArchitectureViewer';
import { QrCodeModal } from './components/QrCodeModal';
import { MovieSelectorModal } from './components/MovieSelectorModal';
import { ReactionOverlay } from './components/ReactionOverlay';
import { CinemaSyncClient, ConnectionStatus } from './services/websocket';
import { PlaybackState, Viewer, ChatMessage, ReactionItem } from './types';
import { SAMPLE_MOVIES } from './data/movies';

export default function App() {
  // Read query params for direct links (?room=xyz&role=viewer)
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialRoomId = urlParams.get('room') || 'cinema-alpha';
  const initialRole = urlParams.get('role');

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    initialRole === 'viewer' ? 'viewer' : 'host'
  );
  const [roomId, setRoomId] = useState<string>(initialRoomId);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [rtt, setRtt] = useState<number>(12);
  const [clockOffset, setClockOffset] = useState<number>(0);

  // Movie state
  const [movie, setMovie] = useState<{
    title: string;
    url: string;
    duration: number;
    type: string;
    sourceName?: string;
  }>({
    title: SAMPLE_MOVIES[0].title,
    url: SAMPLE_MOVIES[0].url,
    duration: SAMPLE_MOVIES[0].duration,
    type: 'video/mp4',
    sourceName: `${SAMPLE_MOVIES[0].resolution} • ${SAMPLE_MOVIES[0].genre}`,
  });

  // Playback state
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    playbackRate: 1.0,
    updatedAt: Date.now(),
  });

  // Room participants & communication
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [pendingPauseRequest, setPendingPauseRequest] = useState<{
    senderName: string;
    reason: string;
  } | null>(null);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [movieSelectorOpen, setMovieSelectorOpen] = useState<boolean>(false);

  // Viewer Identity
  const viewerIdentity = useMemo(() => {
    let id = localStorage.getItem('sync_cinema_viewer_id');
    if (!id) {
      id = 'user-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('sync_cinema_viewer_id', id);
    }

    const ua = navigator.userAgent;
    let device = 'Laptop / Desktop';
    if (/iPad|Tablet/i.test(ua)) device = 'Tablet Device';
    else if (/iPhone/i.test(ua)) device = 'iPhone (iOS)';
    else if (/Android/i.test(ua)) device = 'Android Phone';
    else if (/Macintosh/i.test(ua)) device = 'MacBook';
    else if (/Windows/i.test(ua)) device = 'Windows PC';

    const shortId = id.slice(-4).toUpperCase();
    const name = initialRole === 'viewer' ? `Viewer-${shortId}` : `Host-${shortId}`;

    return { id, name, device, isHost: initialRole !== 'viewer' };
  }, [initialRole]);

  // WebSocket Sync Client Instance
  const syncClientRef = useRef<CinemaSyncClient | null>(null);

  useEffect(() => {
    const client = new CinemaSyncClient({
      onStatusChange: (status) => setConnectionStatus(status),
      onNtpUpdate: (ping, offset) => {
        setRtt(ping);
        setClockOffset(offset);
      },
      onRoomState: (roomData) => {
        if (roomData.movie) {
          setMovie(roomData.movie);
        }
        if (roomData.playback) {
          setPlayback(roomData.playback);
        }
        if (roomData.viewers) {
          setViewers(roomData.viewers);
        }
        if (roomData.messages) {
          setMessages(roomData.messages);
        }
      },
      onPlaybackSync: (newPlayback) => {
        setPlayback(newPlayback);
      },
      onMovieUpdated: (newMovie, newPlayback) => {
        setMovie(newMovie);
        setPlayback(newPlayback);
      },
      onViewerJoined: (viewer) => {
        setViewers((prev) => {
          if (prev.some((v) => v.id === viewer.id)) return prev;
          return [...prev, viewer];
        });
      },
      onViewerLeft: (viewerId) => {
        setViewers((prev) => prev.filter((v) => v.id !== viewerId));
      },
      onViewerTelemetry: (viewerId, ping, drift, mode) => {
        setViewers((prev) =>
          prev.map((v) => (v.id === viewerId ? { ...v, ping, drift, mode } : v))
        );
      },
      onChatReceived: (message) => {
        setMessages((prev) => [...prev.slice(-49), message]);
      },
      onReactionReceived: ({ emoji, senderName }) => {
        const newReaction: ReactionItem = {
          id: Math.random().toString(36).substring(2, 9),
          emoji,
          senderName,
          x: Math.floor(Math.random() * 80) + 10, // 10% to 90% horizontal position
        };
        setReactions((prev) => [...prev, newReaction]);
        // Auto remove reaction after 3.2s
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
        }, 3200);
      },
      onPauseRequested: (info) => {
        setPendingPauseRequest(info);
      },
    });

    syncClientRef.current = client;

    // Connect to room
    client.connect(
      roomId,
      viewerIdentity.id,
      viewerIdentity.name,
      viewerIdentity.device,
      viewerIdentity.isHost,
      'full'
    );

    return () => {
      client.disconnect();
    };
  }, [roomId, viewerIdentity]);

  // Handle movie selection from catalog, local file or URL
  const handleSelectMovie = (newMovie: {
    title: string;
    url: string;
    duration: number;
    type: 'video/mp4' | 'video/webm' | 'stream' | 'local';
    sourceName?: string;
  }) => {
    setMovie(newMovie);
    setPlayback({
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1.0,
      updatedAt: Date.now(),
    });
    syncClientRef.current?.updateMovie(newMovie);
  };

  const activeSyncClient = syncClientRef.current;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-red-600 selection:text-white font-sans antialiased">
      {/* Floating Reactions Overlay */}
      <ReactionOverlay reactions={reactions} />

      {/* Main Global Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        roomId={roomId}
        movieTitle={movie.title}
        viewerCount={viewers.length}
        connectionStatus={connectionStatus}
        ping={rtt}
        onOpenQrModal={() => setQrModalOpen(true)}
        onOpenMovieSelector={() => setMovieSelectorOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-12">
        {activeSyncClient && (
          <>
            {activeTab === 'host' && (
              <HostConsole
                syncClient={activeSyncClient}
                movie={movie}
                playback={playback}
                viewers={viewers}
                messages={messages}
                pendingPauseRequest={pendingPauseRequest}
                onClearPauseRequest={() => setPendingPauseRequest(null)}
                onOpenMovieSelector={() => setMovieSelectorOpen(true)}
                onOpenQrModal={() => setQrModalOpen(true)}
              />
            )}

            {activeTab === 'viewer' && (
              <ViewerScreen
                syncClient={activeSyncClient}
                movie={movie}
                playback={playback}
                messages={messages}
                viewerName={viewerIdentity.name}
                rtt={rtt}
              />
            )}

            {activeTab === 'simulator' && (
              <SplitSimulator
                syncClient={activeSyncClient}
                movie={movie}
                playback={playback}
                viewers={viewers}
                messages={messages}
                pendingPauseRequest={pendingPauseRequest}
                onClearPauseRequest={() => setPendingPauseRequest(null)}
                onOpenMovieSelector={() => setMovieSelectorOpen(true)}
                onOpenQrModal={() => setQrModalOpen(true)}
                rtt={rtt}
              />
            )}

            {activeTab === 'dotnet-architecture' && (
              <DotNetArchitectureViewer />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <QrCodeModal
        roomId={roomId}
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
      />

      <MovieSelectorModal
        isOpen={movieSelectorOpen}
        onClose={() => setMovieSelectorOpen(false)}
        onSelectMovie={handleSelectMovie}
        currentMovieUrl={movie.url}
      />
    </div>
  );
}
