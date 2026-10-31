# A0 Round 11 — exact missing interface: a production damage source

**Status: BLOCKED ON OWNER DECISION, FAIL CLOSED. No fake enemy, no fake hazard rate, no "combat" claim.**

## What already works (A0-owned, proven natively)

Everything *behind* the damage seam is real production code and is exercised by
`tests/survival_a0_damage_death_probe_test.gd` (labelled **owner-composition
damage probe, not a player encounter**):

| layer | production code | evidence |
| --- | --- | --- |
| damage entry point | `KnightController.take_damage(amount, source_position)` / `take_resolved_damage(...)` with the real invulnerability window | probe: lethal damage through the real API |
| death | `KnightController._die()` → overworld death handler | probe: `dead == true`, one death |
| bag custody | `SurvivalService.begin_overworld_death(position)` — one atomic commit, unique tokens retained, carried stack moved | probe: exactly one bag, exact stack, no duplication |
| projection | `SurvivalDeathBag` (`survival_death_bag` group) | probe: exactly one physical bag |
| respawn | `SurvivalService.finish_overworld_death(position)` + bed respawn flow | probe: pending death cleared, no second bag; rendered bed test already covers the bed path |
| recovery | `SurvivalService.recover_death_bag(bag_id)` — all or nothing, replay pays nothing | probe: exact carry restored, replay refused, second OS process |
| run identity | `A0 RunLifecycle` — death is **not** a run boundary | probe: same `run_id` before death and after recovery |

## What is missing, precisely

The survival world mounts **no** authentic damage producer. Verified by
inspection of the mounted scene:

* `chapter1_overworld.gd` spawns landmarks, camps, discoveries, survival nodes and
  structures. It spawns **no enemy**; `optional_skeleton_encounter.gd` exists but
  is explicitly experimental and is **unmounted** (and stays unmounted per the
  standing "unsafe candidate" rule).
* The authored hazards in `data/overworld/hollow_marches.json`
  (`crucible_basin`, `fen_marsh`, `relay_watershed`) are real geometry with real
  rectangles, but they are wired only to **provision drain**
  (`OverworldState.tick(delta, hazard, safe)`), never to Hero health.
* No catalog in the pinned A3/A1 data defines hazard HP damage, damage-per-second
  exposure, or an enemy spawn table for the survival region.

## The seam an owner must fill (one function, no A0 redesign)

```gdscript
## Owner: A1 (hazard/enemy placement + geometry) or A8 (world content), with A3
## only if the damage has an item/loot consequence. A0 already calls nothing.
## Required contract, implemented somewhere inside the mounted world:
func apply_authentic_damage(hero: CharacterBody2D, delta: float) -> void:
    # A0-owned code already provides the exact legal call:
    #   hero.take_damage(authored_amount, source_position)
    # or, for a resolved enemy attack, hero.take_resolved_damage(...).
    # Rate/amount/cooldown MUST come from owner-approved data, never from A0.
```

A0 will not author the rate, the enemy, or the encounter table. Until that data
exists, the honest product statement is: **the player can die and recover (the
whole custody chain is proven), but nothing in the current world can kill them
yet.** The hazard rectangles are the cheapest authentic producer; a single
owner-approved `"hp_damage_per_second"` field on each hazard entry would be
enough to turn the existing geometry into a real, physical, avoidable threat
without adding a second damage authority anywhere.

## Rules this seam must not break

1. No omniscient home raids and no damage inside a paid shelter (D061 trace
   source): a source must be a physical, authored thing at a physical place.
2. No death-bag duplication: the bag is created by one SaveService commit keyed
   by the death serial, so a re-entered death cannot mint a second bag.
3. No cheap death farming: any reward attached to a death must route through A3,
   and a death must never change the run deadline (D062–D067).
4. Unique `soh_i_*` instances stay in the bag until A3-blessed bag custody exists;
   the current code deliberately keeps them out of the moved stack.
