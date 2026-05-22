import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, RADIUS } from '../theme';
import { usesShortcutsAlarmOnIos } from '../utils/alarmPlaybackMode';
import { ShortcutsHelpSheet } from './ShortcutsHelpSheet';
import { useStore } from '../store/useStore';
import { SHORTCUTS_SETUP_ROUTE } from '../navigation/routes';

export function ShortcutsAlarmBar() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const alarms = useStore((s) => s.alarms);
  const hasEnabled = alarms.some((a) => a.isEnabled && a.media?.uri);

  if (!usesShortcutsAlarmOnIos() || Platform.OS !== 'ios') return null;
  if (!hasEnabled) return null;

  return (
    <>
      <View style={styles.wrap}>
        <TouchableOpacity
          style={styles.mainTap}
          onPress={() => router.push(SHORTCUTS_SETUP_ROUTE)}
          activeOpacity={0.85}
        >
          <Ionicons name="flash-outline" size={18} color={COLORS.primary} />
          <View style={styles.textCol}>
            <Text style={styles.title}>Focus + Shortcuts required</Text>
            <Text style={styles.detail}>View setup steps</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHelpOpen(true)} hitSlop={12}>
          <Text style={styles.helpLink}>Help</Text>
        </TouchableOpacity>
      </View>
      <ShortcutsHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingRight: 12,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  mainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  textCol: { flex: 1 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  detail: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  helpLink: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.primary,
    marginRight: 4,
  },
});
