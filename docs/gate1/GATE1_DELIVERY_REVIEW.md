# Soul of Hero — Gate 1 final experimental delivery and independent visual review

**Status:** G1-A/B/C/D prototype delivered; focused technical checks **PASS**; **visual-production acceptance: NOT APPROVED (81/100)**. This is NOT merged into the Chapter 1 campaign.

## Exact custody

- Working branch: `integration/level3-archive-redesign`.
- Candidate A source (unchanged canonical gameplay baseline): `f27e8b7fe03f33b2001b08579543e5010a0a1b9d`; Level 3 document SHA-256 `5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54`.
- Candidate B original art source: `e7cad36f8f21e746abefe44ac6cfa54db9a378e6`.
- Preserved Gate 0 rollback branch: `integration/gate0-archive-art` at `31a2ec7cf001fe057fb7d3c27ecf35de77553831`.
- Reproducible Gate 1 source of truth: **`tools/gate1/author_redesign.py`**, derived `prototypes/gate1/level_data/chapter_1_level_3_trial.json`, and `prototypes/gate1/visual_placement.json`. The earlier `tools/gate1/author_trial.py`, `trial_level3.json`, `trial_art.json` and `gate1-geometry.yml` are exploratory G1-B alternatives **not** used by the accepted native evidence workflow, and must not be combined with it.
- The production `data/**`, `game/**`, `tests/**`, `project.godot`, Level 2, PR #4 and both Arena candidate branches are **not changed** by Gate 1. The experiment materializes its trial level into the canonical Level 3 path only inside the ephemeral CI runner.
- Original 79 entity IDs/types and gameplay contract remain intact. **No PR, merge or deployment.**

## Actual implementation

This goes beyond Gate 0's small-props-only approach: a **connected south architectural annex** is derived from Candidate A's Level 3, with a framed manuscript sanctuary around Candidate B's full **136×64 `armarium_open`**, flanking columns, a new floor/material zone, masonry backing, a threshold and two prototype-local warm lights. Existing archive furniture remains around the copyist workroom; the source includes 18 props, 13 with collision bodies.

The pinned geometry experiment adds 90 reachable cells without losing any of A's previously reachable 1,008 floor cells: 1,098 reachable in the trial. Backdrop 3,511; Geometry 1,763; Decor 73; 79 entities. All new art is applied with isolated prototype visual layers/whole-sprite props, not unsupported new source IDs in canonical A JSON. The archive/crossfire objective and outward route remain mechanically connected.

## Verification and genuine native frames

[GitHub Actions run #40003355907](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/40003355907): **SUCCESS**, Godot `4.7.stable.official.5b4e0cb0f`, Xvfb/Mesa GL compatibility, actual 1280×720 frames.

The harness now boots through the **real AppRoot → AppFlow campaign Level 3 route** using an isolated fixture save; it no longer launches Main without a run, which accidentally displayed Level 1-only tutorial banners in Level 3. It asserts the actual `LevelOneTutorial` panel is hidden for Level 3 without hiding any legitimate gameplay HUD. This corrected a serious earlier evidence confounder.

Validation includes reproducible derived JSON, SHA-256 checks of **both** base `5ea50e9c...` and trial `096970efecd796e59395e5bcf8deb86942d11d5be9aa90d8e58c67d6516d670e`, no app-origin `ERROR:` or `SCRIPT ERROR:`, real Knight movement (no teleport between stations), sampled body clearance, 13 prop collision bodies, 79 entities, and sources 0/1 only.

Five **AFTER** gameplay-camera locations were captured: `after_spawn.png`, `after_entry.png`, `after_destination.png`, `after_sanctuary.png`, `after_combat_space.png`. Four matching BEFORE frames and close-up/comparison assets are in `docs/gate1/evidence/` at the native evidence commit. The 5-frame walk returns from sanctuary to crossfire, establishing a practical route out of the annex.

The engine reports a V-Sync compatibility warning and seven ObjectDB instances leaked at exit in both BEFORE and AFTER runs. Those warnings were not hidden or represented as an application-success guarantee. No full-campaign production playtest or permanent adapter lifecycle validation was conducted.

## Independent native-image assessment (not CI-score based)

| Criterion | Maximum | Score | Why |
|---|---:|---:|---|
| Recognizable archive and environmental identity | 30 | 24 | North presses/copyist bay visible on spawn; major illuminated manuscript landmark now reads unequivocally as an archive, unlike Gate 0 |
| Architectural correctness and asset assembly | 25 | 20 | Large armarium is structurally framed with complete sprite/columns; annex perimeter and changeover from old gray masonry remain conspicuously rectangular, with hard edges against the void |
| Actual gameplay-camera framing and progression | 20 | 16 | Real Level 3 HUD no longer carries an erroneous tutorial banner; sanctuary landmark reads clearly, but it sits in a detour and does not dominate the very first screen |
| Meaningful damage, props, and story | 15 | 12 | Copyist desk, manuscript evacuation, broken shelf, debris and archive recess support the theme; region still depends on inherited dungeon clutter and rhythm |
| Real Godot build/evidence | 10 | 9 | True campaign route, five walking frames, SHA-pinned generation and source proof; limited local traversal/occlusion coverage, not full campaign |
| **Total** | **100** | **81** | **Below required 85** |

**Decision: a genuinely delivered experimental redesign, but not a production-grade Level 3 sign-off.**

### Observed remaining issues

1. **Arrival hierarchy:** The true first screen is more recognizably archival now, but the large focal `armarium_open` is still reached later by a lateral/southern detour. Players will initially see many elements from A's older gray corridor grammar.
2. **Annex geometry and transition:** The sanctuary is a stone pad against a large black abyss with abrupt rectilinear walls and edge fragments; it is a distinct setpiece rather than seamlessly integrated into the wider Level 3 environment. Review the small isolated cap/short-wall impression from `after_destination.png` at 1× before any future integration.
3. **Lighting and scale:** The painted manuscript glow and limited local lights are successful, but the broader level retains formulaic floor/torches/spikes and imperfect hierarchy. Do not solve this by blindly adding another dozen props.
4. **Gameplay scope:** The focus test confirms a single safe route through the experimental annex, **not** complete ranged enemy sightlines, every combat encounter, full return/reload lifecycle or the entire campaign regression suite.
5. **Experimental source alternatives:** The earlier `author_trial.py` variant is not the design shown in the final Godot frames. It remains only as recorded exploratory work; do not merge alternate geometry inadvertently.

## Gate closure and next ownership

**G1-A** provenance/survey complete; **G1-B** reversible architecture authoring complete; **G1-C** actual game integration and native CI complete; **G1-D** durable GitHub evidence and independent review complete.

**Stop this experimental implementation here.** Keep PR #4 and Gate 0 preserved. Do not merge trial geometry into campaign data or enable an always-on gameplay adapter.

Any future production pass requires explicit art direction focused on whole-zone architectural cohesion, not more small tile/prop tweaks, plus separate complete gameplay/campaign regression before release. The independent 85/100 production visual threshold has **not** been met.
