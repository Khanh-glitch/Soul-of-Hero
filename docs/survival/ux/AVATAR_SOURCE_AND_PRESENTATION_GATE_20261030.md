# A6 canonical avatar source and presentation gate — updated 2026-10-30

**Locked authority:** D046 and D051–D054. This note supersedes the earlier same-day statements that the Craftpix terms had not been reviewed. The page was checked directly on 2026-10-30; see `CRAFTPIX_AVATAR_LICENSE_AND_PRIVATE_STAGING_20261030.md` for the exact URLs/sections and boundaries.

## Canonical identities and provenance

| Owner-selected grade-zero identity | Product | Drive file | Archive SHA-256 | Verified sheets |
|---|---|---|---|---|
| Bald/unarmored male | CraftPix 555940 | `1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb` | `b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795` | Idle 768×256/12 frames per direction except 4 back frames; walk 384×256/6; run 512×256/8; hurt 320×256/5; death 448×256/7; sword attack 512×256/8; walk attack 384×256/6; run attack 512×256/8. |
| Bald/unarmored female | CraftPix 419402 | `1o5hRVbPZjZxcPGwP5coPDHZARbAej75o` | `f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad` | Same frame grids/timing as male; source bytes and exact dimensions are checked by the private staging script. |

All source sheets use 64×64 cells and four rows, ordered front, side-left, side-right, back. Source Tiled metadata reports 150 ms steps (6.666667 fps); death includes a 300 ms final pose and the pipeline repeats its last frame to preserve the hold. Idle/walk/run/hurt/death are unarmed body actions. Sword attack clips are source-provided combat art; they are not dedicated Skill-Core cast, gun-fire, mining, or craft animation. D046 permits using existing clips to communicate actions but A0 retains real input/action authority and Gold VFX ownership.

## Rights finding and redistribution boundary

The official CraftPix File Licenses page §2.1.1–2.1.3 supports Freebie use in personal/commercial projects, adaptation, and distribution of games containing the art; attribution is not required. The two exact product pages identify each as Free Download/Freebie. §2.2.1 bars resale/redistribution of raw or slightly modified source art and user-accessible save/export of the art; §3.1.1 bars AI/ML training, development, testing, validation, or improvement. This evidence supports use as embedded game art, not a public raw PNG/ZIP source drop or a user-facing sprite exporter.

## Private native staging and A6 bridge

`tools/stage_a6_avatar_art.py` verifies the two archive SHA-256 locks, reads the exact selected sheet members (thereby verifying their ZIP member CRCs), decodes each PNG alpha grid to verify nonempty frame columns/row order and the idle feet baseline, and checks the corresponding Tiled timing metadata. It extracts only the selected PNG sheets plus a local manifest into `private_art/a6_avatar/`, which `.gitignore` excludes. Original ZIPs stay outside the repository. The tracked manifest intentionally contains no runtime texture paths or source images; a clean checkout remains fail-closed until a private local staging step.

`a0_avatar_presentation_driver.gd` reads the exact owner actor's velocity, facing, player-state enum, and current action only. It changes no physics, input, weapon, VFX, equipment, or save data. The separate `tests/survival/ui/a6_avatar_native_capture.gd` harness hides the Knight texture only for the throwaway test process, attaches the canonical art at the A0 visual anchor, and keeps the pinned A0 `CharacterBody2D`, collision, camera, world, HUD, SaveService, and effects. The input identity snapshot in that screenshot harness is an explicit preview projection, not proof that A0 has shipped character selection or identity persistence.

Run (only after installing native Godot 4.7 and having the private Drive ZIPs locally):

```sh
python3 tools/stage_a6_avatar_art.py --male-zip /private/path/male.zip --female-zip /private/path/female.zip
python3 tools/run_a6_avatar_native_preview.py --godot godot
```

The runner checks out live-reviewed A0 PR #21 SHA `69070a1138730536050053c5aa47334b7b2c3836` into a temporary detached clone, preflights owner/autoload/input/Sprite APIs against the prior `5387bed6260cb7b9bd4d8229ee759dee08a0d918` comparison, overlays only A6-owned scripts/tests and ignored local art, runs Godot import, and captures a 720p/2K/4K set. Native screenshots go under ignored `.artifacts/a6-avatar/`; they require subsequent human visual review. The runner does not alter the A0 source or mount into production. Its CLI gender argument is a preview fixture, not A0's selected/persisted identity; it simulates semantic Input actions, and source preflight checks bindings without establishing physical-device or fresh-player acceptance. V3/V4 acceptance workflows and their exact source audit remain pinned to historical A0 `5387bed6260cb7b9bd4d8229ee759dee08a0d918`; that historical pin is not evidence for current A0 `69070a1138730536050053c5aa47334b7b2c3836`.

**Static operator-package check, 2026-10-30:** GDScript parsing and Python compilation pass; the A0 path/API/input preflight passes against fetched PR #21 SHA `69070a1138730536050053c5aa47334b7b2c3836`, and private staged-sheet manifest paths/hashes pass. Invoking the runner produces an explicit `BLOCKED_OR_FAILED` report because native Godot 4.7 is unavailable. It stops before clone/import/capture, so there are no native screenshots or animation/visual acceptance results. The local report is ignored at `.artifacts/a6-avatar/native-preview-report.json`.

## Remaining blockers

- At this review, the 2026-10-30 V3/V4 native workflows against A6 SHA `08ccb8348f2e7a75e09af47a1741c158fc46e794` remain queued. They do not stage private art and cannot validate actual avatar appearance.
- The current execution environment has no Godot 4.7 executable; the real-asset A0 composition runner has not been run. Therefore no actual native screenshots, visual pass, player-selected identity path, Gold overlay review, or production mount is claimed.
- Grade 1/2 still lack a sourced, inspected, coherent 4-direction armor appearance that preserves each selected gender's anatomy. The approved Drive folder inventory returned 43 archives; name-level triage identified no confirmed armor-layer pair. Character candidates were 180537 Swordsman (tiered but another identity), 208004 Vampire, 363992 Orc, 436971 Roguelike kit, and 654184 home-character pack (previously identified as house/animal/environment). None is verified as aligned male/female overlays for 555940/419402. This is the exact current blocker; not all image contents in the 43 archives were visually audited. Existing local selected-art staging contains no armor layers. The 180537 Swordsman and current Knight remain explicitly rejected substitutes.
- A0 alone still owns actual identity choice, equipped grade, Hero physics/input, SaveService, storage, death/recovery, and production mount. A6 only presents the already owner-resolved appearance.
