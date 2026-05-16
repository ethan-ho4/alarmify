// ─────────────────────────────────────────────
//  Alarmify – Z-Alarm (local sound fallback)
//  When Spotify Web API fails, play a system sound
//  so the user is not met with silence.
// ─────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { alarmifyDebug } from '../utils/alarmifyDebug';

export async function playZAlarmFallback(reason?: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const base = 'Spotify could not start — playing backup alert.';
  const snippet = (reason ?? '').trim().slice(0, 220);
  const body = snippet ? `${base}\n${snippet}` : base;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alarm',
        body,
        sound: 'default',
      },
      trigger: null,
    });
    alarmifyDebug('ZAlarm', 'local backup notification sound triggered', { snippetLen: snippet.length });
  } catch (e) {
    console.warn('[ZAlarm] Failed to play backup sound:', e);
  }
}
