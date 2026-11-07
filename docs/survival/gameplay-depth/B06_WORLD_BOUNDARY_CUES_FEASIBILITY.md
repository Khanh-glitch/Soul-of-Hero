# B06 — World boundary, presentation cues, persistent-world feasibility

Linked from `CAPABILITY_LEDGER_W00.md` (section "B06 Gameplay Tower round"). Not a second Bible: `web/ref/bible.md` remains authoritative. Nothing here changes canon (336h run / 72h Ragnarok / wipe, PvE, offline, cash, Creator Core).

Status vocabulary follows the round brief: `ENGINE_IMPLEMENTED`, `SOURCE_AND_SINK_VERIFIED`, `REAL_UI_INPUT_PROVEN`, `DURABLE_RELOAD_PROVEN`, `MAP_OR_WORLD_DEPENDENT`, `VISUAL_ACCEPTANCE_PENDING`, `NATURAL_PLAY_PENDING`, `PARTIAL_CAUSAL_CHAIN`, `ACTUALLY_MISSING`, `DESIGN_DECISION_PENDING`.

## 1. System-level reconciliation (18 ledger systems, not yet the 214-row v11 audit)

Scope honesty: the full 214-capability / 104-edge reconciliation against Atlas v11 is NOT complete. The v10 core-action CSV is available in the Atlas tree; the v11 capability table was not re-read in this round. The table below reconciles the 18 SYS sections of the ledger against code at `HEAD` and records the gap per system.

| System | Actual implementation (evidence) | Statuses | Remaining gap |
|---|---|---|---|
| SYS01 tools/weapons | `engine.ts` tool.break receipt (durability), combat | ENGINE_IMPLEMENTED, DURABLE_RELOAD_PROVEN (save tests) | per-material effect matrix not audited |
| SYS02 metallurgy | furnace/refinery intermediates in catalog | ENGINE_IMPLEMENTED | producer→consumer edges not all traced |
| SYS03 recycler | `recycler.ts`, `recycle.finish` receipt, C2 single-site rule | SOURCE_AND_SINK_VERIFIED | per-item yield ORIGINAL_UNKNOWN |
| SYS04 workbench | `station.state`, `job.done` receipts | ENGINE_IMPLEMENTED | visual states pending |
| SYS05 POI access | `poi-access.ts`, `poi.door.close`, `poi.power.expire` | ENGINE_IMPLEMENTED | only Foundry/Lighthouse-class POIs in the test save |
| SYS06 power | `power.fuel` receipt, generator fuel consumption | SOURCE_AND_SINK_VERIFIED | fuel-consistency P0 at `029db4a0` |
| SYS07 building/upkeep | `territory.upkeep`, `territory.collapse`, `struct.destroyed` | ENGINE_IMPLEMENTED | offline chronology audit (C2) not finished |
| SYS08 defense/PvE | `turret.fire`, `trap.trigger`, `stimulus.*` | PARTIAL_CAUSAL_CHAIN | creature trace/pursuit depth not played naturally |
| SYS09 transport | motorbike, cart, parcel; `b00ec72c`, durable at `519c4d9d` | DURABLE_RELOAD_PROVEN (Vendor Freight scope) | motorbike ART not accepted (Visual Arena) |
| SYS10 oil/refinery | pump fixture extraction `pump.extract`; refinery idle/lit | PARTIAL_CAUSAL_CHAIN, MAP_OR_WORLD_DEPENDENT | no authenticated oil-source site; no real-map production |
| SYS11 world loot | `loot.roll`, `loot.depleted`, `loot.respawn` | ENGINE_IMPLEMENTED | respawn cadence per-biome not tuned |
| SYS12 airdrop | `airdrop.*` receipts, landing site rules | ENGINE_IMPLEMENTED | physical reach from a real landing zone needs map |
| SYS13 Core energy | `core.commit` (charge and reserve) | PARTIAL_CAUSAL_CHAIN | 21-action effect audit not done (see §4) |
| SYS14 research | blueprint/research code | ENGINE_IMPLEMENTED | untouched this round |
| SYS15 survival/ecology | `heat.out`, `heat.shelter_lost`, `fire.*`, `tender.*` | ENGINE_IMPLEMENTED | offline chronology audit not finished |
| SYS16 geography | `geography-contract.ts`, `map-package.ts` (exact 200×200 gate) | MAP_OR_WORLD_DEPENDENT | see §2 |
| SYS17 run/death/offline/Ragnarok | `offline.settle`, `elder.*`, `run.start`; 336h/72h canon | ENGINE_IMPLEMENTED | persistent-world model DESIGN_DECISION_PENDING (§5) |
| SYS18 scarcity market | `vendor` stock, secured cash | SOURCE_AND_SINK_VERIFIED (Vendor Freight scope) | run-local economy tuning not audited |

