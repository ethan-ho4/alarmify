// ─────────────────────────────────────────────
//  Ethan's Alarm – Spotify Service
//  Handles OAuth (PKCE), token storage/refresh,
//  search, and playback control.
// ─────────────────────────────────────────────

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { SpotifyAuth, SpotifyMedia, SpotifyTrack } from '../types';
import { alarmifyDebug } from '../utils/alarmifyDebug';
import { getSpotifyUriKind, spotifyUriToOpenUrl, sanitizeSpotifyUrl } from '../utils/spotifyUri';
import { disableAlarmAfterFired } from './alarmPlaybackLifecycle';

// Detect if we are running in Expo Go
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Platform.OS === 'web';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
].join(' ');

// SecureStore keys
const KEY_ACCESS = 'sp_access_token';
const KEY_REFRESH = 'sp_refresh_token';
const KEY_EXPIRY = 'sp_expires_at';

export type SpotifyUserProfile = { name: string; image: string | null };

// ── Token Storage ────────────────────────────────────────────────────────────

export async function saveAuth(auth: SpotifyAuth): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, auth.accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, auth.refreshToken),
    SecureStore.setItemAsync(KEY_EXPIRY, String(auth.expiresAt)),
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

function isInvalidRefreshGrant(error: unknown): boolean {
  if (typeof error !== 'string') return false;
  return error === 'invalid_grant' || error === 'invalid_token';
}

let inFlightRefresh: Promise<SpotifyAuth | null> | null = null;

async function refreshToken(storedRefresh: string): Promise<SpotifyAuth | null> {
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: storedRefresh,
      client_id: CLIENT_ID,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 400 && isInvalidRefreshGrant(data?.error)) {
        await clearAuth();
      }
      return null;
    }

    const auth: SpotifyAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? storedRefresh,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    await saveAuth(auth);
    return auth;
  } catch {
    return null;
  }
}

async function refreshTokenOnce(storedRefresh: string): Promise<SpotifyAuth | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshToken(storedRefresh).finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}

/** Returns a valid access token, refreshing if necessary. */
export async function refreshSpotifyToken(forceRefresh = false): Promise<string | null> {
  return getValidToken({ forceRefresh });
}

export async function getValidToken(options: { forceRefresh?: boolean } = {}): Promise<string | null> {
  const stored = await loadAuth();
  if (!stored) return null;

  // Refresh 60 s before expiry
  if (options.forceRefresh || Date.now() >= stored.expiresAt - 60_000) {
    const refreshed = await refreshTokenOnce(stored.refreshToken);
    if (refreshed?.accessToken) return refreshed.accessToken;

    // If proactive refresh fails transiently but the current token still works,
    // keep using it and retry later instead of forcing a logout.
    if (Date.now() < stored.expiresAt - 60_000) return stored.accessToken;
    return null;
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
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const auth: SpotifyAuth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    await saveAuth(auth);
    return auth;
  } catch {
    return null;
  }
}

// ── API Helpers ──────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res: Response): number {
  const raw = res.headers.get('Retry-After');
  const seconds = raw ? Number(raw) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return 1_500;
  return Math.min(seconds * 1_000, 10_000);
}

async function spotifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  let token = await getValidToken();
  if (!token) throw new Error('Not authenticated');

  const isGet = !options.method || options.method.toUpperCase() === 'GET';

  const request = (accessToken: string) => fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Only set Content-Type for requests with a body (POST, PUT, etc.)
      ...(!isGet && { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  let res = await request(token);

  if (res.status === 401) {
    token = await getValidToken({ forceRefresh: true });
    if (!token) return res;
    res = await request(token);
  }

  if (res.status === 429) {
    await delay(retryAfterMs(res));
    res = await request(token);
  }

  return res;
}

// ── Search ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiTrack(item: any): SpotifyMedia {
  return {
    kind: 'track',
    id: item.id,
    uri: item.uri,
    name: item.name,
    artist: item.artists.map((a: { name: string }) => a.name).join(', '),
    albumName: item.album?.name,
    imageUrl: item.album?.images?.[0]?.url ?? '',
    duration_ms: item.duration_ms,
  };
}

export async function searchTracks(query: string): Promise<SpotifyMedia[]> {
  const q = encodeURIComponent(query.trim());
  const res = await spotifyFetch(`/search?q=${q}&type=track&limit=10`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Spotify ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }

  const data = await res.json();
  return data.tracks.items.map(mapApiTrack);
}

export type LibraryPage<T> = { items: T[]; nextOffset: number | null };

export async function fetchUserPlaylists(
  limit = 20,
  offset = 0,
): Promise<LibraryPage<SpotifyMedia>> {
  const res = await spotifyFetch(`/me/playlists?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Spotify ${res.status}`);
  }
  const data = await res.json();
  const items = (data.items ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any): SpotifyMedia => ({
      kind: 'playlist',
      id: p.id,
      uri: p.uri,
      name: p.name,
      ownerName: p.owner?.display_name ?? 'Spotify',
      imageUrl: p.images?.[0]?.url ?? '',
      trackCount: p.tracks?.total,
    }),
  );
  const next = data.next ? offset + items.length : null;
  return { items, nextOffset: next };
}

export async function fetchLikedTracks(
  limit = 20,
  offset = 0,
): Promise<LibraryPage<SpotifyMedia>> {
  const res = await spotifyFetch(`/me/tracks?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Spotify ${res.status}`);
  }
  const data = await res.json();
  const items = (data.items ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any) => mapApiTrack(row.track),
  );
  const next = data.next ? offset + items.length : null;
  return { items, nextOffset: next };
}

