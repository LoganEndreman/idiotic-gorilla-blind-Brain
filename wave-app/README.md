# WAVE — companion app

An Expo (SDK 58, React Native, Expo Router) app for the **WAVE** tabletop RPG.

* **One character per account.** Built with the rulebook's steps: name & clan, three Talents (two words, `20 − A − B`, minimum 5, assigned one per Skill), three Defences with −1/−2/−3, a Special, and Wave/Void incentives.
* **Blocks** are short-to-medium campaigns in Wave City. Your one character joins any number of Blocks with an invite code. Wave, Void, the Line of Power gauge and Skill dice are tracked separately in each Block.
* **DM Queue.** Whoever opens a Block is its *starting DM*. When they go offline (no heartbeat for 45 s), the queue takes over: Block members who joined the queue DM in order for 10 minutes each (the starting DM can change the length). Offline players get skipped. When the starting DM comes back, they take over again right away. A queue DM can also end their turn early.
* **Challenges are set by the DM.** The current DM picks who faces the challenge, which Skill it uses and the challenge modifier. They can also pick another character as the opponent, so that character's Defences apply. Each player then meets their challenge in one of four ways: roll a d20 against their Skill DC plus the modifier, use a matching Skill die from their Special, activate a Talent (1 Wave, automatic success), or spend 2 Void (instant success). If a Talent doesn't fit, the DM refunds the Wave and the challenge reopens. Players never choose modifiers themselves.
* **Also:** Specials (1 Wave, roll 3 dice, pick one for effectiveness, assign the other two as Skill dice), DM narration and world rolls, Wave/Void/gauge adjustments, and "new day" incentive announcements. Every action appears live in the Block's Table log.

Dice are rolled **on the server** (Postgres `random()`), and all Block state changes go through `SECURITY DEFINER` RPCs, so players can't edit their own Wave/Void.

## Look & feel

The app looks like a game table. Screens sit on dark purple felt. Panels are raised and bevelled, and buttons are glossy gel. Text fields are recessed, and dice are ivory. The Line of Power gauge is a glass tube with a pewter slider, and the DM turn timer is a green LCD. Character sheets are printed on paper, like the rulebook. The textures are generated tiles in `assets/felt.png` and `assets/paper.png`. Bevels use React Native's `boxShadow`, including inset shadows.

Type is **Helvetica**. iOS uses its built-in Helvetica Neue, and the web asks for Helvetica Neue, then Helvetica, then Arial. Android doesn't ship Helvetica and it can't be bundled without a licence, so Android falls back to the system sans-serif. Use the `Text` component from `src/components/ui.tsx`, not React Native's, so the font is applied.

## Setup

1. Create a Supabase project.
2. Apply the schema: run the files in `supabase/migrations/` in order in the SQL editor, or run `supabase db push`.
3. Copy `.env.example` to `.env` and fill in:
   * `EXPO_PUBLIC_SUPABASE_URL`
   * `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_…` key; a legacy anon key also works)
   * `SUPABASE_SECRET_KEY` is a server-only slot. The app never reads it. Never give it an `EXPO_PUBLIC_` prefix.
4. Auth → Providers: email/password is used. Turn off "Confirm email" if you want instant sign-up while testing.
5. Run it:

```bash
npm install
npx expo start
```

Without keys, the app opens a setup screen.

## House rules

The rulebook (§11) leaves these open, so the app uses the following defaults. The starting DM can change the numbers per Block.

| Open rule | App default |
|---|---|
| Starting Wave / Void | 3 / 0 |
| Gauge | starts at +2 (Wave side), range ±5; spending 1 Wave moves it 1 toward Void; the DM can nudge it either way |
| How Void is gained | The DM awards it (DM tab → Adjust a player) |
| Skill dice expiry | A die is used up when you roll it; you can also clear dice manually |
| Special effectiveness thresholds | The DM interprets the die |
| Gauge exactly on the line | No incentive is forced; the DM decides |

## Layout

```
src/app/                 routes (index redirect, setup, sign-in, home, character/, blocks/[id], rules)
src/components/block/    Block screen: DM banner, Table, Me, Party, DM tabs
src/game/rules.ts        rule tables + pure helpers (talent values, defence lookup, validation)
src/hooks/useBlock.ts    heartbeat (15 s), Realtime subscription, refetching
supabase/migrations/     schema, RLS, RPCs, DM Queue logic (sync_dm)
```

The DM Queue advances whenever any member's app sends a heartbeat. If nobody in a Block has the app open, nothing needs to advance.
