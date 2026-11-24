# TASK BRIEF — Soul of Hero Economic Network Analysis, Tuning, and Integration Design

**Repository Baseline:** `Khanh-glitch/Soul-of-Hero` @ commit `52f27959f732aa8b47d6a897c9a5aa7d708cf926` (branch `arena/f561fd0d-soul-of-hero`)
**Target Artifacts Directory:** `web/reports/economic-network/`
**Verification Commands:** `cd web && npm run typecheck && npm run typecheck:tests && npm run build && npx vitest run tests/economic-network-m1.test.ts`

---

## 1. Objective & Scope

Perform an exhaustive, code-grounded, quantitative systems-economic audit and architectural design across the entire **Soul of Hero (SOH)** economy (`web/src/game/*` + `web/src/veyra05/*`), cross-referenced against both the **Last Island (LI) historical reference atlas** (`web/ref/atlas/*`, `web/ref/bible.md`, `web/ref/OPERATIONS.md`) and live-verified official/community Last Island documentation.

Work is structured into four sequential milestones, each committed cleanly:
- **M1 (WP1): Complete SOH Economic Multigraph Extraction & LI Crosswalk**
  - Deterministic, automated TypeScript multigraph extractor (`web/src/game/economic-graph.ts`) + Vitest validity suite (`web/tests/economic-network-m1.test.ts`).
  - `SOH_ECONOMIC_GRAPH.json`, `SOH_LI_ECONOMIC_CROSSWALK.csv`, `LI_SOURCE_EVIDENCE.md`, `M1_GRAPH_REPORT.md`.
- **M2 (WP2): Full Economic Simulation & Structural Audit**
  - Automated multi-day, multi-archetype, and Monte Carlo runtime/analytic economic simulations across **both** `shipping_fresh` and `veyra05-world` (0h–336h, offline rest/settlement, base upkeep, fuel/power/vehicle/husbandry/core/vendor loops), audited for bottlenecks, broken chains, dead-ends, excess loops, infinite exploits, and Veyra vs Shipping parity gaps (`M2_AUDIT_REPORT.md`, `M2_SIMULATION_RESULTS.json`).
- **M3 (WP3): Economic Tuning & Repair Design**
  - Concrete, non-breaking repair & rebalancing specification addressing every verified M2 finding (`M3_REBALANCE_SPEC.md`, `M3_BEFORE_AFTER_SIM.json`, `M3_RISK_REGISTER.md`), keeping `LOCKED_CANON` (`K1`–`K8`, `C01`–`C24`, `336h` wipe, `72h` Ragnarok, cash-only escrow) intact while fixing unobtainable chains, broken Veyra spawns/loot parity, currency sink curves, fuel/oil authority splits, and tier pacing.
- **M4 (WP4): Master Engineering Blueprint**
  - Implementation-ready PR-by-PR blueprint (`M4_MASTER_BLUEPRINT.md`), exact file diffs / schema contracts / acceptance tests / telemetry invariants / balance regression suites, plus `README.md` executive index across M1–M4.

---

## 2. Authority & Truth Rules

1. **SOH Live Codebase (`52f27959`) is the sole ground truth for current SOH mechanics.** Every node, edge, recipe, drop rate, cost, gate, and layout claim must cite exact TypeScript/JSON identifiers (`ITEMS`, `SOURCES`, `RECIPES`, `STRUCTS`, `CREATURES`, `ELDERS`, `PRIMORDIAL_ELDERS`, `BAL`, `engine.ts`, `sim.ts`, `veyra05/*`).
2. **Distinguish Scope Honestly:** Every flow must be explicitly classified by runtime applicability:
   - `LIVE_SHIPPING_AND_VEYRA`
   - `LIVE_SHIPPING_ONLY` (e.g., `airdropV1`, `creatorLootV1`, `lootEcology`, `webRecyclerSite`, `shipping` static keycard/power vaults, legacy wildlife/monsters not spawned in `veyra05/ecosystem.ts`)
   - `LIVE_VEYRA_ONLY` (e.g., 81-POI `veyra05` window streaming, `ARCHETYPE_LOOT`, `RCASH_BY_POI`, `VENDOR_POIS`, `EVAC_POIS`, 4 side bosses, 6 Primordial Elders, ordinary vampire/orc/slime habitats)
   - `TEST_FIXTURE_ONLY` (e.g., `oil_pump` / `pump_crude` / `crude_petroleum` / `refinery_crude` gated by `oilTestFixture === true` with `authority: 'test-fixture-v1'`)
   - `UNWIRED_ON_VEYRA` / `PARTIAL_STUB`
3. **Strict Provenance Discipline for Last Island Comparisons:**
   - `LIVE_VERIFIED_SOH` — verified directly in `web/src/**`
   - `LI_REPO_ARCHIVE_VERIFIED` — verified in `web/ref/atlas/**` / `web/ref/bible.md`
   - `LI_OFFICIAL_LIVE_VERIFIED` — fetched directly from `hero.yingxiong.com`
   - `LI_COMMUNITY_LIVE_VERIFIED` — fetched directly from `bbs.4399.cn` / `news.4399.com` / `taptap.cn`
   - `CAPTCHA_BLOCKED_AT_CHECK` — target URL returned anti-bot verification (`9game.cn`), never fabricated
   - `ORIGINAL_UNKNOWN` — historical LI number not verified in either repo archive or live official docs

---

## 3. Acceptance Criteria (Milestone M1)

1. `web/src/game/economic-graph.ts` compiles cleanly under `npm run typecheck` and `npm run typecheck:tests`, without altering `dist/index.html` (`npm run build`).
2. `SOH_ECONOMIC_GRAPH.json` covers 100% of `ITEMS`, `SOURCES`, `RECIPES`, `STRUCTS`, `CREATURES`, `ELDERS`, `PRIMORDIAL_ELDERS`, `VENDOR_SPARES`, `VENDOR_SECURED`, `CORE_STUDY`, `GARDEN_CROPS`, `TAMING_SPECIES`, `HUSBANDRY_YIELDS`, `BUTCHER_YIELDS`, `recycler` (`v1..v4` & `COMPONENT_RULES`), `SHIPPING_LOOT_SOURCES`, `airdropV1`, `journeyRequisitions`, and all 81 Veyra POIs (`sites.ts` authored caches + `floors.ts` `ARCHETYPE_LOOT`, `RCASH_BY_POI`, `VENDOR_POIS`, `EVAC_POIS`, `VEYRA_SIDE_BOSS_SITES`, `VEYRA_PRIMORDIAL_SITES`, `ORDINARY_CREATURE_HABITATS`).
3. Every graph edge validates cleanly with zero dangling node IDs, zero duplicate IDs, explicit quantities/rates/probabilities, explicit `gateIds`, and explicit `runtimeStatus`.
4. `SOH_LI_ECONOMIC_CROSSWALK.csv` explicitly reconciles every LI system (`S01..S17`), cross-system edge (`XEDGE-001..104`), gate (`A00..A31`), decision (`H01..H36`), unresolved gap (`U01..U12`), and live-fetched LI patch mechanic against SOH.
5. Running `npx vitest run tests/economic-network-m1.test.ts` deterministically validates all invariants and regenerates identical `SOH_ECONOMIC_GRAPH.json` and `SOH_LI_ECONOMIC_CROSSWALK.csv`.
