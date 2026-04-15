// ─────────────────────────────────────────────
//  Alarmify – Spotify Service
//  Handles OAuth (PKCE), token storage/refresh,
//  search, and playback control.
// ─────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import { Linking } from 'react-native';
import { SpotifyAuth, SpotifyTrack } from '../types';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

// SecureStore keys
const KEY_ACCESS  = 'sp_access_token';
const KEY_REFRESH = 'sp_refresh_token';
const KEY_EXPIRY  = 'sp_expires_at';

// ── Token Storage ────────────────────────────────────────────────────────────

export async function saveAuth(auth: SpotifyAuth): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS,  auth.accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, auth.refreshToken),
    SecureStore.setItemAsync(KEY_EXPIRY,  String(auth.expiresAt)),
  ]);
}

export async function loadAuth(): Promise<SpotifyAuth | null> {
  try {
    const [access, refresh, expiry] = await Promise.all([
      SecureStore.getItemAsync(KEY_ACCESS),
      SecureStore.getItemAsync(KEY_REFRESH),
      SecureStore.getItemAsync(KEY_EXPIRY),
    ]);
    if (!access || !refresh || !expiry) return null;
    return { accessToken: access, refreshToken: refresh, expiresAt: parseInt(expiry, 10) };
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
    SecureStore.deleteItemAsync(KEY_EXPIRY),
  ]);
}

// ── Token Refresh ────────────────────────────────────────────────────────────

async function refreshToken(storedRefresh: string): Promise<SpotifyAuth | null> {
  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: storedRefresh,
      client_id:     CLIENT_ID,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const auth: SpotifyAuth = {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? storedRefresh,
      expiresAt:    Date.now() + data.expires_in * 1000,
    };
    await saveAuth(auth);
    return auth;
  } catch {
    return null;
  }
}

/** Returns a valid access token, refreshing if necessary. */
export async function getValidToken(): Promise<string | null> {
  const stored = await loadAuth();
  if (!stored) return null;

  // Refresh 60 s before expiry
  if (Date.now() >= stored.expiresAt - 60_000) {
    const refreshed = await refreshToken(stored.refreshToken);
    return refreshed?.accessToken ?? null;
  }

  return stored.accessToken;
}

// ── Exchange auth-code for tokens (PKCE) ────────────────────────────────────

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<SpotifyAuth | null> {
  try {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const auth: SpotifyAuth = {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    Date.now() + data.expires_in * 1000,
    };
    await saveAuth(auth);
    return auth;
  } catch {
    return null;
  }
}

// ── API Helpers ──────────────────────────────────────────────────────────────

async function spotifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();
  if (!token) throw new Error('Not authenticated');

  const isGet = !options.method || options.method.toUpperCase() === 'GET';

  return fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      // Only set Content-Type for requests with a body (POST, PUT, etc.)
      ...(!isGet && { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const q = encodeURIComponent(query.trim());
  const res = await spotifyFetch(`/search?q=${q}&type=track&limit=10`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Spotify ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.tracks.items.map((item: any): SpotifyTrack => ({
    id:          item.id,
    uri:         item.uri,
    name:        item.name,
    artist:      item.artists.map((a: any) => a.name).join(', '),
    albumName:   item.album.name,
    albumArt:    item.album.images[0]?.url ?? '',
    duration_ms: item.duration_ms,
  }));
}

// ── Playback ──────────────────────────────────────────────────────────────────

/**
 * Plays a track by URI using a Spotify deep link.
 * Falls back to the web URL if the Spotify app is not installed.
 */
export async function playTrack(uri: string): Promise<boolean> {
  const trackId = uri.replace('spotify:track:', '');
  try {
    await Linking.openURL(`spotify:track:${trackId}`);
    return true;
  } catch {
    Linking.openURL(`https://open.spotify.com/track/${trackId}`).catch(() => {});
    return false;
  }
}
// ── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<{ name: string; image: string | null } | null> {
  try {
    const res = await spotifyFetch('/me');
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name:  data.display_name ?? 'Spotify User',
      image: data.images?.[0]?.url ?? null,
    };
  } catch {
    return null;
  }
}

// ── Auth URL Builder ─────────────────────────────────────────────────────────

export function buildAuthUrl(
  codeChallenge: string,
  state: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          redirectUri,
    code_challenge_method: 'S256',
    code_challenge:        codeChallenge,
    state,
    scope:                 SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
