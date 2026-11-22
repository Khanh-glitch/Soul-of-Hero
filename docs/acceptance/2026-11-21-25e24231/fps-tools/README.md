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