export async function fetchSavedAlbums(
  limit = 20,
  offset = 0,
): Promise<LibraryPage<SpotifyMedia>> {
  const res = await spotifyFetch(`/me/albums?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Spotify ${res.status}`);
  }
  const data = await res.json();
  const items = (data.items ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any): SpotifyMedia => {
      const a = row.album;
      return {
        kind: 'album',
        id: a.id,
        uri: a.uri,
        name: a.name,
        artist: a.artists.map((x: { name: string }) => x.name).join(', '),
        imageUrl: a.images?.[0]?.url ?? '',
      };
    },
  );
  const next = data.next ? offset + items.length : null;
  return { items, nextOffset: next };
}

async function setShuffleViaWebApi(state: boolean): Promise<void> {
  await spotifyFetch(`/me/player/shuffle?state=${state}`, { method: 'PUT' }).catch(() => null);
}

/** Opens the Spotify app so this phone usually appears in Spotify Connect for Web API control. */
export async function openSpotifyApp(): Promise<boolean> {
  try {
    await Linking.openURL('spotify://');
    return true;
  } catch {
    try {
      await Linking.openURL('https://open.spotify.com');
      return true;
    } catch {
      return false;
    }
  }
}

/** Spotify Connect device count (`GET /me/player/devices`). Null if offline / not signed in / error. */
export async function getSpotifyConnectDeviceCount(): Promise<number | null> {
  const token = await getValidToken();
  if (!token) return null;
  try {
    const res = await spotifyFetch('/me/player/devices');
    if (!res.ok) return null;
    const data = await res.json();
    const devices: unknown[] = data.devices ?? [];
    return devices.length;
  } catch {
    return null;
  }
}

// ── Playback ──────────────────────────────────────────────────────────────────

async function spotifyErrorSnippet(res: Response): Promise<string> {
  try {
    return (await res.clone().text()).slice(0, 400);
  } catch {
    return res.statusText;
  }
}

/** How long before the alarm we start silent Spotify playback (Premium Web API). */
export const ALARM_PREARM_MS = 90_000;

/** Default volume when the alarm rings after silent pre-roll. */
export const ALARM_REVEAL_VOLUME_PERCENT = 88;

/**
 * Returns the device ID of the currently active Spotify device, or null.
 * Used by playTrackViaWebApi to ensure there is a target for playback.
 */
export async function getActiveDevice(): Promise<string | null> {
  try {
    const res = await spotifyFetch('/me/player/devices');
    if (!res.ok) return null;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: { id: string; is_active: boolean; type?: string }[] = data.devices ?? [];
    if (devices.length === 0) return null;
    const active = devices.find((d) => d.is_active);
    const phone = devices.find((d) => d.type === 'Smartphone');
    // Prefer this phone for alarms so desktop/speakers do not steal playback.
    const chosen = phone ?? active ?? devices[0];
    return chosen?.id ?? null;
  } catch {
    return null;
  }
}

/** Ensures a target device exists (transfer if none active). */
type ResolveDeviceOutcome =
  | { ok: true; deviceId: string }
  | { ok: false; message: string; httpStatus?: number };

async function resolvePlaybackDevice(): Promise<ResolveDeviceOutcome> {
  try {
    const devRes = await spotifyFetch('/me/player/devices');
    if (!devRes.ok) {
      const body = await spotifyErrorSnippet(devRes);
      alarmifyDebug('Spotify:Devices', 'GET /me/player/devices not ok', {
        status: devRes.status,
        body,
      });
      return {
        ok: false,
        httpStatus: devRes.status,
        message: `Spotify “devices” request failed (${devRes.status}). ${body.slice(0, 120)}`,
      };
    }
    const devData = await devRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: { id: string; is_active: boolean; name?: string; type?: string }[] = devData.devices ?? [];
    if (devices.length === 0) {
      alarmifyDebug('Spotify:Devices', 'no devices returned (open Spotify on a device once)', {});
      return {
        ok: false,
        message:
          'No Spotify Connect devices found. Open the Spotify app on this phone (or another speaker) at least once, then try again.',
      };
    }
    const active = devices.find((d) => d.is_active);
    const phone = devices.find((d) => d.type === 'Smartphone');
    const target = phone ?? active ?? devices[0];
    const id = target.id;
    const needsTransfer = !active || active.id !== id;
    alarmifyDebug('Spotify:Devices', 'resolved target', {
      deviceCount: devices.length,
      hadActive: !!active,
      transfer: needsTransfer,
      names: devices.map((d) => d.name ?? d.id.slice(0, 8)),
    });
    if (needsTransfer) {
      await spotifyFetch('/me/player', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [id], play: false }),
      });
      await new Promise((r) => setTimeout(r, 800));
    }
    return { ok: true, deviceId: id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    alarmifyDebug('Spotify:Devices', 'resolvePlaybackDevice threw', { error: msg });
    return { ok: false, message: `Device lookup error: ${msg}` };
  }
}

async function setPlaybackVolume(deviceId: string | null, percent: number): Promise<boolean> {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const q = deviceId
    ? `?volume_percent=${clamped}&device_id=${encodeURIComponent(deviceId)}`
    : `?volume_percent=${clamped}`;
  const res = await spotifyFetch(`/me/player/volume${q}`, { method: 'PUT' });
  return res.status === 204 || res.status === 200;
}

