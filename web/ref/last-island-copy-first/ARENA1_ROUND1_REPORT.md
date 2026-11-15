# ARENA 1 — Final item registration, crafting & Veyra integration — round 1 report

> **SUPERSEDED for item and recipe facts (2026-11-15, recipe revision 6).** The one canonical document is [`ITEM_CRAFTING_MASTER.md`](ITEM_CRAFTING_MASTER.md) / `ITEM_CRAFTING_MASTER.json`. This file is kept as a historical record of its round; where the two differ, the master wins.

Authority: `FINAL_THREE_GROUP_ITEM_SET_20261115.json` (157 ids = A 78 / B 42 / C 37) and `web/ref/bible.md`.
Code authority: `web/src/game/final-item-set.ts` (roster + retirement) and `web/src/game/final-item-ledger.ts`
(recipe provenance, sources, status, visual briefs). Proof: `web/tests/final-item-set.test.ts` (21 tests).

## What "done" means here — read this first

| Status | Count | Meaning |
|---|---|---|
| **PLAYABLE** | **0** | Observed in the real browser build with player input. **Nothing was observed**: this sandbox has no browser (no Chromium, download hosts blocked), so no id may be called playable. |
| IMPLEMENTED_NOT_PROVEN | 143 | In the runtime. The 34 new ids are exercised by engine scenarios (real intents, fixture positions/stock); the other 109 are inherited and were not re-proven this round. |
| BLOCKED | 14 | Registered, deliberately not obtainable. Listed below with the reason. |

The production build compiles (`vite build`) and `tsc` is clean. That is a build fact, not a play fact.

## Registered

- All 157 roster ids resolve to a runtime row (156 items + `door_powered`, which is a structure with no item row).
- 34 new item ids: 31 Last Island imports + 3 named seeds (`seed_sunroot`, `seed_bitterleaf`, `seed_wildberry`).
- Every catalog id is in the roster, or ordered retired, or a legacy Elder stone — asserted, zero strays.

## Recipes (revision 4)

17 new formulas, 9 retired, 3 rewritten (`motorbike_kit`, `essence_nature`, `animal_feed`). Old definitions are frozen as
`<id>@3`, so a job queued before the cutover is still priced and paid under the formula it was queued with.

**No number here is claimed to be a verbatim Last Island number.** LI quantities are scaled by a declared unit rule
(wood/stone/iron ingot ÷25, refined iron/cloth ÷5, hide ÷10, components and food ×1) and every row is tagged
`LI_EXACT` / `LI_SCALED` / `SOH_ADJUSTED` / `SOH_ONLY` in `LI_RECIPE_LEDGER`; a test checks each tagged row against
`li_source_audit[].recipe`. Damage, armour %, craft seconds and food values are SOH trial values.

## Retirement — 7 of 19 are live, 12 are NOT

| Stage | Ids | Effect |
|---|---|---|
| LIVE (7) | `seed`→Sunroot Seed · `iron_sword`→Machete · `vehicle_drive`→2 Mechanical Gear · `root_broth`→Mushroom Soup · `herb_roast`→Roast Meat · `salted_meat`→2 Dried Meat · `fuel_briquette`→2 Charcoal | No live recipe, source, drop, structure cost or garden rule names them. Every mint path (`mkStack` / `addItem` / `spawnDrop`) resolves to the successor. |
| PENDING (12) | `salvaged_oil lubricant damaged_drive mechanical_parts fasteners treated_canvas field_repair_kit coal raw_salt scrap brick keycard` | **Still issued and still consumed.** Each has a written blocker in `ITEM_RETIREMENT`. They must not be reported as retired. |

Save migration (item set v2): stacks convert in place — same uid, same slot; durability carried as a fraction; count
multiplied where one successor is worth less, so food and fuel value never drops (asserted). A converted stack that
could not fit fails closed rather than being trimmed. Papers for a retired formula re-point to the successor formula.
A save stamped by a newer build is refused. The player gets a one-time receipt naming the exchanges.

A Machete inherits the Iron Sword's frozen recycler row minus anything a Machete does not contain (no leather).

## Veyra

- Sources placed in the 12 scenes: `evidence/arena1/veyra-source-survey.json` (per scene). Grass, bush and herb — the
  three seed sources — stand in every first-hour scene.
- New found materials: `tin_can` (roadside scrap 35 %, car wreck 20 %), `needle_tube` (scrap 10 %, Blood Archivist 40 %),
  `electronic_parts` (car wreck 15 %, `orc_1` 30 %, Scrap Crawler 50 %), `animal_fat` (boar 80 %, deer 60 %).
- Repair orders A/B/C: beetle (ash), crawler (toxic) and wolf (snow) were added to the engine's Veyra roaming table.
  **Not verified:** nobody has seen one spawn, and whether a player can reach those hazard biomes is unmeasured.
  `veyra05/ecosystem.ts` keeps its own habitat table, which was not edited.
- Authored loot tables (`world.ts`, `veyra05/arch/sites.ts`, airdrop options) still *name* `seed` / `iron_sword`; they are
  digest-pinned map data. The crate physically holds the successor. Left for the map owner to rename.

## BLOCKED (14)

| Id | Why |
|---|---|
| `iron_plate_pants`, `iron_plate_boots`, `refined_iron_legs`, `refined_iron_boots` | Equipment has three slots (head, body, back). No leg or foot slot exists to wear them in. |
| `wooden_ladder`, `steel_folding_ladder` | No climbing mechanic. |
| `large_furnace` | No station behaviour distinct from the Furnace. |
| `green_card`, `blue_card`, `purple_card` | No door on Veyra declares a card colour; the door contract is single-class. |
| `electric_resistor` | No consumer. |
| `door_powered` | Lock / electrical module contract undecided. |
| `crude_petroleum`, `deploy_oil_pump` | No oil site on any shipping map. |

## Known consequences worth a decision

1. **Sunroot has no starter meal.** Root Broth was the only always-known recipe that took Sunroot. It is still edible raw
   (22 hunger), and Root Stew takes it, but Stew is a learned formula.
2. **Raw Salt has no food use** now that Salted Roast is gone; it remains in Treated Canvas (itself pending retirement).
3. **Iron Plate / Refined Iron armour** stacks with existing body armour only through the two slots that exist
   (helmet + chest = 0.42 of a 0.60 cap).
4. **Icons:** all 34 new ids borrow another item's art key; all 24 packs share one. `ITEM_VISUAL_HANDOFF.json` lists
   every id with a physical brief for the new ones. No art was drawn.

## Tests

Full suite: 1189 tests, 1004 pass, 179 fail. The pre-change tree: 1168 tests, 983 pass, 179 fail. The 179 are the same
inherited failures (one renamed: the salt-shale chain test, which fails at its campfire build step before and after — so
my edits to the lines after that step are unexercised). No new failure; 21 new passing tests.

Suites that named retired ids were migrated to the final set rather than deleted; each change carries a comment saying
what the final set changed.
