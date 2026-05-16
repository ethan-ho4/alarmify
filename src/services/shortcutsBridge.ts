import { Platform } from 'react-native';
import {
  getActiveAlarmPayload,
  isShortcutsBridgeAvailable,
  setActiveAlarmPayload,
} from 'alarmify-shortcuts';
import { Alarm } from '../types';
import { sanitizeSpotifyUrl } from '../utils/spotifyUri';
import { usesIosFocusKeepaliveAlarm } from '../utils/alarmPlaybackMode';
import { notifyShortcutsSyncFailure } from './shortcutsDebugNotify';

export { isShortcutsBridgeAvailable, getActiveAlarmPayload };

export function shouldSyncToShortcuts(): boolean {
  return usesIosFocusKeepaliveAlarm();
}

/** Write the next enabled alarm track URI into the shared App Group. */
export async function syncActiveAlarmToShortcuts(alarms: Alarm[]): Promise<void> {
  if (!shouldSyncToShortcuts()) return;

  const active = pickActiveAlarm(alarms);
  if (!active?.track?.uri) {
    const ok = setActiveAlarmPayload('', false);
    if (!ok) {
      await notifyShortcutsSyncFailure('Native Shortcuts bridge unavailable. Rebuild with EAS dev client.');
    }
    return;
  }

  const uri = sanitizeSpotifyUrl(active.track.uri);
  if (!uri) {
    await notifyShortcutsSyncFailure('Could not convert song link for Shortcuts. Pick another track.');
    setActiveAlarmPayload('', false);
    return;
  }

  const ok = setActiveAlarmPayload(uri, active.isEnabled);
  if (!ok) {
    await notifyShortcutsSyncFailure('Could not write alarm to App Group. Rebuild the dev client.');
  }
}

function pickActiveAlarm(alarms: Alarm[]): Alarm | null {
  const enabled = alarms.filter((a) => a.isEnabled && a.track?.uri);
  if (enabled.length === 0) return null;
  return enabled.sort((a, b) => a.time.localeCompare(b.time))[0];
}
