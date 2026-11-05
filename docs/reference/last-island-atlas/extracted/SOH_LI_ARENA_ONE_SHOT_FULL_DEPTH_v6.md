# ARENA ONE-SHOT — SOH × LAST ISLAND FULL-DEPTH INDUSTRIAL AND SURVIVAL FIDELITY PROGRAM
## Master reference fidelity implementation. DRAFT / CREATOR APPROVAL GATE / NO MERGE.

REPO: `Khanh-glitch/Soul-of-Hero`
WEB BRANCH: `arena/d4bfcfff-soul-of-hero`
WEB PR: #44 — OPEN/DRAFT/HOLD
AUDITED SHA: `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4` — ***not a license to overwrite a newer HEAD***.

### REQUIRED INPUTS PROVIDED BY CREATOR

1. Attach the delivered `SOH_LI_FULL_DEPTH_INTEGRATION_READY_v6.zip` to this task or make its contents available as accessible files; verify SHA/directory access BEFORE applying changes. If absent, do not fake access: check repo for it, request the exact archive once, and complete preflight from canonical Bible without inventing historical rates.
2. Open `LI_MASTER_ATLAS_v5.json` and `LI_MASTER_RESEARCH_REPORT_v5.md` as LI reference; `SOH_LI_DEEP_AUDIT_REPORT_v6.md` for audited delta; `SOH_LI_405_ROW_AUDIT.csv` for reference-row mapping (not 405 independent features); `LI_51_RECIPE_MULTIHOP_1TO1.csv`, `LI_84_MATERIAL_INCIDENCE.csv`, `LI_82_LOOT_ROLE_CONTRACT.csv`, `LI_19_POI_ACCESS_CONTRACT.csv` for actual graph closure; `SOH_LI_CAUSAL_CLOSURE_GATES.csv` for 104 hard acceptance conditions; `SOH_LI_CROSS_SYSTEM_PLAYER_JOURNEYS.csv` for end-to-end physical routes; `SOH_LI_CREATOR_APPROVALS.csv` for Creator choices.
3. Read GitHub current branch HEAD and relevant ownership docs, `web/ref/bible.md` entire Part I/II/IV/VI, `web/src/game/catalog.ts`, `engine.ts`, `sim.ts`, `core.ts`, `world.ts`, `content.ts`, `world-economy.ts`, `wreck-economy.ts`, `persist.ts`, UI panels/common/render, Web tests and all current K1–K8 handoffs. Read latest Map handoff as dependency—not an edit permission.
4. Resolve actual approvals D01–D06 using *Creator-confirmed values*. An unspecified Creator decision remains HOLD; do not treat a recommendation as approval. Proceed with independent approved sections, keep others explicitly pending. Do not silently drop gun/vehicle/energy/market/upkeep/industrial capability branches from graph; every omitted LI sink requires a substantive approved alternative, not a dummy replacement.

### CORE MISSION

Make every approved Last Island-inspired **causal system** as deep and connected as the LI reference, adapted to SOH's locked solo PvE 336h world law. The target is full functional graph parity in approved scope, not a superficial checklist count. Do not construct a new game or rename 51 reference recipes as 51 new SOH recipes. Do not reduce LI to a generic `ore→part→tool` simplification; retain the *distinct resource extraction, industrial intermediate, high-tier equipment, loot bypass, research, recycle, trade, geography, timer and player choices* and demonstrate them with actual interactions.

### HARD OWNERSHIP RULES

- Web Gameplay may change owned TS game/UX/catalog/economy/renderer code on existing PR44 only; preserve PR status DRAFT/HOLD, no merge. Do not rewrite Godot A0/A3/A6/A7/A8 and do not claim that PR44 passing proves native production.
- Map Agent runs MAP-LR03/WMP-01 independently; NEVER interrupt, reassign, edit its branch, fabricate Veyra geography, draw unauthorized portals or assert bridge/vehicle clearance. Request a typed **location/source/door footprint contract** in PR handoff, not a new Map task. In Shipping/approved current Web layout, develop and validate independent world mechanics and existing legitimate test sites.
- Immutable canon: no PvP/clans/raid; player can live/loot without Elder/Core/quest; real UID/custody and no free resources; physical source authority; 336-hour real UTC run+last72 Ragnarok; six Elder optional; Core/Chitin knowledge tier3 remains Workbench Lv1 physically; only authenticated escrow-secured Ragnarok cash crosses runs; zero-score cheating; trace-grounded home danger; Map stable across runs; old saves; original/legal pixel art.
- Do not mutate global old-run source probability/currency, don't convert LI Parts directly to SOH Mechanical Parts. LI Parts is an economic token often closest to SOH **Spares**, whereas Mechanical Parts is an industrial intermediate. Define each one explicitly in all algorithms.

