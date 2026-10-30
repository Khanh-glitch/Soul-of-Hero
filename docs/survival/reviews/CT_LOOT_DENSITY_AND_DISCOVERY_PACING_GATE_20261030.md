# SOH — Loot density, expedition pacing, and discovery value
2026-10-30 | Control Tower | RESEARCH_SCOPED_PASS / NATIVE_NOT_TESTED / HUMAN_NOT_TESTED / NO_PRODUCTION_CHANGES

## Source priority and evidence
Read original archived Atlas (2019–2020 emphasis) SYS-03/04/05/06, 11–17, 32–34, 38, DEP-01/02/03/04/05/07/11/18 and JOURNEY-01/02/03/04/07/08; DECISIONS D001–D050, post-pivot reconstruction, ACCEPTANCE B0/B1/B2 and preceding First Core source-ecology note on this research branch. This report does not approve gameplay or rates.

Firsthand user corrections: six-round novice revolver preceded enjoyable SMG; first masked toxic-area visits occurred without SMG; SMG source uncertain (perhaps road); initial use involved excited rapid-fire experimentation, while repeated death/loss later led to storing a specimen and paying to research permanent reproduction.

2019-09-27 Chinese official weapon guide: novice revolver, SMG in supply/military containers, strong guns in advanced military crates: https://hero.yingxiong.com/info/2019/0927/7249.html . 2019-09-10 road supply/tool vs POI military: https://a.4399.cn/gl/13650770_115226.html . 2019-08-16 contributor confirms possible roadside SMG with no drop percentage: https://www.9game.cn/daihaoyingxiong/3479121.html . Regional/mode differences remain.

Context only, not SOH numerical proof: Tang & Kirman 2025 qualitative chest curiosity study (19 players) points to container variety, placement, future reward and chest fatigue https://www.sciencedirect.com/science/article/pii/S1071581925001326 ; Nature Human Behaviour 2023 creative game experiment on curiosity for new possibilities https://www.nature.com/articles/s41562-023-01661-2 .

## A1 true authoring snapshot, not runtime
A1 PR20 HEAD 2951bf8559b2e289ce99fd4d394d44c46fdd91b1. Files: data/survival/world/poi_route_graph.json, world_plan.v1.json, metrics.json, pacing_analysis.json. A1 planned 1024x768 cells at 16px each, 118 POIs including 108 new and 10 preserved legacy dungeon exteriors. POI band counts: early 39, mid 43, late 36. Content: 106 WORLD_SITE_CONTRACT_ONLY, 2 INTERACTION_SPEC_AUTHORED_NOT_NATIVE, 10 PRESERVED_BASELINE.

From Refuge (56,218), Euclidean straight-line tile-radius counts: <=64 tiles 1 POI; <=128 6; <=256 17; <=384 30; <=512 58. These are *geographical anchors*, mostly legacy dungeons or not-yet-playable site contracts, not active loot or chest density. Closest new authored interaction POIs: Waystation (408,200) 352 tile straight-line; Relay (440,236) ~384. A1 modeled Refuge→Waystation→salvage→Relay→Refuge 1055.08 tile-route length and 175.85s =2.93min at 96px/s without interaction/combat/gathering/crafting. Separate first-hour safe preparation/retreat route modeled 1541.72 tiles /256.95s=4.28min movement only. A1 itself marks combat_crafting_gathering_seconds NOT_TESTED. No live eligible special road-SUPPLY crate density is authored or measured by this. 33 resource sites /178 nodes are not supply crates.

## A3 theoretical expected per roadside claim and data gap
A3 PR19 HEAD 18e7afcbd576bbd9bfbcc509b2ee13216186a522. Existing roadside_cache defines 3 independent proposed draws: iron_scrap weight40 quantity2..4; knowledge_spares weight30 quantity1..2; research_notes weight15 quantity1; grain_seed weight15 quantity1. Under independent draws and uniform inclusive quantity, expected per successful claim: 3.6 scrap +1.35 spares +0.45 notes +0.45 seeds. This is a JSON theoretical expectation, NOT a measured native reward or guarantee; rare/core/exploration_only excluded. Currently 3 proposed tier-3 physical Core sources are risk-high/power/access gated, all BLOCKED_PENDING_A4.

