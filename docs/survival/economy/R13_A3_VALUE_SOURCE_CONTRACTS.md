# R13 A3 — physical source contract (v2, supersedes the v1 owner-string model)

**Status:** implemented on `arena/daadd745-soul-of-hero`; Quarry **CLOSED**.
**Supersedes:** the v1 text of this file, which documented fabricated source ids
(`roadside_oak_1`, `roadside_stone_1`, `roadside_iron_1`, `quarry_deep_1`) and an
`authenticate_source(source_id, "A1")` call that compared a caller-supplied string.
That model is deleted: `game/survival/economy/roadside_source.gd` and
`quarry_source.gd` are removed, and no code path can mint a grant from an owner string.

## 1. What a physical source is

A physical source is one **pinned A1 binding** plus a **live receipt from the composed
A0/A1 world host**. There are exactly five bindings in
`data/survival/items/world_source_bindings.v3.json`
(SHA-256 recorded at runtime in `bindings_document_sha256()`):

| binding_id | POI / instance | action | reward | repeats |
|---|---|---|---|---|
| `a1_waystation_roadside_cache_v3` | `poi_crown_waystation` / `si:r_ashen_crown:waystation_cache:01` | `cache_restock` | `iron_scrap` ×3, `knowledge_spares` ×2 | 1800 active s cooldown |
| `a1_waystation_approach_deadfall_v3` | `poi_crown_waystation` / `…deadfall:01` | `gather_deadfall` | `oak_wood` ×2 | 300 active s cooldown |
| `a1_roadside_notes_01_v4` | roadmap cell | `salvage_roadside_notes` | `research_notes` ×1 | 1800 active s cooldown |
| `a1_roadside_salvage_02_v5` | roadmap cell | salvage | `iron_scrap` ×3, `knowledge_spares` ×2 | `max_claims = 1` |
| `a1_roadside_timber_03_v5` | roadmap cell | timber | `oak_wood` ×2, `research_notes` ×1 | `max_claims = 1` |

Supply is finite by construction: **two of the five bindings are one-time**
(`max_claims = 1`: `a1_roadside_salvage_02_v5`, `a1_roadside_timber_03_v5`) and the
**three renewable bindings are active-cooldown** — `a1_waystation_roadside_cache_v3` at
**1800 s**, `a1_waystation_approach_deadfall_v3` at **300 s** and `a1_roadside_notes_01_v4`
at **1800 s** — each charging real **active** seconds from the A0 clock. There is no sixth
source, and `quarry_deep_1` is now simply `UNKNOWN_SOURCE_BINDING`.

The earlier text of this file said "three one-time and two renewable". That was wrong in
both directions: it over-counted one-time supply by one and under-counted cooldown
supply by one, which made the knowledge route look poorer than the data allows and the
material route look scarcer than it is. The table above is the truth; no binding was
changed to fit the wording.

## 2. The receipt (`soh.economy.source_receipt.v1`)

A source host returns exactly these 13 fields:

```
contract, source_id, owner, poi_id, instance_id, action_id, binding_identity,
host_session_id, host_sequence, hero_cell, discovered, active_seconds,
a8_authorization_sha256
```

`a3_economy_service.authenticate_source(receipt)` accepts it only when **all** of the
following hold, otherwise it returns `{ok:false, reason:<code>}` and writes nothing:

| Gate | Rejection |
|---|---|
| 13 fields present, no unknown keys | `SOURCE_RECEIPT_MISSING_FIELD` / `…UNEXPECTED_FIELD` |
| `source_id` is a pinned binding | `UNKNOWN_SOURCE_BINDING` |
| `binding_identity` == the binding's `identity` | `BINDING_IDENTITY_MISMATCH` |
| `poi_id`, `instance_id`, `action_id` == the binding's values | `BINDING_FIELD_MISMATCH:<field>` |
| `owner` == the binding's `a1_source_class_id` (a class id, **not** a domain string) | `BINDING_OWNER_MISSING` / `OWNER_DOMAIN_REJECTED` |
| `hero_cell` ∈ the binding's `stand_cells` | `OUT_OF_RANGE` |
| `discovered == true` | `NOT_DISCOVERED` |
| source is not the A8 Quarry POI | `A8_QUARRY_NOT_AUTHORIZED` |
| the host is mounted and answers | `SOURCE_HOST_UNAVAILABLE` |
| **the receipt equals the host's current answer field-for-field** | `SOURCE_RECEIPT_MISMATCH:<field>` |

