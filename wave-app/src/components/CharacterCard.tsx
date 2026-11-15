import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Textured } from '@/components/Textured';
import { Gloss, GradientCard, Label, Text } from '@/components/ui';
import { Character, clanInfo, SKILLS, talentFor } from '@/game/rules';
import { colors, embossed, engraved, gel, shadows, space } from '@/theme';

const PAPER = require('../../assets/paper.png');

/** The rulebook's character sheet (§10/§11), printed on paper and laid on the table. */
export function CharacterCard({ character, compact }: { character: Character; compact?: boolean }) {
  const clan = clanInfo(character.clan);
  return (
    <Textured source={PAPER} style={styles.sheet} radius={4}>
      <LinearGradient colors={gel(clan.color)} style={styles.header}>
        <Gloss radius={6} strength={0.25} />
        <Text style={[styles.name, engraved]} numberOfLines={1}>
          {character.name}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.clanLabel, engraved]}>CLAN</Text>
          <Text style={[styles.clan, engraved]}>
            {clan.name} · {clan.epithet}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.specialBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space(2) }}>
          <Text style={[styles.special, embossed]}>{character.special_name}</Text>
          <Text style={styles.cost}>1 Wave</Text>
        </View>
        {character.special_description ? <Text style={styles.muted}>{character.special_description}</Text> : null}
      </View>

      <View style={styles.tables}>
        <View style={[styles.table, { minWidth: 220 }]}>
          <View style={styles.th}>
            <Text style={[styles.thText, { flex: 1 }]}>SKILL</Text>
            <Text style={[styles.thText, { flex: 2 }]}>TALENT</Text>
            <Text style={styles.thText}>DC</Text>
          </View>
          {SKILLS.map((s, i) => {
            const t = talentFor(character, s.id);
            return (
              <View key={s.id} style={[styles.tr, i % 2 === 1 && styles.zebra]}>
                <Text style={[styles.cell, { flex: 1, fontWeight: '700' }]}>{s.name}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{t?.name ?? '—'}</Text>
                <Text style={[styles.cell, styles.num]}>{t?.value ?? '—'}</Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.table, { minWidth: 170 }]}>
          <View style={styles.th}>
            <Text style={[styles.thText, { flex: 1 }]}>DEFENCE</Text>
            <Text style={styles.thText}>PENALTY</Text>
          </View>
          {[...character.defences]
            .sort((a, b) => a.penalty - b.penalty)
            .map((d, i) => (
              <View key={d.name} style={[styles.tr, i % 2 === 1 && styles.zebra]}>
                <Text style={[styles.cell, { flex: 1 }]}>{d.name}</Text>
                <Text style={[styles.cell, styles.num]}>−{d.penalty}</Text>
              </View>
            ))}
        </View>
      </View>

      {!compact && (
        <View style={styles.tables}>
          <GradientCard kind="wave" style={{ flex: 1, minWidth: 200 }}>
            <Label style={{ color: '#e4f6ff' }}>Wave incentive</Label>
            <Text style={[styles.incentive, engraved]}>{character.wave_incentive || '—'}</Text>
          </GradientCard>
          <GradientCard kind="void" style={{ flex: 1, minWidth: 200 }}>
            <Label style={{ color: '#ddd0ff' }}>Void incentive</Label>
            <Text style={[styles.incentive, engraved]}>{character.void_incentive || '—'}</Text>
          </GradientCard>
        </View>
      )}
    </Textured>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#f4eede',
    borderRadius: 4,
    padding: space(3),
    gap: space(3),
    boxShadow: shadows.paper,
    transform: [{ rotate: '-0.4deg' }],
  },
  header: {
    borderRadius: 6,
    padding: space(4),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space(3),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', flexShrink: 1, letterSpacing: -0.3 },
  clanLabel: { color: '#ffffffcc', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  clan: { color: '#fff', fontSize: 15, fontWeight: '700' },
  specialBox: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: colors.paperLine,
    borderRadius: 6,
    padding: space(3),
    gap: space(1.5),
  },
  special: { color: colors.ink, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  cost: {
    color: colors.waveDeep,
    backgroundColor: '#e3f4fc',
    borderColor: '#9fd6f0',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  muted: { color: colors.inkMuted, fontSize: 14 },
  tables: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  table: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.paperLine,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  th: { flexDirection: 'row', gap: space(2), backgroundColor: '#1f1b24', paddingHorizontal: space(3), paddingVertical: space(2) },
  thText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderTopWidth: 1,
    borderTopColor: colors.paperLine,
  },
  zebra: { backgroundColor: 'rgba(0,0,0,0.035)' },
  cell: { color: colors.ink, fontSize: 14 },
  num: { fontWeight: '800', minWidth: 28, textAlign: 'right' },
  incentive: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
