import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CharacterCard } from '@/components/CharacterCard';
import { Dot, Row, Text } from '@/components/ui';
import { clanInfo, isOnline, skillName } from '@/game/rules';
import { colors, engraved, shadows, space } from '@/theme';
import { BlockCtx, useNow } from './shared';

export function PartyTab({ ctx }: { ctx: BlockCtx }) {
  const { members, block, myId } = ctx;
  const now = useNow(5000);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ gap: space(3) }}>
      {members.map((m) => {
        const clan = clanInfo(m.character.clan);
        const isDm = block.current_dm_id === m.user_id;
        return (
          <View key={m.user_id} style={{ gap: space(3) }}>
            <Pressable
              onPress={() => setOpen(open === m.user_id ? null : m.user_id)}
              style={[styles.row, { borderLeftColor: clan.color }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={2}>
                  <Dot on={isOnline(m, now)} />
                  <Text style={styles.name}>
                    {m.character.name}
                    {m.user_id === myId ? ' (you)' : ''}
                  </Text>
                  {isDm && <Text style={styles.badge}>DM</Text>}
                  {m.user_id === block.starting_dm_id && !isDm && (
                    <Text style={[styles.badge, styles.badgeMuted]}>STARTING DM</Text>
                  )}
                </Row>
                <Text style={styles.sub}>
                  {clan.name} · {m.character.special_name}
                  {m.skill_dice.length
                    ? ` · dice: ${m.skill_dice.map((d) => `${skillName(d.skill)} ${d.value}`).join(', ')}`
                    : ''}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: colors.waveLight }]}>{m.wave}</Text>
                <Text style={styles.statLabel}>WAVE</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: '#b9a0ff' }]}>{m.void}</Text>
                <Text style={styles.statLabel}>VOID</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{m.gauge > 0 ? `+${m.gauge}` : m.gauge}</Text>
                <Text style={styles.statLabel}>GAUGE</Text>
              </View>
            </Pressable>
            {open === m.user_id && <CharacterCard character={m.character} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.edge,
    borderLeftWidth: 5,
    boxShadow: shadows.raised,
    padding: space(3),
  },
  name: { color: colors.text, fontWeight: '800', fontSize: 15, flexShrink: 1, ...engraved },
  sub: { color: colors.muted, fontSize: 12 },
  badge: {
    color: colors.bg,
    backgroundColor: colors.waveLight,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeMuted: { backgroundColor: colors.border, color: colors.muted },
  stat: { alignItems: 'center', minWidth: 36 },
  statNum: { color: colors.text, fontSize: 18, fontWeight: '900', ...engraved },
  statLabel: { color: colors.faint, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
});
