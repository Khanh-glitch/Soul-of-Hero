# MEC-01 R2 handoff — factory-produced motorbike, real cargo delivery, proven source ecology, funded offline return, bounded industrial proof

**2026-11-08. Response to CONTROL TOWER "MEC-01 R2 A2 INDEPENDENT REVIEW & NEXT EXECUTION ORDER" (verdict: A2 CODE PARTIAL ACCEPT; R2 CONTINUES; NO MERGE).**
**Status: C1, C2, C3, B and D are materially closed with labelled fixtures and an itemized blocker list. PR #44 remains OPEN / DRAFT / UNMERGED. Do not merge on the strength of this document.**

Session branch: `arena/a9d7aa20-soul-of-hero`. PR branch: `arena/d4bfcfff-soul-of-hero` (the only branch pushed; `git push origin HEAD:arena/d4bfcfff-soul-of-hero`). Base: `arena/4795760e-soul-of-hero`. PR #44 head before this handoff's commit: `2a4db2a62a78a874df3931f4856fe2fe7cc7c1e8`; exact SHA after push is reported in the PR discussion and by `git rev-parse HEAD`.

## What is on the table

| Phase | Claim | Evidence | Status |
|---|---|---|---|
| A1 (prior) | Found Mechanical Gear → Recycler (`X:gear-v1`, recyclerV4) | `web/tests/mec01-industrial-graph.test.ts`, benchmark | fixture-only economics; not a balance win |
| A2 (prior) | Pipe v2 (refined+MP) / Blade v1 (2 ingot+MP), version-pinned component rules, `NO_RECOVERY_ROUTE` vs `UNPROVEN` | `web/tests/mec01-a2-pipe-blade.test.ts` | implemented; reviewer kept as PARTIAL ACCEPT |
| C1 | **C1 PAID CHAIN**: authorized factory crate → furnace → Workbench L2 → paid Workbench **L3** → research → `motorbike_kit` → `placeMotorbike` → `vehicleRefuel` → `vehicleMount` → physical scrap cargo in bike → save/reload UID check | `web/evidence/mec01-c1/motorbike-chain.json` | delivered (fixtures labelled; not NATURAL_INPUT) |
| C2 | **REAL same-cargo source→destination** haul: authorized factory exterior toolbox crate → real road route on `shipping_fresh` → player-built depot chest; walk / cart / motorbike, UIDs and qty constant | `web/evidence/mec01-c2/delivery.json` | delivered (SIM_FIXTURE_MEASUREMENT; not human input) |
| C3 | **Funded production + genuine offline return** in a **separate OS process**: furnace+workbench fed, jobs queued, 5 s elapsed, save, child process resumes the save, +5 min simulated clock, outputs retrieved with real moves | `web/evidence/mec01-c3/offline-resume.json` (+ `tests/mec01-c3-offline-child.test.ts`) | delivered (separate-process proof; see validator note) |
| B | **Physical source ecology of the authorized Shipping sources**, affecting real consumer choices | `web/evidence/mec01-b/consumer-choice.json` | delivered |
| D | **Bounded economy + environment verification**: B05 eligibility, finite-vs-renewable stock, integer batch routes, ORIGINAL_UNKNOWN discipline | `web/reports/mec01-five-chain-benchmark.{json,md}`, `web/evidence/mec01-d/verification.json` | delivered except the browser run (BLOCKED) |

