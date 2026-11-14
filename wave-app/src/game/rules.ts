// Rules data and pure helpers for WAVE. Mirrors the rulebook sections noted below.

export type Clan = 'serpetus' | 'samitus' | 'brutus' | 'artus';
export type Skill = 'charm' | 'fight' | 'move';

export const CLANS: { id: Clan; name: string; epithet: string; color: string }[] = [
  { id: 'serpetus', name: 'Serpetus', epithet: 'Liars', color: '#2a9d6c' },
  { id: 'samitus', name: 'Samitus', epithet: 'Heroes', color: '#e0a020' },
  { id: 'brutus', name: 'Brutus', epithet: 'Strongmen', color: '#d9443a' },
  { id: 'artus', name: 'Artus', epithet: 'Bards', color: '#d6457f' },
];

export const SKILLS: { id: Skill; name: string; blurb: string }[] = [
  { id: 'charm', name: 'Charm', blurb: 'Social interaction, persuasion, deception, or influence.' },
  { id: 'fight', name: 'Fight', blurb: 'Confrontation, combat, or physical opposition.' },
  { id: 'move', name: 'Move', blurb: 'Movement, positioning, evasion, or mobility.' },
];

export const clanInfo = (c: Clan) => CLANS.find((x) => x.id === c)!;
export const skillName = (s: Skill) => SKILLS.find((x) => x.id === s)!.name;

// §4 Talent word table.
export type TalentWord = { word: string; skill: Skill; clan: Clan; penalty: number };
export const TALENT_WORDS: TalentWord[] = [
  { word: 'Logic', skill: 'charm', clan: 'serpetus', penalty: 10 },
  { word: 'Persuasion', skill: 'charm', clan: 'samitus', penalty: 3 },
  { word: 'Argue', skill: 'charm', clan: 'brutus', penalty: 5 },
  { word: 'Hypnosis', skill: 'charm', clan: 'artus', penalty: 2 },
  { word: 'Trap', skill: 'fight', clan: 'serpetus', penalty: 10 },
  { word: 'Kill', skill: 'fight', clan: 'samitus', penalty: 2 },
  { word: 'Defense', skill: 'fight', clan: 'brutus', penalty: 3 },
  { word: 'Dodge', skill: 'fight', clan: 'artus', penalty: 5 },
  { word: 'Runner', skill: 'move', clan: 'serpetus', penalty: 3 },
  { word: 'Super', skill: 'move', clan: 'samitus', penalty: 10 },
  { word: 'Escape', skill: 'move', clan: 'brutus', penalty: 5 },
  { word: 'Stop', skill: 'move', clan: 'artus', penalty: 2 },
];

export const wordInfo = (w: string) => TALENT_WORDS.find((x) => x.word === w);

export const TALENT_BASE = 20;
export const TALENT_MIN = 5;

/** Talent Value = 20 − A − B, minimum 5. */
export function talentValue(a: string, b: string): number {
  const wa = wordInfo(a);
  const wb = wordInfo(b);
  if (!wa || !wb) return TALENT_BASE;
  return Math.max(TALENT_MIN, TALENT_BASE - wa.penalty - wb.penalty);
}

/** Skills a Talent may be assigned to: any skill of either component word. */
export function talentSkills(words: string[]): Skill[] {
  const out = new Set<Skill>();
  for (const w of words) {
    const info = wordInfo(w);
    if (info) out.add(info.skill);
  }
  return [...out];
}

// §5 Defence table: attacker's clan × skill of the Special-gained die.
export const DEFENCE_TABLE: Record<Clan, Record<Skill, string>> = {
  serpetus: { charm: 'White Lie', fight: 'Placebo', move: 'Distract' },
  samitus: { charm: 'Gift', fight: 'Guilt Trip', move: 'Defend' },
  brutus: { charm: 'Force', fight: 'Brutality', move: 'Flash' },
  artus: { charm: 'Create', fight: 'Hypnose', move: 'Predict' },
};

export const defenceFor = (clan: Clan, skill: Skill) => DEFENCE_TABLE[clan][skill];

export const ALL_DEFENCES = CLANS.flatMap((c) =>
  SKILLS.map((s) => ({ name: DEFENCE_TABLE[c.id][s.id], clan: c.id, skill: s.id })),
);

// Character model ------------------------------------------------------------

