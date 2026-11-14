# PA1 building ontology — wall tier handoff (Item Ontology V2, P6)

- **From:** Item Ontology V2, Draft PR #61 (`arena/f7f5cf36-soul-of-hero`).
- **To:** owner of PR #56 (`feature/pa1-building-ontology-20261113`, head `934f4471`).
- **Status:** proposal for the PR #56 owner. **Nothing below is implemented in PR #61**, and PR #61 does not edit `PA1_UPGRADE_ONLY_GEOMETRY`, `STRUCTURE_UPGRADES`, wall costs or the `upgradeStructure` action.

## 1. The defect (live at `934f4471`, unchanged by PR #61)

| Structure | HP | Cost | Placeable directly | Reached by an upgrade | Result |
| --- | --- | --- | --- | --- | --- |
| `wall_wood` | 160 | 5 Wood | yes | — | reachable |
| `wall_plank` | 240 | 3 Plank | no (`PA1_UPGRADE_ONLY_GEOMETRY`) | **no entry leads to it** | **unobtainable** |
| `wall_stone` | 380 | 8 Stone + 1 Wood | no | `wall_wood → wall_stone` | reachable |
| `wall_brick` | 600 | 6 Brick | no | **no entry leads to it** | **unobtainable** |

Cause: `STRUCTURE_UPGRADES` is `{ floor_wood→floor_stone, wall_wood→wall_stone, door_wood→door_iron, roof_thatch→roof_tile, chest_small→chest_large }`. Both `wall_plank` and `wall_brick` are refused by `buildReason` ("Build the wooden form first, then upgrade…") and are the target of no upgrade.

Knock-on effect on items: Plank (`plank`, 2 Wood → 1 at a Workbench, also a 60 % drop from the Bridge Raider) has **no reachable consumer**. Brick still has two (Furnace lining, Tile Roof).

Guard in PR #61: `UNOBTAINABLE_STRUCTURES` (`web/src/game/item-ontology.ts`) is computed from those two tables and is pinned to contain `wall_plank` and `wall_brick`. When this fix lands, that test fails on purpose and the pin is removed.

## 2. Proposed correction

Walls stop being one compulsory line. A wood wall has two optional upgrades; a stone wall has one.

```
wall_wood (160) ──► wall_plank  "Reinforced Wood Wall" (240)   pay 6 Wood          optional, early
      │                    │
      └────────────────────┴──► wall_stone (380)               pay 8 Stone + 1 Wood (unchanged)
                                     │
                                     └──► wall_brick (600)     pay 6 Brick         optional, late
```

1. **Plank leaves new-run production.** `wall_plank.cost` becomes `[['wood', 6]]` — the number its own description already quotes ("240 HP for 6 wood"). The `plank` recipe is retired for new work (`RETIRED_RECIPES`, with `plank@<rev>` frozen in `LEGACY_RECIPES`). Display name suggestion: "Reinforced Wood Wall"; the id `wall_plank` does not change.
2. **Keep Wood → Stone exactly as it is.** A player may go straight from wood to stone; the reinforced wall is never a prerequisite.
3. **Add a legitimate Stone → Brick upgrade** (`wall_stone → wall_brick`, pay the full 6 Brick, HP fraction preserved — the existing rule "full target materials are paid again; condition is preserved").
4. **Allow the reinforced wall to be upgraded to stone** (`wall_plank → wall_stone`), so choosing the cheap early upgrade is never a dead end.

### Code shape (for the PR #56 owner to apply)

`STRUCTURE_UPGRADES` is `Record<string, string>` — one target per structure — and the wood wall now needs two. Smallest change that keeps every caller working:

```ts
// catalog.ts
export const STRUCTURE_UPGRADES: Record<string, string> = { /* unchanged: the DEFAULT target */ };
export const STRUCTURE_UPGRADE_OPTIONS: Record<string, readonly string[]> = {
  wall_wood:  ['wall_stone', 'wall_plank'],   // first entry == STRUCTURE_UPGRADES.wall_wood
  wall_plank: ['wall_stone'],
  wall_stone: ['wall_brick'],
};
export const upgradeTargets = (type: string): readonly string[] =>
  STRUCTURE_UPGRADE_OPTIONS[type] ?? (STRUCTURE_UPGRADES[type] ? [STRUCTURE_UPGRADES[type]] : []);
```

