# MEC-01 R5 evidence (work order comment 6733657610)

## Browser (real GUI, not HTTP-200 only)
- Runner: `@sparticuz/chromium@131` + `puppeteer-core@23` from npm registry, executed in /home/user/tools-r5 (outside repo). Needed LD_LIBRARY_PATH to the al2023 libs extracted from the package (libnss3). Script: `browser-smoke.mjs`.
- Target: single-file build served at http://127.0.0.1:8790 (python http.server over /tmp/soh-single-r4).
- Result: title "Soul of Hero", menu rendered (New run, Profile & history, cash 0, runs 0), 0 page errors, 0 console errors. Screenshot: `browser-title-640x360.png` (640×360 viewport).
- Limit: only the title/menu route was exercised. No in-game player path was clicked through in the browser this round.

## Default build
- `npx vite build` (default outDir `dist`): exit 0. Output: 1 file, `dist/index.html`, 30,352,004 bytes (30.35 MB), gzip 20.13 MB. Build time 7.09 s.

## Tests
- tsc --noEmit: exit 0.
- Full Vitest --testTimeout=60000: 112 files passed / 1 skipped; 815 tests passed / 1 skipped; exit 0.
- New joined F3 test `tests/mec01-f3-joined.test.ts`: real deposit (6 cash from escrow route, labelled qaOffset 264h phase control), second deposit refused, evacuation at fixture beacon, snapshot reload, run 2 starts with profile cash 6 and run-local rcash 0. Limit: reload is in-process, not a separate OS process.

## Measured shipping supply (static census of world.sourceV3, shipping_fresh)
- Spares-bearing nodes: scrap 25 nodes × 4 units × 0.55 = expected 55 Spares; wreck 10 × 8 units × 0.30 = expected 24 Spares (economy variant may be 0.7 per unit). Whole-map expected ≈ 79 Spares.
- Motorbike path Spares (C1 path): research table 6 + directed research 9 + frame 2 + geared drive 2 + L3 workbench upgrade 12 = 31 Spares ≈ 39% of whole-map expected supply, before other Spares uses and before player reachability limits.
- Not proven: fraction a fresh player collects in a time-limited run. No balance change made, because the measurement is a census, not a player-path measurement.
