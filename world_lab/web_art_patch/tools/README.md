# Reproducing the evidence

These are the exact browser scripts used for the before/after screenshots. They need a
Chromium (Playwright's own browser, or `CHROMIUM_PATH` pointing at a standalone binary),
`playwright` installed in the Web app, and two **built** single-file `dist/index.html`
files: one from pristine PR #38 HEAD and one from the patched tree.

```bash
# 0. baseline and patched trees
git worktree add --detach /tmp/pr38-baseline acaa002746061d9e2abe828ccc8a10bba9fc891d
git worktree add --detach /tmp/pr38-art     acaa002746061d9e2abe828ccc8a10bba9fc891d
cd /tmp/pr38-art && git apply /path/to/pr38_map_art.patch
(cd /tmp/pr38-baseline/web && npm ci && npm run build)
(cd /tmp/pr38-art/web     && npm ci && npm run build)

# 1. serve both production builds
node serve.mjs /tmp/pr38-baseline/web/dist/index.html 4180 &
node serve.mjs /tmp/pr38-art/web/dist/index.html      4181 &

# 2. capture (run from the Web app dir so `playwright` resolves)
GAME_URL=http://127.0.0.1:4180 ART_OUT=/path/to/evidence/before node capture.mjs
GAME_URL=http://127.0.0.1:4181 ART_OUT=/path/to/evidence/after  node capture.mjs
GAME_URL=http://127.0.0.1:4181 ART_OUT=/path/to/evidence/after  node traverse.mjs
```

`capture.mjs` uses the **real** New run → Fisher's Point → Begin flow, real WASD holds,
and the in-game paused-menu `+1h` QA button for the night condition. It never writes
`player.x/y`, never teleports, and never changes the world layout. Both builds run the
identical script, so `day-spawn` / `night-spawn` are captured at the identical spawn
camera and `day-walk` / `night-walk` after the identical physical route.

`+1h` twice returns the fictional clock to the same daylight value (7,200,000 ms is
exactly 5 × 24 min day length), so `day-spawn` and `day-walk` have comparable light.
The exact `dayTime`/`dark` values and the player coordinates for every screenshot are in
`evidence/{before,after}/manifest.json`; the traversal result is in
`evidence/after/traverse.json`.

Verification run in this sandbox: `npx tsc --noEmit` clean, `npm run build` clean,
`npm test` 84/84 passing, patch `git apply --check` + fresh-tree rebuild clean,
`capture.mjs` and `traverse.mjs` both with zero page/console errors.
