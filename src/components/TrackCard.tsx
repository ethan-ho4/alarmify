// ─────────────────────────────────────────────
//  TrackCard – Spotify search result row
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpotifyTrack } from '../types';
import { COLORS, FONTS, RADIUS } from '../theme';

interface Props {
  track:      SpotifyTrack;
  isSelected: boolean;
  onPress:    () => void;
}

function msToMinSec(ms: number): string {
  const s   = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function TrackCard({ track, isSelected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Ionicons name="musical-note" size={20} color={COLORS.primary} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{track.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {track.artist} · {track.albumName}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.duration}>{msToMinSec(track.duration_ms)}</Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderRadius: RADIUS.md,
    marginHorizontal: 16,
    marginVertical: 3,
  },
  cardSelected: {
    backgroundColor: COLORS.primaryDim,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
  },
  artPlaceholder: {
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  duration: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
