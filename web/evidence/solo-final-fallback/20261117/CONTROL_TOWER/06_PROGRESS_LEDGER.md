IMPORTANT RUNTIME CORRECTION (2026-11-17) — READ FIRST: 08_RUNTIME_FIRST_CORRECTION.md is the controlling source-grounded implementation inventory. K1–K8, 18 Atlas groups and 214 research rows are NOT a backlog of 8+18+214 features to implement. The pre-NPC runtime already integrates item custody, 114 catalog recipes, 7×3 Creator Core branches, eight seasons, machine/farm/power/transport, G1B, offline/endgame, etc. Any older instruction sounding like “implement K1–K8” means AUDIT EXISTING CODE, repair precisely reproduced defects, validate and ship. Do not reimplement existing runtime or produce a checklist-only session. 08 takes priority over ambiguous earlier plans.

NEW SOURCE-AUDIT OVERRIDE: prior PARTIAL labels are certification states, NOT assertions that components are absent. Read 08 for live implemented caller inventory before choosing work.

# 06 — LIVING SOLO FOUNDATION LEDGER + RESUME PROCEDURE
**INITIAL STATUS ONLY, 2026-11-17; this document must be updated by agent after each meaningful production commit.** THIS PLAN IS DOCUMENTATION-ONLY, NO CURRENT SOLO PRODUCTION IMPLEMENTATION CERTIFIED.

## Starting point
Repo Khanh-glitch/Soul-of-Hero
Protected backup: backup/pre-npc-g1b-738-20261116 @ e93982f87bd23805d300b464f05ccf23c04a32c0.
Audit-only branch: audit/pre-npc-solo-final-gates-20261117 @ 0e2d57cba43ddac262d52f43923486ba1ced3761.
Authorized solo feature branch: feature/solo-foundation-final-20261117, created from audit-only branch. This README/ledger control-tower commit is not an implementation patch.
Independent NPC head last sampled: arena/9025bfde-soul-of-hero @ 751f80a4d847b6b1f532a47803d9e94bfa4c26f3 (source changed 67 commits after e939, plus major shared engine overlaps). Recheck before every compatibility claim.
Baseline G1B evidence: 738 layout4 sources; 16 approved pools/219 positive odds; authentic Batch2 migration tests; reported 63 G1B tests PASS and TypeScript PASS at historical checkpoint; 157 atlas art frames and 25 catalog fallback IDs. Still NOT current run's independently certified release.
Initial reachability: 30 spaces classified 6 intentional, 9 collision defects, 5 missing route/stairs, 10 unresolved. Fix only real map defect supported by source.
Initial visual/perf: User says game was very smooth on Veyra before new item art/NPC; current pre-NPC checkpoint already includes approved atlas PNG which generates 157 canvases/data URLs before first React render. No fair same-code before/after benchmark yet. No exact frame-time deficit proven.
Initial endgame evidence: escrow-route-physical test uses artificially offset h264 and r.creatures=[]; NOT natural 336h, no S4/S5 proof. 18/214/104 Atlas v11 reference rows are old screening entries, not final code evidence.
Native project exists, but no independent current native final-SHA proof. Global leaderboard VERIFIED server trust cannot be claimed absent back end.
Current canonical Bible includes NPC Creator lock, so SOLO RELEASE SCOPE NOT YET APPROVED; do not alter that lock in a development branch without Creator decision.

## Live gate matrix to update at current source SHA
COMPATIBLE_BASELINE | source + current fork safety | initial provenance verified, final code no
FPS_REAL | measured same-code new-item image baseline and current speed | NOT VERIFIED
WEB_INPUT_AND_HUD | actual 640×360 controls, two avatars, no art quality downgrade | PARTIAL HISTORICAL
NATIVE_GODOT | composed current native source/player/save/VFX | NOT VERIFIED
VEYRA_ACCESS | multiple valid spawns, 81 actual map areas/rooms, 30 reachability cases | PARTIAL
G1B_RUONG | physical sources/art/loot/anti-dupe/migration/refill and human review | PARTIAL (narrow tests passed historically)
ITEM_MASTER | 157 item IDs/114 recipes source→consumer, retired migrations | PARTIAL
CORE_7x3_PLUS_4 | 21 actions, 4 Field, Gold/world effects/energy/cancel/reload/legacy | PARTIAL
INDUSTRY_POWER_TRANSPORT | ore/oil/salvage/parts/stations/fuel/vehicle with meaningful sinks | PARTIAL
SURVIVAL_BUILDING_OFFLINE | physical hazard/upkeep/creature response and eight seasons | PARTIAL
RAGNAROK_TWO_RUNS | h264/h312/h336, six optional Elders, no-boss cash, escrow, K8 | PARTIAL
SCORE_BACKEND | personal local and online VERIFIED separated by actual proof | NOT VERIFIED
APPROVED_GRAPH_C01_C24 | every edge anchored and tested at appropriate level | NOT CERTIFIED
NPC_PORTABILITY | safe-common patches, overlapping source and ephemeral integration tests | NOT YET IMPLEMENTED
FULL_REGRESSION | app/test TS, complete suite, save/browser/native/perf final source | NOT RUN ON SOLO PLAN SHA
CREATOR_HUMAN_SCOPE | visual/feel/long-run and noNPC release permission | CREATOR REVIEW REQUIRED

