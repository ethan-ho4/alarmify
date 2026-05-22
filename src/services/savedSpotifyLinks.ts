import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpotifyMedia } from '../types';
import {
  getSpotifyUriId,
  getSpotifyUriKind,
  sanitizeSpotifyUrl,
  spotifyUriToOpenUrl,
} from '../utils/spotifyUri';

const STORAGE_KEY = 'alarmify_saved_spotify_links';
const OEMBED_URL = 'https://open.spotify.com/oembed';
const METADATA_TIMEOUT_MS = 5000;

type SupportedLinkKind = Extract<SpotifyMedia['kind'], 'track' | 'playlist' | 'album'>;

type SpotifyOEmbedMetadata = {
  title?: string;
  thumbnail_url?: string;
};

export type SavedSpotifyLink = {
  id: string;
  uri: string;
  url: string;
  media: SpotifyMedia;
  createdAt: number;
};

function isSupportedKind(kind: string | null): kind is SupportedLinkKind {
  return kind === 'track' || kind === 'playlist' || kind === 'album';
}

function fallbackName(kind: SupportedLinkKind): string {
  switch (kind) {
    case 'track':
      return 'Spotify song';
    case 'playlist':
      return 'Spotify playlist';
    case 'album':
      return 'Spotify album';
  }
}

async function fetchSpotifyOEmbedMetadata(openUrl: string): Promise<SpotifyOEmbedMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);

  try {
    const response = await fetch(`${OEMBED_URL}?url=${encodeURIComponent(openUrl)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as SpotifyOEmbedMetadata;
    return {
      title: typeof data.title === 'string' ? data.title.trim() : undefined,
      thumbnail_url: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function mediaFromSpotifyLink(
  input: string,
  title?: string,
  metadata?: SpotifyOEmbedMetadata | null,
): SpotifyMedia | null {
  const uri = sanitizeSpotifyUrl(input);
  const kind = getSpotifyUriKind(uri);
  const id = getSpotifyUriId(uri);

  if (!uri || !id || !isSupportedKind(kind)) return null;

  const name = metadata?.title || title?.trim() || fallbackName(kind);
  const imageUrl = metadata?.thumbnail_url || '';

  switch (kind) {
    case 'track':
      return {
        kind,
        id,
        uri,
        name,
        artist: 'Spotify link',
        imageUrl,
      };
    case 'playlist':
      return {
        kind,
        id,
        uri,
        name,
        ownerName: 'Spotify link',
        imageUrl,
      };
    case 'album':
      return {
        kind,
        id,
        uri,
        name,
        artist: 'Spotify link',
        imageUrl,
      };
  }
}

export async function loadSavedSpotifyLinks(): Promise<SavedSpotifyLink[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedSpotifyLink[];
  } catch {
    return [];
  }
}

async function persistSavedSpotifyLinks(links: SavedSpotifyLink[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export async function saveSpotifyLink(input: string, title?: string): Promise<SavedSpotifyLink | null> {
  const uri = sanitizeSpotifyUrl(input);
  if (!uri) return null;

  const openUrl = spotifyUriToOpenUrl(uri);
  const metadata = await fetchSpotifyOEmbedMetadata(openUrl);
  const media = mediaFromSpotifyLink(uri, title, metadata);
  if (!media) return null;

  const existing = await loadSavedSpotifyLinks();
  const saved: SavedSpotifyLink = {
    id: `${media.kind}-${media.id}`,
    uri: media.uri,
    url: openUrl,
    media,
    createdAt: Date.now(),
  };

  const next = [saved, ...existing.filter((item) => item.id !== saved.id)];
  await persistSavedSpotifyLinks(next);
  return saved;
}

export async function removeSavedSpotifyLink(id: string): Promise<SavedSpotifyLink[]> {
  const next = (await loadSavedSpotifyLinks()).filter((item) => item.id !== id);
  await persistSavedSpotifyLinks(next);
  return next;
}
