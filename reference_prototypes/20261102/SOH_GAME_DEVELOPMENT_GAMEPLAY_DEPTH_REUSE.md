# Soul-of-Hero — Gameplay-depth donor audit: `soul-of-hero-game-development.zip` (2026-11-02)

**Creator-supplied original ZIP, bytes pinned, reference branch only. NOT production authority, NOT a Godot game, NOT merge-approved.**

- Source: `reference_prototypes/20261102/soul-of-hero-game-development.zip` on branch `references/gameplay-prototypes-20261102`.
- Original ZIP size **727,262 bytes**, SHA-256 `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`; Git blob SHA-1 `5a667c979a597d5d26e80453f7f16756db98f150`. Exact blob and size read back from Git tree.
- ZIP has 37 entries, 13 `it(...)` tests in `tests/soh.test.ts`, TS/Vite/React/Canvas pipeline, original procedural sprites, and an embedded older **829-line** `ref/bible.md`. Embedded Bible is *not* an authorization to override current [830-line canonical SOH contract](https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/CURRENT_PRODUCT_CONTRACT.md).
- **Inspection evidence:** source code read directly, tests enumerated and code paths traced; `IMPLEMENTATION_EVIDENCE.md` *claims* all 13 tests PASS and browser screenshots; those claims were **not independently run or accepted in this audit**.
- `THIRD_PARTY.md` claims original art/audio and lists fonts as SIL OFL, npm deps as MIT/Apache. Copyright/originality claims are author-provided: verify before any actual asset import; shipping implementation shall use SOH-approved A6/Gold assets.

## Core product insight — P1 is a free-form journey, not another collection of systems

Under the Bible, the player should enjoy a coreless life: depart home with a basic weapon, forage/harvest a finite physical source, evade an enemy, return with freight to a claim-owned home, run a paid workshop or research project, leave while time continues, return to physical output or a named blockage, and make another meaningful decision. Use *one* real native scenario before catalog expansion.

## Source paths, extraction and Godot translation

| Tier | Exact donor path/lines | What is real in the donor | Existing SOH owner / translation; never wholesale port |
|---|---|---|---|
| **P0 (immediate)** | `src/game/engine.ts:222–241`, `src/game/sim.ts:193–229`; `tests/soh.test.ts:36–54` | Source has depletion, material-specific harvest power; knife on rock fails; knife swing can hurt a boar; action has 3-phase timing | **A0×A3 PR31:** require 13-field A1 physical source receipt, real input/tool wear, real unique grants. Harvest/action must share trusted physical caller rather than new browser dispatcher. Never mint by passing arbitrary tx/ty to service |
| **P0 (immediate)** | `src/game/engine.ts:527–613`; `tests/soh.test.ts:78–98` | Paid queue fuel, output slots, research specimen→blueprint, rain/water gardens, offline work; output stops when fuel runs out | **A0/A3:** identify missing end-to-end action (not duplicate recipes). Same SaveService + RunLifecycle, 2PID restart, exactly-once output. Bounded real player journey harvest→queue→leave→return. UI clearly tells player *why* a job paused |
| **P1** | `src/game/engine.ts:545–576`; `tests/soh.test.ts:138–153` | Random/targeted Spares or destructive specimen study → queued research → physical blueprint in station output → learn once | **A3 recipe owner:** port only any missing custody/learning/queue invariant. No second catalog, no 'free' recipe unlock, no unauthorized item |
| **P1** | `src/game/sim.ts:466–491, 544–580`; `tests/soh.test.ts:78–98` | Hunger/thirst/cold/radiation/weather; offline effects accumulate chronologically, sheltered hunger does not kill alone | **A0 K8:** test real save/relaunch with native elapsed clock. DO NOT copy 60s `settle()` loop, blanket offline creature freezing, or unproven offline hostile raid. Preserve K8 336h and 72h Ragnarök |
| **P1** | `src/game/engine.ts:289–318,331–499`; `tests/soh.test.ts:56–77` | Claims, walls, doors, room, roof, chest/cargo and reclaim bags, preventing duplicate item custody | **A0 K6:** reuse law/proof as negative oracles; audit existing paid shelter/death bag. Do not adopt donor proposal's claim radius 6 / max 2 or replace A0 SaveService |
| **P2** | `src/game/sim.ts:135–190`, `src/game/engine.ts:395–420`; `src/game/balance.v1.json` | Cart as its own physical cargo container; roads/rough terrain/weight/water change movement | **K7 / A0+A1:** candidate for a measured end-to-end return trip with and without cart, after route/source authority works. Do not copy arbitrary 1.05/0.55/0.32 multipliers as canon; do not replace A1 Map |
| **P2** | `src/game/sim.ts:77–135, 492–530`; `src/game/world.ts` | Fire burns sources, storm ignites, frost Core freezes shallow water temporarily, changes traversability; weather affects gardens and visible trails | **K2/K5 + A1/AVFX:** one safely constrained real world reaction, source-controlled and durable; authority from native physics/terrain, not a painted overlay. Avoid handwaving Gold visual acceptance |
| **P2** | `src/game/world.ts`, `src/game/engine.ts:331–499`; `IMPLEMENTATION_EVIDENCE.md:C11` | Foundry keycard from Watchtower, lighthouse generator requires fuel; no quest gate | **A8/A0 authored POI:** check Bible legality and authored POI capability; if missing, prototype only a physical access loop, not a new storyline/map |
| **P3** | `src/game/sim.ts:260–405`, `src/game/catalog.ts:115–136` | Creature attack styles: charge/lunge/shoot/tongue/burrow; Elders have pattern/telegraph | **A0/AVFX/Gameplay:** only select behavior for an already-approved enemy; preserve C08 proven native sensing. No wholesale replacement of AI, no 6-boss promotion, no stealing Gold visuals |
| **P3 UX** | `src/ui/Title.tsx:14–82`, `src/game/render.ts`, `src/ui/Game.tsx` | Live map panorama title, character animation, contextual screen presentation and interaction feedback | **A6 separate owner**; needed to communicate consequences, not a mandate to restyle gameplay branch |

