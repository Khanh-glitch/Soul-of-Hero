# 03 — RESTORE REAL FLUIDITY WITHOUT SACRIFICING VEYRA OR ART
Creator's crucial observation: the same large Veyra island used to play smoothly before new item images and NPC integration. Map size alone is NOT a substantiated root cause. There are TWO different performance problems: (a) live browser frame-time/input and (b) CPU cost of accelerating 336h world time; never use one as proof of the other.
The solo pre-NPC G1B checkpoint already has the new item atlas. Original 157 PNG atlas was imported at 7f126d63; earlier 6486f77 is pre-atlas but also lacks subsequent G1B changes. Neither is a controlled performance comparison by itself.

## Source risks at e939 (hypotheses, not guilt)
web/src/game/item-atlas.ts loadItemAtlas: creates a separate 32×32 canvas for every atlas frame, draws a slice, generates 157 PNG data URLs via canvas.toDataURL, keeps both canvas and URL maps.
web/src/main.tsx: waits for atlas decode before React root mounts, with timeout behavior and fallback to drawn icons.
web/src/ui/common.tsx drawnIconUrl: on first miss builds data URLs for getArt icons/structures, potentially in an inventory/crafting/UI interaction.
web/src/ui/Game.tsx: requestAnimationFrame tick + canvas draw, roughly 100ms UI refresh; validate actual profiler at target SHA, not hypothetical. Renderer can draw cached canvas while DOM uses inline image sources.
VFX uses image-backed resources plus CSS; inspect actual PNG decode/texture/compositor and any repeated bundler base64 CSS regressions. Check image resolution, format, cache key, draw calls, DOM reconciliations, GC, main-thread scheduling, GPU uploads and texture thrash.
PNG file format itself is not generally a bug; repeated conversion/decoding and per-frame allocations may be.

## Measured differential experiments, all labeled
1. Collect objective reference from pre-atlas historical revision (6486f77) ONLY as longitudinal context; record incompatible chest/game differences.
2. On a SAME SOURCE CODE snapshot, use diagnostic switches to compare the approved atlas render path vs direct sprite-sheet crop (or image decode/canvas pooling), with equal visual pixels, same Veyra view, inventory state and hardware. No permanent asset downgrades.
3. Same-code local render/UI toggles in DEV profiling: freeze React rerender vs normal; UI closed/open; avoid actual game simulation mutations. Probe draw-only and tick-only CPU metrics without claiming gameplay acceptance.
4. On NPC branch separately, compare NPC draw-on vs draw-off WHILE authoritative NPC simulation remains ON to isolate sprite cost, and simulate-on vs sim-off only as a diagnostic. Do NOT permanently disable NPC on main product or infer NPC sim benchmark from solo frame times.
5. Measure cold load, asset fetch, decoded bitmap count, total decoded bytes, toDataURL blocking time, first interactive frame, opening/crafting/UI hitch, frame time mean/median/P95/P99 and long tasks, memory/GC, browser renderer backend and viewport 640×360. Compare same browser/GPU/emulation, zoom, scene/item counts, no concurrent build/test jobs. If SwiftShader only, label as such and don't claim physical GPU regression ≤10%.
6. Sample multiple terrain classes only to exclude scene-specific workloads, not to presume map geometry faulty. Source complexity/global compiler may affect CPU time but render frame conclusion requires counters.

## Production improvements IF justified by data
- Prefer retaining one decoded atlas image or ImageBitmap with fixed cell coordinates and drawImage crop, or a small pooled canvas cache where rendering truly needs it. UI spritesheet background positions or object URLs should preserve exact 32×32 pixel pixels with image-rendering:pixelated, no smoothing or CSS scale artifacts. Choose measured best strategy; do not mandate an unbenchmarked API for every environment.
- Avoid 157 separate PNG toDataURL encodes on every startup when direct atlas can serve both UI and canvas. Correct concurrency/load timeout/fallback once, not repeated Image requests.
- Cache procedural fallback only as needed, avoid generating every icon on first unmatched item if measured to block UI.
- Avoid per-frame Image/new object/context/composite/expensive shadow/re-rendering when state unchanged. Investigate input responsiveness, overdraw, layer ordering and devicePixelRatio; don't reduce 640×360 logical source or remove Gold effects.
- Audit VFX PNG vs CSS embedding in production build and runtime GPU uploads. Original visual fidelity, texture/cutout, palette, time and timing must remain intact.

## Objective acceptance
1. Pixel and gameplay output equivalent for same art/camera/animation and all 157 atlas frame mappings; 25 unsupported art IDs remain honest fallback or receive legitimate approved art with provenance.
2. Warm and cold comparison with exact browser hardware/backend, scene setup, repeated samples, visible before/after metrics and uncertainty; never invent target evidence. Aim to restore Creator-observed earlier smoothness; measured ≤10% regression against equivalent official baseline when reproducible, not a fabricated single number.
3. No missing frame / blurry sprite / flickering UI / excessive first paint block. No regression to image rights, chest sheen, Core Gold, night/weather overlays, inventory visibility.
4. Native Godot is a distinct project with project.godot, .gd and .tscn source: inspect actual native capabilities and compile/run on available runtime. A Web screenshot doesn't certify native. Identify asset pipeline duplication across Web and Godot; preserve original Gold/CC0 provenance and correct native 640×360 representation.
5. Offline 336h simulation: separate CPU scheduling test of world events, saves, production, station regrowth and run end. A faster render is NOT h336 throughput PASS; a faster Vitest settle() is NOT gameplay FPS PASS.
If hardware/native tools unavailable, provide reproducible benchmark harness and honest NOT_VERIFIED, then continue unrelated source improvements. Do not freeze work solely on one measurement platform.