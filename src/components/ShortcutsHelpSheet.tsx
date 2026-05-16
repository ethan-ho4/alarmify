import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS } from '../theme';
import { SHORTCUTS_SETUP_FOOTNOTE, SHORTCUTS_SETUP_STEPS } from '../content/shortcutsSetupSteps';

type Props = {
  visible: boolean;
  onClose: () => void;
  onDone?: () => void;
};

export function ShortcutsHelpSheet({ visible, onClose, onDone }: Props) {
  const handleDone = () => {
    onDone?.();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>iOS Shortcuts setup</Text>
          <Text style={styles.subtitle}>
            Configure Focus and Shortcuts on your iPhone once. Alarmify handles timing and the
            Spotify link; your automation opens Spotify when Focus turns off.
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {SHORTCUTS_SETUP_STEPS.map((step) => (
              <View key={step.title} style={styles.step}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            ))}
            <Text style={styles.footnote}>{SHORTCUTS_SETUP_FOOTNOTE}</Text>
          </ScrollView>

          <View style={styles.actions}>
            {Platform.OS === 'ios' ? (
              <>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => void Linking.openURL('shortcuts://')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="apps-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryBtnText}>Open Shortcuts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => void Linking.openURL('spotify://')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="musical-notes-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryBtnText}>Open Spotify</Text>
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleDone} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: COLORS.surface1,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border2,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  step: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  stepBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footnote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.warning,
    lineHeight: 18,
    marginBottom: 8,
  },
  actions: {
    gap: 10,
    marginTop: 12,
  },
  secondaryBtn: {
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
  secondaryBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#000',
  },
});
