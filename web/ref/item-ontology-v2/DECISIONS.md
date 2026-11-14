# Item Ontology V2 — design decisions, Last Island crosswalk, and migration

**Status: draft / partial implementation, not a declaration that every system is accepted.** Baseline checked before work: current HEAD `82089fea0b28ad1662f9f04496271b92c74c03a7`; `gh pr view 56` reports the referenced draft PR is still open at `934f4471326116737f206d2fb2d9a84ba77328da`, targeting `audit/item-recipe-network-20261112`. It is research baseline, not current HEAD. The active production registry remains `web/src/game/catalog.ts::ITEMS`; no parallel production catalog was added. The interactive viewer and complete generated item ledger are linked from `index.html` and `AUDIT.md`.

## Scope actually implemented in this increment

- Added a derived, testable graph over the current production registry: 123 item IDs, 89 recipe definitions, 215 input→output edges; co-products, alternate recipes, direct harvest, creatures, authored caches, loot-family tables, Garden output, animal product/butchery routes, recycler rules, Elder rewards, physical Ragnarok cash, starter knife, vendor exchange, and structure costs are accounted for.
- Formula depth is derived from fully sourceable alternatives. An item found in loot still retains the depth of its craft chain when it is craftable. Level 0 is assigned only when there is no recipe and a direct acquisition/production action exists. This is not station-level, research tier, or rarity.
- The existing keys `mechanical_parts` and `refined_iron_ingot` now display as **Parts** and **Refined Iron**. This is a display-name normalization, not an ID rewrite. The stable saved keys, recipes, balances, icon IDs, inventory custody, and output quantities are unchanged.
- The graph test enforces active catalog coverage, formula levels, cycle detection, and non-crafting uses. See `web/tests/item-ontology-v2.test.ts`.

## Last Island ↔ SOH crosswalk

Evidence baseline: the repository's structured Last Island Atlas and Master Research v5, which deliberately keeps modes/eras and uncertain data separated. The 2019–2020 LI component/POI mechanisms must not be combined with 2021/2023 recipes as if one version. SOH tuning values are not LI facts.

| LI concept / item | SOH match | Disposition | Basis and boundary |
|---|---|---|---|
| Parts | `mechanical_parts` (displayed as Parts; ID unchanged) | RENAME (display only) | LI Atlas v5 describes Parts as multi-use industry/research material. SOH Parts are a manufactured component and tool/device/repair input. They are **not** Spares: SOH Spares are a run-local research/trade currency with a distinct sink and source economy. Do not merge them or make research currency craftable through the Parts loop. |
| Wood | `wood`, `plank` | KEEP | Direct tree source, construction, tools, and fuel are existing SOH behavior. Plank is an SOH building material; no evidence justifies removing it or replacing its structural role. |
| Stone | `stone`, `brick` | KEEP | Direct node, construction, tools and furnace/building uses. Brick is a distinct processed construction input, not a duplicate Stone stack. |
| Iron / Iron Ore | `iron_ore`, `rich_iron_ore`, `iron_ingot` | KEEP | Mining, loot, furnace processing, alternate rich-ore route and tool/device progression already exist. Preserve existing source/recipe variants. |
| Refined Iron | `refined_iron_ingot` (displayed as Refined Iron) | RENAME (display only) | Same stable key. Explicit industrial intermediate for Pipe and Plate. This does not change the catalog ID or stored jobs. |
| Fuel | `wood`, `charcoal`, `coal`, `fuel_can`, `fuel_briquette`, `crude_petroleum`, `salvaged_oil`, `lubricant` | KEEP, separate source/use | These are not interchangeable grades: combustible fuel, canister, raw pumped petroleum, finite wreck salvage, and lubricant have different sources and consumers. Do not merge them just because multiple systems burn/use fuel. |
| Pipe | `metal_pipe` | KEEP | An explicit equipment intermediate, loot item, and versioned Recycler input. |
| Gear | `mechanical_gear` | KEEP | Distinct precision mechanism; recipe, loot, and versioned Recycler handling differ from Parts and Spares. |
| Plate | `iron_plate` | KEEP | Has a direct structural repair action in addition to being a recipe intermediate. It is not merely another Iron stack. |
| Blade | `metal_blade` | KEEP | A refit component with weapon construction, loot, and a pinned Recycler rule. Not a second generic Parts item. |
| Scrap | `scrap` | KEEP | Finite salvage/raw material with direct-source harvesting and recipes. Recycler/research/repair competition is intentional. It is not a synonym for Parts. |
| Spares | `spares` | KEEP / protected currency | SOH-specific run-local research and vendor economy. Scraps/crawler drops and authored loot provide it; it is spent in research and advanced equipment. Do not merge with mechanically craftable Parts: that risks a repeatable research-currency mint loop and changes the economy. |
| Fasteners | `fasteners` | KEEP pending stronger LI parity claim | Has its own wreck/loot and recipe sources, repairs/pack/canteen/equipment sinks. No separate exact LI `fasteners` item role is established by the LI recipe crosswalk in Master Research v5. Do not claim it is a LI-identical item or merge without source/function tests. |
| Torsion Spring | No SOH item | DEFER | LI-era weapon recipes use this component, but SOH has no corresponding gun platform/recipe chain in this ontology. Adding a component without a live gameplay source and sink would be padding. Revisit only with a designed SOH consumer. |
| Electronic Parts | No SOH item | DEFER | LI electrical recipes use this component. SOH already has power systems and functioning structures using its own recipe rules; an LI item name alone does not justify a new item. Defer unless the power-system design explicitly requires a separately sourced electronic intermediate. |
| Launcher mechanisms / firearm bodies | No SOH item | DEFER | Belong to LI firearms/weapon trees, not the current SOH weapon/Core structure. No speculative weapon suite added. |
| Research Parts as currency | `spares` + physical specimens/blueprints | KEEP distinct | LI research parts mechanism is useful as a model; SOH's Spares + specific samples + blueprint/access rules are a different system. No currency equivalence or costs copied across modes. |
| Recycler | SOH Foundry Recycler | KEEP | SOH recovery rules are version-pinned and are not sourced LI yields. LI Atlas explicitly leaves per-item yields unknown; do not assign LI yield percentages to SOH. |
| Core/Essence energy | seven Creator Cores, Basic/Refined Energy and four Essences | KEEP | This is a distinctive, implemented SOH axis with load/action semantics; no LI component rename or invented Core ore. |
| Card / blueprint / Elder reward / Ragnarok cash | SOH systems | KEEP | Unique progression, knowledge, access, physical-currency and end-of-run roles; do not treat as generic craft items. |
| Energy Ore / five Core-energy-vein forms | None | DEFER / BACKLOG | Explicitly unapproved by the request. No item, recipe, source node, map location, probability, yield, cooldown, or cost added. |

