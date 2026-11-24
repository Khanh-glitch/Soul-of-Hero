# Greywater — a paid patch at the north flood wall

New Veyra runs generate a village-owned stone buttress on a clear apron tile against the north wall. It **starts damaged** (285/380 HP); this is an authored maintenance need, not an observed storm or attack. Generation puts the builder’s existing two stones in the village store, exchanging lots with a flask if the store is full. No new material, warehouse slots or work order are granted. Existing saves do not acquire the buttress on load.

[New Game receipts, seed 7606](natural-7606.json). After starting the geographic world the test only advances time, observes custody, and serializes and validates one save. No actor placement, forced route, added materials or damage injection.

| Simulated time | Observation |
| --- | --- |
| +28.758 s | Builder `h9`, job `hw2tw`, withdraws the whole lot `s17t` (2 stone) from `c15z`, the ten-slot warehouse, into pack `c17q`. Wood was already carried. |
| +44 s | Save and Continue during work. Builder stands at `(1622,1161,0)`, one tile west of the buttress. Same intent after reload; the wall has not been repaired early. |
| +51.001 s | Job `hw2tw` pays 2 stone from `s17t` and 1 wood from `s17s`, both in `c17q`. Buttress `e2tm` goes from 285 to 380 HP. The stone lot is gone and the wood stack is smaller by one. |

`npc-builder-patch.test.ts` uses controlled positions and stock changes, separately from the natural trace. It checks stale damage, ownership and type changes, missing or claimed material, full pack, replacement of a selected UID, malformed save metadata, completion timing and replay. Collapsed-store bracing has its own regression suite; this trace is a repair of an existing standing structure, not construction of a new building.

From `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-builder,npc-builder-patch,npc-store-destroyed-replan}.test.ts
```

Verification: 26/26 tests across 11 suites, including natural engineer, cook, mechanic, foundry, garden and medic regressions. Test TypeScript and production build passed (Vite chunk-size warning).