### PHASE 0 — DEEP SOURCE & WORLD AUDIT (MANDATORY, BEFORE NEW CODE)

Inspect all 18 S01–S18 and source rows; classify each in four separate columns:
`LI documented mechanic`, `SOH existing rule with exact anchor`, `Missing directed edge`, `Authorized change+owner`. Revalidate if PR HEAD moved. Preserve source direct numbers *as historic originals* and separately provide planned SOH tuning with normalization method. Never transfer LI 500 Iron to SOH units without resource throughput/stock/time model.

For each recipe, recursively traverse to raw source: `end product→all component recipes→raw source→where loot/craft/recycle/purchase occurs→power/station/capability→actual consumer`, and reverse from each material to all consumers. A chain without a legal obtainable leaf or a meaningful downstream use is NOT CLOSED. Use provided multi-hop CSVs; enrich them with source URI, local code path and live evidence. A source whose drop rate is unpublished stays UNKNOWN rather than invented. If missing LI fact, search official articles, item screens, dated guide images and video; log the exact search route/failed query and carefully separate sourced fact from authored SOH balance.

### PHASE 1 — SHARED ECONOMIC LANGUAGE AND MATERIAL GRAPH

Implement or complete: actual Refined Ore/Refined Iron Ingot, Metal Blade, Metal Pipe, Torsion Spring, Mechanical Gear, Iron Plate, Vehicle Frame, Electronic Parts and any required precursor only with appropriate sources and 2+ meaningful real consumers each when possible. Preserve existing Iron Ore, Iron Ingot, Scrap, Spares, Fasteners, Mechanical Parts and existing research/repair. Every component has independent identity/stack/weight, provenance, natural source or valid loot option, in-world sprite and UI icon, production/recycle path, loss/repair policy where applicable, game use and save history. Leaf resources must be geographically authorized by the actual map-source contract, not stamped at fictional POI coordinates.

Do NOT turn the materials above into a flat 1-unit crafting catalog. Distinguish tools, raw ore, refined ore, industrial components, engine/electrical parts, rare found parts, protected unique items. Build the graph reverse lookup in UI so one item shows relevant known producers and consumers without revealing undiscovered recipes for free.

### PHASE 2 — TOOL GRADES, METALLURGY, STATIONS

S01/S02/S05: Grade1/2/3 tools must change actual harvesting work, category cross-use, durability, source access and profit relative to costs. Benchmark same node with each tier: hits, yield, time, wear, repair and full inventory weight. LI 6/5/4 is a reference observation from a specific mode, not an automatic SOH hitcount rule. Keep actual old-run source stocks. Build new industrial Furnace/Large Furnace/Refinery differences (throughput, fuel, recipe and capacity) only after true source/consumer mapping. Lv3 Bench if D03 approves, physically paid and installed; old Lv1 Core/Chitin and existing Lv2 do not silently shift. Unique UID and reservations all the way to finished output.

### PHASE 3 — REAL SCRAP AND MULTI-OUTPUT RECYCLER

S03: distinguish Roadside Scrap, yellow/blue barrel, fuel/red barrel, Wreck, Toolbox and other salvage sources as real world objects with explicit class. At authorized Recycler, allow validated meaningful industrial inputs to return typed multimat outputs (where LI supports: Parts and sometimes Refined Metal). Keep exact original Drive handling. Constrain UID, stock, cancellation, output-full, device break, drop-on-full, offline, relaunch; search for craft→scrap→craft and buy→recycle→sell positive loops. If likely loop returns exceed consumed economic value, adjust with documented model; preserve alternate paths' comparative usefulness. No free Spares from arbitrary ground pickup.

