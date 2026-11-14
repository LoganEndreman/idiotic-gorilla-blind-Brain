import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Body, Card, H1, Label, Screen } from '@/components/ui';
import { colors } from '@/theme';

export default function Setup() {
  return (
    <Screen edges={['top', 'bottom']}>
      <H1>Connect Supabase</H1>
      <Body muted>WAVE needs a Supabase project for accounts, characters, Blocks and the live DM Queue.</Body>
      <Card>
        <Label>1 · Create the database</Label>
        <Body>
          Run <Code>supabase/migrations/…_wave_schema.sql</Code> in your project (SQL editor, or{' '}
          <Code>supabase db push</Code>).
        </Body>
        <Label>2 · Add your keys</Label>
        <Body>
          Copy <Code>.env.example</Code> to <Code>.env</Code> and fill in{' '}
          <Code>EXPO_PUBLIC_SUPABASE_URL</Code> and <Code>EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Code>. The secret key is never
          used by the app.
        </Body>
        <Label>3 · Restart</Label>
        <Body>
          Restart the dev server with <Code>npx expo start --clear</Code>.
        </Body>
      </Card>
      <Link href="/rules" style={{ color: colors.waveLight, fontWeight: '700' }}>
        Read the quick reference meanwhile →
      </Link>
    </Screen>
  );
}

function Code({ children }: { children: string }) {
  return <Text style={{ fontFamily: 'monospace', color: colors.waveLight }}>{children}</Text>;
}
