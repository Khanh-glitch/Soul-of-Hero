# V15 Gameplay continuation — OPEN / DRAFT / HOLD

This is a continuation, not completion or Creator acceptance. W00 is historical; its implementation and regression statements describe that checkpoint, not the current tree. PR #44 must remain draft and unmerged. See the current git HEAD and PR comment for the exact tested SHA.

## Changes since W00

- Renewable ordinary public loot has typed cooldown, physical replacement, fresh custody and saved site identity; its full economy and player journey remain unproven. Core supply items and UID-owned reserves were added without replacing the four legacy Cores. Workbench III has an industrial Refined Energy recipe. Rare initially charged Meteor, Dragon, Elsa, Mjolnir and Spirit bodies have finite fresh-Shipping authored-crate sources; acquisition tests now verify one source each. These sources **are not populated on Veyra**.
- Provisional 21-action implementation exists across Blast, Meteor, Dragon, Elsa, Earthmother, Mjolnir and Spirit. Dragon snapshots the aim and has traverse/gather/dive, second-impact individual damage of 20% of included surviving HP; Elsa has a one-second ward and water/ice presentation identity; Earthmother emits ten physical temporary trees and ten-second roots; Mjolnir has five timed Q strikes and physical pull. These are fixture-level findings, not evidence every action is balanced, correctly composed or player-usable. Earthmother placement now requires all ten angular sectors and avoids placing the caster inside the ring, but continuous enclosure, safe escape, repeat-farming and real play remain to be verified.
- Spirit has a ray, stationary timed beam and an explored-map E destination. The selected cell is revalidated at commit and arrival, excludes protected/blocked/occupied/hazardous cells and requires a collision-connected route, avoiding sealed-room bypass. UID and selected point are committed; the map marker shows selection. Four fixture tests cover undiscovered, blocked-ring, beam and save/arrival, not the full abuse matrix. The full-map flood fill and overly conservative road/protected restrictions require usability/performance review. Offline death, hazard entry, inventory changes during transit, cancellation and malicious saves need further adversarial tests.
- Copied the AVFX owner's PixelFX pilot, unified compositor and owner event mapping from `3158f0c427570794e6d69fe72c1f701b26ceb384` into Gameplay, with its MIT license/notice. Added a provisional Spirit departure/arrival mapping; these are presentation only. This is **not** a full AVFX or ARCANA composition or a Creator-approved mapping, and the embedded pilot increases single-file build to roughly 16.7 MB. Existing procedural fallbacks/telegraphs remain. Check for duplicate or missing visual layers and first-use lazy image loading; obtain an AVFX owner review before declaring CROSS_OWNER_COMPOSED.
- Map authority pointer is confirmed at Map commit `caccf21613aa57a55491ec44f687cc44c569f79e`: WMP-04R1 biome/cold rasters with WMP-03 physical geometry and unresolved marine traversal. Gameplay still uses its older LR01/LR02 Veyra projection. Do not call it WMP-04R1 or invent POIs; intake, identity, runtime static population and old-save migration remain open.

## System status (program level)

| System | Status and primary gap |
|---|---|
| S01 tools/harvest | PARTIAL — real material/repair and natural-combat matrix |
| S02 metallurgy | PARTIAL — connected yields, fuel and economic balancing |
| S03 Recycler/research | PARTIAL — scarcity, condition and natural choices |
| S04 workbenches/production | PARTIAL — industrial energy added, power interruptions and player journey |
| S05 secured POIs | PARTIAL — full tiered security and current Map intake |
| S06 power | PARTIAL — generator/consumer; capacity and industrial network |
| S07 building/upkeep | PARTIAL — predictable material/size/weather offline upkeep |
| S08 PvE/defense | PARTIAL — full logistics, traps and offline consequence |
| S09 transport | PARTIAL — powered transport, fuel and travel economy |
| S10 oil/fuel | NOT_TESTED / missing industrial loop |
| S11 loot | PARTIAL — renewal code; complete tier/economy evidence |
| S12 airdrops | NOT_TESTED / missing physical scheduled lifecycle |
| S13 Cores | PARTIAL — provisional seven and six supply types; full journeys, abuse, balance and art |
| S14 blueprints | PARTIAL — research/study exists; linked higher industry and choices |
| S15 weather/ecology | PARTIAL — connected environment and long-run interactions |
| S16 Veyra | OWNER_BLOCKED / PARTIAL — WMP-04R1 intake and authored routes/source population |
| S17 run/Ragnarok/escrow | PARTIAL — lifecycle exists; real 336-hour behavior and exploit evidence |
| S18 finite trade | PARTIAL — balance, supply chain and arbitrage simulation |

