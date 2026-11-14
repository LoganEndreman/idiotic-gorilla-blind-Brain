import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CharacterCard } from '@/components/CharacterCard';
import { Body, Btn, Card, Chip, GradientCard, H1, H2, Input, Label, notify, Row, Screen } from '@/components/ui';
import {
  ALL_DEFENCES,
  buildTalent,
  CharacterDraft,
  CLANS,
  clanInfo,
  Defence,
  draftFromCharacter,
  draftToRow,
  emptyDraft,
  SKILLS,
  TALENT_WORDS,
  talentSkills,
  talentValue,
  validateDraft,
} from '@/game/rules';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

const STEPS = ['Identity', 'Talents', 'Defences', 'Special', 'Incentives', 'Review'] as const;

export default function EditCharacter() {
  const { session, character, refreshCharacter } = useAuth();
  const editing = !!character;
  const [draft, setDraft] = useState<CharacterDraft>(() => (character ? draftFromCharacter(character) : emptyDraft()));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const errors = useMemo(() => validateDraft(draft), [draft]);

  if (!session) return <Redirect href="/" />;

  const stepValid = [
    !!draft.name.trim() && !!draft.clan,
    SKILLS.every((s) => buildTalent(s.id, draft.talents[s.id] ?? [])),
    draft.defences.length === 3,
    !!draft.special_name.trim(),
    true,
    errors.length === 0,
  ];

  async function save() {
    if (errors.length) return notify('Not quite', errors.join('\n'));
    setSaving(true);
    try {
      const row = draftToRow(draft);
      const { error } = editing
        ? await supabase().from('characters').update(row).eq('id', character!.id)
        : await supabase().from('characters').insert(row);
      if (error) throw error;
      await refreshCharacter();
      router.replace('/home');
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: space(2) }}>
        <Label>
          Step {step + 1} of {STEPS.length}
        </Label>
        <H1>{STEPS[step]}</H1>
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.progressSeg, i <= step && { backgroundColor: colors.wave }]} />
          ))}
        </View>
        {!editing && step === 0 && (
          <Body muted>You make one character and bring them into every Block of Wave City you play in.</Body>
        )}
      </View>

      {step === 0 && <IdentityStep draft={draft} set={set} />}
      {step === 1 && <TalentsStep draft={draft} set={set} />}
      {step === 2 && <DefencesStep draft={draft} set={set} />}
      {step === 3 && <SpecialStep draft={draft} set={set} />}
      {step === 4 && <IncentivesStep draft={draft} set={set} />}
      {step === 5 &&
        (errors.length ? (
          <Card>
            {errors.map((e) => (
              <Body key={e} style={{ color: colors.danger }}>
                • {e}
              </Body>
            ))}
          </Card>
        ) : (
          <CharacterCard character={{ id: '', user_id: '', ...draftToRow(draft) }} />
        ))}

      <Row>
        {step > 0 && <Btn title="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        {step < STEPS.length - 1 ? (
          <Btn title="Next" variant="wave" disabled={!stepValid[step]} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
        ) : (
          <Btn
            title={editing ? 'Save changes' : 'Enter Wave City'}
            variant="wave"
            loading={saving}
            disabled={errors.length > 0}
            onPress={save}
            style={{ flex: 2 }}
          />
        )}
      </Row>
    </Screen>
  );
}

type StepProps = { draft: CharacterDraft; set: (p: Partial<CharacterDraft>) => void };

function IdentityStep({ draft, set }: StepProps) {
  return (
    <>
      <Input label="Character name" value={draft.name} onChangeText={(name) => set({ name })} maxLength={60} placeholder="Kokichi Oma" />
      <Label>Clan</Label>
      <View style={styles.grid}>
        {CLANS.map((c) => {
          const on = draft.clan === c.id;
          return (
            <Card key={c.id} accent={c.color} style={[styles.clanCard, on && { borderColor: c.color, backgroundColor: colors.surfaceAlt }]}>
              <Text onPress={() => set({ clan: c.id })} style={styles.clanName}>
                {c.name}
              </Text>
              <Body muted>{c.epithet}</Body>
              <Btn small title={on ? 'Chosen' : 'Choose'} variant={on ? 'wave' : 'ghost'} onPress={() => set({ clan: c.id })} />
            </Card>
          );
        })}
      </View>
      <Body muted style={{ fontSize: 13 }}>
        Your clan decides which Defence applies when you use a Skill die gained from your Special.
      </Body>
    </>
  );
}

