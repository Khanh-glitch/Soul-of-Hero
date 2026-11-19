# PR #61 × PR #59 — integration evidence (2026-11-14)

| | SHA |
|---|---|
| PR #61 head used | `9ba112f39ba9` … full: `9ba112f398cfa9c00fa003ec117b9a968c5eca12` |
| PR #59 head used | `b3a2c64e92f689b1181106bcb251a081cd3fed0d` |
| Probe merge (local only, never pushed; two parents above, no text conflicts) | `7bca31b7a88f2e77d0a0014bfb56ace3f578381d` |
| Patch | `docs/integration/PR59_x_PR61_wp3_metal_pipe_route.patch`, SHA-256 `227141de5819eb308f99a3a81dc9091355696dbed668035140d2d347159dcc90` |

PR #59's branch was not modified. The patch touches one file, PR #59's version of `web/tests/wp3-veyra-recycler-integration.test.ts`, and no game code. Recipe revision 3 is unchanged: Utility Frame = 1 Metal Pipe + 2 Iron Ingot + 2 Machine Parts + 2 Parts.

## The route the patch adds (zero injection, all in the Slag Flats window the test is already in)

1. Tall Grass → 3 Fiber (knife) → hand-craft Rope.
2. Boulder → Stone (knife) until 4 → hand-craft Stone Pickaxe. The test asserts the pickaxe is in the pack before its mining power is used.
3. Nearest reachable Coal Seam (57 are reachable from the bench at that point) → Coal with the pickaxe.
4. Furnace: 2 more Iron Ingot from wreck scrap (`scrap_ingot`), then 3 Iron Ingot + 1 Coal → 2 Refined Iron Ingot.
5. Workbench L2: 2 Refined Iron Ingot + 1 Machine Part → 2 Metal Pipe.
6. The existing Utility Frame craft then succeeds; the Parts assertions after it are untouched.

The block is guarded by `RECIPES.vehicle_frame.ins` containing `metal_pipe`, so on PR #59 alone (revision 2) it does nothing.

## Results

| Tree | Check | Result |
|---|---|---|
| Probe merge, no patch | `wp3-veyra-recycler-integration` | 1 failed (Utility Frame craft refused) |
| Probe merge + patch | `wp3-veyra-recycler-integration` | 2 / 2 passed |
| Probe merge + patch | `tsc --noEmit` | clean |
| Probe merge + patch | PR #59 CI lists (`pa1-veyra-oil-proof`: wp3; v17-oil-chain, b05-oil-pump, s10-oil-refinery, motorbike, b04-vehicle-unload) | all passed |
| Probe merge + patch | round-2, round-3, oil UI, recipe-migration, rev-1 queued jobs, deploy custody, recycler, claim distance | 124 / 124 passed |
| Probe merge + patch | full Vitest suite | 177 failed / 961 passed / 6 skipped (1144). No test fails here that passes on PR #61 alone (179 failed / 949 passed). |
| PR #59 alone + patch | `wp3-veyra-recycler-integration` | 2 / 2 passed (block inactive) |
| Probe merge + patch | `vite build --config vite.http.config.ts` | OK |
| Probe merge + patch | browser driver `veyra-economy-wp4` | NOT PASSING. Its prerequisite snapshots are now written, so it starts; at 1280×720 it stops in Phase A waiting for a "Greywater South Shore" button; the 640×360 pass could not run in this sandbox's single-process browser. Whether that button is missing on PR #59 alone was not checked. Stays quarantined. |

The Web suite is not green on any of these trees.
