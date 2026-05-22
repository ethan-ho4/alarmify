// ─────────────────────────────────────────────
//  Ethan's Alarm – Background Audio Keepalive
//  Loops a WAV so iOS keeps the app alive for JS timers.
//  Asset: silence.wav (near-silent; keeps the audio session active).
//  Volume: EXPO_PUBLIC_ALARMIFY_KEEPALIVE_VOLUME (0–1), default 0 (silent).
//  Optional: EXPO_PUBLIC_ALARMIFY_KEEPALIVE_IOS_MIX=1 → MixWithOthers instead of DuckOthers.
// ─────────────────────────────────────────────

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';
import { alarmifyDebug } from '../utils/alarmifyDebug';

const WATCHDOG_MS = 30_000;

function iosMixWithOthersPreferred(): boolean {
  try {
    const v = process.env.EXPO_PUBLIC_ALARMIFY_KEEPALIVE_IOS_MIX;
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

let sound: Audio.Sound | null = null;
let isRunning = false;
let shouldBeRunning = false;
let keepaliveDebugPaused = false;
let audibleTestOverride = false;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;

/** Wall-clock ms when current contiguous `isPlaying` streak began (foreground bookkeeping). */
let playingStreakStart: number | null = null;

/** Env-only volume (ignores debug audible toggle). For UI copy / health warnings. */
export function getKeepaliveEnvVolume(): number {
  return parseKeepaliveVolumeFromEnv();
}

function parseKeepaliveVolumeFromEnv(): number {
  try {
    const v = process.env.EXPO_PUBLIC_ALARMIFY_KEEPALIVE_VOLUME;
    if (v != null && v !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return Math.min(1, Math.max(0, n));
    }
  } catch {
    /* ignore */
  }
  return 0;
}

export function getEffectiveKeepaliveVolume(): number {
  if (audibleTestOverride) return 1;
  return parseKeepaliveVolumeFromEnv();
}

/** Human-readable mode for UI / health copy. */
export function getKeepaliveVolumeModeLabel(): string {
  if (audibleTestOverride) return 'Debug max (100%)';
  const v = parseKeepaliveVolumeFromEnv();
  if (v <= 0) return 'Silent (0)';
  if (v <= 0.05) return `Quiet (${Math.round(v * 100)}%)`;
  if (v >= 0.95) return `Full (${Math.round(v * 100)}%)`;
  return `Player vol (${Math.round(v * 100)}%)`;
}

function bumpPlayingSurvival(isPlaying: boolean): void {
  if (isPlaying) {
    if (playingStreakStart == null) playingStreakStart = Date.now();
  } else {
    playingStreakStart = null;
  }
}

export function getKeepaliveSurvivalMs(): number {
  if (playingStreakStart == null) return 0;
  return Date.now() - playingStreakStart;
}

export type KeepalivePlaybackStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  volumeMode: string;
  effectiveVolume: number;
};

export async function getKeepalivePlaybackStatus(): Promise<KeepalivePlaybackStatus | null> {
  if (Platform.OS === 'web' || !sound) return null;
  try {
    const status = await sound.getStatusAsync();
    const effectiveVolume = getEffectiveKeepaliveVolume();
    if (!status.isLoaded) {
      bumpPlayingSurvival(false);
      return {
        isLoaded: false,
        isPlaying: false,
        positionMillis: 0,
        volumeMode: getKeepaliveVolumeModeLabel(),
        effectiveVolume,
      };
    }
    bumpPlayingSurvival(status.isPlaying);
    return {
      isLoaded: true,
      isPlaying: status.isPlaying,
      positionMillis: status.positionMillis ?? 0,
      volumeMode: getKeepaliveVolumeModeLabel(),
      effectiveVolume,
    };
  } catch {
    bumpPlayingSurvival(false);
    return null;
  }
}

export async function isKeepaliveActuallyPlaying(): Promise<boolean> {
  const s = await getKeepalivePlaybackStatus();
  return s?.isPlaying === true;
}

export function isKeepaliveDebugPaused(): boolean {
  return keepaliveDebugPaused;
}

export function setKeepaliveDebugPaused(paused: boolean): void {
  keepaliveDebugPaused = paused;
}

export function setKeepaliveAudibleTest(enabled: boolean): void {
  audibleTestOverride = enabled;
  void applyVolumeToSound();
}

async function applyVolumeToSound(): Promise<void> {
  if (!sound) return;
  try {
    const st = await sound.getStatusAsync();
    if (st.isLoaded) {
      await sound.setVolumeAsync(getEffectiveKeepaliveVolume());
    }
  } catch {
    /* ignore */
  }
}

async function configureAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: iosMixWithOthersPreferred()
      ? InterruptionModeIOS.MixWithOthers
      : InterruptionModeIOS.DuckOthers,
    shouldDuckAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    playThroughEarpieceAndroid: false,
  });
}