### LI source/mode notes

- `web/ref/atlas/extracted/LI_MASTER_RESEARCH_REPORT_v5.md` §1–§5 documents the source graph, industry materials, production chains and recipe BOM; §5 states the one-output BOM assumption and says it is not a confirmed yield for every recipe.
- The same report §6 preserves loot/container relationships and unknown probabilities; §7–§8 preserve market/source gaps. Atlas v5 includes mode/era provenance and explicit uncertainty rather than mixing late-era features into the 2019–2020 baseline.
- `web/ref/atlas/extracted/BAO_CAO_CHUYEN_SAU_v2.md` §1 describes recurrent intermediate function; §2 gives source-aware industrial BOMs. `BAO_CAO_CO_CHE_CHUYEN_SAU_v4.md` §3 distinguishes Energy Extractor and Energy Refinery; that is research only, not approval to implement either in SOH.
- `web/ref/bible.md` §§VI–VII and its source coverage table specify that Last Island evidence is a mechanism reference, not automatic SOH approval; current SOH power, heat, research, R&D currency and timing decisions remain distinct.
- Historical official LI evidence referenced by the Bible includes (mode/year-specific): `https://hero.yingxiong.com/info/2019/0730/6973.html`, `https://hero.yingxiong.com/info/2020/0108/8968.html`, and `https://hero.yingxiong.com/info/2020/0429/9792.html`. The repo Atlas contains the detailed source manifest. This increment did not infer probabilities or claim a current LI build was independently launched.

## Complete dispositions and count

The generated `AUDIT.md` includes every current item ID, current display name, source provenance, recipe inputs/outputs, consumers, formula level, and per-item disposition. **Before:** 123 item IDs / 89 recipe definitions. **After:** 123 IDs / 89 recipes. Two display names changed; zero item keys or recipes were added, removed, or merged. All other IDs are KEEP. Zero merge is intentional: no two candidates have been shown to share source, role, and consumer behavior without harming game loops. No item is marked RETIRE_NEW_RUNS because safe removal would require an authorized per-key save/job migration and proof of no special/system consumer.

