import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function createTable() {
    setCreating(true);
    setError(null);
    try {
      const res = await authClient.$fetch('/api/tables', { method: 'POST' });
      const data = res.data as { tableId?: string } | undefined;
      if (data?.tableId) {
        router.push(`/table/${data.tableId}`);
      } else {
        setError('Could not create a table');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create table');
    } finally {
      setCreating(false);
    }
  }

  function joinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/table/${code}`);
  }

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

        <Pressable
          style={[styles.primary, creating && styles.disabled]}
          onPress={createTable}
          disabled={creating}>
          {creating ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.primaryText}>Create new table</Text>
          )}
        </Pressable>

        <View style={styles.joinRow}>
          <TextInput
            style={styles.codeInput}
            placeholder="Enter code"
            placeholderTextColor={colors.text.muted}
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <Pressable style={styles.joinBtn} onPress={joinByCode}>
            <Text style={styles.joinBtnText}>Join</Text>
          </Pressable>
        </View>

        <Pressable style={styles.quick} onPress={() => router.push('/table/main')}>
          <Text style={styles.quickText}>Quick join — main table</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

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
    gap: spacing.md,
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
    marginBottom: spacing.sm,
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
  primary: {
    backgroundColor: colors.action.call,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  primaryText: {
    color: colors.text.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  joinRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.surface.raised,
    color: colors.accent.gold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  joinBtn: {
    backgroundColor: colors.accent.info,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  joinBtnText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  quick: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  quickText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
  },
  error: {
    color: colors.action.raise,
    fontSize: fontSize.sm,
    textAlign: 'center',
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
