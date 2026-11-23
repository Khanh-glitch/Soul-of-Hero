# Why nobody evacuated in campaign run 10 — tools and raw output

Used for the section "Sơ tán" of `../TIEN_DO_SUA_LOI.md`. Everything here is a replay of a saved hour-288 state of the
336 h campaign (seed 7606, no player); nothing is a browser session.

## Saves

- `run9-6c4b8933-h288.save.gz` — hour 288 of the campaign on `6c4b8933` (6 evacuated at the end).
- `run10-b7395731-h288.save.gz` — hour 288 of the campaign on `b7395731` (0 evacuated at the end).

## Tools

- `evac.test.ts.txt` — copy to `web/_e.local.test.ts` and run with vitest
  (`FROM=<save.gz> HOURS=<n> [WATCH=h2l,h8] node node_modules/vitest/vitest.mjs run _e.local.test.ts --maxWorkers=1 --testTimeout=1500000`).
  Per replayed hour it prints the residents' decisions (`DEC`), evacuation receipts (`EV`), every vessel with its
  manifest and hold (`TRIP`), and the route-search counters (`NAV`, only when the counters are patched in).
- `instrument.py` — run from `web/`: patches counters into `src/game/human-navigation.ts` of commit `3c2fd48c` (it does not apply to later commits unchanged)
  (queue waits, cells examined on behalf of others, drops at the cap by rank, finished long searches).
  **Restore the file afterwards** (`git checkout src/game/human-navigation.ts`). The counters for the old queue were
  patched by hand into the old file in the same places; that patch was not kept.
- `cmp-endurance.py <dirA> <dirB>` — first hour whose state digest differs between two campaign output folders, and
  the totals of the casualty receipts.

## Raw output (`result-*.txt`)

The first block of each file is hour 289; its `HOUR 289` header line was lost to terminal colour codes.

| File | Code | State | What it shows |
|---|---|---|---|
| `result-run10-state-old-queue-4h.txt` | `b7395731` | run 10 | 23 residents decide to leave; one sets out in four hours; the rest read "Checking physical route" hour after hour |
| `result-run10-state-old-queue-counters-2h.txt` | `b7395731` + counters | run 10 | 13 and 23 searches dropped at the cap per hour (225,400 and 312,813 cells); resident `h2l` dropped at 20,224 and at 33,792 cells |
| `result-run9-state-old-queue-3h.txt` | `b7395731` | run 9 | the same code on the run-9 state: residents board as they did in run 9 — the code change of run 10 did not break boarding |
| `result-run9-state-rejected-variant-11h.txt` | intermediate | run 9 | a variant with two lanes and no helping: too slow, the vessel never fills and the passengers collapse on board. Rejected |
| `result-run10-state-planner-turns-2h.txt` | intermediate | run 10 | who gets the planner's 3,600 turns an hour (guards 1,306–1,880; queued residents 668–853) |
| `result-run9-state-new-queue-5h.txt` | `3c2fd48c` | run 9 | five long routes found in the first hour; the west vessel is full and sails in hour 291 (hour 294 with the old queue) |
| `result-run10-state-new-queue-12h.txt` | `3c2fd48c` | run 10 | four residents aboard the west vessel by hour 291 (with the old queue: nobody on that vessel in four hours, one resident on the Hook vessel); it never reaches six; they collapse on board from hour 295 |
| `result-run9-state-long-searches-2h.txt`, `result-run10-state-long-searches-2h.txt` | `3c2fd48c` | both | every long search that ended in the first two hours: who, from where, to which berth, cells examined, result |
| `result-run10-state-limit-lifted-probe-5h.txt` | `3c2fd48c`, limit 400,000 and cap 4,000,000 (probe only, never shipped) | run 10 | how many cells each resident really needs: 48,990 / 60,591 / 62,208 / 84,835 to the west berth; the vessel sails full in hour 290 |
| `result-run9-state-limit-96000-10h.txt`, `result-run10-state-limit-96000-10h.txt` | `d00d7791` | both | berth searches to 96,000, every other route 48,000, cap 160,000 (the same replay on `f00c2cf5`, 96,000 for every route, printed the same lines): on both states six aboard the west vessel and away in hour 290, six arrive in hour 294; `NAV` = most cells in flight before the cap trims, and what the cap dropped by rank (0 = nobody asking, 1 = queued search emptied to a ticket, 3 = growing search) |

The `END` lines of the three files above were printed by two `console.log` lines patched by hand next to the
`FOUND` and `SEARCH_LIMIT`/`NO_PATH` status calls of `route()`; in the limit-lifted probe they print `undefined` where
the resident's id should be (the patch read a field that does not exist) — the id is in the `EV` lines of the same hour.

## Water first aid in the browser

- `g1-water-aid.mjs` — needs `lib.mjs` of the browser harness (Playwright + `@sparticuz/chromium`, not in this folder) and the
  production build served on port 4174. STAGED: it puts one resident beside the player, thirst 0, downed; everything
  after that goes through the game's own panel. Exit 0 = the resident stood up with thirst 29-30, one drink gone from
  the flask, trust 55, no page error.

