# ARENA 1 — ROUND 2 REPORT

> **SUPERSEDED for item and recipe facts (2026-11-15, recipe revision 6).** The one canonical document is [`ITEM_CRAFTING_MASTER.md`](ITEM_CRAFTING_MASTER.md) / `ITEM_CRAFTING_MASTER.json`. This file is kept as a historical record of its round; where the two differ, the master wins.

Branch `arena/f7f5cf36-soul-of-hero`, Draft PR #61. Not merged. No `BUILD READY` / `PLAYABLE` claim is made.

## 1. Status in one paragraph

The 19 retired items are gone from live play, 11 of the 14 round-1 BLOCKED items now work in the engine, and a bot
playing a real New Game on Veyra (seed 7) closes the whole oil chain and three more round-2 items in 50 game-minutes.
What is still open: access cards have no source, no browser play-through was done, the `/25 /5 /10` scaling was not
re-examined, and only one seed has an industrial route proof.

## 2. What "proven" means here

Evidence is an engine bot (`tests/helpers/newgame-bot.ts`), not a person in a browser.

- It moves with movement input, swings with attack input, and does everything else through the intents the UI sends.
- It is never given an item, station, recipe or position.
- It reads the world's source map, so it knows where every node is. **Its times are lower bounds, not pacing.**
- One disclosed shortcut: the hotbar slot is set directly, as the number keys do.
- Nothing is rendered. HUD, prompts, icons and readability are **not** checked.

Evidence file: `web/evidence/arena1/round2-newgame-routes.json`. Test: `web/tests/arena1-round2-newgame-routes.test.ts`.

## 3. Route OIL — seed 7, from spawn

| Game-minute | Stage | Result |
|---|---|---|
| 0.4 | Walk 77 tiles to the nearest crude seep (5 in the start window, stock 60) | PROVEN |
| 1.8 | Campfire, Stone Pickaxe, Stone Axe, Furnace | PROVEN |
| 9.2 | 22 Iron Ingots | PROVEN |
| 11.1 | 35 Parts from roadside scrap and wrecks | PROVEN |
| 13.5 | Research Table, directed study of Glass (9 Parts, 45 s) | PROVEN |
| 16.5 | 4 Glass, Charcoal, 4 Refined Iron | PROVEN |
| 16.7 | Workbench level 2 beside the seep | PROVEN |
| 17.6 | Mechanical Gear, Metal Pipe, Oil Pump placed on the seep (refused on any other tile) | PROVEN |
| 19.0 | 6 Crude Petroleum, 12 s each, seep stock 60 → 54 | PROVEN |
| 19.8 | Refinery → 2 Fuel Canisters (3 Crude + 1 Glass each) | PROVEN |
| 20.6 | Electric Resistor from a wreck (3 carried) | PROVEN |
| 25.4 | Wooden Ladder: studied, crafted, leaned on a one-tile cliff, crossed on foot | PROVEN |
| 39.9 | Large Furnace: studied, crafted, placed; smelts an ingot in 5 s against 10 s | PROVEN |
| 50.4 | Iron Plate Pants: studied, hide hunted, sewn, worn in the legs slot | PROVEN |

End of run: 96 hp, 147 damage taken, 6 drinks, 12 berries eaten, 3 tool repairs, 1 stone tool remade, 26 stacks put in
two Wood Chests.

## 4. Route FOOD — one game-hour from spawn, no retired food

| Seed | Survived | Ate | Time on food + water | Lowest hp |
|---|---|---|---|---|
| 7 | 60 min | 3 berries, 9 Grilled Marsh Cap | 4.9 % | **15** |
| 11 | 60 min | 16 berries | 0.4 % | 67 |
| 23 | 60 min | 16 berries | 0.4 % | 100 |

Hunger never fell below 60 and thirst never below 55 on any seed. Root Broth, Herb Roast and Salted Roast are not needed
to stay fed in the first hour. The seed-7 low of 15 hp came from fights (91 damage), not hunger — that is a combat
risk, not a food gap, and it is not resolved.

## 5. Changed this stretch (since commit `84eb4068`)

- **Large Furnace and Steel Folding Ladder are now tier 2** (were tier 3). Tier-3 formulas cannot be studied directly
  at a Research Table, so they could only appear by random tinkering. This is a balance decision made by me; say if
  you want it reverted. The four refined-iron armour pieces are still tier 3 and have the same problem.
- Test fix: `pa1-recipe-migration` now checks the live recycler rules (gear-v2, blade-v2, pipe-v3, plate-v1).
- Bot and route tests extended; evidence regenerated.

