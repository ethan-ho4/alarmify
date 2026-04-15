// ─────────────────────────────────────────────
//  Alarmify – Shared TypeScript Types
// ─────────────────────────────────────────────

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumName: string;
  albumArt: string;
  duration_ms: number;
}

export interface Alarm {
  id: string;
  label: string;
  /** "HH:mm" 24-hour format */
  time: string;
  /** 0 = Sunday … 6 = Saturday; empty array = one-time alarm */
  days: number[];
  track: SpotifyTrack | null;
  isEnabled: boolean;
  /** IDs returned by expo-notifications so we can cancel later */
  notificationIds: string[];
  createdAt: number;
}

export interface SpotifyAuth {
  accessToken: string;
  refreshToken: string;
  /** Unix ms timestamp when the token expires */
  expiresAt: number;
}

export type RootStackParamList = {
  index: undefined;
  'add-alarm': { alarmId?: string } | undefined;
  'song-search': undefined;
};
