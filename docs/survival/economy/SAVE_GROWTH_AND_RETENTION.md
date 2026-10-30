# Save growth and retention — SURV-030A E-05/E-06

Status: **MEASURED SERIALIZATION MODEL + NATIVE MICRO-MEASURE; A0 RETENTION POLICY PENDING**.

## What changed

- `survival_economy` schema 2 no longer grows the legacy `commands` map. New operation payload signatures are stored in SaveService `applied_transactions[key].metadata.payload_sha256`.
- Exact replay checks the SaveService receipt first; legacy v1 `commands` entries are still read for compatibility.
- Collected jobs are erased from `survival_economy.jobs`. Terminal legacy jobs with no remaining escrow are compacted on the next successful A3 transaction.
- Time baselines are bounded to the current session and unresolved stations, capped at 256 entries.
- Instance recipe outputs must have quantity exactly 1; `_finish_job` fails the transaction instead of silently underproducing.

## Measured model

`tools/survival/economy/measure_save_growth.py` serializes the actual receipt/namespace shapes using the deterministic 14-session, 45-minute A3 balance model. This is a **serialization model**, not a native disk/IO benchmark and not a human action-frequency claim.

| scenario | transactions | terminal instance records | schema-2 compacted bytes | legacy duplicate-commands bytes | bytes saved |
|---|---:|---:|---:|---:|---:|
| 14-session A3 model | 2,801 | 173 | 843,308 | 1,252,253 | 408,945 |
| 10× action sensitivity | 28,010 | 1,730 | 8,427,060 | 12,516,519 | 4,089,459 |
| 100k receipt pressure | 100,000 | 173 | 28,739,421 | 43,339,420 | 14,599,999 |

The native adapter also prints a 30-transaction micro-measure (`A3_NATIVE_SAVE_GROWTH`) and asserts that new operations do not grow `commands`, that each transaction creates one SaveService receipt, and that collected job escrow is removed.

## Remaining growth risks

- `applied_transactions` is still unbounded in SaveService. At ~287–301 bytes per modeled transaction, 100k receipts are ~28.7 MB before other save data. A0 must define receipt retention/compaction that preserves replay safety, or explicitly accept the growth.
- Terminal instance records still grow with loot/manufacture history. The 10× model has 1,730 terminal records. A0/A3 should define an archival/provenance policy before long-term production claims.
- Active job escrow is bounded by station queue capacity, but A0 must enforce station/queue limits in production.
- Human action frequency is not measured. The 14-session model is a design sensitivity, not a daily-grind assumption.

## Proposed A0 retention contract

1. Never delete a receipt that can still authorize a replayed mutation unless a successor receipt/namespace marker makes the old operation permanently impossible.
2. Prefer compacting old receipts into a bounded `applied_transaction_epochs` marker only after independent review proves replay safety.
3. Terminal instance records may be archived only with provenance retained and no physical token remaining.
4. Any retention policy must be tested with reload, duplicate event ids, event-id conflicts, and old-save migration.
