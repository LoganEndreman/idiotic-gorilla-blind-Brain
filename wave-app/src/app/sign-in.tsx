import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Body, Btn, Card, Felt, Gloss, Input, Segmented, Text, notify } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { CLANS } from '@/game/rules';
import { colors, space } from '@/theme';

export default function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  if (session) return <Redirect href="/" />;

  async function submit() {
    setBusy(true);
    try {
      const auth = supabase().auth;
      if (mode === 'in') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) notify('Check your email', 'Confirm your address, then sign in.');
      }
      // AuthProvider picks up the session; index.tsx routes onward.
    } catch (e) {
      notify(mode === 'in' ? 'Sign in failed' : 'Sign up failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.voidDeep }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient colors={[colors.waveLight, colors.wave, colors.waveDeep]} style={styles.hero}>
        <Gloss radius={0} strength={0.18} />
        <Text style={styles.kicker}>TABLETOP ROLE-PLAYING GAME</Text>
        <Text style={styles.title}>WAVE</Text>
        <Text style={styles.sub}>One character. Every Block of Wave City.</Text>
      </LinearGradient>
      <View style={styles.line} />
      <Felt>
        <View style={styles.body}>
          <Card>
            <Segmented
              options={[
                { value: 'in', label: 'Sign in' },
                { value: 'up', label: 'Create account' },
              ]}
              value={mode}
              onChange={setMode}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
            <Btn
              title={mode === 'in' ? 'Enter Wave City' : 'Create account'}
              variant="wave"
              onPress={submit}
              loading={busy}
              disabled={!email || password.length < 6}
            />
          </Card>
          <View style={styles.clans}>
            {CLANS.map((c) => (
              <View key={c.id} style={{ flex: 1, borderTopWidth: 3, borderTopColor: c.color, paddingTop: 6 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{c.name}</Text>
                <Body muted style={{ fontSize: 11, letterSpacing: 1.2 }}>
                  {c.epithet.toUpperCase()}
                </Body>
              </View>
            ))}
          </View>
        </View>
      </Felt>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 80, paddingBottom: space(6), paddingHorizontal: space(6) },
  kicker: { color: '#fff', fontSize: 11, letterSpacing: 3, fontWeight: '700' },
  title: {
    color: '#fff',
    fontSize: 84,
    fontWeight: '900',
    letterSpacing: -2,
    marginTop: space(6),
    textShadowColor: 'rgba(0,40,80,0.55)',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 6,
  },
  sub: { color: '#fff', fontSize: 15 },
  line: { height: 5, backgroundColor: '#fff', boxShadow: '0 0 12px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.6)', zIndex: 1 },
  body: { flex: 1, padding: space(4), gap: space(6), width: '100%', maxWidth: 520, alignSelf: 'center' },
  clans: { flexDirection: 'row', gap: space(3) },
});