function clearWatchdog(): void {
  if (watchdogInterval != null) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

function startWatchdog(): void {
  clearWatchdog();
  if (Platform.OS === 'web') return;
  watchdogInterval = setInterval(() => {
    void (async () => {
      if (!shouldBeRunning || keepaliveDebugPaused) return;
      const playing = await isKeepaliveActuallyPlaying();
      if (!playing) {
        alarmifyDebug('BackgroundAudio', 'watchdog: not playing — recover', {});
        await recoverKeepalive();
      }
    })();
  }, WATCHDOG_MS);
}

async function ensureKeepalivePlaying(): Promise<void> {
  await configureAudioSession();
  const vol = getEffectiveKeepaliveVolume();

  if (sound) {
    try {
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        await sound.setVolumeAsync(vol);
        if (!status.isPlaying) {
          await sound.playAsync();
        }
        bumpPlayingSurvival(true);
        return;
      }
    } catch {
      try {
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
      sound = null;
    }
  }

  const { sound: newSound } = await Audio.Sound.createAsync(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../assets/silence.wav'),
    {
      isLooping: true,
      volume: vol,
      shouldPlay: true,
    },
  );

  sound = newSound;

  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !shouldBeRunning) return;
    bumpPlayingSurvival(status.isPlaying);
    if (!status.isPlaying) {
      alarmifyDebug('BackgroundAudio', 'playback stopped — re-acquiring session', {});
      void recoverKeepalive();
    }
  });

  bumpPlayingSurvival(true);
}

async function recoverKeepalive(): Promise<void> {
  if (!shouldBeRunning || Platform.OS === 'web' || keepaliveDebugPaused) return;
  try {
    await ensureKeepalivePlaying();
    isRunning = true;
    alarmifyDebug('BackgroundAudio', 'keepalive recovered', {});
  } catch (e) {
    isRunning = false;
    bumpPlayingSurvival(false);
    alarmifyDebug('BackgroundAudio', 'recover failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function startBackgroundKeepalive(): Promise<void> {
  if (Platform.OS === 'web' || keepaliveDebugPaused) return;

  shouldBeRunning = true;

  try {
    await ensureKeepalivePlaying();
    isRunning = true;
    startWatchdog();
    console.log('[BackgroundAudio] Keepalive started');
    alarmifyDebug('BackgroundAudio', 'keepalive started', {
      volumeMode: getKeepaliveVolumeModeLabel(),
      effectiveVolume: getEffectiveKeepaliveVolume(),
    });
  } catch (e) {
    isRunning = false;
    bumpPlayingSurvival(false);
    console.warn('[BackgroundAudio] Failed to start keepalive:', e);
    alarmifyDebug('BackgroundAudio', 'start failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Re-applies audio session + playback while keepalive should be on (e.g. AppState → background). */
export async function touchBackgroundKeepalive(): Promise<void> {
  if (Platform.OS === 'web' || !shouldBeRunning || keepaliveDebugPaused) return;
  try {
    await ensureKeepalivePlaying();
    isRunning = true;
    alarmifyDebug('BackgroundAudio', 'touchBackgroundKeepalive OK', {});
  } catch (e) {
    alarmifyDebug('BackgroundAudio', 'touchBackgroundKeepalive failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function stopBackgroundKeepalive(): Promise<void> {
  shouldBeRunning = false;
  isRunning = false;
  clearWatchdog();
  bumpPlayingSurvival(false);

  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }
  } catch {
    // ignore cleanup errors
  }

  sound = null;
  console.log('[BackgroundAudio] Keepalive stopped');
  alarmifyDebug('BackgroundAudio', 'keepalive stopped', {});
}

export function isKeepaliveRunning(): boolean {
  return isRunning && shouldBeRunning;
}

export function isKeepaliveHijacked(): boolean {
  return shouldBeRunning && !isRunning;
}
