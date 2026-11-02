# SOH × PixelFX — Universal Intake / 244 Effects Contract

Date: 2026-11-02. Owner: SOH PixelFX Foundry (separate from AVFX GOLD and survival A0–A8). Canonical game rule: `docs/survival/CURRENT_PRODUCT_CONTRACT.md` from `arena/103e4440-soul-of-hero` (2026-11-01 unified Bible). This is **an asset intake / presentation experiment**, not production integration.

## Why the previous five versions are insufficient

- v1: hand-painted mimic was not the requested source effect. Rejected.
- v2–v3: selected manual visual ports; user noticed stripped blue projectile trails, purple bloom, ambient particles, and major scene/UI regressions. v3 had hard-coded geometry and action rings.
- v4: separate source core and emissive atlases, grounded black hole and localized scene warp; retained three selected ports, not upstream parity.
- v5: skill art after night overlay, bounded night amplification, cached localized distortion. Controlled three-hole median direct canvas draw was ~13.6 ms in v4 vs ~2.6 ms in v5; not real-device FPS, no mass-import guarantee.
- User's latest correction: **no generic circular/static addon shapes**. On Tier II, a range indicator is permissible only if organically readable; Tier III black hole gets no extra ring. Use original VFX or appropriate authored library companions; never make generic ring FX the default.

## Authoritative third-party discovery

Official upstream: https://github.com/patch-gg/pixelfx (MIT, see LICENSE and NOTICE). Catalog `docs/CATALOG.md` contains exactly 244 distinct IDs in 21 categories at discovery on 2026-11-02: moves=12, fire=12, explosions=12, water=12, ice=10, lightning=11, scifi=12, melee=12, impacts=11, projectiles=13, spawn=10, arcane=12, holy=10, shadow=12, status=13, nature=13, weather=12, ui=12, pickups=11, transitions=10, critters=12. Pin a full Git commit SHA in the generated manifest before export; blob SHA is not commit SHA.

Source APIs: `tools/lib/fxlib.mjs` exports `allIds`, `loadEffect`, `renderFrames`, `spriteSheet`; `src/core/index.js` exports `createFx`, `createAct`, `createFrame`, `clearFrame`, `composite` etc. `renderFrames()` produces canonical `frames[].clear`, `raw` (color RGBA as Uint32), `light` (additive RGB Uint32) and `frames[].color` with backdrop/actor. `spriteSheet` embeds `meta.pixelfx` (fps, loop, frameSize, pivot, act timing). The published `tools/sheets.mjs` batch exports **flattened transparent sheet** and JSON; it does NOT expose the original light channel separately in its PNG. Therefore **extend the exporter without replacing original renderer**.

## Ownership: what is and is not registered

- Asset Registry means 244 IDs + full upstream metadata + asset provenance + export status + role candidates. Every item may be **DISCOVERED**, **EXPORTED**, **PARITY_PASS**, **VISUAL_REVIEW**, or **SOH_READY**. Never equate registration with game-ready or playable Skill Core.
- A registered item may be: projectile, impact, cast, sustained aura, actor-bound status, environment, UI, screen transition, critter, animated full move. Never auto-create a physical Skill Core or damage event.
- The final Godot 4.7 production port is an **independent gated integration**. A web prototype passing does not authorize changes to A0 SaveService, A3 economy, A6 HUD, AVFX GOLD, `soh_binding/**`, `game/main.gd` or current production scene.
- Branch in repo is isolated docs/tools only. No merge to main or A0 without Control Tower sign-off.

## Standard per-effect manifest

`{id, category, name, tags, type:'pure'|'simulated', hasAct, onBody, actor, meta:{fps,duration,loop,size:[w,h],origin:[x,y]}, provenance:{repo,commit,license}, export:{status,files:[{path,sha256,bytes}],frames,pageLayout}, presentation:{roleCandidate,anchor:'source'|'ground'|'air'|'screen'|'body',depth:'back-front'|'screen',emissiveNight:'post-night',sceneInteraction:'none'|'groundlight'|'warp',extraShapes:false}, qa:{fidelityStatus,visualStatus,perfStatus,exceptions:[]}}`

Only source-backed facts may be auto-filled. `roleCandidate` and `anchor` are proposals until visual acceptance, not facts. Never infer damage, hit radius, attack tier, hit timing or actor animation from pixels alone. `onBody` and `hasAct` require explicit handling, not dummy art baked into native character.

