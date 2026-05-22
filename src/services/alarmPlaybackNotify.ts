// ─────────────────────────────────────────────
//  Ethan's Alarm – Alarm playback status notifications
//  Step-by-step report when an alarm fires (diagnostics).
// ─────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { alarmifyDebug } from '../utils/alarmifyDebug';
import type { PlayTrackResult } from './spotify';
import { formatPlaybackDiagnosis } from './spotify';

/** Build notification body from cascade steps + result. */
export function buildPlaybackReportBody(
  result: PlayTrackResult,
  cascadeSteps: string[],
): string {
  const lines = [...cascadeSteps];
  if (result.ok) {
    lines.push(`Result: ${formatPlaybackDiagnosis(result)}`);
  } else {
    for (const step of result.failureSteps) {
      if (!lines.includes(step)) lines.push(step);
    }
    if (lines.length === 0) {
      lines.push(formatPlaybackDiagnosis(result));
    }
  }
  return lines.join('\n').slice(0, 500);
}

/** One summary notification per alarm fire (success or failure). */
export async function notifyAlarmPlaybackReport(
  result: PlayTrackResult,
  cascadeSteps: string[] = [],
): Promise<void> {
  if (Platform.OS === 'web') return;

  const title = result.ok
    ? 'Alarm: playing'
    : result.channel === 'z_alarm'
      ? 'Alarm: playback failed'
      : 'Alarm playback';

  const body = buildPlaybackReportBody(result, cascadeSteps);

  alarmifyDebug('AlarmPlaybackNotify', title, { body, channel: result.channel, ok: result.ok });

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[AlarmPlaybackNotify] Failed to show report:', e);
  }
}
