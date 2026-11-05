# `creator-u05/` — Creator-chosen U=0.5 additive physical POI program

> **Trạng thái:** `CREATOR_SCALE_INTENT_APPROVED__FULL_GAMEPLAY_RUNTIME_INTEGRATION_NOT_YET_VALIDATED`.
> Creator đã khoá **U = 0.5 AU / runtime tile** cho **ý định thiết kế tỉ lệ**.
> Đây **KHÔNG** là tích hợp Gameplay runtime sản xuất, **KHÔNG** là `VEYRA_PLAYABLE`,
> **KHÔNG** là chấp nhận thị giác, **KHÔNG** là `MERGE_READY` / `WORLD_MASTER_SEALED`.

---

## ⭐ FILE GAME MỚI (yêu cầu tiếp theo của Creator)

**`SoulOfHero_TerrainOnly_U05_x10.html`** — bấm đúp là chạy, **không cần server**.
Tải thẳng: `https://5183-<sandboxId>.e2b.app/download` (ép download) hoặc bản ZIP
mirror `SoulOfHero_TerrainOnly_U05_x10.zip` trên GitHub raw (xem `docs/TERRAIN_ONLY_VIEWER.md`).

Bỏ **toàn bộ công trình và mọi lớp nổi**; canvas chỉ còn nền: biome, đường, cầu,
sông, hồ, biển, bờ biển + hero gốc 16×24. Tốc độ chỉnh **x1 → x10** (720 px/s),
**`Z` zoom nhỏ nhất để nhìn toàn cảnh 4000×2800 tile** (slider / lăn chuột / `,` `.`,
`V` về 1×), **`F`** Fit/Center/Khoá camera, **marker nhân vật luôn hiện + khung Camera 1×
luôn bám nhân vật** (sửa lỗi mất follow khi zoom out), camera chơi bình thường vẫn
640×360 1×, WASD/mũi tên thật. Đã **khử các ô đơn lẻ A bị 4 ô B vây quanh** (3 lượt lọc deterministic; đường/sông/cầu/vách/băng/dung nham giữ nguyên, GOLD + terrain painter verbatim không đổi). Hướng dẫn đầy đủ:
`docs/TERRAIN_ONLY_VIEWER.md` · QA: `evidence/terrain-only-qa.json` ·
ảnh: `evidence/terrain-only-shots/`.

```bash
# Mở trực tiếp (file://) hoặc live preview /terrain-only.html trên cổng 5182
node creator-u05/build-terrain-only-game.mjs      # build lại 1 file HTML
LD_LIBRARY_PATH=/tmp/al2023/lib node creator-u05/tests/qa-terrain-only.mjs
```

Gói P1–P5 bên dưới vẫn được giữ làm bằng chứng lịch sử đã commit; file game mới
**không nạp** scene/công trình nào của gói đó.

---

## Chạy lại / xem audition (P1–P5)

```bash
cd /home/user/Soul-of-Hero
# 1. Nguồn (vendor verbatim từ live Gameplay head đã pin)
node creator-u05/tools/vendor-u05.mjs
# 2. 81-POI masterplan / audit / geometry conflicts / benchmark
node creator-u05/tools/build-u05.mjs
# 3. Sáu cảnh vật lý sâu + module sinh
node creator-u05/tools/build-scenes-u05.mjs
# 4. Compile
cd creator-u05/web-u05 && npx tsc --noEmit -p tsconfig.u05.json && cd ../..
# 5. Server audition (0.0.0.0:5182)
cd creator-u05/web-u05 && npx vite --host 0.0.0.0 --port 5182
#    mở /u05.html — selector 6 cảnh, native 640×360 @1×, WASD / mũi tên thật
# 6. QA P4 (Playwright, Chromium /tmp/chromium, LD_LIBRARY_PATH=/tmp/al2023/lib)
LD_LIBRARY_PATH=/tmp/al2023/lib node creator-u05/tests/qa-u05.mjs
# 7. Gắn bằng chứng vào scene JSON, tests, inventory, drift, verification
node creator-u05/tools/attach-proof-u05.mjs
node creator-u05/tests/test-u05.mjs
node creator-u05/tools/build-asset-inventory-u05.mjs
node creator-u05/tools/record-drift-u05.mjs
node creator-u05/tools/verify-u05.mjs

# P6 — standalone terrain-only game (bỏ công trình / lớp nổi, tốc độ x1..x10)
node creator-u05/build-terrain-only-game.mjs
LD_LIBRARY_PATH=/tmp/al2023/lib node creator-u05/tests/qa-terrain-only.mjs
```