The A3 14x45-minute progression_report.json baseline shows roadside_claims=0. Thus it cannot estimate roadside eligibility, crate openings, early-Core surprise frequency or real exploration cadence. The separate conservation fixture of 156 specimens also is not a human-playtested 14-day loot economy.

## Pure probability sensitivity — NOT SOH drop table
Let p = independent probability per legitimate distinct eligible supply crate, N = eligible openings. P(at least one Core) = 1-(1-p)^N. For a *hypothetical* 20-minute expedition opening C eligible crates, after T trips N=C*T. Approx expected minutes to first success = 20/(C*p) assuming stationary supply. This omits pathing, retries, saturation, players deliberately choosing sources, bag constraints, death and source persistence.

| Illustrative case | C / 20min | p | P after 10 trips | P after 20 trips | Approx expectation |
|---|---:|---:|---:|---:|---:|
| Very sparse | 1 | 0.5% | 4.89% | 9.54% | 4,000 minutes |
| Middle | 2 | 1% | 18.21% | 33.10% | 1,000 minutes |
| Denser | 4 | 2% | 55.43% | 80.14% | 250 minutes |

All numbers are deliberately hypothetical, no historical or SOH tuning recommendation. We cannot select p before measuring C for three actual routes and periods. A 1% number without encounter density is not a balance design.

## Specific design verdict
KEEP current generic A3 roadside_cache no-Core. Consider an L1-S distinctive supply-container class only if A1 geographic placement, A4 Gold attestation and A3/A0 unique instance ownership permit it. Do NOT add current tier-3 vault specimens to junk, alter Waystation locker/ledger zero-item rewards, or treat cap_power_1 as a Core drop.

Evaluate trips as a portfolio of *different forms of useful progress*: common material with known sink; knowledge/ingredient reverse lookup; a new accessible route or truthful clue; a still-unopened destination worth returning to; and only occasionally a rare Core. A trip with no Core still needs actual long-term resource or information value. Mask+basic melee should permit some hazardous perimeter exploration; threat, keys, protection, electricity, combat and Core power are separate axes. No hidden guaranteed pity timer proposed. Players unlucky with surprise finds must have a more deliberate targeted POI/research route.

## Falsifiable future player and native gates
A7 measurement candidates: eligible_seen, eligible_accessible, eligible_opened, distinct source IDs, material useful per route, player time / route tiles, return/death, discoveries, actual core instance and casts, loot loss/recovery, and player-chosen next goal. Compare home-first, explorer-first, mask-only and optimizer routes; log safe returns and cargo opportunity costs. Need true S3 normal-input and S4 observed novice evidence before defining meaningful drop probabilities.

FAIL if repeated ordinary trips have no useful non-Core results, if deep-exclusive Core appears in junk, if source can infinitely reroll through reload, or if a proposed drop is not an A4-attested usable original Gold Core. Hold integration while A0 B0 is incomplete.

## Staffing capacity change
User reports capacity for TWO additional sessions. Historical A7 QA/balance (issue #16; only docs/survival/balance/** tools/survival/balance/** tests/survival/balance/** data/survival/balance/**) and A8 source/license reuse (issue #17; only docs/survival/licenses/** docs/survival/reuse/** tools/survival/license_audit/**) have suitable existing independent charters. Both can be READY_FOR_USER_DISPATCH with a narrowly revised first task; neither is ACTIVE until user launches one. Old 6-seat capacity rule superseded by user for staffing only, old issue references to PR11 outdated; active owners A0 PR21, A1 PR20, A3 PR19, A6 PR24 remain unaffected. A0 PR21 at latest inspection 48cd7a68f1b335110fe14c5b9bbce01a6ac42700; A6 PR24 at f25e66f4eb48f4ac13ecfe7c140ff894eb3c4d18, both draft. Refresh at dispatch; no code prompts/merges implied.

NEXT: A7 independently instrument/replay a source/route sample without editing A3/World; A8 close actual license/access/source ledger so art and Gold import can proceed safely. Prepare work orders before user dispatch, sync Git and Docs; do not tell user agents started.