## Verification matrix (real commands, real outputs)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | PASS, no errors (13.6 s) |
| `npx vitest run tests/mec01-five-chain-benchmark.test.ts` | PASS 1/1 (1202 ms) |
| `npm test` (= `vitest run --testTimeout=120000`) | **99 files passed \| 1 skipped (100); 721 tests passed \| 1 skipped (722); 440.83 s**. Effective timeout is the project's 120000 ms, not the vitest default. The 1 skip is the C3 child test invoked without an on-disk save (by design); the child runs green under its parent test. |
| `npx vitest run tests/mec01-c1-motorbike-chain.test.ts` → 2/2; `…c2-delivery.test.ts` → 5/5; `…c3-offline-resume.test.ts` → 1/1 (spawns the child); `…b-consumer-choice.test.ts` → 8/8 | all PASS (this session) |
| `npx vite build --config vite.http.config.ts` | PASS in 6.49 s → `dist-http/` (23 MB, 71 assets; entry `index-*.js` 3.86 MB min; chunk-size warning only). **The single-file build's exit 137 OOM is NOT inherited by the HTTP artifact.** |
| `python3 -m http.server 41730 --bind 0.0.0.0 --directory dist-http` + curl | `GET /` → 200 (397 B; references hashed assets); entry JS → 200 `text/javascript` (3,858,603 B); css → 200; `GET /game` → 404 (static server has no SPA fallback; HTTP artifact is rooted at `/`); server left running as a live preview of the artifact |
| Single-file build (`npm run build` / `vite build`) | **NOT run this round** — known independent packaging blocker (exit 137 OOM). HTTP build is the verified artifact; single-file status is unchanged, not claimed. |
| Browser run of the HTTP artifact | **BLOCKED** — no chromium/chrome/firefox on PATH; playwright 1.55.1 browser download is outside the sandbox egress allowlist (`npx playwright install chromium` → `ECONNRESET` from cdn.playwright.dev). **640×360 and 1280×720 captures are outstanding** and must come from a Game-capable runner. They were not fabricated. |

## C1 — what the chain actually costs (seed 4242, `shipping_fresh`, fixtures labelled)

Route (real actions, one taken stack end to end; timing is SIM_FIXTURE_MEASUREMENT via `stepStations` with catalog recipe times):
factory toolbox crate → furnace build → Workbench L2 → paid Workbench **L3** → targeted research → `motorbike_kit` → `placeMotorbike` → `vehicleRefuel` → `vehicleMount` → scrap cargo (`s8d`) loaded via real moves → save → reload → cargo UID intact in the bike.

- Fixture grants (labelled `grants_fixture_intent`): 20 iron_ingot, 2 coal, 30 wood, 22 stone, 11 mechanical_parts, 10 fasteners, 26 spares.
- Real moves taken from the crate (`taken_from_crate_real_moves`): mechanical_parts 2, fasteners 3, spares 5, scrap 3 — the authorized factory exterior toolbox, not a generated supply.
- Crafted intermediates (UIDs in evidence): refined_iron_ingot ×2 (`s8o`) → mechanical_gear ×1 (`s8w`) → metal_pipe ×1 (`s8z`) → vehicle_frame ×1 (`s94`) + vehicle_drive ×1 (`s99`) → motorbike_kit ×1 (`s9g`) → bike entity `e9i` deployed as `s9g`.
- Full cost ledger (station builds, L2/L3 upgrade materials and MP×2 + 1 ingot L3 cost, research spares, fuel, cargo placement) is in `web/evidence/mec01-c1/motorbike-chain.json` under `costs` and `net_consumed_after_grants`; the crate's high-grade tool roll was deliberately left untouched (gear and pipe were **crafted**, not lifted).
- Old vs new capability: hauling low-density bulk (scrap-class) by motorbike instead of by hand/cart, with cargo custody tracked by UID. **Ordinary survival remains possible without the motorbike/Elder/Core** (`ordinary_survival_without_chain` in evidence; the tier-2 directed research and L3 are optional, paid, and physically built).

Labels for C1: **SIM_FIXTURE_MEASUREMENT** (stepped clock), **FIXTURE_INTENT** (grants/placement), real paid stations and real moves. **Not NATURAL_INPUT.**

## C2 — actual source→destination haul, three modes, TWO route classes (seed 4242)

Same physical cargo (UIDs from the one authorized factory exterior toolbox source) shipped to **one real accessible destination per class**: a `chest_large` the player built with the real build action at a buildable non-protected cell. All six runs (near+far × walk/cart/bike) start from the same source crate, deliver the same 10 stacks (14 kg), use the same seed, and pass UID custody end-to-end. Timing is SIM_FIXTURE_MEASUREMENT (`tick(50 ms)`, scripted held keys), not human input/NATURAL_INPUT.

