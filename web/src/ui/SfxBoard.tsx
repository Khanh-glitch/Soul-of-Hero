// Sound slot board. Open the game address with "#sfx" at the end.
// Lists every slot of game/sfx/slots.ts with what fills it now (a file, a borrowed file, the synthesized stand-in,
// or nothing) and plays it on request. It is the place to check a delivered folder after it has been sorted in.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SFX_GROUPS, SFX_SLOTS, sfxFileName, type SfxSlot } from '../game/sfx/slots';
import { audition, bankCounts, initAudio, loadSfxIndex, onBankChange, slotStatus } from '../game/audio';

const LABEL: Record<string, string> = { file: 'có file', borrowed: 'mượn file', synth: 'tiếng tổng hợp', silent: 'im lặng' };
const TINT: Record<string, string> = { file: '#7ee08a', borrowed: '#e8d36a', synth: '#8ab4f0', silent: '#e07e7e' };
const MODE: Record<string, string> = { shot: 'một lần', loop: 'vòng lặp', bed: 'nền' };

export function SfxBoard() {
  const [, bump] = useState(0);
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState<'all' | 'file' | 'borrowed' | 'synth' | 'silent'>('all');
  const [prio, setPrio] = useState(0);
  const [find, setFind] = useState('');
  const [heard, setHeard] = useState<Record<string, string>>({});
  const waiting = useRef<string | null>(null);
  const say = (id: string, got: string) => setHeard(h => ({ ...h, [id]: got === 'file' ? 'đã phát file' : got === 'synth' ? 'đã phát tiếng tổng hợp' : got === 'loading' ? 'đang nạp file…' : 'không có gì để phát' }));
  useEffect(() => {
    const off = onBankChange(() => {
      bump(n => n + 1);
      const id = waiting.current; if (!id) return;
      const got = audition(id); if (got !== 'loading') waiting.current = null; say(id, got);
    });
    void loadSfxIndex(); return off;
  }, []);
  const start = () => { initAudio(); setReady(true); };
  const rows = useMemo(() => SFX_SLOTS.filter(s => (!prio || s.prio === prio) && (!find || s.id.includes(find.toLowerCase()))), [prio, find]);
  const counts = { file: 0, borrowed: 0, synth: 0, silent: 0 } as Record<string, number>;
  for (const s of SFX_SLOTS) counts[slotStatus(s.id)]++;
  const bank = bankCounts();
  const listen = (s: SfxSlot) => { start(); const got = audition(s.id); waiting.current = got === 'loading' ? s.id : null; say(s.id, got); };
  const chip = (on: boolean): React.CSSProperties => ({ padding: '4px 10px', borderRadius: 4, border: '1px solid #4a5560', background: on ? '#2f4a5c' : '#1a2026', color: '#e6edf2', cursor: 'pointer', font: 'inherit' });
  return <div data-sfx="off" style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#11161a', color: '#dfe7ec', font: '14px/1.45 system-ui, sans-serif', padding: '16px 20px', zIndex: 99999 }}>
    <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>Bảng slot âm thanh — Soul of Hero</h1>
    <p style={{ margin: '0 0 10px', color: '#9fb0bb' }}>
      {SFX_SLOTS.length} slot. Hiện có: {counts.file} có file · {counts.borrowed} mượn file · {counts.synth} tiếng tổng hợp · {counts.silent} im lặng.
      {' '}File đã nạp: {bank.ready}/{bank.files}{bank.failed ? ` · hỏng ${bank.failed}` : ''}.
      {!ready && <> <button style={chip(true)} onClick={start}>Bật âm thanh</button></>}
    </p>
    {bank.failures.length > 0 && <p style={{ color: TINT.silent, margin: '0 0 10px' }}>Không đọc được: {bank.failures.join(', ')}</p>}
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 12px', alignItems: 'center' }}>
      {(['all', 'file', 'borrowed', 'synth', 'silent'] as const).map(k => <button key={k} style={chip(show === k)} onClick={() => setShow(k)}>{k === 'all' ? 'Tất cả' : LABEL[k]}</button>)}
      <span style={{ width: 12 }} />
      {[0, 1, 2, 3].map(p => <button key={p} style={chip(prio === p)} onClick={() => setPrio(p)}>{p ? `P${p}` : 'Mọi mức'}</button>)}
      <input value={find} onChange={e => setFind(e.target.value)} placeholder="tìm theo tên slot" style={{ padding: '4px 8px', background: '#1a2026', color: '#e6edf2', border: '1px solid #4a5560', borderRadius: 4, font: 'inherit' }} />
    </div>
    {Object.keys(SFX_GROUPS).map(g => {
      const list = rows.filter(s => s.group === g && (show === 'all' || slotStatus(s.id) === show));
      if (!list.length) return null;
      return <section key={g} style={{ margin: '0 0 18px' }}>
        <h2 style={{ fontSize: 15, margin: '0 0 4px', color: '#f0d9a0' }}>{SFX_GROUPS[g].title} <span style={{ color: '#7d8c96', fontWeight: 400 }}>({g}/ · {list.length})</span></h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
          {list.map(s => { const st = slotStatus(s.id); return <tr key={s.id} style={{ borderTop: '1px solid #232b32' }}>
            <td style={{ padding: '3px 8px 3px 0', whiteSpace: 'nowrap' }}><button style={chip(false)} onClick={() => listen(s)}>Nghe</button></td>
            <td style={{ padding: '3px 8px', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }} title={sfxFileName(s.id, 1, 'ogg')}>{s.id}</td>
            <td style={{ padding: '3px 8px', whiteSpace: 'nowrap', color: TINT[st] }}>{LABEL[st]}</td>
            <td style={{ padding: '3px 8px', whiteSpace: 'nowrap', color: '#9fb0bb' }}>P{s.prio} · {MODE[s.mode]} · {s.n} bản · {s.len}</td>
            <td style={{ padding: '3px 8px' }}>{s.when} <span style={{ color: '#8d9ca6' }}>{s.sound}</span>{heard[s.id] && <em style={{ color: '#f0d9a0' }}> — {heard[s.id]}</em>}</td>
          </tr>; })}
        </tbody></table>
      </section>;
    })}
  </div>;
}
