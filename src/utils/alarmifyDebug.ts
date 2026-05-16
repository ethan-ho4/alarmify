/**
 * Verbose alarm + Spotify tracing (Metro, Xcode device console, Logcat).
 *
 * On:  development (`__DEV__`) OR `EXPO_PUBLIC_ALARMIFY_DEBUG=1` in `.env` / `eas.json` `env`.
 * Off: production/TestFlight unless you set that env for a diagnostic build.
 */

export function isAlarmifyDebugEnabled(): boolean {
  try {
    const v = process.env.EXPO_PUBLIC_ALARMIFY_DEBUG;
    if (v === '1' || v === 'true') return true;
  } catch {
    /* ignore */
  }
  // eslint-disable-next-line no-undef -- Metro / RN define __DEV__
  return typeof __DEV__ !== 'undefined' && !!__DEV__;
}

export function alarmifyDebug(tag: string, message: string, data?: Record<string, unknown>): void {
  if (!isAlarmifyDebugEnabled()) return;
  const ts = new Date().toISOString();
  const prefix = `[AlarmifyDebug ${ts}][${tag}]`;
  if (data != null && Object.keys(data).length > 0) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}
