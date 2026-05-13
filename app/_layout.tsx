// ─────────────────────────────────────────────
//  Alarmify – Root Layout
//  Sets up Expo Router, notification handler,
//  and bootstraps global state.
// ─────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { useStore } from '../src/store/useStore';
import { playTrack } from '../src/services/spotify';
import { requestNotificationPermission } from '../src/services/alarms';
import { COLORS } from '../src/theme';
import AnimatedSplash from '../src/components/AnimatedSplash';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Configure foreground notification behaviour
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const loadAlarms = useStore((s) => s.loadAlarms);
  const loadAuth   = useStore((s) => s.loadAuth);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Bootstrap
    requestNotificationPermission();
    loadAlarms();
    loadAuth();

    // When a notification is RECEIVED while the app is in the foreground → play immediately
    const subFg = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as { trackUri?: string };
      if (data?.trackUri) {
        await playTrack(data.trackUri);
      }
    });

    // When user TAPS a notification (app in background/closed) → play
    const subBg = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as {
        trackUri?: string;
      };
      if (data?.trackUri) {
        await playTrack(data.trackUri);
      }
    });

    return () => {
      subFg.remove();
      subBg.remove();
    };
  }, [loadAlarms, loadAuth]);

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
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
