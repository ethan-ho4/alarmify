// ─────────────────────────────────────────────
//  Ethan's Alarm – Shared TypeScript Types
// ─────────────────────────────────────────────

/** @deprecated Use SpotifyMedia with kind 'track' */
export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  albumName: string;
  albumArt: string;
  duration_ms: number;
}

export type SpotifyMedia =
  | {
      kind: 'track';
      id: string;
      uri: string;
      name: string;
      artist: string;
      imageUrl: string;
      albumName?: string;
      duration_ms?: number;
    }
  | {
      kind: 'playlist';
      id: string;
      uri: string;
      name: string;
      ownerName: string;
      imageUrl: string;
      trackCount?: number;
    }
  | {
      kind: 'album';
      id: string;
      uri: string;
      name: string;
      artist: string;
      imageUrl: string;
    };

export type BedtimePhase = 'idle' | 'warning' | 'black';

export interface Alarm {
  id: string;
  label: string;
  /** "HH:mm" 24-hour format */
  time: string;
  /** 0 = Sunday … 6 = Saturday; empty array = one-time alarm */
  days: number[];
  media: SpotifyMedia | null;
  isEnabled: boolean;
  notificationIds: string[];
  createdAt: number;
}

export interface SpotifyAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type RootStackParamList = {
  index: undefined;
  'add-alarm': { alarmId?: string } | undefined;
  'pick-media': undefined;
  'song-search': undefined;
  'shortcuts-setup': undefined;
};
