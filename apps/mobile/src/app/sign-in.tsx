import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radii, spacing } from '@fun-poker/design';
import { authClient } from '@/lib/auth-client';

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'sign-up'
          ? await authClient.signUp.email({
              name: name.trim() || email,
              email: email.trim(),
              password,
            })
          : await authClient.signIn.email({
              email: email.trim(),
              password,
            });
      if (result.error) {
        throw new Error(result.error.message ?? 'Authentication failed');
      }
      // On success the session updates and the root layout redirects.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: 'google' | 'apple') {
    setError(null);
    try {
      await authClient.signIn.social({ provider, callbackURL: '/' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OAuth sign-in failed');
    }
  }

  const isSignIn = mode === 'sign-in';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Fun Poker</Text>
        <Text style={styles.subtitle}>
          {isSignIn ? 'Welcome back' : 'Create your account'}
        </Text>

        {!isSignIn && (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={colors.text.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.text.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.text.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <Text style={styles.buttonText}>
              {isSignIn ? 'Sign in' : 'Sign up'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode(isSignIn ? 'sign-up' : 'sign-in');
            setError(null);
          }}>
          <Text style={styles.switch}>
            {isSignIn
              ? 'New here? Create an account'
              : 'Have an account? Sign in'}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.oauthButton} onPress={() => oauth('google')}>
          <Text style={styles.oauthText}>Continue with Google</Text>
        </Pressable>
        <Pressable style={styles.oauthButton} onPress={() => oauth('apple')}>
          <Text style={styles.oauthText}>Continue with Apple</Text>
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
  title: {
    color: colors.accent.gold,
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface.raised,
    color: colors.text.primary,
    fontSize: fontSize.md,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  error: {
    color: colors.action.raise,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.action.call,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  switch: {
    color: colors.accent.info,
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surface.raised,
  },
  dividerText: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
  },
  oauthButton: {
    borderColor: colors.surface.raised,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  oauthText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
  },
});
