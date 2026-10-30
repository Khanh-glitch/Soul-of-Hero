# A6–A0 storage owner contract (2026-10-30)

**Decision:** keep the existing A0 `ChestInventoryPanel` authoritative and keep all A6 storage projections read-only until A0 has a request-correlated command endpoint. This deliberately avoids a second transaction owner or a misleading A6 transfer button. No A0 file/schema change is requested by this A6 branch.

## Existing production interaction

1. A0 validates the live container/reach/death/input context and opens its existing chest panel.
2. The player chooses an item, direction, and whole quantity in that A0 panel.
3. A0's existing SurvivalService/SaveService applies the transfer and updates the authoritative inventory/container state. A0 alone owns save, durable transaction receipt/replay, revision, and sequence.
4. A6 may render the resulting owner-projected bag/container snapshot and read-only planner context. Without an A0 correlated command endpoint it must not present itself as a transfer UI or treat a client-generated ID as a durable receipt.

## Limits of current evidence

`A6StorageCommandAdapter.normalize_intent()` validates/canonicalizes a future command DTO and returns `mutated=false`; it is not authorization and is not connected to the production A0 panel transaction call. `v4_storage_owner_integration_test.gd::_submit_owner_panel()` then clicks A0's existing item/direction/amount controls and separately observes A0 SaveService state. It does **not** deliver the A6 `request_id`, `revision`, `sequence`, or `stack_key` to A0, and it does not prove correlated A6 idempotency, replay, or stale-revision handling. It proves only a fixture-backed UI composition against the current A0 panel and owner ledger.

The current normal A6 view sets `transfer_enabled=false` unless an explicit fixture projection is supplied; fixture-only transfer controls in planner tests are not a production path. Do not label those fixture interactions end-to-end storage or fresh-player collection.

## Exact A0 endpoint needed before A6 may own/accept commands

If A0 later chooses to add a command surface, the A0 owner must receive the following complete DTO in one atomic call and return an authoritative response; the operation below is a handoff contract, not an implementation claim:

```json
{
  "schema": "soh.ui.intent.v2",
  "request_id": "stable-client-request-id",
  "container_id": "owner-container-id",
  "item_id": "stackable-item-id",
  "stack_key": "owner-stack-key",
  "direction": "deposit",
  "amount": 1,
  "revision": "owner-snapshot-revision",
  "sequence": 0
}
```

The A0 endpoint must re-check the live target/container, reach, death/recovery state, current authoritative item identity/stackability, quantity, capacity, revision, and sequence; atomically commit; and durably store the request ID together with the resulting owner receipt and authoritative post-commit snapshot/revision/sequence. A replay of the same request ID must return that same durable result without a second mutation. Reuse of an ID with a different payload must be rejected. Stale revision/sequence, unknown or non-stackable item, insufficient source quantity, and full destination must be rejected with an authoritative unchanged snapshot and clear player-facing reason. A6 may display success only when the A0 result correlates to the submitted request ID and contains the durable owner receipt plus updated authoritative state. A6 may not invent a receipt, transaction ID, revision, or owner response.

## Branch disposition

Until that A0-owned endpoint exists, the production A0 panel remains the only storage command UI and A6 remains projection-only. A6 must not dispatch the normalized DTO, claim request-ID idempotency, add a second SaveService, modify A0 source, or represent fixture-only transfer affordances as production behavior.