The table is not an excuse to report only a list of PARTIAL statuses; it is a backlog to close through SOURCE implementation, with actual evidence.

## Next first three investigations (not fixed priority once evidence changes)
1. Independently compile/validate a fresh New Game at exact solo baseline; profile item atlas load/157 toDataURL, first-frame, inventory and gameplay frame time against controlled alternate rendering code. Cross-check historic pre-atlas versions and preserve identical gameplay. Make measured production source fix if trace supports it.
2. Build read-only source-to-World gameplay graph for approved 157-item/114-recipe and K1–K8/C01–C24; find current physically missing central source/consumer, especially G1B access, industry/energy/fuel/escrow and old-save safety. Correct one or more highest player-impact source gaps in production, rather than wait to complete a perfect spreadsheet.
3. Inspect full 336h Ragnarok economic chain and native/Web actual build; discover technical blockers and implement in priority order. Continuously recheck overlap with NPC shared files.

## Mandatory entry appended after each production checkpoint
### YYYY-MM-DD branch full-SHA
Objective: exact game behavior now possible and why it improves more than a local assertion.
Canonical source: Bible [CHOT] clause, C/K/Atlas LI mode/source (if used), old→new source function.
Impact: producer/source/UID/floor/access/time/cost; sinks/choice/risk; economy, terrain, weather, save, online/offline, UI, perf and NPC future impact.
Source edit: paths/functions/lineage, changed user-visible behavior (not just tests/documentation).
Evidence: focused tests + negative property, timestamp and real before→after physical state; Web/native checks, exact environment. Distinguish forced fixture from technical normal controls; no bot gameplay-fun claim.
Performance: before/after measured metrics, whether comparable and limitations.
Port status: SAFE_COMMON / SHARED_HOTSPOT / SOLO_ONLY / NATIVE; NPC HEAD checked, risk/conflicts, potential adapter changes.
Remaining required work: ordered by centrality and severity, not test count.
Next source action: exact function/defect to fix, expected positive/negative proof and prerequisites.
Status: source / engineering / Web / native / human / scope. Never self-declare subjective review.
Commit integrity: clean/dirty, branch, full SHA, pushed vs local only.

## Resume exactly

### 2026-11-17 arena/340bd7c4-soul-of-hero 7d00481
Objective: Unblock `po_hook/0/garden_cottage` North exterior door (`x=2599, y=690`) which was immediately blocked by its interior partition (`x=2599, y=691..694`).
Canonical source: `web/src/veyra05/arch/sites.ts` (`po_hook` / `garden_cottage`) and `web/evidence/g1b/census/G1B_REACHABILITY_CLASSIFICATION.json`.
Impact: Shifting the partition and arch 1 tile west (`x=2598`) opens `(2599, 691)` so the player can enter `garden_cottage` from the North door.
Source edit: `web/src/veyra05/arch/sites.ts` (lines 410-411).
Evidence: Source-level geometry inspection of `rect: [2592, 690, 14, 9]`, `doorSide: 'N'` (door at `x=2599, y=690`). `g1b-geometry.test.ts` timed out at 60s due to full Veyra world compilation.
Port status: SAFE_COMMON (`web/src/veyra05/arch/sites.ts`).
Remaining required work: Inspect remaining G1B reachability defects (`po_gulfhead/0/quay_watch`, `po_rapids/0/wayhouse`, 5 `usable=0` rooms, 5 `MISSING_ROUTE_OR_STAIRS` rooms) and `typecheck:tests` errors.
Next source action: Inspect `quay_watch` (`c01.ts`) and `wayhouse` (`rest48.ts`) door-exterior connectivity, and `typecheck:tests` errors.
Status: engineering checkpoint (committed & pushed to `arena/340bd7c4-soul-of-hero`).
Commit integrity: clean, `arena/340bd7c4-soul-of-hero`, `7d00481`, pushed to origin.

