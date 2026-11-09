# M-CORE-03R evidence index — partial, assisted, not independent acceptance

See [`docs/survival/M_CORE_03R_HANDOFF.md`](../../../docs/survival/M_CORE_03R_HANDOFF.md) for exact scope, tradeoffs, failures, receipt ledger and remaining gates. PNGs are 640×360 captures of the running Web game, not visual mockups. Scripts in `../../e2e/m-core-03r-*.mjs` are staged local-profile continuations; several deliberately retain failed attempts and are not individually green replay tests. Nothing here constitutes a blind human or independent reviewer sign-off.

| Stage | Images | Structured evidence |
|---|---|---|
| Initial visual-only discovery, wreck and Drive | `blind-start.png`, `blind-map.png`, `blind-wreck-approach.png`, `blind-car-harvest.png`, `blind-car-inventory.png`, `blind-drive-info.png` and other `blind-*.png` | Visual-only until after this discovery; later routing was read-only assisted. |
| Real Recycler mid-job quit and separate-process offline/replay | `offline-recycler-world.png`, `offline-recycler-panel.png`, `offline-recycler-processing.png`, `offline-settlement-report.png`, `offline-output.png` | [`offline-recycler.json`](offline-recycler.json) |
| Death saved, relaunched and bag recovered | `death-actual.png`, `death-relaunch.png`, `bag-recovery.png`, `bag-recovered.png`, `research-death.png` | `death-observation.json`, `bag-recovery.json`, `bag-recovered.json`, `bag-recovery-second.json`, `bag-recovery-third.json`, `research-gather-partial.json`; note earlier unsaved death rollback. |
| Additional Drive recycled | `extra-recycler-world.png`, `extra-recycler-panel.png`, `extra-recycler-processing.png`, `extra-recycler-settlement.png`, `extra-recycler-output.png` | `research-recycler-extra.json` |
| Paid buildings, Spares research, offline Workbench job, blueprint use | `research-built.png`, `research-before-spend.png`, `research-processing.png`, `recovery-queued.png`, `research-offline-report.png`, `research-blueprint-output.png`, `research-learned.png`, `research-bench-selection-failure.png` | `research-build.json`, `research.json`; recorded selection failure is not a research or offline assertion failure. `research-loot.json` discloses assisted inspection. |
| Cloth and the learned kit crafted and used | `kit-processing.png`, `kit-output.png`, `kit-used.png` | `cloth.json`, `kit.json` (failed quit after real death), `kit-finished.json` (successful distinct crafted UID/use). |
| Receipts and custody | — | [`combined-receipts.json`](combined-receipts.json) contiguous r1–r300 from matching retained snapshots; [`full-ledger.json`](full-ledger.json) contains the final run's latest 250 receipts plus physical custody. Unsaved rolled-back events cannot be reconstructed as saved receipts. |

E04 Core/Chitin natural player journeys, natural cancellation/full-after-reservation, second legitimate spawn/route, and independent visual acceptance remain open. Keep PR #44 draft/HOLD.
