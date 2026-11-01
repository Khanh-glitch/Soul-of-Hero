# LW1 — C08 Source-Routed Overnight Implementation Order
**Date:** 2026-11-02 · **Owner:** NEW independent Arena Agent LW1 (not existing GP-B) · **Status:** READY FOR USER TO PASTE, NOT DISPATCHED/ACKNOWLEDGED · **Scope:** IMPLEMENT canonical C08, no new gameplay design, NO MAP WORK.

> This is the **ONE work order** for LW1. Earlier broad PR31 comments are historical/superseded. "Living Threat" is a descriptive working label only, NOT a new subsystem with independent product authority.

## 0. CRITICAL SOURCE DRIFT — resolve BEFORE writing code
There are **two different files named** `docs/survival/CURRENT_PRODUCT_CONTRACT.md` in live branches:
- **Canonical current expanded Bible:** https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/CURRENT_PRODUCT_CONTRACT.md — **830 lines**, verified at `a8c718b55130cff29b3adc5e7c531f9211ca22df`. This is the rule authority for this task. Read §0.2 L52–63, §0.3 L65–78, K2 L115–127, K5 L157–171, §11.3 C08–C10 L685–697, J10–J12 L245–252. Newer directly confirmed creator decisions outrank old docs.
- **GP-B code baseline:** https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/docs/survival/CURRENT_PRODUCT_CONTRACT.md — **77 lines**, an older condensed contract present on PR31. **DO NOT use it to supersede the 830-line Bible.** PR31 remains the code composition baseline and its tests are actual engineering evidence, not product-law authority.
- Read https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/AGENTS.md, `docs/survival/NEW_CHAT_BOOTSTRAP.md`, `EVERY_REPLY_HANDOFF_PROTOCOL.md` and `INDEPENDENT_DEEP_REVIEW_PROTOCOL.md` for process, then targeted `CONTROL_TOWER_CURRENT.md` / `CHAT_REENTRY_HANDOFF_CURRENT.md` newest entries for true owner state. Follow mandatory archived Atlas reading in bounded chunks as repo rules require; use SOURCE_COVERAGE_TRACE to navigate, **do not replace current SOH rules with historical PvP Last Day Rules**.

**Canon anchors (open FIRST):**
1. **D061**: https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/CURRENT_PRODUCT_CONTRACT.md#L54-L63 — normal monsters may find *home* ONLY after legitimately sensing a still-valid player trace; direct visible player combat is independent; no POI/home GPS, no forced offline raid.
2. **K2 / K5**: https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/CURRENT_PRODUCT_CONTRACT.md#L115-L127 and #L157-L171 — trace-surface/weather/time and lawful local actor perception, no teleport/breach without capability, same-run death bag.
3. **C08 / C09 / C10**: https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/CURRENT_PRODUCT_CONTRACT.md#L685-L697 — C08 is the one P0 deliverable; C09, C10 are preserved dependent contracts, NOT a license for a new offline-raid/loot system. J10–J12 are observation scenarios, NEVER quests.
4. **Live engineering baseline:** https://github.com/Khanh-glitch/Soul-of-Hero/pull/31 ; https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41325803720 — prior 62+29 actual-input furnace/offline/2PID checks on ANNEX, not C08. Do not rebuild this milestone.
5. **Atlas historical support:** https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md and `docs/survival/SOURCE_COVERAGE_TRACE.json`; Atlas covers historical survival/house/raids but is **not proof of C08 trace mechanics**. Check provenance and SOH's explicit removal of PvP raiding.
6. **Owner/acceptance:** https://github.com/Khanh-glitch/Soul-of-Hero/blob/a8c718b55130cff29b3adc5e7c531f9211ca22df/docs/survival/RESEARCH_LOG.md and `SOURCES.md` (external discovery and license), `INDEPENDENT_DEEP_REVIEW_PROTOCOL.md` (R0–R5), `AGENTS.md` (handoff). When authority conflicts, document both and use the latest creator-approved Bible, never quietly choose the older shorter copy.

## 1. PRIMARY technical source: USER-SUPPLIED PHÔI, not a Godot drop-in

