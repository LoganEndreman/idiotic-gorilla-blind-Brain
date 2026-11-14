-- =============================================================================
-- WAVE — Supabase schema
--
-- One character per account. Characters play in Blocks (campaigns). Each Block
-- has a starting DM; while they are offline, Block members can join a DM Queue
-- and take turns DMing for a fixed number of minutes (default 10).
--
-- All writes except editing your own character go through SECURITY DEFINER
-- RPCs below, so dice are rolled server-side and resources can't be edited
-- directly by clients. Every mutation inside a Block writes a row to
-- block_events, which is the single table clients subscribe to via Realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.characters (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 60),
  clan                text not null check (clan in ('serpetus', 'samitus', 'brutus', 'artus')),
  special_name        text not null check (char_length(special_name) between 1 and 60),
  special_description text not null default '',
  -- [{ "skill": "charm", "words": ["Logic","Argue"], "name": "Logic Argue", "value": 5 }, ...]
  talents             jsonb not null check (jsonb_typeof(talents) = 'array' and jsonb_array_length(talents) = 3),
  -- [{ "name": "White Lie", "penalty": 1 }, ...] — penalties 1, 2, 3 used once each
  defences            jsonb not null check (jsonb_typeof(defences) = 'array' and jsonb_array_length(defences) = 3),
  wave_incentive      text not null default '',
  void_incentive      text not null default '',
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.blocks (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  description      text not null default '',
  invite_code      text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  starting_dm_id   uuid not null references auth.users (id),
  current_dm_id    uuid references auth.users (id),
  dm_turn_ends_at  timestamptz,               -- null while the starting DM is running the table
  dm_turn_minutes  int not null default 10 check (dm_turn_minutes between 1 and 120),
  -- House rules: the rulebook leaves these unspecified (§11 "Rules still to be specified").
  starting_wave    int not null default 3 check (starting_wave >= 0),
  starting_void    int not null default 0 check (starting_void >= 0),
  starting_gauge   int not null default 2,
  gauge_max        int not null default 5 check (gauge_max between 1 and 20),
  created_at       timestamptz not null default now()
);

