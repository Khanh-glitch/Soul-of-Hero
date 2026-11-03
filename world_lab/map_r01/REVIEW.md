# MAP-R01 — verification and review report

**Task**: make the first real, playable Web world slice from the actual SOH art, with a defensible
A/B/C decision. **Status**: implemented and independently re-applied on a clean worktree. The patch
was **not** applied to this repository's root, **not** merged into PR38, and **not** visually approved
by the creator.

---

## 1. What is deliverable

| Artifact | Content |
|---|---|
| `patch/map_r01.patch` | 139,443 B, 6 files, `+4165 / -1`. Applies cleanly on PR38 `8421b9c3`. |
| `source/worldAssets.ts` | Pure asset selectors, SSR-safe image load, 6 `ASSET_DECISIONS` flags. |
| `source/render.ts` | Exactly 5 seams (`worldAssetChunk` ×1, `worldAssetSource` ×1, `worldAssetsReady` ×3) + import. |
| `source/assets/soh_slice_atlas.png` | 256×274, 23,547 B, 181 frames. SHA-256 `4844c6d485cae2c82e826d1e37c4cc85e6a0fe11fb08600bd37300d2e31885d1`. |
| `source/assets/frame_ledger.v1.json` | 97,421 B. Per-frame source commit, source file SHA, A1 atlas rect, slice rect, RGBA SHA-256, A1 provenance and rights note. |
| `source/assets/assets.d.ts` | Type declarations for `.png` / `.json` imports. |
| `source/tests/map_r01_assets.test.ts` | 7 tests pinning selector determinism, corner-bit decode, fallback, flags, prop mapping and ledger/frame completeness. |
| `tools/*.mjs` | `build_slice`, `serve`, `capture`, `composite`, `verify` — all reproducible. |
| `evidence/` | A/B/C raw 640×360 PNGs + manifests, 5 A/B/C composites, `verify/verify.json`. |

The patch is **scoped**: it adds no new engine, no new renderer, no new gameplay system, no new
collision, no new save field, no new controls, and no raw ZIP. It preserves PR38 as authoritative for
all of those.

---

## 2. Exact reproduction

```bash
# From a clean worktree at PR38 8421b9c3 (branch tracked in /home/user/r01-verify)
git apply --check /home/user/Soul-of-Hero/world_lab/map_r01/patch/map_r01.patch   # OK
git apply         /home/user/Soul-of-Hero/world_lab/map_r01/patch/map_r01.patch   # OK
cd web
npx tsc --noEmit                     # VERIFY_TSC_OK (no output)
npm test                             # 6 files / 91 tests / 91 passed
npm run build                        # dist/assets/index-*.js 750.27 kB │ gzip 329.06 kB
```

Rebuild the crop sheet from the pinned A1 source art:

```bash
node world_lab/map_r01/tools/build_slice.mjs <path-to-A1-terrain.png> <A1-props.png> \
     <A1-atlas.v1.json> <A1-first_hour_asset_provenance.v1.json>
```

All four inputs are addressed by commit + SHA-256 in `frame_ledger.v1.json` and `ASSET_LEDGER.md`.
The script prints `missing requested: none` and reproduces the sheet byte-for-byte including the
RGBA SHA-256 per frame.

---

## 3. Verification results (all actually executed, not asserted)

### 3.1 Static / unit

| Check | Result |
|---|---|
| `npx tsc --noEmit` in final C worktree | clean |
| `npx tsc --noEmit` in fresh `/home/user/r01-verify` after `git apply` | `VERIFY_TSC_OK` |
| `npm test` in final C | 6 files, 84 → 91 tests, all passed |
| `npm test` in fresh verify worktree | 91 / 91 passed |
| `npm run build` in C and fresh verify | `750.27 kB │ gzip 329.06 kB`, both |
| `viteSingleFile()` inline | JS + CSS + cropped PNG self-contained; PNG SHA matches sheet |
| Deterministic selector enumeration | 85 distinct names emitted (81 terrain + 4 disabled prop candidates); **all present** in `frame_ledger.v1.json` |
| `ASSET_DECISIONS` guards | `road:false, props:false` explicit; non-slice biome classes return `null` |

A `TS2575` error from a 7-argument `drawImage` was caught by `tsc` even though Vite built it; fixed
to 9 arguments. **Build ≠ typecheck** in this repo — both are required.

### 3.2 A/B/C visual comparison — identical conditions

| Condition | A | B | C |
|---|---|---|---|
| Head | `8421b9c3` untouched | `8421b9c3` + `438b813c` MapLab patch | `8421b9c3` + MAP-R01 |
| `Date.now()` | `1770000000000` | same | same |
| UI flow | New run → Fisher's Point → Begin | same | same |
| Seed | `2182077881` | same | same |
| Spawn | `(1352,2744)`, HP 100 | same | same |
| QA `+1h` | day `dayTime .3 / dark .237 / weatherSlot 0`; night `.8 / .763 / 6` | same | same |
| Coast day | `qaOffset 7200000`, `dayTime .3`, `weatherSlot 13` | same | same |
| Route | `KeyS 2800 / KeyA 2200 / KeyA 1200` | same | same |
| End position | `(1204.10, 2895.63)` | `(1204.10, 2895.63)` | `(1204.09, 2895.63)` |
| Viewport | native 640×360 | same | same |
| Console errors | `[]` | `[]` | `[]` |

Build sizes: A `651.71 kB`, B `661.40 kB`, C `750.27 kB`. That +98.56 kB **includes** the 23.5 kB
inlined PNG (base64 ≈ 31 kB), the 97 kB ledger and the selector module — not a rewritten renderer.

