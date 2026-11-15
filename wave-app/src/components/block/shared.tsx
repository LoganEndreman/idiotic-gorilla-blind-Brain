import { useEffect, useState } from 'react';
import type { Block, BlockEvent, BlockMember, Challenge, QueueEntry } from '@/game/rules';

export type BlockCtx = {
  block: Block;
  members: BlockMember[];
  queue: QueueEntry[];
  /** Open challenges in this Block. */
  challenges: Challenge[];
  events: BlockEvent[];
  me: BlockMember;
  myId: string;
  isDm: boolean;
  isStartingDm: boolean;
  act: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<T>;
  nameOf: (userId: string | null | undefined) => string;
};

/** Re-renders every `ms` so countdowns and online dots stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function formatCountdown(msLeft: number) {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
