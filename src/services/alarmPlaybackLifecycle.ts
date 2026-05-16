// ─────────────────────────────────────────────
//  After an alarm fires, auto-disable until the user turns it on again.
// ─────────────────────────────────────────────

import { useStore } from '../store/useStore';

/** Turns off `isEnabled` for this alarm after it runs (timer or playback path). */
export function disableAlarmAfterFired(alarmId: string | undefined): void {
  if (!alarmId) return;
  const { alarms, updateAlarm } = useStore.getState();
  const alarm = alarms.find((a) => a.id === alarmId);
  if (!alarm || !alarm.isEnabled) return;
  void updateAlarm({ ...alarm, isEnabled: false });
}
