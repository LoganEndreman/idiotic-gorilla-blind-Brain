import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DmBanner } from '@/components/block/DmBanner';
import { DmTab } from '@/components/block/DmTab';
import { MeTab } from '@/components/block/MeTab';
import { PartyTab } from '@/components/block/PartyTab';
import { BlockCtx } from '@/components/block/shared';
import { TableTab } from '@/components/block/TableTab';
import { Body, Segmented } from '@/components/ui';
import { useBlock } from '@/hooks/useBlock';
import { useAuth } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

type Tab = 'table' | 'me' | 'party' | 'dm';

export default function BlockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { block, members, queue, events, error, loading, act } = useBlock(id);
  const [tab, setTab] = useState<Tab>('table');
  const myId = session?.user.id ?? '';

  const nameOf = useCallback(
    (uid: string | null | undefined) => members.find((m) => m.user_id === uid)?.character.name ?? 'Someone',
    [members],
  );

  const ctx: BlockCtx | null = useMemo(() => {
    const me = members.find((m) => m.user_id === myId);
    if (!block || !me) return null;
    return {
      block,
      members,
      queue,
      events,
      me,
      myId,
      isDm: block.current_dm_id === myId,
      isStartingDm: block.starting_dm_id === myId,
      act: act as BlockCtx['act'],
      nameOf,
    };
  }, [act, block, events, members, myId, nameOf, queue]);

  if (!session) return <Redirect href="/" />;

  if (!ctx) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space(6) }}>
        {loading || !error ? <ActivityIndicator color={colors.wave} /> : <Body muted>{error}</Body>}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: ctx.block.name }} />
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: space(3), gap: space(3) }}>
        <DmBanner ctx={ctx} />
        <Segmented<Tab>
          options={[
            { value: 'table', label: 'Table' },
            { value: 'me', label: 'Me' },
            { value: 'party', label: 'Party' },
            { value: 'dm', label: ctx.isDm ? 'DM ★' : 'DM' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'table' ? (
          <TableTab ctx={ctx} />
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space(10) }} keyboardShouldPersistTaps="handled">
            {tab === 'me' && <MeTab ctx={ctx} />}
            {tab === 'party' && <PartyTab ctx={ctx} />}
            {tab === 'dm' && <DmTab ctx={ctx} />}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
