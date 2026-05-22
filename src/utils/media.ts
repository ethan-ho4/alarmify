import { Alarm, SpotifyMedia, SpotifyTrack } from '../types';

type LegacyAlarm = Alarm & { track?: SpotifyTrack | null };

export function trackToMedia(track: SpotifyTrack): SpotifyMedia {
  return {
    kind: 'track',
    id: track.id,
    uri: track.uri,
    name: track.name,
    artist: track.artist,
    imageUrl: track.albumArt,
    albumName: track.albumName,
    duration_ms: track.duration_ms,
  };
}

export function normalizeAlarm(raw: LegacyAlarm): Alarm {
  if (raw.media) {
    return { ...raw, media: raw.media };
  }
  if (raw.track) {
    const { track, ...rest } = raw;
    return { ...rest, media: trackToMedia(track) };
  }
  return { ...raw, media: raw.media ?? null };
}

export function getAlarmMedia(alarm: LegacyAlarm): SpotifyMedia | null {
  if (alarm.media) return alarm.media;
  if (alarm.track) return trackToMedia(alarm.track);
  return null;
}

export function hasEnabledAlarmWithMedia(alarms: LegacyAlarm[]): boolean {
  return alarms.some((a) => a.isEnabled && !!getAlarmMedia(a)?.uri);
}

export function getMediaImageUrl(media: SpotifyMedia): string {
  return media.imageUrl;
}

export function getMediaTitle(media: SpotifyMedia): string {
  return media.name;
}

export function getMediaSubtitle(media: SpotifyMedia): string {
  switch (media.kind) {
    case 'track':
      return media.artist;
    case 'playlist':
      return media.trackCount != null
        ? `${media.ownerName} · ${media.trackCount} tracks`
        : media.ownerName;
    case 'album':
      return `${media.artist} · Album`;
  }
}

export function getMediaKindLabel(media: SpotifyMedia): string {
  switch (media.kind) {
    case 'track':
      return 'Song';
    case 'playlist':
      return 'Playlist';
    case 'album':
      return 'Album';
  }
}
