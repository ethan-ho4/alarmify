// ─────────────────────────────────────────────
//  Ethan's Alarm – System health for alarm reliability
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
import { hasEnabledAlarmWithMedia } from '../utils/media';

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
  const hasEnabledAlarms = hasEnabledAlarmWithMedia(alarms);

  const token = hasEnabledAlarms ? await getValidToken() : null;
  const hijacked = isKeepaliveHijacked();
  const actuallyPlaying = hasEnabledAlarms ? await isKeepaliveActuallyPlaying() : false;

  const envVol = getKeepaliveEnvVolume();
  const validationKeepaliveNotice =
    hasEnabledAlarms && envVol > 0.05
      ? `Validation: audible keepalive + player volume ${Math.round(envVol * 100)}%. Raise iPhone volume (and disable mute) to hear it; set EXPO_PUBLIC_ALARMIFY_KEEPALIVE_VOLUME to 0 for normal silent keepalive.`
      : hasEnabledAlarms && envVol <= 0.05
        ? 'Silent keepalive: expo-av should report playing even though you hear nothing. Raise EXPO_PUBLIC_ALARMIFY_KEEPALIVE_VOLUME temporarily if you need to verify audio.'
        : null;

  const connectCount = hasEnabledAlarms && token ? await getSpotifyConnectDeviceCount() : null;

  const items: HealthItem[] = [
    {
      label: 'Audio session',
      ok: !hasEnabledAlarms || (actuallyPlaying && !hijacked),
      detail: !hasEnabledAlarms
        ? 'No active alarms'
        : hijacked
          ? "Interrupted — reopen Ethan's Alarm"
          : actuallyPlaying
            ? `Playing · ${getKeepaliveVolumeModeLabel()}`
            : `Not playing — JS timers may not fire. ${getKeepaliveVolumeModeLabel()}`,
    },
    {
      label: token ? 'Spotify beta auth' : 'Spotify link mode',
      ok: true,
      detail: token ? 'Token valid for beta playback' : 'Using saved links; no Spotify login needed',
    },
    {
      label: token ? 'Spotify Connect' : 'Public playback',
      ok: !token || (connectCount != null && connectCount > 0),
      detail:
        !token
          ? 'Opens the saved Spotify link at alarm time'
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