Archive: **`soul-of-hero-game-prototype (1).zip`** (58 entries, SHA256 `120db2c8becd2e5b409f637897742923a11e2d3f83fb58f41372798b84528fe2`). This ZIP is attached in the creator's ChatGPT Project conversation; it is **NOT proven to exist in the GitHub repo or in a NEW Arena session**. Creator may attach it to LW1. If unavailable, use this extracted source analysis and report `ORIGINAL_ZIP_UNAVAILABLE_IN_ARENA`, not "source inspected". The archive's `REPOSITORY_RESEARCH_AND_REUSE.md`, `GODOT_TRANSFER_NOTES.md`, `third_party_manifest.json` and `licenses/THIRD_PARTY_LICENSES.txt` are source manifests and **self-reported**, not verification of runnable tests.

**Surgical read/port plan (line numbers from the exact ZIP):**

| Prototype source | Observed behavior to mine | SOH destination, adaptation and critical difference |
|---|---|---|
| `src/sim/types.ts:129-142` | `FootprintTrace`: identity, cell/world position, direction, `createdAtUtcSec`, `expiresAtUtcSec`, `surface`, `strength`, `prevTraceId` | Model **run-local trace evidence** only if absent in A0; no new SaveService/reducer |
| `src/sim/reducer.ts:2389-2424` | Footprints emitted after **real movement threshold**, surface + roof + rain lifetime, bounded trace array and linked previous ID | Adapt movement emission into existing Godot player/controller authority; use real A1 `cell_surface` if mounted; unknown surface/weather => named unavailable, not invented biome coefficients |
| `src/sim/ai.ts:279-294,340-379` | Physical LOS vs remembered last seen player position; direct chase handled independently | Existing `SkeletonEnemy._has_line_of_sight`, chase/physics are already present; do **not** replace existing combat/AI wholesale |
| `src/sim/ai.ts:381-475` | Creature senses nearby valid footprint, follows newer adjacent traces, loses route after expiry and returns to habitat | Port **behavior/negative checks**, not TS code. Only local genuine sensing, physically traversable sequential links, no GPS home |
| `src/sim/navigation.ts:88-99,127-199` | Blocking structure/light, `rot-js` shadowcasting + A* bounded path | `rot-js` is TypeScript; prefer existing SOH Godot traversability / physics; PR32 FOV is **NOT approved/dependency** |
| `src/sim/offline.ts:73-142,240-249` | Event-boundary time stepping and rain-pruning of footprints | Extract **expiry/chronology rule only**; must use A0 K8 clock; NO simulated attack or extra offline engine |
| `tests/contracts.test.ts:524-632` | C08 no-home-GPS and loss/nearby acquisition smoke oracle | **WEAK NEGATIVE:** inserts the test footprint directly at line 592; not actual player-input chain. Replace with true three-counterfactual Godot route test |

**Critical flaws NOT to copy from phôi:**
- AI loops over **all** live footprints per creature at `ai.ts:386` and `:419`; O(monsters × all traces), unsuitable for 1024×768. Use bounded spatial lookup and profile actual work.
- It chooses a "newer nearby trace" at `ai.ts:416-427` instead of following causal `prevTraceId` identity; a false jump can bridge unrelated runners/branches. Enforce run/source/connected link/allowed movement/time, reject cycles/ambiguous gaps.
- `tests/contracts.test.ts:592` manually inserts a trace and can pass without movement evidence; replace with a real-key journey and multiple paths.
- This web phôi has 192×192 island and TS/React/Canvas/idb, prototype balance + alternate persistence. **REJECT map/worldGen/art/AI engine/SaveService/health constants/score/loot** as drop-ins.
- `GODOT_TRANSFER_NOTES.md` suggests porting a new `CustodyLedger`/reducer to Godot; **REJECT for SOH** because A0 SaveService/Runtime already owns these. Treat the note as a hypothesis, not an order.
- Do not claim visual or native test acceptance from unverified report files/screenshots absent from delivered ZIP.

## 2. EXISTING SOH production source — REUSE first (code baseline fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1)