## Evidence gates

| Gate | Status |
|---|---|
| FUNCTIONAL_CODE | PARTIAL — fixture tests do not establish all program behaviors |
| SOURCE_AND_ECONOMY_VALID | PARTIAL — finite Shipping sources tested; balance and Veyra sourcing pending |
| REAL_WORLD_INTEGRATED | PARTIAL — existing play paths and assisted Spirit fixture, not complete journeys |
| VISUAL_TIMELINE_INSPECTED | PARTIAL — sampled Spirit E sequence at 640×360/1280×720; all other actions/conditions pending |
| CONTROLS_AND_FEEDBACK_VERIFIED | PARTIAL — assisted Spirit map/select/E; natural discovery, other actions pending |
| ASSISTED_USABILITY | PARTIAL — selected assisted segments only |
| UNFAMILIAR_HUMAN_TESTED | NOT_TESTED — HUMAN_LEARNABILITY_PENDING |
| GAME_FEEL_REVIEWED | NOT_TESTED |
| LONG_RUN_VERIFIED | NOT_TESTED |
| CROSS_OWNER_COMPOSED | PARTIAL — pilot source copied, no verified Map/ARCANA/full owner composition |
| CREATOR_ART_ACCEPTANCE | OWNER_BLOCKED / NOT_TESTED |

`web/e2e/v15-spirit-assisted.mjs` creates a fresh run, **injects** Spirit and supplies and clears enemies, then uses mouse and keys for map, selection and cast; it is not natural acquisition or independent human play. `web/evidence/v15-spirit-assisted/` contains 14 sequential captures at each resolution and state results. We inspected sampled departure/arrival frames, including 640 sequence 00/03/06/10 and 1280 sequence 02/09: purple ring and disappearance/reappearance were visible, but effect contrast is modest, arrival is brief, tutorial text small at 640 and first-use source sprite rendering is not established. This is a defect/observation, not art acceptance. The test does not cover hostile, dark, interrupted, saved-offline or true human conditions.

## Continue next

1. Complete Spirit enemy/locked POI/occupied/hazard/changed target/interrupt/save/offline/death/UID abuse tests, route/flood-fill performance and normal acquisition-to-reuse; inspect every sequence and improve feedback. Validate channel effects against interruption and offline time.
2. Complete Earthmother containment/escape and wood anti-farming; test Mjolnir wet/chain and offline expiry; test Dragon obstacles/Elder/interrupt and Elsa collision/thaw/all damage paths. Trace each of seven Cores' discovery, reserves, use, visible output, interpretation, reuse, save and sourcing.
3. Implement independent missing S01–S18 chains, notably upkeep, powered industry, oil, airdrops and trade. Reconcile the provisional 214-row ledger with Creator enumeration. Validate long-run and anti-duplication adversarially.
4. Map owner: review current WMP-04R1 ingestion, legal secured-room semantics, source/airdrop eligibility and legacy migration. AVFX owner: review this pilot/compositor adaptation, event contracts and all 21 phases; supply a tested ARCANA integration and approved mappings. These requests do not stop independent Gameplay work.
5. At a final SHA rerun complete regression, TypeScript, build, production audit and real browser journeys. Distinguish automation, human usability, visual quality, economy and owner acceptance; never infer one gate from another. Update PR #44 handoff; do not merge.
