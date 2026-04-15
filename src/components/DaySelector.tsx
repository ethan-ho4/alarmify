// ─────────────────────────────────────────────
//  DaySelector – Row of day-of-week toggles
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../theme';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  selected: number[];
  onChange: (days: number[]) => void;
}

export function DaySelector({ selected, onChange }: Props) {
  const toggle = (day: number) => {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day].sort((a, b) => a - b));
    }
  };

  return (
    <View style={styles.container}>
      {DAYS.map((label, idx) => {
        const active = selected.includes(idx);
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.day, active && styles.dayActive]}
            onPress={() => toggle(idx)}
            accessibilityLabel={DAY_FULL[idx]}
            accessibilityState={{ selected: active }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayText, active && styles.dayTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayActive: {
    backgroundColor: COLORS.primaryDim,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  dayTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.bold,
  },
});
