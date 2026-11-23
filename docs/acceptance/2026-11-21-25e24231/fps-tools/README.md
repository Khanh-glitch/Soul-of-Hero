# FPS research tools (2026-11-22)

Scripts used for `../FPS_NGUYEN_NHAN.md`. They are research tools, not part of the game build.

- Need `playwright-core` and `@sparticuz/chromium` (not in `web/package.json`); in the research sandbox they live in
  `/home/user/acc/browser/node_modules`, and the scripts expect to run from `/home/user/acc/fps`.
- `bench.mjs <dist-dir> <label>` — serves a build, starts a new run, steps the game with a fixed 16.67 ms clock, one
  frame per real display refresh. Reports frame gap, JS time per frame, CPU profile split (tick / draw / …) and canvas
  call counts. Env: `FRAMES`, `WARM`, `SCEN=idle|walk|town`, `PROFILE=0`, `COUNT=0`, `OUT`.
- `timeline.mjs` — same, measured at several moments of one session (`PHASES`), or on a loaded save (`SAVE`, `HOUR`).
- `causes.mjs <dir> <phase>` — sorts the long frames of a timeline phase by what work made them long.
- `frames.mjs`, `sub.mjs`, `agg.mjs` — per-frame, per-function and whole-profile views of a `.cpuprofile`.
- `sweep.sh <n…>` — builds commit number n of `commits.txt` (0 = `main`) in a worktree and runs `bench.mjs`;
  `tab.mjs <file.jsonl>` prints the table.
- `result-*.json(l)` — the raw numbers quoted in the report.

Run one build at a time: a second process on the same machine spoils the timings.

## After the fix

- `ab.sh`, `ab2.sh`, `iso.sh`, `memab.sh` — the build before the fix and the fixed build, one right after the other,
  per scene (the machine drifts, so only back-to-back runs are compared). `NOREGION=1` on `timeline.mjs` switches the
  region worker off. `rows.py <file.jsonl>` prints the rows.
- `lines.mjs <cpuprofile> <bundle.js> <frames>` — self time per source line of an unminified build;
  `pdiff.mjs <a.cpuprofile> <b.cpuprofile> <frames> [top] [under-function]` — two profiles side by side.
- `ticks.test.ts.txt` + `ticks.sh` — cost of the simulation step alone, in Node, old code and new code alternating.
- `e1-save.mjs` — browser check of the autosave rule on the production build (both stores, reload, Continue).
- `ab5.sh` + `result-ab-5-quiet-machine.jsonl` — the last session, on the final commit, after the machine had settled
  (hour-8 scene twice, in both orders). Sessions 1–4 ran while the machine was erratically slow.
- `result-ab-1.jsonl` … `result-ab-4-*.jsonl`, `result-ab-4-memory-samples.txt`, `result-tick-node.txt` — raw numbers.
- `ab6.sh` (env `A`, `B`, `TAG`) — residents' step waiting for their next event: new game and hour-8 save, order
  old, new, new, old. `result-ab-7-resident-wait-final.jsonl` is `4ab22fac` against `6c4b8933` (the shipped rule);
  `result-ab-6-resident-wait-early-variant.jsonl` is an earlier variant that let walkers stand between two tiles
  (rejected: visible stutter). Each row carries the weather of the run.
