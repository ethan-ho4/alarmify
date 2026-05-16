import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, RADIUS } from '../src/theme';
import { SHORTCUTS_SETUP_FOOTNOTE, SHORTCUTS_SETUP_STEPS } from '../src/content/shortcutsSetupSteps';
import { markShortcutsSetupSeen } from '../src/services/shortcutsSetupPrefs';

export default function ShortcutsSetupScreen() {
  const router = useRouter();

  const handleDone = useCallback(async () => {
    await markShortcutsSetupSeen();
    router.back();
  }, [router]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1117', '#050508']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shortcuts setup</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            On iPhone, Alarmify stores your song link. A Shortcuts automation at your alarm time
            plays it in Spotify.
          </Text>

          {SHORTCUTS_SETUP_STEPS.map((step) => (
            <View key={step.title} style={styles.step}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          ))}

          <Text style={styles.footnote}>{SHORTCUTS_SETUP_FOOTNOTE}</Text>

          {Platform.OS === 'ios' ? (
            <View style={styles.linkRow}>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => void Linking.openURL('shortcuts://')}
              >
                <Ionicons name="apps-outline" size={18} color={COLORS.primary} />
                <Text style={styles.linkBtnText}>Open Shortcuts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => void Linking.openURL('spotify://')}
              >
                <Ionicons name="musical-notes-outline" size={18} color={COLORS.primary} />
                <Text style={styles.linkBtnText}>Open Spotify</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>

        <TouchableOpacity style={styles.doneBtn} onPress={() => void handleDone()} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  intro: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  step: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  stepBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  footnote: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.warning,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  linkRow: { gap: 10, marginBottom: 8 },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '55',
    backgroundColor: COLORS.surface2,
  },
  linkBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
  doneBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#000',
  },
});
