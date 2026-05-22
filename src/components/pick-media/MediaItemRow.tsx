import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpotifyMedia } from '../../types';
import { getMediaSubtitle, getMediaTitle } from '../../utils/media';
import { COLORS, FONTS, RADIUS } from '../../theme';

type Props = {
  media: SpotifyMedia;
  isSelected: boolean;
  onPress: () => void;
  showHeart?: boolean;
  isFavourited?: boolean;
  onToggleFavourite?: (event: GestureResponderEvent) => void;
  showDelete?: boolean;
  onDelete?: (event: GestureResponderEvent) => void;
};

export function MediaItemRow({
  media,
  isSelected,
  onPress,
  showHeart = false,
  isFavourited = false,
  onToggleFavourite,
  showDelete = false,
  onDelete,
}: Props) {
  const imageUrl = media.imageUrl;

  return (
    <TouchableOpacity
      style={[styles.row, isSelected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Ionicons name="musical-notes" size={22} color={COLORS.textMuted} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{getMediaTitle(media)}</Text>
        <Text style={styles.sub} numberOfLines={1}>{getMediaSubtitle(media)}</Text>
      </View>
      <View style={styles.actions}>
        {isSelected && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
        {showHeart && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(event) => {
              event.stopPropagation();
              onToggleFavourite?.(event);
            }}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons
              name={isFavourited ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavourited ? COLORS.primary : COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
        {showDelete && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(event) => {
              event.stopPropagation();
              onDelete?.(event);
            }}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="trash-outline" size={23} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    backgroundColor: COLORS.surface1,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    marginRight: 12,
  },
  artPlaceholder: {
    backgroundColor: COLORS.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