### PHASE 4 — COMPLETE LOOT TAXONOMY AND POI ECONOMY

S06/S07/S14/S16: create real item/source classes: yellow/blue road barrels, red fuel barrels, Toolbox, Supply, Food, Medical, Military, Advanced Military, special/airdrop; type × quality × POI/site role × weighted selection × count/quantity × clock policy × source authority. A Food crate is NOT a generic 'better chest'. Loot can include full tools, uncommon intermediate parts, useful consumables, physical blueprints, equipment, fuel, cards. Credible drop source and downstream use are REQUIRED. Historical 2019 categories and official green/blue/purple room 6/6/7 chest compositions are a reference distribution: preserve category and stratification, do not place identical numbers at every SOH POI or counterfeit Map rooms.

A green→blue→purple *credential* ladder needs physical cards with finite charges, distinct readers, power/fuse and legitimate actual POI path. No forced main quest, Elder lock, or global master key. Rooms must have exterior, internal navigation, matching hazard, meaningful reward and an actual retreat route when power fails. Use Map-owned geometry when available. Where not available, implement and test contract on legitimate bounded source geometry, label geographic integration PARTIAL. Existing generic keycard/save must remain valid. Implement physically announced, finite-source airdrop with time/delay/cooldown and distinct rare-loot role if included in approved scope. Never reissue unique Ragnarok cash or Core as ordinary replenishing loot.

### PHASE 5 — ELECTRIC CONTROL, DEFENSE, BUILDING AND VEHICLES

S08/S09/S10/S11/S12/S17: replace a simple generator→turret *exclusive link* with a backward-compatible **physical circuitry graph** for generator, wires, manual switch, pressure plate, IR detector, wired consumers (powered door + light/turret + appropriate industrial load), capacity and fuel. Actual on/off/contact/LOS/collision and signal propagation, deterministic persistence. No magically powered remote device, no infinite fuel, no omniscient offline turret shooting; use existing bounded offline actor semantics.

Physical structural support/roof/collision/layering/repair/HP/door/defense stays in user-owned build geography. No unsolicited PvP upkeep tax or hourly decay. If D02 approves, Frame/Gear/Plate create at least one **real powered transport device** with fuel tank, physical cargo/weight, repairs, status, world occupancy, road vs rough penalties, vehicle loading/safety and Map clearance. If D02 approves energy extraction, require a legitimate special resource, specialized Extractor + Energy Refiner and ≥2 **different useful final consumers**; DO NOT add mystery 'Energy Ore' with no reason to gather it.

### PHASE 6 — SURVIVAL, MARKET, TIMERS, 14-DAY ECONOMY

S13/S15/S18: preserve basic food/water/rain barrel/shelter and only add LI-specific causal branches not already present (fresh/saltwater, exertion thirst, dew production, medical source classes, storage/time value). Ordinary timed loot refresh depends on D04; finite run-local trader depends on D05. Keep Ragnarok cash totally separate from Parts/Spares: no transaction can turn normal parts, recycled items, player kill score or market purchases into secured cross-run money. 336h run, death bags, offline settlement, six Elder optional and first legal nonboss deposit route all intact.

### PHASE 7 — ASSETS REQUIRED FOR EACH NEW VISIBLE THING

For every new inventory item, loot chest, barrel, tool grade, refinery machine, metal ingot, keycard, switch, sensor, door, vehicle, event marker and active device:
1. Inventory all available native SOH licensed sprite sheets/registries and identify correct pixel scale/palette/light direction; check ownership and SHA.
2. If no suitable existing art, **make original pixel art**: work from a 1× design grid, nearest-neighbor, limited palette, unambiguous silhouette at 640×360; draw/create sprite frames and pixel states for active/broken/open/closed as applicable. The Agent may use image tools where available, but generated art must be processed into genuine crisp pixel sprites; avoid vector antialias, emojis or generic squares as final art.
3. Export actual files with source/editable form where available; register in Item icon renderer AND world entity renderer AND interaction/HUD/death bag where applicable. A registered Item icon alone is not an integrated world object.
4. Compare in actual **current PR44 browser build** at 1× 640×360 and 1280×720, with pixel crop and legible recipe/loot/source labels. Preserve SOH aesthetics; document sprite provenance/license/hash and image of each finished object.
5. If a required sprite cannot be brought to acceptable quality, mark the individual system PARTIAL with exact blocker. Do not claim acceptance using nonvisual receipts.

