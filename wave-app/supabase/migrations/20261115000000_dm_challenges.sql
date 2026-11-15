-- =============================================================================
-- DM-set challenges
--
-- The DM decides which Skill an action uses and its challenge modifier (§6),
-- so players no longer pass a modifier. The current DM sets a challenge for one
-- or more players; each player resolves their own by rolling a d20, using a
-- matching Skill die from their Special, activating a Talent (1 Wave) or
-- spending 2 Void. If the challenge is another character, that character's
-- Defence applies to Skill dice used against it.
-- =============================================================================

create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  block_id      uuid not null references public.blocks (id) on delete cascade,
  created_by    uuid references auth.users (id) on delete set null,
  target_user   uuid not null references auth.users (id) on delete cascade,
  skill         text not null check (skill in ('charm', 'fight', 'move')),
  modifier      int not null default 0 check (modifier between -20 and 20),
  opponent_user uuid references auth.users (id) on delete set null,  -- a character acting as the challenge
  description   text not null default '',
  status        text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
  result        jsonb,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index challenges_block_status_idx on public.challenges (block_id, status);

alter table public.challenges enable row level security;
create policy "challenges: members read" on public.challenges
  for select to authenticated using (public.is_block_member(block_id));

-- Players no longer choose modifiers or targets, and Talents / 2 Void are now
-- spent on a DM-set challenge (resolve_challenge) rather than free-standing.
drop function if exists public.roll_check(uuid, text, int, text);
drop function if exists public.use_skill_die(uuid, text, uuid, int, text);
drop function if exists public.activate_talent(uuid, text, text);
drop function if exists public.instant_success(uuid, text);

-- -----------------------------------------------------------------------------
-- DM side
-- -----------------------------------------------------------------------------

