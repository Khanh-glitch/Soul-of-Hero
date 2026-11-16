# NPC PRE-PRODUCTION HANDOFF — THE LAST HUMANITY (2026-11-16)

**Status: IMPLEMENTATION HOLD — ASSET-FIRST PRE-PRODUCTION.** The Creator caught an incorrect scheduling assumption: this contract exists, but there is no approved complete Veyra NPC character art/animation library. **DO NOT START full-world NPC runtime/AI or represent this document as an activation authorization.** An asset-only research/production agent could be commissioned separately, but only by explicit Creator action and with a visual handoff reviewed in actual current Web Veyra. Character art approval is required *before* authoring the mass NPC runtime/roster.
**Parent:** G1B Batch 3 commit d6558ce4000f1125d3c68600d9bcd508f01778e5, PR #61 still Draft. **Working branch:** design/npc-last-humanity-final-20261116. Create a separate Draft PR targeting arena/f7f5cf36-soul-of-hero (or its current successor if rebased cleanly). Never push NPC changes onto G1B PR #61, merge or force-push.

## READ FIRST AND AUTHORITY

1. web/ref/bible.md, especially the Creator's 2026-11-16 [CHỐT] 'HÒN ĐẢO CUỐI CÙNG CỦA NHÂN LOẠI'.
2. web/ref/survivors/SURVIVOR_SETTLEMENT_CONTRACT_V1_20261115.md — entire canonical contract §§0–37; sections 28–37 supersede historical OPEN alternatives. **No second NPC Bible.**
3. web/evidence/npc/NPC_81_POI_PHYSICAL_AUDIT_SEED.csv — 81 grounded sites + actual 811-space source count, but this is NOT proof of beds, people, water or personal ownership.
4. web/evidence/g1b/G1B_BATCH3_REPORT.md and web/evidence/g1b/G1B_PLAYTEST_HANDOFF.md — G1B 729 candidate sources. Do not touch 16 odds pools or convert rương to NPCs.
5. Current code, not stale reports: web/src/game/{engine,sim,render,art,hero-art,persist,catalog,poi-access}.ts, web/src/veyra05/{floors,window}.ts, item master and balance; inspect licensing of assets/characters.

## THE PRODUCT WE MUST BUILD

The final island of humanity on an Earth ruined by Elder forces. Existing humans struggle, rebuild, love, distrust, hoard, work, recover and sometimes abandon shelters while the 336h run moves toward Ragnarök. The player remains an optional solo survivor or can become an emergent leader through real help, rescue, trade, housing, guarding, delegated work and expedition; NEVER an invented Leader title/XP/quest. Strong social contrast across inhabitable pockets, fragile dependent groups, abandoned areas, Elder-danger routes. No stable magical villages and no scripted universal collapse.

## BLOCKING ENTRY GATE — REAL, USABLE NPC CHARACTER ASSETS FIRST

The current repo has a Web procedural 16×24 four-direction player sprite and procedural vendor; 2 Home Map idle-only NPC sheets (not approved for Veyra); GandalfHardcore Archer 64×64 combat sheets (commercial game use allowed but restrictions and camera mismatch to assess); Axe Warrior 120×80/30-action sheets with explicitly unresolved commercial provenance; and Knight/side-view cavalry specialized Hero content. **None constitutes a verified reusable full-world Veyra NPC set.** The 157-item atlas provides items, NOT humans. Do not start NPC gameplay using invisible actors, colored squares, two cloned idle sprites, procedural capsules or unmatched side-view hero sheets and later label it DONE.

**Gate A — provenance/access:** inspect all source packs already stored in authorized project sources, manifest each frame sheet's author/source, exact game/commercial rights, permitted modification/distribution and prohibited model training. Avoid inaccessible private raw assets or unauthorized redistribution. If a pack has missing proof of rights, do not silently use it as production art. Choose legitimate adaptation or newly authored art with recorded provenance.

**Gate B — visual system, before AI:** define pixel-faithful native 640×360 scale/feet anchor, consistent Veyra top-down 4-direction camera, modular distinct adult silhouettes, clothing/hair/body/equipment overlays mapped to actual item ownership, shadows/occlusion on levels; create the **actual atlas PNG + machine-readable animation manifest + importable Web preview**. Animation needs idle/walk/run, talk/trade, work/harvest/repair/cook/medic, haul, rest, melee/ranged/Core, hurt/downed/help/death; a reduced visual sample for each major family may be prepared first but no promised action can remain unillustrated at full feature handoff.

**Gate C — creator visual acceptance:** hand off unedited current-game 640×360 shots/recordings from day, night, indoor/upper floor, group crowd, walking/work, armed animation and downed/rescue; a **real playable visual review build** with several genuinely distinct adult prototypes. Agent may check frame indexing and clipping; ONLY CREATOR approves the feeling and quality of the last surviving humans. No automated player-experience scoring.

**Gate D — runtime activation only after A/B/C:** once human art direction and asset pack are approved, create a separately authorized NPC runtime implementation task and reconcile its parent with the corrected G1B source/save schema. The feature scope below is a future implementation specification, **not today's start command**. Independently, G1B P0 557→729 save migration must be resolved. No NPC or asset changes on PR #61.

## REQUIRED IMPLEMENTATION STREAMS (all mandatory for full feature)

A. **WORLD/CONTENT:** Audit all 81 POIs and all walkable rooms/floors/roofs/road segments. For every real human, create persistent source ID, origin, home/bed or itinerary, actual assigned item stock, relations, role/skills, initial needs, trade/core provenance and legal route. Human density is derived from authored living capacity and world history — no one-per-POI quota. Author real beds, containers, water access and necessary set dressing with provenance when plausible, without deleting G1B sources/furniture for convenience. Site candidate classes are not NPC spawn authorizations.