`web-u05/node_modules` là symlink tới `large-world-01/web-large/node_modules` (bị `.gitignore` loại).
Vite server đã chạy tại cổng **5182** trong phiên làm việc này; LW-01 servers 5180/5181 vẫn sống.

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `contracts/CREATOR_CHOSEN_U05.v1.json` | Hợp đồng tỉ lệ, chunk identity, hard invariants, benchmark khoá |
| `contracts/LAYER_INVENTORY.json` | 17 tầng + vocabulary `source-authored / reprojected / proposed / runtime-owned / unresolved` |
| `evidence/source-custody.json` | WMP-04R1/GOLD digests, live `b5c8004c` custody, 231 file digests, drift 6 commit |
| `map-data/U05_POI_MASTERPLAN.v1.json` | 81 POI, phân lớp, không sửa GOLD |
| `map-data/U05_AUDIT.json` | 11 overlap, 26 thiếu entrance, 122 road×POI, 19/23 zone + reconciliation v3 18/23 |
| `map-data/U05_GEOMETRY_CONFLICTS.json` | 62 conflict có đo lường + owner; **0** amendment / relocation / widen / recolour |
| `map-data/U05_BENCHMARK.json` | Tham chiếu bảo tồn đường Beacon U=0.5 (không tái vẽ) |
| `scenes/po_*.u05.json` | 6 cảnh: Beacon, Greywater, Academy, Ironmine, Westmouth, Typhon |
| `web-u05/src/game/**` | 231 file Gameplay live **verbatim** (không sửa) |
| `web-u05/src/u05/**` | Runtime additive: contract / world / display / physical / game / main / terrain / lw / scenes.generated |
| `web-u05/u05.html` | Entry cô lập, selector 6 cảnh, toggle physical layer |
| `tests/qa-u05.mjs` | P4 QA: phím thật, before/after, approach/reentry, roof, collision, bounded caches |
| `tests/test-u05.mjs` | 237 static assertions |
| `tools/*.mjs` | vendor, build, scenes, attach-proof, asset-inventory, drift, verify |
| `evidence/shots/*.png` | 48 ảnh bằng chứng P4 |
| `evidence/{qa-report,test-results,asset-inventory,verification}.json` | Gói xác minh |
| `docs/U05_GEOMETRY_CONFLICTS_DELTA.md` | Báo cáo xung đột / delta đầy đủ |
| `docs/ASSET_INVENTORY.md` | 12/68 sprite reuse, 0 atlas mới |
| `docs/CONTROL_TOWER_U05_HANDOFF.md` | Bàn giao Control Tower |
| `SoulOfHero_TerrainOnly_U05_x10.html` | **FILE GAME terrain-only**, chạy độc lập, x1–x10 |
| `SoulOfHero_Nature01_U05.html` | **FILE GAME NATURE-01** (mới, tách biệt), 5 biome, `N` OFF/ON, x1–x10 |
| `SoulOfHero_Nature02_ForestSlice.html` | **FILE GAME NATURE-02** (MỚI, MỘT biome), 3 composition rừng, `N` OFF/ON, `M` audit art, x1–x10 |
| `docs/TERRAIN_ONLY_VIEWER.md` | Hướng dẫn file game terrain-only |
| `docs/NATURE01_PILOT.md` | Báo cáo pilot 5 biome + bàn giao Control Tower |
| `docs/NATURE02_FOREST_SLICE.md` | Báo cáo vertical slice rừng: audit art, 3 composition, so sánh 3 phiên bản, 5 đánh giá thị giác, 12 yếu điểm, bàn giao |
| `evidence/terrain-only-{build,qa}.json` | Build + QA của file game |
| `evidence/terrain-only-shots/*.png` | 6 ảnh terrain-only |

