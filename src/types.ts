export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'tv';

export interface MovieItem {
  id: string;
  title: string;
  url: string;
  duration: number; // in seconds
  thumbnail: string;
  description: string;
  resolution: string;
  type: 'video/mp4' | 'video/webm' | 'stream' | 'local';
  fileSize?: string;
  year?: string;
  genre?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // in seconds
  playbackRate: number;
  updatedAt: number; // server timestamp in ms
  serverTimestamp?: number;
  calculatedTime?: number;
}

export interface Viewer {
  id: string;
  name: string;
  device: string;
  isHost: boolean;
  mode: 'full' | 'audio-only';
  ping: number; // ms
  drift: number; // ms difference between host and viewer
  avatarColor?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type?: 'system' | 'user';
}

export interface ReactionItem {
  id: string;
  emoji: string;
  senderName: string;
  x: number; // random horizontal percentage for floating animation
}

export interface RoomDetails {
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
  playback: PlaybackState;
  serverTime: number;
  isHost: boolean;
  viewers: Viewer[];
  messages: ChatMessage[];
}

export interface NtpSyncData {
  rtt: number;
  serverTimeOffset: number; // local - server
  lastSync: number;
}
