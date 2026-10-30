# A0 → CT / A5: genuine overworld threat and death-journey gap

Status: **owner decision / implementation needed; SURV-020 and B0 NOT ACCEPTED.** This is separate from the blocked canonical A1 seam. Do not synthesize damage, add an unapproved enemy, relocate an A1 POI, modify another owner's branch, or claim a fixture as a threat-driven journey.

## What was actually established

Native [40939080582](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40939080582), source `0914edf`, passed 81 automated, fresh-save, ordinary-input checks: real mounted resources → real A3 kit/workbench/weave → paid enclosed home and active bed → physical door exit → separate live oak → home chest → disk reload and freshly rebuilt production overworld → ordinary-input recovery of the exact two oak and two crafted cloth, no duplicate. It is not human play and does not contain combat or a real death.

Native bed/death fixture [40934855391](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40934855391), source `18a0a0d`, passed the 103-check bed suite and production respawn/death-bag adversaries; the suite explicitly invokes controlled death/damage and uses fixture setup. It is technical coverage, not evidence that a normal player can encounter a lethal overworld threat. It separately confirms dungeon death retains the existing dungeon checkpoint and does not create an overworld-coordinate bag.

## Why the missing journey cannot be honestly filled with the currently mounted world

- `game/overworld/chapter1_overworld.gd` builds the authored overworld, player, landmarks, camps, discoveries, survival resources/structures, death bags, UI and economy session. The `_spawn_player` comment explicitly characterizes the region as a travel space rather than a combat arena. In the inspected production overworld files there is no mounted enemy-spawn path.
- The existing world-data hazard rectangles are passed into `OverworldState.tick`; `_drain` only consumes provisions. `_apply_fatigue` says an empty pack slows movement and nothing else about the run is taken away; these hazards do not by themselves establish damage or lethal threat.
- The production overworld death-bag path responds to the actual overworld Hero's global death event, and its respawn/ownership transaction already exists. The production dungeon uses its own scene, Hero and checkpoint; silently treating a dungeon death as an overworld bag would violate that isolation.
- This is source inspection and scoped technical evidence, not a formal proof that no possible third-party or future code can ever damage the Hero. In particular, no actual threat → overworld death → body bag → respawn → recovery/reload ordinary-input run has been demonstrated.

## Decision requested

CT/A5 should specify an owner-compatible, physically reachable and genuinely dangerous overworld encounter or hazard in the existing authoritative world and an acceptance plan for its real damage/death, safe bed respawn, return, full bag/body-bag custody, repeated death and disk recovery. Preserve the current camera, physics owner, original Chapter 1 entrances, dungeon isolation, A4 Gold/VFX, A1 world ownership and A3 economy. State its spawn/respawn, cleanup, collision, save identity, balancing and no-softlock contracts before composition. If a different owner has authority, CT should explicitly assign it. No new parallel physics world, unapproved reward, fake danger, or direct test-only kill should be represented as the normal journey.

Issue #9 comment attempt for the separate A1 seam decision was rejected by the GitHub integration with `Resource not accessible by integration`; this Git handoff and Google Docs tab04 are the available notification channels. No owner decision is presumed.
