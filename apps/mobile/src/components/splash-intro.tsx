import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontSize, fontWeight } from '@fun-poker/design';
import { Logo } from './logo';

type Props = { onDone: () => void };

// The branded intro that plays on every cold start before the auth gate
// decides where to send the user.
export function SplashIntro({ onDone }: Props) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const wordOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 450 });
    logoScale.value = withTiming(1, { duration: 600 });
    wordOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
    containerOpacity.value = withDelay(
      1500,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
  }, [containerOpacity, logoOpacity, logoScale, onDone, wordOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordOpacity.value }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.screen, containerStyle]}>
      <View style={styles.stack}>
        <Animated.View style={logoStyle}>
          <Logo size={140} />
        </Animated.View>
        <Animated.View style={wordStyle}>
          <Text style={styles.title}>FUN POKER</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.table.feltEdge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stack: {
    alignItems: 'center',
    gap: 24,
  },
  title: {
    color: colors.accent.gold,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: 4,
  },
});
