import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gauge } from '@/components/Gauge';
import {
  Body,
  Btn,
  Card,
  Chip,
  Die,
  GradientCard,
  Input,
  Label,
  Row,
  Segmented,
  Stepper,
  Text,
  attempt,
  confirm,
} from '@/components/ui';
import { activeIncentive, defenceFor, Skill, SKILLS, skillName, SkillDie } from '@/game/rules';
import { colors, space } from '@/theme';
import { BlockCtx } from './shared';

/** Your character in this Block: resources, gauge, and every action from §6–§8. */
export function MeTab({ ctx }: { ctx: BlockCtx }) {
  const { me, block } = ctx;
  const ch = me.character;
  const inc = activeIncentive(me.gauge);

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

      <SkillCheck ctx={ctx} />
      <SpecialPanel ctx={ctx} />
      {me.skill_dice.length > 0 && <SkillDicePanel ctx={ctx} />}
      <TalentPanel ctx={ctx} />
      <VoidPanel ctx={ctx} />
    </View>
  );
}

function SkillCheck({ ctx }: { ctx: BlockCtx }) {
  const ch = ctx.me.character;
  const [skill, setSkill] = useState<Skill>('charm');
  const [mod, setMod] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const dc = ch.talents.find((t) => t.skill === skill)?.value ?? 20;
  return (
    <Card>
      <Label>Take an action · roll d20</Label>
      <Segmented options={SKILLS.map((s) => ({ value: s.id, label: s.name }))} value={skill} onChange={setSkill} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Body muted>Challenge modifier</Body>
        <Stepper value={mod} onChange={setMod} />
      </Row>
      <Body>
        Need <Text style={{ fontWeight: '800' }}>{dc + mod}+</Text>{' '}
        <Text style={{ color: colors.muted }}>
          (DC {dc}
          {mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : ''})
        </Text>
      </Body>
      <Input value={note} onChangeText={setNote} placeholder="What are you trying? (optional)" />
      <Btn
        title={`Roll ${skillName(skill)}`}
        loading={busy}
        onPress={() => {
          setBusy(true);
          attempt(async () => {
            await ctx.act('roll_check', { p_skill: skill, p_modifier: mod, p_note: note });
            setNote('');
            setMod(0);
          }).finally(() => setBusy(false));
        }}
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

function SkillDicePanel({ ctx }: { ctx: BlockCtx }) {
  const { me, members, act, myId } = ctx;
  const [die, setDie] = useState<SkillDie | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [mod, setMod] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const others = members.filter((m) => m.user_id !== myId);
  const dc = die ? (me.character.talents.find((t) => t.skill === die.skill)?.value ?? 20) : 0;
  const defence = die ? defenceFor(me.character.clan, die.skill) : '';
  const tgt = others.find((m) => m.user_id === target);
  const penalty = tgt?.character.defences.find((d) => d.name === defence)?.penalty ?? 0;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Label>Skill dice from your Special</Label>
        <Btn
          small
          variant="ghost"
          title="Clear"
          onPress={() =>
            confirm('Clear Skill dice?', 'Use this when your dice expire.', () => attempt(() => act('discard_skill_dice')))
          }
        />
      </Row>
      <Row style={{ flexWrap: 'wrap' }}>
        {me.skill_dice.map((d) => (
          <Chip
            key={d.id}
            label={`${skillName(d.skill)} ${d.value}`}
            selected={die?.id === d.id}
            onPress={() => setDie(die?.id === d.id ? null : d)}
          />
        ))}
      </Row>
      {die && (
        <>
          <Label>Against</Label>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="Object / circumstance" selected={target === null} onPress={() => setTarget(null)} />
            {others.map((m) => (
              <Chip
                key={m.user_id}
                label={m.character.name}
                selected={target === m.user_id}
                onPress={() => setTarget(m.user_id)}
              />
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body muted>Challenge modifier</Body>
            <Stepper value={mod} onChange={setMod} />
          </Row>
          <Body>
            {die.value}
            {tgt
              ? penalty
                ? ` − ${penalty} (${tgt.character.name}'s ${defence})`
                : ` (${tgt.character.name} lacks ${defence})`
              : ''}{' '}
            = <Text style={{ fontWeight: '800' }}>{die.value - penalty}</Text> vs DC {dc + mod}
          </Body>
          <Input value={note} onChangeText={setNote} placeholder="What are you doing? (optional)" />
          <Btn
            title="Use this die"
            loading={busy}
            onPress={() => {
              setBusy(true);
              attempt(async () => {
                await act('use_skill_die', { p_die_id: die.id, p_target: target, p_modifier: mod, p_note: note });
                setDie(null);
                setNote('');
                setMod(0);
              }).finally(() => setBusy(false));
            }}
          />
        </>
      )}
    </Card>
  );
}

function TalentPanel({ ctx }: { ctx: BlockCtx }) {
  const { me, act } = ctx;
  return (
    <Card>
      <Label>Activate a Talent · 1 Wave · automatic success</Label>
      <Body muted style={{ fontSize: 13 }}>
        Your next action that clearly matches the Talent succeeds with no roll. If the DM rules it doesn't fit, they refund the
        Wave.
      </Body>
      {me.character.talents.map((t) => (
        <Row key={t.skill} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{t.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {skillName(t.skill)} · DC {t.value}
            </Text>
          </View>
          <Btn
            small
            variant="wave"
            title="Activate"
            disabled={me.wave < 1}
            onPress={() =>
              confirm(`Activate ${t.name}?`, 'Spend 1 Wave. Your gauge moves one step toward Void.', () =>
                attempt(() => act('activate_talent', { p_skill: t.skill, p_note: '' })),
              )
            }
          />
        </Row>
      ))}
    </Card>
  );
}

function VoidPanel({ ctx }: { ctx: BlockCtx }) {
  const { me, act } = ctx;
  const [note, setNote] = useState('');
  return (
    <Card accent={colors.void}>
      <Label>Instant success · 2 Void</Label>
      <Body muted style={{ fontSize: 13 }}>
        Bypass the roll entirely for any action.
      </Body>
      <Input value={note} onChangeText={setNote} placeholder="What succeeds?" />
      <Btn
        title="Spend 2 Void"
        variant="void"
        disabled={me.void < 2}
        onPress={() =>
          attempt(async () => {
            await act('instant_success', { p_note: note });
            setNote('');
          })
        }
      />
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
  title: { color: colors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  cost: { color: colors.waveLight, fontWeight: '700', fontSize: 12 },
});
