import { StyleSheet, Text, View } from 'react-native';
import { Card, GradientCard, Label } from '@/components/ui';
import { Character, clanInfo, SKILLS, talentFor } from '@/game/rules';
import { colors, space } from '@/theme';

/** The rulebook's character sheet (§10/§11), rendered from a Character. */
export function CharacterCard({ character, compact }: { character: Character; compact?: boolean }) {
  const clan = clanInfo(character.clan);
  return (
    <View style={{ gap: space(3) }}>
      <View style={[styles.header, { backgroundColor: clan.color }]}>
        <Text style={styles.name} numberOfLines={1}>
          {character.name}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.clanLabel}>CLAN</Text>
          <Text style={styles.clan}>
            {clan.name} · {clan.epithet}
          </Text>
        </View>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.special}>{character.special_name}</Text>
          <Text style={styles.cost}>1 Wave</Text>
        </View>
        {character.special_description ? <Text style={styles.muted}>{character.special_description}</Text> : null}
      </Card>

      <View style={styles.tables}>
        <Card style={{ flex: 1, minWidth: 220 }}>
          <View style={styles.tr}>
            <Label style={{ flex: 1 }}>Skill</Label>
            <Label style={{ flex: 2 }}>Talent</Label>
            <Label>DC</Label>
          </View>
          {SKILLS.map((s) => {
            const t = talentFor(character, s.id);
            return (
              <View key={s.id} style={styles.tr}>
                <Text style={[styles.cell, { flex: 1, fontWeight: '700' }]}>{s.name}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{t?.name ?? '—'}</Text>
                <Text style={[styles.cell, styles.num]}>{t?.value ?? '—'}</Text>
              </View>
            );
          })}
        </Card>
        <Card style={{ flex: 1, minWidth: 180 }}>
          <View style={styles.tr}>
            <Label style={{ flex: 1 }}>Defence</Label>
            <Label>Penalty</Label>
          </View>
          {[...character.defences]
            .sort((a, b) => a.penalty - b.penalty)
            .map((d) => (
              <View key={d.name} style={styles.tr}>
                <Text style={[styles.cell, { flex: 1 }]}>{d.name}</Text>
                <Text style={[styles.cell, styles.num]}>−{d.penalty}</Text>
              </View>
            ))}
        </Card>
      </View>

      {!compact && (
        <View style={styles.tables}>
          <GradientCard kind="wave" style={{ flex: 1, minWidth: 200 }}>
            <Label style={{ color: '#e4f6ff' }}>Wave incentive</Label>
            <Text style={styles.incentive}>{character.wave_incentive || '—'}</Text>
          </GradientCard>
          <GradientCard kind="void" style={{ flex: 1, minWidth: 200 }}>
            <Label style={{ color: '#ddd0ff' }}>Void incentive</Label>
            <Text style={styles.incentive}>{character.void_incentive || '—'}</Text>
          </GradientCard>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: 12,
    padding: space(4),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space(3),
  },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', flexShrink: 1 },
  clanLabel: { color: '#ffffffcc', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  clan: { color: '#fff', fontSize: 15, fontWeight: '700' },
  special: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  cost: {
    color: colors.waveLight,
    borderColor: colors.wave,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  muted: { color: colors.muted, fontSize: 14 },
  tables: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  cell: { color: colors.text, fontSize: 14 },
  num: { fontWeight: '800', minWidth: 28, textAlign: 'right' },
  incentive: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
