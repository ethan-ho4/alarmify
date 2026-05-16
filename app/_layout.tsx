// ─────────────────────────────────────────────
//  Alarmify – Root Layout
//  Sets up Expo Router, notification handler,
//  and bootstraps global state.
// ─────────────────────────────────────────────

import '../src/services/backgroundTasks';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { useStore } from '../src/store/useStore';
import { playTrack, formatPlaybackDiagnosis } from '../src/services/spotify';
import { requestNotificationPermission } from '../src/services/alarms';
import { isAlarmifyDebugEnabled, alarmifyDebug } from '../src/utils/alarmifyDebug';
import {
  scheduleAllAlarmTimers,
  cancelAllAlarmTimers,
} from '../src/services/alarmTimers';
import {
  startBackgroundKeepalive,
  stopBackgroundKeepalive,
  touchBackgroundKeepalive,
  isKeepaliveDebugPaused,
  setKeepaliveDebugPaused,
} from '../src/services/backgroundAudio';
import { registerAlarmBackgroundTask } from '../src/services/backgroundTasks';
import { syncActiveAlarmToShortcuts } from '../src/services/shortcutsBridge';
import { usesLegacyAlarmPlayback } from '../src/utils/alarmPlaybackMode';
import { COLORS } from '../src/theme';
import AnimatedSplash from '../src/components/AnimatedSplash';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// ── Notification foreground behaviour ─────────────────────────────────────────
// Do not surface alert/banner while the user is in the app (alarm playback is driven by timers).
// Scheduled notification sound may still fire as a fallback when appropriate.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

// ── Keepalive management ───────────────────────────────────────────────────────
// Start the silent audio loop whenever there are active alarm timers.
// Stop it when no alarms are enabled (to save battery).
async function syncKeepalive(alarms: import('../src/types').Alarm[]) {
  if (Platform.OS === 'web') return;

  const hasEnabled = alarms.some((a) => a.isEnabled && a.track?.uri);

  if (hasEnabled) {
    if (!isKeepaliveDebugPaused()) {
      await startBackgroundKeepalive();
    }
  } else {
    await stopBackgroundKeepalive();
    setKeepaliveDebugPaused(false);
  }
}

export default function RootLayout() {
  const loadAlarms = useStore((s) => s.loadAlarms);
  const loadAuth   = useStore((s) => s.loadAuth);
  const alarms     = useStore((s) => s.alarms);
  const [showSplash, setShowSplash] = useState(Platform.OS !== 'web');

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAlarmifyDebugEnabled()) {
      console.log(
        '[Alarmify] Verbose logging ON: Metro/Xcode logs show [AlarmifyDebug …] lines. '
        + 'Production: set EXPO_PUBLIC_ALARMIFY_DEBUG=1 in eas.json env for a build.',
      );
    }
    const bootstrap = async () => {
      await requestNotificationPermission();
      if (usesLegacyAlarmPlayback()) {
        await registerAlarmBackgroundTask();
      }
      await loadAuth();
      await loadAlarms();
    };
    bootstrap();
  }, [loadAlarms, loadAuth]);

  // ── Reschedule timers + keepalive whenever alarms change ─────────────────────
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (usesLegacyAlarmPlayback()) {
      scheduleAllAlarmTimers(alarms);
      void syncKeepalive(alarms);
    } else {
      void syncActiveAlarmToShortcuts(alarms);
    }
  }, [alarms]);

  // ── Handle app coming back to foreground ─────────────────────────────────────
  // Recalculate timers (setTimeout times may have drifted if device was sleeping)
  useEffect(() => {
    if (Platform.OS === 'web' || !usesLegacyAlarmPlayback()) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      alarmifyDebug('AppState', 'changed', { state });
      const currentAlarms = useStore.getState().alarms;
      const hasEnabled = currentAlarms.some((a) => a.isEnabled && a.track?.uri);

      if (state === 'active') {
        scheduleAllAlarmTimers(currentAlarms);
        void syncKeepalive(currentAlarms);
      } else if ((state === 'background' || state === 'inactive') && hasEnabled && !isKeepaliveDebugPaused()) {
        void touchBackgroundKeepalive();
      }
    });

    return () => sub.remove();
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (usesLegacyAlarmPlayback()) cancelAllAlarmTimers();
    };
  }, []);

  // ── Notification listeners (backup path) ─────────────────────────────────────
  // These fire if the alarm rings while Spotify isn't responding to Web API,
  // or if the user taps the notification manually.
  useEffect(() => {
    if (!usesLegacyAlarmPlayback()) return;

    // App in foreground: notification received → JS timer already played it,
    // but this acts as a safety net if the timer was somehow missed.
    const subFg = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as { trackUri?: string; alarmId?: string };
      alarmifyDebug('Notifications', 'addNotificationReceivedListener', {
        appState: AppState.currentState,
        hasTrackUri: !!data?.trackUri,
      });
      if (data?.trackUri) {
        // Only play if we haven't already played via the JS timer
        const playback = await playTrack(data.trackUri, {
          context: 'foreground',
          alarmId: data.alarmId,
        });
        alarmifyDebug('Notifications', 'playTrack (foreground)', {
          ok: playback.ok,
          channel: playback.channel,
          diagnosis: formatPlaybackDiagnosis(playback),
        });
      }
    });

    // User tapped the notification banner (app was killed / unresponsive).
    // This is the last-resort path.
    const subBg = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as { trackUri?: string; alarmId?: string };
      alarmifyDebug('Notifications', 'addNotificationResponseReceivedListener (tap)', {
        appState: AppState.currentState,
        hasTrackUri: !!data?.trackUri,
      });
      if (data?.trackUri) {
        const playback = await playTrack(data.trackUri, {
          context: 'tap',
          alarmId: data.alarmId,
        });
        alarmifyDebug('Notifications', 'playTrack (tap)', {
          ok: playback.ok,
          channel: playback.channel,
          diagnosis: formatPlaybackDiagnosis(playback),
        });
      }
    });

    return () => {
      subFg.remove();
      subBg.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      {showSplash && <AnimatedSplash onAnimationComplete={() => setShowSplash(false)} />}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown:       false,
          contentStyle:      { backgroundColor: COLORS.bg },
          animation:         'slide_from_right',
        }}
      >
        <Stack.Screen name="index"       options={{ headerShown: false }} />
        <Stack.Screen name="add-alarm"   options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="song-search" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="shortcuts-setup" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
