// ─────────────────────────────────────────────
//  Ethan's Alarm – Root Layout
// ─────────────────────────────────────────────

import '../src/services/backgroundTasks';
import React, { useEffect, useRef, useState } from 'react';
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
import { hasEnabledAlarmWithMedia } from '../src/utils/media';
import { beginAlarmPlayback, endAlarmPlayback } from '../src/services/alarmPlaybackLock';
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
import {
  usesAlarmTimersAndKeepalive,
  usesLegacyAlarmPlayback,
} from '../src/utils/alarmPlaybackMode';
import { COLORS } from '../src/theme';
import AnimatedSplash from '../src/components/AnimatedSplash';
import BedtimeOverlay from '../src/components/bedtime/BedtimeOverlay';
import { FirstLaunchDisclaimerModal } from '../src/components/FirstLaunchDisclaimerModal';
import { useBedtimeGate } from '../src/hooks/useBedtimeGate';
import {
  hasSeenFirstLaunchDisclaimer,
  markFirstLaunchDisclaimerSeen,
} from '../src/services/firstLaunchDisclaimer';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

async function syncKeepalive(alarms: import('../src/types').Alarm[]) {
  if (Platform.OS === 'web') return;

  const hasEnabled = hasEnabledAlarmWithMedia(alarms);

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
  const loadAuth = useStore((s) => s.loadAuth);
  const alarms = useStore((s) => s.alarms);
  const [showSplash, setShowSplash] = useState(Platform.OS !== 'web');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const lastForegroundAuthCheckRef = useRef(0);

  useBedtimeGate();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (isAlarmifyDebugEnabled()) {
      console.log("[Ethan's Alarm] Verbose logging ON");
    }
    const bootstrap = async () => {
      const hasSeenDisclaimer = await hasSeenFirstLaunchDisclaimer();
      setShowDisclaimer(!hasSeenDisclaimer);
      if (hasSeenDisclaimer) {
        await requestNotificationPermission();
      }
      if (hasSeenDisclaimer && usesLegacyAlarmPlayback()) {
        await registerAlarmBackgroundTask();
      }
      await loadAuth();
      await loadAlarms();
    };
    bootstrap();
  }, [loadAlarms, loadAuth]);

  const acknowledgeDisclaimer = async () => {
    await markFirstLaunchDisclaimerSeen();
    setShowDisclaimer(false);
    await requestNotificationPermission();
    if (usesLegacyAlarmPlayback()) {
      await registerAlarmBackgroundTask();
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        const now = Date.now();
        if (now - lastForegroundAuthCheckRef.current < 30_000) return;
        lastForegroundAuthCheckRef.current = now;
        void loadAuth();
      }
    });

    return () => sub.remove();
  }, [loadAuth]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (usesAlarmTimersAndKeepalive()) {
      scheduleAllAlarmTimers(alarms);
      void syncKeepalive(alarms);
    }
  }, [alarms]);

  useEffect(() => {
    if (Platform.OS === 'web' || !usesAlarmTimersAndKeepalive()) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      alarmifyDebug('AppState', 'changed', { state });
      const currentAlarms = useStore.getState().alarms;

      if (state === 'active') {
        scheduleAllAlarmTimers(currentAlarms);
        void syncKeepalive(currentAlarms);
      } else if (
        (state === 'background' || state === 'inactive') &&
        hasEnabledAlarmWithMedia(currentAlarms) &&
        !isKeepaliveDebugPaused()
      ) {
        void touchBackgroundKeepalive();
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    return () => {
      if (usesAlarmTimersAndKeepalive()) cancelAllAlarmTimers();
    };
  }, []);

  useEffect(() => {
    if (!usesLegacyAlarmPlayback()) return;

    const subFg = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as { trackUri?: string; alarmId?: string };
      if (data?.trackUri) {
        if (!beginAlarmPlayback(data.alarmId, 'notification-foreground')) return;
        try {
          const playback = await playTrack(data.trackUri, {
            context: 'foreground',
            alarmId: data.alarmId,
          });
          alarmifyDebug('Notifications', 'playTrack (foreground)', {
            ok: playback.ok,
            channel: playback.channel,
            diagnosis: formatPlaybackDiagnosis(playback),
          });
        } finally {
          endAlarmPlayback(data.alarmId);
        }
      }
    });

    const subBg = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as { trackUri?: string; alarmId?: string };
      if (data?.trackUri) {
        if (!beginAlarmPlayback(data.alarmId, 'notification-tap')) return;
        try {
          const playback = await playTrack(data.trackUri, {
            context: 'tap',
            alarmId: data.alarmId,
          });
          alarmifyDebug('Notifications', 'playTrack (tap)', {
            ok: playback.ok,
            channel: playback.channel,
            diagnosis: formatPlaybackDiagnosis(playback),
          });
        } finally {
          endAlarmPlayback(data.alarmId);
        }
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
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="add-alarm" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="pick-media" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="song-search" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="shortcuts-setup" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <BedtimeOverlay />
      <FirstLaunchDisclaimerModal
        visible={!showSplash && showDisclaimer}
        onAcknowledge={acknowledgeDisclaimer}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