| class | mode | ticks | seconds | path px | odometer px | fuel used | wear hp | delivered | creatures in box | damage | hunger/thirst |
|---|---|---|---|---|---|---|---|---|---|---|---|
| near (depot (119,127)) | walk | 222 | 11.10 | 811 | — | 0 | 0 | 10×14 kg | 13 (none touched) | 0 | 0.44 / 0.67 |
| near | cart | 281 | 14.05 | 881 | — | 0 | 0 | 10×14 kg | 13 | 0 | 0.56 / 0.84 |
| near | motorbike | 313 | 15.65 | 1072 | 1096.3 | 59.61 | 2.38 | 10×14 kg | 13 | 0 | 0.63 / 0.94 |
| far (depot (104,122), 49.8 tiles) | walk | 253 | 12.65 | 1013 | — | 0 | 0 | 10×14 kg | 12 | 0 | 0.51 / 0.76 |
| far | cart | 283 | 14.15 | 1120 | — | 0 | 0 | 10×14 kg | 12 | 0 | 0.57 / 0.85 |
| far | motorbike | 300 | 15.00 | 1232 | 1311.3 | 71.3 | 2.85 | 10×14 kg | 12 | 0 | 0.60 / 0.90 |

**Measured rational-choice outcome (no weighting invented): on `shipping_fresh` v1, for this 14 kg cargo, the motorbike never wins — walking beats it on the near class (11.10 s vs 15.65 s) and on the far class (12.65 s vs 15.00 s); the hand cart sits between. The vehicle geometry gates exactly one-cell forest corridors (`vehicleCell`/`vehicleExitPoint`), so the bike's road speed never realizes on the measured routes; fuel (59.61/71.3 units) and wear (2.38/2.85 hp) are pure extra cost here. `verdict.near.footRational=true`; `verdict.far.bikeFasterThanFoot=false`, `bikeFasterThanCart=false`. The heavy-cargo situation is NOT measured (the source crate is fixed at 14 kg) and must not be asserted anywhere.** `b05-freight-compare` remains untouched physics baseline; C2 is not derived from it.

Motorbike harness correctness notes (these rows are only meaningful with a driver that actually completes the route): the scripted driver now (a) routes the bike on 4-directional corridor legs (`tests/mec01-path.ts`, `cellSeconds` includes a `vehicleExitPoint` probe), (b) anchors steering to each leg's axis with raw-pixel errors (the earlier normalized-direction deadzone starved horizontal steering and froze the bike on shallow-angle legs), (c) advances checkpoints by plane crossing rather than radial windows, and (d) refuels through the engine's own `vehicleRefuel` intent when the tank drops below 120 (the granted can fixture was never consumed on the measured runs — far ride burns ~71 of 300 units). An earlier claim that the far corridor is blocked by a "creature occupancy" was wrong and is retracted: `clearPhysicalLine` is grid-only and no creature ever gated the vehicle; the runs complete with creatures present ([F4], exposure recorded, 0 damage taken this time). All six C2 tests pass (near walk/cart/bike, far walk/cart/bike, cross-class UID custody, evidence writer); `web/evidence/mec01-c2/delivery.json` is regenerated from these runs.

Labels: **SIM_FIXTURE_MEASUREMENT** (tick 50 ms, scripted held keys), **REAL** geometry/UIDs/chest build; fixtures labelled (kit/fuel/cart grants, `[F1]` end placement). **Not human input, not NATURAL_INPUT.**

## C3 — funded stations; separate-process offline resume (seed 9099)

