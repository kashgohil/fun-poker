import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, spacing } from '@fun-poker/design';

// Placeholder — the live WebSocket-driven table is the next build step.
export default function Table() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Poker Table</Text>
        <Text style={styles.note}>The live table is coming next.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back to lobby</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.table.felt,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text.primary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  note: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
  },
  back: {
    color: colors.accent.info,
    fontSize: fontSize.md,
    paddingVertical: spacing.sm,
  },
});
