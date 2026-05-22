import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_SEEN_KEY = 'alarmify_has_seen_first_launch_disclaimer';

export async function hasSeenFirstLaunchDisclaimer(): Promise<boolean> {
  return (await AsyncStorage.getItem(HAS_SEEN_KEY)) === '1';
}

export async function markFirstLaunchDisclaimerSeen(): Promise<void> {
  await AsyncStorage.setItem(HAS_SEEN_KEY, '1');
}