### 2026-11-17 arena/340bd7c4-soul-of-hero 368232914084b53cb1041251c48d88ef60899838
Objective: Eliminate 157 synchronous `toDataURL('image/png')` calls from `loadItemAtlas()` before React mounts, encoding PNG data URLs lazily on first `atlasIconUrl(key)` access instead.
Canonical source: `web/src/game/item-atlas.ts` (`loadItemAtlas`, `atlasIconUrl`) and `web/src/main.tsx`.
Impact: Removes 157 upfront PNG encodings from the critical startup path before first React render while preserving `cells[key]` for the canvas renderer, all 157 approved item mappings, and 640×360 rendering.
Source edit: `web/src/game/item-atlas.ts` (`atlasIconUrl`, `loadItemAtlas`).
Evidence: `npm run typecheck` (0 errors), `npx vitest run tests/item-atlas-157.test.ts tests/g1b-icon-audit.test.ts` (2/2 files, 3/3 tests passed), `npm run build` (`dist/index.html` built in 15.27s).
Performance: Upfront `toDataURL('image/png')` calls at startup reduced from 157 to 0; browser runtime FPS/frame-time benchmark not yet run in headless Chromium (Playwright browser binary not installed in sandbox).
Port status: SAFE_COMMON (`web/src/game/item-atlas.ts` is self-contained).
Remaining required work: Inspect G1B reachability (`G1B_REACHABILITY_CLASSIFICATION.json` / `g1b-reachability.test.ts`) for real source-level collision/route defects; inspect `typecheck:tests` errors and other Solo backlog seams.
Next source action: Inspect `G1B_REACHABILITY_CLASSIFICATION.json` and `web/src/game/g1b.ts` / `world.ts` for actual unreachable player content.
Status: engineering checkpoint (committed & pushed to `arena/340bd7c4-soul-of-hero`).
Commit integrity: clean, `arena/340bd7c4-soul-of-hero`, `368232914084b53cb1041251c48d88ef60899838`, pushed to origin.
After context ends: agent starts from HEAD, latest ledger entry and diff, rechecks Creator/authority, selects first highest leverage unresolved *source* task, implements, verifies, commits, updates ledger, continues. It does not require another prompt, repeated user go-ahead or chat-assistant acceptance for each package. A platform stopped session is not background execution. A genuine conflict requiring Creator choice is stated precisely with alternatives while independent work continues.

## Critical safety review before each commit
Did any new mechanism duplicate a UID, spend twice, offer source-free stock, over-reward recycler/research, bypass G1B card/power/floor, change area collision, alter 336h/last72, leak run items into profile, make Core art-only, degrade Gold/asset quality, make a formerly optional system mandatory, hide input affordance, turn Atlas reference into an unauthorized obligation, claim enjoyment from scripts, overwrite current NPC engine behavior, or misstate same-code FPS? If yes, repair before marking complete.