## NATURE-01 — pilot 5 biome (file MỚI, nền GIỮ NGUYÊN)

| File | Vai trò |
|---|---|
| `SoulOfHero_Nature01_U05.html` | **File game mới**: nền terrain-only + lớp thiên nhiên trang trí, tắt/bật bằng `N`, 5 cửa sổ thử nghiệm có ranh giới |
| `SoulOfHero_TerrainOnly_U05_x10.html` | **Baseline không sửa** (`sha256 540f095e…`); khi `N = TẮT` canvas mới giống hệt từng pixel file này |
| `docs/NATURE01_PILOT.md` | Báo cáo pilot đầy đủ: 5 vùng GOLD, quy tắc đặt, 12/12 QA, yếu điểm, bàn giao Control Tower |
| `evidence/nature01-{build,qa,sites,assets}.json` | Nguồn SHA, browser evidence, inventory art, định nghĩa 5 vùng |
| `evidence/nature01-shots/*.png` | 32 ảnh native 640×360: 5 cặp OFF/ON cùng vị trí + Beacon + 4 ảnh đi phím thật mỗi vùng |
| `web-u05/src/nature01/*` | `sites.ts` (5 vùng + `BIOME_RULES`), `nature.ts` (đặt/vẽ/audit), `main.ts` (bản terrain-only + toggle) |
| `tests/qa-nature01.mjs`, `tests/test-nature01.mjs` | 12 gate browser + 31 static test |
| `tools/build-nature01-game.mjs`, `tools/build-asset-inventory-nature01.mjs` | Build 1 file HTML + inventory art |

`N` bật/tắt; `Digit1…5` hoặc nút `01…05` đưa viewer tới 5 mẫu (spawn control,
không phải route/teleport). Chỉ 12 sprite `getArt().src` có sẵn, **0 art mới**;
vật thể **trang trí, KHÔNG phải tài nguyên thu hoạch**, không thưởng / cạn kiệt /
sở hữu / tương tác / chặn đường. Không công trình, POI, tường, mái, cửa, hàng rào,
tàn tích; không sửa GOLD, raster biome, đường Beacon, sông. Chưa nhân rộng toàn
map, chưa POI architecture, chưa visual acceptance, chưa merge production,
không `VEYRA_PLAYABLE`. `P5-G5/G6` vẫn FAIL, `P5-G7/G8` PARTIAL.

## Điều KHÔNG làm

- Không sửa `VEYRA_GOLD_MAP.sohmap.json`, coastline, islands, lakes, rivers, roads, docks, POI anchors, resource authoring.
- Không nới / tô lại / vẽ lại / đổi màu đường Beacon Creator thích.
- Không kéo giãn hero 16×24, không zoom camera, không dùng camera làm route, không teleport thay walk.
- Không cấp phát mảng 11.2M ô; không tạo vuông 4000×4000; không nearest-neighbour 8 AU staircase giả làm chi tiết author.
- Không bịa helicopter entity / car wreck / ship hull / luật marine-boat-ferry-swim.
- Không bịa gate/key/power/HP/loot/ownership/cash/boss/reward/vendor/vehicle.
- Không tuyên bố 81 POI art-complete/interactive; whitebox chỉ chứng minh hình học, collision, cửa, roof occlusion, walkability.
- Không khẳng định pixel-equality với benchmark (không có PIL/cv2/matplotlib; benchmark có HUD, ảnh `physical=0` không có HUD).

