import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, RADIUS } from '../../theme';

const IDLE_MS = 10_000;

export default function BedtimeWarningScreen() {
  const enterBlack = useStore((s) => s.enterBlack);
  const disableAllAlarms = useStore((s) => s.disableAllAlarms);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEvening = new Date().getHours() >= 18;
  const primaryLabel = isEvening ? 'Good night' : 'Understood';

  const resetIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => enterBlack(), IDLE_MS);
  };

  useEffect(() => {
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [enterBlack]);

  return (
    <SafeAreaView style={styles.safe} onTouchStart={resetIdle}>
      <View style={styles.content}>
        <Ionicons name="moon" size={48} color={COLORS.primary} style={styles.icon} />
        <Text style={styles.title}>Bedtime mode</Text>
        <Text style={styles.body}>
          The screen will go black and brightness will drop to save battery. Your alarm will still
          run in the background. For best battery life, enable Low Power Mode in Settings.
        </Text>
        <Text style={styles.hint}>Touching the black screen brings you back here.</Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={enterBlack} activeOpacity={0.85}>
          <Text style={styles.primaryText}>{primaryLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => void disableAllAlarms()} activeOpacity={0.85}>
          <Text style={styles.secondaryText}>Go back</Text>
        </TouchableOpacity>
        <Text style={styles.goBackNote}>Go back turns off all alarms.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg ?? '#050508',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    justifyContent: 'center',
  },
  icon: { alignSelf: 'center', marginBottom: 20 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: '#000',
  },
  secondaryBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border2,
  },
  secondaryText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  goBackNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 10,
  },
});