## If agent truly exhausts feasible source work
Provide complete same-SHA engineering release candidate package, optional standalone SOLO scope delta, port-manifest and blockers that only Creator/human/native/backend can resolve. Do not declare full THE LAST HUMANITY without NPC or Creator scope amendment.
### 2026-11-17 takeover checkpoint — 257aae3ffdbeda1d2a142f0adf6385775a0c01b5
- Workspace recovered: Arena branch `arena/e506bfd6-soul-of-hero` started at `82089fe`; fast-forwarded **this branch only** to requested inherited `6495cbc`. Branch names in old orders are historical; no other branch switched/edited.
- Reproduced SOURCE_DEFECT: concurrent `loadItemAtlas` creates two images; the shared state guard strands one promise. Timeout leaves stale handlers alive, allowing an old image to settle/overwrite a retry. Partial crop failure publishes partial cells. Four negative lifecycle tests fail on inherited source, pass with attempt-local settlement, single-flight promise, timer cleanup, atomic cell publication, null-prototype caches.
- Measured performance defect: first pack opening encoded **361 additional canvases** (365 total including four HUD icons); a single unmatched icon bulk-encoded procedural item AND structure art. Changed `drawnIconUrl` to encode only the requested canvas, including `st:` routing. Same normal-control UI showed 77 new /81 total and zero further encodes on repeat. No item/economy/save/world/clock change, no new assets or weakened fidelity.
- P1 independent result: controlled same-module browser probe (`e2e/solo-atlas-profile.mjs`, `atlas-controlled.json`): inherited lazy atlas load ~14ms vs reconstructed eager 125–131ms; cost is deferred to first use, not a proven FPS win. Explicit `willReadFrequently` for tiny readback cells reduces isolated first-four encode from median 12.2ms to 3.1ms and remaining cells 91.8ms to 11.6ms. **All 157 cells pixel-equal**, all nine variant trials. Software SwiftShader Chromium 153, not real device certification.
- Full actual App inspected: normal New run / default random Veyra / Begin / I / Escape / I. Dev cold-title 6–8s, first panel remains variable (seconds), global compiler and GPU backlog NOT solved. Raw frame/P95 and long tasks retained separately; random scenes differ so do not infer causal FPS improvement. Baseline observer had two early harness-only null-body errors, fixed before post-change captures. Zero App page errors in post runs.
- Verification: repository Vitest 4.1.12, four focused files / eight tests PASS; app typecheck PASS; production single-file build PASS (84.79 MB HTML, ~59.72 MB gzip; large packaging is an investigation candidate, NOT accepted delivery performance). `typecheck:tests` inherited failures remain open, captured at first run (Result narrowing, nullable/mistyped G1B tests, stale source outcome).
- NPC compatibility: checked fetched `arena/9025bfde-soul-of-hero` **fdcd0be4321521eea24bbcd90c2c2a60dbcb06c5**. Isolated atlas+fallback patch applies cleanly to archived source under `.cache/npc-port`, preserves NPC `PanelState` human member. NPC app typecheck PASS, same 4 files/8 tests PASS. Not a full NPC build/save/endurance certificate; no NPC branch edits or pushes.
- Next active work: focused real Hook floor materialization completed in ~1.34s; `(2599,689)` exterior and `(2599,691)` interior clear, `(2599,690)` real closed door. Extend to collision/tick/negative/reload. Census reveals **garden cottage has NO chest source**, so do not claim a new source reached or invent one; preserve all 738 IDs. Then inspect actual `quay_watch` / `wayhouse` physical access rather than blindly accepting census categories.
- Status: SOURCE + focused ENGINEERING + browser pixel/UI probe; overall Solo RC still PARTIAL; native, full regression, actual hardware FPS, human/longitudinal/scope not certified. Commit local; final checkpoint push pending on **current Arena branch only**.

### Hook verification checkpoint — inherited 7d00481 retained
- `tests/solo-hook-access.test.ts`: 2 tests PASS, 6.58s whole Vitest run. Before/after compile delta exactly six wall/floor cells (the old/new arch cells already floor). Rooms/props unchanged; all 738 source IDs retained; no garden-cottage source exists.
- Explicit QA fixture starts exterior, walks using real tick + collision (no per-waypoint position assignment), proves closed-leaf block, ordinary open, occupied-leaf close refusal, movement to both sides of partition, full standable interior tile connectivity, inside handle/retreat, snapshot validation preserving door and source IDs, wrong-floor remote action refusal. Not a natural journey, full mainland connectivity or human acceptance proof.
- Raw browser captures checked in with their limitations above; `perf-inherited.json` has harness errors and is NOT clean baseline. No full-game FPS claim.
- Next: reproduced `typecheck:tests` diagnostics (53 reported locations) are test-source failures; repair without weakening production contracts or suppressing typechecking.

