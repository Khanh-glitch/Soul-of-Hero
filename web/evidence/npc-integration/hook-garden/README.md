# Hook Village — one physical Sunroot harvest

Geographic New Game, seed 7606, no inspection landing. `tests/helpers/hook-garden-run.ts` advances the normal simulation clock and validates a JSON save while the first plant is growing. It does not set growth, give seeds, fill a flask, move a resident or assign a task.

| Simulated time | Observed on South Garden Plot `e2th` (2586, 696, floor 0) |
| --- | --- |
| +29.301 s | `hn` plants lot `hj2uh` with one Sunroot seed from `s1b7` in pack `c1b5`. |
| +30.000 s | Reload at 0.23% growth, preserving the plot and lot. |
| +30.801 s | `hn` waters with carried flask `s1b8`; three charges remain. |
| +584.915 s | `hn` harvests three Sunroot and one seed. |
| +600.099 s | The village store receives both stacks (`s3ed`, `s3ee`) with the original seed payment on both ledger entries. |
| +825.501 s | Another gardener, `hq`, sows lot `hj3lr` using seed from `s1bl` in their own pack. This is **not** reuse of `s3ee`. |

[Observed simulation receipts and ledger](natural-7606.json). The plot and two extra empty slots in the existing Hook store are New Game infrastructure, not a load-time refill. A first run with the ten-slot store demonstrated why space matters: the first crop did not complete delivery. The positive evidence above is for the twelve-slot store only.

The separate custody fixture controls position, maturity and capacity to check stale work, substituted flasks, blocked cargo and save validation. It is not evidence of autonomous behavior. To run from `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-hook-garden,npc-hook-plot-custody,logistics-garden}.test.ts
```

Verification: 20 distinct tests passed across the three suites above plus `npc-paid-work` and `npc-mechanic-fetch`. `npm run typecheck:tests` and `npm run build` passed (Vite chunk-size warning).
