// ─────────────────────────────────────────────
//  AlarmCard – Individual alarm list item
// ─────────────────────────────────────────────

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alarm } from '../types';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, RADIUS } from '../theme';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatTime(time: string, is24Hour: boolean): { h: string; m: string; period: string } {
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h = is24Hour ? String(hh).padStart(2, '0') : String(hh % 12 || 12);
  const m = String(mm).padStart(2, '0');
  return { h, m, period: is24Hour ? '' : period };
}

function daysLabel(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(' · ');
}

interface Props {
  alarm: Alarm;
}

export function AlarmCard({ alarm }: Props) {
  const router       = useRouter();
  const toggleAlarm  = useStore((s) => s.toggleAlarm);
  const deleteAlarm  = useStore((s) => s.deleteAlarm);
  const is24Hour     = useStore((s) => s.is24Hour);
  const swipeableRef  = useRef<Swipeable>(null);
  const isRevealed    = useRef(false);   // true after first swipe
  const listenerAdded = useRef(false);   // prevents duplicate listeners
  const listenerId    = useRef<string | null>(null);

  const { h, m, period } = formatTime(alarm.time, is24Hour);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    deleteAlarm(alarm.id);
  }, [alarm.id, deleteAlarm]);

  const handleEdit = useCallback(() => {
    router.push({ pathname: '/add-alarm', params: { alarmId: alarm.id } });
  }, [alarm.id, router]);

  // Step 1 complete: card is open showing delete button
  const onSwipeableOpen = useCallback(() => {
    isRevealed.current = true;
  }, []);

  // Card closed: reset state for next interaction
  const onSwipeableClose = useCallback(() => {
    isRevealed.current = false;
    listenerAdded.current = false;
    listenerId.current = null;
  }, []);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    // Attach listener once per open session to detect the second swipe
    if (!listenerAdded.current) {
      listenerAdded.current = true;
      listenerId.current = progress.addListener(({ value }) => {
        // progress > 1 means the user has dragged past the snap (overshoot)
        if (isRevealed.current && value > 1.4) {
          handleDelete();
        }
      });
    }

    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.3],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.deleteActionWrapper}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity style={styles.deleteCircle} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={onSwipeableOpen}
      onSwipeableClose={onSwipeableClose}
      overshootRight
      friction={2}
      rightThreshold={60}
    >
      <TouchableOpacity
        style={[styles.card, !alarm.isEnabled && styles.cardDisabled]}
        onPress={handleEdit}
        activeOpacity={0.85}
      >
        {/* Top Row: Time + Toggle */}
        <View style={styles.row}>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, !alarm.isEnabled && styles.dimmed]}>
              {h}:{m}
            </Text>
            {period ? (
              <Text style={[styles.periodText, !alarm.isEnabled && styles.dimmed]}>{period}</Text>
            ) : null}
          </View>
          <Switch
            value={alarm.isEnabled}
            onValueChange={() => toggleAlarm(alarm.id)}
            trackColor={{ false: COLORS.surface2, true: COLORS.primaryDim }}
            thumbColor={alarm.isEnabled ? COLORS.primary : COLORS.textMuted}
            ios_backgroundColor={COLORS.surface2}
          />
        </View>

        {/* Label + Days */}
        <View style={styles.meta}>
          {alarm.label ? (
            <Text style={[styles.label, !alarm.isEnabled && styles.dimmed]}>{alarm.label}</Text>
          ) : null}
          <Text style={[styles.days, !alarm.isEnabled && styles.dimmed]}>{daysLabel(alarm.days)}</Text>
        </View>

        {/* Song Row */}
        {alarm.track ? (
          <View style={styles.songRow}>
            {alarm.track.albumArt ? (
              <Image source={{ uri: alarm.track.albumArt }} style={styles.albumArt} />
            ) : (
              <View style={[styles.albumArt, styles.albumPlaceholder]}>
                <Ionicons name="musical-note" size={14} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.songInfo}>
              <Text style={styles.songName} numberOfLines={1}>{alarm.track.name}</Text>
              <Text style={styles.songArtist} numberOfLines={1}>{alarm.track.artist}</Text>
            </View>
            <FontAwesome5 name="spotify" size={18} color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.noSongRow}>
            <Ionicons name="musical-note-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.noSongText}>No song selected</Text>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  timeText: {
    fontFamily: FONTS.bold,
    fontSize: 48,
    color: COLORS.textPrimary,
    letterSpacing: -1,
    lineHeight: 56,
  },
  periodText: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  dimmed: {
    color: COLORS.textMuted,
  },
  meta: {
    marginTop: 4,
    gap: 2,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  days: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.sm,
    padding: 10,
  },
  albumArt: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  albumPlaceholder: {
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  songArtist: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  noSongRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  noSongText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // ── Swipe-to-delete ──────────────────────────────────
  deleteActionWrapper: {
    width: 80,
    marginRight: 16,
    marginVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
