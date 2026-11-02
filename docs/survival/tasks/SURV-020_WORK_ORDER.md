# SURV-020 — A0/A2 EXECUTION ORDER: Habitable 2D Shelter, Room, Roof, Bed, Respawn

**Issued by user / assistant 2026-10-29. Task intake is USER-REPORTED ACTIVE, not code VERIFIED.** This is the durable full-scope assignment previously handed to an agent in a chat. It is not evidence the running agent has read this file. Source foundation: PR #10 **MERGED** on `feature/survival-rpg-foundation-20261029` via `2709b9f6bd0d1cc7a5b242e617184ddab0431470`, tested commit `d3885226c92445fad7688ef754f03ec0ef65691f`, [Survival A0 native run 40845406213](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40845406213): 125 checks, 12/12 cases, Godot 4.7 Xvfb. **Do not repeat SURV-010.** General Godot baseline comparison has a pre-existing red, independently distinguished from these green survival/overworld/browser gates.

## Task owner, branch safety, research and project continuity

A0 owns integration, SaveService, schema/migrations, CT interfaces, tests and approval of merges; A2 owns construction/roof/room/door/interior execution. Use the repo's current integration HEAD as base and an **independent SURV-020 task branch**, never continue changing the Arena branch or overwrite another agent's in-progress work. Verify remote branches, PR state, CI and actual file owners before touching code.

**Read all binding context before implementation:** `AGENTS.md`; `docs/survival/{STATE.json,START_HERE.md,CONTRACTS.md,SYSTEM_FUSION_BLUEPRINT.md,ATLAS_RECONCILIATION_AND_DECISIONS.md,MULTI_AGENT_EXECUTION.md,SOURCE_COVERAGE_TRACE.json,RESEARCH_LOG.md,ACCEPTANCE.md,WORKLOG.md}`; and full 1,355-line `docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md`. Full user research is immutable and source-verified, not merely a summary. Google Doc: https://docs.google.com/document/d/1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo/edit — tabs 03/04/06/07.

Research **continuously**, including new GitHub/Godot sources beyond the prior fixed repository list. Choose REUSE_DIRECT / PORT_ADAPT / REFERENCE_ONLY / BUILD_BESPOKE / REJECT with file-level license evidence, dependency and Godot 4.7/Web compatibility. Record in `RESEARCH_LOG.md`. Search must accelerate implementation, not replace it. Approve detailed decisions using F0–F5; reject unrelated one-off patches. Existing SaveService is sole inventory/save authority.

## Required fully playable loop (SURV-020 result, not a mockup)

**Spawn → harvest resources → pay for foundation/walls/door → form an enclosed room → render roof → enter through a usable door → correct roof hides → interact with chest → place/activate a bed → leave and return → die → respawn at valid bed → save and restart → all room/roof/storage/respawn state restored.**

This loop must operate in **production `chapter1_overworld.tscn`**, preserving Hero controls/combat, all ten Chapter 1 dungeons/entrances, four camps, original loot/survival resource nodes and native Gold VFX boundaries. The underlying models should support later workstation/farm/defense/electricity without replacing core world/structure identity.

### CT-07: Room topology and structural geometry
- Support arbitrary reasonably bounded **non-rectangular closed loops**, not hard-coded square interiors; multiple rooms, shared walls, adjacent and interior doors, separate buildings; roof associated with **room identity**, not global house bool.
- Model wall edge/door connector, foundation and occupancy constraints. Efficient local flood fill / connected-components on topology changes; no full overworld rescan every frame.
- Open perimeter must not create a valid roofed room. Wall/door placement and demolition must rebuild room adjacency, IDs and local nav/collision, without stale phantom walls or persistent broken IDs.
- Include ghost preview, valid/invalid position feedback, material costs, collision/support/path constraints and clear user affordances.

### CT-07 rendering and per-room roof transitions
- From outside: readable roof silhouette over enclosed rooms. On crossing threshold, hide or fade **only the currently occupied room's roof**, reveal interior and working furniture; roof restores on exit.
- Crossing adjacent rooms, opening/closing doors, changing a wall or reloading must not flicker or hide unrelated buildings. Collision and AI navigation cannot depend on visual alpha.
- Correct z-order of Hero, walls, doors and furniture; pixel-art visual clarity at normal and integer-scaled 2K/4K. Use clearly marked dev placeholder where cleared modular art is missing; asset provenance is mandatory, no unauthorized import.
- Capture actual **native before/inside/adjacent-room screenshots**, not browser mock/static test.

### CT-07 doors, movement and combat correctness
- Closed doors block movement; opened doors allow player to traverse; entry/exit points are valid. Roof fade triggers on **real player occupancy**, not merely button press.
- Existing StaticBody2D structure collision remains real. Revalidate road/landmark/spawn protection, avoid blocking mandatory dungeon entrances and critical paths. Physics/nav updates after build, demolition and reload.
- The build strip must not reintroduce accidental sword attack when left-clicking construction UI.

