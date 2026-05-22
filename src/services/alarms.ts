// ─────────────────────────────────────────────
//  Ethan's Alarm – Alarm Service
//  CRUD + expo-notifications scheduling
// ─────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Alarm } from '../types';
import { getAlarmMedia, normalizeAlarm } from '../utils/media';
import { usesLegacyAlarmPlayback } from '../utils/alarmPlaybackMode';

const STORAGE_KEY = 'alarmify_v1_alarms';

export async function loadAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Alarm[];
    return parsed.map((a) => normalizeAlarm(a));
  } catch {
    return [];
  }
}

export async function persistAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

export async function scheduleAlarmNotifications(alarm: Alarm): Promise<string[]> {
  if (Platform.OS === 'web' || !usesLegacyAlarmPlayback()) return [];

  await cancelAlarmNotifications(alarm);
  if (!alarm.isEnabled) return [];

  const media = getAlarmMedia(alarm);
  const [hours, minutes] = alarm.time.split(':').map(Number);

  const content: Notifications.NotificationContentInput = {
    title: `⏰  ${alarm.label || 'Alarm'}`,
    body: media
      ? `Now playing "${media.name}" 🎵`
      : 'Time to wake up!',
    sound: true,
    data: {
      alarmId: alarm.id,
      trackUri: media?.uri ?? null,
    },
  };

  const ids: string[] = [];

  if (alarm.days.length === 0) {
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
    for (const day of alarm.days) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1,
          hour: hours,
          minute: minutes,
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

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function createAlarm(overrides: Partial<Alarm> = {}): Alarm {
  const now = new Date();
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    id: Math.random().toString(36).slice(2),
    label: '',
    time: defaultTime,
    days: [],
    media: null,
    isEnabled: true,
    notificationIds: [],
    createdAt: Date.now(),
    ...overrides,
  };
}
