# CT P0 — ARCANA Fusion20: A-on-real-enemy + winning-source effects on real SOH world
Date: 2026-10-31. Owner: AVFX/A4, SAME existing Arena session/branch; status: DISPATCH_PREPARED_NOT_ARENA_DELIVERED. Creator authorized starting this implementation. This is a new 20-skill source family, **not** ARCANA III 72 or Venomwright 21.

## Mission — only two non-negotiable technical results

1. **Every visual effect applied to a struck enemy comes from source candidate A**, attached to **actual Soul of Heroes enemy entities**, sprite/body masks and world coordinates. Preserve A's original per-element hit reactions, burn, wet, freeze/shatter, electric convulsion, vines/spores, astral warp, knockback/death as applicable to each skill. The rendered demo enemies in A are reference material **only**. NO cloned/phantom A arena targets in live effects. World/game combat authority determines damage and state; A is source of the ON-BODY presentation.
2. **Every environment/world effect comes from the creator-selected source(s)**, not the arbitrary generic A arena or source project's entire pre-rendered floor. Preserve exact selected flame, water, shadow, frost, scorch, lightning, growth, gravity/displacement, space tear and afterlife, including timing, geometry and layers. Cast must work with genuine SOH map camera, terrain, props and occlusion. Sample/map genuine pre-VFX world render for background distortion; exclude HUD. Do not replace world by example arena, flatten into a 2D video, substitute generic particles or turn Gold into a floor sticker.

In this document "A" means the **pixel-art-magic-laboratory (1).zip candidate**, NOT SOH worker A1 (world geography owner). Read original user vote comments, not an AI review's ranking.

## Inputs and immutable sources