Furnace + Workbench built at legal tiles (player relocated to a guaranteed 3×3 clear pocket at (161,20) after seed 9099's spawn pocket proved unbuildable — map-scan fix, not a ring widen), L2 `upgradeStation` paid for, fuel fed (1 coal, qty 1), jobs queued: refined_iron_ingot ×2 and mechanical_gear ×1. 5 s of station time elapsed; `serializeSnapshot` written to `os.tmpdir()/mec01-c3-<pid>/save.json`; a **fresh OS process** (`npx vitest run tests/mec01-c3-offline-child.test.ts --reporter=dot`) loaded ONLY the save via the game-own `selectSnapshots`, `settle(gs, startedAt + 5*60_000, true)`, and the UIDs/quantities above were produced: refined ×2 (`s8v` in `outC c8l`), gear ×1 (`s8w` in `outC c8o`). Queues drained; UIDs unique across all custody slots; `validate()` truthy in both processes (**validator note:** `validate()` returns a truthy report object, not literal `true` — an earlier `=== true` receipt was mislabelled and has been fixed with a clarifying note in the evidence; the child asserted `toBeTruthy()` and passed). Iron was conserved on this test's path (conservation scoped to the test's own custody; authored world crates legitimately carry ingots and are out of scope — documented in the test). Empty fuel/full output/replay mint-or-erase paths remain covered by the existing suite (`b03-production.test.ts`, `b03-return.test.ts`), which this pair complements with the process boundary they cannot cross.

Labels: fixtures = player placement, raw grants, creatures cleared; **natural** = builds, upgrade, fuel, queue semantics, retrieval moves. **SIM_FIXTURE_MEASUREMENT; not browser/wall-clock; process boundary is REAL.**

## B — authorized source ecology, real consumer choices (seed 4242)

Only authorized data was read: `SHIPPING_LOOT_SOURCES` (`web/src/game/loot-source-spec.ts`, version `loot-source-v2`) with exactly one world match per spec via `specForSite` (factory toolbox `shipping.factory.exterior.industrial-toolbox` — role toolbox / grade high / open / renewable / 24 h / cap 3; tp cache `shipping.tp.bow-cache.standard-toolbox` — toolbox / mid / open / renewable / 24 h / cap 2; factory vault `shipping.factory.vault.advanced-keycard` — **advanced / grade high / poi-door (factory, keycard) / finite / 48 h / cap 2**). `validLootSourceContract` true; `b01-v1` grammar still resolves (`isKnownLootGrammar('b01-v1')`).

Deterministic grammar probe (`LOOT_B05_TOOLBOX_GRADE`, seeds 97/313/55 × cycles 1–60): toolbox+high and toolbox+mid and advanced rolls may yield `mechanical_gear`/`metal_pipe`/`refined_iron_ingot` per the pinned tables; **supply+military rolls cannot**; `metal_blade` is advanced-only. The vault never underwrites a repeatable route (finite — see D).

Two real consumer choices executed per intermediate, **one stack → one outcome, UIDs consumed never copied**: gear → `vehicle_drive_geared` and gear → `industrial_pick_geared`; pipe covered by the sibling tests (`vehicle_frame_piped`, plate route). Consumer evidence carries the same source axes above; outputs verified by craft intent + UID identity.

## D — bounded economy: what changed and what it means

`src/game/industrial-proof.ts` gained four pure exports (no engine/persist/runtime path touched): `stockClassOf`, `B05_REPEATABLE_RULE`, `integerBatch(route, qty)` (whole crafts only; exact inputs; surplus reported), `integerTree(item, qty)` (recursive, whole crafts at every node; salvage routes never eligible). The benchmark report is now **v2** and explicitly separates channels that were previously blurred: source probability (`probabilityPerRoll`: fixed = 1, pool = 1/N, bonus chance as authored), stock clocks (`stockClass` + `stockClock` + `cooldownHours` per hit), player travel (**ORIGINAL_UNKNOWN — no travel model in Web**), unpriced nonmetals (coal/wood/stone/leather/spares/crystal, per-material only), and historical LI figures (context only; version/mode/confidence; never a balance input). Every missing datum is **ORIGINAL_UNKNOWN** (bare `UNKNOWN` eliminated). B05 eligibility is now a first-class report block: renewable = the two toolboxes; finite = the vault; salvage (`damaged_drive`) stays excluded from craft cost (`SALVAGE_ONLY`).

Amortized vs integer batch is not cosmetic. Example, `iron_plate`, ask = 1: amortized cheapestCraft reports 3.5 ingot-eq / 44 s; the integer batch model reports crafts `{iron_plate:1, refined_iron_ingot:2, metal_pipe:1, mechanical_parts:2}` → `{iron_ingot:8, coal:2, scrap:4}` / 100 s / 9.333 ingot-eq — because one plate still triggers whole crafts upstream and hands back 1 surplus plate. Both models ship in the JSON; the reviewer should treat the integer model as the floor for single-unit planning.

Every source hit is tagged; all five chains' `finiteCacheCanSupply` are `false` (the vault contributes no gear/pipe/refined/blade/frame); LI v3 rows show no `OVER_RETURN` (pinned 4-key v2 artefacts remain pinned history, labelled). **Not claimed:** any global no-arbitrage proof (the proof classes say so), real-world drop rates, or player-travel economics.

## New vs reused code

**NEW (this session):** `stockClassOf`, `B05_REPEATABLE_RULE`, `integerBatch`, `integerTree` in `src/game/industrial-proof.ts`; all of `tests/mec01-c1-motorbike-chain.test.ts`, `tests/mec01-c2-delivery.test.ts`, `tests/mec01-c3-offline-resume.test.ts`, `tests/mec01-c3-offline-child.test.ts`, `tests/mec01-b-consumer-choice.test.ts`, `tests/mec01-path.ts` (bike 4-dir corridor legs; leg-axis-anchored raw-pixel steering lives in `tests/mec01-c2-delivery.test.ts`); D edits to `tests/mec01-five-chain-benchmark.test.ts`; reports regenerated; `evidence/mec01-{b,c1,c2,c3,d}/`; this document.
**REUSED, not reimplemented:** `engine.ts` (motorbike, containers, stations, craft/furnace/bench queues, `placeMotorbike`/`vehicleRefuel`/`vehicleMount`), `recycler.ts` (`recoveryPlanFor`, `COMPONENT_RECIPES`, `COMPONENT_RULES` pinning), `loot-ecology.ts`, `loot-source-spec.ts`, `world.ts`, `serializeSnapshot`/`settle`/game-own `validate` in the C3 pair, `expand`/`routesFor`/`ieValue`/`proveItem` (amortized model retained and asserted), `b05-freight-compare` (untouched physics baseline), pre-existing `b05-freight-compare`/`b05-recycler-reload`/`mec01-a2-pipe-blade` modifications (**not made or re-reviewed this session; do not attribute them here**).

## Save compatibility

No persist schema or version change; no engine/persist code touched by this round (D is test + pure report helpers). The C3 child loads a save written by this build through the game-own loader; A2's pinned component rules remain in force; `b01-v1` resolves; v2 pinned recycler tables are immutable; v3 has no `OVER_RETURN`. No UID migration, no cross-version evidence claim. Existing `b03-*` offline tests still pass (full suite green). Save validator behavior is unchanged and now truthfully receipted.

## Labels and honesty register

- **NATURAL_INPUT: none. HUMAN: none. WEB: build artifact verified over curl only — no browser run, no screenshots.**
- SIM_FIXTURE_MEASUREMENT: C1/C2/C3 timings and the benchmark. FIXTURE_INTENT: labelled grants/placements. CHECK_EVIDENCE: D verification receipt. FIXTURE (pre-existing, per CT): `b05-freight-compare`, `b05-recycler-reload` comments/claims as reviewed.
- Not claimed: enjoyment/balance acceptance, 336 h campaign, Ragnarok, real drop rates, travel economics, multi-route arbitrage impossibility, single-file build health, browser correctness.

## Blockers and owner asks

1. **Browser WEB evidence (owner/runner-bound).** Needs a machine with chromium or access to `cdn.playwright.dev`. Actions: `npx vite build --config vite.http.config.ts && npx playwright install chromium && npx playwright screenshot --viewport-size=640,360 <url>` (and 1280×720) against `dist-http`. Until then, WEB claims stay "build + HTTP service verified, rendering unverified."
2. **Single-file build OOM (exit 137)** — independent packaging blocker, unchanged this round; do not claim it fixed.
3. **Map/Creator owner contract** — the vault's finite supply and the absence of any additional authorized advanced source is a deliberate spec decision; if balance work wants more advanced inputs, it needs an authorized source first, not test inventions.
4. **v2 pinned recycler tables** remain pinned history (four keys `OVER_RETURN`); any change to them is a balance decision for the council, not for this branch.

## As-applicable review hooks (CT K1/K3/K4/K7/K8; v11 SYS02/SYS03/SYS04/SYS09/SYS11; XEDGE-004/005/007/048/050/052/054)

Offline-first and solo (no co-op added); paid physical progression only (L3 is paid; research is directed spares; no free unlocks); source-physical atoms throughout (grants labelled as fixtures where used); non-repeatable salvage excluded from repeatable loops (`SALVAGE_ONLY`); renewable vs finite stock distinguished and enforced in the report; recycler economics remain loss-making on v3 (no `OVER_RETURN`); ordinary survival untouched (chain optional). **Not applicable/not claimed:** Core/Elder/Ragnarok content, 336 h telemetry, multi-route arbitrage impossibility, enjoyment.

## Reproduce

```sh
cd web
npx tsc --noEmit -p .
npm test                                    # effective timeout 120000 ms; 722 passed / 1 (by-design) skip in this session
npx vitest run tests/mec01-c1-motorbike-chain.test.ts tests/mec01-c2-delivery.test.ts tests/mec01-b-consumer-choice.test.ts tests/mec01-five-chain-benchmark.test.ts tests/mec01-c3-offline-resume.test.ts
npx vite build --config vite.http.config.ts
python3 -m http.server 41730 --bind 0.0.0.0 --directory dist-http   # live preview of the HTTP artifact
```

## Verdict

R2's remaining work items B, C3 and D are materially closed with real code/results; C1 and C2 are delivered with labelled fixtures and real custody. The single open verification gap is browser rendering evidence (runner-bound); the single-file build remains a known packaging blocker. **HOLD MERGE.** Reviewer should: (1) re-run `npm test`, (2) regenerate the benchmark and diff `web/reports/`, (3) inspect `evidence/mec01-*`, (4) decide the browser-evidence path, (5) keep v2 pinned tables untouched.

---

## Addendum (2026-11-08) — MEC-01 R3 mechanics & causal-integrity round

R3 ran on `arena/a9d7aa20-soul-of-hero` (not the PR branch) with its own documents:

- Audit + coverage matrix (K1–K8, C01–C24, Atlas roll-up with the provisional/no-v11-CSV caveat): `docs/survival/MEC01_R3_AUDIT.md`
- Handoff with P4 deliverable index: `docs/survival/MEC01_R3_HANDOFF.md`
- P0: strict `web/tsconfig.test.json` added; whole `tests/` tree compiles strict (134→0 errors); `npm run typecheck[:tests]` scripts added; duplicate `node:fs` import removed; **b03-return false-pass harness defect fixed (vacuous hidden-POI assertions now real; 9/9)**.
- P2: three new public-API adversarial probes (`web/tests/mec01-r3-causal-integrity.test.ts`): two-bench gear race, recycler-holds-UID refuses craft, one canister → one vehicle refuel. Zero new engine defects found at the prioritised boundaries; existing coverage reused elsewhere by name in the audit.
- Verified results: `npm run typecheck` = 0 errors; `npm run typecheck:tests` = 0 errors; `npm test` at `df11d2f` = **722 passed | 1 skipped (identical to R2 base)**; after P2 additions = **725 passed | 1 skipped**.
- Standing rule from R3 (do not drop): `typecheck` AND `typecheck:tests` must stay green in every PR; engine fixes require a real defect found by a named boundary probe; Atlas items are never mandatory features without creator lock; `shipping_fresh` findings are never tuned into final-map conclusions.
- PR #44 remains OPEN / DRAFT / UNMERGED; R3 commits deliberately do NOT reach the PR branch.
