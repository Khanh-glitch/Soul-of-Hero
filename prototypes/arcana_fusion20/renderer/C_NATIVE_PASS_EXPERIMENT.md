# Source C world-pass experiment

This is an opt-in diagnostic, **not** visual acceptance or a production
compositor. `Arcana20Renderer.experimental_c_separate_passes = true` applies
only to actual C players (#07, #10, #15, #17, and the C layer of #01). The
default remains the existing source-buffer diagnostic path, so existing
spatial parity measurements continue to measure the same source port. The
legacy path still has the known RGB-nonzero alpha and local flash-rectangle
problems and must not be treated as an approved world compositor.

The experiment transports C's existing premultiplied `ink` using its explicit
source alpha (converted to straight alpha for Godot); dark/black ink therefore
retains coverage. C's existing `light` is a separate additive CanvasItem. Its
alpha is always opaque: black is mathematically neutral under additive blend,
not an RGB-keyed transparency test. The source's ordered quantization is kept.
Both sprites use the same world similarity transform. There is no captured or
simulated battlefield and no new interpretation of the source geometry.

C's stage flash, camera shake and chroma are **not** baked into these sprites.
The experimental `screen_post(canonical_id, state)` signal provides per-fixed-
tick `flash` (Vector3), `shake` (Vector2), `chroma` (float), and C-local
`source_time`; a scene owner may eventually apply these to the actual viewport
and camera, with explicit policies for overlapping casts and cleanup at
finish/cancel. The diagnostic capture does **not** consume this signal.

Important missing work: C ground/decal, displacement/shading, source GL bloom,
invert/desaturation, source post against the real world and actor occlusion are
not implemented by these passes. Additive blending over a live world is not an
exact replacement for the original C composite over its authored ground. A,
B and D still use their prior single-buffer transport. This mode must not be
presented as source-composite parity or a solution for all 20.

The real-crypt capture saves `skill_NN_c_separate.png` for #01/#07/#10/#15/#17
at the same world state and midpoint as the corresponding legacy sample. #01
still has a legacy A layer. These are unapproved investigative comparisons, not
a bright-overworld, moving-camera video, PR #30 binding or performance proof.
The gate additionally tests black ink coverage, additive neutral, flash
separation and source-post signal forwarding. Existing spatial source gates are
unchanged.
