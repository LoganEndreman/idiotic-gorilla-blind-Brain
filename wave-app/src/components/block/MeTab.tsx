import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gauge } from '@/components/Gauge';
import { attempt, Body, Btn, Card, Chip, confirm, Die, GradientCard, Label, Row, Segmented, Text } from '@/components/ui';
import { activeIncentive, Challenge, defenceFor, Skill, SKILLS, skillName } from '@/game/rules';
import { colors, engraved, space } from '@/theme';
import { BlockCtx } from './shared';

/** Your character in this Block: resources, gauge, challenges set by the DM, and your Special. */
export function MeTab({ ctx }: { ctx: BlockCtx }) {
  const { me, block, challenges, myId } = ctx;
  const ch = me.character;
  const inc = activeIncentive(me.gauge);
  const mine = challenges.filter((c) => c.target_user === myId);

  return (
    <View style={{ gap: space(4) }}>
      <Row>
        <GradientCard kind="wave" style={styles.res}>
          <Label style={{ color: '#e4f6ff' }}>Wave</Label>
          <Text style={styles.resNum}>{me.wave}</Text>
        </GradientCard>
        <GradientCard kind="void" style={styles.res}>
          <Label style={{ color: '#ddd0ff' }}>Void</Label>
          <Text style={styles.resNum}>{me.void}</Text>
        </GradientCard>
      </Row>

      {mine.length === 0 ? (
        <Card>
          <Label>Challenges</Label>
          <Body muted>
            {ctx.isDm
              ? "You're the DM, so you set challenges rather than face them."
              : 'Nothing to roll right now. Tell the table what you do. The DM decides the Skill and the challenge modifier, and sends you a challenge.'}
          </Body>
        </Card>
      ) : (
        mine.map((c) => <ChallengeCard key={c.id} ctx={ctx} challenge={c} />)
      )}

      <Card>
        <Gauge gauge={me.gauge} max={block.gauge_max} />
        <Label>Today's incentive</Label>
        <Body>
          {inc === 'wave'
            ? ch.wave_incentive || '(Wave incentive not written)'
            : inc === 'void'
              ? ch.void_incentive || '(Void incentive not written)'
              : 'On the Line of Power — the DM decides.'}
        </Body>
      </Card>

      <SpecialPanel ctx={ctx} />
      {me.skill_dice.length > 0 && <SkillDicePanel ctx={ctx} />}
    </View>
  );
}

/** A challenge the DM set for you, and every way the rules let you meet it. */
function ChallengeCard({ ctx, challenge: c }: { ctx: BlockCtx; challenge: Challenge }) {
  const { me, members, act, nameOf } = ctx;
  const ch = me.character;
  const [busy, setBusy] = useState<string | null>(null);
  const [talentSkill, setTalentSkill] = useState<Skill>(c.skill);

  const dc = ch.talents.find((t) => t.skill === c.skill)?.value ?? 20;
  const target = dc + c.modifier;
  const opponent = members.find((m) => m.user_id === c.opponent_user);
  const defence = defenceFor(ch.clan, c.skill);
  const penalty = opponent?.character.defences.find((d) => d.name === defence)?.penalty ?? 0;
  const dice = me.skill_dice.filter((d) => d.skill === c.skill);
  const talent = ch.talents.find((t) => t.skill === talentSkill)!;

  const resolve = (key: string, args: Record<string, unknown>) => {
    setBusy(key);
    attempt(() => act('resolve_challenge', { p_challenge: c.id, ...args })).finally(() => setBusy(null));
  };

  return (
    <Card accent={colors.warning}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label style={{ color: colors.warning }}>Challenge from the DM</Label>
          <Text style={styles.title}>
            {skillName(c.skill)}
            {opponent ? ` against ${opponent.character.name}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Die value={`${target}+`} size={52} />
          <Text style={styles.small}>
            DC {dc}
            {c.modifier ? ` ${c.modifier > 0 ? '+' : '−'} ${Math.abs(c.modifier)}` : ''}
          </Text>
        </View>
      </Row>
      {c.description ? <Body style={{ fontStyle: 'italic' }}>“{c.description}”</Body> : null}

      <Btn title={`Roll d20 · need ${target}+`} loading={busy === 'roll'} onPress={() => resolve('roll', { p_method: 'roll' })} />

      {dice.length > 0 && (
        <View style={{ gap: space(2) }}>
          <Label>Or use a {skillName(c.skill)} die from your Special</Label>
          {dice.map((d) => (
            <Row key={d.id}>
              <Die value={d.value} size={40} />
              <Body style={{ flex: 1 }}>
                {penalty ? `− ${penalty} (${opponent!.character.name}'s ${defence}) = ` : ''}
                <Text style={{ fontWeight: '800', color: d.value - penalty >= target ? colors.success : colors.danger }}>
                  {d.value - penalty}
                </Text>
                {d.value - penalty >= target ? ' · succeeds' : ' · fails'}
              </Body>
              <Btn small title="Use" loading={busy === d.id} onPress={() => resolve(d.id, { p_method: 'die', p_die_id: d.id })} />
            </Row>
          ))}
        </View>
      )}

      <View style={{ gap: space(2) }}>
        <Label>Or activate a Talent · 1 Wave · automatic success</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          {ch.talents.map((t) => (
            <Chip key={t.skill} label={t.name} selected={talentSkill === t.skill} onPress={() => setTalentSkill(t.skill)} />
          ))}
        </Row>
        <Btn
          variant="wave"
          title={`Activate ${talent.name}`}
          disabled={me.wave < 1}
          loading={busy === 'talent'}
          onPress={() =>
            confirm(
              `Activate ${talent.name}?`,
              `Spend 1 Wave. If ${nameOf(ctx.block.current_dm_id)} rules the Talent doesn't fit, they'll refund it and the challenge reopens.`,
              () => resolve('talent', { p_method: 'talent', p_talent_skill: talentSkill }),
            )
          }
        />
      </View>

      <Btn
        variant="void"
        title="Spend 2 Void · instant success"
        disabled={me.void < 2}
        loading={busy === 'void'}
        onPress={() => resolve('void', { p_method: 'void' })}
      />
    </Card>
  );
}

