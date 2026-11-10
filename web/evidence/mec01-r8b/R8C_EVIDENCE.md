# MEC-01 R8C — high-grade iron ore → furnace → refined iron (base 51275d3)

## R8B visual closeout (real Chromium, probe build of art.ts; probe files removed)
- Before: `wall_plank` used the log-wall helper (`'wood'` kind, vertical grain), differing only in colour.
- After: `wall_plank` uses a new `'plank'` kind: horizontal boards, staggered butt joints, 16×24 silhouette, no vector anti-aliasing.
- Screenshot `wall-plank-vs-wall-wood-640x360-probe.png`: wall_wood (vertical logs) vs wall_plank (horizontal boards) readable side by side, plus wall_stone, wall_brick, icon `plank` and `wood`.
- Limit: this was the sprite sheet at 3x/4x, not an in-game placement screenshot; no natural play. Full 640×360 in-game placement still open.

## LI provenance (context only)
- Atlas v5 `LI_MASTER_RESEARCH_REPORT_v5.md` D03: one Action Base observation on an iron/sulfur node with 6/5/4 hits (stone/iron/refined axe), about 271–274 iron plus about 2 rare ore. Confidence: single observation, scope unknown.
- LEGACY-U03 (open): ore/wood per tool hit and "rare refined iron probability by tool tier" are unresolved.
- Not copied: 0.7% (2/272) would give about 1.5 rare ore on the whole map; SOH uses a tier-gated per-unit rate for a scale difference, recorded as SOH_PROVISIONAL.

## SOH implementation (SOH_PROVISIONAL)
- Source: iron vein (unchanged stock 5, `iron_ore` ×1 per unit, stone bonus 0.5). A player swing with an iron-class pick (ore power ≥ 5) may free `rich_iron_ore` ×1 per unit taken: 12% (iron pick, ore 5), 20% (salvager, ore 8). Stone pick (ore 2) gets nothing. Quake harvest does not use this.
- Process: `refined_iron_rich` = 1 `rich_iron_ore` + 1 `coal` → 2 `refined_iron_ingot`, furnace, 14 s, fuel as any furnace job.
- Common route unchanged: 1 ore → 1 ingot (10 s); 3 ingot + 1 coal → 2 refined (20 s).
- Ratio: 1 rich ore replaces 3 iron-ore units and 30 s of smelting for the same 2 refined ingots. Coal use is identical per 2 refined.
- Expected yield: iron pick 0.6 rich per 5-unit vein (43 veins ≈ 26 on map); salvager 1.0 per vein (≈ 43).
- Measured (8 seeds, same first iron vein, iron pick, 40 units): 6 rich / 40 units = 0.150 (design 0.12; sample small).

## Proof defect found and fixed
- Adding rich ore as a raw item without a value made `refined_iron_ingot` look cheaper via the rich route (ie 0 for rich ore) and the recycler proof reported `rich_iron_ore:+1` as minted.
- Fix: `industrial-proof.ts` declares `rich_iron_ore` an atom with 3 ingot-equivalents. `mec01-industrial-graph.test.ts` was NOT edited; its pinned expectation (`coal:+1` only) now holds.

## Tests (mec01-r8c-rich-iron.test.ts, 6 tests, real harvestHit and furnace craft)
1. Tier gating: ore 5 → 0.12; ore 8 → 0.20; ore 2 → 0 (negative).
2. Iron pick swings: rich ≤ units taken (conservation); stone-pick swings on iron: 0 rich.
3. Positive control: over 4 seeds, rich path produces >0 ore.
4. Replay determinism: same seed/swings → same count.
5. Furnace: no coal → refused, no job; with coal, one second early nothing; at 14 s two refined; exactly 1 rich + 1 coal consumed; save validates.
6. Ratio: rich route secs < common, and 3 ore + refined time > rich time.

## Gates
- tsc --noEmit: exit 0.
- Targeted (r8c + industrial-graph): 17 passed, exit 0.
- Full Vitest --testTimeout=60000: 116 files passed / 1 skipped; 826 tests passed / 1 skipped; exit 0.
- Default `npx vite build`: exit 0; 1 file; 30,353,316 bytes.

## Not done / remaining gaps
- Rich ore consumers are only the existing refined-iron chain (pipe, plate). No dedicated rich-only downstream part yet; the value is the 3:1 ore saving plus 30 s smelting.
- Drop, pickup, stack and weight of rich ore in a natural browser run: not inspected.
- Furnace output blocked/full-container case: covered by existing furnace logic, not re-tested here.
- Rate 12%/20% is SOH_PROVISIONAL; no LI per-tier number verified (LEGACY-U03 open).
- In-game 640×360 check of the plank wall and rich ore icon: still open.
