import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { attempt, Btn, Dot, Row } from '@/components/ui';
import { isOnline } from '@/game/rules';
import { colors, space } from '@/theme';
import { BlockCtx, formatCountdown, useNow } from './shared';

/** Who's DMing right now, the queue turn countdown, and join/leave queue. */
export function DmBanner({ ctx }: { ctx: BlockCtx }) {
  const { block, queue, members, myId, isDm, isStartingDm, act, nameOf } = ctx;
  const now = useNow();
  const [busy, setBusy] = useState(false);

  const startingDm = members.find((m) => m.user_id === block.starting_dm_id);
  const startingOnline = startingDm ? isOnline(startingDm, now) : false;
  const queueTurn = block.current_dm_id && block.dm_turn_ends_at;
  const msLeft = block.dm_turn_ends_at ? new Date(block.dm_turn_ends_at).getTime() - now : 0;
  const myPos = queue.findIndex((q) => q.user_id === myId);
  const inQueue = myPos >= 0;

  const run = (fn: string) => {
    setBusy(true);
    attempt(() => act(fn)).finally(() => setBusy(false));
  };

  let title: string;
  if (!block.current_dm_id) title = 'No one is DMing';
  else if (isDm) title = queueTurn ? 'You are DMing' : 'You are the DM';
  else title = `DM: ${nameOf(block.current_dm_id)}`;

  return (
    <LinearGradient
      colors={block.current_dm_id ? [colors.waveDeep, colors.void] : [colors.surfaceAlt, colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.wrap}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{title}</Text>
          <Row gap={1.5}>
            <Dot on={startingOnline} />
            <Text style={styles.sub}>
              Starting DM {isStartingDm ? '(you)' : nameOf(block.starting_dm_id)} · {startingOnline ? 'online' : 'offline'}
            </Text>
          </Row>
          <Text style={styles.sub}>
            {queue.length === 0
              ? 'DM Queue is empty'
              : `DM Queue: ${queue.map((q) => nameOf(q.user_id)).join(' → ')}`}
          </Text>
        </View>
        {queueTurn ? (
          <View style={styles.timer}>
            <Text style={styles.timerText}>{formatCountdown(msLeft)}</Text>
            <Text style={styles.timerLabel}>TURN LEFT</Text>
          </View>
        ) : null}
      </Row>

      <Row style={{ flexWrap: 'wrap' }}>
        {isDm && queueTurn ? <Btn small title="End my DM turn" variant="ghost" loading={busy} onPress={() => run('end_dm_turn')} /> : null}
        {!isStartingDm && !isDm ? (
          inQueue ? (
            <Btn small title={`Leave queue (#${myPos + 1})`} variant="ghost" loading={busy} onPress={() => run('leave_dm_queue')} />
          ) : (
            <Btn small title={`Join DM Queue · ${block.dm_turn_minutes} min`} variant="wave" loading={busy} onPress={() => run('join_dm_queue')} />
          )
        ) : null}
      </Row>
      {!isStartingDm && !isDm && inQueue && startingOnline ? (
        <Text style={styles.sub}>The queue starts when the starting DM goes offline.</Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, padding: space(3.5), gap: space(2.5), borderWidth: 1, borderColor: colors.border },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  sub: { color: '#ffffffc0', fontSize: 12 },
  timer: { alignItems: 'center', backgroundColor: '#00000040', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  timerText: { color: '#fff', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerLabel: { color: '#ffffffb0', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
});
