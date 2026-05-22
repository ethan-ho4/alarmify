import { Alarm } from '../types';

export const NEARBY_ALARM_WINDOW_MINUTES = 30;

export function minutesFromAlarmTime(time: string): number {
  const [hoursRaw, minutesRaw] = time.split(':').map(Number);
  const hours = Number.isFinite(hoursRaw) ? hoursRaw : 0;
  const minutes = Number.isFinite(minutesRaw) ? minutesRaw : 0;
  return hours * 60 + minutes;
}

export function timeDistanceMinutes(a: string, b: string): number {
  const dayMinutes = 24 * 60;
  const diff = Math.abs(minutesFromAlarmTime(a) - minutesFromAlarmTime(b));
  return Math.min(diff, dayMinutes - diff);
}

export function findDuplicateTimeAlarm(
  alarms: Alarm[],
  candidate: Pick<Alarm, 'id' | 'time'>,
): Alarm | null {
  return alarms.find((alarm) => alarm.id !== candidate.id && alarm.time === candidate.time) ?? null;
}

export function findNearbyEnabledAlarm(
  alarms: Alarm[],
  candidate: Pick<Alarm, 'id' | 'time' | 'isEnabled'>,
  windowMinutes = NEARBY_ALARM_WINDOW_MINUTES,
): Alarm | null {
  if (!candidate.isEnabled) return null;

  return alarms.find((alarm) => {
    if (alarm.id === candidate.id || !alarm.isEnabled) return false;
    return timeDistanceMinutes(alarm.time, candidate.time) <= windowMinutes;
  }) ?? null;
}
