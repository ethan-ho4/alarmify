import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotifyMedia } from '../types';

const STORAGE_KEY = 'alarmify_favourite_tracks';

export type FavouriteTrack = Extract<SpotifyMedia, { kind: 'track' }>;

function isFavouriteTrack(media: SpotifyMedia): media is FavouriteTrack {
  return media.kind === 'track';
}

export async function loadFavourites(): Promise<FavouriteTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SpotifyMedia[];
    return parsed.filter(isFavouriteTrack);
  } catch {
    return [];
  }
}

async function saveFavourites(tracks: FavouriteTrack[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
}

export async function toggleFavourite(track: FavouriteTrack): Promise<FavouriteTrack[]> {
  const existing = await loadFavourites();
  const isSaved = existing.some((item) => item.id === track.id);
  const next = isSaved
    ? existing.filter((item) => item.id !== track.id)
    : [track, ...existing.filter((item) => item.id !== track.id)];

  await saveFavourites(next);
  return next;
}

export async function removeFavourite(trackId: string): Promise<FavouriteTrack[]> {
  const next = (await loadFavourites()).filter((item) => item.id !== trackId);
  await saveFavourites(next);
  return next;
}
