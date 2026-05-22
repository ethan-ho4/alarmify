import { Platform } from 'react-native';

/** iOS: keepalive + JS timers + App Remote at fire (no Shortcuts / Web API alarm path). */
export function usesIosSdkAlarmPlayback(): boolean {
  return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK !== '1';
}

/** Android, or iOS with EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK=1 (Web API at fire). */
export function usesLegacyAlarmPlayback(): boolean {
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') return process.env.EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK === '1';
  return false;
}

export function usesAlarmTimersAndKeepalive(): boolean {
  return usesLegacyAlarmPlayback() || usesIosSdkAlarmPlayback();
}

/** @deprecated Removed on iOS SDK path */
export function usesIosFocusKeepaliveAlarm(): boolean {
  return false;
}

/** @deprecated Removed on iOS SDK path */
export function usesShortcutsAlarmOnIos(): boolean {
  return false;
}
