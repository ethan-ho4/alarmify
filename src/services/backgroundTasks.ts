// ─────────────────────────────────────────────
//  Ethan's Alarm – Background Notification Task (Path B)
//  Best-effort JS when a notification is delivered.
//  Must be imported early (see app/_layout.tsx).
// ─────────────────────────────────────────────

import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { alarmifyDebug } from '../utils/alarmifyDebug';
import { refreshSpotifyToken, playTrack } from './spotify';
import { beginAlarmPlayback, endAlarmPlayback } from './alarmPlaybackLock';

export const ALARM_BACKGROUND_NOTIFICATION_TASK = 'ALARMIFY-BACKGROUND-NOTIFICATION-TASK';

let taskRegistered = false;

function extractTrackUri(data: Notifications.NotificationTaskPayload): string | null {
  if ('actionIdentifier' in data) return null;

  const payload = data as {
    notification?: { request?: { content?: { data?: Record<string, unknown> } } };
    data?: { dataString?: string; trackUri?: string };
  };

  const direct = payload.notification?.request?.content?.data?.trackUri;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  if (typeof payload.data?.trackUri === 'string') return payload.data.trackUri;

  if (payload.data?.dataString) {
    try {
      const parsed = JSON.parse(payload.data.dataString) as { trackUri?: string };
      if (parsed.trackUri) return parsed.trackUri;
    } catch {
      /* ignore */
    }
  }

  return null;
}

function extractAlarmId(data: Notifications.NotificationTaskPayload): string | null {
  if ('actionIdentifier' in data) return null;

  const payload = data as {
    notification?: { request?: { content?: { data?: Record<string, unknown> } } };
    data?: { dataString?: string; alarmId?: string };
  };

  const direct = payload.notification?.request?.content?.data?.alarmId;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  if (typeof payload.data?.alarmId === 'string') return payload.data.alarmId;

  if (payload.data?.dataString) {
    try {
      const parsed = JSON.parse(payload.data.dataString) as { alarmId?: string };
      if (parsed.alarmId) return parsed.alarmId;
    } catch {
      /* ignore */
    }
  }

  return null;
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  ALARM_BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error }) => {
    if (error) {
      alarmifyDebug('BackgroundTask', 'task error', { error: String(error) });
      return;
    }
    if (!data || 'actionIdentifier' in data) return;

    const trackUri = extractTrackUri(data);
    const alarmId = extractAlarmId(data);
    alarmifyDebug('BackgroundTask', 'notification task fired', {
      trackUri: trackUri ?? 'none',
      alarmId: alarmId ?? 'none',
    });

    if (!trackUri) return;

    if (!beginAlarmPlayback(alarmId, 'background-task')) return;

    try {
      await refreshSpotifyToken();
      await playTrack(trackUri, { context: 'background', alarmId: alarmId ?? undefined });
    } finally {
      endAlarmPlayback(alarmId);
    }
  },
);

export async function registerAlarmBackgroundTask(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (taskRegistered) return true;

  try {
    await Notifications.registerTaskAsync(ALARM_BACKGROUND_NOTIFICATION_TASK);
    taskRegistered = true;
    alarmifyDebug('BackgroundTask', 'registerTaskAsync OK', {});
    return true;
  } catch (e) {
    console.warn('[BackgroundTask] registerTaskAsync failed:', e);
    alarmifyDebug('BackgroundTask', 'registerTaskAsync failed', {
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

export function isBackgroundTaskRegistered(): boolean {
  return taskRegistered;
}