export type WebPlaybackOptions = {
  positionMs?: number;
  mediaKind?: SpotifyMedia['kind'];
  /** Applied after a successful play (e.g. 0 for silent alarm pre-roll). */
  volumePercent?: number;
};

export type WebApiPlayReason =
  | { ok: true; deviceId: string }
  | { ok: false; message: string; httpStatus?: number };

/** How long cached primed-device id is trusted for {@link revealAlarmPlayback}. */
export const PRIME_DEVICE_CACHE_TTL_MS = ALARM_PREARM_MS + 60_000;

const PLAYBACK_NEAR_START_MS = 3_000;

let lastPrimedDeviceId: string | null = null;
let lastPrimedUri: string | null = null;
let lastPrimedAt = 0;

function clearPrimedDeviceCache(): void {
  lastPrimedDeviceId = null;
  lastPrimedUri = null;
  lastPrimedAt = 0;
}

async function fetchPlayerState(): Promise<{
  deviceId: string | null;
  itemUri: string | null;
  contextUri: string | null;
  progressMs: number;
} | null> {
  const res = await spotifyFetch('/me/player');
  if (res.status === 204) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return {
    deviceId: data.device?.id ?? null,
    itemUri: data.item?.uri ?? null,
    contextUri: data.context?.uri ?? null,
    progressMs: typeof data.progress_ms === 'number' ? data.progress_ms : 0,
  };
}

function isContextPlayback(uri: string, mediaKind?: SpotifyMedia['kind']): boolean {
  const kind = mediaKind ?? getSpotifyUriKind(uri);
  return kind === 'playlist' || kind === 'album';
}

function buildPlayerPlayBody(uri: string, options?: WebPlaybackOptions): Record<string, unknown> {
  if (isContextPlayback(uri, options?.mediaKind)) {
    return {
      context_uri: uri,
      offset: { position: 0 },
    };
  }

  const body: Record<string, unknown> = { uris: [uri] };
  if (options?.positionMs != null) {
    body.position_ms = options.positionMs;
  }
  return body;
}

async function playbackNearStart(expectedUri: string, maxProgressMs: number): Promise<boolean> {
  const st = await fetchPlayerState();
  if (!st?.itemUri) return false;
  if (st.itemUri !== expectedUri) return false;
  return st.progressMs <= maxProgressMs;
}

async function playbackHasUri(expectedUri: string): Promise<boolean> {
  const st = await fetchPlayerState();
  return st?.itemUri === expectedUri;
}

async function playbackHasContext(expectedUri: string): Promise<boolean> {
  const st = await fetchPlayerState();
  return st?.contextUri === expectedUri;
}

async function isDeviceIdInConnectList(deviceId: string): Promise<boolean> {
  try {
    const res = await spotifyFetch('/me/player/devices');
    if (!res.ok) return false;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devices: { id: string }[] = data.devices ?? [];
    return devices.some((d) => d.id === deviceId);
  } catch {
    return false;
  }
}

