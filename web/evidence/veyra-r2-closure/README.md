# Veyra `U=0.5` Round 2 Closure Evidence Bundle

- **Branch:** `arena/66b6e01d-soul-of-hero` (Draft PR #51 stacked onto `arena/d968af95-soul-of-hero`, Creator baseline `2d439ca`)
- **Pre-Fix Baseline Commit:** `57f8ddd0000abd81569acde198cee393b26c453a`
- **Viewport & Scale:** `640×360 @ 1×` (`deviceScaleFactor: 1`), captured against the live Vite dev server via real Chromium DOM keyboard/mouse input (`WASD`, `Space` dodge-roll, `Digit1` hotbar select, mouse aim + LMB swing, `KeyE` item pickup, quickbar right-click `Field Medkit`). Zero combat/HP/kill state injection.

---

## 1. Gap 1 Closure — 100% Authored Veyra Prop Preservation & Full-Footprint Solidity (`R2-CLOSURE-1`)

### Root Causes & Fixes
1. **Interior Window Border Margin (`floors.ts:201-216`):** `solidProps` stamping previously rejected footprints touching `1..WW-2` instead of the full `0..WW-1` active window, silently dropping edge-adjacent authored props. Fixed to atomic `0..WW-1` bounds validation while keeping `layer.sources` untouched (`mapDigest`/`sourceDigest` preserved).
2. **Water-Straddling Footprint Wings (`engine.ts:428`, `floors.ts`):** Multi-tile landmarks straddling millraces (`po_mill` `f03_waterwheel` `3×2` over `T.SHALLOW` / `T.WATER`) now validate anchor dryness while promoting solid wing cells (`c === 4`) to `c = 2` (`solidProp`) in `buildWorldCollisionGrid`.
3. **4 Authored Stair-Adjacency Overlaps (`arch/{sites,c02,rest48}.ts`):** Nudged 4 authored props by 1 tile (`po_ruinedkeep` `sites.ts:261`, `po_ironmine` `sites.ts:465`, `po_watchtower` `c02.ts:191`, `po_way` `rest48.ts:364`) so `0` stairs or doors are blocked across all 81 POIs × 4 storeys while preserving all `680` dry authored props.
4. **Missing Compositor Sprites (`decor-client.ts`):** Added crisp procedural pixel sprites for `tree_stump` and `signal_flag`, bringing landmark/prop sprite coverage to `116 / 116` (`100.00%`).

### Quantitative Audit (`MAP_PROP_COMPLETENESS_TALLY.json`)
| Metric | Result |
|---|---|
| Authored POIs × Storeys Audited (`F-1, F0, F1, F2`) | `81 POIs × 4 = 324` layers |
| Dry Authored `ArchPlan` Props Preserved & Solid (`solidProps === 1`) | **`680 / 680` (`100.00%`)** |
| Window-Sampled `layer.props` Placed & Solid Across All 81 POI Windows | **`13,336 / 13,336` (`100.00%`, `0` skipped)** |
| Distinct Landmark & Prop Sprite Kinds (`hasLandmarkSprite === true`) | **`116 / 116` (`100.00%`)** |
| Blocked Stairs / Doors Across All 81 POIs × 4 Storeys | **`0`** |
| Legacy `poi-kit.ts` `ww.landmarks` on Authored Sites | `0` (superseded by `AUTHORED_SITES`) |
| Giant Footprint Wing Collision + LOS (`3×2` `f03_silo`, `5×2` `elder_typhon_shard`, `7×2` `elder_atlas_gate`) | **Player + Creature + Motorbike + LOS all blocked on outer wings** |

---

## 2. Gap 2 Closure — All 48 SOH-Host Primordial Sanctuary Skills (`R2-CLOSURE-2`)

### Root Causes & Fixes
1. **Host Tick Substepping & Coroutine Cadence (`host-bridge.ts`, `primordials/game/core.ts`):** Substepped Primordial host ticks at fixed `60 Hz` (`MAX_PRIMORDIAL_SUBSTEP_SEC = 1/60`) and restored `yield 0` single-frame pause semantics in `Runner.step` so rapid pulse/projectile cadences never collapse under `50 ms` (`20 Hz`) SOH ticks.
2. **Sanctuary Wall Occlusion & Portal/Projectile Sweeps (`host-bridge.ts`, `primordials/game/helpers.ts`, `primordials/game/skills_b.ts`):**
   - Clipped sight-line wake & `SkillCtx.valid` placement via `clipSightToWall` so walls strictly block sanctuary teleports/portals/hazards without stacking fallback portals onto `anchor`.
   - Added swept wall raycasts to `spawnProj` & `portalPair` (ignoring unlinked `link <= 0` portals), wall-LOS guards on `capsuleHit` & `pullPlayer`, clamped radial emitters inside `1px` of walls, and aligned `orbital_transference` with live `playerPos` inside `OPEN`.

### Quantitative Audit (`HOST_48_SKILL_MATRIX.json`)
- **Skills Verified Inside Real SOH Sanctuaries (`F-1` / `F0`):** **`48 / 48`** (`6` Elders × `mini` + `ultimate` × `4` skills)
- **Per-Skill Invariants Passed (`48 / 48`):**
  1. Tell phase (`OPEN` + `ACTIVE` transitions observed)
  2. Active hazard / projectile entity emission (`entitiesSpawned > 0`)
  3. Open-sanctuary damage lands (`openSanctuaryDamage > 0`)
  4. Real SOH dodge-roll (`Space` + lateral `WASD`) mitigates/evades (`dodgeRollDamage < openSanctuaryDamage`)
  5. Solid sanctuary wall (`T.PWALL`) completely blocks damage (`wallOccludedDamage === 0`)
  6. Defeat / cleanup leaves zero leaked lethal or owned entities (`cleanupZeroLeak === true`)
  7. Composited `640×360` `renderWorld` frame verified non-blank (`nonZeroPixels > 1000`, `distinctColors >= 20`)

---

## 3. Natural-Input `640×360 @ 1×` Browser Visual Proof

### A. Before (`57f8ddd`) vs After Prop Restoration (`640×360`)
- `before-57f8ddd-po-siloc-silo-640x360.png` vs `after-fixed-po-siloc-silo-640x360.png` (`po_siloc`, `AU 1099,764 · F0`)
- `before-57f8ddd-po-mill-waterwheel-640x360.png` vs `after-fixed-po-mill-waterwheel-640x360.png` (`po_mill`, `AU 981,734 · F0`)

### B. Giant Multi-Tile POI Prop Wing-Collision (`640×360`, Real `WASD` + `LMB`)
- `prop-1-silo-3x2-wing-collision-640x360.png` — `3×2` `f03_silo` outer wing `+1` at `po_siloc` (`AU 1087,754 · F0`)
- `prop-2-typhon-5x2-wing-collision-640x360.png` — `5×2` `elder_typhon_shard` outer wing `+2` at `po_typhon` (`AU 557,346 · F0`)
- `prop-3-atlas-7x2-wing-collision-640x360.png` — `7×2` `elder_atlas_gate` outer wing `+3` at `po_gate` (`AU 170,519 · F-1`)

### C. All 4 Regional Side Bosses — Natural Full-HP Combat + Slain & Unique Drop (`640×360`)
- `sb-greyback-combat-640x360.png` & `sb-greyback-kill-640x360.png` — **Greyback Shaleheart** (`po_greyquarry`, `AU 506,653 · F0`)
- `sb-ronin-combat-640x360.png` & `sb-ronin-kill-640x360.png` — **Oathless Ronin** (`po_cairns`, `AU 470,991 · F0`)
- `sb-tidemarshal-combat-640x360.png` & `sb-tidemarshal-kill-640x360.png` — **Saltwick Tidemarshal** (`po_saltlight`, `AU 1732,263 · F0`)
- `sb-custodian-combat-640x360.png` & `sb-custodian-kill-640x360.png` — **Pale Custodian** (`po_academy`, `AU 926,261 · F-1`)

### D. All 6 Primordial Elders — Live Sanctuary Hazard + Slain & Elder Stone + `.webm` Video (`640×360`)
- `elder-surtur-hazard-640x360.png`, `elder-surtur-kill-stone-640x360.png`, & **`elder-surtur-sanctuary-fight-640x360.webm`** (`4.3 MB` 30fps live canvas recording, `po_foundry`, `AU 1694,831 · F-1`)
- `elder-typhon-hazard-640x360.png` & `elder-typhon-kill-stone-640x360.png` (`po_typhon`, `AU 556,347 · F0`)
- `elder-aion-hazard-640x360.png` & `elder-aion-kill-stone-640x360.png` (`po_elderwood`, `AU 868,717 · F-1`)
- `elder-atlas-hazard-640x360.png` & `elder-atlas-kill-stone-640x360.png` (`po_gate`, `AU 168,518 · F-1`)
- `elder-argus-hazard-640x360.png` & `elder-argus-kill-stone-640x360.png` (`po_hall_of_eyes`, `AU 993,217 · F-1`)
- `elder-anubis-hazard-640x360.png` & `elder-anubis-kill-stone-640x360.png` (`po_necropolis`, `AU 605,1047 · F-1`)

---

## 4. Verification Logs & SHA256 Manifest
- `tsc-noemit.log` — `tsc --noEmit -p .` & `tsc --noEmit -p tsconfig.test.json` (`0` errors)
- `vite-build.log` — `vite build` singlefile production bundle (`dist/index.html`, `0` errors)
- `review-r2-acceptance.log` — `src/veyra05/review-r2-acceptance.test.ts` (`7 / 7` passed)
- `vitest-full.log` — Full repository Vitest run (`129 passed | 1 skipped (130)` files, `924 passed | 1 skipped (925)` tests, `0` failures)

```text
c937ae78f4907e8d469781b156b71c9f39f9df3afe79c154dc9d4f672dfa5263  HOST_48_SKILL_MATRIX.json
5eb11344fc45b9c99dbe27b4f2991a1a8aa5a792e6d7226610eb3df2b5eeb68f  MAP_PROP_COMPLETENESS_TALLY.json
ce21d99e0cc6cd131b32f71b5b6d05d77b1b158b0d5970ccfaa5c07eeadad2d6  after-fixed-po-mill-waterwheel-640x360.png
e97a7f847c992c53f653b04a24de9434b6c13ff1ff6c291ee67592381d17e400  after-fixed-po-siloc-silo-640x360.png
239f45c309d04ee43c52ed6e7f5fbb9e6e2c3d34f3c3d5955a0181d60baa4008  before-57f8ddd-po-mill-waterwheel-640x360.png
b3485cef65f97b67061616ba72d4d0781f32b616a584d2325e86241b7c5a6a95  before-57f8ddd-po-siloc-silo-640x360.png
5134ea3270a1957566f627e09ddd7911f7f480df494ebe5198547b6088e05932  elder-aion-hazard-640x360.png
9e23365b2d965d25ac585d7db2536bd6cfc0c8dbd5baecbb28582bc1a905fed1  elder-aion-kill-stone-640x360.png
3ad12d5b4d687f516651702e560b2d12b610a25ea29cb36aea3811c0ef05ede3  elder-anubis-hazard-640x360.png
918f340e35d0414ccba1e8460a9f65e79c01bf625d7b99bd26c9e55495626716  elder-anubis-kill-stone-640x360.png
d06b3cdd7ee463e3433326ef3ce38bde69c282b4f35b85423238e3ecc5092fbf  elder-argus-hazard-640x360.png
64fbaaca3752bcf7544b4fc089a4a3408cc9b8a99c016c0ac9a4de4e6f704925  elder-argus-kill-stone-640x360.png
444425438307a7a236623e3e6804c2a4bd8862c8e5c9e342b8004e67c16a929f  elder-atlas-hazard-640x360.png
c7a029ae4df28fc237a77fd4895858cf1d17719ecd5cfb79c7e4e8b0f71775af  elder-atlas-kill-stone-640x360.png
1fc754b28c75e229fc86497375ca1b760991949ba10f8bf7b8fb0508c956d178  elder-surtur-hazard-640x360.png
ebe4d6a4a9ea8fdc9803d8182c4c170a6478b17a3e4b5e73b2b95618c018854f  elder-surtur-kill-stone-640x360.png
75b4a01ca9f88246bea0b2e560afcf2f974cd6f6c9c6cf1a1dc980c55af18c18  elder-surtur-sanctuary-fight-640x360.webm
723e02866fb93fed0ed50edecdbb73ac646593f7907d3e0a3a8e783d35d00fdb  elder-typhon-hazard-640x360.png
f7a22be1edba57a5888bd0c1adc9a7fc419a0fbf4964e96e16c17d50ca6cbe96  elder-typhon-kill-stone-640x360.png
cdb3ea577c61a51079f2274fc0c65cc025170296957850b49fabb75a5cd873ad  prop-1-silo-3x2-wing-collision-640x360.png
2090fdd6e4a873db531b5b5fe6ce7ffcccf60700b5d09a8d03e07e22ad4827a0  prop-2-typhon-5x2-wing-collision-640x360.png
cab4e263cf107ab5c12c7b7ea0542edacede20c31d7e1cde29327f9da50732d2  prop-3-atlas-7x2-wing-collision-640x360.png
b97ec36a94476a8687280d6150d0499b13275eae58fb2df2a65bff3599c44a9d  review-r2-acceptance.log
9cdf8b6f07bfedbf25735b61e05bb9fb43801306d59433d79dd6d90c64955f3a  sb-custodian-combat-640x360.png
930c61fe1cb492486a0de6dbf5e01df6b8bb3cb3c70dd8bf5ef643e195aa5fb0  sb-custodian-kill-640x360.png
7e117f4121b4b6045db00b7ecd5a17bafcc0bd97c45c8e305929a41521094bdd  sb-greyback-combat-640x360.png
58fd98e24bee6d3358df843ab8754d7a6c041a9eaafc8d917d76819685c35c08  sb-greyback-kill-640x360.png
6b392049f67ed16dc54273522fd20b5c4532f0a5d30be20efd691cdf4cd254c7  sb-ronin-combat-640x360.png
28f049a2640671d9f0d0db509f81950545910d83344ff0dfd6fd3ff66e83fb81  sb-ronin-kill-640x360.png
0ece3097450f9c95daa99e183c3c5f817d650284e5b9f1b605fd09b22c07ef8c  sb-tidemarshal-combat-640x360.png
7693fb4509dd251f4945117d075a1b15f35186edad56e4cddce89511f1a7588b  sb-tidemarshal-kill-640x360.png
90aece4e427e319c804c5dddff34d9de6ffc961044e6724f475dbbfc9be233da  tsc-noemit.log
2c94eab4b8100d4f384e6c60e5524f37c0f19647fa38bdbc4dc0c086ea7dc2a9  vite-build.log
819f420781aa27e9e78ec2edcd0397d1dcdb4288271c89212d52b66bb526a033  vitest-full.log
```
