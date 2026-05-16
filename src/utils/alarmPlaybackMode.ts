import { Platform } from 'react-native';

/** iOS: keepalive + timer → stop audio at fire → Focus OFF → user Shortcut opens Spotify. */
export function usesIosFocusKeepaliveAlarm(): boolean {
  return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK !== '1';
}

/** Android, or iOS with EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK=1 (Web API at fire). */
export function usesLegacyAlarmPlayback(): boolean {
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK === '1';
  return false;
}

/** Silent keepalive + JS alarm timers (iOS Focus path and legacy mobile paths). */
export function usesAlarmTimersAndKeepalive(): boolean {
  return usesLegacyAlarmPlayback() || usesIosFocusKeepaliveAlarm();
}

/** @deprecated Use usesIosFocusKeepaliveAlarm */
export function usesShortcutsAlarmOnIos(): boolean {
  return usesIosFocusKeepaliveAlarm();
}
