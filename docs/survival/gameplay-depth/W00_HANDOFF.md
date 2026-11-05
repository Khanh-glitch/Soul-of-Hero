# Gameplay depth W00 — historical checkpoint, HOLD

> Historical checkpoint only. For changes and current program gates see [V15 handoff](V15_HANDOFF.md). Statements below are not current implementation or validation claims.

## Ownership and revisions

- Gameplay owner: branch `arena/d4bfcfff-soul-of-hero`, baseline `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4`; W00 code/evidence is in the commit containing this file. PR #44 remains **OPEN / DRAFT / HOLD — no merge**.
- Map owner: `arena/2e3cfbd2-soul-of-hero` at `fdd4a2bae9f81a3c1d8c63d091b6fe23265c7584`. WMP-04R1 geography is data, not Gameplay or art acceptance. No Map files changed.
- AVFX owner: `arena/3337c864-soul-of-hero` at `3158f0c427570794e6d69fe72c1f701b26ceb384` (PR #39). No AVFX files changed or integrated; its six redesigns/five fusions remain candidates awaiting Creator review.
- Bible source is the baseline above; surviving Atlas source `feature/survival-rpg-foundation-20261029` at `a8c718b55130cff29b3adc5e7c531f9211ca22df`. The 22 exact fetched paths, hashes and SHAs are in `W00_GITHUB_SOURCE_MANIFEST.json`. This round fetched all, inspected headings and selected passages; **complete reading is outstanding**. Five historical official articles were accessible; the sixth 9game ammo page returned CAPTCHA. No historical v5/v6 ZIP recovery is claimed.

## Changed capability and implementation

- Working capability IDs `SYS11-01` through `SYS11-03` in `CAPABILITY_LEDGER_W00.md`: retain existing withdraw-only checks; on a successful final move, drop or use of an authored public loot crate, remove its physical entity and empty container, record its authored tile in the optional run-local `depletedLootSites` ledger, and emit one `loot.depleted` receipt. The panel identifies withdrawal-only custody; an emptied open panel closes. Partially looted stock and UIDs remain physical and persistent.
- Save validation accepts a recorded retired authored site without an entity, rejects duplicates, unknown tiles, a live entity for a retired tile and absent unrecorded identity-pinned sites. This is an additive field: real pre-existing Shipping saves with/without a source map digest validate and can retire their own original starter crate. Existing empty containers are not retrospectively assumed to be depleted; finite Ragnarok cash is not retired or regenerated. Successful intents and their IDs remain in the same save state, but abrupt power-loss timing is not newly proven.
- This is **not full public-loot lifecycle**: newly emptied sites are one-shot in this slice; typed ordinary respawn, fresh new UIDs, cooldowns, offline chronology and no-cash-respawn acceptance remain unimplemented. No loot tables, balances or resource quantities changed; no Map placement or art choice invented. Existing authored contents are source data, not new historical LI tuning.
- `CAPABILITY_LEDGER_W00.md` is a provisional 214-row internal inventory, **not verified as a one-to-one transcription of the Creator's actual enumeration**. Reconcile before treating its IDs as canonical. `CAUSAL_GRAPH_W00.md` maps all Bible-indexed historical DEP-01…31 to typed candidate edges and SOH exclusions, but is not a completed evidence audit or proof the causal chains function. No Creator values were altered.

## Evidence and limits

- Controlled fixture tests: `web/tests/public-loot-lifecycle.test.ts` covers deposits/auto-merge/swap rejected without mutation, split withdrawal, final transaction replay before/after save, malformed ledger, missing site, live/depleted conflict, direct consumption/drop, legacy empty behavior and old Shipping snapshots. Proximity is positioned in tests; it is not a natural route. These are not exhaustive abuse, storage-failure, cash-withdrawal or owned-chest tests.
- Fresh Shipping run, keyboard/mouse inputs with **read-only assisted pathfinding** (not independent human play): `web/evidence/gameplay-depth-w00/loot-natural.json` and 640×360 captures. At Old Mill, crate `el`/container `cm` held Leather×2 UID `sn` and Brick blueprint UID `so`. After 28 planned path positions, right-click moved Leather; the blueprint remained visible. Take all moved the blueprint; the entity disappeared, ledger site `19726`, receipt `loot.depleted`, both original UIDs in inventory. Save & quit → Continue retained the inventory and retirement; no browser page errors. Early blind screenshots and the scripts are included. This one assisted segment is not one of the 20 independently reviewed natural journeys. No death occurred in this segment. Offline catch-up on Continue recorded 14 seconds before the crate trip; no loot respawn is claimed.
- Prior M-CORE-03T death/bag-recovery/workbench evidence remains `web/evidence/m-core-03t/`; it does not prove new Core crafting/armor. The earlier profile is hazardous and was not touched by W00.
- Regression: 28 files / 233 tests passed, including all 5 W00 tests; TypeScript, production build, `git diff --check`, and production dependency audit passed. Browser screenshots have not been approved by a human.

## All system statuses (program level, not individual test verdicts)

| System | Status / important remaining work |
|---|---|
| Everyday tools/weapons | PARTIAL — natural combat/material/repair matrix remains |
| Metallurgy/intermediates | PARTIAL — real chain exists; independent yields and economic balance remain |
| Recycler/reverse engineering | PARTIAL — paid processing exists; varied scarcity and natural paths remain |
| Workbench/production | PARTIAL — Workbench III and independent knowledge/station tiers remain |
| POI access | PARTIAL / MAP DEPENDENT — complete physical multi-tier routes remain |
| Power/electronics | PARTIAL — generator/consumer exists; capacity and industrial network remain |
| Building/upkeep | PARTIAL — paid base exists; predictable material/size/weather offline upkeep remains |
| Defense/PvE | PARTIAL — perception and defenses exist; full logistics and offline causal evidence remain |
| Transport/vehicles | PARTIAL — physical cart exists; powered vehicles/fuel and travel economy remain |
| Oil/refinery | MISSING industrial loop — physical sources, processes and consumers remain |
| World loot | PARTIAL — withdrawal/retirement implemented; typed respawn and tiers remain |
| Airdrop | MISSING — schedule, authored landing and physical lifecycle remain |
| Core energy industry | MISSING shared architecture/six supplies/seven Creator Cores and 21 actions; four legacy Cores preserved |
| Knowledge/research | PARTIAL — current study/research exists; higher industry and choice evidence remain |
| Survival/ecology | PARTIAL — systems exist; full interactions and long-run evidence remain |
| Geography/resources | MAP DEPENDENT / PARTIAL — composed final map, ecology and routes remain |
| Run/death/offline/Ragnarok | PARTIAL — base lifecycle exists; final long-run, anti-exploit and cross-owner gates remain |
| Market/scarcity | PARTIAL — finite vendor/currency exists; economic simulation and anti-arbitrage remain |

## Gates

All **CODE / DATA / WORLD / VISUAL / PLAYABILITY / EXPERIENCE / LONG-RUN / CROSS-OWNER = HOLD** for the full program. The passing tests and single assisted segment support only this bounded change. No 20-journey gate, 336-hour simulation, same-build cross-owner composition, human visual/art approval or final acceptance is claimed.

## Handoffs and next actions

1. Gameplay: implement an explicit versioned, typed ordinary-loot policy with immutable site identity, one cooldown per actually depleted site, chronological online/offline instancing, fresh physical UIDs, partial-custody protection, no respawn on reload, exploit/replay tests, and a separate permanently finite Cash path. Establish conservative SOH-only balance tags and measured simulations; do not represent historical timers as verified. Follow with the physical UID-owned Core supply/action architecture and preserve all legacy Cores and controls.
2. Map owner, at the named SHA: when its owner is available, provide stable identifiers and legal spatial/eligibility contracts for ordinary source classes, airdrop candidates, POI power/doors and S01 destination validation, including sealed-room/geometry boundaries and version/migration evidence. **Do not place invented cells or initiate an art direction.** The existing Creator-facing asset-selection HOLD supersedes previous art dispatch; no new art production before explicit choice.
3. AVFX owner, at the named SHA: provide the unified compositor's typed event contract and technically available source mapping for the 21 distinct action phases, committed coordinates/timings, cancellation/OUT and replay; distinguish technical compatibility, fidelity, fusion candidates and human approval. No hidden combat authority and no competing effect engine.
4. Control Tower: name a single future composition commit only after owner inputs are ready; run the complete 20 journeys and independent gates there. Do not merge PR #44 on this partial round.