### Test-source gate repaired — follows 594d5cd
- `npm run typecheck:tests` now PASS (entire test TS project), app `typecheck` PASS. No `ts-ignore`, excluded tests or weakened production types.
- Corrected Result discriminant narrowing, explicit nullable stack predicates, mutable tooling array/Level/coordinate tuple types, recipeRev in research fixture, guarded historical snapshots, migration fixture chest/custody guards. Removed a misleading “separate processes” test title: it is in-process serialize/validate, not OS-process proof.
- Genuine stale test behavior: harvest output uses `{result:'yield', depleted:true}` / `result:'empty'`, never `result:'depleted'`; fixture now stops at actual depletion. Retired blueprint successor may be null; fixture expected metadata now matches its optional field contract.
- Re-executed 13 impacted files (including Hook): **108 PASS / 1 existing skipped**, 51.26s. Negative corrupted-storage/save, migration/idempotency/foreign-ID, paid recipes/research, deploy custody and repair coverage retained. Full ecology regeneration intentionally not run (default frozen audit only); this checkpoint does not resurvey or change source locations.
- Next source risk: focused compiled access for census `po_gulfhead/0/quay_watch` and `po_rapids/0/wayhouse`. No authority to turn intentionally inaccessible structures into routes. Packaging investigation noted but NPC already has a separate HTTP-delivery change; do not transplant wholesale or change offline single-file product delivery unilaterally.

### SOURCE_DEFECT_REPRODUCED — inherited Hook patch rejects pre-patch saves
- **Correction to earlier narrow save evidence:** fresh→fresh snapshot proof at 594d5cd did NOT establish pre-patch compatibility. Actual source `3682329719b9cdd1eadaeed791f0ea8c29733714`, archived into `.cache/hook-legacy` without a branch switch, generated and validated a checksummed Hook-window snapshot. Current inherited geometry refused it: map digest **192faffd → 0a68b6c3**, source digest unchanged **aae8303f**. Full World comparison isolated six `tiles` and six `walkable` entries; no other hashed fields differ.
- Production fix: `veyra05/hook-compat.ts` reconstructs the exact six-cell prior fingerprint over canonical ground arrays for this window/source rule; `persist.validate` accepts only that exact prior geometry after ordinary source/provenance checks, runs all remaining UID/custody/clock/entity checks, then normalizes mapDigest. Arbitrary/corrupt maps remain refused. No blanket digest bypass, source move, loot refill or time change.
- Old legal standing cells can become partition walls. Recovery is bounded to the three newly walled cells on ground, checks adjacent walkability/props/source/entity collision and plans moves atomically, preferring the old west side. Unaffected actors are unchanged. Mounted player cannot be detached; no legal destination fails closed and leaves recovery bytes available. Not a general teleport feature or proof about every historical offscreen actor.
- Real old-source fixture bundle `tests/fixtures/pre-hook/3682329.json.gz`: four original envelopes /three origins, including edge-clipped window and actor-on-old-floor; six independent old fingerprints for rules3/4. Export source/provenance retained beside fixture. Post tests: old snapshots accepted and resaved idempotently; exact entire state equality except mapDigest and one necessary adjacent player displacement. Bad fingerprint/source digest/provenance/layout/source ID/duplicate UID all rejected. Canonical ground fingerprint tested independently of currently installed upper layer.
- Verification: focused Hook suite passed9 tests before final ground-layer negative was added; isolated NPC fdcd0be port including that final test **4 files /15 tests PASS**, NPC app typecheck PASS. Solo app typecheck + full test typecheck PASS; single-file production build PASS, 18.58s, 84,791.51kB HTML. Focused final Solo rerun pending below; full178-file regression in progress, NOT a PASS claim.
- NPC: combined `porting/hook-with-save-compat-for-npc-fdcd0be.patch` (inherited partition + compatibility) applies cleanly to the ignored archive, retains NPC persist logic. Do NOT port partition alone. Initial archive test import failures were missing `web/geography` archive inputs, corrected by archiving actual NPC files; not NPC source defects. No actual NPC branch edits/pushes/merges.
- Geometry investigation (not edited): Quay Watch actual door2050/1830 has component104 vs largest18609; Rapids Wayfarer door2308/907 component92 vs largest16614 with unlocked leaf included, water not passable. Confirms local exterior isolation, NOT authorization to bridge a river or a complete mainland path. Door/apron changes require historical-save handling as this new regression demonstrates; leave those sites unchanged until a bounded safe correction is ready.