The last row is the security property. A caller may read the binding document and build a
plausible dictionary, but the service re-calls the injected composition-root host and
compares; a caller-constructed receipt, a stale receipt and a receipt with a raised
`active_seconds` all fail. `owner` is a *consistency* check against pinned A1 data, never
an authority: no test, and no code path, grants anything because a string said `"A1"`.

## 2b. Measured source → research → production opportunity cost

No reward rate was changed for this section. Every number below is read from the pinned
documents and the canonical constants, so the two routes can be compared on the same
clock instead of on prose.

**Sustained Spares income.** `knowledge_spares` comes from exactly two bindings: the
waystation cache (`×2` per 1800 active s) and the one-time roadside salvage (`×2`,
`max_claims = 1`). There is no third source, so the steady-state rate is
**2 Spares / 1800 active s**; the one-time pair is a finite opening bonus, not a rate.

**Research notes income.** `research_notes` comes from the notes binding (`×1` per
1800 active s) plus the one-time timber binding (`×1`, `max_claims = 1`):
**1 note / 1800 active s** sustained.

**Route A — blueprint (targeted) research.** `research_cost` is per recipe, paid in
physical Spares/notes, and the job runs on the research station:

| recipe | Spares | notes | active s of source play to fund it | research ticks (fixed `40` on the research station) |
|---|---|---|---|---|
| `iron_pick` | 3 | 1 | 2700 | 40 |
| `sort_core_fragments` | 4 | 1 | 3600 | 40 |
| `process_roadside_materials` | 6 | 2 | 5400 | 40 |

The player picks the target and pays a price that scales with how central the recipe is
to the material route, so targeted research is *predictable but expensive*.

**Route B — bounded random Spares research (new, third mechanism).**
`SPARES_RESEARCH_SPARES_COST = 4`, `SPARES_RESEARCH_DURATION_TICKS = 40`,
`SPARES_RESEARCH_STATION_KIND = "research"`, `SPARES_RESEARCH_MIN_TIER = 1`:

| property | value |
|---|---|
| price | 4 physical Spares ⇒ **3600 active s** of sustained cache restocking |
| time | 40 research-station ticks, real processing, no shortcut |
| outcome | one uniform draw over the *unknown* recipes in a bounded pool, committed at enqueue |
| initial pool | 9 recipes (`frost_cloak`, `garden_kit`, `iron_pick`, `minor_salve`, `process_roadside_materials`, `salvage_hammer`, `sort_core_fragments`, `toxin_mask`, `grow_grain`) out of 23 `knowledge == "recipe"` entries; the other 14 are technology-gated and enter the pool only once their technology is researched |
| failure | unaffordable ⇒ `insufficient_inputs`; wrong station ⇒ `station_unavailable`; empty pool ⇒ `no_eligible_recipe`; every one of these spends **nothing** and creates **no** job |

**Why neither route is artificially favoured.** Random research is the *cheap* option and
blueprint research is the *decisive* one, and the exchange rate is measured rather than
asserted:

- Random costs 4 Spares (3600 active s) and always buys a recipe the player did not
  choose; over the full 9-recipe opening pool it takes on average **9 × 3600 = 32,400
  active s** to guarantee a specific target.
- Targeted costs 3–6 Spares plus 1–2 notes (2700–5400 active s of source play) and buys
  that exact target immediately.
- So the random route is cheaper per attempt only while the pool is wide, and the
  expected cost of *choosing* a target randomly is strictly worse than paying for it.
  Neither number was retuned to manufacture that ordering; it falls out of the pinned
  `research_cost` table and the pinned binding rewards.
- Because the pool shrinks as recipes are learned, a player who keeps drawing converges
  on the same total spend for the same knowledge — random research is a cheaper **entry**
  into the knowledge route, not a bypass of it.

