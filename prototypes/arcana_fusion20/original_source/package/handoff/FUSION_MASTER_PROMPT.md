# ARCANA — FINAL FUSION DIRECTIVE (paste into coding agent)

You are taking custody of FOUR independently engineered implementations and the user's binding votes. Your task is to build **ONE** high-end, genuinely integrated, pixel-art combat-VFX laboratory with **exactly 20 final spells**. Each spell must have ONE final composition, not a runtime A/B/C switch. The provided originals are read-only provenance and may be consulted at any time. Preserve the winning artistry while fusing animation, environmental interaction, and actual enemy impact into coherent sequences.

**Inputs:** `sources/A`, `sources/B`, `sources/C`, `reference/Elemental_VFX_Lab_FIXED_Standalone.html` (D, visual reference for #19), `votes/ARCANA_Votes_20-of-20.json`, `fusion_manifest.json`, and `FUSION_DECISIONS.md` in this handoff. Read votes and manifest **before modifying code**. A/B/C labels refer to precisely the archives in `sources_original/`; DO NOT reinterpret A/B/C alphabetically based on any folder names generated later.

## The result, not a collage

Deliver a single game-like arena, a single scene graph/compositor, one definitive spell per ID 1–20, consistently authored native pixel clusters, honest occlusion/depth, common spatial anchors, and one shared clock. Each spell has a complete anticipation → activation → attack/contact → impact → aftermath → disappearance cycle. A spell is not complete if its principal visual is beautiful but its projectile misses the victim, its enemy reaction triggers at empty space, or it snaps off instead of resolving.

The user's ratings are binding **selection signals**, not invitations to average every implementation. For a sole winner, PRESERVE its visual identity before improving integration. For a tie, choose the strongest pieces by *phase or visual mechanism*, not by dumping all their particle systems on screen simultaneously. For `none:true`, treat all three as inadequate: create a superior new composition based on the user's exact criticism, salvaging only identified strengths. For #19, D (the supplied standalone HTML) supersedes A **for the central spell visualization**, while A continues to provide enemy reactions; design an elegant OUT phase after D's stellar payoff. `ARCANA_19_Reference_With_Exit.html` is an experimental study of the OUT phase, not an already-approved final.

## Technical collision: non-negotiable design problem

A uses a deterministic CPU/HDR framebuffer of **416×234** and owns `src/engine/world.ts`, `enemies.ts`, `lab.ts` and per-spell `src/spells/choreo.ts`. B uses a **384×216** CPU/HDR renderer in `src/engine/renderer.ts`. C uses a CPU pixel `Frame` plus WebGL compositor, 384×216 native buffer (verify `src/engine/frame.ts`), in `src/engine/stage.ts` and `src/engine/gl.ts`. D is a separately bundled WebGL2 engine at **480×270**, not a native plugin for A/C. They differ in camera space, caster/anchor locations, shader passes, alpha ownership, simulation state, glow/pixel grids, and display composition.

**First establish a canonical coordinate/time/layer contract; then port the winning visual mechanisms.** Simply pasting a class from B into A, overlaying opaque source canvases, screen-recording effects, chroma-keying full-floor frames, or running four isolated mini-games in four iframes is NOT fusion. Do not discard authentic source features in favor of vaguely similar generic replacements merely because they are easier to port.

Recommended integration baseline: preserve and adapt A's world/combat model, enemy sprite animation, status and reaction logic, and deterministic fixed-timestep clock. Build a visual-adapter boundary for B and C (and D for #19), with common `SpellContext`, deterministic `VisualInstance`, `ImpactEvent`, `EnvironmentEvent`, normalized positions, effect passes (ground/decal, behind actors, actor-contact, in front of actors, additive light, displacement), camera transforms, seeded randomness, and repeatable seek/replay. You may choose a different integration architecture if you PROVE it preserves the elected source visual identity, A's real enemy effects, and pixel-native quality across all 20.

Never make combat effects dependent on the **hidden private fields of the discarded A spell**. The original A `CHOREO[id]` inspects properties such as Furnace Wyrm's `head`, `hist`, `impactT`; Meteor Loom's `ms`; water's `BURST`, `strokes` and `WAVE`. These do not exist in B/C/D. Either retain an A 'shadow' simulation for physical choreography while rendering the winner, carefully retarget its contact coordinates/timing to visible geometry, or rewrite the corresponding `CHOREO` on a stable event contract. Do not silently no-op `CHOREO` when the winner is not A. Replacing all impact logic with one generic AoE is a failure.

Source coordinates differ and must be mapped **semantically**, not just stretched: caster, spell focal center, target anchors, projectile paths, collision shapes, shockwave centers and camera. Spell phase beats must be mapped between source durations by named events (e.g., `first cast`, `contact`, `climax`, `delayed rupture`, `decay`) rather than a global `time *= ratio`. Preserve perspective ellipse and collision readability. Keep one source of truth for hit detection and hit-stop; avoid double-triggered screen shakes, overlapping post-processing or two damage applications for one intended contact.

## A's actual ENEMY EFFECTS: port the behavior, not just the figures

A is the only candidate with a serious integrated target-reaction system. Its `src/engine/enemies.ts` has `damageEnemy`, `updateEnemy`, and element-conditioned drawing/deaths; `src/engine/world.ts` exposes `W.impact`, `W.sweep`, `W.lineHit`, `W.pull`, `W.freeze`, camera and effect events; `src/spells/choreo.ts` scripts the spell-dependent performance. Preserve **all behaviorally relevant systems**, including the matching spatial/temporal events and actual on-body/actor VFX:

- hit flash and per-element tint, bodily squashing/stagger, directional knockback, launches, midair recovery, and environmental collision where appropriate;
- fire ignition/burning and death effects; water wetness and flow/push; ice freeze and eventual shatter; electricity crawling along actual enemy bodies and wet-conduction; verdant rooting/spores; astral displacement/warping; coherent elemental interactions;
- impact-anchored sparks, droplets, ash, frost and debris; the 7-layer enemy hit reaction where A implements it; hit-stop applied to the correct visible contact frame; damage popups optionally toggleable; caster recoil;
- enemy/world event correctness even when the elected visual came from B, C or D. Test that different spell archetypes trigger different contact patterns (sweep/line/multihit/pull/chain/area), not just an identical blast at the center.

A canvas showing stationary A enemies behind B/C magic does **not** satisfy this. At least one target must visibly react during the most important hit of **EVERY** spell. Make interactions physically plausible and legible; avoid every effect killing all targets on contact. If a selected spell is spatially incompatible with an A combat cue, realign the cue instead of moving the visuals to hide the mismatch.

## Environmental FX

All 20 spells also require environmental interaction, but its visual source follows the user's vote, **not automatically A**. If elected B/C provides better floor effects, footprints, puddles, icy surfaces, living roots, scorches, persistent dust, or displacement, retain that visual. Translate it into a coherent shared environment/decal/displacement pipeline. Allow the environment to remember the spell briefly after the main event; avoid indefinite accumulation, visual noise, and phantom decals after replay or seek.

## Binding twenty-skill fusion plan

Use `fusion_manifest.json` for all machine-readable details, and `FUSION_DECISIONS.md` for individual art direction. This summary does not replace them:

1. **Cinder Crown** — A+C: preserve strong crown/charge and distinctive detonation; combine deliberately, not double blast.
2. **Furnace Wyrm** — B visuals. Make its path/head/bite drive A-style traveling contact and body reactions.
3. **Meteor Loom** — B visuals. Sync each meteor impact and floor scar with A per-meteor hit/knockback.
4. **Ashen Guillotine** — NONE. Redesign the cut so strike direction, slit and floor wound make physical sense. C's fire column and A's ground cracks/impact are ingredients, not accepted winners.
5. **Abyssal Bloom** — A's excellent opening→peak, C's falling water/column aftermath; cut A's extraneous explosion tails.
6. **Riptide Calligraphy** — NONE. Keep C's coherent, believable water-writing gesture plus A's soft, precise ribbons. Rewrite choreography into legible strokes turning into blades.
7. **Mirrorfrost Basilica** — C, including its superior tempo and crystal behavior; restore A's ice status/shatter on enemy contact.
8. **Undertow Maw** — B's vortex. Keep recognizable inward suction and pressure inversion, plus enemy pull/launch.
9. **Chain Verdict** — A+B+C: A's rational chain and violent on-body electrical reaction; B's two lightning colors; C's balanced bolt density and strong visual contacts. Avoid three competing chains.
10. **Thunderloom** — C as visual lead; precision lightning spear with matching A contact events.
11. **Volt Carousel** — A as layout/spatial choreography lead; improve the electricity using **C's #9 Chain Verdict** lightning technique, not A's weaker arcs.
12. **Skybreaker Script** — NONE. Keep the elaborate glyph idea of A if useful, but rewrite strokes using C's advanced lightning vocabulary, with readable sequence and actual climax. The previous comparison did not show the full burst; verify it.
13. **Rootwake** — NONE. B/C opening growth is worth retaining (C slightly preferred), but their progression looks unnatural. Redesign root biomechanics, branching and convincing tendril action.
14. **Spore Nebula** — NONE. All three were too random. Build causal colonies with visible infection/connection, biological propagation and decisive reproductive peak.
15. **Thorn Opera** — C visual lead, plus A's responsive rooting/strike contact behavior.
16. **Worldseed** — A+C: A smooth motion, C stronger color. Preserve both without washing out source color ramps.
17. **Event Horizon** — C visual lead, A astral enemy displacement and appropriate environment warping.
18. **Chronoshard** — NONE. B's crystals are best. Rebuild narrative logic: stored past/present/future, unambiguous cause→effect and final synchronisation, NO arbitrary bouncing between gems.
19. **Constellation Engine** — D standalone is now preferred visual lead (supersedes A for visuals). A's genuine combat reaction remains mandatory; create a satisfying, clearly perceivable OUT phase (unwind nodes/paths, stellar dust, last pixel disappears). Preserve D's unique geometric evolution; avoid generic radial detonation as the only finish.
20. **Reality Ripper** — A+C: C's coherent spatial-tear silhouette, A's superior environment distortion. Enemy astral warp must track the rift, not the screen centre by default.

## Working method: prove visual parity before increasing scope

1. Run the four source references and collect their signature frames/motion for the elected phases (including #19 D). Preserve source hashes, do not edit originals.
2. Build a single actual integrated pilot of **#9**, **#5**, **#2**, **#17**, and **#19**. These stress chaining+enemy electricity, hybrid liquid phases, traveling contacts, spatial warp and external WebGL reference respectively. Inspect video, not only a peak screenshot. Demonstrate each pilot's **real enemy hit reaction** and **environmental response**.
3. Integrate the remaining fifteen using the same contracts, then do a full pass on all six `none:true` spells (#4, #6, #12, #13, #14, #18) to make them genuinely better than every source, not merely less buggy.
4. Examine 20 full-length videos or animation captures and an indexed contact sheet at cast / 35% / contact / climax / decay. Verify secondary hits and after-effects in motion. Keep frame-based controls and deterministic seeks. Provide automated checks for event timing, damage/status activation, replay reset, leaks/NaNs, shader compile, and 2K/4K nearest-neighbor presentation.
5. Deliver one playable source project, a single build (preferably standalone HTML if feasible without sacrificing fidelity), 20 distinct effect implementations, provenance/attribution and before/after visual evidence for critical fusion decisions. Hide original A/B/C/D candidates from the **final** playback UI; originals remain separate in `sources_original/` for audit.

## Final acceptance: actual fusion, not a stacked demo

For each skill, verify: **winning motif retained; two or more phases improved where elected or needed; actual A-grade hit and on-enemy effects; coherent environmental reaction; clear contact position; authored exit and reset; pixel integrity at high resolution**. All twenty must pass, and 19 must use D's visual identity and have an OUT phase. Include an event-telemetry table recording the first cast, target hit position/time, status type, reaction confirmation, environmental decal/warp, and residual cleanup. Do not claim a phase passed without a runtime screenshot/video or logged event proving it.

The user already evaluated three strong candidates; do not replace their selected best work with a fourth generic particle system. **Preserve, re-engineer, and surpass each selected strength.**