async function putMePlayerPlay(deviceId: string, body: Record<string, unknown>): Promise<Response> {
  return spotifyFetch(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * Same as {@link playTrackViaWebApi} but returns why it failed (Premium, devices, HTTP, etc.).
 */
export async function playTrackViaWebApiWithReason(
  uri: string,
  options?: WebPlaybackOptions,
): Promise<WebApiPlayReason> {
  alarmifyDebug('Spotify:WebPlay', 'playTrackViaWebApi start', {
    uri,
    mediaKind: options?.mediaKind,
    positionMs: options?.positionMs,
    volumePercent: options?.volumePercent,
  });
  try {
    const token = await getValidToken();
    if (!token) {
      console.warn('[Spotify] No valid token for Web API playback');
      alarmifyDebug('Spotify:WebPlay', 'aborted: no valid token', {});
      return {
        ok: false,
        message: "Not signed in to Spotify in Ethan's Alarm, or the session expired. Open Ethan's Alarm and sign in again.",
      };
    }

    const resolved = await resolvePlaybackDevice();
    if (!resolved.ok) {
      console.warn('[Spotify] No Spotify device available for Web API playback');
      alarmifyDebug('Spotify:WebPlay', 'aborted: resolve device', { message: resolved.message });
      return { ok: false, message: resolved.message, httpStatus: resolved.httpStatus };
    }
    const deviceId = resolved.deviceId;

    const isContext = isContextPlayback(uri, options?.mediaKind);
    const body = buildPlayerPlayBody(uri, options);
    if (isContext) {
      await setShuffleViaWebApi(false);
    }

    let res = await putMePlayerPlay(deviceId, body);

    // 404 = no active player on that device yet — transfer then retry once.
    if (res.status === 404) {
      alarmifyDebug('Spotify:WebPlay', 'play returned 404 — transfer + retry', {});
      await spotifyFetch('/me/player', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      });
      await new Promise((r) => setTimeout(r, 1_000));
      res = await putMePlayerPlay(deviceId, body);
    }

    if (res.status === 204 || res.status === 200) {
      if (options?.volumePercent != null) {
        const volOk = await setPlaybackVolume(deviceId, options.volumePercent);
        if (!volOk) {
          console.warn('[Spotify] Volume API failed after play (playback may still have started)');
          alarmifyDebug('Spotify:WebPlay', 'volume API failed after successful play — treating as success', {
            deviceId: `${deviceId.slice(0, 8)}…`,
          });
        }
      }
      console.log('[Spotify] Web API playback started ✅');
      alarmifyDebug('Spotify:WebPlay', 'success', {
        deviceId: `${deviceId.slice(0, 8)}…`,
        volumePercent: options?.volumePercent,
      });
      return { ok: true, deviceId };
    }

    const errBody = await spotifyErrorSnippet(res);
    if (res.status === 403) {
      console.warn('[Spotify] Web API playback requires Premium (403)');
      alarmifyDebug('Spotify:WebPlay', 'failed 403 (often Free tier)', { body: errBody });
      return {
        ok: false,
        httpStatus: 403,
        message: `Spotify returned 403 (Web API playback needs Premium, or the account cannot control playback). ${errBody.slice(0, 160)}`,
      };
    }

    console.warn(`[Spotify] Web API playback failed: ${res.status}`);
    alarmifyDebug('Spotify:WebPlay', 'play request failed', { status: res.status, body: errBody });
    return {
      ok: false,
      httpStatus: res.status,
      message: `PUT /me/player/play failed with HTTP ${res.status}. ${errBody.slice(0, 200)}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Spotify] Web API playback error:', e);
    alarmifyDebug('Spotify:WebPlay', 'exception', { error: msg });
    return { ok: false, message: `Web API request error: ${msg}` };
  }
}

/**
 * Plays a track via the Spotify Web API (PUT /me/player/play).
 * This is a plain HTTP call — it works in the background without
 * the Spotify App Remote SDK or any UI interaction.
 * Requires Spotify Premium.
 */
export async function playTrackViaWebApi(uri: string, options?: WebPlaybackOptions): Promise<boolean> {
  const r = await playTrackViaWebApiWithReason(uri, options);
  return r.ok;
}

const WEB_API_RETRY_ATTEMPTS = 3;
const WEB_API_RETRY_DELAY_MS = 1_500;

/** Retries Web API play (for background task / auto paths). */
export async function playTrackViaWebApiWithRetries(
  uri: string,
  options?: WebPlaybackOptions,
): Promise<WebApiPlayReason> {
  let last: WebApiPlayReason = { ok: false, message: 'No attempts made' };
  for (let i = 0; i < WEB_API_RETRY_ATTEMPTS; i++) {
    await refreshSpotifyToken();
    last = await playTrackViaWebApiWithReason(uri, options);
    if (last.ok) return last;
    alarmifyDebug('Spotify:WebPlay', `retry ${i + 1}/${WEB_API_RETRY_ATTEMPTS} failed`, {
      message: last.message,
    });
    if (i < WEB_API_RETRY_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, WEB_API_RETRY_DELAY_MS));
    }
  }
  return last;
}

const REVEAL_RAMP_STEPS = [20, 40, 60, 80, 100];
const REVEAL_RAMP_STEP_MS = 2_000;

async function rampPlaybackVolume(deviceId: string, targetPercent: number): Promise<boolean> {
  const target = Math.max(0, Math.min(100, Math.round(targetPercent)));
  const steps = REVEAL_RAMP_STEPS.filter((s) => s <= target);
  if (steps.length === 0 || steps[steps.length - 1] !== target) {
    steps.push(target);
  }

  for (const step of steps) {
    const ok = await setPlaybackVolume(deviceId, step);
    if (!ok && step === target) return false;
    if (step !== steps[steps.length - 1]) {
      await new Promise((r) => setTimeout(r, REVEAL_RAMP_STEP_MS));
    }
  }
  return true;
}

/**
 * Starts the alarm track at volume 0 and enables track repeat so playback
 * survives the pre-arm window. No-op in Expo Go. Requires Premium + active device.
 */
export async function primeAlarmForSilentPlayback(
  uri: string,
  mediaKind?: SpotifyMedia['kind'],
): Promise<boolean> {
  if (isExpoGo) {
    alarmifyDebug('Spotify:Prime', 'skipped (Expo Go)', {});
    return false;
  }

  alarmifyDebug('Spotify:Prime', 'primeAlarmForSilentPlayback start', { uri, mediaKind });
  const web = await playTrackViaWebApiWithReason(uri, { mediaKind, positionMs: 0, volumePercent: 0 });
  if (!web.ok) {
    clearPrimedDeviceCache();
    alarmifyDebug('Spotify:Prime', 'prime failed at play+vol0', { uri, message: web.message });
    return false;
  }

  lastPrimedDeviceId = web.deviceId;
  lastPrimedUri = uri;
  lastPrimedAt = Date.now();

  if (!isContextPlayback(uri, mediaKind)) {
    const rep = await spotifyFetch(
      `/me/player/repeat?state=track&device_id=${encodeURIComponent(web.deviceId)}`,
      { method: 'PUT' },
    );
    if (!(rep.status === 204 || rep.status === 200)) {
      console.warn('[Spotify] Silent prime: repeat=track failed', rep.status);
      alarmifyDebug('Spotify:Prime', 'repeat=track failed', {
        status: rep.status,
        body: await spotifyErrorSnippet(rep),
      });
    }
  } else {
    await spotifyFetch(
      `/me/player/repeat?state=off&device_id=${encodeURIComponent(web.deviceId)}`,
      { method: 'PUT' },
    ).catch(() => null);
  }
  console.log('[Spotify] Silent alarm prime complete (vol 0)');
  alarmifyDebug('Spotify:Prime', 'complete', { deviceId: `${web.deviceId.slice(0, 8)}…` });
  return true;
}

/**
 * At alarm time: seek to start, set audible volume, turn repeat off.
 * If silent prime never ran (or seek fails because nothing is playing), falls back to
 * starting the track from 0 at audible volume via the Web API — avoids deep-link prompts
 * when Connect playback is still possible.
 */
export async function revealAlarmPlayback(
  uri: string,
  volumePercent: number = ALARM_REVEAL_VOLUME_PERCENT,
  mediaKind?: SpotifyMedia['kind'],
): Promise<boolean> {
  if (isExpoGo) {
    alarmifyDebug('Spotify:Reveal', 'skipped (Expo Go)', {});
    return false;
  }

  const isContext = isContextPlayback(uri, mediaKind);
  alarmifyDebug('Spotify:Reveal', 'start', { uri, volumePercent, mediaKind });

  const tryAudiblePlayFromStart = async (): Promise<boolean> => {
    let r = await playTrackViaWebApiWithReason(uri, { mediaKind, positionMs: 0, volumePercent });
    if (!r.ok) {
      alarmifyDebug('Spotify:Reveal', 'audible Web API failed', { message: r.message });
      return false;
    }
    if (isContext) return true;
    await new Promise((res) => setTimeout(res, 450));
    let near = await playbackNearStart(uri, PLAYBACK_NEAR_START_MS);
    if (near) return true;
    alarmifyDebug('Spotify:Reveal', 'audible play verification failed — retry once', {});
    r = await playTrackViaWebApiWithReason(uri, { mediaKind, positionMs: 0, volumePercent });
    if (!r.ok) return false;
    await new Promise((res) => setTimeout(res, 450));
    near = await playbackNearStart(uri, PLAYBACK_NEAR_START_MS);
    return near;
  };

  if (isContext) {
    return tryAudiblePlayFromStart();
  }

  let deviceId: string | null = null;
  const cacheFresh =
    lastPrimedDeviceId &&
    lastPrimedUri === uri &&
    Date.now() - lastPrimedAt <= PRIME_DEVICE_CACHE_TTL_MS;
  if (cacheFresh && lastPrimedDeviceId) {
    const stillThere = await isDeviceIdInConnectList(lastPrimedDeviceId);
    if (stillThere) {
      deviceId = lastPrimedDeviceId;
      alarmifyDebug('Spotify:Reveal', 'using primed device cache', {
        deviceId: `${deviceId.slice(0, 8)}…`,
      });
    } else {
      alarmifyDebug('Spotify:Reveal', 'primed device missing from Connect — re-resolve', {});
    }
  }

  if (!deviceId) {
    const resolved = await resolvePlaybackDevice();
    if (!resolved.ok) {
      console.warn('[Spotify] reveal: resolve device failed — trying audible Web API play');
      alarmifyDebug('Spotify:Reveal', 'resolve failed → audible', { message: resolved.message });
      const ok = await tryAudiblePlayFromStart();
      alarmifyDebug('Spotify:Reveal', 'audible Web API result', { ok });
      return ok;
    }
    deviceId = resolved.deviceId;
  }

  const seekRes = await spotifyFetch(
    `/me/player/seek?position_ms=0&device_id=${encodeURIComponent(deviceId)}`,
    { method: 'PUT' },
  );
  if (!(seekRes.status === 204 || seekRes.status === 200)) {
    console.warn('[Spotify] reveal: seek failed', seekRes.status, '— trying audible Web API play');
    alarmifyDebug('Spotify:Reveal', 'seek failed → audible Web API play', {
      status: seekRes.status,
      body: await spotifyErrorSnippet(seekRes),
    });
    const ok = await tryAudiblePlayFromStart();
    alarmifyDebug('Spotify:Reveal', 'audible Web API result', { ok });
    return ok;
  }

  await new Promise((r) => setTimeout(r, 400));
  const atStart = isContext ? true : await playbackNearStart(uri, PLAYBACK_NEAR_START_MS);
  if (!atStart) {
    alarmifyDebug('Spotify:Reveal', 'seek ok but state not at start — audible play', {});
    const ok = await tryAudiblePlayFromStart();
    alarmifyDebug('Spotify:Reveal', 'audible Web API result', { ok });
    return ok;
  }

  const volOk = await rampPlaybackVolume(deviceId, volumePercent);
  if (!volOk) {
    console.warn('[Spotify] reveal: volume ramp failed — trying audible Web API play');
    alarmifyDebug('Spotify:Reveal', 'volume ramp failed → audible Web API play', {});
    const ok = await tryAudiblePlayFromStart();
    alarmifyDebug('Spotify:Reveal', 'audible Web API result', { ok });
    return ok;
  }

  await spotifyFetch(
    `/me/player/repeat?state=off&device_id=${encodeURIComponent(deviceId)}`,
    { method: 'PUT' },
  ).catch(() => null);

  const correctMedia = isContext ? await playbackHasContext(uri) : await playbackHasUri(uri);
  if (!correctMedia && !isContext) {
    alarmifyDebug('Spotify:Reveal', 'wrong track after reveal — audible play', {});
    const ok = await tryAudiblePlayFromStart();
    alarmifyDebug('Spotify:Reveal', 'audible Web API result', { ok });
    return ok;
  }
  if (!correctMedia) {
    alarmifyDebug('Spotify:Reveal', 'context verification unavailable after reveal; keeping successful playback', {
      uri,
    });
  }

  console.log('[Spotify] Alarm reveal complete (audible volume)');
  alarmifyDebug('Spotify:Reveal', 'complete (seek+vol+repeat off)', {
    deviceId: `${deviceId.slice(0, 8)}…`,
  });
  return true;
}

/**
 * Master playback function. Tries methods in order:
 *   1. Spotify Web API (background-safe, no UI needed, requires Premium)
 *   2. Spotify App Remote SDK (requires foreground connection)
 *   3. Deep link (opens Spotify app directly, last resort)
 */
export type PlayTrackContext = 'background' | 'auto' | 'foreground' | 'tap' | 'alarm_sdk';

export type PlayTrackChannel = 'web_api' | 'remote_sdk' | 'deeplink' | 'expo_deeplink' | 'z_alarm' | 'failed';

export type PlayTrackOptions = {
  context?: PlayTrackContext;
  alarmId?: string;
  mediaKind?: SpotifyMedia['kind'];
};

export interface PlayTrackResult {
  ok: boolean;
  channel: PlayTrackChannel;
  /** Why automatic Web API / Remote playback did not work (deeplink / failed). */
  failureSteps: string[];
  /** True when iOS may show "Open in Spotify?" (custom URL scheme). */
  usedSpotifyUrlScheme: boolean;
}

/** One-line explanation for logs or a small in-app toast. */
export function formatPlaybackDiagnosis(r: PlayTrackResult): string {
  if (r.ok && r.channel === 'web_api') {
    return 'Playing via Spotify (Web API / Connect).';
  }
  if (r.ok && r.channel === 'remote_sdk') {
    return 'Playing via Spotify App Remote.';
  }
  if (r.channel === 'z_alarm') {
    const why = r.failureSteps.length ? r.failureSteps.join(' → ') : 'Spotify unavailable';
    return `Spotify could not play (${why}). Backup alert sound was triggered.`;
  }
  if (r.ok && r.usedSpotifyUrlScheme) {
    const why = r.failureSteps.length ? r.failureSteps.join(' → ') : 'Unknown';
    return `Opened the Spotify app because automatic playback was not possible: ${why}`;
  }
  const why = r.failureSteps.length ? r.failureSteps.join(' → ') : 'Unknown error';
  return `Could not start playback: ${why}`;
}

let lastPlaybackResult: PlayTrackResult | null = null;

/** Last {@link playTrack} outcome (for a debug screen or support). */
export function getLastPlayTrackResult(): PlayTrackResult | null {
  return lastPlaybackResult;
}

/** Open track / playlist / album via HTTPS or spotify: URI. */
async function openSpotifyMediaFallback(uri: string): Promise<boolean> {
  const httpsUrl = spotifyUriToOpenUrl(uri);
  const spotifyUri = sanitizeSpotifyUrl(uri);
  try {
    await Linking.openURL(httpsUrl);
    return true;
  } catch {
    /* continue */
  }
  if (spotifyUri && spotifyUri !== httpsUrl) {
    try {
      await Linking.openURL(spotifyUri);
      return true;
    } catch {
      /* continue */
    }
  }
  try {
    await Linking.openURL(httpsUrl);
    return true;
  } catch {
    return false;
  }
}

/** Open Spotify to a track: HTTPS first (Universal Link when possible), then spotify: scheme. */
async function openSpotifyTrackFallback(trackId: string): Promise<boolean> {
  return openSpotifyMediaFallback(`spotify:track:${trackId}`);
}

async function tryRemoteSdkWithRetries(
  uri: string,
  failureSteps: string[],
  shuffle?: boolean,
  attempts = 2,
): Promise<PlayTrackResult | null> {
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await delay(400);
    const result = await tryRemoteSdk(uri, failureSteps, shuffle);
    if (result) return result;
  }
  return null;
}

function getSpotifyRemote(): {
  connect: (token: string) => Promise<void>;
  playUri: (uri: string) => Promise<void>;
  setShuffling?: (enabled: boolean) => Promise<void>;
} {
  const { remote } = require('react-native-spotify-remote');
  return remote;
}

async function enablePlaylistShuffle(shuffle: boolean | undefined): Promise<void> {
  if (!shuffle) return;
  const remote = getSpotifyRemote();
  try {
    if (typeof remote.setShuffling === 'function') {
      await remote.setShuffling(true);
      return;
    }
  } catch {
    /* fall through */
  }
  await setShuffleViaWebApi(true);
}

async function tryRemoteSdk(
  uri: string,
  failureSteps: string[],
  shuffle?: boolean,
): Promise<PlayTrackResult | null> {
  try {
    const remote = getSpotifyRemote();
    const token = await getValidToken();

    if (!token) {
      failureSteps.push('App Remote: no access token available.');
      return null;
    }

    await remote.connect(token);
    await delay(400);
    await remote.playUri(uri);
    await enablePlaylistShuffle(shuffle);

    failureSteps.push('App Remote: connect + playUri OK');
    console.log('[Spotify] Remote SDK playback started ✅');
    alarmifyDebug('Spotify:playTrack', 'exit via Remote SDK', { shuffle });
    return {
      ok: true,
      channel: 'remote_sdk',
      failureSteps,
      usedSpotifyUrlScheme: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Spotify] Remote SDK playback failed:', e);
    failureSteps.push(`App Remote: ${msg}`);
  }
  return null;
}

const ALARM_SPOTIFY_LAUNCH_DELAY_MS = 1_500;

/** iOS alarm fire: App Remote → Web API → deeplink → zAlarm. */
async function playAlarmSdkTrack(
  uri: string,
  mediaKind: SpotifyMedia['kind'] | undefined,
): Promise<PlayTrackResult> {
  const failureSteps: string[] = [];
  const cascadeSteps: string[] = [];
  const shuffle = false;

  const opened = await openSpotifyApp();
  cascadeSteps.push(opened ? 'Opened Spotify app' : 'Could not open Spotify app (continuing)');
  await delay(ALARM_SPOTIFY_LAUNCH_DELAY_MS);

  const remoteResult = await tryRemoteSdkWithRetries(uri, failureSteps, shuffle);
  if (remoteResult) {
    cascadeSteps.push('App Remote succeeded');
    const result: PlayTrackResult = { ...remoteResult, failureSteps: [...cascadeSteps, ...failureSteps] };
    lastPlaybackResult = result;
    logPlaybackDiagnosisIfNeeded(result);
    return result;
  }

  cascadeSteps.push('App Remote failed after retries');
  failureSteps.push('Trying Spotify Web API…');

  const webResult = await playTrackWebApiOnly(uri, failureSteps, true, mediaKind);
  if (webResult.ok) {
    cascadeSteps.push('Web API: playback started');
    const result: PlayTrackResult = {
      ...webResult,
      failureSteps: [...cascadeSteps, ...failureSteps],
    };
    lastPlaybackResult = result;
    logPlaybackDiagnosisIfNeeded(result);
    return result;
  }

  cascadeSteps.push(`Web API failed: ${failureSteps[failureSteps.length - 1] ?? 'unknown'}`);
  failureSteps.push('Trying Spotify link…');

  const linkOpened = await openSpotifyMediaFallback(uri);
  if (linkOpened) {
    cascadeSteps.push('Opened Spotify link (may need manual play)');
    alarmifyDebug('Spotify:playTrack', 'alarm_sdk deeplink opened', { uri });
    const result: PlayTrackResult = {
      ok: true,
      channel: 'deeplink',
      failureSteps: [...cascadeSteps, ...failureSteps],
      usedSpotifyUrlScheme: true,
    };
    lastPlaybackResult = result;
    logPlaybackDiagnosisIfNeeded(result);
    return result;
  }

  cascadeSteps.push('Could not open Spotify link');
  const { playZAlarmFallback } = await import('./zAlarm');
  const zReason =
    failureSteps.length > 0 ? failureSteps.join(' · ').slice(0, 220) : 'Spotify unavailable at alarm';
  await playZAlarmFallback(zReason);

  const result: PlayTrackResult = {
    ok: false,
    channel: 'z_alarm',
    failureSteps: [...cascadeSteps, ...failureSteps],
    usedSpotifyUrlScheme: false,
  };
  lastPlaybackResult = result;
  logPlaybackDiagnosisIfNeeded(result);
  return result;
}

async function playTrackWebApiOnly(
  uri: string,
  failureSteps: string[],
  withRetries: boolean,
  mediaKind?: SpotifyMedia['kind'],
): Promise<PlayTrackResult> {
  const web = withRetries
    ? await playTrackViaWebApiWithRetries(uri, { mediaKind })
    : await playTrackViaWebApiWithReason(uri, { mediaKind });

  if (web.ok) {
    return {
      ok: true,
      channel: 'web_api',
      failureSteps,
      usedSpotifyUrlScheme: false,
    };
  }
  failureSteps.push(`Web API: ${web.message}`);
  return {
    ok: false,
    channel: 'failed',
    failureSteps,
    usedSpotifyUrlScheme: false,
  };
}

function finalizePlayback(
  result: PlayTrackResult,
  alarmId: string | undefined,
): PlayTrackResult {
  lastPlaybackResult = result;
  if (result.ok && alarmId) {
    disableAlarmAfterFired(alarmId);
  }
  logPlaybackDiagnosisIfNeeded(result);
  return result;
}

export async function playTrack(uri: string, options?: PlayTrackOptions): Promise<PlayTrackResult> {
  const context = options?.context ?? 'auto';
  const alarmId = options?.alarmId;
  const mediaKind = options?.mediaKind;
  const uriKind = mediaKind ?? getSpotifyUriKind(uri);
  alarmifyDebug('Spotify:playTrack', 'start', { uri, isExpoGo, context, alarmId, mediaKind });
  const failureSteps: string[] = [];

  if (isExpoGo) {
    console.log('[Spotify] Expo Go: using deep link fallback');
    alarmifyDebug('Spotify:playTrack', 'Expo Go → deep link only', {});
    failureSteps.push('Expo Go: Web API + App Remote are unavailable; only a Spotify URL can be opened.');
    const trackId = uri.replace('spotify:track:', '');
    const opened = uriKind === 'track'
      ? await openSpotifyTrackFallback(trackId)
      : await openSpotifyMediaFallback(uri);
    if (opened) {
      alarmifyDebug('Spotify:playTrack', 'Expo Go deep link opened', { trackId });
      return finalizePlayback(
        {
          ok: true,
          channel: 'expo_deeplink',
          failureSteps,
          usedSpotifyUrlScheme: true,
        },
        alarmId,
      );
    }
    failureSteps.push('Could not open Spotify (https or spotify: URL).');
    return finalizePlayback(
      {
        ok: false,
        channel: 'failed',
        failureSteps,
        usedSpotifyUrlScheme: true,
      },
      alarmId,
    );
  }

  if (context === 'alarm_sdk') {
    return playAlarmSdkTrack(uri, mediaKind);
  }

  // ── Background / auto: Web API only (no deep-link popup) ─────────────────
  if (context === 'background' || context === 'auto') {
    const result = await playTrackWebApiOnly(uri, failureSteps, true, mediaKind);
    if (result.ok) {
      return finalizePlayback(result, alarmId);
    }
    if (failureSteps.some((step) => step.toLowerCase().includes('not signed in'))) {
      const opened = await openSpotifyMediaFallback(uri);
      if (opened) {
        failureSteps.push('Opened Spotify link because beta playback is not connected.');
        return finalizePlayback(
          {
            ok: true,
            channel: 'deeplink',
            failureSteps,
            usedSpotifyUrlScheme: true,
          },
          alarmId,
        );
      }
    }
    const { playZAlarmFallback } = await import('./zAlarm');
    const zReason =
      failureSteps.length > 0 ? failureSteps.join(' · ').slice(0, 220) : 'Web API failed after retries';
    await playZAlarmFallback(zReason);
    return finalizePlayback(
      {
        ok: false,
        channel: 'z_alarm',
        failureSteps,
        usedSpotifyUrlScheme: false,
      },
      alarmId,
    );
  }

  // ── Foreground / tap: Remote first, then Web API ─────────────────────────
  if (context === 'tap' || context === 'foreground') {
    const remoteResult = await tryRemoteSdk(uri, failureSteps);
    if (remoteResult) {
      return finalizePlayback(remoteResult, alarmId);
    }
    const webResult = await playTrackWebApiOnly(uri, failureSteps, false, mediaKind);
    if (webResult.ok) {
      return finalizePlayback(webResult, alarmId);
    }
  } else {
    const webResult = await playTrackWebApiOnly(uri, failureSteps, false, mediaKind);
    if (webResult.ok) {
      return finalizePlayback(webResult, alarmId);
    }
    const remoteResult = await tryRemoteSdk(uri, failureSteps);
    if (remoteResult) {
      return finalizePlayback(remoteResult, alarmId);
    }
  }

  // ── Deep link (foreground/tap / failed auto only) ────────────────────────
  console.log('[Spotify] Falling back to deep link');
  alarmifyDebug('Spotify:playTrack', 'exit via deep link (https first, then spotify:)', {
    uri,
  });
  const trackId = uri.replace('spotify:track:', '');
  const opened = uriKind === 'track'
    ? await openSpotifyTrackFallback(trackId)
    : await openSpotifyMediaFallback(uri);
  if (opened) {
    alarmifyDebug('Spotify:playTrack', 'deep link openURL returned', { trackId });
    return finalizePlayback(
      {
        ok: true,
        channel: 'deeplink',
        failureSteps,
        usedSpotifyUrlScheme: true,
      },
      alarmId,
    );
  }
  failureSteps.push('Could not open Spotify (https or spotify: URL).');
  return finalizePlayback(
    {
      ok: false,
      channel: 'failed',
      failureSteps,
      usedSpotifyUrlScheme: true,
    },
    alarmId,
  );
}

function logPlaybackDiagnosisIfNeeded(r: PlayTrackResult): void {
  const line = formatPlaybackDiagnosis(r);
  if (r.usedSpotifyUrlScheme || !r.ok) {
    console.warn("[Ethan's Alarm:Playback]", line);
  }
  alarmifyDebug('Spotify:playTrack', 'diagnosis', {
    ok: r.ok,
    channel: r.channel,
    usedSpotifyUrlScheme: r.usedSpotifyUrlScheme,
    failureSteps: r.failureSteps,
  });
}
// ── User Profile / Session ───────────────────────────────────────────────────

type UserProfileResult =
  | { status: 'ok'; profile: SpotifyUserProfile }
  | { status: 'invalid' }
  | { status: 'unavailable' };

async function fetchUserProfileResult(): Promise<UserProfileResult> {
  try {
    const res = await spotifyFetch('/me');
    if (res.status === 401) {
      await clearAuth();
      return { status: 'invalid' };
    }
    if (!res.ok) return { status: 'unavailable' };
    const data = await res.json();
    const profile: SpotifyUserProfile = {
      name: data.display_name ?? 'Spotify User',
      image: data.images?.[0]?.url ?? null,
    };
    return { status: 'ok', profile };
  } catch {
    const stored = await loadAuth();
    return stored ? { status: 'unavailable' } : { status: 'invalid' };
  }
}

export async function getUserProfile(): Promise<SpotifyUserProfile | null> {
  const result = await fetchUserProfileResult();
  return result.status === 'ok' ? result.profile : null;
}

export async function verifySpotifySession(): Promise<{
  auth: SpotifyAuth;
  profile: SpotifyUserProfile | null;
} | null> {
  const stored = await loadAuth();
  if (!stored) return null;

  await refreshSpotifyToken();
  const result = await fetchUserProfileResult();

  if (result.status === 'invalid') {
    await clearAuth();
    return null;
  }

  const auth = (await loadAuth()) ?? stored;
  return {
    auth,
    profile: result.status === 'ok' ? result.profile : null,
  };
}

// ── Auth URL Builder ─────────────────────────────────────────────────────────

export function buildAuthUrl(
  codeChallenge: string,
  state: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