function SpecialPanel({ ctx }: { ctx: BlockCtx }) {
  const { me, act } = ctx;
  const ch = me.character;
  const pending = me.pending_special?.dice;
  const [effect, setEffect] = useState<number | null>(null);
  const [skillA, setSkillA] = useState<Skill>('charm');
  const [skillB, setSkillB] = useState<Skill>('fight');
  const [busy, setBusy] = useState(false);

  if (!pending) {
    return (
      <Card accent={colors.wave}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.title}>{ch.special_name}</Text>
          <Text style={styles.cost}>1 Wave</Text>
        </Row>
        {ch.special_description ? <Body muted>{ch.special_description}</Body> : null}
        <Btn
          title="Activate Special · roll 3 dice"
          variant="wave"
          loading={busy}
          disabled={me.wave < 1}
          onPress={() => {
            setBusy(true);
            setEffect(null);
            attempt(() => act('activate_special')).finally(() => setBusy(false));
          }}
        />
      </Card>
    );
  }

  const others = [0, 1, 2].filter((i) => i !== effect);
  return (
    <Card accent={colors.wave}>
      <Text style={styles.title}>{ch.special_name}: assign your dice</Text>
      <Body muted>Pick one die for effectiveness. The other two become Skill dice (Charm, Fight or Move — never Talents).</Body>
      <Row style={{ justifyContent: 'center' }} gap={3}>
        {pending.map((d, i) => (
          <Die key={i} value={d} size={64} selected={effect === i} onPress={() => setEffect(i)} />
        ))}
      </Row>
      {effect != null && (
        <>
          <Body>
            Effectiveness: <Text style={{ fontWeight: '800' }}>{pending[effect]}</Text>
          </Body>
          {[
            [skillA, setSkillA],
            [skillB, setSkillB],
          ].map(([val, setter], k) => (
            <View key={k} style={{ gap: space(1.5) }}>
              <Label>Skill die {pending[others[k]]}</Label>
              <Segmented
                options={SKILLS.map((s) => ({ value: s.id, label: s.name }))}
                value={val as Skill}
                onChange={setter as (s: Skill) => void}
              />
            </View>
          ))}
          <Btn
            title="Resolve Special"
            variant="wave"
            loading={busy}
            onPress={() => {
              setBusy(true);
              attempt(() => act('assign_special', { p_effect_index: effect, p_skill_a: skillA, p_skill_b: skillB })).finally(() =>
                setBusy(false),
              );
            }}
          />
        </>
      )}
    </Card>
  );
}

/** Skill dice waiting to be used on a matching challenge. */
function SkillDicePanel({ ctx }: { ctx: BlockCtx }) {
  const { me, act } = ctx;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Label>Your Skill dice</Label>
        <Btn
          small
          variant="ghost"
          title="Clear"
          onPress={() =>
            confirm('Clear Skill dice?', 'Use this when your dice expire.', () => attempt(() => act('discard_skill_dice')))
          }
        />
      </Row>
      <Row style={{ flexWrap: 'wrap' }} gap={4}>
        {me.skill_dice.map((d) => (
          <View key={d.id} style={{ alignItems: 'center', gap: 4 }}>
            <Die value={d.value} size={48} />
            <Text style={styles.small}>{skillName(d.skill)}</Text>
          </View>
        ))}
      </Row>
      <Body muted style={{ fontSize: 13 }}>
        Use these when the DM sets you a challenge with the same Skill.
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  res: { flex: 1, alignItems: 'center' },
  resNum: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1, ...engraved },
  cost: { color: colors.waveLight, fontWeight: '700', fontSize: 12 },
  small: { color: colors.muted, fontSize: 11, fontWeight: '700', ...engraved },
});