Ranked gap backlog (by unlock count and player decision, not by novelty):
1. Core action effect audit (21 actions): gates SYS13, SYS08, SYS15 edges.
2. Offline chronology audit (C2): gates home→offline→return for SYS07/15/06.
3. POI reusable mechanisms without final coordinates (C3): gates SYS05/11/12.
4. Real multi-window runtime (§2 B2): gated by Map handoff (§3).
5. Oil source binding interface (C1): Map-gated.

## 2. Large-world integration boundary (B1)

Dangerous assumptions found in the current tree (counts from `web/src/game`):

- **Fixed window size.** `WW`/`WH` = 200 appear in about 211 places (`core.ts` constants). `map-package.ts` rejects any package whose geometry is not exactly 200×200 (`resize is not supported`). Every raster (`tiles`, `fresh`, `zone`, `seaDist`, `src`, `sourceOverlayV2`, economy arrays) is a `Uint8Array`/`Int8Array(WW*WH)`.
- **Local integer cell encoding.** Statics, buildings and places use `ty*WW+tx` and local `tx/ty`. This is valid only inside one window.
- **Entity coordinates are window-local tile/pixel coordinates.** Entities, creatures, the player, cart and motorbike have no global frame. A vehicle leaving the window has no defined continuation.
- **Digest is a 32-bit FNV over the full JSON.** `mapDigest` is explicitly an accidental-change guard, not an identity. Collision risk is low but nonzero; it must not become a security or revision authority.
- **Local-only discovery.** Creature perception, `findInteract`, loot ecology and stimulus routing iterate the active world only. Off-window simulation does not exist.
- **Source identities.** `sourceV3` and legacy `src` IDs are indexes into the current window; a global source ID scheme does not exist yet.
- **Receipts.** The 250-entry receipt log can drop old entries; the read-model sink (`beginReceiptSink`) is the only lossless path and is ephemeral.
- **Save authority.** One key (`soh.state.v3`) holds the whole run; there is no per-window or per-chunk record.

## 3. Compatibility seam implemented (B2) and Map handoff contract (B3)

Implemented, additive, pure (`web/src/game/world-window.ts`, tests `web/tests/b06-world-window.test.ts`, 8/8):
- chunk identity (32×32), global ↔ local conversion, collision-free global cell keys over the PENDING 4000×2800 frame (`PENDING_MAP_FRAME`, not used by runtime);
- a boundary-crossing function that reports a window change only when the chunk changes;
- `GlobalCellStore`: a global-keyed persistent record (depletion, owned UID) that survives JSON round-trip, rejects malformed or duplicate keys;
- `acceptWindow`: a window attaches only to the exact map id, revision and digest it was authored for (safe rejection).

NOT done (honest): the runtime is still one 200×200 window. Two live adjacent windows, player traversal between them, vehicle crossing and cargo migration are NOT implemented. `GlobalCellStore` is not wired into `engine.ts`, `persist.ts` or `render.ts`. No save format changed. The seam proves the arithmetic and identity rules only.

Map handoff (authored by Map, not invented by Gameplay). Required versioned fields:
- regions and biomes; player spawn eligibility;
- roads, bridges, ports and traversable passages (cells, width, cargo passability);
- building footprints, floors, entrances and stairs;
- POI doors, electricity nodes, hazards, interior and exterior loot positions;
- finite or regenerating resources with stable source IDs;
- oil-source sites (versioned, authenticated; none exist yet, so no oil production claim);
- airdrop landing eligibility; Elder locations and event regions;
- construction and vehicle traversal constraints.

