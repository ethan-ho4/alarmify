import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { syncBedtimeWarningIfNeeded } from '../utils/bedtimeGate';
import { usesIosSdkAlarmPlayback } from '../utils/alarmPlaybackMode';

/** Foreground + enabled alarms → show bedtime warning (iOS SDK path). */
export function useBedtimeGate(): void {
  const alarms = useStore((s) => s.alarms);
  const alarmsLoaded = useStore((s) => s.alarmsLoaded);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !usesIosSdkAlarmPlayback()) return;
    if (!alarmsLoaded) return;
    syncBedtimeWarningIfNeeded();
  }, [alarms, alarmsLoaded]);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !usesIosSdkAlarmPlayback()) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        syncBedtimeWarningIfNeeded();
      }
    });

    return () => sub.remove();
  }, []);
}
