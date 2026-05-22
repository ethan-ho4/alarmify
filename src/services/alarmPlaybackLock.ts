import { alarmifyDebug } from '../utils/alarmifyDebug';

const RECENT_PLAYBACK_COOLDOWN_MS = 2 * 60 * 1000;

const activeAlarmIds = new Set<string>();
const recentAlarmPlayback = new Map<string, number>();

export function beginAlarmPlayback(alarmId: string | null | undefined, source: string): boolean {
  if (!alarmId) return true;

  const now = Date.now();
  const lastStartedAt = recentAlarmPlayback.get(alarmId);
  if (activeAlarmIds.has(alarmId) || (lastStartedAt && now - lastStartedAt < RECENT_PLAYBACK_COOLDOWN_MS)) {
    alarmifyDebug('AlarmPlaybackLock', 'skipping duplicate playback path', {
      alarmId,
      source,
      active: activeAlarmIds.has(alarmId),
      msSinceLastStart: lastStartedAt ? now - lastStartedAt : null,
    });
    return false;
  }

  activeAlarmIds.add(alarmId);
  recentAlarmPlayback.set(alarmId, now);
  return true;
}

export function endAlarmPlayback(alarmId: string | null | undefined): void {
  if (!alarmId) return;
  activeAlarmIds.delete(alarmId);
}
