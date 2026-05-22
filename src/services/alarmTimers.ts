// ─────────────────────────────────────────────
//  Ethan's Alarm – Alarm Timer Service
// ─────────────────────────────────────────────

import { Alarm } from '../types';
import {
  ALARM_PREARM_MS,
  ALARM_REVEAL_VOLUME_PERCENT,
  formatPlaybackDiagnosis,
  playTrack,
  primeAlarmForSilentPlayback,
  revealAlarmPlayback,
} from './spotify';
import { alarmifyDebug } from '../utils/alarmifyDebug';
import { getAlarmMedia } from '../utils/media';
import { usesIosSdkAlarmPlayback, usesLegacyAlarmPlayback } from '../utils/alarmPlaybackMode';
import { useStore } from '../store/useStore';
import { isKeepaliveActuallyPlaying, stopBackgroundKeepalive } from './backgroundAudio';
import { disableAlarmAfterFired } from './alarmPlaybackLifecycle';
import { restoreIdealBrightness } from './bedtimeBrightness';
import { notifyAlarmPlaybackReport } from './alarmPlaybackNotify';
import { beginAlarmPlayback, endAlarmPlayback } from './alarmPlaybackLock';
import type { PlayTrackResult } from './spotify';

const activeTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

function nextFireDate(alarm: Alarm): Date | null {
  if (!alarm.isEnabled) return null;

  const [hours, minutes] = alarm.time.split(':').map(Number);
  const now = new Date();

  if (alarm.days.length === 0) {
    const candidate = new Date();
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  let closest: Date | null = null;

  for (const day of alarm.days) {
    const candidate = new Date();
    candidate.setHours(hours, minutes, 0, 0);

    const todayDow = now.getDay();
    let daysAhead = day - todayDow;

    if (daysAhead < 0 || (daysAhead === 0 && candidate <= now)) {
      daysAhead += 7;
    }

    candidate.setDate(candidate.getDate() + daysAhead);

    if (!closest || candidate < closest) {
      closest = candidate;
    }
  }

  return closest;
}

async function onAlarmFired(alarm: Alarm): Promise<void> {
  if (!beginAlarmPlayback(alarm.id, 'timer')) return;

  const media = getAlarmMedia(alarm);
  try {
    console.log(`[AlarmTimer] Alarm "${alarm.label || alarm.time}" fired`);
    alarmifyDebug('AlarmTimer', 'onAlarmFired', {
      alarmId: alarm.id,
      label: alarm.label || alarm.time,
      mediaUri: media?.uri,
      mediaKind: media?.kind,
    });

    useStore.getState().onAlarmFireExitBedtime();
    await restoreIdealBrightness();

    if (usesIosSdkAlarmPlayback()) {
      let playback: PlayTrackResult = {
        ok: false,
        channel: 'failed',
        failureSteps: [],
        usedSpotifyUrlScheme: false,
      };

      if (media?.uri) {
        alarmifyDebug('AlarmTimer', 'iOS SDK path: playTrack alarm_sdk', {
          alarmId: alarm.id,
          uri: media.uri,
          kind: media.kind,
        });
        playback = await playTrack(media.uri, {
          context: 'alarm_sdk',
          mediaKind: media.kind,
        });
        await notifyAlarmPlaybackReport(playback);
        alarmifyDebug('AlarmTimer', 'iOS SDK playTrack finished', {
          ok: playback.ok,
          channel: playback.channel,
          diagnosis: formatPlaybackDiagnosis(playback),
        });
      }

      await stopBackgroundKeepalive();

      if (playback.ok) {
        disableAlarmAfterFired(alarm.id);
      } else {
        console.warn(
          `[AlarmTimer] Alarm "${alarm.label || alarm.time}" playback failed; alarm left enabled.`,
          formatPlaybackDiagnosis(playback),
        );
      }
      return;
    }

    if (media?.uri) {
      const revealed = await revealAlarmPlayback(media.uri, ALARM_REVEAL_VOLUME_PERCENT, media.kind);
      alarmifyDebug('AlarmTimer', 'revealAlarmPlayback result', { revealed });
      if (!revealed) {
        const playback = await playTrack(media.uri, {
          context: 'auto',
          alarmId: alarm.id,
          mediaKind: media.kind,
        });
        alarmifyDebug('AlarmTimer', 'playTrack fallback result', {
          ok: playback.ok,
          channel: playback.channel,
          diagnosis: formatPlaybackDiagnosis(playback),
        });
      }
    }

    disableAlarmAfterFired(alarm.id);
  } finally {
    endAlarmPlayback(alarm.id);
  }
}

async function onAlarmPrime(alarm: Alarm): Promise<void> {
  if (usesIosSdkAlarmPlayback()) return;
  const media = getAlarmMedia(alarm);
  if (!media?.uri) return;
  if (media.kind !== 'track') {
    alarmifyDebug('AlarmTimer', 'skip prime for context media; will start from beginning at fire time', {
      alarmId: alarm.id,
      kind: media.kind,
    });
    return;
  }
  const keepalivePlaying = await isKeepaliveActuallyPlaying();
  if (!keepalivePlaying) {
    alarmifyDebug('AlarmTimer', 'skip prime — keepalive not playing', { alarmId: alarm.id });
    return;
  }
  alarmifyDebug('AlarmTimer', 'onAlarmPrime', { alarmId: alarm.id, uri: media.uri });
  await primeAlarmForSilentPlayback(media.uri, media.kind);
}

export function scheduleTimersForAlarm(alarm: Alarm): void {
  cancelTimersForAlarm(alarm.id);

  const media = getAlarmMedia(alarm);
  if (!alarm.isEnabled || !media?.uri) return;

  const fireDate = nextFireDate(alarm);
  if (!fireDate) return;

  const delay = fireDate.getTime() - Date.now();
  if (delay < 0) return;

  alarmifyDebug('AlarmTimer', 'scheduleTimersForAlarm', {
    alarmId: alarm.id,
    fireAt: fireDate.toISOString(),
    delayMs: Math.round(delay),
  });

  const handles: ReturnType<typeof setTimeout>[] = [];

  if (usesLegacyAlarmPlayback()) {
    const primeDelay = Math.max(0, delay - ALARM_PREARM_MS);
    handles.push(setTimeout(() => void onAlarmPrime(alarm), primeDelay));
  }

  handles.push(setTimeout(() => void onAlarmFired(alarm), delay));
  activeTimers.set(alarm.id, handles);
}

export function scheduleAllAlarmTimers(alarms: Alarm[]): void {
  cancelAllAlarmTimers();
  alarmifyDebug('AlarmTimer', 'scheduleAllAlarmTimers', {
    totalAlarms: alarms.length,
    enabledWithMedia: alarms.filter((a) => a.isEnabled && getAlarmMedia(a)?.uri).length,
  });
  for (const alarm of alarms) {
    scheduleTimersForAlarm(alarm);
  }
}

export function cancelTimersForAlarm(alarmId: string): void {
  const handles = activeTimers.get(alarmId) ?? [];
  handles.forEach(clearTimeout);
  activeTimers.delete(alarmId);
}

export function cancelAllAlarmTimers(): void {
  for (const [id, handles] of activeTimers.entries()) {
    handles.forEach(clearTimeout);
    activeTimers.delete(id);
  }
}

export function hasActiveTimers(): boolean {
  return activeTimers.size > 0;
}