create or replace function public.dm_set_challenge(
  p_block uuid, p_targets uuid[], p_skill text, p_modifier int default 0,
  p_description text default '', p_opponent uuid default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  b blocks;
  t uuid;
  names text[] := '{}';
begin
  b := require_dm(p_block);
  if p_skill not in ('charm', 'fight', 'move') then raise exception 'Pick Charm, Fight or Move'; end if;
  if p_modifier not between -20 and 20 then raise exception 'Modifier must be between -20 and +20'; end if;
  if p_opponent is not null and not exists (select 1 from block_members where block_id = p_block and user_id = p_opponent) then
    raise exception 'Opponent is not in this Block';
  end if;

  foreach t in array coalesce(p_targets, '{}') loop
    continue when t = b.current_dm_id or t is not distinct from p_opponent;
    continue when not exists (select 1 from block_members where block_id = p_block and user_id = t);
    insert into challenges (block_id, created_by, target_user, skill, modifier, opponent_user, description)
      values (p_block, auth.uid(), t, p_skill, p_modifier, p_opponent, coalesce(trim(p_description), ''));
    names := names || member_name(t);
  end loop;

  if array_length(names, 1) is null then raise exception 'Choose at least one player to face the challenge'; end if;

  perform log_event(p_block, auth.uid(), 'challenge',
    'Challenge for ' || array_to_string(names, ', ') || ': ' || initcap(p_skill) ||
    case when p_modifier > 0 then ' +' || p_modifier when p_modifier < 0 then ' ' || p_modifier else '' end ||
    case when p_opponent is not null then ' against ' || member_name(p_opponent) else '' end ||
    case when coalesce(trim(p_description), '') <> '' then ' — ' || trim(p_description) else '' end,
    jsonb_build_object('skill', p_skill, 'modifier', p_modifier, 'opponent', p_opponent, 'description', p_description));
  return array_length(names, 1);
end $$;

create or replace function public.dm_cancel_challenge(p_block uuid, p_challenge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  perform require_dm(p_block);
  update challenges set status = 'cancelled', resolved_at = now()
    where id = p_challenge and block_id = p_block and status = 'open'
    returning * into c;
  if not found then raise exception 'That challenge is no longer open'; end if;
  perform log_event(p_block, auth.uid(), 'system',
    'DM withdrew ' || member_name(c.target_user) || '''s ' || initcap(c.skill) || ' challenge.');
end $$;

-- Used with a Talent refund: the Talent didn't fit, so the challenge stands.
create or replace function public.dm_reopen_challenge(p_block uuid, p_challenge uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  perform require_dm(p_block);
  update challenges set status = 'open', result = null, resolved_at = null
    where id = p_challenge and block_id = p_block and status = 'resolved'
    returning * into c;
  if not found then raise exception 'That challenge can''t be reopened'; end if;
  perform log_event(p_block, auth.uid(), 'system',
    member_name(c.target_user) || '''s ' || initcap(c.skill) || ' challenge is open again.');
end $$;

-- -----------------------------------------------------------------------------
-- Player side
-- -----------------------------------------------------------------------------

-- p_method: 'roll' | 'die' | 'talent' | 'void'
create or replace function public.resolve_challenge(
  p_block uuid, p_challenge uuid, p_method text, p_die_id text default null, p_talent_skill text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m block_members;
  c challenges;
  ch characters;
  opp characters;
  t jsonb;
  die jsonb;
  dc int;
  target int;
  r int;
  defence text;
  penalty int := 0;
  adjusted int;
  success boolean;
  kind text;
  body text;
  data jsonb;
  vs text;
begin
  m := require_member(p_block);
  select * into c from challenges
    where id = p_challenge and block_id = p_block and status = 'open'
    for update;
  if not found then raise exception 'That challenge is no longer open'; end if;
  if c.target_user <> auth.uid() then raise exception 'That challenge is for someone else'; end if;

  select * into ch from characters where user_id = auth.uid();
  dc := (talent_for(ch, c.skill)->>'value')::int;
  target := dc + c.modifier;
  if c.opponent_user is not null then select * into opp from characters where user_id = c.opponent_user; end if;
  vs := case when opp.name is not null then ' against ' || opp.name else '' end;
  data := jsonb_build_object(
    'challenge', c.id, 'method', p_method, 'skill', c.skill, 'dc', dc, 'modifier', c.modifier,
    'target_dc', target, 'note', c.description, 'opponent', c.opponent_user, 'opponent_name', opp.name);

  if p_method = 'roll' then
    r := d20();
    success := r >= target;
    kind := 'check';
    data := data || jsonb_build_object('roll', r, 'talent', talent_for(ch, c.skill)->>'name');
    body := ch.name || ' rolled ' || initcap(c.skill) || vs || ': ' || r || ' vs DC ' || target;

  elsif p_method = 'die' then
    select d into die from jsonb_array_elements(m.skill_dice) d where d->>'id' = p_die_id;
    if die is null then raise exception 'That Skill die is gone'; end if;
    if die->>'skill' <> c.skill then
      raise exception 'That is a % die; this challenge needs %', initcap(die->>'skill'), initcap(c.skill);
    end if;
    defence := defence_for(ch.clan, c.skill);
    if opp.id is not null then
      select coalesce((select (d->>'penalty')::int from jsonb_array_elements(opp.defences) d where d->>'name' = defence), 0)
        into penalty;
    end if;
    adjusted := (die->>'value')::int - penalty;
    success := adjusted >= target;
    kind := 'skill_die';
    data := data || jsonb_build_object('die', (die->>'value')::int, 'defence', defence, 'penalty', penalty, 'adjusted', adjusted);
    update block_members
      set skill_dice = (select coalesce(jsonb_agg(d), '[]'::jsonb) from jsonb_array_elements(skill_dice) d where d->>'id' <> p_die_id)
      where block_id = p_block and user_id = auth.uid();
    body := ch.name || ' used a ' || initcap(c.skill) || ' die (' || (die->>'value') || ')' || vs ||
      case when penalty > 0 then ' — ' || defence || ' −' || penalty || ' → ' || adjusted else '' end ||
      ' vs DC ' || target;

  elsif p_method = 'talent' then
    t := talent_for(ch, coalesce(p_talent_skill, c.skill));
    if t is null then raise exception 'Unknown Talent'; end if;
    perform spend(p_block, 1, 0);
    success := true;
    kind := 'talent';
    data := data || jsonb_build_object('talent', t->>'name', 'wave', 1);
    body := ch.name || ' spent 1 Wave on ' || (t->>'name') || ' for the ' || initcap(c.skill) || ' challenge' || vs || ' — automatic success.';

  elsif p_method = 'void' then
    perform spend(p_block, 0, 2);
    success := true;
    kind := 'void';
    data := data || jsonb_build_object('void', 2);
    body := ch.name || ' spent 2 Void on the ' || initcap(c.skill) || ' challenge' || vs || ' — instant success.';

  else
    raise exception 'Unknown method %', p_method;
  end if;

  if p_method in ('roll', 'die') then
    body := body || case when success then ' — success' else ' — failure' end;
  end if;
  data := data || jsonb_build_object('success', success);

  update challenges set status = 'resolved', result = data, resolved_at = now() where id = c.id;
  perform log_event(p_block, auth.uid(), kind, body, data);
  return data;
end $$;

