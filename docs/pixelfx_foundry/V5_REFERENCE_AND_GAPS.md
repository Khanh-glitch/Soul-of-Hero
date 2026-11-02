# Foundry v1–v5: verified lessons, presentation algorithm and **unresolved** gaps
This file is a SOURCE-OF-DECISIONS REFERENCE for a new Agent, **not an assertion that v5 is bundled or that the three manual ports have PixelFX upstream parity**.

## Asset custody and what is missing
The complete v5 HTML, source ZIP, sample atlas JSON, PNG screenshots and benchmark JSON were generated in a separate ChatGPT runtime. They are **NOT on this Git branch**, so do not claim access to them merely because this document exists. They are not an authoritative PixelFX upstream oracle. The user's goal is importing official PixelFX 244 using a universal exporter. If no local v5 files are available, reconstruct the reusable presentation from the rules below and document the missing direct v5 comparison.

## Authoritative creator visual constraints
1. Bright original **cyan wake, surrounding blue glow, frost motes** on Ice Lance; cannot reduce to just an icy spear.
2. Keep deep, brilliant **purple source emission, bloom, orbiting particles** on Arcane Orb and Black Hole. No washed-out, transparent-looking composite.
3. Black Hole is **grounded on the field**. Orb may hover. Independent ground-contact/pivot/art center/lens center. No blanket +Y shift of all source pixels.
4. Black Hole additionally distorts the *actual* ground/creatures/structures in a localized bounded region. Optional scene interaction is not fake geometric circles.
5. At night the **complete skill silhouette and emission** remain bright, even somewhat brighter, despite the world darkening. Respect relevant roof/actor occlusion separately.
6. **No generic concentric circles, area ellipse, range ring or manually drawn "impact" shape** as a default. User specifically rejected extra circles on Tier III and called them poor-looking on Tier II. Favor authored PixelFX assets to communicate range, a source-authored organic tell, or nothing. `extraShapes:false` is hard default.
7. Keep pixel edges sharp, original particles, trails, timing, frame 0 / end, full effect lifecycle. Damage timing must be driven by actual combat events later; importer may not invent gameplay.

## v5 actual implementation observations — not a reusable 244 implementation
- A web/React+Canvas SOH prototype retained five original panels and a physical three-core hotbar.
- An `fx_presentation.ts` mapping had three **hard-coded profiles**: lance (scale .95, blue), orb (.90, hovering purple), hole (.93, grounded purple).
- v5 render art passes were ordered **after** `drawWeather` and `drawLight`, specifically `drawPixelAnchors`, `drawNightSafeSources`, `drawPixelRadiance`, `drawPixelLight`. This preserved skill brightness through night darkening. **Caution:** v5 also drew `drawPixelAnchors` including generic circles; DO NOT copy that part. The future compositor must support geometric-free presentation.
- v5 source-art emission factor used bounded `1+0.52*darkness`, multiplied by a quality emission multiplier. Exact parameters are tunable; original art and source additive-light rules must be protected. Do not apply light twice to upstream `clear` images.
- Quality presets: High `{lensHz:24,lensScale:.72,lensCells:10,maxLenses:2,emission:1,groundLight:1}`; Balanced `{lensHz:18,lensScale:.48,lensCells:8,maxLenses:2,emission:.93,groundLight:.85}`; Performance `{lensHz:12,lensScale:.36,lensCells:6,maxLenses:1,emission:.80,groundLight:.70}`. These control secondary world response and must not delete source trails/glow or mute effect animation.
- Cached localized scene lens: choose active grounded distortion profiles inside view; clamp physical region about 68-pixel radius; copy the bounded background region to a downscaled offscreen canvas; perform coarse tile-grid coordinate displacement; cache image for 12–24 Hz, re-use between refreshes; cap concurrent lenses; free expired caches. No `getImageData` / `putImageData` or full-canvas blur per frame. The source FX itself was **not** distorted.
- Cached radial environment light brush by tint/radius rather than rebuilding gradients each frame. Distinguish this soft lighting response from a fake hard-drawn circular VFX primitive.
- v5 measured controlled direct Canvas draws on headless Chromium with three simultaneous Black Holes: v4 median 13.6 ms, v5 median 2.6 ms (26 samples). Other measured medians: v4 0/1 = 9.8/9.7 ms, v5 0/1 = 1.2/2.5 ms. **Not** a hardware FPS guarantee, not a 244-effect performance benchmark.
- v5 sample observed HP: Tier I target 250→212, Tier II 250→229, Tier III 250→216 in separate checks; charged slots decremented 30→29,25→24,15→14 respectively. The library asset intake **MUST NOT** assign damage, roles, or production-combat rules from those historical examples.

## What v5 did NOT solve (must be transparent about it)
1. Three visual algorithm ports remained handwritten from selected PixelFX examples; parity was only against the selected ports, **not official upstream**.
2. Pure/Loop only does not prove Simulated, Acting, Body-Bound, Environmental, or Screen categories.
3. v5 `fx_presentation.ts` had three explicit profiles rather than a full schema/default+exceptions system.
4. Scene/night top-pass favored readability and could allow some FX to appear over roofs; require explicit depth policy per layer.
5. Generic geometry survived in v5 despite the user's rejection. All new registry/browser implementations must *remove* those shapes.
6. Distortion cache can lag during fast camera motion; inspect 1/3/10 effects, 720p/1080p/1440p on target hardware.
7. The original SOH production project is Godot, while the visual lab was a separate React/Canvas ZIP. Web preview success is **not** production-native integration.

## Required generic composition contract
`official pixel frames (combined + separate raw/light) -> role/anchor/pivot/depth metadata -> per-instance local clock -> source-art composite after night for visibility + explicit occlusion -> optional cached scene response -> lifecycle cleanup`.

Every ID should reach DISCOVERED, EXPORTED, PARITY_PASS as appropriate *without manually redrawing or tuning 244 effects*. Separate source facts from proposed SOH roles. Data-driven exceptions may be needed after inspecting visuals, but do not author an individual renderer for every ID.

## Why upstream is mandatory
The authoritative PixelFX library lives at https://github.com/patch-gg/pixelfx with `tools/lib/fxlib.mjs`, `tools/sheets.mjs`, `src/fx/**`. Its `renderFrames` exposes `raw`, `light`, `clear` and actor-aware `color`. The final importer must render via that exact source SHA and compare decoded atlas pixels to canonical `clear` at equivalent seed/fps/timeline. The v5 screenshots are **not required to prove upstream art parity**; they only provide previous game-presentation expectations.
