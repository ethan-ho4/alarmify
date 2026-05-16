// ─────────────────────────────────────────────
//  Alarmify – System health for alarm reliability
// ─────────────────────────────────────────────

import {
  getKeepaliveEnvVolume,
  getKeepaliveVolumeModeLabel,
  isKeepaliveActuallyPlaying,
  isKeepaliveHijacked,
} from './backgroundAudio';
import { isBackgroundTaskRegistered } from './backgroundTasks';
import { getValidToken, getSpotifyConnectDeviceCount } from './spotify';
import { useStore } from '../store/useStore';

export type HealthItem = {
  label: string;
  ok: boolean;
  detail: string;
};

export type AlarmHealthSnapshot = {
  items: HealthItem[];
  allOk: boolean;
  hasEnabledAlarms: boolean;
  /** Spotify Connect device count from Web API; null if unavailable. */
  spotifyConnectDevices: number | null;
  /** Shown when keepalive volume is high (validation builds). */
  validationKeepaliveNotice: string | null;
};

export async function fetchAlarmHealth(): Promise<AlarmHealthSnapshot> {
  const alarms = useStore.getState().alarms;
  const hasEnabledAlarms = alarms.some((a) => a.isEnabled && a.track?.uri);

  const token = await getValidToken();
  const hijacked = isKeepaliveHijacked();
  const actuallyPlaying = hasEnabledAlarms ? await isKeepaliveActuallyPlaying() : false;

  const envVol = getKeepaliveEnvVolume();
  const validationKeepaliveNotice =
    hasEnabledAlarms && envVol > 0.05
      ? `Validation: audible keepalive + player volume ${Math.round(envVol * 100)}%. Raise iPhone volume (and disable mute) to hear it; set EXPO_PUBLIC_ALARMIFY_KEEPALIVE_VOLUME to 0 for normal silent keepalive.`
      : hasEnabledAlarms && envVol <= 0.05
        ? 'Silent keepalive: expo-av should report playing even though you hear nothing. Raise EXPO_PUBLIC_ALARMIFY_KEEPALIVE_VOLUME temporarily if you need to verify audio.'
        : null;

  const connectCount = token ? await getSpotifyConnectDeviceCount() : null;

  const items: HealthItem[] = [
    {
      label: 'Audio session',
      ok: !hasEnabledAlarms || (actuallyPlaying && !hijacked),
      detail: !hasEnabledAlarms
        ? 'No active alarms'
        : hijacked
          ? 'Interrupted — reopen Alarmify'
          : actuallyPlaying
            ? `Playing · ${getKeepaliveVolumeModeLabel()}`
            : `Not playing — JS timers may not fire. ${getKeepaliveVolumeModeLabel()}`,
    },
    {
      label: 'Spotify auth',
      ok: !!token,
      detail: token ? 'Token valid' : 'Sign in to Spotify',
    },
    {
      label: 'Spotify Connect',
      ok: connectCount != null && connectCount > 0,
      detail:
        !token
          ? 'Sign in to check'
          : connectCount == null
            ? 'Could not load devices — check network'
            : connectCount === 0
              ? 'No devices — open Spotify on this phone once'
              : `${connectCount} device(s) visible for playback`,
    },
    {
      label: 'Background task',
      ok: isBackgroundTaskRegistered(),
      detail: isBackgroundTaskRegistered() ? 'Registered' : 'Not registered',
    },
  ];

  return {
    items,
    allOk: items.every((i) => i.ok),
    hasEnabledAlarms,
    spotifyConnectDevices: connectCount,
    validationKeepaliveNotice,
  };
}
