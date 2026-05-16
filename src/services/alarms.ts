// ─────────────────────────────────────────────
//  Alarmify – Alarm Service
//  CRUD + expo-notifications scheduling
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Alarm } from '../types';
import { usesLegacyAlarmPlayback } from '../utils/alarmPlaybackMode';

const STORAGE_KEY = 'alarmify_v1_alarms';

// ── Storage ──────────────────────────────────────────────────────────────────

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Alarm[]) : [];
  } catch {
    return [];
  }
}

export async function persistAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

// ── Notification Scheduling ──────────────────────────────────────────────────

/** Cancels all previously scheduled notifications for an alarm, then re-creates them. */
export async function scheduleAlarmNotifications(alarm: Alarm): Promise<string[]> {
  if (Platform.OS === 'web' || !usesLegacyAlarmPlayback()) return [];

  // Cancel existing
  await cancelAlarmNotifications(alarm);
  if (!alarm.isEnabled) return [];

  const [hours, minutes] = alarm.time.split(':').map(Number);

  const content: Notifications.NotificationContentInput = {
    title: `⏰  ${alarm.label || 'Alarm'}`,
    body: alarm.track
      ? `Now playing "${alarm.track.name}" by ${alarm.track.artist} 🎵`
      : 'Time to wake up!',
    sound: true,
    data: {
      alarmId:  alarm.id,
      trackUri: alarm.track?.uri ?? null,
    },
  };

  const ids: string[] = [];

  if (alarm.days.length === 0) {
    // One-time alarm: find the next occurrence of this time
    const trigger = new Date();
    trigger.setHours(hours, minutes, 0, 0);
    if (trigger <= new Date()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
    ids.push(id);
  } else {
    // Weekly repeat for each selected day
    // Expo uses weekday 1 = Sunday … 7 = Saturday
    for (const day of alarm.days) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type:     Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday:  day + 1,
          hour:     hours,
          minute:   minutes,
        },
      });
      ids.push(id);
    }
  }

  return ids;
}

export async function cancelAlarmNotifications(alarm: Alarm): Promise<void> {
  if (Platform.OS === 'web') return;

  await Promise.all(
    alarm.notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => null),
    ),
  );
}

// ── Permission Helper ────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Alarm Factory ────────────────────────────────────────────────────────────

export function createAlarm(overrides: Partial<Alarm> = {}): Alarm {
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    id:              Math.random().toString(36).slice(2),
    label:           '',
    time:            defaultTime,
    days:            [],
    track:           null,
    isEnabled:       true,
    notificationIds: [],
    createdAt:       Date.now(),
    ...overrides,
  };
}
