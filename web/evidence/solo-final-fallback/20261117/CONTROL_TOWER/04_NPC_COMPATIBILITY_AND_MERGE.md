# 04 — ONE FOUNDATION, TWO SHIP TARGETS, NO DESTRUCTIVE BRANCH COUPLING
**Two independent branches from same e939 pre-NPC ancestor.** At planning time NPC is 67 commits ahead of e939 and has modified common web/src/game/engine.ts, sim.ts, persist.ts, core.ts, render.ts, web/src/ui/Game.tsx, web/src/veyra05/window.ts. The NPC branch also adds humanworld.ts, human-jobs.ts, human-navigation.ts, npc-art.ts, HumanPanel.tsx and tests. It is WRONG to assume final cherry-pick/merge of the entire solo branch will be conflict-free.
Never delete NPC code by overwriting a shared file with its older solo version. Never add authoritative no-NPC guard to canonical save/schema. Never remove approved human item sources. Never merge, rebase or force-push the other agent's work without Creator/explicit integration authority.

## A. Decide patch portability BEFORE implementation
Categorize each solo production change:
(1) SAFE_COMMON: pure utility, item-asset/UI optimization, typed recipe validation, generic source/UID function, container atomicity with isolated callers. Must still validate on latest NPC branch.
(2) SHARED_HOTSPOT: engine.ts dispatch/startRun/world entity, sim.ts advanceWorld/tick, persist.ts migration, core.ts RunState, Game.tsx controls, Veyra window geometry; MUST isolate logical behavior and plan adaptation rather than blind full-file merge.
(3) SOLO_PRESENTATION: UI/flow with no human screens, may need a conditional projection in NPC build; do not fake NPC not existing.
(4) NATIVE_SPECIFIC: Godot-only scene/script must be tested under native independently and related bridge documented.
(5) PRODUCT_SCOPE_EXCLUSIVE: no-NPC marketing/story/ending assumptions, must not port into full THE LAST HUMANITY; explicit Creator scope authorization required.
Annotate classification + exact files/functions, old/new semantics, test and intended port in ledger with every source commit.

## B. Common data authority and API requirements
- Item/source identity: preserve item keys including 157 final design/retired migrations, canonical source IDs and G1B manifest; no duplicate run economy. Do not privately mint a “solo-only” stock if NPC should later share it.
- Core/wear/energy: shared physical UID, anti-duplicate, approved Gold action and current G1B V2 semantics; avoid old-magazine assumptions from historical v10/v11.
- Run state/persistence: existing SAVE_VERSION=3 at e939, persistent G1B layout rev4 and legacy migration. Version changes must be explicit; migrations must work for New Game, old nonNPC saves and humanWorld-aware saves when integrated. Do not globally reject unknown approved human fields or strip them during roundtrip. Prefer additive optional fields/typed external read model, with versioned validators when truly necessary. A human world may be absent in solo and present in NPC branch without changing clock or source rights.
- Clock: same authoritative real-hour K8 run time and event sequencing; do not add new solo world clock that HumanWorld cannot consume. Distinguish fictional day/night from 336 real hours.
- World topology: source geometry, floors, doors, terrain overlays, POI source and collision use existing Map authority; no two different nav/roof collision rules. Read-only canonical geometry helpers may be selectively ported to NPC without using that branch's heavy remote planner inside solo.
- Rendering: preserve one native 640×360 pixel style and Gold asset provenance; optimized item atlas must remain usable by NPC inventory, trade and world sprites. No global render toggles left permanently off.
- Backend/score: local/unverified histories and truly verified online records must not be conflated in either branch.

## C. Anti-drift continuous merge surveillance
At meaningful integration checkpoints (not on every test):
1. Fetch actual current NPC HEAD and diff against shared ancestor e939, compare solo HEAD changes. Update function-level overlap map for engine/sim/persist/core/render/Game/window, the catalog, item atlas, VFX and native assets.
2. For a SAFE_COMMON isolated commit, create an integration-adapter patch proposal/dry run against an ephemeral worktree based on NPC HEAD. Do not push into NPC branch. Record exact conflicts, interface adjustments, tests and behavior not yet proven.
3. For SHARED_HOTSPOT, compare intended behavioral diff against NPC's updated implementation and integrate intent to a shared helper / clear authoritative seam. Do not mechanically take solo entire function or discard NPC side effects. A verified fix may require translating source code, not cherry-picking.
4. When same behavior has already been independently fixed on NPC branch, mark DUPLICATE_WITH_EQUIVALENT_SEMANTICS, not another feature to import; validate equivalence and dependencies.
5. Preserve separate reversible commits and compile/test evidence so a subset can port even if later solo-only release changes cannot.
6. Avoid importing NPC-only long-running scheduler as a dependency merely for a solo fix. Maintain accurate clock/UID contracts so future parallel event settlement remains compatible.

## D. Independent integration certification; no unapproved merge
Build temporary integration candidate at a disposable branch/worktree from CURRENT NPC HEAD, applying only selected common-safe commits/source changes. No production branch mutation.
Success criteria:
- All 738 G1B source identities and migration chains preserved, no doubling or reroll through separate process.
- Existing HumanWorld save/actor/custody/needs/navigation intact, no double work or disappearance.
- No PLAYER_EXPLORATION cache autonomous debit from new common source API.
- Same K1–K8 + Core/recipe/Gold/world semantics across standalone and NPC build.
- Solo natural source accessibility and NPC occupation/shelter offscreen remain unchanged or improved; 336h/economy correctness does not regress.
- Same Web visual fidelity and measured FPS/memory impact at representative item/inventory and populated settlement scenes.
- Conflicts explicitly classified, incremental integration positive + blocked/save tests pass. If current NPC feature remains PARTIAL, label candidate PROVISIONAL_INTEGRATION, not FULL.
Only once NPC project completes and Creator/integration authority approves may approved port commits merge into NPC branch. Never force it. Preserve source provenance.
Conversely, if NPC stalls, solo may advance to its own reviewed release candidate. It is not “The Last Humanity fully implemented” without human scope change.

## E. Handoff artifact required from solo agent
Maintain a PORTING_MANIFEST with one row per meaningful production commit: solo SHA, ancestor, purpose, canonical edges, changed modules and functions, direct vs shared hotspot, dependent commits/fixtures, migration effect, NPC HEAD last compared, patch-port/dry-run status, conflicts and resolution recipe, expected behavior and regression test. Do not claim merge-ready simply because git merge-base exists. Include exact file/revision and separate release candidate evidence. If actual NPC branch not accessible at later session, mark NOT_RECHECKED and don't assert compatibility.

## F. No unnecessary architectural duplication
Shared foundation improvements should be NPC-neutral, but do not add hypothetical abstraction layers just to satisfy future integration. If a helper lacks existing consumer or demonstrable benefit, prioritize real playable functionality. Do not permanently freeze foundational work because the other branch changes common code. Implement cleanly; prepare isolated port rather than ship stale code or overwrite newer semantics.