Creator supplies **ARCANA_FUSION_20SKILLS_HANDOFF.zip** directly to the SAME AVFX Arena session. The ZIP is **NOT in GitHub yet**, and a GitHub comment cannot attach it. Outer ZIP SHA256: \`e467d131e02fd93e291b9e11bd588889ae98b75db3bec819e45f0ac3e3f1a0fd\`, size 3,771,388 bytes. Run bundled \`scripts/verify_bundle.py\`. Inside:
- \`votes/ARCANA_Votes_20-of-20.json\` — 20/20 human votes, ultimate selection authority.
- \`FUSION_DECISIONS.md\` — comment-grounded skill directions; read full. 
- \`fusion_manifest.json\`, \`ARCHITECTURE_AND_INTEGRATION.md\`, \`ACCEPTANCE_MATRIX.csv\`.
- \`sources/A,B,C/\` and untouched \`sources_original/\`, plus \`reference/Elemental_VFX_Lab_FIXED_Standalone.html\` (D, #19), and experimental \`ARCANA_19_Reference_With_Exit.html\` (NOT approved).
- A source code: \`sources/A/src/engine/enemies.ts\`, \`world.ts\`, \`framebuffer.ts\`, \`lab.ts\`, \`src/spells/choreo.ts\`; B \`src/engine/renderer.ts\`; C \`src/engine/frame.ts\`, \`gl.ts\`; D inline WebGL renderer.

Verify hashes/manifest, baseline each winner's full original cast. Originals are read-only. Do **not** re-upload original source ZIPs to a publicly accessible repo without creator's express approval; respect any existing leaked/public copies as already compromised but do not amplify redistribution.

## CURRENT repo and boundaries

Repository: https://github.com/Khanh-glitch/Soul-of-Hero
Existing AVFX branch as of intake: \`arena/c7b0c4e8-soul-of-hero\`, last verified \`b46cca9ea4e50f45c02f1ee102afa1c7f4c2d70b\`. On resume verify \`git branch --show-current; git rev-parse HEAD; git status --short; git ls-remote origin\`, latest pushed work, GitHub Actions, all code not committed. Preserve the 21 Venomwright parity-registered skills, ARCANA III source/manifest and 021 performance checkpoint. Pause unrelated 021 optimization; do not run an endless perf microloop.

Existing AVFX native harness: \`prototypes/skill_readiness/\` (ports, runtime, family host, original-source parity, real-map pilot). Actual game enemy examples: \`game/characters/enemies/skeleton_enemy.gd\`, \`advanced_enemy.gd\`; actual combat \`game/combat/combat_resolver.gd\`, \`combat_damage.gd\`; real map test \`prototypes/skill_readiness/pilot/real_map/venom_pilot_real_map_test.gd\`. Read actual current files; do not assume their public API.
**Important:** This current AVFX branch lacks the A0-owned \`game/survival\` production tree. It can prove real existing-game Chapter 1 Level 2 enemy/world interactions here, but MUST NOT claim the new A0 survival runtime is integrated without testing a pinned composite SHA with A0. Supply an A0-consumable port/adapter contract; A0 owns production mount, A7 independent QA.
Other owners: A1 world placement/terrain, A3 economics and Core item grants, A6 HUD, A8 POIs. No A0 SaveService, wallet or hero edits by AVFX. No self-merge.

## Locked 8–6–6 per skill

| Group | IDs | Visual source / binding commentary |
|---|---|---|
| SINGLE-WINNER base + A on-body (8) | 02,03,07,08,10,15,17,19 | 02 B wyrm, 03 B meteors, 07 C frost, 08 B undertow, 10 C storm, 15 C thorn, 17 C horizon; 19 **D** source after creator override, A for combat; #19 OUT not final |
| ACTUAL VISUAL FUSION (6) | 01,05,09,11,16,20 | 01 A crown + C flames; 05 A opening/peak + C water column/rain and remove excess A tails; 09 A chain/on-body + B dual-color lightning + C density/impact; 11 A carousel architecture + **C lightning generator from skill #09**; 16 A smooth kinetics + C palette; 20 C plausible rift + **A superior world distortion** |
| NONE, DIRECTION EXISTS (6) | 04,06,12,13,14,18 | 04 C flame column and A split/crack but coherent guillotine; 06 C sensible water writing with A smooth sharp ribbons; 12 A intricate circuit + C-quality lightning and visible final explosion; 13 opening B/C (C marginally preferred), redesign organic root rise; 14 redesign random mushrooms into causal spore network; 18 B crystals, replace senseless ping-pong with coherent temporal mechanics |

User vote > comment-grounded fusion direction > AI review preference. **14 have locked visual direction, 6 are working designs without Gold visual approval.** No invented second vote. One listed source is not a second entire skill layered on top of the winner. For the eight SINGLE skills, do not cosmetically redesign winning renderer; just adapt it to world and A-on-enemy. For A-winning compound fusion, keep selected A world FX when explicitly preferred (#20), rather than incorrectly replacing it with C just because C won rift design.

Per-skill detailed \`FUSION_DECISIONS.md\` is binding. Preserve #19 D 9.8-second lifecycle and finish genuine authored OUT (not sudden alpha fade). A's other #19 timeline is NOT D's clock; do not copy old A event times.

## Implementation contract: source-faithful, real-world

- One deterministic world-space cast clock/time scale and one contact/intent stream; only a single owner of hitstop. Handle re-aim, cancel, target disappearance, death, expiry, repeated casts, replay, camera panning.
- Separate source-provenance-tagged channels: \`ground_decal\`, \`behind_target\`, \`on_body\`, \`front_air\`, \`lighting\`, \`world_displacement\`, \`afterlife\`. World scene **not** embedded in VFX package.
- **Real target mapping**: stable live entity ID, world transform and sprite/material mask; resolve target from actual collision/authoritative target selection. Attach A's element-specific status/deformation shader and particles to actual enemy body at projected anchors across movement, occlusion, animation, multiple live enemies, deaths. Do not spawn A demo actor silhouettes or proxy enemy clones. Damage numbers alone are FAIL.
- **World effects**: anchor at world-space cast/impact positions, use real scene-pre-HUD texture as displacement/shadow/lighting input, preserve selected source exact geometry/timing/alpha, keep terrain/moving props layering and afterlife decals. If the source baked its own floor into opaque pixels, split effect terms from floor sampling; never blit that entire texture into SOH. For physically altered terrain, emit intended terrain effect via world-owner API; render-only displacement must not silently modify saves/collisions.
- **Contact geometry**: A's \`choreo.ts\` reads A-only spell internals such as per-projectile state. For B/C/D winners the caster event must be derived from winning visual moving head/projectile/rift geometry, then A reaction plays on actual struck entity; not hardcoded A demo targets or center-area damage.
- Preserve cast phases opening→build→real collision→peak→aftermath→OUT and selected environment signature. A effects only when underlying target actually receives that state/impact; don't force all statuses on all 20 spells. World authority remains source of truth for damage/status; do not double apply.
- Keep existing Gold93 library IDs and manifest untouched. New namespace such as \`arcana_fusion20:001..020\` with separate source hash and status manifest, pending catalog adoption. NEVER alias \`arcana_iii:001\`.

## Concrete production-oriented workflow (CONTINUE through all 20; do not stop at pilot)

**R0 — Resume/verify:** independently audit existing AVFX branch and native API; validate uploaded SHA, votes, current source/oracle per skill; record which code is actually live in existing game and which is fixture-only. Prefer existing functionality over reimplementation.

**R1 — A real-enemy adapter:** implement one source-faithful A actor/status rendering adapter bound to actual Godot enemy identity, body and transform, with enemy-vs-clone adversarial test. Demonstrate on at least two nonidentical real game enemy types; include moving, off-center, dying/replaced target, overlapping status, no damage-number trick.

**R2 — source-world adapter:** implement real world-sampling displacement/lighting/decal target independent of hardcoded Gold room: effect layers sampled from active SOH scene, camera movement, stage brightness, occlusion and persistent world marks. Use actual real-map/Chapter 1 L2 scene copy, not faux tileboard. Distinguish render-only shadow vs gameplay/world mutation.

**R3 — three architecture probes, THEN KEEP GOING:** #07 real-target frost, #17 C gravity lens on map texture, #20 C rift + A strongest environment warp. CI test real input, multi-target and camera at first-contact/peak/afterlife. These are integration sanity tests, NOT a new stopping checkpoint. Other single-winner skills become straightforward using same bridges.

**R4 — implement all 14 locked choices:** 02,03,07,08,10,15,17,19 and 01,05,09,11,16,20. Reuse original native visual logic where practical; preserve original timing/geometry; do not fake with screenshot recordings. #19 D-specific OUT required. All 14 must be playable in native lab and honest real-map/runtime stage, even if A0 survival adoption awaits separate owner.

**R5 — implement six creator-directed redesign candidates:** 04,06,12,13,14,18 as individually playable proposals anchored in the exact creator comments. Attach same A-on-body and real-world environment adapters; mark \`PENDING_CREATOR_VISUAL\` rather than final Gold. Don't stop development because user's final cosmetic vote is pending; present full-cast evidence and a decision-ready comparison with before.

**R6 — native/visual acceptance:** for ALL 20 provide exact source/winner mapping, 60 Hz or original tick/timebase, full-cast screenshots/video opening/first contact/peak/exit; immutable-snapshot comparison of winning source effects (adjusted only for real-world texture), real entity ID/tag in hit receipt, no clone presence, real-map in/out camera, 720p/2K/4K pixel crispness, environment-on/off differencing, damage/state/afterlife, cleanup & cancellation. Native Godot 4.7 exact SHA, hostile cases (multi-enemy, moving enemy, obstacle, edge of map, bright map, relaunch/replay). Save negative evidence and failure cases, not just passes. No \`human_visual_approved\` without creator review.
**R7 — owner handoff:** A0 consumer interface and test harness against current A0 branch without modifying A0; A7 independently audit. Build at least one genuinely playable source-to-enemy-to-environment pilot with real Godot inputs; do not call it A0 survival production if not.

## Acceptance, blockers, delivery

Machine-readable per-skill state \`SOURCE_INTACT\`, \`ON_REAL_ENEMY\`, \`WORLD_EFFECT_ISOLATED\`, \`WINNER_VISUAL_PARITY\`, \`REAL_MAP_NATIVE\`, \`FULL_CAST_AND_OUT\`, \`CLEANUP\`, \`CREATOR_VISUAL\`. Distinguish PASS/FAIL/NOT_TESTED/PENDING_CREATOR; no mass-filling PASS from fixture. All 14 decided skills and 6 draft skills must be attempted (sustained meaningful implementation), not only research/design. If a native port is blocked by missing real production consumers, complete all owner-controlled standalone/real-level work, prove the exact missing seam and return \`A0_ADOPTION_BLOCKED\` for that layer. No fabrication, no dismissing the task early after 3 test skills, no repeated source download/asset cycles already solved.

Keep work within the existing AVFX session/branch, never merge or wipe other owners. Commit and push code, tests, real-map captures, source/receipt mapping and a concise \`RESTART_CHECKPOINT.md\` additive update; cite exact HEAD and CI jobs, external artifact links/hashes, use existing issue/PR communication. Do not claim the bare GitHub comment delivers a message to Arena. Sync Google Docs tabs 04/12 with readback only for real implementation changes; state \`DOCS_SYNC_PENDING\` on connector failure.

## Actual dispatch / user action

Creator must **interrupt current AVFX Arena run** (when chosen), attach \`ARCANA_FUSION_20SKILLS_HANDOFF.zip\` to the SAME session, then paste this work order / stable GitHub URL. Merely creating this GitHub file DOES NOT instruct a running Arena agent; this file is an executable work order **prepared** for dispatch, not proof of work started.

Handoff recovery: \`docs/survival/NEW_CHAT_BOOTSTRAP.md\` → \`CHAT_REENTRY_HANDOFF_CURRENT.md\` → \`CONTROL_TOWER_CURRENT.md\` → \`CURRENT_PRODUCT_CONTRACT.md\` / \`DECISIONS.md\` / \`ACCEPTANCE.md\`; Google Docs https://docs.google.com/document/d/1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo/edit tabs 04 and 12. 