Gameplay may DERIVE: pathing, reach, line-of-sight, perception, cargo passability checks, digest acceptance. Gameplay must NEVER author coordinates for any of the above. The existing validator (`validateGeographicHandoff`) already enforces most of this shape for one window.

## 4. Presentation cue contract (Package D)

Implemented: `web/src/game/presentation-cues.ts` (tests `web/tests/b06-presentation-cues.test.ts`, 4/4). It derives typed cues from already-committed receipts only. It does not add state or decide outcomes. Each cue carries `cause` (receipt kind), `receiptId`, `at`, `subject`, `detail`.

Mapped kinds (verified literal receipt calls): `job.done`→`station_job_done`; `station.state`→`station_state_changed`; `power.fuel`→`power_fuel_consumed`; `core.commit`→`core_committed`; `struct.destroyed`→`structure_destroyed`; `territory.collapse`→`territory_collapsed`; `poi.door.close`→`poi_door_closed`; `poi.power.expire`→`poi_power_expired`; `loot.depleted`/`loot.respawn`→`loot_depleted`/`loot_respawned`; `tool.break`→`tool_broke`; `heat.out`→`heat_out`; `offline.settle`→`offline_settled`; `elder.defeat`→`elder_defeated`; `airdrop.landed`→`airdrop_landed`; `recycle.finish`→`recycle_finished`; `pump.extract`→`oil_extracted`; `turret.fire`→`turret_fired`.

Not yet cues (need new authoritative state, not invented here): `station_starved_of_fuel`, `motorbike_out_of_fuel`, `door_unpowered`, `cart_overloaded`, `research_completed`, and refusal reasons. These are the next Gameplay work: each needs a committed receipt or a state transition first.

## 5. Persistent-world feasibility (design only; canon unchanged)

| Dimension | A. Current solo 336h + wipe | B. Persistent solo + recurring Ragnarok | C. Persistent shared PvE |
|---|---|---|---|
| WorldState | one run blob in `soh.state.v3` | must split world from character | server-authoritative world |
| CharacterState | same blob | separate, portable | per-player, server-held |
| ProfileState | profile in same persistence path | unchanged role | account-level, server |
| Persistent UID | per-run | needs world-scoped UID ownership | required, server-issued |
| Cycles | 336h run, 72h Ragnarok, wipe | recurring Ragnarok, no wipe | shared schedule |
| Decay / abandonment | none beyond upkeep | needed (cabinet, weather, decay) | needed, plus claim rules |
| Economy inflation | run-local | needs long-term sinks | needs global sinks, anti-dupe |
| Offline fairness | per-player offline settle | home defense becomes mandatory | server settle with fairness rules |
| Save size / perf | one window | needs chunked saves (§2) | chunked + streaming, server cost |
| Legacy migration | preserved | reversible migration required | migration plus account linking |

Preservable modules: physical custody and UID rules, receipts, the Vendor Freight engine (`b00ec72c`), durable save diagnostics, map package validation. Must be refactored: `persist.ts` single-blob authority, window-local coordinates, `endRun()` wipe path, offline settle per run.

Explicitly NOT done: no multiplayer, no wipe removal, no Ragnarok change, no backend. Creator decision required before any of B or C.

## 6. Verification in this round

- `tsc --noEmit`: 0 (after the new modules).
- `web/tests/b06-world-window.test.ts` 8/8; `web/tests/b06-presentation-cues.test.ts` 4/4.
- Not run in this round: full Vitest, HTTP build, browser proof. These are required at the final SHA before the round can be reported complete.

## 7. First executable action for the next Gameplay round

Run the Core 21-action effect audit: for each action, record the committed receipt, the target legality check, the charge expenditure and the save path, then add the missing receipt or negative test for any action whose effect is not visible in state. This unlocks SYS13 and the SYS08/SYS15 edges without touching the Visual Arena.
