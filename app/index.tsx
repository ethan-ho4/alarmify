// ─────────────────────────────────────────────
//  Alarmify – Home Screen
//  Shows alarms list + Spotify connect state
// ─────────────────────────────────────────────

import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '../src/store/useStore';
import { useSpotifyAuth } from '../src/hooks/useSpotifyAuth';
import { AlarmCard } from '../src/components/AlarmCard';
import { AlarmHealthBar } from '../src/components/AlarmHealthBar';
import { ShortcutsAlarmBar } from '../src/components/ShortcutsAlarmBar';
import { usesShortcutsAlarmOnIos } from '../src/utils/alarmPlaybackMode';
import { Alarm } from '../src/types';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../src/theme';

function useCurrentTime(is24Hour: boolean): string {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: !is24Hour });
}

function useGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router   = useRouter();
  const alarms   = useStore((s) => s.alarms);
  const auth     = useStore((s) => s.auth);
  const profile  = useStore((s) => s.profile);
  const logout   = useStore((s) => s.logout);
  const loaded   = useStore((s) => s.alarmsLoaded);
  const is24Hour = useStore((s) => s.is24Hour);
  const set24Hour = useStore((s) => s.set24Hour);
  const { login, loading: authLoading, error: authError } = useSpotifyAuth();

  React.useEffect(() => {
    if (authError) {
      Alert.alert('Spotify Login Error', authError);
    }
  }, [authError]);

  const time     = useCurrentTime(is24Hour);
  const greeting = useGreeting();

  const navigateAdd = useCallback(() => router.push('/add-alarm'), [router]);

  const renderAlarm: ListRenderItem<Alarm> = useCallback(
    ({ item }) => <AlarmCard alarm={item} />,
    [],
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="alarm-outline" size={64} color={COLORS.textMuted} />
      <Text style={styles.emptyTitle}>No alarms yet</Text>
      <Text style={styles.emptySub}>Tap the + button to create your first alarm</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0D1117', '#050508']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe}>
        {/* ── Header ─────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.clock}>{time}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.formatToggle} 
              onPress={() => set24Hour(!is24Hour)}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.formatToggleText}>
                {is24Hour ? 'Military Time' : 'Standard Time'}
              </Text>
            </TouchableOpacity>

            {/* Spotify badge */}
            {auth ? (
              <TouchableOpacity style={styles.spotifyBadge} onPress={logout}>
                {profile?.image ? (
                  <Image source={{ uri: profile.image }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                )}
                <FontAwesome5 name="spotify" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.connectBtn}
                onPress={login}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <FontAwesome5 name="spotify" size={18} color={COLORS.primary} />
                    <Text style={styles.connectText}>Connect</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {usesShortcutsAlarmOnIos() ? <ShortcutsAlarmBar /> : <AlarmHealthBar />}

        {/* ── Alarm count banner ──────────────────── */}
        {alarms.length > 0 && (
          <Text style={styles.countLabel}>
            {alarms.filter((a) => a.isEnabled).length} active alarm
            {alarms.filter((a) => a.isEnabled).length !== 1 ? 's' : ''}
          </Text>
        )}

        {/* ── Alarm List ──────────────────────────── */}
        {!loaded ? (
          <ActivityIndicator style={{ marginTop: 64 }} color={COLORS.primary} />
        ) : (
          <FlatList
            data={alarms.slice().sort((a, b) => a.time.localeCompare(b.time))}
            keyExtractor={(item) => item.id}
            renderItem={renderAlarm}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      {/* ── FAB ─────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.fab, SHADOWS.glow]}
        onPress={navigateAdd}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[COLORS.primary, '#17A349']}
          style={styles.fabGradient}
        >
          <View style={{ width: 24, height: 3, backgroundColor: '#fff', position: 'absolute', borderRadius: 2 }} />
          <View style={{ width: 3, height: 24, backgroundColor: '#fff', position: 'absolute', borderRadius: 2 }} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    paddingHorizontal: 20,
    paddingTop:       12,
    paddingBottom:    8,
  },
  greeting: {
    fontFamily: FONTS.regular,
    fontSize:   14,
    color:      COLORS.textMuted,
    marginBottom: 2,
  },
  clock: {
    fontFamily:  FONTS.bold,
    fontSize:    32,
    color:       COLORS.textPrimary,
    letterSpacing: -1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 12,
  },
  formatToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formatToggleText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  spotifyBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    backgroundColor: COLORS.surface1,
    borderRadius:   RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth:    1,
    borderColor:    COLORS.border2,
  },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: COLORS.surface1,
    borderRadius:    RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical:  9,
    borderWidth:     1,
    borderColor:     COLORS.primary + '50',
  },
  connectText: {
    fontFamily: FONTS.medium,
    fontSize:   14,
    color:      COLORS.primary,
  },

  countLabel: {
    fontFamily: FONTS.regular,
    fontSize:   13,
    color:      COLORS.textMuted,
    paddingHorizontal: 20,
    marginBottom: 4,
    marginTop:    8,
  },

  list: {
    paddingBottom: 120,
    paddingTop:    4,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize:   22,
    color:      COLORS.textSecondary,
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize:   14,
    color:      COLORS.textMuted,
    textAlign:  'center',
    lineHeight: 22,
  },

  fab: {
    position: 'absolute',
    bottom:   32,
    right:    24,
    width:    64,
    height:   64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
