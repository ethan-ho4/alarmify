import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useStore } from '../../store/useStore';
import BedtimeWarningScreen from './BedtimeWarningScreen';
import BedtimeBlackScreen from './BedtimeBlackScreen';

export default function BedtimeOverlay() {
  const phase = useStore((s) => s.bedtimePhase);

  if (phase === 'idle') return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <StatusBar hidden={phase === 'black'} style="light" />
      {phase === 'warning' ? <BedtimeWarningScreen /> : <BedtimeBlackScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },
});