### Final regression checkpoint after production 6fc9d3c753777cf332a85eccbe23d688221bfa1e
- Full default discovery ran192 files (178 in tests +14 in src), **149 files passed /43 failed; 1,091 tests passed /176 failed /58 pending**. Runtime1159.43s. JSON reporter counts describe-suites separately (539); do not misreport539 files. The900s tool wait expired while Vitest children remained alive; explicitly monitored actual PID4722 to completion, no duplicate run. All test workers are now stopped. Raw report `full-regression-6fc9d3c.json.gz`, compact inventory `full-regression-triage.json`. FULL_REGRESSION is **FAILED**, not “mostly certified.”
- Failures show widespread old fixture assumptions (raw-material deployment vs24 packed devices, old recipe counts, fixed Veyra start/layout, old retired formulas). These are hypotheses except where independently reproduced. Ran four representative files against isolated actual3682329 runtime with c794344 test source: bear trap8fail, escrow1fail, refinery18pass1fail, lifecycle1pass1fail. Thus those11 failures predate takeover production fixes; NOT evidence that all176 are inherited or safe to dismiss.
- Corrected two high-centrality fixtures, not production law: physical cash→escrow now explicitly proves raw-material cabinet refusal, then uses a labelled injected packed-cabinet fixture, preserves its UID on deployment and consumes it once. Existing real tick/cash purchase/deposit/save and anti-minted-cash checks retained. Refinery fixture now supplies its approved packed device, keeps both level1/no-workbench negatives, verifies pack survives refusal and UID survives placement. These are controlled mechanics, NOT natural acquisition or 336h/S4/S5 proof.
- Final Solo focused rerun **8 files /38 tests PASS**,12.15s: all atlas/icon regressions and157-cell audit, both Hook files including final ground-layer negative, physical escrow and19 refinery tests. Test typecheck PASS after these changes. Production app typecheck/build were PASS at6fc9d3c; no later production changes. Broad suite NOT rerun after the two fixture corrections; do not silently subtract failures or call it green.
- Full suite auto-wrote economic-network/item-network/benchmark reports. Reviewed as generated side effects and restored only those pre-existing tracked artifacts, not production code or user changes. Raw failure evidence retained separately.
- Fresh NPC remote cross-check found HEAD advanced from fdcd0be to **872c02f331295d1e7657727822b49bcef5b095f5**. Fetched/read only; inspected19-file delta (CPU/navigation/world compiler work), no source transplant into Solo. New independent `.cache/npc-latest` archive: BOTH same portable patches apply-check/apply PASS, **4 files /15 focused tests PASS**, app typecheck PASS. Existing patch filenames retain original fdcd0be label; also validated on872c02f. No NPC branch edits, pushes or merges.

## Durable resume — no background work claim, no FULL release claim
Production commits:257aae3 (atlas lifecycle/per-key fallback/readback),6fc9d3c (actual pre-Hook-save compatibility). Evidence/test checkpoints594d5cd,c794344 and subsequent regression checkpoint. Current Arena branch only; original Solo/NPC branches preserved. Dev preview may remain available, but no test/background engineering is left running.

Highest-risk next work, in evidence order:
1. Use `full-regression-triage.json` to reproduce/classify failures on current source and representative pre-takeover source. Shared controlled build fixtures used by B02/B03/circuits/absence need packed-device paths, without production bypass, changed approved costs or disabling tests. Validate positive/negative/offline/UID scenarios after adapting fixtures. Inspect unresolved recipe/economic module-import errors separately; do not equate fixture drift with a game defect.
2. `tests/wp3-veyra-recycler-integration.test.ts:303`: natural-input test expects≥3 mechanical_parts, actually0. Read approved157/114/recycler contracts and trace harvest→recycler→consumer before deciding stale recipe vs real access/economy gap; priority above cosmetic map changes. Endgame cash→escrow fixture restored but natural336h/two-run/native validation remains open.
3. Quay Watch/Rapids real door isolation recorded above. Any door/apron fix must keep original738 source IDs/pools and supply genuine pre-edit save fixtures/migration; do not bridge GOLD water or unlock intentional rooms blindly. Scratch diagnostic lives ignored `.cache/solo-access-investigation.test.ts`; reconstruct from logged coordinates if cache absent.
4. Full same-scene actual-hardware FPS/memory + native current-source compose + actual Creator human/scope review still open. Software browser atlas microbench/pixel equality does not prove GPU FPS or enjoyment; single-file84.8MB packaging remains large, and NPC HTTP delivery differs. Do not alter offline product delivery contract without source/contract review.

Status: Solo engineering PARTIAL, broad regression FAILED, native/human/endurance/scope NOT CERTIFIED. Both inherited patches now have narrowly scoped independent engineering evidence and the discovered old-save defect is corrected. Selective NPC integration package tested on current observed HEAD, NOT a merge certificate. Push final checkpoint only to `arena/e506bfd6-soul-of-hero`.

