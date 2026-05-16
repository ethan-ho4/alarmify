// ─────────────────────────────────────────────
//  TimeWheelPicker – Drum-roll time picker
//  Two scroll wheels: Hours (12h) + Minutes
// ─────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewToken,
  Animated,
} from 'react-native';
import { COLORS, FONTS, RADIUS } from '../theme';

const DEFAULT_ITEM_H = 64;
const VISIBLE   = 5; // items visible at once
const PADDING   = Math.floor(VISIBLE / 2); // ghost rows top & bottom

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ── Single Wheel ─────────────────────────────────────────────────────────────

interface WheelProps {
  data:           string[];
  selectedIndex:  number;
  onSelect:       (index: number) => void;
  width:          number;
  itemHeight:     number;
  itemFontSize:   number;
}

function Wheel({ data, selectedIndex, onSelect, width, itemHeight, itemFontSize }: WheelProps) {
  const ref = useRef<any>(null);

  const LOOPS = 100;
  const middleLoop = Math.floor(LOOPS / 2);
  const initialIndex = middleLoop * data.length + selectedIndex;

  const scrollY = useRef(new Animated.Value(initialIndex * itemHeight)).current;

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
      return <View style={{ height: itemHeight, width }} />; // empty ghost rows
    }

    const centerOffset = (index - PADDING) * itemHeight;

    const inputRange = [
      centerOffset - itemHeight * 2,
      centerOffset - itemHeight,
      centerOffset,
      centerOffset + itemHeight,
      centerOffset + itemHeight * 2,
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
      <Animated.View style={[styles.item, { height: itemHeight, width, opacity, transform: [{ perspective: 800 }, { rotateX }, { scale }] }]}>
        <Text style={[styles.itemText, { fontSize: itemFontSize }]}>{item}</Text>
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
      snapToInterval={itemHeight}
      decelerationRate="fast"
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      scrollEventThrottle={16}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      style={{ height: itemHeight * VISIBLE, width }}
      getItemLayout={(_, idx) => ({ length: itemHeight, offset: itemHeight * idx, index: idx })}
    />
  );
}

// ── TimeWheelPicker ───────────────────────────────────────────────────────────

interface Props {
  value:    string; // "HH:mm"
  onChange: (value: string) => void;
  is24Hour?: boolean; // kept in signature for compat, wheel is always 24h internally
  /** Smaller row height / typography for one-screen layouts (e.g. add alarm). */
  compact?: boolean;
}

export function TimeWheelPicker({ value, onChange, compact }: Props) {
  const [hStr, mStr] = value.split(':');
  const hIdx = parseInt(hStr, 10) || 0;
  const mIdx = parseInt(mStr, 10) || 0;

  const wheelW = compact ? 68 : 75;
  const itemH = compact ? 48 : DEFAULT_ITEM_H;
  const itemFontSize = compact ? 26 : 32;
  const colonSize = compact ? 32 : 38;
  const sepMarginTop = compact ? -4 : -8;

  const setHour   = (i: number) => onChange(`${String(i).padStart(2, '0')}:${mStr}`);
  const setMinute = (i: number) => onChange(`${hStr}:${String(i).padStart(2, '0')}`);

  return (
    <View style={styles.wrapper}>
      {/* Selection highlight */}
      <View pointerEvents="none" style={[styles.highlight, { top: itemH * PADDING, height: itemH }]} />

      <Wheel
        data={HOURS_24}
        selectedIndex={hIdx}
        onSelect={setHour}
        width={wheelW}
        itemHeight={itemH}
        itemFontSize={itemFontSize}
      />

      <View style={[styles.separator, { marginTop: sepMarginTop }]}>
        <Text style={[styles.colon, { fontSize: colonSize }]}>:</Text>
      </View>

      <Wheel
        data={MINUTES}
        selectedIndex={mIdx}
        onSelect={setMinute}
        width={wheelW}
        itemHeight={itemH}
        itemFontSize={itemFontSize}
      />
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
    height: DEFAULT_ITEM_H,
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
