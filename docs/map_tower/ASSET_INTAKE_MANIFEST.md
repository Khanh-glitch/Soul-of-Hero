# Asset intake manifest — exact gaps (no Drive, no private repo at build time)

Every item below was searched on the SOH branch, on `map/veyra-gold-asset-canon-20261102`, in the
five committed `raw_packs`, and in `assets/environment/**` (cainos_demo, ocean_cainos, dungeon,
dungeon_0x72, chapter1/*). Nothing here is a vague category.

| # | Pack ID / file | Members required | GOLD objects | Native size | Role | Compatibility | Why committed art cannot do it |
|---|---|---|---|---|---|---|---|
| 1 | `812442-craftpix-medieval-village-buildings.zip` | roofed house bodies + roofs (3–4 variants), door/window overlays | `po_village`, `po_hamlet` ×6, `po_port` ×8, `po_facility` ×3 | 32×48 – 64×64 | Greywater/ports read as inhabited | 32 px grid, 3/4 top-down like cainos | chapter1 sets have `struct_wall`/`struct_arch`/`struct_stairs` only — **no roof sprite exists anywhere in the repo** |
| 2 | `695666-craftpix-undead-tileset.zip` (**Undead Tileset**, not Cursed Land) | tomb slabs, sarcophagi, bones, broken monuments | `po_tomb`, `po_necropolis`, `elder_anubis` (br_… site set) | 32×32 – 48×32 | Anubis necropolis identity | 32 px | `sarcophagus` family filters to **0 sprites**; `niche`/`pillar` crops are UI cards, not world sprites |
| 3 | `958568-craftpix-cursed-land.zip` (**Cursed Land**, volcanic set) / `974061-rocks` | lava cracks, basalt columns, cinder cones | `elder_surtur`, `po_smelt`, ash zones | 32×32 | Surtur volcanic geology | 32 px | committed rock family is temperate grey granite; no lava or basalt art |
| 4 | `694865-craftpix-sea.zip` → **seabed objects** (the sea pack's `Underwater/` set: rocks, seaweed, shipwreck parts), not the animated surface | seabed detail under shallow sea and lake margins | `dk_cinder`, estuaries, lake shelves | 32×32 | 694865's own surfaces are already used for water; the seabed layer is empty | 32 px | open-water surface ships from 694865/island pack; seabed props are absent, so shallow water is flat colour |

Everything else the round needed **was** found on SOH Git and is now used: bridges, plank piers,
shore bands, sand, dirt roads (raw packs), walls/arches/stairs/doors/banners/props (chapter1),
trees/bushes/rocks (cainos_demo).