Craft-depth distribution from the sourceable graph: **Level 0: 48; Level 1: 28; Level 2: 34; Level 3: 8; Level 4: 1; special/no formula depth: 4.** The four special-only items are non-recipe action/reward objects, not dangling recipe ingredients. Active recipe graph diagnostics: **0 cycles, 0 unknown item keys, 0 unresolved item source routes**. The graph includes alternative recipes, co-products and direct sources; level counts do not equate loot scarcity or required station.

## Source → item → recipe → consumer audit coverage

The full generated matrix is in `AUDIT.md`/`graph.json`. Captured provenance sources include resource node yields and bonus yields; creature drops and unique rewards; defined loot grammar/tables; authored Shipping cache literals and data-driven POI cache contents; Garden production outputs; Elder/Primordial Elder rewards; new-run knife, finite POI cash, vendor exchange and the explicit wreck salvage action; Recycler v1/v2/v3 recovery and component rules; recipes; structure material costs; repair/salvage, fuel, eating/drinking, equipment, Core loading, blueprint/research and placeable-item use.

Husbandry's product/butchery routes are accounted for as renewable animal yields and physical carcass action, not as recipes. World/source labels identify source classes and authored identities only; they do not assert a fresh map coordinate, respawn, loot chance, or item quantity. Time/chance data are not derived from source existence.

## Save, inventory, and job migration policy

No save key migration is required for these display labels: all persisted `Stack.key` values remain `mechanical_parts` / `refined_iron_ingot`; stack UID, quantity, `dur`, `charge`, `meta`, Core reserve and container custody are untouched. Saved inventory, equipment, chests, drops, building costs, blueprint references, research keys, and item-level receipts resolve through the same stable IDs. Existing in-progress craft and Recycler jobs retain their stored recipe/recovery revision; no historical recipe table or Recycler key was edited.

No automatic compensation or conversion is performed. No item is deleted, granted, consumed, or moved. No save schema bump is made. If a later approved change actually removes/merges an ID or changes a recipe, the required migration must be explicit and idempotent: preserve every stack UID and mutable field; map only the key; handle split stacks/max-stack overflow without loss; pin queued jobs/outputs to the recipe revision they started with; preserve blueprint knowledge, run progress, placed-entity item identity and unique progression; reject unknown IDs fail-closed rather than silently drop or mint items. That policy is not a substitute for running those migrations; none are needed by this change.

## Industry paths and work intentionally left pending

- **New run → knife/wood/stone → tools/building:** existing initial knife and gatherable nodes; plank and building recipes remain untouched. The graph does not simulate combat/path safety.
- **Loot → Parts → research:** authored caches/wrecks/recycler feed salvage; Parts remains distinct from Spares, which is the research currency. The current economic graph accounts inputs/sinks, not research ROI or endless-run performance.
- **Ore → metallurgy → equipment:** Ore→Iron/Refined Iron→tools, devices, Pipe/Gear/Plate/Blade remains existing recipes; graph check proves key reachability, not balance or station progression.
- **Pipe/Gear/Plate/Blade → crafting/loot/Recycler:** all current alternate recipes and pinned salvage routes are represented. LI recycler yields remain unknown.
- **Farming/offline production:** Sunroot/Bitterleaf output and seed returns are modeled from `GARDEN_CROPS`; pump/controller, water, weather, offline catch-up remain existing gameplay, not changed here.
- **Husbandry:** food/water/adult/pair/birth/renewable yield/butchery action is separate from crafting. Product tables are explicitly provisional SOH rules, not LI parity.
- **Survival:** food/water container, medicine, armor, cold/radiation, repair and fuel uses appear as sinks. Need native gameplay route evidence still.
- **Power, traps, structures:** `STRUCTS` costs + existing systems are preserved; no new electronics item was inferred.
- **Vehicles:** frame/drive/kit/fuel/repair and lubricant use are captured; no economic rebalance was applied.
- **Creator Core:** seven Core IDs, two energy tiers and four Essence types remain. Energy Ore and all five vein forms remain backlog-only.

## Acceptance limits / next approval gates

This is not the requested full system reset. No broad recipe/material consolidation, recipe-cost rebalance, deletion, save-version migration, full gameplay audit, Native test, or gameplay screenshot was performed. A Playwright screenshot attempt was blocked because the sandbox has no installed Chromium executable; Godot is also absent. Several input systems use separate action tables (not recipes) and should be exercised in game. A graph's structural reachability is not proof that a player can earn enough inputs or access a specific source in a fresh run. Open decisions: should LI-like Parts serve every R&D sink or should SOH retain the protected Spares currency; should fasteners survive V2 after telemetry of all consumers; and whether future circuit/spring/gun components have approved SOH systems. Until those decisions and cross-system native acceptance exist, exact material consolidation is deferred.
