import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { fetchAlarmHealth, AlarmHealthSnapshot } from '../services/alarmHealth';
import { isAlarmifyDebugEnabled } from '../utils/alarmifyDebug';
import { formatPlaybackDiagnosis, getLastPlayTrackResult, openSpotifyApp } from '../services/spotify';
import { COLORS, FONTS, RADIUS } from '../theme';

export function AlarmHealthBar() {
  const [health, setHealth] = useState<AlarmHealthSnapshot | null>(null);

  const refresh = useCallback(async () => {
    setHealth(await fetchAlarmHealth());
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 8_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!health?.hasEnabledAlarms) return null;

  const lastPlay = getLastPlayTrackResult();
  const showDiagnosis = isAlarmifyDebugEnabled() && lastPlay;
  const signedIn = health.items.some((i) => i.label === 'Spotify auth' && i.ok);
  const suggestOpenSpotify =
    signedIn &&
    (health.spotifyConnectDevices === 0 || health.spotifyConnectDevices === null);

  return (
    <View style={styles.wrap}>
      {health.items.map((item) => (
        <View key={item.label} style={styles.row}>
          <Ionicons
            name={item.ok ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={item.ok ? COLORS.primary : COLORS.warning}
          />
          <Text style={styles.label}>{item.label}</Text>
          <Text style={[styles.detail, !item.ok && styles.detailWarn]}>{item.detail}</Text>
        </View>
      ))}
      {suggestOpenSpotify ? (
        <TouchableOpacity
          style={styles.openSpotifyBtn}
          onPress={() => void openSpotifyApp().then(() => void refresh())}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="spotify" size={14} color={COLORS.primary} />
          <Text style={styles.openSpotifyBtnText}>Open Spotify (refresh devices)</Text>
        </TouchableOpacity>
      ) : null}
      {showDiagnosis ? (
        <Text style={styles.debug} numberOfLines={4}>
          Last playback: {formatPlaybackDiagnosis(lastPlay)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 100,
  },
  detail: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  detailWarn: {
    color: COLORS.warning,
  },
  openSpotifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface3,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  openSpotifyBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  debug: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
