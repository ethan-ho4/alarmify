// ─────────────────────────────────────────────
//  TimeWheelPicker – Drum-roll time picker
//  Two scroll wheels: Hours (12h) + Minutes
// ─────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ViewToken,
  ListRenderItem,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { COLORS, FONTS, RADIUS } from '../theme';

const ITEM_H    = 64;
const VISIBLE   = 5; // items visible at once
const PADDING   = Math.floor(VISIBLE / 2); // ghost rows top & bottom

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ── Single Wheel ─────────────────────────────────────────────────────────────

interface WheelProps {
  data:          string[];
  selectedIndex: number;
  onSelect:      (index: number) => void;
  width:         number;
}

function Wheel({ data, selectedIndex, onSelect, width }: WheelProps) {
  const ref = useRef<any>(null);

  const LOOPS = 100;
  const middleLoop = Math.floor(LOOPS / 2);
  const initialIndex = middleLoop * data.length + selectedIndex;

  const scrollY = useRef(new Animated.Value(initialIndex * ITEM_H)).current;

  // Create a large repeated array for infinite scrolling
  const repeatedData = Array.from({ length: data.length * LOOPS }, (_, i) => data[i % data.length]);

  // Pad data so the first / last items can be centred
  const padded = [
    ...Array(PADDING).fill(''),
    ...repeatedData,
    ...Array(PADDING).fill(''),
  ];

  useEffect(() => {
    const timeout = setTimeout(() => {
      ref.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 50);
    return () => clearTimeout(timeout);
  }, []); // only on mount

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems.length) return;
      const center = viewableItems[Math.floor(viewableItems.length / 2)];
      if (center?.index == null) return;
      
      const actual = center.index - PADDING;
      if (actual >= 0 && actual < repeatedData.length) {
        const valueIndex = actual % data.length;
        if (valueIndex !== selectedIndex) {
          onSelect(valueIndex);
        }
      }
    },
    [data.length, onSelect, repeatedData.length, selectedIndex],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderItem = ({ item, index }: { item: string, index: number }) => {
    if (!item) {
      return <View style={{ height: ITEM_H, width }} />; // empty ghost rows
    }

    const centerOffset = (index - PADDING) * ITEM_H;

    const inputRange = [
      centerOffset - ITEM_H * 2,
      centerOffset - ITEM_H,
      centerOffset,
      centerOffset + ITEM_H,
      centerOffset + ITEM_H * 2,
    ];

    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [0.75, 0.85, 1.15, 0.85, 0.75],
      extrapolate: 'clamp',
    });

    const rotateX = scrollY.interpolate({
      inputRange,
      outputRange: ['60deg', '30deg', '0deg', '-30deg', '-60deg'],
      extrapolate: 'clamp',
    });

    const opacity = scrollY.interpolate({
      inputRange,
      outputRange: [0.15, 0.4, 1, 0.4, 0.15],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.item, { height: ITEM_H, width, opacity, transform: [{ perspective: 800 }, { rotateX }, { scale }] }]}>
        <Text style={styles.itemText}>{item}</Text>
      </Animated.View>
    );
  };

  return (
    <Animated.FlatList
      ref={ref}
      data={padded}
      keyExtractor={(_, i) => String(i)}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      scrollEventThrottle={16}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      style={{ height: ITEM_H * VISIBLE, width }}
      getItemLayout={(_, idx) => ({ length: ITEM_H, offset: ITEM_H * idx, index: idx })}
    />
  );
}

// ── TimeWheelPicker ───────────────────────────────────────────────────────────

interface Props {
  value:    string; // "HH:mm"
  onChange: (value: string) => void;
  is24Hour?: boolean; // kept in signature for compat, wheel is always 24h internally
}

export function TimeWheelPicker({ value, onChange }: Props) {
  const [hStr, mStr] = value.split(':');
  const hIdx = parseInt(hStr, 10) || 0;
  const mIdx = parseInt(mStr, 10) || 0;

  const wheelW = 75;

  const setHour   = (i: number) => onChange(`${String(i).padStart(2, '0')}:${mStr}`);
  const setMinute = (i: number) => onChange(`${hStr}:${String(i).padStart(2, '0')}`);

  return (
    <View style={styles.wrapper}>
      {/* Selection highlight */}
      <View pointerEvents="none" style={[styles.highlight, { top: ITEM_H * PADDING }]} />

      <Wheel data={HOURS_24} selectedIndex={hIdx} onSelect={setHour} width={wheelW} />

      <View style={styles.separator}>
        <Text style={styles.colon}>:</Text>
      </View>

      <Wheel data={MINUTES} selectedIndex={mIdx} onSelect={setMinute} width={wheelW} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface1,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.primary + '60',
    backgroundColor: COLORS.primaryDim,
    zIndex: 0,
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  separator: {
    width: 32,
    alignItems: 'center',
    marginTop: -8,
  },
  colon: {
    fontSize: 38,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
});
