import { useEffect, useRef, useState } from 'react';
import type { RunState, Receipt } from '../game/core';
import { ACHIEVEMENTS, PRIMORDIAL_ELDERS } from '../game/catalog';

/** Gold feedback ladder from PR #52, bound to committed R12 receipts (no engine writes).
 * Receipt sequence is the only trigger. On mount/restart historical receipts are baseline.
 */
export type GoldCue = { id: string; level: 2 | 3 | 4 | 5; title: string; detail: string };

const primordialName = (key: string) => {
  const e = PRIMORDIAL_ELDERS[key as keyof typeof PRIMORDIAL_ELDERS];
  return e?.name || key;
};

export function cueFromReceipt(rc: Receipt): GoldCue | null {
  switch (rc.kind) {
    case 'elder.defeat':
      return { id: rc.id, level: 5, title: primordialName(rc.detail) + ' FALLS',
        detail: 'The Elder has been defeated. Its stone must still be claimed in the world.' };
    case 'boss.defeat':
      return { id: rc.id, level: 4, title: 'REGIONAL GUARDIAN DEFEATED',
        detail: 'The encounter is over. Recover the physical reward if one was dropped.' };
    case 'achievement': {
      const a = ACHIEVEMENTS[rc.detail];
      if (!a) return null;
      const highest = ['ragnarok', 'six_stones', 'evacuated', 'elder_1'];
      return { id: rc.id, level: highest.includes(rc.detail) ? 5 : 3,
        title: a.name.toUpperCase(), detail: 'Achievement entered into this run’s local chronicle.' };
    }
    case 'core.commit':
      return { id: rc.id, level: 2, title: 'CREATOR CORE ACTIVATED', detail: 'A committed charge was spent.' };
    default:
      return null;
  }
}
const PRIO = (c: GoldCue) => c.level + (c.title.endsWith(' FALLS') ? 1.5 : 0);

export function GoldFeedback({ run, danger, hidden }: { run: RunState; danger: boolean; hidden: boolean }) {
  const previous = useRef<{ runId: string; seq: number }>({ runId: run.id, seq: run.seq });
  const [queue, setQueue] = useState<GoldCue[]>([]);
  const [active, setActive] = useState<GoldCue | null>(null);
  useEffect(() => {
    if (previous.current.runId !== run.id || run.seq < previous.current.seq) {
      previous.current = { runId: run.id, seq: run.seq };
      setQueue([]); setActive(null); return;
    }
    if (run.seq === previous.current.seq) return;
    const additions = run.receipts.filter(rc => rc.seq > previous.current.seq)
      .map(cueFromReceipt).filter((x): x is GoldCue => !!x);
    previous.current.seq = run.seq;
    if (!additions.length) return;
    // Highest-significance receipt wins one batch. No double cinematic for
    // elder.defeat followed by the correlated elder_1 achievement.
    additions.sort((a,b) => PRIO(b) - PRIO(a));
    setQueue(prev => [...prev.slice(-6), additions[0]]);
  }, [run.id, run.seq]);
  useEffect(() => {
    if (active || !queue.length) return;
    setActive(queue[0]); setQueue(q => q.slice(1));
  }, [active, queue]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(null), active.level === 5 ? 3600 : active.level === 4 ? 2500 : 1500);
    return () => window.clearTimeout(timer);
  }, [active?.id]);
  if (!active || hidden) return null;
  return <div className={'gold-feedback gold-feedback--l' + active.level + (danger ? ' gold-feedback--combat' : '')}
    role="status" aria-live={active.level >= 4 ? 'assertive' : 'polite'} aria-atomic="true" key={active.id}>
    <div className="gold-feedback__crest">✦</div>
    <div className="gold-feedback__copy"><div className="gold-feedback__eyebrow">{active.level === 5 ? 'THE CHRONICLE REMEMBERS' : active.level === 4 ? 'REGIONAL TRIUMPH' : active.level === 3 ? 'MILESTONE' : 'FIELD RECORD'}</div>
      <div className="gold-feedback__title">{active.title}</div>
      {!danger && <div className="gold-feedback__detail">{active.detail}</div>}
    </div>
  </div>;
}