## P5 gates

`P5-G0…G4`, `P5-G9` = **PASS** trong phạm vi **audition cô lập**.
`P5-G5` (full Gameplay runtime) = **FAIL**, `P5-G6` (visual acceptance) = **FAIL**,
`P5-G7`, `P5-G8` = **PARTIAL**. Chi tiết: `evidence/verification.json`.


## NATURE-02 — forest quality vertical slice (MỘT biome, file MỚI)

| File | Vai trò |
|---|---|
| `SoulOfHero_Nature02_ForestSlice.html` | **File game MỚI**: nền terrain-only + lớp rừng MỘT cửa sổ 96×64, 3 composition, `N` OFF/ON, `M` bảng audit art 1× |
| `SoulOfHero_TerrainOnly_U05_x10.html`, `SoulOfHero_Nature01_U05.html` | **CẢ HAI GIỮ NGUYÊN** (`540f095e…`, `ac4d54e3…`); build assert cả 2 SHA trước khi ghi |
| `docs/NATURE02_FOREST_SLICE.md` | Báo cáo đầy đủ + Control Tower handoff |
| `evidence/nature02-{build,forest,assets,qa,visual-review,preview,delivery}.json` | Nguồn SHA, thiết kế 13 stand/3 clearing/3 route, audit alpha-bbox thật, 15 gate QA, 5 đánh giá thị giác RIÊNG, preview 6 route, links giao |
| `evidence/nature02-shots/*.png` | 44 ảnh native 640×360: 4 cặp OFF/ON, 4 bộ so sánh baseline/NATURE-01/NATURE-02 cùng toạ độ, 3 full-viewport, 12 đi phím thật, 1 bảng audit art |
| `web-u05/src/nature02/*` | `forest-sites.ts` (composition + owner dependency + asset gap), `forest.ts` (đặt/vẽ/audit), `art-audit.ts` (đo sprite thật), `main.ts` (viewer + `N`/`M`/1–3) |
| `tests/qa-nature02.mjs`, `tests/test-nature02.mjs`, `tests/qa-nature02-preview.mjs` | 15 gate browser + 54 static test + 6 route live preview |
| `tools/build-asset-inventory-nature02.mjs`, `build-nature02-forest-slice.mjs` | Inventory/audit art thật + build 1 file HTML |

`1`/`2`/`3` → rừng sâu / khoảng trống / rìa đường; `N` tắt/bật; `M` mở bảng
audit art (2× chỉ để soi, KHÔNG có trong game). **Không phóng to sprite**: cây
24×32 chỉ gấp **1,333** chiều cao hero 16×24 → không thể có overhead canopy,
đây là sửa composition, không phải sửa asset. 13 stand gắn kết (cụm cây lớn
nhất 178 tile so với 3 tile ở NATURE-01), 3 clearing, 3 hành lang **KHÔNG vật
thể** (không vẽ path, không sửa GOLD), đệm đường 3 tile; 51.424 pixel đường
giống hệt khi BẬT/TẮT. Chỉ 6 sprite có sẵn, **0 art mới**, 0 atlas, 0 scale.

**CHẶN PRODUCTION:** cùng sprite oak/rock/grass trong Gameplay live là
`SOURCES` có `stock/yields/block:true` và `r.natureTrees` đặc + rơi gỗ. Vật thể
ở đây chỉ trang trí, nhưng **hai cây trông giống hệt với tương tác trái ngược
không được duyệt production** → `NOT_APPROVED_FOR_PRODUCTION`; quyết định thuộc
Gameplay owner, Map không bịa reward/collision/source ownership.
`N02-ASSET-GAP-01` chỉ là **ĐỀ XUẤT**, không tạo asset thay thế. Không đụng 4
biome kia, không nhân rộng world, không công trình/POI/tàn tích/hàng rào/prop,
không merge Gameplay, không `VISUAL_ACCEPTED`, không `VEYRA_PLAYABLE`.