### 3.3 Real-browser gameplay verification (`evidence/verify/verify.json`)

Three independent fresh runs; real key events and real mouse clicks; no test hooks for gameplay:

| Assertion | Result |
|---|---|
| HUD clock / region / hotbar present | true |
| Cumulative walked path | **363.38 px** |
| HP unchanged | true |
| `I`, `C`, `M`, `B` panels open | true (all 4) |
| Real LMB harvest on grass tile `(83,176)` | `skills.gather 0 → 2` |
| Real `[E] Search crate` at Net Shed `(1304,2696)` route | prompt appeared; **Take all** moved inventory `3 → 6` |
| A-vs-C authority fingerprint | **identical**: seed, spawn, entity kinds/positions, POI list, inventory, terrain + source mutation counts |
| Console/page errors | 0 |

The first verification attempt reported `movementPass:false` at 235.38 px and `poi:false`; the route
was too short. It was corrected to a longer explicit route, and the three-fresh-run version passes.
The false failure is recorded here so it is not mistaken for a regression.

### 3.4 Visual decisions

C1 (A1 road + all A1 props ON) was built/captured and **rejected**: A1 `road_dirt_*` reads as
scattered boardwalk planks at 640×360, and inherited A1 props are darker/boxier than Web sprites.
C3 (A1 reeds ON) was built/captured; a debug counter recorded **0** prop draws on the first-hour
route, so it offered no visible improvement. C2 = final C. Full per-material reasoning in
`KEEP_REPLACE_REJECT.md`.

---

## 4. Known limitations — stated plainly

1. **Not merged.** The patch lives in `world_lab/map_r01/`. PR38 `8421b9c3` is unchanged. Applying it
   is a separate, explicit creator decision.
2. **Root `web/` is absent on this branch.** Editing `/home/user/Soul-of-Hero/web/` here is a dead
   end; the patch must be applied in a PR38 worktree. The `r01c` / `r01-verify` worktrees are local
   scratch and are not part of this repository's tracked files.
3. **Creator visual approval is not claimed.** All KEEP/REPLACE/REJECT calls are the agent's own
   assessment from side-by-side screenshots. B was rejected by the creator earlier; C has not been
   reviewed by the creator.
4. **Scope is one slice.** Only ground/water/coast and grass↔water / grass↔forest transitions on the
   Fisher's Point first-hour route. `SNOW`, `ASH`, `HILL`, `MARSH`, `TOXIC`, `LAVA`, `BURNT`, `ICE`,
   `BRIDGE`, `FLOOR`, `PWALL`, `CLIFF` keep Web's original procedural art. No Pinewatch/Frostcrown
   captures were made. Next step: MAP-R02.
5. **No Veyra native validation.** `VEYRA_GOLD_MAP.sohmap.json` is an explicitly PAPER-only design;
   its 2000×1400 authoring units, 8 land masses, 92 roads, 12 bridges, 27 docks, 81 POIs, 23 zones,
   280 resources, 17 rivers and 5 lakes were **not** mapped into Web's 200×200 island. MAP-R01 is a
   Web asset bridge, not a Godot-native Veyra acceptance. See `VEYRA_CROSSWALK.md` for the 8
   `BLOCKED-V01..V08` items and the separately required PAPER geometry/scale decision.
6. **Rights are provenance, not a grant.** A1 `first_hour_asset_provenance.v1.json` reports
   `HASH_DOMAIN_RECONCILED_NO_A0_REPIN_PERFORMED`; its candidate pins are not automatically A1 HEAD
   hashes, and `a0_repin_policy` is `NO_BLIND_REPIN`. Nine inherited original frames are labelled as
   such. `cainos_*` / `ocean_*` are excluded. No third-party licence grant is claimed and the 43-pack
   Drive folder was not accessed. Do not commit whole raw packs.
7. **No C01–C24 contract suite and no 336 h E2E.** Those are out of scope here; nothing in this
   report should be read as passing them.
8. B is included only as a rejected reference and a control; it must not be reintroduced as the art
   path.

---

## 5. Reviewer's shortest path

1. Open `evidence/ABC-all.png` (full A/B/C sheet) then `ABC-forest-day.png`, `ABC-forest-night.png`,
   `ABC-coast-day.png`, `ABC-coast-night.png` for the 2×-readable comparisons.
2. Read `KEEP_REPLACE_REJECT.md` for the exact per-material calls.
3. Open `evidence/verify/verify.json` if you want the gameplay/authority assertions.
4. Apply `patch/map_r01.patch` in a PR38 worktree and run the four commands in §2.
5. Decide: accept / request changes / reject. Nothing has been merged on your behalf.

---

## 6. Commits on `arena/2e3cfbd2-soul-of-hero`

- `438b813c` — earlier `world_lab/web_art_patch/` B reference (rejected), retained for provenance.
- `09b96bd2d8fa56a0c16a0f2eb2c577ad7a603b7d` — `MAP-R01: asset-backed playable Web world slice
  (first working implementation)`: patch, source copies, tools and evidence.
- `MAP-R01: add Veyra crosswalk, exact asset ledger, KEEP/REPLACE/REJECT and review report` — the
  four review documents (`VEYRA_CROSSWALK.md`, `ASSET_LEDGER.md`, `KEEP_REPLACE_REJECT.md`,
  `REVIEW.md`) plus the README documentation index. Run `git log --oneline -3` for its exact SHA.
