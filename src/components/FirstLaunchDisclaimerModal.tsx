import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme';

type Props = {
  visible: boolean;
  onAcknowledge: () => Promise<void>;
};

export function FirstLaunchDisclaimerModal({ visible, onAcknowledge }: Props) {
  const [saving, setSaving] = useState(false);

  const handleAcknowledge = useCallback(async () => {
    try {
      setSaving(true);
      await onAcknowledge();
    } finally {
      setSaving(false);
    }
  }, [onAcknowledge]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.iconWrap}>
            <Ionicons name="moon-outline" size={28} color={COLORS.primary} />
          </View>

          <Text style={styles.title}>Before you use Ethan's Alarm</Text>
          <Text style={styles.body}>
            Public mode uses Spotify links that you paste into the app. Spotify login, search,
            library browsing, and automatic playback controls are limited to beta testers and may
            require Spotify Premium.
          </Text>
          <Text style={styles.subtext}>
            Keep your phone charging, leave Ethan's Alarm open before bed, and do not force-quit
            it from the app switcher. If you do not choose music, Ethan's Alarm will use
            The Fox by Ylvis. Use a backup alarm for anything critical.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleAcknowledge}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>I understand</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border2,
    padding: 22,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryDim,
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    minHeight: 50,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#fff',
  },
});