## 6. Findings from the routes (not fixed)

1. **Large Furnace bill weighs 59.2 kg; carry limit is 60 kg.** The 36 stone alone is 43.2 kg. A player must leave
   every tool in a chest to carry the bill to the bench. The bot did exactly that.
2. **Stone tools last about half an hour of this route** (durability 180; knife 300). There is no Survival Knife
   recipe. A player whose knife, axe and pick all break away from a Workbench can only cut plants by hand.
3. **A neighbouring node can absorb the swing.** The swing hits the nearest source in the arc, so an iron node next to
   a tree takes no damage from a pick on that side. Stepping to another side fixed 4 such nodes on this route. A person
   will read this as "the pick does nothing".
4. **No wolf, crawler or beetle spawned** on seeds 7, 11, 23. `beetle_horn`, `chitin`, `chitin_armor`, `crawler_optic`,
   `wolf_fang` and `core_demon` remain unreachable on Veyra.
5. Seed 11 has no iron in the start window; seed 23's nearest iron is 189 tiles away. The industrial route was only
   run on seed 7.

## 7. Item status after round 2

| Group | Count | Notes |
|---|---|---|
| Unblocked in code this round | 11 | `iron_plate_pants`, `iron_plate_boots`, `refined_iron_legs`, `refined_iron_boots`, `wooden_ladder`, `steel_folding_ladder`, `large_furnace`, `electric_resistor`, `door_powered`, `crude_petroleum`, `deploy_oil_pump` |
| …of those, closed from a New Game by the bot | 6 | `crude_petroleum`, `deploy_oil_pump`, `electric_resistor`, `wooden_ladder`, `large_furnace`, `iron_plate_pants` |
| …implemented, mechanics-tested, no New-Game route yet | 5 | `iron_plate_boots`, `refined_iron_legs`, `refined_iron_boots`, `steel_folding_ladder`, `door_powered` |
| Still BLOCKED | 3 | `green_card`, `blue_card`, `purple_card` — no source; adding card doors on Veyra breaks the pinned map digest |
| PLAYABLE (browser-verified) | 0 | No browser session was run |

## 8. Tests

- Round-1 head: 1189 tests, 179 failing (inherited).
- Full run D (round-2 code, before the last route commits): 1202 tests, 179 failing, **3 new against baseline** —
  one real (fixed, see §5), two are artefacts of running from a snapshot directory (no `.github/`, no git SHA).
- A further full run on the final tree was started; its result is appended in the PR body, not here.
- The 179 inherited failures are listed, not root-caused: `web/evidence/arena1/round2-inherited-failures.json`.
  Largest clusters by message: "Need an intact packed device." (≈ 50), `expected false to be true` (49),
  `{ ok: false }` where `{ ok: true }` expected (35). 44 files; the top five are `mec01-r12-departure` 18,
  `rest-supply` 14, `b02-ir-sensor` 12, `home-production` 12, `s06-circuits` 11.
- `npx tsc --noEmit -p .` is clean.

## 9. Not done

- **Browser check at 640×360 / QA pack with build SHA** — not done. `ITEM_VISUAL_HANDOFF.json` was not updated this round.
- **`/25 /5 /10` scaling** — not re-examined; values stay `SOH_PROVISIONAL`.
- **Root-cause triage of the 179 inherited failures** — only listed and clustered.
- **Negative tests** for retired ids exist in `arena1-round2-mechanics` and `final-item-set`; no new ones were added this stretch.
- Step-2 leftovers: oil seep has no minimap marker or prompt; bikes are not stopped by a ladder tile in
  `motorbike.ts`; ladder build ghost/direction UI; Large Furnace code paths keyed on `type === 'furnace'`; legs/feet
  slots in `qa-sandbox.ts`, `avatar-presentation.ts`, `index.css`; stale `damaged_drive` / `recover_drive` references;
  stale doc `docs/design/VEYRA_WORLD_SOURCE_REPAIR_ORDER_2026-11-14.md` §5/§6.
- Routes for boots, refined legs/boots, Steel Folding Ladder, Powered Door; industrial route on a second seed.

## 10. Decisions needed

1. Keep Large Furnace and Steel Folding Ladder at tier 2, or keep tier 3 and add a blueprint source?
2. Refined-iron armour (4 pieces, tier 3): same question.
3. Access cards: accept a map-digest change to add card doors and a card source, or retire the three cards?
4. Large Furnace bill at 59.2 kg of a 60 kg limit: intended, or cut the stone?
