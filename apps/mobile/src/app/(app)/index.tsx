import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, radii, spacing } from '@fun-poker/design';
import { authClient } from '@/lib/auth-client';

type Me = {
  user: { id: string; name: string; email: string };
  balance: number;
};

export default function Lobby() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await authClient.$fetch('/api/me');
        if (active && res.data) setMe(res.data as Me);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.greeting}>
          {me ? `Hi, ${me.user.name}` : 'Lobby'}
        </Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Chip balance</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent.gold} />
          ) : (
            <Text style={styles.balanceValue}>
              {(me?.balance ?? 0).toLocaleString()}
            </Text>
          )}
        </View>

        <Pressable style={styles.joinButton} onPress={() => router.push('/table')}>
          <Text style={styles.joinText}>Join Table</Text>
        </Pressable>

        <Pressable
          style={styles.signOut}
          onPress={() => void authClient.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.table.feltEdge,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  greeting: {
    color: colors.text.primary,
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: colors.surface.raised,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  balanceLabel: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
  },
  balanceValue: {
    color: colors.accent.gold,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
  },
  joinButton: {
    backgroundColor: colors.action.call,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  joinText: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  signOut: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
});
