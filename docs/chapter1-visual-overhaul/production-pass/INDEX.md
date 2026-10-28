# Chapter 1 — production pass, Levels 6–10

Five individually authored environments. Each level ships its own kit (tile atlas,
prop atlas, light texture) under `assets/environment/chapter1/<kit>/`, its own
architecture document under `data/levels/chapter_1_level_<n>_architecture.json`,
and its own authoring script under `tools/level<n>/`. The presentation layer
(`game/levels/presentation/crucible_art.gd`) is the shared renderer; it reads the
kit name out of the document and knows nothing about any particular level.

A row is only filled in when that level's own pull request-sized pass is done:
authored, integrated, captured natively, and carried through one focused
correction pass. `COMPLETE — AWAITING OWNER VISUAL REVIEW` is a handoff, never a
claim of approval.

| Slot | Working title | Kit | Authoring | Evidence run | Status |
|---|---|---|---|---|---|
| L06 | The Relay House — "Two Souls, One Path" | `relay` | `tools/level6/` | [run 40174706175](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40174706175), evidence commit `8c13ef0` | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L07 | The Beacon Yard — Soul Beacon defence | `vigil` | `tools/level7/` | [run 40179536413](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40179536413), evidence commit `4ef3212` | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L08 | The Divided Reliquary — Reaper and Vampire wings | `reliquary` | `tools/level8/` | [run 40179536413](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40179536413), evidence commit `4ef3212` | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L09 | The Crimson Gate — three seals, one named elite | `gatehouse` | `tools/level9/` | [run 40179536413](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40179536413), evidence commit `4ef3212` | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |
| L10 | The Castellan's Throne — two-phase boss and chapter portal | `castellan` | `tools/level10/` | [run 40179536413](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40179536413), evidence commit `4ef3212` | `COMPLETE — AWAITING OWNER VISUAL REVIEW` |

`gallery/README.md` holds all ten locations in one table; `regressions/README.md`
records what was checked and what was already broken before this pass.

Every image referenced from these pages is a native Godot 4.7 frame, 1280×720,
taken through the production `AppRoot` campaign boot by
`tools/captures/chapter1_visual_capture.gd`. `before_*` frames are the same map
with the authored layer disabled. Nothing here is a plan diagram, a PIL preview
or a generated image; the authoring preview in `tools/chapter1_env/mock.py` is a
design tool and never appears in the evidence tree.