---

## MAP-GEO-REJOIN-01 — Physical Terrain & Traversal Readiness (KHÔNG tạo game mới)

> Trở lại đúng production plan Veyra Map: **WMP-04R1 / U=0.5**, đo địa hình vật
> lý & mạng đi lại, đối soát 62 finding, thử đi phím thật trong **chính**
> `SoulOfHero_TerrainOnly_U05_x10.html` (`540f095e…`, KHÔNG rebuild). Đây **không**
> phải ecology, không rải tài nguyên, không sản xuất POI, không atlas/product mới.

| File | Vai trò |
|---|---|
| `docs/MAP_GEO_REJOIN_01_STATUS.md` | **Báo cáo trạng thái Map hiện tại** — SHA nguồn, matrix lớp, 10 defect owner/severity, before/after runtime, 6 hành trình, 4 trạng thái nghiệm thu riêng, 1 việc tiếp theo |
| `docs/MAPGEO01_GAMEPLAY_HANDOFF.md` + `evidence/mapgeo01-gameplay-handoff.json` | Bàn giao **chốt nguồn** cho Gameplay owner `arena/d4bfcfff-soul-of-hero` @ `6e7d116b…` (PR44 OPEN, **không đụng**) |
| `evidence/mapgeo01-preflight.json` | Ref sống, drift Gameplay, §V/§11.5 bible, painter byte-identical, SHA 21 nguồn, 3 executable bảo vệ |
| `evidence/mapgeo01-physical-audit.json` | Đo A–F từ `sampleTile()/u05Tile()/terrainBlocked()`: thuỷ hệ, cao độ/vách, 92 đường, 12 cầu, 27 bến, 4 spawn, 81 POI; bảng tách 3 lớp; 10 defect |
| `map-data/MAPGEO01_FINDINGS_RECONCILED.json`, `evidence/mapgeo01-reconciliation.json` | 62 finding phân loại 5 nhóm, 30 finding đo lại 0.5 AU theo union, provenance GOLD bất biến |
| `evidence/mapgeo01-traversal.json`, `evidence/mapgeo01-shots/*.png` | 6 hành trình phím thật + **16 ảnh native 640×360** before/after + cặp OFF/ON cùng toạ độ |
| `tools/preflight-mapgeo01.mjs`, `tools/audit-mapgeo01-physical.mjs`, `tools/reconcile-mapgeo01-findings.mjs`, `tools/build-mapgeo01-handoff.mjs` | Tool chỉ-đọc / đo lường / bàn giao |
| `tests/qa-mapgeo01-traversal.mjs`, `tests/test-mapgeo01.mjs` | QA browser đi phím thật + **130/130 static test** |

**Phát hiện chặn:** `MGP-D01` — 12/12 cầu GOLD render `RIVER` và bị chặn, **0 cầu
đi qua được**; `MGP-D10` — 305 ô `cliffCandidate` nhưng **0 tile `T.CLIFF`** vì
mã hoá raster chỉ 0/1 trong khi luật U05 đòi `>=2`. Cả hai **không tự sửa**: sửa
sẽ bịa deck cầu ~48 tile hoặc tạo blocker từ dữ liệu CANDIDATE. `4 PASS / 1 FAIL
/ 1 PARTIAL` hành trình; crossing `br_1` FAIL với **122 sub-step bị chặn** là bằng
chứng thật, không phải gate giả. **0** đa giác/ID GOLD bị sửa, **0** cửa/prop/
công trình/atlas mới.

`PAPER=MEASURED` · `RUNTIME=ISOLATED_VIEWER_PHYSICAL_PARTIAL` ·
`VISUAL=NOT_REQUESTED_AND_NOT_GRANTED` · `GAMEPLAY=NOT_REQUESTED_AND_NOT_GRANTED`.
Không `VEYRA_PLAYABLE`, không `VISUAL_ACCEPTED`, không merge. NATURE-01/02 vẫn là
R&D lưu trữ, không phải hệ đặt tài nguyên production.

