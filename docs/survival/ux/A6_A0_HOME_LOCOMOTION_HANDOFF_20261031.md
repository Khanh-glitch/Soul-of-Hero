# A0 handoff — the home actor does not walk after Continue

A6 does not own this and has not edited it. This is the measurement, the moment it
happens, and the four candidates A0 can settle from its own code.

**Status: FAIL, unchanged.** The gate is measured, not waived. No A6 frame claims a
passing walk for this surface.

## 1. What is expected

`game/ui/screens/home/home_actor.gd` is a `CharacterBody2D` with `move_speed` and a
walkability resolution step. With `move_right` held for 14 physics frames, the actor
should travel roughly `move_speed × 14 / 60` px — for the authored 112 px/s that is
**≈ 26 px**, and A6's assertion floor is 4.0 px, chosen only to separate "walked" from
"jittered".

## 2. What actually happens

`21_continue_home_walk`, A6 native avatar capture, latest run:

| direction | displacement over 14 frames |
| --- | --- |
| `move_right` | 1.27 px, 0.87 px, 1.00 px (three separate runs) |
| `move_left` | 0.33 px, 2.53 px |

```text
21_continue_home_walk: walked neither direction (needs 4.0 px)
  [move_right moved 1.27 px] [move_left moved 0.33 px]
  permitted=no-gate modals=[] velocity=(0.0, 0.0) route=home dead=false
```

The input is live (`Input.action_press` is held for the whole window, the same call that
works in the overworld), no modal is open, no gate is installed on this route, and the
actor is not dead. Earlier runs on the same code path recorded `velocity=(112.0, 0.0)`
with 0.87 px of travel, i.e. the velocity was set and the position did not follow.

Starting this run the failure line also carries

```text
{bounds=<x,y WxH> controls=<bool> walkable=<on|dead|none> auto=<bool> slides=<n>:<collider>}
```

read from the actor without modifying it, so the next run names which candidate is true
instead of describing one.

## 3. The four candidates, with the exact lines

Read-only inspection of A0's home actor; **A6 has changed none of it.**

1. **Collapsed movement bounds.** `_clamp_to_bounds()` (`home_actor.gd:130–134`) clamps
   to `_movement_bounds`, and `set_movement_bounds()` (`:26–28`) re-clamps the position
   immediately. If the restored spawn arrives before the room's bounds are set, the rect
   can be `Rect2()` and every candidate clamps back to `(0,0)`. `slides=` and
   `bounds=… collapsed` in the new diagnostic distinguish this in one run.
2. **A refused walkability candidate.** `_resolve_walkable_position()`
   (`home_actor.gd:137–148`) returns `previous` when the candidate, the horizontal-only
   candidate and the vertical-only candidate all fail `_walkability_test`. The actor is
   then pinned every frame while `velocity` stays nonzero. Symptom: `walkable=on`,
   `slides=0`, displacement a fraction of a pixel.
3. **A live slide collision.** `move_and_slide()` at `:93` zeroes the velocity component
   into a wall. That is the only way `velocity` reads `(0.0, 0.0)` after a held press,
   which is what the latest run shows. Symptom: `slides=≥1:<collider name>`.
4. **Controls disabled.** `controls_enabled` false short-circuits the whole function at
   `:67–70` and zeroes velocity. Symptom: `controls=false`.

Candidates 1 and 3 are mutually exclusive with the two velocity readings seen so far
(`(112,0)` vs `(0,0)`), which suggests the restored actor is blocked at a wall it spawned
inside, and the earlier `(112,0)` runs were a different spawn.

## 4. What A0 needs to answer

* Is `set_movement_bounds()` called **before** the Continue restore writes the actor
  position? (candidate 1)
* Does the home room geometry at the restored coordinate contain a solid the actor's
  shape overlaps? (candidate 3)
* Is `_walkability_test` installed on the home screen at all, and does it accept any
  point near the restored position? (candidate 2)

A one-line answer per bullet is enough; A6 will re-run the same capture and report the
new numbers unchanged.

## 5. What A6 will not do

* Not edit `home_actor.gd`, the home scene, or the restore path.
* Not lower `MIN_WALK_DISPLACEMENT`, not retry until a lucky frame, and not label an
  idle frame as a walk.
* Not call the step green because an overworld walk passes: these are two different
  routes and two different actors.