B. **HUMAN ACTOR ENGINE:** Run-owned humans distinct from creatures, one global identity/projection across local windows, real floors/doors/stairs, movement, target/LOS, K5 combat, armor, weapon/arrow/Core and friendly-fire rules; downed alive/bleed/stabilize/recover/dead bag once, equipment/UID custody and medical receipts. NPC–NPC interactions as well as player–NPC. Reuse player law and existing 157 item catalog.

C. **HUMAN ECONOMY:** personal/household/communal-authorized/shop/escrow custodians separated; one physical trade/steal/offer transaction and no NPC loot-roll mint. Needs (actual real-hour Hunger, Thirst, Rest, Exposure) with measurable supplies, source-backed gardening/water/food, the 8 professions through existing stations and bounded work orders; non-recruited settlements work only with their own resources. Offline advance only lawful, known, finite action timelines. No unseen pantry, unlimited food or synthetic starvation on load.

D. **SOCIAL/BANDITS/MEMORY:** relationship and personal will, observed knowledge/witness/communication; actual equipped robber or traveling guardian, physical assault/robbery and damage; grievance survives relaunch, global track by lawful LOS/weather/material/trace evidence, possible real pursuit and base theft but NO random raids or NPC teleport to the player's home. Finite immigrant source tokens, no resurrecting dead villagers.

E. **OPTIONAL PLAYER LEADERSHIP/PARTY:** real consent, housing/bed/ownership, assign bounded jobs, protect and rescue, trade, release and change home. Companion Follow/Hold/Defend/Engage/Retreat/Return/Carry with independent will, loaded gear, injuries, no simultaneous home labor, actual route/floor/vehicle boarding capacity. If no passenger seat exists, it is impossible; human waits/walks legitimately, no rubber-band fix.

F. **ASSET PIPELINE — MUST CLOSE ENTRY GATE BEFORE FULL-WORLD RUNTIME:** current Web vendor procedural sprite and two Home Map idles are NOT production NPC art. Audit commercial rights and orientation; create/import original coherent 4-direction multi-body NPC atlas at current pixel scale with distinct silhouettes, hair/clothes/gear overlays and full motion: idle/walk/run, talk/trade, work/harvest/cook/repair/build/medic, carry, eat/drink, rest, guard, attack/bow/Core, evade/hurt/downed/assist/recover/death. Tie action frames, sounds and equipment visuals to real engine state. Commit PNG + manifest + provenance; test actual 640x360 render/day-night/interiors/floor shadows. Never pretend 157 item atlas solves human character art.

G. **WORLD SITUATIONS:** Greywater, Slagworks, Ironholm, Argus Academy/Observatory/Archive, Delta Filter, Falls Powerhouse all have real physical before/after object state, legitimate human source, optional intervention (ignore, trade, help, rescue, assault/steal), save/offscreen consequences. Machine states (pump/filter/water/power) must be implemented if the situation claims them; no decorative 'machine repaired' dialogue flag. No quest log progression; G1B card/power/PPE and Core grants remain separately authorized.

H. **RAGNARÖK:** NPC reactions to last 72 hours use actual hazards, observed information, stores, shelter and routes. No automatic universe-wide panic/raid, guarantee every village lives, or unsourced auto-evacuation; player can survive/evacuate solo as before. K8 full reset for humans and their belongings.

## ARCHITECTURAL PRECONDITIONS / FAILURE MODES TO CLOSE

- Save version/schema migration for existing valid G1B-only runs; no actor clones on stream/floor/restart, no duplicate corpse bag, trade stock or Core.
- Unit/floor tested collision and dynamic gates; no human bypass of GREEN/BLUE/PURPLE access or physical owned doors.
- Persistent global trails and per-person knowledge origin; camera shift does not create omniscient witnesses.
- Real item and Core transfer/weapon wear, no hidden magazine and no re-roll from NPC death/recruitment.
- Daily work/meal/crop/water conservation across full 336 real hours; no offline arbitrary massacre or magic job output.
- Existing 81-site and road mapping, environmental hazard/legal route before placing people. Keep map owner conflicts visible and resolve geometry or document.
- Current G1B screen UI and source IDs untouched; actual Web 640×360 visual human art must work now, not in a Godot side project.
- Code TypeScript/build correctness and targeted objective regression testing at the final SHA, compare inherited failure baseline rather than claiming a red suite is all new.

## HOW TO REPORT / ACCEPT

AFTER THE ART AND G1B SAVE ENTRY GATES HAVE BEEN CLOSED, do not stop at a three-NPC proof of concept. Internal vertical slices are fine, but FINAL NPC feature is full-world (only physically eligible spaces inhabited, some deliberately empty). End with one playable latest SOH build, source commit and Draft PR, real game input instructions, 81-space census, resident roster, 336h supply budgets, initial finite Core gear list, human art manifest and unedited 640x360 shots in varied scenes; source-and-cost receipts, migration and limitations.

**Separate: ENGINEERING VERIFIED / DESIGN CANDIDATE / CREATOR PLAYTEST REQUIRED.** The Creator must personally judge whether these look like the last humans and whether the social landscape, rebuilding, combat and art are worth playing. **BOT TESTS NEVER DECIDE EXPERIENCE**; bot navigation can only test objective legality. No fake end-to-end acceptance, no player feeling simulated by AI.

If a specific mechanic or right-to-use asset is missing, acquire/create a lawful replacement or implement the needed mechanic before claiming full coverage. Name bounded blockers with exact code/evidence; do not stop with generic 'need assets' and do not ask Creator to choose HP/Hunger/Core numbers. Maintain no merge or force-push.
