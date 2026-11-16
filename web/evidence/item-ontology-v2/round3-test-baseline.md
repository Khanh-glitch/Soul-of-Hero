# Round 3 — full Vitest suite, base vs head (same sandbox, same day, same command)

Command: `npx vitest run --testTimeout=120000 --reporter=json` in `web/`.

| | failed | passed | skipped | total |
|---|---|---|---|---|
| Base `934f4471` (PR #56 head, unmodified, separate worktree) | 180 | 890 | 6 | 1076 |
| Head (this PR, round 3) | 179 | 949 | 6 | 1134 |

Compared test by test (file + full test name): **0 tests fail on head that do not fail on base.** One base failure does not
recur on head (`economic-network-m1`, `STACK_TRACE_ERROR`); it was run under heavier machine load at base and is treated as
load-sensitive, not as something this PR fixed.

## The 180 base failures by cause

| n | files | Cause | How it was established |
|---|---|---|---|
| 57 | 15 | Raw `build` of a device refused: "Need an intact packed device." | the refusal text is in the failure message |
| 5 | 1 | "Build the wooden form first, then upgrade…" (upgrade-only geometry, `wall_plank`) | text in the failure message |
| 96 | 21 | The failing line is a raw `build` action asserted `ok`, reason not printed | read from the source line the stack points at; the reason itself was NOT captured, so "packed device" is the likely cause, not a proven one |
| 12 | 6 | Test placement helper found no legal tile (furnace, workbench, depot) | message; cause upstream of the helper not traced |
| 10 | 8 | Other stale pins: `ALWAYS_KNOWN_RECIPES.length` 38 vs 14 (2), Veyra `layoutId` (1), `BUILD_ORDER` lacks `door_powered` (1), `economic-network-m1/m2` (3), `k6-spatial` (1), `mec01-c2-delivery` (2) | message only |

So 62 are proven and a further 96 are consistent with one cause: tests written before PA1 that build devices from raw
materials, which PA1 (PR #56) forbids. None of these tests was edited in this PR. They belong to the PR #56 owner.

## Browser drivers (e2e), run against this head with a real Chromium

| Driver | Result |
|---|---|
| `pa1-building-palette.mjs` (CI) | PASS |
| `pa1-deploy-custody.mjs` (CI, edited this round for oil wording) | PASS |
| `pa1-research-visible.mjs` (CI, edited in round 2 for "Parts") | PASS — reads "ENERGY cost recorded (5 Parts + 2 Iron Ingot)" |
| `veyra-economy-wp4.mjs` (CI, edited in round 2) | NOT RUN — its prerequisite `wp3-veyra-recycler-integration.test.ts` fails with "Need an intact packed device." (same on base), so the snapshots it loads are never written |
| `w06-loot-fixture.mjs`, `integrated-smoke.mjs`, `v17-market-assisted.mjs` (edited in round 2) | FAIL at the same step on base and on head (stale drivers; the round-2 string edits are therefore unverified in these three) |
| the eleven `m-core-03*` drivers and `s12-airdrop-fixture.mjs` (edited in round 2) | NOT RUN — each continues a saved browser profile / evidence file from an earlier driver in a multi-step chain that was not reproduced |

Not run at all: Godot; any human play.
