# #15 cast-origin review — creator build ce714a6a

This is visual-only evidence, not combat, Gold or production approval. The full
creator run [41378915227](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41378915227)
built and exercised AVFX SHA `ce714a6ad935ad518685e701a92c6821d07ff152`.
Its [partial creator package](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41378915227/artifacts/13113160711)
contains the Windows/Linux previews, #05 A/B and native evidence; GitHub reports
SHA256 `b1850157e21a84260fc12e35b4cebef05706845967d51ac43624e7a9229d53d4`.
CI verified its internal checksums; the archive could not be independently
retrieved in this sandbox.

The 1280×720 before/after JPEGs are **lossy, unscaled frames decoded from the
real captured H.264 review clips**, not synthetic scenes or raw PNGs. The two
before frames are clip frame 25 (source ticks 363 normal, 365 dim); after frames
are clip frame 25 normal and 29 dim. They are comparable bloom moments, not
claimed pixel-synchronized or identical random seeds. The real player moves
right from `(904,3496)`, target `(939,3496)`, through a natural OUT. Camera zoom
0.32 is a diagnostic view, not the ordinary game camera. The before source is
exactly `8c260d9d595d33f96bc333d860851dcaaae12cac` with only the new capture
harness overlaid; it runs graphical Godot from the project. After uses the
exported Linux binary. Both use the same actual route, input and software-rendered
viewport. Input runs until OUT; terrain limits actual travel (~668 units), not
an AVFX movement lock.

Raw PNG frames, wall-time timeline, FFV1 lossless video, and review MP4:
- [Before normal](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41378915227/artifacts/13112705756), [before dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41378915227/artifacts/13111614591).
- [After normal and 12-case matrix](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41378915227/artifacts/13112930698), [after dim](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41378915227/artifacts/13111689685).

These are real 1280×720 captures, but not 60-fps/performance evidence: before
normal/dim have 35 encoded frames over 12.25/12.49 wall seconds, after normal/dim
35/40 over 12.24/8.99. PNG I/O and software rendering affect the cadence;
source ticks can skip. Full-cast means beginning through natural OUT, **not**
that every rendered frame is preserved.

## Actual measurements

At the normal bloom mark, the old live-caster root changes local `[780.2,57.2]`
at tick 220 to `[1222.8,12.9]` at tick 363; the bloom remains `[170.0,120.2]`.
Player has moved ~665.9 world units and five tips are ~321.8–368.6 world units
from focus. With the fix, root `[118.5,123.3]` remains fixed from tick 215 to
358 while player moves ~654.7; focus remains `[170.0,120.2]` and five tips are
~23.1–34.8 units from focus. The source's authored tip choreography does not
promise geometrically attached tips at every instant. Dim observations and all
three sampled beats are in the JSON files.

For **each** lighting the post-fix matrix covers 35, 140, 900 units × four
bearings × three beats. At these 72 samples no simulated tendril vertex lay
outside the active tile union, no tile cap was reached, and at most three extra
tiles were active. Edge-raster activity occurred in 22 normal and 20 dim samples;
these counts are indicators for further seam review, not proof of seam absence,
all-pixel coverage, or coverage between samples. Matrix sheets contain unscaled
1280×720 cells; they are JPEG transports, while untouched PNGs are in artifacts.

At normal 900/right tick 360, first root to focus measures ~876.6 world units;
the five actual chain lengths are ~516.0–766.9 and tip-to-focus gaps ~124.0–353.7.
The nominal 23 × 6.2 source rest lengths × scale cap 3.5 equal ~499.1 units,
**not a hard physical maximum**: the finite-iteration Verlet constraints
naturally allow longer segments. The extreme visual gap is a separately
qualified source-geometry/choreography limitation, not a gameplay range rule or
justification for invented/stretching connectors.
