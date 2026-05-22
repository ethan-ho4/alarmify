import { Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { hasEnabledAlarmWithMedia } from './media';
import { usesIosSdkAlarmPlayback } from './alarmPlaybackMode';

/** Show bedtime warning when any enabled alarm has media (iOS SDK path). */
export function syncBedtimeWarningIfNeeded(): void {
  if (Platform.OS !== 'ios' || !usesIosSdkAlarmPlayback()) return;
  if (hasEnabledAlarmWithMedia(useStore.getState().alarms)) {
    useStore.getState().enterWarning();
  }
}
