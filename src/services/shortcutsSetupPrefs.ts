import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_SEEN_KEY = 'alarmify_has_seen_shortcuts_setup';

export async function hasSeenShortcutsSetup(): Promise<boolean> {
  return (await AsyncStorage.getItem(HAS_SEEN_KEY)) === '1';
}

export async function markShortcutsSetupSeen(): Promise<void> {
  await AsyncStorage.setItem(HAS_SEEN_KEY, '1');
}
