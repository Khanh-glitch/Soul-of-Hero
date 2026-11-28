// Compare two census files written by `scn.js <seed> <hours> census <tag>`: node census-diff.mjs <base.json> <other.json>
import { readFileSync } from 'node:fs';
const [A, B] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')));
const keys = o => Object.keys(o).sort();
console.log('states      base', JSON.stringify(A.states), ' other', JSON.stringify(B.states));
let moved = 0, far = 0, stateDiff = 0, hung = 0, thirst = 0, hp = 0, maxHunger = 0, maxThirst = 0, n = 0, intentDiff = 0;
for (const id of keys(A.residents)) { const a = A.residents[id], b = B.residents[id]; if (!b) continue; n++;
  const d = Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) + (a.floor !== b.floor ? 1 : 0); if (d) moved++; if (d > 20) far++;
  if (a.state !== b.state) stateDiff++; if (a.intent !== b.intent) intentDiff++;
  const dh = Math.abs(a.hunger - b.hunger), dt = Math.abs(a.thirst - b.thirst); if (dh > 2) hung++; if (dt > 2) thirst++; maxHunger = Math.max(maxHunger, dh); maxThirst = Math.max(maxThirst, dt); if (Math.abs(a.hp - b.hp) > 1) hp++; }
console.log(`residents ${n}: different place ${moved} (more than 20 tiles apart ${far}); different state ${stateDiff}; different intent kind ${intentDiff}; hunger differs by >2: ${hung} (max ${maxHunger}); thirst differs by >2: ${thirst} (max ${maxThirst}); hp differs: ${hp}`);
const avg = (C, k) => { const v = Object.values(C.residents).filter(x => x.state !== 'DEAD').map(x => x[k]); return (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1); };
console.log(`average hunger ${avg(A, 'hunger')} / ${avg(B, 'hunger')}; thirst ${avg(A, 'thirst')} / ${avg(B, 'thirst')}; rest ${avg(A, 'rest')} / ${avg(B, 'rest')}; wounded ${Object.values(A.residents).filter(x => x.wounds).length} / ${Object.values(B.residents).filter(x => x.wounds).length}`);
for (const part of ['stores', 'carried', 'receiptKinds']) { const rows = [];
  for (const k of new Set([...keys(A[part]), ...keys(B[part])])) { const a = A[part][k] ?? 0, b = B[part][k] ?? 0; if (a !== b) rows.push([Math.abs(a - b), `${k} ${a}→${b}`]); }
  const total = o => Object.values(o).reduce((s, x) => s + x, 0);
  console.log(`${part}: total ${total(A[part])} / ${total(B[part])}; kinds differing ${rows.length} of ${new Set([...keys(A[part]), ...keys(B[part])]).size}; largest: ${rows.sort((x, y) => y[0] - x[0]).slice(0, 10).map(r => r[1]).join(', ')}`); }
console.log(`entities ${A.entities} / ${B.entities}; creatures ${A.creatures} / ${B.creatures}`);
const la = A.report?.lines ?? [], lb = B.report?.lines ?? []; console.log(`report lines ${la.length} / ${lb.length}; lines only in base ${la.filter(l => !lb.includes(l)).length}; only in other ${lb.filter(l => !la.includes(l)).length}`);
