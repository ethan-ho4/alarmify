import { Platform } from 'react-native';

/** iOS uses Shortcuts + App Group unless legacy Web API path is forced. */
export function usesShortcutsAlarmOnIos(): boolean {
  return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_ALARMIFY_LEGACY_IOS_PLAYBACK !== '1';
}

export function usesLegacyAlarmPlayback(): boolean {
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') return !usesShortcutsAlarmOnIos();
  return false;
}