export type Talent = { skill: Skill; words: [string, string]; name: string; value: number };
export type Defence = { name: string; penalty: 1 | 2 | 3 };

export type CharacterDraft = {
  name: string;
  clan: Clan | null;
  special_name: string;
  special_description: string;
  talents: Partial<Record<Skill, string[]>>; // skill -> chosen words
  defences: Defence[];
  wave_incentive: string;
  void_incentive: string;
  notes: string;
};

export type Character = {
  id: string;
  user_id: string;
  name: string;
  clan: Clan;
  special_name: string;
  special_description: string;
  talents: Talent[];
  defences: Defence[];
  wave_incentive: string;
  void_incentive: string;
  notes: string;
};

export const emptyDraft = (): CharacterDraft => ({
  name: '',
  clan: null,
  special_name: '',
  special_description: '',
  talents: {},
  defences: [],
  wave_incentive: '',
  void_incentive: '',
  notes: '',
});

export function draftFromCharacter(c: Character): CharacterDraft {
  const talents: CharacterDraft['talents'] = {};
  for (const t of c.talents) talents[t.skill] = [...t.words];
  return { ...c, talents, defences: [...c.defences] };
}

export function buildTalent(skill: Skill, words: string[]): Talent | null {
  if (words.length !== 2 || words[0] === words[1]) return null;
  if (!talentSkills(words).includes(skill)) return null;
  return {
    skill,
    words: [words[0], words[1]],
    name: `${words[0]} ${words[1]}`,
    value: talentValue(words[0], words[1]),
  };
}

/** Returns a list of problems; empty means the character is legal. */
export function validateDraft(d: CharacterDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push('Give your character a name.');
  if (!d.clan) errors.push('Choose a clan.');
  for (const s of SKILLS) {
    if (!buildTalent(s.id, d.talents[s.id] ?? [])) {
      errors.push(`${s.name} needs a Talent: two different words, at least one from the ${s.name} row.`);
    }
  }
  if (d.defences.length !== 3) errors.push('Choose exactly three Defences.');
  const pens = d.defences.map((x) => x.penalty).sort();
  if (d.defences.length === 3 && pens.join() !== '1,2,3') errors.push('Assign −1, −2 and −3 to your Defences, once each.');
  if (!d.special_name.trim()) errors.push('Name your Special.');
  return errors;
}

export function draftToRow(d: CharacterDraft) {
  return {
    name: d.name.trim(),
    clan: d.clan!,
    special_name: d.special_name.trim(),
    special_description: d.special_description.trim(),
    talents: SKILLS.map((s) => buildTalent(s.id, d.talents[s.id] ?? [])!),
    defences: d.defences,
    wave_incentive: d.wave_incentive.trim(),
    void_incentive: d.void_incentive.trim(),
    notes: d.notes,
  };
}

export const talentFor = (c: Character, s: Skill) => c.talents.find((t) => t.skill === s);

// Block model ----------------------------------------------------------------

export type Block = {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  starting_dm_id: string;
  current_dm_id: string | null;
  dm_turn_ends_at: string | null;
  dm_turn_minutes: number;
  starting_wave: number;
  starting_void: number;
  starting_gauge: number;
  gauge_max: number;
  created_at: string;
};

export type SkillDie = { id: string; skill: Skill; value: number };

export type BlockMember = {
  block_id: string;
  user_id: string;
  character_id: string;
  wave: number;
  void: number;
  gauge: number;
  skill_dice: SkillDie[];
  pending_special: { dice: number[] } | null;
  last_seen_at: string;
  joined_at: string;
  character: Character;
};

export type QueueEntry = { block_id: string; user_id: string; joined_at: string };

export type BlockEvent = {
  id: number;
  block_id: string;
  user_id: string | null;
  kind: string;
  body: string;
  data: Record<string, any>;
  created_at: string;
};

export const ONLINE_WINDOW_MS = 45_000;
export const HEARTBEAT_MS = 15_000;

export const isOnline = (m: Pick<BlockMember, 'last_seen_at'>, now = Date.now()) =>
  now - new Date(m.last_seen_at).getTime() < ONLINE_WINDOW_MS;

/** Which incentive is mandatory today (§9). */
export function activeIncentive(gauge: number): 'wave' | 'void' | 'line' {
  return gauge > 0 ? 'wave' : gauge < 0 ? 'void' : 'line';
}