### CT-03 ItemLedger, placement, storage, demolition
- Use **the existing SaveService, not a separate inventory manager**; every paid placement and refund has a deterministic idempotent transaction ID.
- Separate stable identities of player bag, multiple chests, bed and room. Container ownership, fullness and overflow cannot delete or duplicate items. Container demolition must safely transfer/reject/recover contents, never silently erase them.
- Construction cost strip, placement validity and inventory totals use the correct SaveService inventory API including the first-stack key=item_id storage shape.
- Structural upgrade/removal rules must respect occupancy, door topology, storage contents, respawn anchors and future factory devices; explicit rollback behavior for any denied operation.

### CT-11 Life-cycle / bed & respawn
- Construct/activate bed with real inventory costs and stable entity ID. Bed may define player spawn, but it must not introduce another competing Hero damage/death handler.
- Death locates a live bed anchor; multiple beds obey deterministic selection; deleting/removing the active bed invalidates/reselects it; if none exists, choose a **physically safe fallback spawn** with collision clearance.
- Do not respawn inside a wall, door or nonwalkable tile. Restore normal player controls, correct survival state, inventory and learned knowledge after death/reload.
- Death/drop-bag behavior must conserve unique item instances and use one-time recovery; implement when within existing established scope, or clearly isolate any remaining dependency and prove not silently deleting loot.

### CT-02 / CT-03 persistence and migration
- Save all placed pieces, layout/room references, chests, bed/respawn selection and relevant failure/recovery state using a versioned namespace. Ensure old saves (without bed/room) still load.
- Repeated reloads and interrupted transactions cannot grant free pieces, orphan chests or delete goods. `rebuild_from_save` and `reconcile_from_save` must avoid tearing down physics on unrelated harvest actions.
- Keep geography static data separate from player-built dynamic objects, and avoid duplicate scene objects after repeated entry.

## Required native automated tests — real engine, fail closed

1. Closed room recognized from actual placed pieces.
2. Incomplete perimeter does **not** become a room.
3. Two adjacent rooms independently recognized, shared wall correct.
4. Door opens and closes; player physically traverses only when legal.
5. Roof hides when Hero enters, and restores after exit.
6. Changing rooms never changes roof visibility of unrelated room/building.
7. Removing a wall updates room topology and removes phantom collision.
8. Building with insufficient material or invalid location charges nothing.
9. Wall has actual physics collision; player cannot move through it.
10. Chest interaction works indoors, full inventory and transfer are conserved.
11. Multiple chests preserve independent container IDs and quantities.
12. Bed costs paid once; activation persists across save/reload.
13. Death respawns at an active, physically valid bed.
14. Deleting/missing bed produces a collision-safe fallback.
15. Repeated reloads preserve pieces, room/roof state, beds, chest goods and material balance without duplicate IDs.
16. Loading pre-survival older save migrates safely.
17. SURV-010's 12 named native tests and 125 passing assertions remain green.
18. Chapter 1 travel, dungeon portals and Hero combat remain functional.
19. Repeat under actual Godot 4.7 Xvfb native renderer; inspect screenshots of roof from outside/inside and multi-room separation.
20. Test browser survival specifically when feasible, without treating existing generic browser smoke as survival gameplay proof.

Write additional coverage for threshold flicker, removal during production/occupancy, invalid legacy item key, card/room future interface and repeated event IDs. Use genuine production world objects; no vacuous fixtures or expected-result injection. Disclose pre-existing unrelated baseline red separately.

## Required completion / handoff

Deliver **commit and push** on owned task branch + PR to current integration branch; exact tested commit, sources/research and license decisions, changed files/interfaces/migrations, native Godot commands and CI URLs, screenshots, Web run status, human playtest limitations, failures/next executable task. Update `docs/survival/{STATE.json,WORKLOG.md,RESEARCH_LOG.md,CONTRACTS.md,ACCEPTANCE.md}` as applicable, AND Google Docs tab 04 after each meaningful implementation checkpoint. If no connector, record `DOCS_SYNC_PENDING` and put exact pending update in Git so another agent can mirror it.

**Verification truth:** SURV-020 cannot be VERIFIED until entire above loop passes in engine; completion of a plan, static parser, script skeleton or single faded roof is NOT completion. Do not mark `survival_system_integrated` true prematurely. Preserve user's product differentiator: sharp top-down pixel readability and real Core×Hero×environment spectacle, not a weak shooter clone.

## Coordination note entered after assignment

The user explicitly reported **"agent đang làm việc rồi"**. This means the task was assigned and is in progress according to user report; at the time this file was written, GitHub had **no separately identifiable SURV-020 task branch/commit/PR**. Do not infer agent's local worktree status or claim the running agent has been notified of this newly persisted document. No code branch or gameplay file was modified by the documentation correction.
