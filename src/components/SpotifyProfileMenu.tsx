import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme';

type Profile = {
  name: string;
  image: string | null;
};

type Props = {
  profile: Profile | null;
  authLoaded: boolean;
  onLogout: () => Promise<void>;
};

export function SpotifyProfileMenu({ profile, authLoaded, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      setLoggingOut(true);
      await onLogout();
      setOpen(false);
    } finally {
      setLoggingOut(false);
    }
  }, [onLogout]);

  if (!authLoaded) {
    return (
      <View style={styles.badge}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity style={styles.badge} onPress={() => setOpen(true)} activeOpacity={0.8}>
        {profile?.image ? (
          <Image source={{ uri: profile.image }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
        <FontAwesome5 name="spotify" size={16} color={COLORS.spotify} />
        <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dismissLayer} onPress={() => setOpen(false)}>
          <View />
        </Pressable>

        <View style={[styles.menu, SHADOWS.card]}>
          <Text style={styles.menuLabel}>Signed in as</Text>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile?.name ?? 'Spotify User'}
          </Text>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.logoutRow}
            onPress={handleLogout}
            activeOpacity={0.75}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            )}
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border2,
    minHeight: 42,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: 'absolute',
    top: 104,
    right: 20,
    width: 220,
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border2,
    padding: 14,
  },
  menuLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  profileName: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  logoutText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.error,
  },
});
