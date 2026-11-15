import { StyleSheet, View } from 'react-native';
import { Body, Card, H2, Label, Screen, Text } from '@/components/ui';
import { CLANS, DEFENCE_TABLE, SKILLS, TALENT_WORDS } from '@/game/rules';
import { colors, space } from '@/theme';

const QUICK: [string, string][] = [
  ['Normal action', 'Roll d20 against modified Skill DC'],
  ['Success / failure', 'Roll ≥ DC succeeds; below fails'],
  ['Modified DC', 'Skill DC + challenge modifier'],
  ['Talent creation', 'Combine two words; 20 − both penalties (minimum 5)'],
  ['Skill DC', 'Value of its assigned Talent'],
  ['Talent activation', '1 Wave — auto-succeed at an action that fits the Talent'],
  ['Special activation', '1 Wave — roll three dice'],
  ['Special dice', 'One for effectiveness, two assigned to Skills (never Talents)'],
  ['Defences', 'Subtract −1/−2/−3 from matching Special-gained Skill dice'],
  ['Instant success', '2 Void — any action'],
  ['Spending Wave', 'Pushes the gauge toward Void'],
  ['Daily incentive', 'Determined by the Wave/Void Line of Power'],
];

export default function Rules() {
  return (
    <Screen>
      <Card>
        {QUICK.map(([k, v]) => (
          <View key={k} style={styles.tr}>
            <Text style={[styles.cell, { flex: 2, fontWeight: '700' }]}>{k}</Text>
            <Text style={[styles.cell, { flex: 3 }]}>{v}</Text>
          </View>
        ))}
      </Card>

      <H2>Talent words</H2>
      <Table
        cell={(clan, skill) => {
          const w = TALENT_WORDS.find((x) => x.clan === clan && x.skill === skill)!;
          return `${w.word} −${w.penalty}`;
        }}
      />

      <H2>Defence lookup</H2>
      <Body muted>Attacker's clan × Skill of the Special-gained die.</Body>
      <Table cell={(clan, skill) => DEFENCE_TABLE[clan][skill]} />

      <Card>
        <Label>Rules still to be specified (house rules in this app)</Label>
        <Body muted>
          • Starting Wave / Void and gauge — set per Block by its starting DM (defaults 3 Wave, 0 Void, gauge +2).
        </Body>
        <Body muted>• How far the gauge moves — 1 step toward Void per Wave spent; the DM can nudge it either way.</Body>
        <Body muted>• How Void is gained — the DM awards it from the DM tab.</Body>
        <Body muted>• When Skill dice expire — they're used up when rolled, or cleared manually.</Body>
        <Body muted>• Numerical thresholds for Special effectiveness — the DM interprets the die.</Body>
      </Card>
    </Screen>
  );
}

function Table({ cell }: { cell: (clan: (typeof CLANS)[number]['id'], skill: (typeof SKILLS)[number]['id']) => string }) {
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={[styles.tr, styles.head]}>
        <Text style={[styles.th, { flex: 1 }]}>SKILL</Text>
        {CLANS.map((c) => (
          <Text key={c.id} style={[styles.th, { flex: 1.3, color: c.color }]}>
            {c.name.toUpperCase()}
          </Text>
        ))}
      </View>
      {SKILLS.map((s) => (
        <View key={s.id} style={[styles.tr, styles.bodyRow]}>
          <Text style={[styles.cell, { flex: 1, fontWeight: '700' }]}>{s.name}</Text>
          {CLANS.map((c) => (
            <Text key={c.id} style={[styles.cell, { flex: 1.3, fontSize: 12 }]}>
              {cell(c.id, s.id)}
            </Text>
          ))}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  tr: { flexDirection: 'row', gap: space(2), paddingVertical: space(1.5) },
  head: { backgroundColor: '#0e0a1c', paddingHorizontal: space(3), paddingVertical: space(2.5) },
  bodyRow: { paddingHorizontal: space(3), borderTopWidth: 1, borderTopColor: colors.edge },
  th: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cell: { color: colors.text, fontSize: 14 },
});
