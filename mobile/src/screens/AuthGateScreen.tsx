import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Screen, Button, TextField } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/providers/auth/AuthProvider';

/**
 * FROZEN capability module — auth-gate. Placed by the TemplateMutationCompiler and rendered by
 * `AuthGate` whenever nobody is signed in. Generated RNDev code NEVER edits this file, and
 * never builds its own login screen when this module is active.
 *
 * EVERY visual value comes from `useTheme()`, i.e. from `theme.generated.ts`, which the
 * pipeline rewrites per project. That is the whole reason a FROZEN screen can still look like
 * the app it is part of: one literal hex or font name here and this screen would be the one
 * place in a themed app that ignored the theme. `test_the_auth_gate_screen_carries_no_literal_
 * design_values` fails on purpose if one appears.
 *
 * Sign-in and sign-up share one form deliberately. A generated app's first run has no account
 * to sign in with, so a screen that only offered sign-in would be a wall with no door.
 */
export function AuthGateScreen() {
  const t = useTheme();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signup';
  // Matches SignupRequest.password's min_length in the frozen auth router. Checked here so the
  // commonest rejection never costs a round trip, and the field says so before it is submitted
  // rather than the banner saying it afterwards.
  const MIN_PASSWORD = 6;
  const passwordTooShort = isSignUp && password.length > 0 && password.length < MIN_PASSWORD;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (e: any) {
      // The server's own words, not an axios string ("Request failed with status code 429" is
      // worth showing to nobody). `message` FIRST: the generated backend's 422 handler puts the
      // useful text there and sets `detail` to the constant "Validation Error", so reading
      // `detail` first shows that constant for every field error — on the only screen an
      // anonymous user can reach. Every other handler sets `detail` alone.
      const body = e?.response?.data;
      const text = [body?.message, body?.detail].find(
        (candidate: unknown) => typeof candidate === 'string' && candidate.length > 0,
      );
      setError(
        text ??
          (e?.response?.status
            ? 'Something went wrong. Please try again.'
            : 'Could not reach the server. Check your connection.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !passwordTooShort && !busy;

  return (
    <Screen title={isSignUp ? 'Create account' : 'Sign in'}>
      <View style={{ gap: t.spacing.lg }}>
        <Text style={[t.typography.body, { color: t.palette.textMuted }]}>
          {isSignUp
            ? 'Create an account to get started.'
            : 'Sign in to continue.'}
        </Text>

        <View style={{ gap: t.spacing.md }}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            helper={isSignUp ? `At least ${MIN_PASSWORD} characters` : undefined}
            error={passwordTooShort ? `At least ${MIN_PASSWORD} characters` : undefined}
          />
        </View>

        {error ? (
          <View
            style={{
              backgroundColor: t.palette.surfaceAlt,
              borderRadius: t.radius.md,
              padding: t.spacing.md,
            }}
          >
            <Text style={[t.typography.body, { color: t.palette.danger }]}>{error}</Text>
          </View>
        ) : null}

        <View style={{ gap: t.spacing.sm }}>
          <Button
            title={isSignUp ? 'Create account' : 'Sign in'}
            onPress={submit}
            loading={busy}
            disabled={!canSubmit}
          />
          <Button
            title={isSignUp ? 'I already have an account' : 'Create an account'}
            onPress={() => {
              setError(null);
              setMode(isSignUp ? 'signin' : 'signup');
            }}
            variant="ghost"
            disabled={busy}
          />
        </View>
      </View>
    </Screen>
  );
}
