import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useStore } from '../../store/useStore';
import { saveAndDimForBedtime } from '../../services/bedtimeBrightness';

export default function BedtimeBlackScreen() {
  const enterWarning = useStore((s) => s.enterWarning);

  useEffect(() => {
    void saveAndDimForBedtime();
  }, []);

  return (
    <Pressable style={styles.fill} onPress={enterWarning}>
      <View style={styles.fill} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});
