# Campaign reward meta-loop (P0)

Campaign Levels 1–5 resolve `completion_reward_bundle_id` through
`data/content/rewards/campaign_reward_registry.tres`. `AppFlow` applies the
bundle inside the same `SaveService.transact_once` call that records completion
and unlocks the next ready level.

## Grant rule

- Rewards are **first-clear only**.
- `LevelDefinition.completion_transaction_id` is the durable receipt.
- A replay still returns a reward summary to Results, with `granted = false`
  and `already_claimed = true`; currency and inventory are not mutated.
- Training has no campaign reward and creates no progression save revision.
- If a configured bundle cannot be resolved or applied, the completion
  transaction fails closed rather than committing progress without its reward.

## Save shape

```json
{
  "currencies": {
    "account": 120,
    "hero_materials": 2,
    "monster_fragments": 0
  },
  "inventory": {
    "item_stacks": {
      "crypt_bone_shard": {
        "kind": "material",
        "quantity": 2
      }
    }
  }
}
```

`item_stacks` supports `material`, `consumable`, `blueprint`, and `key_item`.
Plain campaign bundles retain the compact `kind + quantity` shape shown above.
Physical in-run loot may additionally persist `display_name`, `icon_path`,
`rarity`, and `item_level`; these fields let the combined bag/equipment Codex
render the pickup immediately and survive reload without inventing a generic
icon or losing its rarity.
Rolled equipment is intentionally not represented as a stack: it should later
use a separate instance collection with stable instance IDs, rarity, affixes,
lock/favorite state, and equipped ownership.

## Verification

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_campaign_reward_tests.ps1
```

The suite covers catalog validation, atomic first clear, receipt provenance,
replay idempotency, cross-level stacking, disk reload, and rewardless Training.
