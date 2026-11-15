import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Block, BlockEvent, BlockMember, QueueEntry } from '@/game/rules';
import { HEARTBEAT_MS } from '@/game/rules';
import { rpc, supabase } from '@/lib/supabase';

const EVENT_PAGE = 200;

/**
 * Live state of one Block. Sends a heartbeat every 15s while the app is in the
 * foreground (this is how the server knows who's online and advances the DM
 * Queue), and subscribes to new block_events over Realtime — every server-side
 * mutation writes one, so an event is our cue to refetch.
 */
export function useBlock(blockId: string) {
  const [block, setBlock] = useState<Block | null>(null);
  const [members, setMembers] = useState<BlockMember[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [events, setEvents] = useState<BlockEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadState = useCallback(async () => {
    const db = supabase();
    const [b, m, q] = await Promise.all([
      db.from('blocks').select('*').eq('id', blockId).maybeSingle(),
      db.from('block_members').select('*, character:characters(*)').eq('block_id', blockId).order('joined_at'),
      db.from('dm_queue').select('*').eq('block_id', blockId).order('joined_at'),
    ]);
    const err = b.error ?? m.error ?? q.error;
    if (err) {
      setError(err.message);
      return;
    }
    if (!b.data) {
      setError('This Block no longer exists, or you are not a member.');
      return;
    }
    setError(null);
    setBlock(b.data as Block);
    setMembers((m.data ?? []) as BlockMember[]);
    setQueue((q.data ?? []) as QueueEntry[]);
  }, [blockId]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase()
      .from('block_events')
      .select('*')
      .eq('block_id', blockId)
      .order('id', { ascending: false })
      .limit(EVENT_PAGE);
    setEvents(((data ?? []) as BlockEvent[]).reverse());
  }, [blockId]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      loadState().catch(() => {});
    }, 250);
  }, [loadState]);

  const heartbeat = useCallback(async () => {
    try {
      await rpc('heartbeat', { p_block: blockId });
    } catch {
      // Network blips are fine; the next beat will catch up.
    }
    await loadState().catch(() => {});
  }, [blockId, loadState]);

  // Initial load + heartbeat loop (paused while backgrounded).
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      heartbeat();
      if (!interval) interval = setInterval(heartbeat, HEARTBEAT_MS);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    Promise.all([loadState(), loadEvents()]).finally(() => setLoading(false));
    start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [heartbeat, loadEvents, loadState]);

  // Realtime: append new events and refetch state.
  useEffect(() => {
    const channel = supabase()
      .channel(`block:${blockId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'block_events', filter: `block_id=eq.${blockId}` },
        (payload) => {
          const ev = payload.new as BlockEvent;
          setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [...prev, ev].slice(-EVENT_PAGE)));
          scheduleRefetch();
        },
      )
      .subscribe((status) => {
        // If we (re)connected, we may have missed events.
        if (status === 'SUBSCRIBED') loadEvents().catch(() => {});
      });
    return () => {
      supabase().removeChannel(channel);
    };
  }, [blockId, loadEvents, scheduleRefetch]);

  /** Run an RPC, then refresh (Realtime will too, but this makes the UI snappy). */
  const act = useCallback(
    async <T>(fn: string, args: Record<string, unknown> = {}) => {
      const res = await rpc<T>(fn, { p_block: blockId, ...args });
      await Promise.all([loadState(), loadEvents()]);
      return res;
    },
    [blockId, loadEvents, loadState],
  );

  return { block, members, queue, events, error, loading, act, reload: loadState };
}
