// ─────────────────────────────────────────────
//  Alarmify – Alarm Timer Service
//  Schedules exact JS timers for each active
//  alarm. When the timer fires the app is alive
//  (thanks to the background audio keepalive),
//  we pre-roll Spotify at volume 0, then seek +
//  raise volume at fire time (Premium Web API),
//  with {@link playTrack} as fallback.
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
import {
  usesIosFocusKeepaliveAlarm,
  usesLegacyAlarmPlayback,
} from '../utils/alarmPlaybackMode';
import { useStore } from '../store/useStore';
import { syncActiveAlarmToShortcuts } from './shortcutsBridge';
import { isKeepaliveActuallyPlaying, stopBackgroundKeepalive } from './backgroundAudio';
import { disableAlarmAfterFired } from './alarmPlaybackLifecycle';

// Map of alarmId → array of active timer handles
const activeTimers = new Map<string, ReturnType<typeof setTimeout>[]>();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the next Date on which a one-time or weekly alarm should fire.
 * Returns null if the alarm is disabled or has no valid time.
 */
function nextFireDate(alarm: Alarm): Date | null {
  if (!alarm.isEnabled) return null;

  const [hours, minutes] = alarm.time.split(':').map(Number);
  const now = new Date();

  if (alarm.days.length === 0) {
    // One-time: next occurrence of HH:mm
    const candidate = new Date();
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate <= now) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  // Weekly: find the closest upcoming weekday match
  // alarm.days uses 0 = Sunday … 6 = Saturday
  let closest: Date | null = null;

  for (const day of alarm.days) {
    const candidate = new Date();
    candidate.setHours(hours, minutes, 0, 0);

    const todayDow = now.getDay(); // 0–6
    let daysAhead  = day - todayDow;

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

/**
 * Fires when a specific alarm timer expires.
 * If silent pre-roll ran: seek to start + raise Spotify volume.
 * Otherwise fall back to full {@link playTrack} cascade.
 */
async function onAlarmFired(alarm: Alarm): Promise<void> {
  console.log(`[AlarmTimer] Alarm "${alarm.label || alarm.time}" fired`);
  alarmifyDebug('AlarmTimer', 'onAlarmFired', {
    alarmId: alarm.id,
    label: alarm.label || alarm.time,
    trackUri: alarm.track?.uri,
  });

  if (usesIosFocusKeepaliveAlarm()) {
    const alarms = useStore.getState().alarms;
    await syncActiveAlarmToShortcuts(alarms);

    const uri = alarm.track?.uri;
    if (uri) {
      alarmifyDebug('AlarmTimer', 'iOS Focus path: starting playTrack (parallel)', {
        alarmId: alarm.id,
        uri,
      });
      void playTrack(uri, { context: 'auto' }).then((playback) => {
        alarmifyDebug('AlarmTimer', 'iOS Focus path: playTrack finished', {
          ok: playback.ok,
          channel: playback.channel,
          diagnosis: formatPlaybackDiagnosis(playback),
        });
      });
    }

    alarmifyDebug('AlarmTimer', 'iOS Focus path: stopping keepalive', { alarmId: alarm.id });
    await stopBackgroundKeepalive();
    disableAlarmAfterFired(alarm.id);
    return;
  }

  if (alarm.track?.uri) {
    const revealed = await revealAlarmPlayback(alarm.track.uri, ALARM_REVEAL_VOLUME_PERCENT);
    alarmifyDebug('AlarmTimer', 'revealAlarmPlayback result', { revealed });
    if (!revealed) {
      alarmifyDebug('AlarmTimer', 'calling playTrack fallback', { uri: alarm.track.uri });
      const playback = await playTrack(alarm.track.uri, { context: 'auto', alarmId: alarm.id });
      alarmifyDebug('AlarmTimer', 'playTrack fallback result', {
        ok: playback.ok,
        channel: playback.channel,
        diagnosis: formatPlaybackDiagnosis(playback),
      });
    }
  }

  disableAlarmAfterFired(alarm.id);
}

async function onAlarmPrime(alarm: Alarm): Promise<void> {
  if (usesIosFocusKeepaliveAlarm()) return;
  if (!alarm.track?.uri) return;
  const keepalivePlaying = await isKeepaliveActuallyPlaying();
  if (!keepalivePlaying) {
    console.log(`[AlarmTimer] Skip prime for "${alarm.label || alarm.time}" — keepalive not playing`);
    alarmifyDebug('AlarmTimer', 'skip prime — keepalive not playing', {
      alarmId: alarm.id,
    });
    return;
  }
  console.log(`[AlarmTimer] Silent prime for "${alarm.label || alarm.time}"`);
  alarmifyDebug('AlarmTimer', 'onAlarmPrime', {
    alarmId: alarm.id,
    uri: alarm.track.uri,
  });
  const ok = await primeAlarmForSilentPlayback(alarm.track.uri);
  alarmifyDebug('AlarmTimer', 'primeAlarmForSilentPlayback result', { ok });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Schedule (or reschedule) JS timers for a single alarm.
 * Clears any existing timers for this alarm first.
 */
export function scheduleTimersForAlarm(alarm: Alarm): void {
  // Clear existing timers for this alarm
  cancelTimersForAlarm(alarm.id);

  if (!alarm.isEnabled || !alarm.track?.uri) return;

  const fireDate = nextFireDate(alarm);
  if (!fireDate) return;

  const delay = fireDate.getTime() - Date.now();
  if (delay < 0) return;

  const primeDelay = Math.max(0, delay - ALARM_PREARM_MS);
  console.log(
    `[AlarmTimer] Scheduling "${alarm.label || alarm.time}" in ${Math.round(delay / 1000)}s (${fireDate.toLocaleString()})`,
  );
  alarmifyDebug('AlarmTimer', 'scheduleTimersForAlarm', {
    alarmId: alarm.id,
    fireAt: fireDate.toISOString(),
    delayMs: Math.round(delay),
    primeDelayMs: Math.round(primeDelay),
    prearmMs: ALARM_PREARM_MS,
  });

  const handles: ReturnType<typeof setTimeout>[] = [];

  // Premium path: start the track at volume 0 shortly before fire, then unmute at fire.
  if (alarm.track?.uri && usesLegacyAlarmPlayback()) {
    const primeDelay = Math.max(0, delay - ALARM_PREARM_MS);
    handles.push(setTimeout(() => void onAlarmPrime(alarm), primeDelay));
  }

  handles.push(setTimeout(() => void onAlarmFired(alarm), delay));
  activeTimers.set(alarm.id, handles);
}

/**
 * Schedule timers for ALL active alarms. Call on app launch and whenever
 * the alarm list changes.
 */
export function scheduleAllAlarmTimers(alarms: Alarm[]): void {
  // Cancel everything first for a clean slate
  cancelAllAlarmTimers();

  const enabledWithTrack = alarms.filter((a) => a.isEnabled && a.track?.uri);
  alarmifyDebug('AlarmTimer', 'scheduleAllAlarmTimers', {
    totalAlarms: alarms.length,
    enabledWithTrack: enabledWithTrack.length,
  });

  for (const alarm of alarms) {
    scheduleTimersForAlarm(alarm);
  }
}

/**
 * Cancel all timers for a specific alarm (e.g. when deleted or disabled).
 */
export function cancelTimersForAlarm(alarmId: string): void {
  const handles = activeTimers.get(alarmId) ?? [];
  handles.forEach(clearTimeout);
  activeTimers.delete(alarmId);
}

/**
 * Cancel every active alarm timer (e.g. on app teardown).
 */
export function cancelAllAlarmTimers(): void {
  for (const [id, handles] of activeTimers.entries()) {
    handles.forEach(clearTimeout);
    activeTimers.delete(id);
  }
}

/**
 * Returns whether any JS timers are currently active.
 * Used to decide whether to run the background keepalive.
 */
export function hasActiveTimers(): boolean {
  return activeTimers.size > 0;
}
