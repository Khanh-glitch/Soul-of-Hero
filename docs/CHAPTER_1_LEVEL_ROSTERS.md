# Chapter 1 enemy roster contracts

These are the canonical roster locks consumed by the authored Chapter 1 maps.
They define exact stage totals and elite rules; future balance edits must update
the map generator, content resource and focused runtime test together.

| Level | Exact stage roster | Elite rule |
| --- | --- | --- |
| 1 | 12 Skeleton 1 | None |
| 2 | 15 Skeleton 1 | 20% roll per camp; guarantee at least one Skeleton 1 elite in the stage |
| 3 | 15 Skeleton 1 + 5 Skeleton 2 | 20% roll per camp; guarantee at least one elite of each Skeleton type |
| 4 | 10 Skeleton 1 + 5 Skeleton 2 | 40% roll per camp; guarantee at least one elite of each Skeleton type |
| 5 | 10 Skeleton 1 + 5 Skeleton 2 + 1 Vampire + 1 KingdomArcher | 20% roll per guardian camp; guarantee each regular Skeleton type; Vampire and KingdomArcher are excluded |
| 6 | 9 Skeleton 1 + 3 Skeleton 2 | Three fixed Soul Anchor clusters; each cluster is 3 Swords + 1 Reaper manifestation |
| 7 | 12 Skeleton 1 + 4 Skeleton 2 | Three timed Beacon waves: 4+1, 4+1, then 4+2; no elite substitution in the tutorial defense |
| 8 | Exclusive choice: 6 Skeleton 2 **or** 3 Vampires | The player binds one physical branch seal; only that branch spawns and exactly its first deterministic marker receives the shared Elite pressure axes |
| 9 | 1 Crimson Reaper | The named enemy is absent until all three physical Gate Seals are broken, then one dedicated runtime identity spawns with the deterministic crimson Elite pressure-axis contract |
| 10 | 1 Vampire Castellan | One unique actor owns both phases continuously; Phase 2 begins at 55% HP and is not represented by a second spawn or Vampire proxy |

Stable content IDs:

- Skeleton 1: `skeleton_swordsman`
- Skeleton 2 / Bone Reaper: `bone_reaper`
- Vampire: `blood_vampire`
- KingdomArcher: `hooded_archer_miniboss`
- Crimson Reaper: `crimson_reaper`
- Vampire Castellan: `vampire_castellan`

## Elite semantics

- The random generator uses the level seed, so retry/debug runs are reproducible.
- Every authored camp receives one independent roll. A successful roll promotes
  exactly one eligible normal Skeleton in that camp.
- After random rolls, a guarantee pass promotes any still-missing eligible
  Skeleton archetype. It prefers a camp that does not already contain an elite.
- An elite replaces a regular unit; it never increases the exact stage total.
- Elite pressure is explicit and inspectable: health ×2.25, damage ×1.35,
  attack rate ×1.15, movement ×1.08, reach ×1.05, and reward-score ×2.5.
  Damage and cadence compose to about ×1.55 sustained DPS. Visual scale is 1.3
  with a rarity tint/aura, while collision size remains unchanged.
- Unique units and special bosses cannot be promoted.

When authoring Levels 3-5, use at least two Skeleton-bearing camps if both
guaranteed elite types should always appear in separate encounters. The resolver
can preserve both guarantees with fewer camps, but then both elites may share a
camp.

## Runtime boundary

Levels 1-10 now have authored map markers and production campaign routes. Level 7
keeps all sixteen actors dormant until its three warning timers release them;
the runtime never fabricates an enemy outside this roster contract. Level 8
keeps all nine alternatives absent until the player physically binds Reaper or
Vampire; it then retires the unselected encounter records without counting fake
defeats, spawns exactly 6 Reapers or 3 Vampires, and applies the shared
`triple_stat_elite` modifier to exactly one selected guardian. Level 9 owns a
dedicated reachable three-wing map: `l9_west_gate_seal`,
`l9_east_gate_seal`, and `l9_north_gate_seal` are real one-use interactables;
only their third committed interaction materializes `l9_crimson_reaper`.
That actor uses `CrimsonReaperEnemy`, a visible `CRIMSON REAPER` nameplate, and
`crimson_reaper_elite`, which applies the same explicit pressure-axis semantics
in a distinct crimson presentation. The canonical encounter requires both three
`gate_seal_collected` events and the exact named enemy death before `l9_exit`
may open. Level 10 now owns a dedicated reachable throne map and exactly one
`l10_vampire_castellan`. The same actor crosses from Crimson Court to Nightfall
Decree at 55% HP, adds Blink Lanes and a three-disc fan, and exposes persistent
name/HP/phase/pattern telemetry. `l10_exit` requires both the threshold event and
the real boss-death event. Death/retry restores one full Phase-1 actor and clears
owned projectiles; no phase proxy or stale projectile survives the scene reset.

Level 5 ends after sixteen guardians with one hostile KingdomArcher. Defeating
`hooded_archer_miniboss` only releases a physical Normal Level-1 Archer Hero
Soul. The player must interact with that drop before the exit opens; only the
pickup transaction grants `archer_hero`, `soul_hero` and `soul_relay`. It does
not auto-fill Reserve, change the team or activate any effect. The player must
open the wardrobe and press **Equip** on the exact Soul; that explicit action
activates Archer and its effects immediately, including in the current run when
the wardrobe is accessible. The Sword+Archer escape phase spans Levels 5–10.