### Bear-trap mechanism custody correction (after 8474893)
- Reproduced a genuine free-renewal exploit after adapting B02 to actual hand-crafted packed traps (approved gear1 + ingot2): trigger leaves spent/2, reclaim returns same UID/HP, redeploy erroneously creates unarmed/3. Pre-fix focused run8PASS/1FAIL (expected2, got3). Retired fasteners were removed from the fixture, not restored to production cost.
- Added optional `Stack.bearTrap` with the same bounded trap-v1 state grammar used for placed entities. Packing copies remaining uses/paid armed state onto that original UID; deployment transfers mechanism authority back to the entity. Legacy placed entities without a deployed pack retain their actual mechanism in the one explicit migration recovery item. Metadata absent on an old pack remains the pre-existing new/unarmed default: historical information already lost by an earlier reclaim cannot be reconstructed. No save-version bump, item/recipe/source IDs or geometry changed.
- Paid existing Workbench re-forge bill renews the mechanism with HP, still same UID; no-material repair is atomic/refused and does not renew it. Re-forge does NOT supply an arming plate. New save/runtime checks refuse impossible mechanism pairs, bad version, and trap fields attached to a different item. New tests exercise all3hits through actual snapshot-loaded runs, same UID+HP, worn refusal, paid/no-material repair, armed state across reload, no inventory-trigger, legacy recovery and corrupt metadata negatives.
- B04's two controlled setup helpers were also still raw-building trap/campfire; they now craft the real pack before placement. This is labelled mechanics, not a natural progression or enjoyment proof.
- Solo impacted **5files/46tests PASS**,12.91s: B02,B04,device repair,deploy custody,Hook-save. B02 strengthened afterward to continue loaded runs after every hit:12PASS6.34s. App typecheck PASS, full test-source typecheck PASS, production build PASS19.34s84,792.12kB (gzip59,719.01kB). Broad suite has NOT rerun; last full gate remains FAILED.
- NPC872c02f isolated archive: plain Solo patch does NOT apply at core Stack (NPC production field) / leading engine imports. Adapted ONLY these contexts, preserving NPC production and world-work fields. Both old atlas/Hook packages already present. New trap package plus copied impacted tests: **5files/46PASS12.12s**, NPC app typecheck PASS. This is narrow source compatibility, not NPC/HumanWorld runtime/endurance/merge authorization. Neither NPC branch nor production merged or pushed.
- WP3 refinement: obsolete natural test expects damaged_drive (not mechanical_parts). Live wreck source yields spares and `wreckBonuses` deliberately maps both historical policies to direct0.7 expected bonus spares; no evidence yet justifies reviving drives or altering supply. Its old three-drive/recycle chain still needs an honest current-contract replacement. Ontology reports also still dereference retired formulas; unresolved, do not silence to claim broad green.

### B02 infrared-sensor fixture follow-through (after a65b431)
- Corrected its raw-build fixture to supply labelled controlled raw inputs, execute real hand pack recipes and verify original UID consumption/deployed identity. Live IR bill is ingot1+electronic_parts2+spares1, not the retired gear/fasteners assumption. Both empty-inventory and raw-input-only placement refuse without debiting inventory.
- Door circuit now pays/builds an actual Wooden Door host before fitting its Powered Door module; same host entity ID retained. Added standalone no-host refusal/material preservation then legal paid fitting test. Kept all twelve original sensor/capacity/LOS/fuel/turret/offline/save/corruption assertions; added one negative/positive host test. No production edits or free devices introduced by this follow-through.
- Final combined Solo **6files/59PASS15.05s** (B02 trap, B02 IR, B04 world, repair loop, deploy custody, Hook-save). Full test-source typecheck PASS. Latest isolated NPC872c02f with all3packages + same final tests also **6files/59PASS13.88s**; saved adapted NPC trap patch reverse-apply-check PASS against the tested archive. NPC app typecheck was PASS before test-only follow-through. No merge or original NPC branch edit.
- Unfinished queue unchanged: B03 stale build helpers, honest WP3 natural recycler route, ontology audit's retired recipe dereferences. Last broad regression remains FAILED43files/176tests; do not infer new full-suite counts from the focused passes. Native/human/long endurance still uncertified. Test workers finished; no background continuation promised.