create table public.block_members (
  block_id        uuid not null references public.blocks (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  character_id    uuid not null references public.characters (id) on delete cascade,
  wave            int not null default 0 check (wave >= 0),
  void            int not null default 0 check (void >= 0),
  -- Line of Power gauge: > 0 is the Wave side, < 0 the Void side, 0 is on the line.
  gauge           int not null default 0,
  -- Skill dice gained from Specials: [{ "id": "...", "skill": "charm", "value": 19 }]
  skill_dice      jsonb not null default '[]'::jsonb,
  -- Three dice rolled by a Special that haven't been assigned yet: { "dice": [17, 19, 12] }
  pending_special jsonb,
  last_seen_at    timestamptz not null default now(),
  joined_at       timestamptz not null default now(),
  primary key (block_id, user_id)
);

create table public.dm_queue (
  block_id  uuid not null references public.blocks (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (block_id, user_id)
);

create table public.block_events (
  id         bigint generated always as identity primary key,
  block_id   uuid not null references public.blocks (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,   -- null for system events
  kind       text not null,  -- system | chat | narration | check | talent | void | special_roll | special | skill_die | dm_roll | adjust | day
  body       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index block_events_block_id_idx on public.block_events (block_id, id desc);
create index block_members_user_idx on public.block_members (user_id);
create index dm_queue_order_idx on public.dm_queue (block_id, joined_at);

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger characters_touch before update on public.characters
  for each row execute function public.touch_updated_at();

create or replace function public.is_block_member(p_block uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from block_members where block_id = p_block and user_id = auth.uid());
$$;

create or replace function public.shares_block_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from block_members a
    join block_members b on a.block_id = b.block_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

create or replace function public.member_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from characters where user_id = p_user), 'Someone');
$$;

-- Defence named by attacker's clan × skill of the Special-gained die (§5).
create or replace function public.defence_for(p_clan text, p_skill text) returns text
language sql immutable as $$
  select case p_clan || ':' || p_skill
    when 'serpetus:charm' then 'White Lie'
    when 'serpetus:fight' then 'Placebo'
    when 'serpetus:move'  then 'Distract'
    when 'samitus:charm'  then 'Gift'
    when 'samitus:fight'  then 'Guilt Trip'
    when 'samitus:move'   then 'Defend'
    when 'brutus:charm'   then 'Force'
    when 'brutus:fight'   then 'Brutality'
    when 'brutus:move'    then 'Flash'
    when 'artus:charm'    then 'Create'
    when 'artus:fight'    then 'Hypnose'
    when 'artus:move'     then 'Predict'
  end;
$$;

create or replace function public.d20() returns int
language sql volatile as $$ select 1 + floor(random() * 20)::int $$;

create or replace function public.log_event(p_block uuid, p_user uuid, p_kind text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into block_events (block_id, user_id, kind, body, data) values (p_block, p_user, p_kind, p_body, coalesce(p_data, '{}'::jsonb));
$$;

create or replace function public.is_online(p_block uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from block_members
    where block_id = p_block and user_id = p_user and last_seen_at > now() - interval '45 seconds'
  );
$$;

create or replace function public.require_member(p_block uuid) returns public.block_members
language plpgsql security definer set search_path = public as $$
declare m block_members;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into m from block_members where block_id = p_block and user_id = auth.uid();
  if not found then raise exception 'You are not a member of this Block'; end if;
  return m;
end $$;

create or replace function public.require_dm(p_block uuid) returns public.blocks
language plpgsql security definer set search_path = public as $$
declare b blocks;
begin
  select * into b from blocks where id = p_block;
  if not found then raise exception 'Block not found'; end if;
  if b.current_dm_id is distinct from auth.uid() then
    raise exception 'Only the current DM can do that';
  end if;
  return b;
end $$;

create or replace function public.talent_for(p_character public.characters, p_skill text) returns jsonb
language sql stable as $$
  select t from jsonb_array_elements(p_character.talents) t where t->>'skill' = p_skill limit 1;
$$;

-- -----------------------------------------------------------------------------
-- DM Queue
-- -----------------------------------------------------------------------------
-- Rules:
--  * While the starting DM is online they are the DM.
--  * When they go offline (no heartbeat for 45s) the DM Queue takes over: the
--    member who joined the queue earliest (and is online) DMs for
--    dm_turn_minutes, then the next one, and so on. Offline members are
--    skipped and removed from the queue when their turn comes up.
--  * When the starting DM comes back online they immediately resume DMing.
-- Every client calls heartbeat() every ~15s, which also runs sync_dm(), so the
-- queue advances as long as anyone in the Block has the app open.

create or replace function public.sync_dm(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b blocks;
  nxt uuid;
  cur_online boolean;
begin
  select * into b from blocks where id = p_block for update;
  if not found then return; end if;

  if is_online(p_block, b.starting_dm_id) then
    if b.current_dm_id is distinct from b.starting_dm_id then
      update blocks set current_dm_id = b.starting_dm_id, dm_turn_ends_at = null where id = p_block;
      perform log_event(p_block, null, 'system',
        member_name(b.starting_dm_id) || ' is back and has resumed as DM.');
    end if;
    return;
  end if;

  -- Starting DM is offline: the queue is in charge.
  if b.current_dm_id is not null then
    if b.current_dm_id = b.starting_dm_id then
      perform log_event(p_block, null, 'system', 'The starting DM went offline. The DM Queue is now active.');
    else
      cur_online := is_online(p_block, b.current_dm_id);
      if cur_online and b.dm_turn_ends_at is not null and b.dm_turn_ends_at > now() then
        return;  -- current queue turn still running
      end if;
      perform log_event(p_block, null, 'system',
        member_name(b.current_dm_id) ||
        case when cur_online then '''s DM turn is over.' else ' went offline during their DM turn.' end);
    end if;
  end if;

  loop
    select q.user_id into nxt from dm_queue q
      where q.block_id = p_block
      order by q.joined_at, q.user_id
      limit 1;
    exit when nxt is null;

    delete from dm_queue where block_id = p_block and user_id = nxt;

    if is_online(p_block, nxt) then
      update blocks
        set current_dm_id = nxt,
            dm_turn_ends_at = now() + make_interval(mins => b.dm_turn_minutes)
        where id = p_block;
      perform log_event(p_block, null, 'system',
        member_name(nxt) || ' is now the DM for ' || b.dm_turn_minutes || ' minutes.',
        jsonb_build_object('dm', nxt));
      return;
    end if;

    perform log_event(p_block, null, 'system', member_name(nxt) || ' was skipped in the DM Queue (offline).');
    nxt := null;
  end loop;

  if b.current_dm_id is not null or b.dm_turn_ends_at is not null then
    update blocks set current_dm_id = null, dm_turn_ends_at = null where id = p_block;
    perform log_event(p_block, null, 'system', 'No one is DMing. Join the DM Queue to take a turn.');
  end if;
end $$;

create or replace function public.heartbeat(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update block_members set last_seen_at = now() where block_id = p_block and user_id = auth.uid();
  if not found then raise exception 'You are not a member of this Block'; end if;
  perform sync_dm(p_block);
end $$;

create or replace function public.join_dm_queue(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b blocks;
begin
  perform require_member(p_block);
  select * into b from blocks where id = p_block;
  if b.current_dm_id = auth.uid() then raise exception 'You are already the DM'; end if;
  if b.starting_dm_id = auth.uid() then raise exception 'You are the starting DM of this Block'; end if;
  insert into dm_queue (block_id, user_id) values (p_block, auth.uid()) on conflict do nothing;
  if found then
    perform log_event(p_block, auth.uid(), 'system', member_name(auth.uid()) || ' joined the DM Queue.');
  end if;
  update block_members set last_seen_at = now() where block_id = p_block and user_id = auth.uid();
  perform sync_dm(p_block);
end $$;

create or replace function public.leave_dm_queue(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_member(p_block);
  delete from dm_queue where block_id = p_block and user_id = auth.uid();
  if found then
    perform log_event(p_block, auth.uid(), 'system', member_name(auth.uid()) || ' left the DM Queue.');
  end if;
end $$;

-- A queue DM can hand over early.
create or replace function public.end_dm_turn(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b blocks;
begin
  b := require_dm(p_block);
  if b.starting_dm_id = auth.uid() then
    raise exception 'The starting DM keeps the table while online';
  end if;
  update blocks set dm_turn_ends_at = now() - interval '1 second' where id = p_block;
  perform sync_dm(p_block);
end $$;

-- -----------------------------------------------------------------------------
-- Blocks
-- -----------------------------------------------------------------------------

create or replace function public.create_block(p_name text, p_description text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  b blocks;
begin
  select * into ch from characters where user_id = auth.uid();
  if not found then raise exception 'Create your character first'; end if;

  insert into blocks (name, description, starting_dm_id, current_dm_id)
    values (trim(p_name), coalesce(p_description, ''), auth.uid(), auth.uid())
    returning * into b;

  insert into block_members (block_id, user_id, character_id, wave, void, gauge)
    values (b.id, auth.uid(), ch.id, b.starting_wave, b.starting_void, b.starting_gauge);

  perform log_event(b.id, null, 'system', 'Block "' || b.name || '" opened. ' || ch.name || ' is the starting DM.');
  return b.id;
end $$;

create or replace function public.join_block(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  b blocks;
begin
  select * into ch from characters where user_id = auth.uid();
  if not found then raise exception 'Create your character first'; end if;

  select * into b from blocks where invite_code = upper(trim(p_code));
  if not found then raise exception 'No Block with that code'; end if;

  insert into block_members (block_id, user_id, character_id, wave, void, gauge)
    values (b.id, auth.uid(), ch.id, b.starting_wave, b.starting_void, b.starting_gauge)
    on conflict do nothing;
  if found then
    perform log_event(b.id, auth.uid(), 'system', ch.name || ' entered the Block.');
  end if;
  return b.id;
end $$;

create or replace function public.leave_block(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  b blocks;
  heir uuid;
begin
  perform require_member(p_block);
  select * into b from blocks where id = p_block for update;

  delete from dm_queue where block_id = p_block and user_id = auth.uid();
  delete from block_members where block_id = p_block and user_id = auth.uid();

  if not exists (select 1 from block_members where block_id = p_block) then
    delete from blocks where id = p_block;
    return;
  end if;

  perform log_event(p_block, null, 'system', member_name(auth.uid()) || ' left the Block.');

  if b.starting_dm_id = auth.uid() then
    select user_id into heir from block_members where block_id = p_block order by joined_at limit 1;
    update blocks set starting_dm_id = heir,
      current_dm_id = case when current_dm_id = auth.uid() then null else current_dm_id end
      where id = p_block;
    perform log_event(p_block, null, 'system', member_name(heir) || ' is now the starting DM.');
  elsif b.current_dm_id = auth.uid() then
    update blocks set current_dm_id = null, dm_turn_ends_at = null where id = p_block;
  end if;
  perform sync_dm(p_block);
end $$;

create or replace function public.update_block_settings(
  p_block uuid, p_name text, p_description text, p_dm_turn_minutes int,
  p_starting_wave int, p_starting_void int, p_starting_gauge int, p_gauge_max int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from blocks where id = p_block and starting_dm_id = auth.uid()) then
    raise exception 'Only the starting DM can change Block settings';
  end if;
  update blocks set
    name = trim(p_name), description = p_description, dm_turn_minutes = p_dm_turn_minutes,
    starting_wave = p_starting_wave, starting_void = p_starting_void,
    starting_gauge = greatest(-p_gauge_max, least(p_gauge_max, p_starting_gauge)), gauge_max = p_gauge_max
  where id = p_block;
  perform log_event(p_block, auth.uid(), 'system', 'Block settings were updated.');
end $$;

-- -----------------------------------------------------------------------------
-- Play
-- -----------------------------------------------------------------------------

-- Spend Wave/Void atomically. Spending Wave pushes the gauge toward Void (§9).
create or replace function public.spend(p_block uuid, p_wave int, p_void int) returns public.block_members
language plpgsql security definer set search_path = public as $$
declare
  m block_members;
  gmax int;
begin
  select gauge_max into gmax from blocks where id = p_block;
  update block_members
    set wave = wave - p_wave,
        void = void - p_void,
        gauge = greatest(-gmax, gauge - p_wave)
    where block_id = p_block and user_id = auth.uid() and wave >= p_wave and void >= p_void
    returning * into m;
  if not found then
    raise exception 'Not enough %', case when p_wave > 0 then 'Wave' else 'Void' end;
  end if;
  return m;
end $$;

create or replace function public.post_message(p_block uuid, p_body text, p_narration boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_member(p_block);
  if char_length(trim(p_body)) = 0 then return; end if;
  if p_narration then perform require_dm(p_block); end if;
  perform log_event(p_block, auth.uid(), case when p_narration then 'narration' else 'chat' end, left(trim(p_body), 2000));
end $$;

-- Normal action (§6): d20 vs Skill DC + challenge modifier.
create or replace function public.roll_check(p_block uuid, p_skill text, p_modifier int default 0, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  t jsonb;
  dc int;
  r int := d20();
  data jsonb;
begin
  perform require_member(p_block);
  select * into ch from characters where user_id = auth.uid();
  t := talent_for(ch, p_skill);
  if t is null then raise exception 'Unknown skill %', p_skill; end if;
  dc := (t->>'value')::int;
  data := jsonb_build_object(
    'skill', p_skill, 'talent', t->>'name', 'dc', dc, 'modifier', p_modifier,
    'target', dc + p_modifier, 'roll', r, 'success', r >= dc + p_modifier, 'note', p_note);
  perform log_event(p_block, auth.uid(), 'check',
    ch.name || ' rolled ' || initcap(p_skill) || ': ' || r || ' vs DC ' || (dc + p_modifier) ||
    case when r >= dc + p_modifier then ' — success' else ' — failure' end, data);
  return data;
end $$;

-- 1 Wave: the next action matching the Talent succeeds automatically (§4).
create or replace function public.activate_talent(p_block uuid, p_skill text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  ch characters;
  t jsonb;
begin
  perform require_member(p_block);
  select * into ch from characters where user_id = auth.uid();
  t := talent_for(ch, p_skill);
  if t is null then raise exception 'Unknown skill %', p_skill; end if;
  perform spend(p_block, 1, 0);
  perform log_event(p_block, auth.uid(), 'talent',
    ch.name || ' spent 1 Wave on ' || (t->>'name') || ' — automatic success.',
    jsonb_build_object('skill', p_skill, 'talent', t->>'name', 'note', p_note, 'wave', 1));
end $$;

-- 2 Void: instantly succeed at anything (§8).
create or replace function public.instant_success(p_block uuid, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_member(p_block);
  perform spend(p_block, 0, 2);
  perform log_event(p_block, auth.uid(), 'void',
    member_name(auth.uid()) || ' spent 2 Void — instant success.',
    jsonb_build_object('note', p_note, 'void', 2));
end $$;

-- 1 Wave: roll three dice for your Special (§7). Assign them with assign_special.
create or replace function public.activate_special(p_block uuid) returns int[]
language plpgsql security definer set search_path = public as $$
declare
  m block_members;
  ch characters;
  dice int[] := array[d20(), d20(), d20()];
begin
  m := require_member(p_block);
  if m.pending_special is not null then raise exception 'Assign your last Special roll first'; end if;
  select * into ch from characters where user_id = auth.uid();
  perform spend(p_block, 1, 0);
  update block_members set pending_special = jsonb_build_object('dice', to_jsonb(dice))
    where block_id = p_block and user_id = auth.uid();
  perform log_event(p_block, auth.uid(), 'special_roll',
    ch.name || ' spent 1 Wave on ' || ch.special_name || ' and rolled ' || array_to_string(dice, ', ') || '.',
    jsonb_build_object('special', ch.special_name, 'dice', to_jsonb(dice), 'wave', 1));
  return dice;
end $$;

create or replace function public.assign_special(p_block uuid, p_effect_index int, p_skill_a text, p_skill_b text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m block_members;
  ch characters;
  dice int[];
  rest int[] := '{}';
  effect int;
  new_dice jsonb;
  i int;
begin
  m := require_member(p_block);
  if m.pending_special is null then raise exception 'No Special roll to assign'; end if;
  if p_effect_index not between 0 and 2 then raise exception 'Bad die index'; end if;
  if p_skill_a not in ('charm','fight','move') or p_skill_b not in ('charm','fight','move') then
    raise exception 'Skill dice can only go to Charm, Fight or Move';
  end if;
  select * into ch from characters where user_id = auth.uid();

  select array_agg(x::int order by ord) into dice
    from jsonb_array_elements_text(m.pending_special->'dice') with ordinality as e(x, ord);
  effect := dice[p_effect_index + 1];
  for i in 1..3 loop
    if i <> p_effect_index + 1 then rest := rest || dice[i]; end if;
  end loop;

  new_dice := jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid()::text, 'skill', p_skill_a, 'value', rest[1]),
    jsonb_build_object('id', gen_random_uuid()::text, 'skill', p_skill_b, 'value', rest[2]));

  update block_members
    set skill_dice = skill_dice || new_dice, pending_special = null
    where block_id = p_block and user_id = auth.uid();

  perform log_event(p_block, auth.uid(), 'special',
    ch.name || '''s ' || ch.special_name || ': effectiveness ' || effect || '. ' ||
    initcap(p_skill_a) || ' die ' || rest[1] || ', ' || initcap(p_skill_b) || ' die ' || rest[2] || '.',
    jsonb_build_object('special', ch.special_name, 'description', ch.special_description,
      'effectiveness', effect, 'skill_dice', new_dice));
end $$;

-- Use a Skill die from a Special against a challenge (§6). If the target is a
-- character with the matching Defence, its penalty is subtracted from the die.
create or replace function public.use_skill_die(
  p_block uuid, p_die_id text, p_target uuid default null, p_modifier int default 0, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m block_members;
  ch characters;
  tgt characters;
  die jsonb;
  skill text;
  defence text;
  penalty int := 0;
  dc int;
  adjusted int;
  data jsonb;
begin
  m := require_member(p_block);
  select d into die from jsonb_array_elements(m.skill_dice) d where d->>'id' = p_die_id;
  if die is null then raise exception 'That Skill die is gone'; end if;
  select * into ch from characters where user_id = auth.uid();
  skill := die->>'skill';
  defence := defence_for(ch.clan, skill);
  dc := (talent_for(ch, skill)->>'value')::int;

  if p_target is not null then
    if not exists (select 1 from block_members where block_id = p_block and user_id = p_target) then
      raise exception 'Target is not in this Block';
    end if;
    select * into tgt from characters where user_id = p_target;
    select coalesce((select (d->>'penalty')::int from jsonb_array_elements(tgt.defences) d where d->>'name' = defence), 0)
      into penalty;
  end if;

  adjusted := (die->>'value')::int - penalty;
  data := jsonb_build_object(
    'skill', skill, 'die', (die->>'value')::int, 'defence', defence, 'penalty', penalty,
    'adjusted', adjusted, 'dc', dc, 'modifier', p_modifier, 'target_dc', dc + p_modifier,
    'success', adjusted >= dc + p_modifier, 'target', p_target, 'target_name', tgt.name, 'note', p_note);

  update block_members
    set skill_dice = (select coalesce(jsonb_agg(d), '[]'::jsonb) from jsonb_array_elements(skill_dice) d where d->>'id' <> p_die_id)
    where block_id = p_block and user_id = auth.uid();

  perform log_event(p_block, auth.uid(), 'skill_die',
    ch.name || ' used a ' || initcap(skill) || ' die (' || (die->>'value') || ')' ||
    case when tgt.name is not null then ' on ' || tgt.name else '' end ||
    case when penalty > 0 then ' — ' || defence || ' −' || penalty || ' → ' || adjusted else '' end ||
    ' vs DC ' || (dc + p_modifier) ||
    case when adjusted >= dc + p_modifier then ' — success' else ' — failure' end,
    data);
  return data;
end $$;

create or replace function public.discard_skill_dice(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_member(p_block);
  update block_members set skill_dice = '[]'::jsonb where block_id = p_block and user_id = auth.uid();
  perform log_event(p_block, auth.uid(), 'system', member_name(auth.uid()) || ' cleared their Skill dice.');
end $$;

-- -----------------------------------------------------------------------------
-- DM tools (current DM only)
-- -----------------------------------------------------------------------------

create or replace function public.dm_adjust(
  p_block uuid, p_user uuid, p_wave int default 0, p_void int default 0, p_gauge int default 0, p_reason text default ''
) returns void
language plpgsql security definer set search_path = public as $$
declare
  b blocks;
  parts text[] := '{}';
begin
  b := require_dm(p_block);
  update block_members set
    wave  = greatest(0, wave + p_wave),
    void  = greatest(0, void + p_void),
    gauge = greatest(-b.gauge_max, least(b.gauge_max, gauge + p_gauge))
  where block_id = p_block and user_id = p_user;
  if not found then raise exception 'Player not in this Block'; end if;

  if p_wave  <> 0 then parts := parts || (case when p_wave  > 0 then '+' else '' end || p_wave  || ' Wave'); end if;
  if p_void  <> 0 then parts := parts || (case when p_void  > 0 then '+' else '' end || p_void  || ' Void'); end if;
  if p_gauge <> 0 then parts := parts || ('gauge ' || case when p_gauge > 0 then '+' else '' end || p_gauge); end if;

  perform log_event(p_block, auth.uid(), 'adjust',
    'DM: ' || member_name(p_user) || ' ' || array_to_string(parts, ', ') ||
    case when coalesce(p_reason, '') <> '' then ' (' || p_reason || ')' else '' end,
    jsonb_build_object('target', p_user, 'wave', p_wave, 'void', p_void, 'gauge', p_gauge, 'reason', p_reason));
end $$;

create or replace function public.dm_roll(p_block uuid, p_count int default 1, p_note text default '') returns int[]
language plpgsql security definer set search_path = public as $$
declare dice int[] := '{}';
begin
  perform require_dm(p_block);
  for i in 1..greatest(1, least(p_count, 10)) loop dice := dice || d20(); end loop;
  perform log_event(p_block, auth.uid(), 'dm_roll',
    'DM rolled ' || array_to_string(dice, ', ') || case when coalesce(p_note, '') <> '' then ' — ' || p_note else '' end,
    jsonb_build_object('dice', to_jsonb(dice), 'note', p_note));
  return dice;
end $$;

-- A new in-game day: each character's mandatory incentive is set by which side
-- of the Line of Power their gauge is on (§9).
create or replace function public.dm_new_day(p_block uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  lines text[] := '{}';
  r record;
begin
  perform require_dm(p_block);
  for r in
    select c.name, c.wave_incentive, c.void_incentive, m.gauge
    from block_members m join characters c on c.id = m.character_id
    where m.block_id = p_block
    order by m.joined_at
  loop
    lines := lines || (r.name || ': ' ||
      case
        when r.gauge > 0 then 'WAVE — ' || coalesce(nullif(r.wave_incentive, ''), '(no incentive written)')
        when r.gauge < 0 then 'VOID — ' || coalesce(nullif(r.void_incentive, ''), '(no incentive written)')
        else 'on the Line of Power — DM''s call'
      end);
  end loop;
  perform log_event(p_block, auth.uid(), 'day', 'A new day begins in Wave City.' || E'\n' || array_to_string(lines, E'\n'));
end $$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.characters    enable row level security;
alter table public.blocks        enable row level security;
alter table public.block_members enable row level security;
alter table public.dm_queue      enable row level security;
alter table public.block_events  enable row level security;

create policy "characters: read own or Block-mates" on public.characters
  for select to authenticated using (user_id = auth.uid() or public.shares_block_with(user_id));
create policy "characters: insert own" on public.characters
  for insert to authenticated with check (user_id = auth.uid());
create policy "characters: update own" on public.characters
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "blocks: members read" on public.blocks
  for select to authenticated using (public.is_block_member(id));
create policy "block_members: members read" on public.block_members
  for select to authenticated using (public.is_block_member(block_id));
create policy "dm_queue: members read" on public.dm_queue
  for select to authenticated using (public.is_block_member(block_id));
create policy "block_events: members read" on public.block_events
  for select to authenticated using (public.is_block_member(block_id));

-- Internal helpers are not callable from the client.
revoke execute on function public.sync_dm(uuid) from public, anon, authenticated;
revoke execute on function public.log_event(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.spend(uuid, int, int) from public, anon, authenticated;
revoke execute on function public.require_member(uuid) from public, anon, authenticated;
revoke execute on function public.require_dm(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: every Block mutation writes a block_events row; clients subscribe
-- to inserts on this table and refetch Block state.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.block_events;