| Exact source link | What it already does / what LW1 may change |
|---|---|
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/characters/enemies/skeleton_enemy.gd#L101-L128 | Existing Skeleton physics/AI/action; inspect before proposing new states |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/characters/enemies/skeleton_enemy.gd#L366-L392 | Existing physics ray line-of-sight and target lookup; **direct observation != footprint observation**. Avoid new AI replacement |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/survival/a0_threat_mount.gd#L1-L120 | One bounded opt-in enemy, default OFF, safe placement, no loot/score; preserve anti-farm/custody |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/survival/optional_skeleton_encounter.gd#L90-L215 | Existing legitimate guarded combat/threat source, durable pre-spawn reservation; extend only via reviewable adapter |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/survival/survival_build_system.gd#L1-L85 | Existing real physical paid builds, collision/door/room; no new base model or Map redesign |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/survival/a0_world_authority.gd#L182-L251 | Existing A1 read-only `cell_surface()` and `cell_is_walkable()`; classify only mounted source; walkability isn't same as opacity |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/overworld/chapter1_overworld.gd#L1057-L1100 | Actual player world tick for minimal read-only movement event adapter; do not write Map or global sidecar |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/game/survival/survival_death_bag.gd | Preserve same-run unique bag + physical recovery |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/tests/survival_a0_production_threat_test.gd | Existing honest bounded encounter, 2PID/normal-input probes and no reward; **not yet a C08 trace test** |
| https://github.com/Khanh-glitch/Soul-of-Hero/blob/fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1/tests/survival_normal_home_journey_test.gd | Existing input-based paid home/build/depart/return path; reuse to avoid fake home fixture |

**Existing context:** GP-B/PR31 is a **branch/workstream**, not a verified Arena agent. The shorter Bible in that code checkout must not supersede latest canonical expanded Bible. A1 world ART remains creator-veto/unaccepted. Never edit `game/survival/world/**`, A1 Map, A8 POI or PR32 perception for LW1.

## 3. VERIFIED REPO OUTSIDE — selective adapters, not wholesale imports

Use `docs/survival/SOURCES.md` / `RESEARCH_LOG.md` as previous research, then research only the missing C08 algorithm/adapter with dated entries. Sources below were inspected at path level; reconfirm upstream pinned license at adoption and log results:

| Priority | Repo/source pinned snapshot | Actually useful | Decision for LW1 |
|---|---|---|---|
| 1 | **The FOG (Godot 4.7)**: https://github.com/furmonenko/the-fog/tree/9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7/scripts/ai | `bt_investigate_position.gd` clears **last known** position after arrival/timeout; `enemy_blackboard.gd` separates `last_known_pos`, target and lost time. Game's `bt_chase_target.gd` updates target's location while chasing, so must **gate it by actual perception** in SOH. Existing SOH Sources registry pins 9c5cb03a9d9f895cd9194bcfa1b3c4821da7c4e7. Code MIT; **art/images/refs all-rights-reserved**, addons separate licenses | **REFERENCE_ONLY**, optionally adapt state transition + explicit knowledge expiry. **Do NOT** install LimboAI or import enemies; no proof this repo implements C08 footprints |
| 2 | **Godot demo projects (MIT):** https://github.com/godotengine/godot-demo-projects/tree/b761b4cd5718a7118f2c95eb55f181d0a5f004f1/2d/navigation_astar and `/2d/navigation` | `pathfind_astar.gd`: AStarGrid2D grid region, cell solids, bounded tile path. `character.gd`: NavigationAgent2D target movement in `_physics_process` and `move_and_slide`. | **REFERENCE_ONLY / PORT_ADAPT** tiny path algorithm **only if** existing SOH navigation cannot already path a lawful local trace; do not bring demo scenes/tilemap |
| 3 | **rot-js 2.2.1 (BSD-3-Clause):** https://github.com/ondras/rot.js | Phôi's `PreciseShadowcasting` + `Path.AStar` algorithm source; useful to understand LOS/perception invariants, not to introduce JS runtime | **REFERENCE_ONLY**, do not import JS into Godot; PR32 visibility separate and held |
| 4 | **ASamBlur 2D steering demo (MIT):** https://github.com/ASamBlur/steering-behaviors-demo/tree/ea5182ba167f8668fa41efa4fa32c3e6f318385e/Steering/Component | 2D seek/follow path/avoidance sample; only optional if native steering is verifiably a gap | **REFERENCE_ONLY**, do NOT replace SOH Actor movement |
| Avoid | GDQuest steering framework was Godot 3-oriented; LimboAI extension is a separate plugin/engine dependency | Huge dependency cost for one footstep chain; The FOG depends on LimboAI but SOH does not | **REJECT AS NEW DEPENDENCY** for LW1 absent a separately demonstrated necessity |

