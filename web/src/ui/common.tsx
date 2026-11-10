import React from 'react';
import { ITEMS } from '../game/catalog';
import { getArt } from '../game/art';
import type { Stack, GameState } from '../game/core';
import type { Intent, Result } from '../game/engine';

// Explicit diagnostic glyph for a missing source icon (never an empty img src or a
// fabricated replacement asset). Exact Creator Gold image must still be sourced.
const MISSING_ICON_GLYPH = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"%3E%3Crect x="2" y="2" width="12" height="12" fill="%23131d26" stroke="%23c99753"/%3E%3Ctext x="8" y="12" text-anchor="middle" font-family="monospace" font-size="11" fill="%23eac88d"%3E%3F%3C/text%3E%3C/svg%3E';
let iconUrls: Record<string, string> | null = null;
export function iconUrl(key: string) { if (!iconUrls) { iconUrls = {}; const A = getArt(); for (const [k, c] of Object.entries(A.icon)) iconUrls[k] = c.toDataURL(); for (const [k, c] of Object.entries(A.st)) iconUrls['st:' + k] = c.toDataURL(); } return iconUrls[key] || MISSING_ICON_GLYPH; }
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
export type PanelState = { kind: 'inv' | 'craft' | 'build' | 'map' | 'skills' | 'rest' | 'menu' | 'container' | 'vendor' | 'escrow' | 'evac' | 'report' | 'research'; eid?: string; recipe?: string; lines?: string[]; report?: import('../game/return-report').OfflineReturnV1 | null };
export const mkIntent = (type: string, p: Record<string, any> = {}): Intent => ({ id: `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, type, ...p });

export function Slot({ s, sel, active, onClick, onContext, hotkey, title, slotIndex }: { s: Stack | null; sel?: boolean; active?: boolean; onClick?: (e: React.MouseEvent) => void; onContext?: (e: React.MouseEvent) => void; hotkey?: string; title?: string; slotIndex?: number }) {
  const d = s ? ITEMS[s.key] : null;
  return <div className={`slot ${sel ? 'sel' : ''} ${active ? 'active' : ''}`} onMouseDown={e => { if (e.button === 0) onClick?.(e); }} onContextMenu={e => { e.preventDefault(); onContext?.(e); }} title={title ?? (d ? `${d.name}${s!.meta ? ' — ' + s!.meta : ''}` : '')}>
    {hotkey && <span className="k">{hotkey}</span>}
    {s && <Icon k={s.key} style={{ position: 'absolute', left: 1, top: 1 }} />}
    {s && s.dur === 0 && d?.repair && <span className="q" style={{ color: '#ff7a6a' }}>!</span>}
    {s && s.qty > 1 && <span className="q">{s.qty}</span>}
    {s && d?.charge && s.charge !== undefined && <span className="q" style={{ color: s.charge ? '#9ae0ff' : '#ff7a6a' }}>{s.charge}⚡</span>}
    {s && s.dur !== undefined && d?.dur && <span className="dur"><i style={{ width: `${(s.dur / d.dur) * 100}%`, background: s.dur / d.dur < 0.25 ? '#ff5a3a' : '#7aff6a' }} /></span>}
  </div>;
}
export function Panel({ title, children, style, onClose, className = '' }: { title: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; onClose?: () => void; className?: string }) {
  return <div className={`panel absolute fadein ${className}`} style={{ padding: 6, ...style }} onMouseDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
    <div className="flex items-center justify-between" style={{ marginBottom: 4 }}><div className="panel-h">{title}</div>{onClose && <button className="btn ghost" style={{ padding: '0 4px', fontSize: 11 }} onClick={onClose}>✕</button>}</div>
    {children}
  </div>;
}
export function Bar({ v, max, col, w = 70, label }: { v: number; max: number; col: string; w?: number; label?: string }) {
  return <div className="bar" style={{ width: w }} title={label}><i style={{ width: `${Math.max(0, Math.min(1, v / max)) * 100}%`, background: `linear-gradient(${col}, ${col}cc)` }} /></div>;
}
export function Cost({ ins, have }: { ins: [string, number][]; have: (k: string) => number }) {
  return <span className="inline-flex flex-wrap gap-x-2">{ins.filter(([, q]) => q > 0).map(([k, q]) => <span key={k} title={`${ITEMS[k].name}: ${have(k)}/${q}`} className="inline-flex items-center gap-0.5" style={{ color: have(k) >= q ? '#bfe8a8' : '#ff8a7a' }}><Icon k={k} size={10} />{have(k)}/{q}</span>)}</span>;
}