## Universal source → export → scene formula

1. Pin source SHA and Node version. Verify full 244 source IDs; reject count changes until deliberate review.
2. Use original PixelFX runtime to step deterministic frames at authored FPS, seeds, and options. For `create()` simulated effects use official stepped update; do not render arbitrary timestamp with a pure-only adapter.
3. Persist **canonical combined transparent frame** exactly from `renderFrames().frames[].clear` and separately preserve `raw/color` + additive `light`. Avoid double-counting emissive (canonical combined includes light). Treat separate back/front passes as optional, requiring an explicit pixel-parity gate; back/front compositing is not trivially identical to a combined frame with complex blending.
4. For actors/acts preserve `act` data and timing; never silently bake stock dummy characters into SOH player or monster sprites. On-body effects need mask/pixels binding or an exception status.
5. Apply `origin`, anchor, scale and depth by metadata/profile, never one global +Y translation. Orb floats, grounded black hole belongs on the floor. Separate physical damage geometry from visual projection.
6. During play, compose the source effect and emission **after night overlay** so night does not dim it, while sensible occlusion/depth remains. Emission may increase at night but preserve highlights. Use prebaked glow and reuse stamps; no repeated JS particle simulation.
7. Scene interaction (light, warp, drift, material response) is an explicit capability driven by metadata/role; environment deformation is local, capped, reuse buffer 12–24 Hz. Never infer real environmental destruction merely from an image.
8. **extraShapes:false** hard default. No generic ellipses, circles, shock rings, hard telegraphs, opaque overlays, or stylistic fill art. Show danger using an authored source effect or reviewed native environment response; Tier II area warning only if grounded and organic; Tier III black hole no add-on ring.
9. Stream/lazy-load assets by ID; atlas pages bounded by GPU texture max (default 2048/4096), each exported independently, with hashes and official metadata. Never force all 244 atlases into a single HTML or RAM.
10. Close effects and clear resources; deterministic replay; no residual pixels, leaked render target, duplicated damage, or hidden network dependency.

## Audit gates (all evidence from one exact source commit + one build)

G0 Provenance: full SHA, MIT/NOTICE, 244 IDs, 21 categories, unique, record actual source count. Failing G0 stops batch.
G1 Export parity: compare `clear` atlas frame hashes/bytes against official `renderFrames` for selected samples; raw/emissive separately checked, full duration, frame 0/mid/last, loop seam, transparency, light. Exports must use official source, not v1–v5 manual ports.
G2 Breadth: proof on pure loop `ice/ice-lance`, simulated one-shot `fire/meteor`, acted move `moves/ice-lance-throw`, on-body `status/frozen`, environmental `weather/fireflies`, full-screen `transitions/crt-off` and UI `ui/achievement` (verify exact IDs against `allIds` before execution); negative/unsupported cases named, not hidden.
G3 Visual: original/gallery vs SOH day/night at matched authored tick and seed; screenshot sequences/contact sheets/video, source trails/frost, purple bloom, particles, fade, pivot, clipping, silhouette, actor depth, no static circles or extra shapes. Human look required, not automated screenshot status alone.
G4 Runtime/performance: test 1/3/10 mixed effects, 720p/1080p/1440p, 3 quality modes, memory, lazy loading, tab switch/restart, start/stop, screen zoom; compare render p50/p95 and RAF p50/p95 to v5 with same rig and report hardware. Perf must not trade away glow/trails/core art; degrade scene warp before core frames.
G5 Gameplay neutrality: if preview embedded in game, old hotbar/inventory/crafting/building/map/save/AI/damage remain available; no gameplay or save changes from registry import, no fake physical Core.
G6 Production handoff: exact branch/SHA, files, exported manifest, how to reproduce, artifacts/links, 244-row per-ID exception report, partial statuses, rollback, native Godot blocker and explicit GO/HOLD decision.

## Agent boundary

Before batch: owner builds and validates importer/manifest skeleton. Batch Agent uses same contract; allowed to implement tooling in `tools/pixelfx_foundry/**` and docs under `docs/pixelfx_foundry/**`. Cannot alter existing Gold, HUD, simulation, Bible, economy, or Godot production. Any scope break is an issue/handoff, not a silent change.

Review points: (R1) exact source semantics check, (R2) representative cross-category visual/parity check, (R3) 244 batch and distribution/performance review, (R4) final packaging/scope check. An unchecked gate is NOT PASS.