**Official navigation doc:** https://docs.godotengine.org/en/4.7/tutorials/navigation/navigation_introduction_2d.html — AStarGrid2D vs NavigationServer2D differ. Check current SOH physical traversability first, then select minimal route type. Never let heuristic A* return a path through the actual collision layer; compare route with CharacterBody2D actual motion.

### Real reuse scorecard (fill with evidence before writing new code)
`component | current SOH source/behavior | phôi source + exact line | external source + commit/license | REUSE / ADAPT / REJECT | minimal delta | test`

No selection gets "ADOPT" solely because a README says it works. No third-party artwork/no bundled binary required; any copied code keeps correct license attribution and CI verification.

## 4. Bounded implementation sequence — not a new design phase

**P0-A: truthful trace generation**: one A0-owned source adapter from live player movement, bounded run-local footprint data; environmental timestamps using existing K8, actual surface via A1 if mounted. No map design, no new GDScript island, no fixed biome bonuses. Use `prevTraceId` chain safety idea and protect against run mismatches/eviction.

**P0-B: lawful creature sensing**: adapt existing Skeleton local-sensing/LOS behavior; detect ONLY physically local unexpired traces, maintain evidence handle, follow contiguous physically reachable links, search/return on loss; direct sight remains independent. Actual physics body/door blockers have authority.

**P0-C: three counterfactuals** on SAME actual scene with legitimate input:
- A **NO TRACE** to house; out of real direct sight; monster never targets house by GPS.
- B **VALID CHAIN** from player input; monster independently encounters trace and follows connected segments without teleport or target injection.
- C **BROKEN/EXPIRED CHAIN**; same route but lacks valid observation; loses target and does not jump to newest player/home location.
Game native has to show position/transitions, not just JSON state flags. Ensure fair option to evade/delay/retreat, no compulsory combat.

**P1**: run-local persistence and real second OS PID; idempotent restart, new run wipe, no phantom duplications. Preserve existing A0 save invariants and native GP31 furnace regression.

**P2**: if native proof allows, show real visible player feedback with decoded non-black PNG 720p/1x and small performance/streaming report. C09 offline consequences limited to **legally expired traces and existing clock**; do not fake house raids, damage, rewards, XP, loot, gun/core, new enemy AI species or weather.

## 5. Acceptance and operational constraints

1. **ACTUAL user action**: normal input creates traces, owned test scene/entity actually consumes them, moves physically; no injected traces except negative/unit tests clearly labelled. No fixture teleport, no manually set monster "home" target, no direct `take_damage` to pass outcome.
2. **Native Godot 4.7**: exact code SHA import, scripted negative tests, normal-input integration, same process and two distinct OS PID run/relaunch with logs. 0 parse/exit/test failures; do not weaken failing tests.
3. **Visual**: inspect actual decoded PNG at 1280×720, confirm nonblack scene/hero/monster/trace consequence; 640×360 legibility if possible; don't call map final or art accepted.
4. **System safety**: no A1 geography/assets/POIs changes, no A3 reward/catalog, no A6 art/UI overhaul, no AVFX Gold, no replacing A0 clock/save, no PR32 integration. Existing optional threat stays off by default until independent review.
5. **One change ledger**: `Bible clause -> SOH caller -> phôi algorithm source -> external repo insight -> in-game action -> receipt/save -> native negative -> visual proof`.
6. **No feature proliferation**: ONE vertical C08 causal slice; C09/C10 only regression. No new "living world" product contract.
7. **Handoff**: NEW Arena branch of LW1 (own pin or fresh feature), separate Draft PR compatible with GP31, no merge; exact HEAD, test jobs/screenshots, A/B/C video or screenshots + logs, performance, player choices, explicit missing input/API and A0 approval needs, **DOCS_SYNC_PENDING** if Docs tab04/12 not written/read back. User must paste the start prompt in Arena; this file alone does NOT dispatch/ACK an agent.

**First execution step:** checkout latest PR31 as a read-only base, independently fetch canonical `CURRENT_PRODUCT_CONTRACT.md` at a8c718b55130cff29b3adc5e7c531f9211ca22df, and produce a 10–20 line reuse ledger; immediately code P0-A and P0-B using available native environment, not another open-ended research report.