### PHASE 8 — COMPLETE MATRIX EVIDENCE (NOT OPTIONAL)

For every row in `SOH_LI_CAUSAL_CLOSURE_GATES.csv`, fill `status`, owner, tested exact SHA, test/human route, screenshots/receipts, negative tests, first blocker. For each LI recipe, material, loot edge and access edge fill corresponding attached matrix including source, producer, all consumers and real physical output. Never auto-PASS from a matching name, catalog key, compilation, typecheck or virtual state. Keep 405 reference rows as a detailed **source→SOH trace**, not a fake percentage complete.

MANDATORY fully paid player chains J-A through J-J from `SOH_LI_CROSS_SYSTEM_PLAYER_JOURNEYS.csv`: early knife→tool grades; loot high-grade tool bypass; true multi-output Recycler; green→blue→purple POI; real electricity; transport and crude/energy if approved; offline shelter and trace/creature consequence; world event and independent Parts market if approved; Ragnarok full wipe still exact. Each has legitimate input, item cost, distinct choices, target effect, actual browser capture and relaunch. Diagnostic/injected fixtures can test invariants but may NEVER replace natural play and visual review.

Regression: all existing automated tests, typecheck, Vite single-file build, npm audit, seed repeatability, backward saves from before PR44, cancellation/output-full, UID conservation, crash/replay, finite ordinary/unique source, map geometry pin, visual images. Do not edit unrelated AVFX/Map/native sectors. Keep PR Draft/HOLD. Do not issue a merge or production claim.

### WORKING STRATEGY / NO FALSE COMPLETION

Execute in ordered **causal vertical slices**: each slice must reach world source→intermediate→finished use→feedback→save before branching to another. Build shared graph/foundation first, then expand by closure matrix. At each checkpoint save exact SHA and item-level evidence; do not stop on superficial 'all tests pass'. Treat unavailable network/asset/tool as a recoverable environment issue: retry official/source mirrors, repo-local licensed assets, local drawing, alternate packaging and bounded tests before marking blocker. Do not let art, geometry or missing source drift silently to 'DONE'. Do not interrupt concurrent Map long-run and do not open a second competing PR. Don't duplicate already accepted work.

### REQUIRED HANDOFF

- Exact branch, input commit HEAD, tested code SHA, evidence/doc SHA and PR status.
- Creator decisions D01-D06 applied or held; no unauthorized default assumptions.
- 18 system statuses + 104 closure-gate statuses with exact evidence. 51 recipe/multihop, 84 material, 82 loot, 19 access tables filled and diff-reviewed.
- Last Island historical original vs SOH adapted values per field and direct source URL; unresolved numeric research and no invented odds.
- Source chain and economic alternatives for minimum 10 end-to-end journeys, each with actual behavior, pixel visuals, receipts, save/relaunch and failures.
- List every new asset, license/provenance, art SHA, in-world and inventory registered use, plus screenshots at required viewports.
- Negative proofs: anti-farming, UID/reservation duplicate, no positive salvage arbitrage, invalid POI/cards, power-off behavior, owner checks, source authorization, no Ragnarok cash exchange.
- Strict verdict: CODE, DATA, ECONOMY, WORLD ACCESS, PIXEL VISUAL, ACTUAL PLAYER, LONG-RUN all independent. Nothing counts as `FULL_DEPTH_CLOSED` while a mandatory gate is PARTIAL/UNKNOWN or geography/asset not integrated.
- Clear Map/native-owner spatial handoff contract and future dependency; no invented deliverables. Keep PR44 DRAFT/HOLD / DO NOT MERGE.

**EXECUTE ONLY THE CREATOR-APPROVED PROGRAM; NEVER REPLACE LAST ISLAND DEPTH WITH A SHORT FEATURE LIST.**
