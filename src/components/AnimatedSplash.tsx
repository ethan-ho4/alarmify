import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

const { width } = Dimensions.get('window');

interface AnimatedSplashProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplash({ onAnimationComplete }: AnimatedSplashProps) {
  const noteRotation = useSharedValue(0);
  const noteTranslateY = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Hide the native splash screen so we can show this animated one seamlessly
    SplashScreen.hideAsync().catch(() => {});

    // Dancing animation for the music note
    noteRotation.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(15, { duration: 250, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 250, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    noteTranslateY.value = withRepeat(
      withSequence(
        withTiming(-25, { duration: 350, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 350, easing: Easing.in(Easing.ease) })
      ),
      -1,
      true
    );

    // Loading bar animation (0 to 100% over 2.5 seconds)
    progressWidth.value = withTiming(
      width * 0.6, 
      { duration: 2500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }, 
      (finished) => {
        if (finished) {
          // Fade out the whole splash screen
          opacity.value = withTiming(0, { duration: 500 }, () => {
            runOnJS(onAnimationComplete)();
          });
        }
      }
    );
  }, []);

  const noteStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: noteTranslateY.value },
        { rotate: `${noteRotation.value}deg` }
      ]
    };
  });

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: progressWidth.value
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={noteStyle}>
        <Ionicons name="musical-notes" size={100} color="#1DB954" />
      </Animated.View>

      <View style={styles.barContainer}>
        <Animated.View style={[styles.barFill, progressStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000', // Matches native splash bg
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Ensure it sits on top of everything
  },
  barContainer: {
    marginTop: 80,
    width: width * 0.6,
    height: 4,
    backgroundColor: '#222222',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  }
});
