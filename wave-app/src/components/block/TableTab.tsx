import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { attempt, Btn, Chip, Input, Row } from '@/components/ui';
import type { BlockEvent } from '@/game/rules';
import { colors, space } from '@/theme';
import { BlockCtx } from './shared';

const ROLL_KINDS = new Set(['check', 'skill_die']);

/** The shared table: chat, DM narration and every roll, live. */
export function TableTab({ ctx }: { ctx: BlockCtx }) {
  const { events, isDm, act } = ctx;
  const [text, setText] = useState('');
  const [narrate, setNarrate] = useState(false);
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<BlockEvent>>(null);

  useEffect(() => {
    if (!isDm) setNarrate(false);
  }, [isDm]);

  const send = () => {
    if (!text.trim()) return;
    setSending(true);
    attempt(async () => {
      await act('post_message', { p_body: text, p_narration: narrate });
      setText('');
    }).finally(() => setSending(false));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <FlatList
        ref={list}
        data={events}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <EventRow ev={item} ctx={ctx} />}
        contentContainerStyle={{ gap: space(2), paddingVertical: space(2) }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        style={{ flex: 1 }}
      />
      <View style={styles.composer}>
        {isDm && (
          <Row gap={2}>
            <Chip label="Chat" selected={!narrate} onPress={() => setNarrate(false)} />
            <Chip label="Narrate as DM" selected={narrate} color={colors.void} onPress={() => setNarrate(true)} />
          </Row>
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <Input
              value={text}
              onChangeText={setText}
              placeholder={narrate ? 'Describe the scene…' : 'Say something…'}
              onSubmitEditing={send}
              returnKeyType="send"
            />
          </View>
          <Btn title="Send" variant={narrate ? 'void' : 'wave'} onPress={send} loading={sending} disabled={!text.trim()} />
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}

function EventRow({ ev, ctx }: { ev: BlockEvent; ctx: BlockCtx }) {
  const { nameOf, isDm, act } = ctx;
  const time = new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (ev.kind === 'system') {
    return <Text style={styles.system}>{ev.body}</Text>;
  }
  if (ev.kind === 'chat') {
    return (
      <View style={styles.chat}>
        <Text style={styles.author}>
          {nameOf(ev.user_id)} <Text style={styles.time}>{time}</Text>
        </Text>
        <Text style={styles.body}>{ev.body}</Text>
      </View>
    );
  }
  if (ev.kind === 'narration' || ev.kind === 'day') {
    return (
      <View style={[styles.card, { borderLeftColor: colors.void, backgroundColor: '#2a1d4d' }]}>
        <Text style={styles.label}>{ev.kind === 'day' ? 'NEW DAY' : `DM · ${nameOf(ev.user_id)}`}</Text>
        <Text style={[styles.body, ev.kind === 'narration' && { fontStyle: 'italic' }]}>{ev.body}</Text>
      </View>
    );
  }

  const success: boolean | undefined = ev.data?.success;
  const accent = ROLL_KINDS.has(ev.kind)
    ? success
      ? colors.success
      : colors.danger
    : ev.kind === 'void'
      ? colors.void
      : ev.kind === 'adjust' || ev.kind === 'dm_roll'
        ? colors.warning
        : colors.wave;
  const big =
    ev.kind === 'check' ? ev.data.roll : ev.kind === 'skill_die' ? ev.data.adjusted : ev.kind === 'special' ? ev.data.effectiveness : null;
  const refundable = isDm && ev.user_id && (ev.kind === 'talent' || ev.kind === 'special_roll');

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.label}>
            {labelFor(ev.kind)} · {time}
          </Text>
          <Text style={styles.body}>{ev.body}</Text>
          {ev.data?.note ? <Text style={styles.note}>“{ev.data.note}”</Text> : null}
          {ev.kind === 'special' && ev.data.description ? <Text style={styles.note}>{ev.data.description}</Text> : null}
        </View>
        {big != null ? (
          <View style={[styles.die, { borderColor: accent }]}>
            <Text style={styles.dieText}>{big}</Text>
          </View>
        ) : null}
      </Row>
      {refundable ? (
        <Btn
          small
          variant="ghost"
          title="Doesn't fit — refund 1 Wave"
          onPress={() =>
            attempt(() =>
              act('dm_adjust', {
                p_user: ev.user_id,
                p_wave: 1,
                p_void: 0,
                p_gauge: 1,
                p_reason: `refund: ${ev.data?.talent ?? ev.data?.special ?? 'action'} didn't fit`,
              }),
            )
          }
        />
      ) : null}
    </View>
  );
}

function labelFor(kind: string) {
  return (
    {
      check: 'SKILL ROLL',
      talent: 'TALENT · 1 WAVE',
      void: '2 VOID',
      special_roll: 'SPECIAL · 1 WAVE',
      special: 'SPECIAL RESOLVED',
      skill_die: 'SKILL DIE',
      dm_roll: 'DM ROLL',
      adjust: 'DM ADJUSTMENT',
    } as Record<string, string>
  )[kind] ?? kind.toUpperCase();
}

const styles = StyleSheet.create({
  system: { color: colors.faint, fontSize: 12, textAlign: 'center', paddingHorizontal: space(4) },
  chat: { paddingHorizontal: space(1) },
  author: { color: colors.waveLight, fontWeight: '700', fontSize: 13 },
  time: { color: colors.faint, fontWeight: '400', fontSize: 11 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  note: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: space(3),
    gap: space(2),
  },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  die: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  dieText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  composer: { gap: space(2), paddingTop: space(2), borderTopWidth: 1, borderTopColor: colors.border },
});
