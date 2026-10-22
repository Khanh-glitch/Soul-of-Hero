# Sword Hero production specification

Sword is the first and currently only production Hero.

## Normal attack sequence

The continuation timer is 2.0 seconds measured from attack completion. Attack
input may be buffered during recovery. A normal movement Dash preserves the next
combo step and the remaining continuation window.

| Step | Name | Damage | Required behavior |
| --- | --- | ---: | --- |
| 1 | Opening Slash | 100% | Stable opening strike |
| 2 | Passing Slash | 100% | Pass through target to a validated safe point; directional fallback |
| 3 | Crescent Recoil | 120% | Sword wave plus opposite recoil; first wave target is pursuit target |
| 4 | Pursuit Execution | 200% | Safe dash through/beyond pursuit target; lower fallback multiplier if absent |

Base damage is tuning data. Multipliers are contract data and must not be baked
into animation code. Movement endpoints use collision queries and fall back to
the furthest safe point on the requested direction.

Each step owns a fixed authored strip and can never resolve to locomotion:
`sword_combo_1..4` contain `4/6/10/10` frames. Facing is snapshotted when the
attack starts, so live movement input cannot flip the sprite/hitbox away from
the locked dash or wave direction. Combo 3 travels 150 px and recoils 48 px.
Combo 4 starts its dash at 0.12 s and computes enough distance to pass a living
pursuit target (capped by Resource data), including targets hit near wave range.

## Active Skill - Soul Echo

Soul Echo is approved production content. Activation refreshes and suspends the
two-second combo-reset timer without changing the current/next combo step. For
approximately four seconds, a translucent spectral Sword afterimage mirrors each
remaining normal attack after an authored delay:

- Opening Slash: a delayed second slash.
- Passing Slash: the Echo crosses through the target from the opposite angle.
- Crescent Recoil: a second sword wave and mirrored recoil movement.
- Pursuit Execution: the Echo starts opposite the pursuit target so Hero and
  Echo cross simultaneously in an X. The directional fallback is mirrored when
  there is no pursuit target.

Activation during an attack that has already started queues that unresolved
step immediately. Combo 4 computes an Echo delay from Sword's actual
distance-aware target-crossing time, preventing the Echo from executing the
target before the original hit and preserving the simultaneous X.

Echo attacks use their own visuals, trails, cue IDs, hit queries, attack instance
IDs, safe-position correction, and reduced damage ratios. They never grant
invulnerability, create marks, change the normal combo step, or replace the
normal attack. The skill ends after Combo 4 resolves, forced combo reset, Sword
being replaced by Relay, Sword death, or its configurable duration. Default
cooldown is 12 seconds.

## Soul abilities

- Readiness: unique nearby melee-threat events.
- Summon: Soul Interception.
- Departure: Returning Blade.
- Unused support cooldown: 10 seconds after the summon completes.