- `engine.ts` `case 'upgradeStructure'`: accept an optional `it.target`; `const target = it.target ?? STRUCTURE_UPGRADES[e.type!]`; refuse unless `upgradeTargets(e.type!).includes(target)`. An intent without `target` behaves exactly as today, so old clients, tests and e2e drivers keep working.
- `ui/Game.tsx` / `BuildBar.tsx` upgrade tool: when `upgradeTargets()` has more than one entry, show the choices with their costs; otherwise unchanged.
- `STRUCTURE_UPGRADES.wall_plank = 'wall_stone'` and `.wall_stone = 'wall_brick'` are the defaults for those two.
- `economic-graph.ts:983` and `economic-audits-m5.ts:331` iterate `STRUCTURE_UPGRADES`; switch both to `upgradeTargets` so the multigraph sees the second wood-wall edge.

## 3. Compatibility (must hold)

| Existing thing | Behaviour after the change |
| --- | --- |
| A placed Plank Wall in a save | Stays `wall_plank`, 240 HP. Note: `reclaim` computes the refund from the LIVE cost table (`d.cost × BAL.economy.reclaimRefund`), not from what was paid, so a wall paid in Plank would refund Wood after the change. Value-neutral or slightly lossy for the player; no stored cost exists to do otherwise. Owner to confirm this is acceptable. |
| Plank stacks in packs and chests | Item id `plank` stays in `ITEMS`; stacks load, stack, move, drop and trade as before. Plank still drops from the Bridge Raider unless the ecology owner changes that table. |
| A queued `plank` job (any revision) | Finishes under the definition it was paid under (`recipeForJob(job.recipe, job.rv)`), exactly like the rev-1/rev-2 jobs already tested. Cancelling returns the reserved Wood. |
| New `plank` work | Refused by name ("Retired…"), not as "unknown recipe". |
| Saved Plank with nothing to spend it on | Needs one sink so it is not stranded. Recommended: `wall_plank` accepts **3 Plank as an alternative payment** for the same upgrade (the pre-change cost), for as long as stacks exist. No Plank → Wood conversion is proposed: that would be a new recipe. |
| Old structures of every other type | Untouched. |

## 4. What this costs a player (analytic, from the tables above)

- Wood → Reinforced: +6 Wood, +80 HP, no Workbench step (today's Plank route would have been 6 Wood plus 3 bench jobs of 6 s — and is unreachable).
- Wood → Stone: unchanged.
- Stone → Brick: +6 Brick = 9 Stone and 3 furnace jobs of 10 s (`brick`: 3 Stone → 2), +220 HP.
- Wood → Reinforced → Stone costs 6 Wood more than Wood → Stone for the same final wall; that is the price of the early 240 HP, and it is optional.

Side effect to accept or counter: the reinforced wall no longer needs a Workbench, so 240 HP is available from the first Territory Cabinet. If that is too early, gate the option on a Workbench in the claim rather than reintroducing Plank.

## 5. Tests the change needs (owner's PR)

1. `wall_wood` offers exactly `wall_stone` and `wall_plank`; an intent without `target` still produces `wall_stone`.
2. `wall_stone → wall_brick` pays 6 Brick once, keeps the HP fraction, is refused outside a valid Territory Cabinet claim.
3. `wall_plank → wall_stone` works on a wall placed before the change.
4. Save with a placed Plank Wall, 12 Plank in a chest and a queued `plank` job: opens, the job completes and pays 1 Plank, the stacks are intact, the wall can be upgraded.
5. New `plank` work is refused by name.
6. `UNOBTAINABLE_STRUCTURES` is empty; the item-ontology pin on `wall_plank` / `wall_brick` is deleted in the same commit.
7. Recipe revision bump with `plank@<old>` frozen, following ledger §26.

## 6. Decisions the PR #56 owner still has to make

- Accept the two-option wood wall, or prefer a different shape (the constraint from Control Tower is only: no compulsory walk through every tier).
- Display name of `wall_plank`.
- Whether 3 Plank stays an alternative payment, and for how long.
- Whether the half wall, window wall, doorframe, pillar and triangle forms get the same options (today only `wall_wood`, `floor_wood`, `door_wood`, `roof_thatch` upgrade at all).
