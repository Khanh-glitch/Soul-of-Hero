import React from 'react';
import { ITEMS } from '../game/catalog';
import { getArt } from '../game/art';
import type { Stack, GameState } from '../game/core';
import type { Intent, Result } from '../game/engine';

let iconUrls: Record<string, string> | null = null;
export function iconUrl(key: string) { if (!iconUrls) { iconUrls = {}; const A = getArt(); for (const [k, c] of Object.entries(A.icon)) iconUrls[k] = c.toDataURL(); for (const [k, c] of Object.entries(A.st)) iconUrls['st:' + k] = c.toDataURL(); } return iconUrls[key] || ''; }
export function Icon({ k, size = 16, style }: { k: string; size?: number; style?: React.CSSProperties }) { return <img className="px" src={iconUrl(k)} width={size} height={size} style={{ width: size, height: size, ...style }} draggable={false} alt="" />; }

export interface Api {
  gs: GameState; now: () => number;
  act: (type: string, payload?: Record<string, any>) => Result;
  toast: (t: string, tone?: string) => void;
  open: (p: PanelState | null) => void; panel: PanelState | null;
  sel: { c: string; slot: number } | null; setSel: (s: { c: string; slot: number } | null) => void;
  setBuild: (t: string | null) => void; buildType: string | null; reclaim: boolean; setReclaim: (b: boolean) => void; repairMode: boolean; setRepairMode: (b: boolean) => void; setUpgradeMode: (b: boolean) => void;
  sfx: (t: string) => void; rerender: () => void;
}
export type PanelState = { kind: 'inv' | 'craft' | 'build' | 'map' | 'skills' | 'rest' | 'menu' | 'container' | 'vendor' | 'escrow' | 'evac' | 'report' | 'research' | 'notes' | 'journey'; eid?: string; recipe?: string; lines?: string[]; report?: import('../game/return-report').OfflineReturnV1 | null };
export const mkIntent = (type: string, p: Record<string, any> = {}): Intent => ({ id: `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, type, ...p });

export function Slot({ s, sel, active, onClick, onContext, hotkey, title, slotIndex }: { s: Stack | null; sel?: boolean; active?: boolean; onClick?: (e: React.MouseEvent) => void; onContext?: (e: React.MouseEvent) => void; hotkey?: string; title?: string; slotIndex?: number }) {
  const d = s ? ITEMS[s.key] : null;
  const depleted = s && ((d?.charge && (s.charge ?? 0) <= 0) || (d?.creatorCore && s.reserves && (s.reserves.basic + s.reserves.refined + s.reserves.signature) <= 0) || (s.dur === 0 && d?.repair));
  return <div className={`slot ${sel ? 'sel' : ''} ${active ? 'active' : ''} ${s ? 'filled' : 'empty'} ${depleted ? 'depleted' : ''}`}
    data-hotbar-slot={slotIndex}
    onMouseDown={e => { if (e.button === 0) onClick?.(e); }}
    onContextMenu={e => { e.preventDefault(); onContext?.(e); }}
    title={title ?? (d ? `${d.name}${s!.meta ? ' — ' + s!.meta : ''}${s!.qty > 1 ? ` ×${s!.qty}` : ''}` : hotkey ? `Quickbar ${hotkey} (empty)` : '')}>
    {hotkey && <span className="k">{hotkey}</span>}
    {active && <span className="slot__pip" aria-hidden="true" />}
    {s && <Icon k={s.key} size={18} style={{ position: 'absolute', left: 2, top: 2 }} />}
    {s && s.dur === 0 && d?.repair && <span className="q" style={{ color: '#ff7a6a' }}>!</span>}
    {s && s.qty > 1 && <span className="q">{s.qty}</span>}
    {s && d?.charge && s.charge !== undefined && <span className="q" style={{ color: s.charge ? '#9ae0ff' : '#ff7a6a' }}>{s.charge}⚡</span>}
    {s && d?.creatorCore && s.reserves && <span className="slot__res" aria-hidden="true">
      <i style={{ background: s.reserves.basic > 0 ? 'var(--paper)' : '#3a2222' }} />
      <i style={{ background: s.reserves.refined > 0 ? 'var(--info)' : '#3a2222' }} />
      <i style={{ background: s.reserves.signature > 0 ? 'var(--brassLit)' : '#3a2222' }} />
    </span>}
    {s && s.dur !== undefined && d?.dur && <span className="dur"><i style={{ width: `${(s.dur / d.dur) * 100}%`, background: s.dur / d.dur < 0.25 ? '#ff5a3a' : s.dur / d.dur < 0.5 ? '#e8b23c' : '#7aff6a' }} /></span>}
  </div>;
}
export function Panel({ title, children, style, onClose, className = '', testId }: { title: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; onClose?: () => void; className?: string; testId?: string }) {
  return <div className={`panel absolute fadein ${className}`} data-testid={testId} style={{ padding: 6, ...style }} onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}><div className="panel-h">{title}</div>{onClose && <button className="btn ghost" aria-label="Close panel" style={{ padding: '0 4px', fontSize: 11 }} onClick={onClose}>✕</button>}</div>
    {children}
  </div>;
}
export function Bar({ v, max, col, w = 70, label }: { v: number; max: number; col: string; w?: number; label?: string }) {
  return <div className="bar" style={{ width: w }} title={label}><i style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, background: `linear-gradient(${col}, ${col}cc)` }} /></div>;
}
export function Cost({ ins, have }: { ins: [string, number][]; have: (k: string) => number }) {
  return <span className="inline-flex flex-wrap gap-x-2">{ins.filter(([, q]) => q > 0).map(([k, q]) => <span key={k} title={`${ITEMS[k].name}: ${have(k)}/${q}`} className="inline-flex items-center gap-0.5" style={{ color: have(k) >= q ? '#bfe8a8' : '#ff8a7a' }}><Icon k={k} size={10} />{have(k)}/{q}</span>)}</span>;
}
