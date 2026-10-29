# Venomwright 006 / 010 VFX pilot

Isolated, runnable Godot demo and acceptance harness for Venomwright skills
006 (Graft Caravan) and 010 (The Walking Crucible). It drives the **native
original-source VFX implementations** (`prototypes/skill_readiness/native/venom/`,
the same generators that passed the original-TypeScript differential,
`SOURCE_PARITY_VERIFIED`).

Status: **pilot evidence only**. Not GOLD visual comparison, not owner-approved
(`OWNER_VISUAL_APPROVED` is owner-only, see `../ACCEPTANCE_STATES.md`). The GOLD
reference archive key has not been supplied, so the live check compares
hashes against the recorded oracle JSON, not against the original images.

## What is exercised

| Part | Source | What it proves |
| --- | --- | --- |
| `venom_pilot_stage.gd` | native `venom_world` + `venom_engine` + `venom_skills` | Full skill timeline, projectiles, enemy hits, terrain, glow, aftermath, cleanup |
| `venom_pilot_demo.tscn` | the stage, shown live | Plays the effect; per-tick scene hash checked against the oracle; GOLD hit/cue timeline; additive scene+glow composite |
| `tests/venom_pilot_headless_test.gd` | the stage | Every oracle row's scene hash for 006 (385 ticks) and 010 (840 ticks), plus a 360-tick aftermath; zero live fx/particles at the end; non-blank frames; PNG export |
| `real_map/venom_pilot_real_map_test.gd` | real Chapter 1 Level 2 (AppFlow) | Native 006 overlaid on the real map, Knight and camera live, baseline and 7 viewport checkpoints |

## Run the demo (desktop Godot 4.7)

```
godot --path . res://prototypes/skill_readiness/pilot/venom_pilot_demo.tscn
```

Headless acceptance (writes `manifest.json` and frames to `VENOM_PILOT_OUT`):

```
VENOM_PILOT_OUT=/tmp/venom-pilot godot --headless --path . \
  --script res://prototypes/skill_readiness/pilot/tests/venom_pilot_headless_test.gd
```

Real-map capture (needs the Level 2 checkout, see the workflow):

```
xvfb-run -a godot --path <real-map checkout> --rendering-method gl_compatibility \
  res://prototypes/skill_readiness/pilot/real_map/venom_pilot_real_map.tscn
```

## Verdict lines

- `GOLD93_VENOM_PILOT: PASS|FAIL` and per-skill `GOLD93_VENOM_PILOT skill NNN PASS ...`
- `GOLD93_VENOM_REAL_MAP: PASS|FAIL | skill 006 | real AppFlow Level2 | ...`

Verdicts are read from the GitHub check-run annotations of workflow
`gold-93-readiness-vfx-pilot.yml`. The workflow emits a failure digest with
the first error-like lines and the log tail when a gate fails.

## Honest limits

- The live scene-hash check is hash synchronisation against recorded oracle
  rows. A match proves the same pixels were produced, not that the GOLD
  original was re-rendered in this session.
- The real-map composite is a presentation overlay: the effect layers are
  rendered onto black and added with Godot additive blending. It is not the
  GOLD post-processing pipeline and is labelled as such in the frames.
- Frames are native renders, not GOLD references.

## Evidence (remote CI, commit `4ee6656`, run `40902430652`)

Read from check-run annotations, not from the overall run conclusion.

| Check | Verdict |
| --- | --- |
| Headless 006 | `GOLD93_VENOM_PILOT skill 006 PASS gold_rows 93/93 first_mismatch -1 end_fx 0 end_parts 0 zero_tick 724 peak_fx 80 peak_parts 187 blank_frames 0` |
| Headless 010 | `GOLD93_VENOM_PILOT skill 010 PASS gold_rows 184/184 first_mismatch -1 end_fx 0 end_parts 0 zero_tick 1427 peak_fx 115 peak_parts 303 blank_frames 0` |
| Demo scene smoke (006 job) | exit 0, no script or parse errors, 240 frames |
| Real Chapter 1 Level 2 | `GOLD93_VENOM_REAL_MAP: PASS \| skills 006,010 \| shots 14/14 \| failures 0` |

`zero_tick` is the first tick after the recorded oracle end at which live fx and
particles are both zero. The headless run continues 1800 ticks past the oracle
end, and the per-60-tick decay is printed as `decay tick N fx F parts P`.
For 006 the effects drain from 56 fx at tick 445 to 0 at tick 724. For 010
they drain from 65 fx at tick 900 to 0 at tick 1427.

Earlier runs `40893265619` and `40894809030` were superseded. The first one
exposed a cleanup failure for 010 under the old 360-tick tail. The
decay measurement above is the basis for the 1800-tick aftermath.

The frames (scene, glow, composite, real-map shots) are uploaded as workflow
artifacts `venom-pilot-frames-6`, `venom-pilot-frames-10` and
`venom-pilot-real-map-frames`. They are native renders for review. They are not
GOLD references and do not change any acceptance state.

## Known harmless engine messages

Headless exit prints `ObjectDB instances were leaked` and
`resources still in use at exit`. They appear after `GOLD93_VENOM_PILOT: PASS`
and do not affect the verdicts.
