# ARCANA20 batch import — status matrix (2026-11-03)

Pipeline: `web/src/game/arcana_d20/source/c/` vendors the source-C package
(engine + all 20 spells) **unmodified**; `cRunner.ts` runs each SpellDef on the
C Frame with the real SOH world region as ground/base and composites on CPU
with the source `gl.ts` MAIN_FS equation; presented as one `frame` layer via the
existing single WebGL2 presenter (`arcana_lab.ts`). #20 keeps its A+C semantic
bridge (`arcana20.ts`). Catalog + selector in FX Lab (F4). All visual-only QA;
no HP/charge/save changes.

| # | Skill | Status | Note |
|---:|---|---|---|
| 01 | Cinder Crown | FUSION_PREVIEW | A+C recipe per vote; C preview shown |
| 02 | Furnace Wyrm | SOURCE_PREVIEW | single lead B (C preview shown as source study) |
| 03 | Meteor Loom | SOURCE_PREVIEW | single lead B |
| 04 | Ashen Guillotine | REDESIGN_STUDY | creator rejected all; study preview only |
| 05 | Abyssal Bloom | FUSION_PREVIEW | A+C |
| 06 | Riptide Calligraphy | REDESIGN_STUDY | rejected |
| 07 | Mirrorfrost Basilica | SOURCE_PREVIEW | C |
| 08 | Undertow Maw | SOURCE_PREVIEW | B |
| 09 | Chain Verdict | FUSION_PREVIEW | A+B+C |
| 10 | Thunderloom | SOURCE_PREVIEW | C |
| 11 | Volt Carousel | FUSION_PREVIEW | A + C(#9) |
| 12 | Skybreaker Script | REDESIGN_STUDY | rejected |
| 13 | Rootwake | REDESIGN_STUDY | rejected |
| 14 | Spore Nebula | REDESIGN_STUDY | rejected |
| 15 | Thorn Opera | SOURCE_PREVIEW | C |
| 16 | Worldseed | FUSION_PREVIEW | A+C |
| 17 | Event Horizon | SOURCE_PREVIEW | C |
| 18 | Chronoshard | REDESIGN_STUDY | rejected |
| 19 | Constellation Engine | SOURCE_PREVIEW | D lead kept via #19 pipeline; A combat later |
| 20 | Reality Ripper | FUSION_PREVIEW | semantic A+C bridge (donor spell on C Frame) |

Counts: 8 SOURCE_PREVIEW, 6 FUSION_PREVIEW, 6 REDESIGN_STUDY = 20 registered.
All 20 verified runnable (tests/arcana-d20-semantic.test.ts batch test) and
captured in `web/evidence/avfx-20/gallery-*.png` (CI WebGL2 run for GPU frames).
Blockers: none for previews. A/B/D native engines are NOT vendored — fusions
show the C-side source preview with honest FUSION_PREVIEW label until the
A/B/D adapters land; that is a declared adaptation, not a fake fusion.