**Production side, for symmetry.** The material route pays its source tax in bulk
materials with different clock behaviour: `process_roadside_materials` consumes
`oak_wood ×5` (deadfall, 2 per 300 active s ⇒ 750 active s) and `iron_scrap ×3` on top of
its research cost, then `sort_core_fragments` charges a further 10 fragments plus 2
Spares per `core_blank`. The material route therefore trades a *lower* research tax for a
*higher* repeat material tax, which is the shape the two-route design intends.

Any future change to these rates needs its own measured justification round; nothing in
this section licenses a silent retune.

## 3. Harvest

`harvest(source_id, tool_instance_id, receipt)` authenticates, then checks, in order:
tool instance exists and is a tool (`UNKNOWN_TOOL`), condition > 0 (`TOOL_BROKEN`),
capability, cooldown from real active seconds (`COOLDOWN_ACTIVE`), remaining claims
(`SOURCE_EXHAUSTED`), canonical `world_action` receipt absent
(`CANONICAL_CLAIM_ALREADY_SETTLED`), stack space (`INVENTORY_FULL`). Everything — wear
(20 points per claim, clamped at 0), rewards, claim counter, source receipt and the
discovery record — is applied in **one** `SaveService.transact_once` mutator keyed
`soh.a3.source_claim.<source_id>.<n>`. A replay of the same key is refused by A0
idempotency, so a claim can never pay twice. `harvest` returns `ok:false` together with
`reason`, and the candidate is discarded by A0 on any `false`.

## 4. Quarry

`docs/survival/economy/A8_QUARRY_AUTHORIZATION_V4.json` is `REJECTED_PENDING_EVIDENCE_FAIL_CLOSED`.
The service hashes that document at configure time (`a8_authorization()`), refuses the
Quarry POI unconditionally, and exposes no Quarry reward, cost or POI state. A8 must ship a
new document with a new SHA **and** a real durable site instance before the seam opens.
No A8 reward, no POI arrival and no Core ownership is fabricated anywhere.

## 5. Consumer instructions

### A0 (SaveService)
No changes. A3 uses `transact_once`, `grant_inventory_item`, `consume_inventory_item`,
`is_transaction_applied`, `get_snapshot`, and reads `applied_transactions`. A0 stays the
only mutator/composer and the only writer of `inventory.item_stacks`.

### A1 (world host)
Provide one callable returning the receipt above for a source id, derived from the live
world slice (discovery state, hero stand cell, active seconds, the A1 pinned binding).
Do not return domain strings. If the world host cannot answer, A3 fails closed.

### A8 (POI scenes)
Must supply: durable instance + native reload proof, collision proof for two competitive
routes, and an APPROVED authorization SHA. Until then, Quarry attempts are refused.

### A6 (UI, read-only)
`get_projections()` reports source authentication state, remaining claims, cooldown,
knowledge state, fuel costs, queue time and discovered materials. UI flags never
authorise a mutation.

## 6. Negative evidence (all executed in `tests/survival/a3_value_economy_test.gd`)

| Case | Expected |
|---|---|
| Empty dictionary | `SOURCE_RECEIPT_MISSING_FIELD` |
| Owner string only (`{"source_id","owner":"A1"}`) | `SOURCE_RECEIPT_MISSING_FIELD` — no shape, no auth |
| Complete receipt, `owner` forced to `"A1"` | `OWNER_DOMAIN_REJECTED` |
| Caller-raised `active_seconds` | `SOURCE_RECEIPT_MISMATCH:active_seconds` |
| Hero cell off the binding | `OUT_OF_RANGE` |
| `discovered=false` | `NOT_DISCOVERED` |
| Fabricated `quarry_deep_1` | `UNKNOWN_SOURCE_BINDING` |
| Real Quarry POI | `A8_QUARRY_NOT_AUTHORIZED` |
| Mounted host absent | `SOURCE_HOST_UNAVAILABLE` |
| Harvest before authentication | `SOURCE_NOT_AUTHENTICATED` |
| Broken tool (condition 0) | `TOOL_BROKEN` |
| Source within cooldown | `COOLDOWN_ACTIVE` |
| One-time binding already claimed | `SOURCE_EXHAUSTED` |
| Full bag | `INVENTORY_FULL`, nothing written |
| Disk write obstruction | transaction fails, inventory unchanged, no receipt |