---

## MAP-GEO-REJOIN-02 — Sửa chiếu cầu & vách thật (KHÔNG tạo địa lý mới)

> Tiếp MAP-GEO-REJOIN-01. Map pinned `3e02fde05a24f6d645ea00ed5ab78900655e1272`;
> Gameplay pinned `6e7d116b…`, **PR44 sống đã drift** sang `c2418b54…` (OPEN,
> không đụng). Báo cáo: `docs/MAP_GEO_REJOIN_02_STATUS.md`; bàn giao:
> `docs/MAPGEO02_GAMEPLAY_HANDOFF.md`.

| File | Nội dung |
|---|---|
| `SoulOfHero_MapGeo02_CorrectedProjection.html` | **QA verification executable** có nhãn riêng; cùng renderer `U=0.5` / `640×360` `1×` / hero `16×24`; 3 executable bảo vệ **không đổi** |
| `web-u05/src/mapgeo02/corrected-world.ts` | Overlay additive: deck cầu có giới hạn từ GOLD `id/at/ang/load` + hai bờ + đường nối; vách nhị phân `>=1` + height/slope evidence; 2 mode quyền tách biệt |
| `evidence/mapgeo02-{preflight,build,bridge-geometry,road-water-classification,traversal,gameplay-handoff}.json` | Ref sống, build SHA, bảng 12 cầu, 31 giao cắt nước, 17 lượt phím thật, bàn giao |
| `evidence/mapgeo02-shots/*.png` | **84** ảnh native `640×360`, gồm 6 cặp đúng toạ độ MAP-GEO-01 |
| `build-mapgeo02.mjs`, `vite.mapgeo02.config.mjs`, `tools/{preflight-mapgeo02,classify-mapgeo02-crossings,build-mapgeo02-handoff}.mjs` | Build + tool chỉ-đọc / phân loại / bàn giao |
| `tests/qa-mapgeo02-traversal.mjs`, `tests/test-mapgeo02.mjs` | QA browser phím thật + **156/156** static test |
| `evidence/mapgeo02-shot-provenance.json`, `evidence/mapgeo02a-{refs,visual-inspection}.json` | **02A**: provenance từng ảnh, negative gate, ref/drift, thị sát ảnh (xem §10 handoff) |

**Đã sửa:** `MGP-D01` — thảm gỗ 888 tile trên đất / 0 tile trên nước tại `br_1`
→ **596** deck tile (**100% trên nước, 0 trên đất**), **10/12** cầu CANDIDATE,
**2/12** để nguyên chưa giải quyết (`br_9` bearing, `br_b` thiếu bờ; **không ép
12 PASS**, không stamp). `MGP-D10` — 305 cell nhị phân / **0** `T.CLIFF` →
**187** tile vách dải mỏng gãy ở cửa sổ cao địa (**0 slab đầy**, **0 production
wall**), QA candidate collision tách biệt. 31 đường nước: **8 ferry** (vẫn là nước),
**9 authored bridge**, **8 ford**, **6 ambiguous**; Beacon road **0 tile đổi**.

Production `PRODUCTION_NO_PERMISSION` **vẫn chặn** deck; `QA_CANDIDATE_CROSSING`
chỉ đo geometry. **0 rò rỉ quyền / 10,086 tile**, 31/31 runtime check, 0 lỗi
browser. `PAPER=MEASURED` · `RUNTIME=ISOLATED_VIEWER_PHYSICAL_VERIFIED_QA_ONLY` ·
`VISUAL=NOT_REQUESTED_AND_NOT_GRANTED` · `GAMEPLAY=NOT_REQUESTED_AND_NOT_GRANTED`.
Không `VEYRA_PLAYABLE`, không merge, không GOLD amendment, không atlas/art mới.