## Explicit donor defects and rejection gates

1. **Do not import its C08 AI.** `src/game/sim.ts:260–320` scans `r.traces` for every active creature and chooses newer nearby marks without a strict predecessor/successor identity. It can jump an unrelated trail. `tests/soh.test.ts:105–117` injects a trail directly into state, NOT native player movement. **LW1 PR34's Godot A/B/C native gate is stronger; preserve that source of truth.**
2. **Do not copy its offline AI policy.** `src/game/sim.ts:260–265` freezes creatures beyond 30 tiles; `settle():544–580` does not move creatures while offline. These are shortcuts; unapproved offline damage is equally prohibited.
3. **Do not use TS receipt dedup as production guarantee.** `engine.ts:319–326` stores only up to 400 recent intent IDs, trimming the oldest 100; a replay after eviction may pass. Real durable SOH authority must be exactly-once, run-scoped and reviewable.
4. **Do not port its TS save, map, art catalog, vendor/escrow prices or balance.** `engine.ts` directly mutates game state; browser IndexedDB is not A0's SaveService, nor is its 200×200 island A1's authored world. `balance.v1.json` contains `PROPOSED_MECHANISM` and `TUNABLE_BALANCE`.
5. **Do not use an apparently 'whole game' screenshot as proof that every gameplay system has a deep player loop.** 13 source tests and the author's claimed browser passes are not 2PID native Godot acceptance, nor long-term fun/UX validation.

## Highest-value next build — one joined native survival player journey

**Owner coordination: GP-B PR31 A0×A3 + A1/A8 physical source host, with LW1 C08 already green at `c7b1866b`.**
1. New Game → actual Adventurer body and valid spawn on currently authored Map.
2. Walk by real keys to authored stone/wood/scrap; bind the physical 13-field A1 source receipt; use actual tool, apply wear + finite source decrement + exactly-one inventory grant; reject harvest across map.
3. Return to real paid shelter, interact with real door/bed/container; store physical items without duplication.
4. At real furnace, spend actual inputs/fuel, queue work; walk away, save, relaunch separate OS process after bounded elapsed time, return physically and collect exactly once; if fuel missing, show actionable blocked state rather than rewarding output.
5. Add one optional real-world choice the user can notice (weather-to-trace / weight-to-route / research) **only if required seams exist**. Do not start new systems or steal A1/A6 ownership.
6. Real native 1280×720 capture OPENED and reviewed; test path/interaction feedback, readability and player agency. Do not accept `nonblack` alone.

**P1 native gate:** exact source identity + movement/input + inventory custody + paid home + online/offline production + second-PID output-once + negative counterfeit source/duplicate receipt, and visual review on the **same exact SHA**, with no owner regressions. Secondary tests for research/freight/world reaction only after P1 main path is green.

## Hand-off discipline

The original donor ZIP is in Git and can be obtained as:
```bash
git fetch origin references/gameplay-prototypes-20261102
git show 'origin/references/gameplay-prototypes-20261102:reference_prototypes/20261102/soul-of-hero-game-development.zip' > /tmp/soul-of-hero-game-development.zip
sha256sum /tmp/soul-of-hero-game-development.zip
unzip -t /tmp/soul-of-hero-game-development.zip
```
Expected SHA-256: `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403`.

**No existing owner branch modified. No Godot implementation performed here. No merge and no assertion of native P1 success.** Next agents must read canon 830-line Bible and this donor source; open Draft PR, checkpoints per work increment, exact SHA/CI/screenshot, Owner review, anti-limit handoff.