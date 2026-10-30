# A8 — EXPLORE-001: Independent early-world Exploration Content Lab
Date: 2026-10-30, Control Tower suggested reassignment after user feedback that A8 repeat asset checking is low value.
Status: RECOMMENDED_FOR_SAME_SESSION_USER_DISPATCH / NOT_STARTED; replaces A8's initial *priority* (asset/license inventory) but does not change A0/A1/A3/A4/A6/A7/S6 production ownership. No merge authorization.

## Why this pivot
- Original user provided 43 Craftpix ZIPs already physically audited. 22 P0 art candidates, 18 P1, 3 license-source holds. Rechecking all 43 is not a justified full-time agent role. A6/A1 can use existing manifest; copyright/source blockers retained in prior documentation.
- A1 PR20 at 2951bf8559b2e289ce99fd4d394d44c46fdd91b1 plans 118 anchored POIs: 10 existing dungeons + 108 new, of which 106 are still WORLD_SITE_CONTRACT_ONLY, 2 have special interaction contracts. A physical location marker is not a place worth exploring by itself.
- A3 PR19 at 18e7afcbd576bbd9bfbcc509b2ee13216186a522 has live-material IDs stone_chunk, oak_wood, iron_scrap, reed_fibre; **rare_herb, honey, wood_plank, fibre and venom_sac are NOT present as those item IDs**. World material_key is not guaranteed to be an A3 item. Don't invent aliases or grant missing items.
- Player's Last Island firsthand testimony: early game chopping/building/research already enjoyable; masked toxic exploration BEFORE SMG; SMG joy came from surprising new affordance and real use, not from mandatory loot gate. Later losses drove deliberate blueprint research. First Core rarity isn't the entire experience.

## Separate product authority
A8 becomes independent CONTENT R&D ONLY, NOT the world owner. Own a NEW isolated subtree:
- docs/survival/exploration_lab/**
- data/survival/exploration_lab/**
- tools/survival/exploration_lab/**
- prototypes/survival_exploration_lab/**
Do not edit A1 world plan/route files/POI JSON, A3 loot tables/item sources/recipes, A0 SaveService/Hero/overworld, A4 Gold skill or A6 UI. Do not use S6 Whitewater POI as work; S6 owns it. No unapproved raw art/license imports. No Gold asset recreation.
Existing docs/survival/licenses/** remains ancillary for genuine blockers, not the main sprint. Old A8 license-audit task is DEFERRED, not passed/cancelled.

## First bounded content pilot (existing A1 anchors, not invented map)
1. South Quarry — poi_crown_south_quarry, cell (30,280), early, NO required capability, material_keys [stone,iron]. Its interesting loop MUST be different from merely chopping A0's already-existing stone node. Proposed affordances must give world feedback/choice, reachable retreat and a reason to revisit. Rewards only propose IDs A3 actually defines (e.g. stone_chunk / iron_scrap); proposed amounts remain unapproved.
2. South Orchard Ruin — poi_crown_south_orchard, (140,360), early, NO required capability, material_keys [timber,honey,rare_herb]. Preserve ecological cause and farm connection, but honey and rare_herb currently lack exact A3 item IDs. Model these as proposed missing dependencies rather than secretly minting actual items. Allow a worthwhile partial visit without them, and a meaningful return for later farming/processing.
3. South Crown Mill — poi_crown_south_mill, (120,300), early, required cap_salvage for outer interaction, material_keys [timber,stone,salvage]. It should offer a non-dungeon mechanical/environment interaction, meaningful preview before cap_salvage, and a defensible trade-off or repair route. Do not grant cap_salvage, cap_seal_1, cap_power_1 or Core in these sites; those are assigned to existing first POIs.

For each: A1 exact scene identity + current authoring readiness, observation clue before access, open approach with melee only, at least two player choices and consequences, one one-time mutation, one repeatable/source-limited affordance, real material use not free magic, death/bag/reload/duplicate negative cases, partial retreat and actual homeward value. State which rules are historical vs new SOH suggestions. Be careful not to manufacture a mandatory sequence; allow home-first and explore-first.

## Deliverables this session (not a vague research report)
1. Three machine-readable self-contained content contracts under data/survival/exploration_lab/**, with unique scene/object/action/source/reward IDs, flags, requirements, materials checked against *real current A3 catalog*, costs, failures, persistence and explicitly BLOCKED dependencies.
2. A **working standalone interactive proof** under prototypes/survival_exploration_lab/** (HTML with no external dependencies is fine) that exercises the three real A1 site concepts and two routes: home-first and explore-first, in a compact exploration sandbox. Player can choose which POI to visit, preview clues, interact, collect/deposit modeled materials, revisit, choose to defer repairs, recover a bag if lost; no forced Core or scripted guaranteed reward. This is a *content hypothesis testing prototype*, NOT Godot/native gameplay, not Gold visuals. If time/technical environment makes full graphical exploration excessive, deliver a deterministic user-operable interaction simulator with branching states, still independently runnable.
3. Automated state/invariant tests under tools/survival/exploration_lab/**: no reward duplication by reload/retry, no capability circularity, no missing item silently granted, fair optional retreat, route completion, low-risk trips with useful non-Core outcomes, three different site affordances and 2 genuine route witnesses. Run tests and publish commands/output.
4. An integration handoff: source-approved A1 placement data untouched, exact A3 needs/new IDs as requests ONLY, A0 hooks needed when B0 allows, A6 UX hints read-only. At least one realistic first-time player walkthrough and one optimized route; flag native/human NOT_TESTED.

## Conditions and stop
Start from existing A8 branch feature/surv-a8-reuse-audit-010a; verify current git HEAD/PR state and worktree before editing. Author only above independent subtrees, no new asset pack audit. Commit and push scoped files to your own branch, with runnable commands and a report. Update Issue #17 and Google Docs tab04 or report DOCS_SYNC_PENDING. Do not self-merge, make no gameplay acceptance claim, and do not wait for A0 to finish B0. The owner may later accept/reject all content; prototype does not bind product data. Deliver the **complete first pilot** before stopping for a report.
