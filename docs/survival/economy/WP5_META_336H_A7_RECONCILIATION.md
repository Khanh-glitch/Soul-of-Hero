# CT ROUND11 P1 — WP5: 336h meta-economy model vs A7 counterfactual weights

Status: reconciliation record. Evidence level: `DETERMINISTIC_MODEL_ONLY /
NOT_HUMAN_PLAYTEST / AI_TUNABLE_NOT_CREATOR_LOCKED`. Rates are proposals,
NOT user-locked. No design change is applied to the live build from this
model alone.

## 336h model (tools/survival/economy/model_meta_economy.py, policy_revision 1)

Run budget: 336h; Ragnarok last 72h. Seven strategies modeled:
`home_production`, `free_exploration`, `combat_poi`, `currency_scavenging`,
`one_stone`, `evacuation`, `six_stone`.

Key finding: **`universally_dominant_strategies: []`** — no strategy
dominates. Every currency route trades run-local power / rare-Core discovery
probability for next-run agency:

| strategy | banked currency | meals next run | run-local power proxy | rare Core proxy |
|---|---|---|---|---|
| home_production | 0 | 0 | 8.0 | 0.1 |
| free_exploration | 1.509 | 1 | 6.5 | 0.55 |
| combat_poi | 3.812 | 3 | 7.5 | 0.40 |
| currency_scavenging | 6.354 | 6 | 4.0 | 0.20 |
| one_stone | 2.595 | 2 | 6.0 | 0.30 |
| evacuation | 4.501 | 4 | 5.0 | 0.25 |
| six_stone | 4.818 | 4 | 7.0 | 0.35 |

Sensitivity case `drop_minus_50` (currency source drops halved) re-ran all
seven strategies without creating a universal dominant strategy; rankings
shift but no late-game currency route overwhelms run-local power.

## A7 counterfactual weights — protected, not overturned

A7's external finding (early rare-Core excitement vs late scavenger weights)
is preserved as-is in this reconciliation; the model shows no contradiction:
- `free_exploration` keeps the highest rare-Core discovery proxy (0.55) —
  knife-first scavenging / exploration excitement protected.
- `currency_scavenging` banks the most (6.354) but has the lowest run-local
  power proxy (4.0) — scavengers pay with current-run power.
- No strategy banks currency without sacrificing power/Core odds.

## Hard rules the model enforces (unchanged by this work)

1. **Knife-first scavenging** — home production yields zero secured currency;
   currency requires physical travel and last-72h claims.
2. **Rare-Core excitement** — Skill Cores remain finite-use, manufacture-only,
   BLOCKED_PENDING_A4; offline excludes `core` and `reconstruction` categories;
   no recycler Core output.
3. **Last-72h physical chest money** — `ragnarok_unbanked` is a physical
   `key_item` instance (`instance`, stack_limit 1). Claiming a last-72 source
   mints physical tokens only; profile credit is ZERO until an exact-once
   deposit at an authorized endpoint. Death bag / home chest currency is lost
   on run reset; `secured_ragnarok_currency` survives voluntary restart.
4. **Exact-once deposits** — proposal id key `soh.a3.meta_deposit.<proposal_id>`
   with `is_transaction_applied`; replay returns duplicate; interrupted write
   leaves the old candidate intact (native meta + restart tests).
5. **Finite next-run vending** — stock revisions per machine; purchase debits
   secured balance exactly; insufficient money rejected; stale stock revision
   rejected; refund ties to the original receipt and refunds once.
6. **Zero recycler money printing** — `plan_meta_recycle` emits
   `profile_delta == 0`; `ragnarok_unbanked` cannot be recycled into secured
   money; no stone-to-currency conversion; no generic scrap/score conversion.

## What is NOT claimed

No A0 mount, no human playtest, no browser/visual capture, no production
balance verdict. The 336h totals are AI-tunable lower-bound-style modeling,
not creator-locked rates. A7/A8 integration decisions remain with their owners.