function TalentsStep({ draft, set }: StepProps) {
  return (
    <>
      <Body muted>
        For each Skill, combine two words. Talent value = 20 − both penalties (minimum 5) and becomes that Skill's DC. Lower
        is better. At least one word must come from the Skill's own row.
      </Body>
      {SKILLS.map((s) => {
        const words = draft.talents[s.id] ?? [];
        const talent = buildTalent(s.id, words);
        const toggle = (w: string) => {
          let next = words.includes(w) ? words.filter((x) => x !== w) : [...words, w];
          if (next.length > 2) next = next.slice(-2);
          set({ talents: { ...draft.talents, [s.id]: next } });
        };
        return (
          <Card key={s.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H2>{s.name}</H2>
              <Text style={styles.dc}>{words.length === 2 ? `DC ${talentValue(words[0], words[1])}` : 'DC —'}</Text>
            </Row>
            <Body muted style={{ fontSize: 13 }}>
              {s.blurb}
            </Body>
            {SKILLS.map((row) => (
              <View key={row.id} style={{ gap: space(1.5) }}>
                <Label style={row.id === s.id ? { color: colors.waveLight } : undefined}>{row.name} words</Label>
                <View style={styles.wrap}>
                  {TALENT_WORDS.filter((w) => w.skill === row.id).map((w) => (
                    <Chip
                      key={w.word}
                      label={w.word}
                      badge={`−${w.penalty}`}
                      color={clanInfo(w.clan).color}
                      selected={words.includes(w.word)}
                      onPress={() => toggle(w.word)}
                    />
                  ))}
                </View>
              </View>
            ))}
            <Body style={{ color: talent ? colors.success : words.length === 2 ? colors.danger : colors.muted }}>
              {talent
                ? `${talent.name} → ${s.name} DC ${talent.value}`
                : words.length === 2
                  ? `${words.join(' ')} can only go to ${talentSkills(words)
                      .map((x) => SKILLS.find((k) => k.id === x)!.name)
                      .join(' or ')}.`
                  : 'Pick two words.'}
            </Body>
          </Card>
        );
      })}
    </>
  );
}

function DefencesStep({ draft, set }: StepProps) {
  const selected = draft.defences;
  const toggle = (name: string) => {
    if (selected.some((d) => d.name === name)) {
      set({ defences: selected.filter((d) => d.name !== name) });
    } else if (selected.length < 3) {
      const free = ([1, 2, 3] as const).find((p) => !selected.some((d) => d.penalty === p))!;
      set({ defences: [...selected, { name, penalty: free }] });
    }
  };
  const setPenalty = (name: string, penalty: Defence['penalty']) => {
    const current = selected.find((d) => d.name === name)!;
    set({
      defences: selected.map((d) =>
        d.name === name ? { ...d, penalty } : d.penalty === penalty ? { ...d, penalty: current.penalty } : d,
      ),
    });
  };
  return (
    <>
      <Body muted>
        Choose any three Defences (from any clan) and assign −1, −2 and −3. When someone uses a Special-gained Skill die on
        you, the Defence for their clan × skill reduces that die.
      </Body>
      <Card>
        {SKILLS.map((s) => (
          <View key={s.id} style={{ gap: space(1.5) }}>
            <Label>{s.name} attacks</Label>
            <View style={styles.wrap}>
              {ALL_DEFENCES.filter((d) => d.skill === s.id).map((d) => (
                <Chip
                  key={d.name}
                  label={d.name}
                  color={clanInfo(d.clan).color}
                  badge={clanInfo(d.clan).name}
                  selected={selected.some((x) => x.name === d.name)}
                  disabled={selected.length >= 3 && !selected.some((x) => x.name === d.name)}
                  onPress={() => toggle(d.name)}
                />
              ))}
            </View>
          </View>
        ))}
      </Card>
      {selected.length > 0 && (
        <Card>
          <Label>Penalties</Label>
          {selected.map((d) => (
            <Row key={d.name} style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '700' }}>{d.name}</Body>
              <Row gap={1.5}>
                {([1, 2, 3] as const).map((p) => (
                  <Chip key={p} label={`−${p}`} selected={d.penalty === p} onPress={() => setPenalty(d.name, p)} />
                ))}
              </Row>
            </Row>
          ))}
        </Card>
      )}
    </>
  );
}

function SpecialStep({ draft, set }: StepProps) {
  return (
    <>
      <Body muted>
        Your unique ability. Activating it costs 1 Wave: roll three dice, pick one as its effectiveness, and assign the other
        two to Skills as Skill dice.
      </Body>
      <Input label="Special name" value={draft.special_name} onChangeText={(special_name) => set({ special_name })} placeholder="DICEy Lies" maxLength={60} />
      <Input
        label="What it does"
        value={draft.special_description}
        onChangeText={(special_description) => set({ special_description })}
        placeholder="Instantly convince someone by lying about your evil organization."
        multiline
      />
    </>
  );
}

function IncentivesStep({ draft, set }: StepProps) {
  return (
    <>
      <Body muted>
        Whichever side of the Line of Power your gauge is on decides which incentive you must fulfil each in-game day.
        Spending Wave pushes you toward Void.
      </Body>
      <GradientCard kind="wave">
        <Label style={{ color: '#e4f6ff' }}>Wave incentive</Label>
        <Input value={draft.wave_incentive} onChangeText={(wave_incentive) => set({ wave_incentive })} placeholder="Lie to 10 people for fun." />
      </GradientCard>
      <GradientCard kind="void">
        <Label style={{ color: '#ddd0ff' }}>Void incentive</Label>
        <Input value={draft.void_incentive} onChangeText={(void_incentive) => set({ void_incentive })} placeholder="Lie to one person for harm." />
      </GradientCard>
      <Input label="Notes" value={draft.notes} onChangeText={(notes) => set({ notes })} multiline />
    </>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  clanCard: { flexBasis: '46%', flexGrow: 1 },
  clanName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  dc: { color: colors.waveLight, fontWeight: '800', fontSize: 18 },
});
