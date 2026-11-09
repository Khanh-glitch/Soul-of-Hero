# MEC-01 R8D — typed ore-quality source contract (base c397a0f)

## Source contract (replaces the R8C special case)
- Before: `harvestHit` had a hidden branch gated by `richIron:true` from `sim.ts`, and the iron source declared no rare yield.
- After: `SOURCES.iron.qualityBonus = { capability:'playerTool', power:'ore', tiers:[{minPower:5, item:'rich_iron_ore', chance:0.08}, {minPower:8, item:'rich_iron_ore', chance:0.12}] }`.
- `qualityTierFor(src, power, capability)` returns the highest reached tier only if the caller names the granted capability. Generic calls (no extraction) and `'environment'` (earthquake) get nothing.
- `validateGameplayCatalog` checks: capability and material match, distinct positive thresholds, item exists, 0 < chance < 1.
- One RNG draw per stock unit only when a tier is reached; stock debits, drops, receipts and save are unchanged.

## Rates and provenance
- Atlas v5 D03: one Action Base observation on an iron/sulfur node, 6/5/4 hits with stone/iron/refined axe, ~271–274 iron and ~2 rare. Scope and node HP unknown. Not copied.
- Hit counts (SOH, vein HP 24, stock 5, per swing): stone pick (ore 2) 12, iron pick (ore 5) 5, salvager (ore 8) 3.
  - Iron-class 5 matches Atlas's iron tier 5. Stone pick 12 vs Atlas stone axe 6: different tool (pick vs axe) and an unknown node, so no change. Salvager 3 vs refined axe 4: kept as a deliberate SOH upgrade. No powers were overwritten.
- Chances lowered 12%/20% → 8%/12% (SOH_PROVISIONAL). Reason: at 12%/20%, rich ore on the full map would add about +36%/+60% iron-equivalent to the 215-ore iron supply (rich ×3 eq). At 8%/12%: iron pick +24% (0.4 per 5-unit vein, ~17 rich on 43 veins), salvager +36% (0.6 per vein, ~26 rich).
- Cost side: each rich ore uses one coal in `refined_iron_rich` (14 s), the same coal per 2 refined as the common route (20 s after 30 s of smelting for three ore). Rich ore is therefore a 3:1 ore saving plus smelting time, not a free item.
- No exclusive part is added. Consumers remain the existing refined → metal pipe / iron plate chain.

## Player-visible cue
- `rich_iron_ore` icon `rich_ore`: dark violet ore with gold flecks, distinct from brown `iron_ore`. Sprite probe (4x) in `rich-ore-icon-probe.png`.
- Strike FX: the existing chip burst turns gold when a rich ore is produced (`rich:true`).
- Limit: the 6x probe tile was lost to a probe bug (same canvas appended twice). The 4x view is the inspected icon. The gold chip FX was not screenshot in the game.

## Tests
- `mec01-r8c-rich-iron.test.ts` (updated to the contract, 7 tests): tier boundaries (ore 4 → null, 2 → null, environment → null, rock → null); generic call with ore 8 → 0 rich; iron-pick conservation; stone-pick none; positive control; replay determinism; furnace refusal, 13 s negative, exact 1 rich + 1 coal, save validates.
- `mec01-industrial-graph.test.ts`: unchanged, passes.

## Gates
- tsc --noEmit: exit 0.
- Targeted r8c + industrial-graph: 18 passed, exit 0.
- Full Vitest --testTimeout=60000: 116 files passed / 1 skipped, 827 tests passed / 1 skipped, exit 0.
- Default build: exit 0, 1 file, 30,354,342 bytes.

## Remaining gaps
- No in-game screenshot of the gold chip FX or a rich-ore drop in the browser.
- No tool durability or per-hit output change for graded tools (durability is still 1 per successful swing).
- Refining throughput and furnace queue saturation with rich ore are not stress-tested.
- LI exact per-tier rare rates: unresolved (LEGACY-U03).
