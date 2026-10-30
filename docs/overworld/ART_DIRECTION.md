# Overworld art direction — the rules the frames are built to

Everything here is measured from the shipped atlas and the native frames, and is
enforced where it can be: the bake refuses unattributed props, the capture refuses
flat frames, and `overworld_occlusion_runtime_test.gd` refuses a fade that hides
nothing. A rule that cannot be checked is written as a rule, not as a claim.

## Reading distance

The camera is at zoom 2 over a 640×360 viewport, presented at 1280×720. The
player sees **20 × 11.25 tiles**. That is the whole argument for how the art is
built:

* **A tile is never the unit of design.** Anything that repeats per 16 px reads as
  a lattice at this distance, which is why ground variation is chosen per 3×3
  cluster, why paving courses run across tile edges, and why the four stone
  variants differ by more than a shade.
* **A feature must survive 2× magnification.** One-pixel detail disappears into
  the grain. The smallest deliberate detail in the set is 2×2 px (a mortar chip),
  and the smallest *readable* feature is 4×4 (a dropped slab, a moss patch).
* **Silhouette carries identity.** At 20 tiles across, a player recognises a
  destination by its outline before any surface detail: a colonnade with a bell
  tower (L03), a stepped mound with a burning seam (L04), a twin-towered keep
  (L10), a gatehouse with braziers (L09).

## Value structure

| Zone | Value band | What it does |
| --- | --- | --- |
| ground | 0.30 – 0.42 | everything the player walks on sits in one narrow band, so props never fight the floor |
| props, back | 0.45 – 0.60 | trees, ruins, fences — present, never loud |
| props, front | 0.62 – 0.85 | landmarks and camps, so they read against both ground and sky |
| light | 0.90 – 1.00 | flames, soul-light, the brazier glass — the only pixels allowed to be this bright |

Measured on the native stations: mean luminance 0.33 – 0.37, standard deviation
0.063 – 0.092. A frame outside that band is either washed out or too dark, and the
capture's report says so.

## Colour

One material culture, four materials: grey-violet stone, rusted iron, dried cloth,
cold relay cyan. Regions vary the *ground* (moor, bog, ash, ritual earth, soul
sand), never the stone, because the Marches are one ruin, not ten styles.

Two colours are reserved and appear nowhere else:

* **fire** (warm orange) — camps, braziers, the archive door.
* **soul-glow** (cold cyan-green) — the reliquary's monolith, the relay, anything
  the Soul Anchor touches.

A player can navigate by those two colours alone in a dim frame, which is the
point of reserving them.

## Occlusion and legibility

Advertising the world is not enough if the player cannot see themselves in it:

* Only props that overlap the player's body fade, and only when they are drawn in
  front. A bush two tiles away and a wall behind the player are untouched.
* Fade depth depends on what is hidden: vegetation 0.30, architecture 0.50,
  landmarks 0.62. A destination must stay recognisable while the Knight is visible
  through it.
* Enter/exit hysteresis (2 px / 5 px) stops boundary flicker.
* Fading is purely visual: no collision changes, no movement, no state.

The demonstration is the `occlusion_off` / `occlusion_on` station pair — same
camera, same tile, one flag different — and the capture reports how many pixels
actually differ between them.

## What is hand-painted and what is generated

| | frames | why |
| --- | --- | --- |
| generated | 212 tiles, 45 props | fast, reproducible, and the material vocabulary has to be consistent |
| hand-painted | `lm_archive`, `lm_reliquary` | the two plainest exteriors, both on the critical path |

Hand-painted frames are overrides, not replacements: the generator still produces
its version underneath, the override wins at build time, and deleting the override
PNG restores the generated frame. Provenance is per frame in
`data/overworld/art_manifest.json` and audited by
`tools/overworld/source_audit.py`.
