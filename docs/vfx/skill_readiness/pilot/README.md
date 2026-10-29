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
| `venom_pilot_demo.tscn` | the stage, shown live | Plays the effect until its native lifecycle completes; per-tick scene and glow hashes checked against the oracle; authored hit and cue events checked at the oracle end; additive scene+glow composite |
| `tests/venom_pilot_headless_test.gd` | the stage | Every oracle row's scene AND glow hash for 006 (385 ticks) and 010 (840 ticks); authored hit and cue logs compared with the oracle in count, order and every field; a 1800-tick aftermath; zero live fx/particles at the end; non-blank frames; PNG export |
| `real_map/venom_pilot_real_map_test.gd` | real Chapter 1 Level 2 (AppFlow) | **Presentation overlay, not enemy integration.** Native 006 and 010 overlaid on the real map, Knight and camera live, checkpoint frames |

Event and raster comparisons are made against the committed oracle JSON, which is
read only and never rewritten. `venom_pilot_events.gd` uses the same canonical,
ordered, field-level rules as the original-source differential.
`venom_pilot_recording_world.gd` is a verbatim copy of the differential's
recorder, so the pilot records hits and cues with the same fields and rounding.

## Demo stop rule

The demo no longer stops at a fixed tail after the oracle end. It stops when the
native effects have actually finished: the cast generator and every nested task
have ended, and no fx or particle remains. A `SAFETY_LIMIT_TICKS` of 3600 bounds
the run so a broken cast cannot run forever. The status panel prints which rule
stopped it. The real finish is about tick 724 for 006 and about tick 1427 for
010. The headless gate still measures cleanup over a fixed 1800-tick aftermath.

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
  (raster and cleanup line), `... events hits N/N match=true cues N/N match=true`,
  and `... mismatch` lines only when an event log differs.
- `GOLD93_VENOM_REAL_MAP: PASS|FAIL | skills ... | real AppFlow Level2 | presentation overlay, not enemy integration | ...`

Verdicts are read from the GitHub check-run annotations of workflow
`gold-93-readiness-vfx-pilot.yml`. The workflow emits a failure digest with
the first error-like lines and the log tail when a gate fails.

## Honest limits

- The pilot is a presentation pilot for 006 and 010. It is not native enemy
  integration, not gameplay damage, and not production combat. The overlay
  actors are the pilot's own virtual formation.

- The live scene-hash check is hash synchronisation against recorded oracle
  rows. A match proves the same pixels were produced, not that the GOLD
  original was re-rendered in this session.
- The real-map composite is a presentation overlay: the effect layers are
  rendered onto black and added with Godot additive blending. It is not the
  GOLD post-processing pipeline and is labelled as such in the frames.
- Frames are native renders, not GOLD references.

## Evidence (remote CI, commit `d7c0b85`, run `40907326482`)

Read from check-run annotations, not from the overall run conclusion. All three
jobs finished `success` and each verdict line below was read from its check run.

| Check | Check run | Verdict |
| --- | --- | --- |
| Headless 006 | `123565535721` | `GOLD93_VENOM_PILOT skill 006 PASS gold_rows 93/93 first_mismatch -1 first_mismatch_field none end_fx 0 end_parts 0 zero_tick 724 peak_fx 80 peak_parts 187 blank_frames 0`; events `hits 25/25 match=true cues 30/30 match=true` |
| Headless 010 | `123565536310` | `GOLD93_VENOM_PILOT skill 010 PASS gold_rows 184/184 first_mismatch -1 first_mismatch_field none end_fx 0 end_parts 0 zero_tick 1427 peak_fx 115 peak_parts 303 blank_frames 0`; events `hits 82/82 match=true cues 89/89 match=true` |
| Real Chapter 1 Level 2 | `123565536120` | `GOLD93_VENOM_REAL_MAP: PASS \| skills 006,010 \| presentation overlay, not enemy integration \| shots 14/14 \| failures 0` |

What `d7c0b85` adds over `4ee6656`:

- The oracle checks now compare scene and glow raster hashes per row, plus the
  recorded hit events and recorded cue events, field by field and in order.
  The recorded oracle JSON is unchanged; the events are read from it.
- The interactive demo no longer stops at a fixed tick. It stops on actual
  lifecycle completion (`_stop_reason()`), with `SAFETY_LIMIT_TICKS` 3600 as a
  bound. The 010 demo therefore runs until its effects finish near tick 1427.

Evidence from run `40902430652` at `4ee6656` (preserved, superseded in part):


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
