import { Link, Redirect, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Body, Btn, Card, H2, Input, Label, Row, Screen, Text, attempt } from '@/components/ui';
import { Block, clanInfo } from '@/game/rules';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, engraved, fontFamily, shadows, space } from '@/theme';

type MyBlock = Block & { memberCount: number };

export default function Home() {
  const { character, session, signOut } = useAuth();
  const [blocks, setBlocks] = useState<MyBlock[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase()
      .from('block_members')
      .select('block:blocks(*, block_members(count))')
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: false });
    setBlocks(
      ((data ?? []) as any[])
        .map((r) => r.block)
        .filter(Boolean)
        .map((b) => ({ ...b, memberCount: b.block_members?.[0]?.count ?? 1 })),
    );
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!session) return <Redirect href="/" />;
  if (!character) return <Redirect href="/character/edit" />;
  const clan = clanInfo(character.clan);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link
              href="/rules"
              style={{ fontFamily, color: colors.waveLight, fontWeight: '700', paddingHorizontal: 12, ...engraved }}
            >
              Rules
            </Link>
          ),
        }}
      />
      <Pressable onPress={() => router.push('/character')}>
        <View style={[styles.charBar, { borderLeftColor: clan.color }]}>
          <View style={{ flex: 1 }}>
            <Label>Your character</Label>
            <Text style={styles.charName}>{character.name}</Text>
            <Body muted>
              {clan.name} · {character.special_name}
            </Body>
          </View>
          <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
        </View>
      </Pressable>

      <View style={{ gap: space(3) }}>
        <H2>Your Blocks</H2>
        {blocks.length === 0 ? (
          <Body muted>You haven't entered any Blocks yet. Open one as its starting DM, or join with an invite code.</Body>
        ) : (
          blocks.map((b) => (
            <Pressable key={b.id} onPress={() => router.push({ pathname: '/blocks/[id]', params: { id: b.id } })}>
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={styles.blockName}>{b.name}</Text>
                  <Text style={styles.code}>{b.invite_code}</Text>
                </Row>
                {b.description ? <Body muted>{b.description}</Body> : null}
                <Body muted style={{ fontSize: 13 }}>
                  {b.memberCount} {b.memberCount === 1 ? 'member' : 'members'}
                  {b.starting_dm_id === session?.user.id ? ' · You are the starting DM' : ''}
                </Body>
              </Card>
            </Pressable>
          ))
        )}
      </View>

      <Card>
        <Label>Join a Block</Label>
        <Row>
          <View style={{ flex: 1 }}>
            <Input placeholder="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={6} />
          </View>
          <Btn
            title="Join"
            variant="wave"
            loading={busy === 'join'}
            disabled={code.trim().length < 6}
            onPress={() => {
              setBusy('join');
              attempt(async () => {
                const id = await rpc<string>('join_block', { p_code: code });
                setCode('');
                router.push({ pathname: '/blocks/[id]', params: { id } });
              }).finally(() => setBusy(null));
            }}
          />
        </Row>
      </Card>

      <Card>
        <Label>Open a new Block</Label>
        <Body muted>You'll be its starting DM. When you go offline, players can take 10-minute turns from the DM Queue.</Body>
        <Input placeholder="Block name, e.g. Block 7: Neon Docks" value={name} onChangeText={setName} />
        <Btn
          title="Open Block"
          loading={busy === 'create'}
          disabled={!name.trim()}
          onPress={() => {
            setBusy('create');
            attempt(async () => {
              const id = await rpc<string>('create_block', { p_name: name, p_description: '' });
              setName('');
              router.push({ pathname: '/blocks/[id]', params: { id } });
            }).finally(() => setBusy(null));
          }}
        />
      </Card>

      <Btn title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  charBar: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.edge,
    borderLeftWidth: 6,
    boxShadow: shadows.raised,
    padding: space(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1),
  },
  charName: { color: colors.text, fontSize: 22, fontWeight: '800', marginVertical: 2, ...engraved },
  blockName: { color: colors.text, fontSize: 17, fontWeight: '800', flexShrink: 1, ...engraved },
  code: { color: colors.waveLight, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 2 },
});
