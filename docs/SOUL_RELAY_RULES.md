# Soul Relay rules

## Party and controls

- Exactly one Active Hero is controlled.
- Exactly one Reserve Soul is player-visible in the current build.
- Reserve Sword materializes automatically when its third valid melee-threat
  trigger is confirmed. One `Q` while that Sword visual is present transfers
  control; the trigger itself owns the Summon Skill start.
- Other readiness-driven Reserve Souls use `Q` to start their Summon Skill, then
  use `Q` again only in an authored takeover frame.
- Reserve Archer has one contextual exception: a confirmed Bow Dash begins a
  two-second reverse-shot summon at the Dash origin without consuming a first
  `Q`; one `Q` anywhere in that window transfers control to Archer there.
- After Relay, the incoming Hero owns the active body and position. The outgoing
  Hero leaves its Departure Skill at the position it vacated.

## Skill ownership

- Summon Skill belongs to the incoming Hero.
- Departure Skill belongs to the outgoing/replaced Hero.
- Sword Summon Skill: **Soul Interception**.
- Sword Departure Skill: **Returning Blade**.

## Readiness and cooldown

- Sword's summon trigger is filled by unique, confirmed melee-threat events near
  the player. The third event immediately materializes Soul Interception; damage
  receipt is not required.
- Duplicate events from the same attack instance count once.
- Readiness may expire if not used; expiration does not start support cooldown.
- If Soul Interception completes without Relay, Sword enters a 10-second
  support-only cooldown.
- If Relay succeeds, no unused-support cooldown is applied.
- An unused Archer Dash opportunity returns directly to Idle after two seconds;
  its Dash/Bow cooldown is already the gating cooldown.

## Sword summon sequence

Soul Interception lasts approximately 0.8-1.2 seconds:

1. Sword Soul materializes at the battlefield support position.
2. A defensive sweep damages/pushes nearby melee threats.
3. Sword pursues the primary attacker and performs a decisive cut.
4. Early, middle, and late takeover windows are authored within the sequence.
5. If no valid primary attacker remains, a deterministic directional fallback is
   used; the sequence still completes safely.

## Sword departure sequence

Returning Blade starts from the old Sword position after a successful Relay,
dashes/slashes toward the new Active Hero, applies its bounded path hit once per
target, and disappears without changing player ownership again.
