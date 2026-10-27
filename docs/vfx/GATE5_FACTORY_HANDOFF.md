# Gold VFX Factory — Gate 5 handoff (2026-10-27)

## Why this gate exists

We are scaling from a one-off prototype toward a reproducible *source-locked*, audited collection of 155 VFX entries: 135 Web-authored and 20 Fusion design plans. There are **not** 155 production Godot skills. The immutable gold remains the source of truth for each actual authored effect. Never use the old hand-drawn VFX Lab sample as fidelity reference.

## What was delivered

1. `docs/vfx/skill_port_matrix.csv`: original 155-row source audit.
2. `docs/vfx/gold_skill_registry.json`: one row per selected source/variant, original ZIP SHA-256, renderer family, required primitives and six acceptance gates. Every skill remains `integration_approved=false`.
3. `tools/vfx/validate_registry.py`: rejects duplicate IDs, missing gold hashes, conflation of planned Fusion work and any unsupported "ready" status.
4. `tools/vfx/compare_gold_frames.py`: source-vs-native PNG comparator; requires a no-effect reference for both, locked simulation tick/seed/resolution, effect-mask IoU and *foreground* MAE/p95 thresholds. Never accepts empty backgrounds.
5. `.github/workflows/vfx-gold-catalog.yml`: fast Python-only registry validation. [PASS on c0ab](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40520800577).
6. Eight existing native Godot workflows now apply `on.push.paths` based on their own source dependencies, reducing unnecessary imports on unrelated changes.
7. `gold_rupture_sequence.gd`: S01 source-derived 13-wave scheduler, 286 initial base object records.
8. `gold_rupture_runtime.gd`: reuses live source Blob/Chunk/Part and original RingFx post shader, rendering 13 waves as 273 live drawable primitives (plus 13 ring event records), verified in an isolated 480x270 SubViewport.

## Concrete native result

[Godot 4.7 thirteen-wave CI PASS](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40521620063), commit `10bbb126aa2b9e6bf12f044678976a06a4180652`: 13 base waves, 286 source events, 273 visual objects, ring-slot guard and nonempty native rendered screenshot `s01_thirteen_wave_runtime_tick27.png`. The screenshot is archived as CI artifact `s01-live-thirteen-wave-native`. The pipeline uses native physics, live procedural meshes, source Blob shader, ring distortion. It is **not** a pre-rendered sprite-sequence replacement.

Important: This is a **source-derived thirteen-wave baseline render**, not full gold fidelity. Missing/unchecked: central-special wave additions, whole-skill RNG interleaving, sword ribbon, caster and enemy reactions, hit-stop/flash, source dynamic floor interaction when waves move, whole original 7s timeline synchronization, performance under real combat and 2K/4K UI-scale review. Do NOT mark Hairline Rupture `skill_visual_parity=passed` or merge into production.

## Execution sequence to handle many skills

**Wave 1:** Finish Hairline Rupture #01 across all six gates; prove complete 7s source WebGL2 ↔ native Godot time-locked movie/frames, not just a smoke or isolated 13-wave still. Source shader buffer and ground fracturing components are shared only after this.

**Wave 2:** Establish representative original-gold cases for the *three other renderer families*: K-Night OG/RV, Venomwright, and ARCANA III. Maintain distinct renderers because their underlying original pipelines differ.

**Wave 3:** In each proven family, port 3–5 skills per independent batch/PR using its renderer/primitive harness; each skill still requires its own complete gold comparison, interaction/targeting and load test. Failure of one reusable primitive quarantines dependent skill gates until fixed. Do not copy single-skill VFX draw code into dozens of ad-hoc scenes.

**Blocked until source is real:** 20 Fusion designs. No fabricated 'final gold' from a manifest alone; user selections and enemy-on-body A requirements must be resolved and a reproducible runnable gold must exist first.

All authored work remains under `prototypes/gold_fidelity/`, `docs/vfx/`, `tools/vfx/` and VFX-specific CI. No maps, `game/`, `data/`, `assets/` or `project.godot` changed.
