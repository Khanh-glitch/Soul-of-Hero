# MAP → Gameplay · MAP-LR01 Stage 1 geography handoff (Map-owned file)

**Status:** geography-only package, NOT a playable world. PR #44 remains DRAFT / HOLD; no merge, command or cross-branch write is authorized.

| pin | value |
|---|---|
| Map branch | `arena/2e3cfbd2-soul-of-hero` (this file is committed on that branch) |
| Geography package | `output/geography_package.v1.json`, schema `soh.map.lr01.geography_package.v1`, revision 1 |
| Revision digest | `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63` (SHA-256 over `body`) |
| Canonical Veyra | `19d8c6ec820f324a6ac12733165e43b5e2c6eab2` · `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` |
| GEO-01 / GEO-02 | `13ae97272edc47b0…` / `7377b97ad2cfe33d…` |
| PR #44 HEAD read at checkpoint | `f8010ec973095c88f3c462a68116c169b61237a3` (`2026-11-04T00:25:11Z`) |
| Comments read | 6608030530 (architecture ACK), 6606283007 (benchmark), 6619055192 (K6 handoff) |

**What Map supplies:** full 2000×1400 authoring frame (unchanged) with explicit
transform metadata (`UNDECIDED`); 579 stable source IDs and per-feature status;
8 landmasses / coastline / islands / beaches / wetlands / 5 lakes / 17 rivers /
watershed; elevation, slope, 12-code biome legend and transitions; 92 roads,
12 bridges, 27 docks, route graph at `SNAP_TOL=7`, 18 crossings, physical
road/deck/clearance PROPOSALS; 23 build sites + loading envelopes; 81 POI shells
with rooms, walls, floors, levels, entrances, portals, circulation, roof coverage
and spatial sockets (1701 stable IDs); 6 Elder territories/approaches/arenas and
15 separations; explicit UNKNOWN / PROPOSED / BLOCKED / UNRESOLVED states;
18 static 640×360 before/after/UI views and 11 individually assessed assets.

**What Gameplay owns and is NOT fabricated here:** resource population, source
stock, loot, cash, vendors, economy, locks/keys/power, generators, machines,
recipes, quests, weather, AI, dynamic door states, destruction, player
construction, vehicle/passability rules, persistence and `RuntimeMapPackage`
compilation.

**Compatibility:** PR #44 `GeographicHandoff` requires economy population,
cash/vendor/loot/power/door fields and calls `compileEconomy`; `RuntimeMapPackage`
requires a populated 200×200×16px runtime. Neither is the agreed geography-only
intake. The K6 handoff comment 6619055192 confirms this. Map does NOT
fabricate those fields. `docs/ADAPTER_SPEC.md` is the minimal later-adapter spec.

**Integration gate: OPEN.** No compatible geography-only intake seam and no
cross-branch write authorization; cross-branch push was intentionally NOT
attempted. Delivered instead: compiled geometry, verified transform metadata,
minimal adapter spec and executable isolated tests (`./reproduce.sh`).
**No acknowledgement of this MAP-LR01 handoff exists yet** — do not assume
receipt.

**Precise next step:** Creator approves the au->tile transform; Gameplay implements a geography-only intake seam that verifies this package digest and stable IDs, then Gameplay populates/simulates and compiles RuntimeMapPackage. Only after that can an exact-SHA worktree integration proof be attempted.

No cart-passable claim without clearance evidence; no approved scale (U=2 is
diagnostic only); no canonical rewrite; no visual approval; no playable
survival acceptance.
