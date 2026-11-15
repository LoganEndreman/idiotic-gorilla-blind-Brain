import { router } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Body, Btn, Card, Chip, Dot, H2, Input, Label, Row, Stepper, Text, attempt, confirm } from '@/components/ui';
import { isOnline } from '@/game/rules';
import { colors, space } from '@/theme';
import { BlockCtx, useNow } from './shared';

/** DM Queue, DM tools (current DM only), Block settings and invites. */
export function DmTab({ ctx }: { ctx: BlockCtx }) {
  const { block, queue, isDm, isStartingDm, nameOf, members, act } = ctx;
  const now = useNow(5000);

  return (
    <View style={{ gap: space(4) }}>
      <Card>
        <Label>DM Queue</Label>
        <Body muted style={{ fontSize: 13 }}>
          While the starting DM is offline, queued players DM in order for {block.dm_turn_minutes} minutes each. Offline players
          are skipped. The starting DM takes over again as soon as they're back.
        </Body>
        {queue.length === 0 ? (
          <Body muted>Nobody is queued.</Body>
        ) : (
          queue.map((q, i) => {
            const m = members.find((x) => x.user_id === q.user_id);
            return (
              <Row key={q.user_id}>
                <Text style={{ color: colors.muted, fontWeight: '800', width: 24 }}>{i + 1}</Text>
                <Dot on={m ? isOnline(m, now) : false} />
                <Body>{nameOf(q.user_id)}</Body>
              </Row>
            );
          })
        )}
      </Card>

      {isDm ? (
        <DmTools ctx={ctx} />
      ) : (
        <Card>
          <Label>DM tools</Label>
          <Body muted>Only the current DM can narrate, roll for the world, adjust Wave/Void and start a new day.</Body>
        </Card>
      )}

      <Card>
        <Label>Invite players</Label>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.waveLight, fontSize: 28, fontWeight: '900', letterSpacing: 6, fontFamily: 'monospace' }}>
            {block.invite_code}
          </Text>
          <Btn
            small
            variant="ghost"
            title="Share"
            onPress={() => Share.share({ message: `Join my WAVE Block "${block.name}" with code ${block.invite_code}` })}
          />
        </Row>
      </Card>

      {isStartingDm && <Settings ctx={ctx} />}

      <Btn
        title="Leave this Block"
        variant="danger"
        onPress={() =>
          confirm('Leave this Block?', 'Your Wave, Void and gauge here will be lost. Your character stays.', () =>
            attempt(async () => {
              await act('leave_block');
              router.replace('/home');
            }),
          )
        }
      />
    </View>
  );
}

function DmTools({ ctx }: { ctx: BlockCtx }) {
  const { members, act, block } = ctx;
  const [count, setCount] = useState(1);
  const [rollNote, setRollNote] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const [dWave, setDWave] = useState(0);
  const [dVoid, setDVoid] = useState(0);
  const [dGauge, setDGauge] = useState(0);
  const [reason, setReason] = useState('');

  return (
    <>
      <Card accent={colors.void}>
        <H2>You are the DM</H2>
        <Label>Roll for the world</Label>
        <Row style={{ justifyContent: 'space-between' }}>
          <Body muted>Number of d20</Body>
          <Stepper value={count} onChange={setCount} min={1} max={10} format={(n) => String(n)} />
        </Row>
        <Input value={rollNote} onChangeText={setRollNote} placeholder="What for? (optional)" />
        <Btn
          title={`Roll ${count}d20`}
          onPress={() =>
            attempt(async () => {
              await act('dm_roll', { p_count: count, p_note: rollNote });
              setRollNote('');
            })
          }
        />
      </Card>

      <Card accent={colors.void}>
        <Label>Adjust a player</Label>
        <Body muted style={{ fontSize: 13 }}>
          The rulebook doesn't yet say how Void is gained or how far the gauge moves — award it here.
        </Body>
        <Row style={{ flexWrap: 'wrap' }}>
          {members.map((m) => (
            <Chip key={m.user_id} label={m.character.name} selected={who === m.user_id} onPress={() => setWho(m.user_id)} />
          ))}
        </Row>
        {[
          ['Wave', dWave, setDWave],
          ['Void', dVoid, setDVoid],
          ['Gauge (+ toward Wave)', dGauge, setDGauge],
        ].map(([label, v, set]) => (
          <Row key={label as string} style={{ justifyContent: 'space-between' }}>
            <Body>{label as string}</Body>
            <Stepper value={v as number} onChange={set as (n: number) => void} min={-block.gauge_max * 2} max={20} />
          </Row>
        ))}
        <Input value={reason} onChangeText={setReason} placeholder="Reason (optional)" />
        <Btn
          title="Apply"
          variant="void"
          disabled={!who || (dWave === 0 && dVoid === 0 && dGauge === 0)}
          onPress={() =>
            attempt(async () => {
              await act('dm_adjust', { p_user: who, p_wave: dWave, p_void: dVoid, p_gauge: dGauge, p_reason: reason });
              setDWave(0);
              setDVoid(0);
              setDGauge(0);
              setReason('');
            })
          }
        />
      </Card>

      <Card accent={colors.void}>
        <Label>New in-game day</Label>
        <Body muted style={{ fontSize: 13 }}>
          Announces each character's mandatory incentive based on their side of the Line of Power.
        </Body>
        <Btn title="Begin a new day" variant="void" onPress={() => attempt(() => act('dm_new_day'))} />
      </Card>
    </>
  );
}

function Settings({ ctx }: { ctx: BlockCtx }) {
  const { block, act } = ctx;
  const [name, setName] = useState(block.name);
  const [description, setDescription] = useState(block.description);
  const [minutes, setMinutes] = useState(block.dm_turn_minutes);
  const [wave, setWave] = useState(block.starting_wave);
  const [voidAmt, setVoid] = useState(block.starting_void);
  const [gauge, setGauge] = useState(block.starting_gauge);
  const [gmax, setGmax] = useState(block.gauge_max);
  const plain = (n: number) => String(n);

  return (
    <Card>
      <Label>Block settings (starting DM)</Label>
      <Input label="Name" value={name} onChangeText={setName} />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Row style={{ justifyContent: 'space-between' }}>
        <Body>DM turn length (min)</Body>
        <Stepper value={minutes} onChange={setMinutes} min={1} max={120} format={plain} />
      </Row>
      <Label>House rules for new arrivals</Label>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body>Starting Wave</Body>
        <Stepper value={wave} onChange={setWave} min={0} max={20} format={plain} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body>Starting Void</Body>
        <Stepper value={voidAmt} onChange={setVoid} min={0} max={20} format={plain} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body>Starting gauge</Body>
        <Stepper value={gauge} onChange={setGauge} min={-gmax} max={gmax} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Body>Gauge range ±</Body>
        <Stepper value={gmax} onChange={setGmax} min={1} max={20} format={plain} />
      </Row>
      <Btn
        title="Save settings"
        disabled={!name.trim()}
        onPress={() =>
          attempt(() =>
            act('update_block_settings', {
              p_name: name,
              p_description: description,
              p_dm_turn_minutes: minutes,
              p_starting_wave: wave,
              p_starting_void: voidAmt,
              p_starting_gauge: gauge,
              p_gauge_max: gmax,
            }),
          )
        }
      />
    </Card>
  );
}
