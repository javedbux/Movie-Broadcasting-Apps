import { PlaybackState, Viewer, ChatMessage } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface WebSocketCallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onRoomState?: (data: any) => void;
  onPlaybackSync?: (playback: PlaybackState, reason?: string) => void;
  onMovieUpdated?: (movie: any, playback: PlaybackState) => void;
  onViewerJoined?: (viewer: Viewer) => void;
  onViewerLeft?: (viewerId: string, newHostId: string | null) => void;
  onViewerTelemetry?: (viewerId: string, ping: number, drift: number, mode: 'full' | 'audio-only') => void;
  onChatReceived?: (message: ChatMessage) => void;
  onReactionReceived?: (reaction: { emoji: string; senderName: string; id: string }) => void;
  onPauseRequested?: (info: { senderName: string; reason: string }) => void;
  onNtpUpdate?: (rtt: number, clockOffset: number) => void;
}

export class CinemaSyncClient {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: WebSocketCallbacks = {};
  private reconnectTimer: any = null;
  private ntpInterval: any = null;
  private isIntentionallyClosed = false;

  // NTP Clock sync values
  public rtt: number = 0; // ping in ms
  public clockOffset: number = 0; // ms offset: ServerTime = ClientTime + clockOffset

  private currentRoomId: string | null = null;
  private currentViewerId: string | null = null;
  private currentViewerName: string = 'Viewer';
  private currentDevice: string = 'Web Browser';
  private isHost: boolean = false;
  private currentMode: 'full' | 'audio-only' = 'full';

  constructor(callbacks: WebSocketCallbacks = {}) {
    this.callbacks = callbacks;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  public setCallbacks(callbacks: WebSocketCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public connect(roomId: string, viewerId: string, name: string, device: string, isHost: boolean, mode: 'full' | 'audio-only' = 'full') {
    this.currentRoomId = roomId;
    this.currentViewerId = viewerId;
    this.currentViewerName = name;
    this.currentDevice = device;
    this.isHost = isHost;
    this.currentMode = mode;
    this.isIntentionallyClosed = false;

    this.initSocket();
  }

  private initSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // ignore
      }
    }

    this.callbacks.onStatusChange?.('connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      console.error('WebSocket creation error:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.callbacks.onStatusChange?.('connected');
      this.startNtpLoop();

      // Send join room message
      if (this.currentRoomId && this.currentViewerId) {
        this.send({
          type: 'join_room',
          roomId: this.currentRoomId,
          viewerId: this.currentViewerId,
          name: this.currentViewerName,
          device: this.currentDevice,
          isHost: this.isHost,
          mode: this.currentMode,
        });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    this.ws.onclose = () => {
      this.stopNtpLoop();
      if (!this.isIntentionallyClosed) {
        this.callbacks.onStatusChange?.('disconnected');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.warn('WebSocket error encountered:', err);
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.callbacks.onStatusChange?.('reconnecting');
        this.initSocket();
      }
    }, 2000);
  }

  private startNtpLoop() {
    this.stopNtpLoop();
    // Immediate ping
    this.sendNtpPing();
    // Repeat every 3 seconds for continuous micro-drift estimation
    this.ntpInterval = setInterval(() => {
      this.sendNtpPing();
    }, 3000);
  }

  private stopNtpLoop() {
    if (this.ntpInterval) clearInterval(this.ntpInterval);
    this.ntpInterval = null;
  }

  private sendNtpPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'ntp_ping',
        clientSendTime: performance.now(),
      });
    }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'ntp_pong': {
        const clientRecvTime = performance.now();
        const clientSendTime = msg.clientSendTime;
        // RTT estimate in ms
        const rtt = Math.max(1, clientRecvTime - clientSendTime);
        this.rtt = Math.round(rtt);

        // Approximate clock offset
        // Server timestamp is in Date.now(), we align client's Date.now() with server
        const now = Date.now();
        const serverEstTimeAtRecv = msg.serverSendTime + rtt / 2;
        this.clockOffset = serverEstTimeAtRecv - now;

        this.callbacks.onNtpUpdate?.(this.rtt, this.clockOffset);
        break;
      }

      case 'room_state':
        this.callbacks.onRoomState?.(msg.room);
        break;

      case 'playback_sync':
        this.callbacks.onPlaybackSync?.(msg.playback, msg.reason);
        break;

      case 'movie_updated':
        this.callbacks.onMovieUpdated?.(msg.movie, msg.playback);
        break;

      case 'viewer_joined':
        this.callbacks.onViewerJoined?.(msg.viewer);
        break;

      case 'viewer_left':
        this.callbacks.onViewerLeft?.(msg.viewerId, msg.newHostId);
        break;

      case 'viewer_telemetry':
        this.callbacks.onViewerTelemetry?.(msg.viewerId, msg.ping, msg.drift, msg.mode);
        break;

      case 'chat_received':
        this.callbacks.onChatReceived?.(msg.message);
        break;

      case 'reaction_received':
        this.callbacks.onReactionReceived?.({
          emoji: msg.emoji,
          senderName: msg.senderName,
          id: msg.id,
        });
        break;

      case 'pause_requested':
        this.callbacks.onPauseRequested?.({
          senderName: msg.senderName,
          reason: msg.reason,
        });
        break;

      default:
        break;
    }
  }

  public send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public getEstimatedServerTime(): number {
    return Date.now() + this.clockOffset;
  }

  public calculateTargetPlaybackTime(playback: PlaybackState): number {
    if (!playback.isPlaying) {
      return playback.currentTime;
    }
    const currentServerTime = this.getEstimatedServerTime();
    const anchorTime = playback.updatedAt || playback.serverTimestamp || currentServerTime;
    const elapsedSeconds = Math.max(0, (currentServerTime - anchorTime) / 1000);
    return playback.currentTime + elapsedSeconds * playback.playbackRate;
  }

  // Action dispatches
  public updatePlayback(isPlaying: boolean, currentTime: number, playbackRate: number = 1.0, reason: string = 'host_control') {
    this.send({
      type: 'host_playback_change',
      isPlaying,
      currentTime,
      playbackRate,
      reason,
    });
  }

  public updateMovie(movie: { title: string; url: string; duration?: number; type?: string; sourceName?: string }) {
    this.send({
      type: 'update_movie',
      movie,
    });
  }

  public sendTelemetry(drift: number, mode?: 'full' | 'audio-only') {
    this.send({
      type: 'client_telemetry',
      ping: this.rtt,
      drift,
      mode: mode || this.currentMode,
    });
  }

  public requestResync() {
    this.send({ type: 'resync_request' });
  }

  public sendChat(text: string) {
    this.send({
      type: 'chat_message',
      text,
      senderName: this.currentViewerName,
    });
  }

  public sendReaction(emoji: string) {
    this.send({
      type: 'reaction',
      emoji,
      senderName: this.currentViewerName,
    });
  }

  public requestPause(reason: string = 'short break') {
    this.send({
      type: 'request_pause',
      reason,
      senderName: this.currentViewerName,
    });
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    this.stopNtpLoop();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
