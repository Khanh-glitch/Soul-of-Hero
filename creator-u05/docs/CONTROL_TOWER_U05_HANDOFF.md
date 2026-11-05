# BÀN GIAO CONTROL TOWER — Creator-chosen U=0.5 Physical POI Program (P1–P5)

**Ngày:** 2026-11-05 (Asia/Saigon) · **Nhánh:** `arena/2e3cfbd2-soul-of-hero`
**Phạm vi:** additive, cô lập trong `creator-u05/` · **Không** đụng `large-world-01/`, `main`, PR44 hay bất kỳ nhánh nào khác.

> ### Trạng thái một dòng
> `P5_ISOLATED_AUDITION_VERIFIED__FULL_GAMEPLAY_RUNTIME_INTEGRATION_NOT_YET_VALIDATED__VISUAL_ACCEPTANCE_NOT_GRANTED`

Creator đã **khoá U = 0.5 AU/runtime tile** cho **ý định thiết kế tỉ lệ**. Quyết định này **chỉ** thay thế
câu "no approved final U" của LW-01 ở phương diện **scale intent**. Nó **không** cấp:
tích hợp Gameplay runtime sản xuất, chấp nhận thị giác, `VEYRA_PLAYABLE`, `MERGE_READY`,
`WORLD_MASTER_SEALED`, hay quyền reauthor/redraw/widen/recolour đường Beacon.

---

## 1. Đã giao (P1 → P5)

### P1 — Hợp đồng & custody nguồn ✅
- `contracts/CREATOR_CHOSEN_U05.v1.json`: `U=0.5`, `TILE=16 px`, 1 AU = 2 tile = 32 px,
  khung `2000×1400 AU → 4000×2800 tile = 11,200,000 ô địa chỉ` (**không vuông**, không cấp phát),
  `chunkKey('creator-u05',cx,cy) => 'creator-u05|cx:cy'`, `125×88 = 11,000` chunks,
  LRU ≤36 geometry + ≤36 display canvases, hero 16×24, camera 640×360 1×, 72 px/s.
- `contracts/LAYER_INVENTORY.json`: **17 tầng** L01–L17 với vocabulary
  `source-authored / reprojected / proposed / runtime-owned / unresolved`.
- `evidence/source-custody.json`: WMP-04R1 pointer + GOLD canon (332,249 bytes, byte-identical với LW-01 copy)
  + **live `b5c8004ca4e77be62484fb3cd296fe296d7de4c9`** (`934 files / 87,954,910 blob bytes`)
  → vendored **231 files / 2,535,968 bytes**, `verbatimMismatches=0`,
  `terrainBlockIdenticalToLive=true`, exclusions có lý do, digests cho 231 file + 6 additive file.
- Disclosure trung thực: `ARENA_BRANCH_PINNED__NO_ISOLATED_BRANCH_CREATED`
  (Arena cố định nhánh → cô lập bằng thư mục/app, không tạo nhánh riêng).

### P2 — 81-POI masterplan / audit / xung đột ✅
- `map-data/U05_POI_MASTERPLAN.v1.json`: 81 POI, `uniqueIds=81`, `duplicatedIds=0`, `lostIds=0`.
- `map-data/U05_AUDIT.json`: diện tích `poi.foot` **176.0 / 851.84 / 2034.56 AU²**
  → **704 / 3407.36 / 8138.24 tile²** (chỉ là **site envelope**, không phải sàn sử dụng);
  **26** POI thiếu `EXTERIOR_ENTRANCE`; **11** cặp envelope chồng nhau (đã hiệu chỉnh
  Sutherland–Hodgman); **122** cặp road×POI / **73** POI / **78** road;
  **19/23** zone×POI/Elder ở 1 AU kèm **reconciliation rõ ràng** với v3 S-03 **18/23 @ 8 AU**
  (`bz_verdant` + `po_timberyard`, 30 cells) — **không** nói biên canon đổi, `legalPlacement=UNKNOWN/GAMEPLAY`.
- `map-data/U05_GEOMETRY_CONFLICTS.json`: **62 items** có đo lường + owner;
  `amendedPolygons / relocatedObjects / expandedEnvelopes / recolouredRoads / widenedRoads` đều `[]`.
- `map-data/U05_BENCHMARK.json`: `beacon_beacon_u05.png` = **VISUAL PRESERVATION REFERENCE ONLY**,
  `physicalLayer=OFF`, `NOT_VISUAL_ACCEPTANCE__NOT_REAUTHORIZATION`.

### P3 — Sáu cảnh vật lý sâu ✅
`scenes/po_{beacon,greywater,academy,ironmine,westmouth,typhon}.u05.json` +
`web-u05/src/u05/scenes.generated.ts` (222–229 KB module).
Tách rõ 7 tầng: `SITE_ENVELOPE` → `BUILDING_COMPOSITION` → `DOORS_ROOMS` →
`ROOF_OCCLUSION` → `SOLID_COLLISION` → `NAV_RETREAT` → `GAMEPLAY_SOCKETS`.

| Cảnh | Structures | Roofs | Solids | Doors | Open space sau | Ghi chú thiết kế |
|---|---:|---:|---:|---:|---:|---|
| Beacon | 1 | 1 | 7 | 2 | 0.9171 | 0.819 → 0.0829; tháp đèn + sân đá mở |
| Greywater | 6 | 6 | 15 | 8 | 0.7691 | 6 nhà riêng + sân chung; override canopy-only có ghi rõ |
| Academy | 4 | 5 | 11 | 5 | 0.6717 | 4 cánh + sân + utility yard |
| Ironmine | 2 | 1 | 7 | 2 | 0.9428 | ground open-air (`covered=false`), chỉ deep-vault roof reservation |
| Westmouth | 2 | 2 | 7 | 2 | 0.7403 | 2 kho bến + apron mở; **không** bịa luật thuyền |
| Typhon | 1 | 1 | 5 | 1 | 0.9351 | arena **OPEN TERRAIN**; vành rào + khe cửa là `PROPOSED`, không phải GOLD, không boss/reward |

GOLD `poi.foot` giữ **full-precision verbatim** trong mọi cảnh
(`noPolygonAmendment=true`, `noShrinkRelocateExpand=true`). Source room/roof descriptor giữ verbatim;
chỉ THÊM inset footprint. Mọi `overrideNote` ghi rõ before/after — không giấu thay đổi thiết kế.

### P4 — Audition cô lập + bằng chứng thật ✅
`web-u05/u05.html` (selector 6 cảnh, toggle physical), runtime additive 9 file, `npx tsc --noEmit` sạch,
Vite `0.0.0.0:5182` đang sống. `tests/qa-u05.mjs` chạy Playwright 640×360 DPR1:

- **48 PNG** trong `evidence/shots/`: `before_*`, `after_*` (cùng camera, `physical OFF → ON`),
  `approach_*_start/goal`, `reentry_*_back`, `roof_*_inside/outside`, `collision_*_blocked`.
- **6/6 cảnh**: approach **và** reentry `arrived=true` bằng **phím thật** `page.keyboard.down/up`
  (WASD/Arrow), từng bước đối chiếu `player.tile`; `roofHiddenInside>0 → roofHiddenOutside=0`
  (roof thật sự ẩn/hiện); `collision.blocked=true` với `blockedAttempts` tăng và tile đứng yên.
- `0` console errors · `0` page errors · `0` failed requests.
- `uniqueKeys=11000/11000`, `collisions=0`, `legacyKeyCollisions=2175` (chỉ đối chiếu),
  `materializedAllCells=false`, `residentChunks≤36`, `displayCanvases≤36`.
- `native 640×360`, `dpr=1`, `zoom=1`, `U=0.5`, hero `16×24`, `cameraTrick=false`.
- QA spawn fixture **chỉ** đặt player ở tile bắt đầu / tile probe tường; ghi rõ
  `spawnFixture.recorded=true`, `teleportUsedAsRoute=false`, `cameraUsedAsRoute=false`.
  BFS chỉ **chọn** đường đi hợp lệ bằng **cùng predicate collision**, không thay thế walk.
- Toàn bộ `P4-G0…G7` = **PASS**.

### P5 — Tests / verification / inventory / delta / docs ✅
- `tests/test-u05.mjs`: **237/237 PASS** → `evidence/test-results.json`.
- `tools/attach-proof-u05.mjs`: gắn `runtimeWalkProof='PROVEN_BY_P4_QA'` + evidence pointers vào 6 scene.
- `evidence/asset-inventory.json` + `docs/ASSET_INVENTORY.md`: **12/68** sprite reuse từ live `art.ts`,
  **0 PNG mới**, `noNewAtlas=true`, 21 raster analysis, hero 16×24, terrain painter
  `sha256=f29c1a68…` byte-identical, benchmark digest.
- `docs/U05_GEOMETRY_CONFLICTS_DELTA.md`: đầy đủ bảng delta, 62 conflicts, 11 overlap pairs,
  reconciliation 19/23 ↔ 18/23, helicopter `PROVEN_MISSING`, drift 6 commit.
- `evidence/verification.json`: P5 gates + refs + reproduction order + `notClaims`.

---

## 2. Bảo tồn đường Beacon (Creator-liked)

Terrain PAL/PRIO/texel lấy **byte-identical** từ `b5c8004c:web/src/game/render.ts`
(`f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803`), cũng byte-identical với
block LW-01 `e11a9b44`. Header `src/u05/terrain.ts` ghi **7 substitution** (đã sửa từ "Six" cho khớp).
`fbm` dùng bản LW-01 `compat.ts` để khớp benchmark. Road centreline `rd_*` 3.0 AU half-width giữ nguyên;
6 tile / 96 px là **hệ quả của transform**, không phải nới đường. **0** recolour / redraw / widen /
reauthor. Không khẳng định pixel-equality (không có PIL/cv2/matplotlib; benchmark có HUD, ảnh
`physical=0` không có HUD).

---

## 3. Refs & drift (kiểm chứng lại trước bàn giao)

| | SHA / trạng thái |
|---|---|
| Map Arena branch | `arena/2e3cfbd2-soul-of-hero`, trước commit U05 = `b12d05866366de0d50e4d305ff7b72fcf36b4921` |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` |
| LW-01 code / handoff | `38d13514…` / `b12d0586…` (HISTORICAL COMPLETE, không đụng) |
| Gameplay pin đã vendor | `b5c8004ca4e77be62484fb3cd296fe296d7de4c9` |
| PR44 | **OPEN / DRAFT**, head `arena/d4bfcfff-soul-of-hero` = `5b3e683402bbc8540dea9404576164097e753f97` (thời điểm xác minh; nhánh PR44 đang hoạt động), base `8421b9c333…` |
| Commits sau pin | **14** (tính đến snapshot; nhánh vẫn nhận commit mới) |

14 commit mới thêm owner VFX / VFX review build / optional powered workbench / claim reserve / research targets / offline tuning / Bible docs / persist tweak.
`render.ts` đổi 3 dòng ở **projectile/hazard VFX hooks**, nằm **ngoài** terrain painter.
`art.ts`, `core.ts`, `veyra/wmp04r1.generated.ts` và terrain block **byte-identical**
(`u05RelevantBlocksIdentical=true`). U05 **không** re-vendor từ head cũ một cách im lặng,
**không** bỏ commit mới; drift nằm trong `source-custody.json.verificationDrift`.
Owner VFX atlas mới bị loại vì `productionAtlas=NOT_AUTHORIZED`.

**Helicopter Beacon:** kiểm chứng lại trên cả `b5c8004c` và `5b3e683` — chỉ có metadata tĩnh
`poi_beacon_engine_out_helicopter` trong `wmp04r1.generated.ts`; `art.ts` / `render.ts` **không**
có sprite/entity helicopter/helipad/chopper, không có `car_wreck` / `ship_hull`.
→ `PROVEN_MISSING` vẫn đúng. U05 **chỉ vẽ nét đứt reservation helipad**, không thay thế, không dời
(lighthouse `[268,656]` ↔ helicopter `[272,652]` = 5.6569 AU).

---

## 4. P5 gates (không nâng cấp thiếu bằng chứng)

| Gate | Status | Phạm vi |
|---|---|---|
| P5-G0 | **PASS** | Hợp đồng, 17 tầng, WMP-04R1/GOLD + live custody, tsc, 237 tests, drift disclosure |
| P5-G1 | **PASS** | 81 POI / audit / 62 conflicts, **0** amendment/relocation/expand/recolour/widen |
| P5-G2 | **PASS** | 6 cảnh tách tầng + proof đính kèm + delta/asset/handoff docs |
| P5-G3 | **PASS** | **CHỈ audition cô lập**: phím thật, before/after, approach/reentry, roof, collision, cache bounded |
| P5-G4 | **PASS** | Asset inventory: 12/68 reuse, 0 PNG/atlas mới, 21 raster, delta GOLD/road = 0 |
| P5-G5 | **FAIL** | Full Gameplay runtime integration / `VEYRA_PLAYABLE` — `NOT_YET_VALIDATED` |
| P5-G6 | **FAIL** | Creator visual acceptance — `NOT_REQUESTED_AND_NOT_GRANTED`; whitebox, không pixel-diff |
| P5-G7 | **PARTIAL** | 81 POI art-complete/interactive, full 4000×2800 streaming, 60 FPS, traversal toàn thế giới |
| P5-G8 | **PARTIAL** | Semantic validators, marine/boat/ferry/swim, helicopter entity, economy/inventory/ownership/loot/key/power/HP/boss/reward, §11.5 proof packet |
| P5-G9 | **PASS** | Đường Beacon bảo tồn verbatim; GOLD đa giác không đổi |

Kế thừa LW-01: `LW-G0 PASS`, `LW-G1 PASS`, `LW-G2 PARTIAL`, `LW-G3 PARTIAL`,
`LW-G4 PASS`, `LW-G5 PASS`, `VEYRA_PLAYABLE BLOCKED`.

---

## 5. Việc còn lại cho Control Tower / Gameplay (KHÔNG tự làm)

1. **Quyết định tích hợp runtime**: đưa 6 socket cảnh vào `getWorld()` thật thay vì
   `buildings:[], statics:[], places:[]`; chạy semantic validators C07/C11/C24.
2. **Giải luật đang `UNRESOLVED`**: 26 POI thiếu exterior entrance, 11 envelope overlap,
   19/23 buildable-site overlap (`legalPlacement`), marine/boat/ferry/swim, helicopter entity,
   cart clearance, vertical link blockers, retreat polyline.
3. **GAMEPLAY_SOCKETS**: gate/key/power/HP/ownership/loot/enemy/boss/reward/vendor/vehicle —
   hiện đều `GAMEPLAY`, chưa bịa.
4. **Gói bằng chứng §11.5**: 4 spawn walk, 3 vị trí build do player chọn, ≥2 POI access/retreat,
   chuyến cash không Elder, so sánh Elder, 640×360 1× legibility.
5. **Production**: 81 POI art-complete, full streaming, sustained 60 FPS, economy/inventory/
   transactions/traces/monsters thật, interaction range, offline drains đầy đủ.
6. **Xin Creator visual acceptance** riêng (hiện `NOT_REQUESTED`).
7. **Không** reauthor/redraw/widen/recolour đường Beacon khi làm các bước trên.

---

## 6. File chính để mở

- Bàn giao này: `creator-u05/docs/CONTROL_TOWER_U05_HANDOFF.md`
- Delta/xung đột: `creator-u05/docs/U05_GEOMETRY_CONFLICTS_DELTA.md`
- Asset: `creator-u05/docs/ASSET_INVENTORY.md`
- QA: `creator-u05/evidence/qa-report.json` + `creator-u05/evidence/shots/` (48 PNG)
- Verification: `creator-u05/evidence/verification.json`
- README/reproduce: `creator-u05/README.md`

> Whitebox / reused sprite chỉ chứng minh **hình học, collision, cửa, roof occlusion, walkability**.
> Chúng **KHÔNG** phải pixel art cuối cùng và **KHÔNG** phải sự chấp nhận thị giác của Creator.

---

## 9. PHỤ LỤC — Yêu cầu tiếp theo của Creator: file game terrain-only, x10

Sau khi bàn giao P1–P5, Creator yêu cầu: *"bỏ toàn bộ công trình và các lớp nổi,
chỉ giữ phần nền của đường, sông, biome,...và đưa tôi file game để di chuyển trên
map đó với tốc độ nhanh tùy chỉnh lên x10"*.

**Đã giao:** `creator-u05/SoulOfHero_TerrainOnly_U05_x10.html`
(1 file HTML, 1,394,306 bytes, chạy từ `file://` không cần server).
Chi tiết: `docs/TERRAIN_ONLY_VIEWER.md`.

- Canvas **chỉ** có nền (biome / road / bridge / river / lake / sea / shoreline)
  từ cùng terrain painter byte-identical `f29c1a68…` + hero gốc 16×24.
  `draw.overlays` toàn **0**; không bundle `PhysicalLayer`, `U05_SCENES`,
  `SITE_ENVELOPE`, `scenes.generated.ts`, không marker/label/roof/wall/door/HUD-on-canvas.
- Tốc độ **x1…x10** (slider + preset + phím `+`/`-`), tối đa **720 px/s**;
  `SPEED=72 px/s` gốc không đổi, hệ số là viewer control, không phải luật Gameplay.
- Camera 640×360 1×, U=0.5, LRU ≤36, không cấp phát 11.2M ô; chặn địa hình
  tự nhiên là tuỳ chọn (`C`), mặc định free-roam để xem toàn map.
- QA `evidence/terrain-only-qa.json`: **T-G0…T-G9 đều PASS**, tỉ lệ đi thật
  x1→x10 = **~9.4–9.7×** (dao động nhẹ theo khung hình), 0 console/page/request errors, 6 ảnh trong
  `evidence/terrain-only-shots/`, chạy được cả `file://` và HTTP 5182.
- Gói P1–P5 đã commit **được giữ nguyên làm bằng chứng lịch sử**; file game mới
  không nạp dữ liệu cảnh/công trình nào. Nếu Creator muốn **xoá** hẳn các artifact
  P1–P5 khỏi repo, cần lệnh riêng — hiện không xoá để không mất bằng chứng.

**Các cổng P5-G5 / G6 / G7 / G8 vẫn giữ nguyên FAIL / PARTIAL.** File game mới là
viewer nền, không nâng cấp thành tích hợp Gameplay hay chấp nhận thị giác.


---

## 10. PHỤ LỤC — Zoom toàn cảnh (yêu cầu tiếp theo)

Creator: *"thêm chức năng zoom map nhỏ nhất có thể để nhìn toàn cảnh map dc k"*.

**Có.** Đã thêm vào cùng file game `SoulOfHero_TerrainOnly_U05_x10.html`
(build lại, HTML 1.404.936 bytes, `sha256 f664761a…`, ZIP 119.118 bytes).

- **Deep link** `?zoom=fit` mở ngay chế độ toàn cảnh (cả `file://` lẫn HTTP).
- **`Z`** = mức zoom **nhỏ nhất có thể**: `0.128571 px/tile` = `0.8036%` (1:124)
  → `4000×2800 tile` thành `514×360 px`, **nằm gọn trong 640×360**, thấy hết
  đảo chính, các đảo vệ tinh, biển, hồ, sông, đường. Slider *Zoom bản đồ*,
  `,` / `.`, lăn chuột; `V` về **1× native**; `B` khung nhìn tuỳ chọn (mặc định tắt).
- Bản toàn cảnh là **bản xem mẫu 500×350 px** (175.000 pixel, 1 px = 8×8 tile = 4 AU,
  525.000 mẫu từ chính `u05Tile()` tại **tâm tile GOLD**, 3 điểm/block để giữ đường
  6 tile). Màu lấy base PAL verbatim. Xây progressive 6 hàng/frame (~3,3 s).
  **Không** cấp phát 11,2 triệu ô, **không** phóng raster 8 AU, **không** nhận
  là chi tiết authored, **không** vẽ công trình/marker/lên canvas.
- **Camera chơi thường không đổi**: 640×360 1×, hero 16×24, U=0.5, nền 72 px/s.
  Zoom là viewer control, không phải luật Gameplay / không phải chấp nhận thị giác.
  Ở chế độ zoom vẫn đi WASD + x10 được (QA pan 360 px / 500 ms).
- QA: **T-G0…T-G19 đều PASS**, 11 ảnh, 0 lỗi. `P6-G0 / P6-G1 / P6-G2 PASS`.
  Xem §11 cho bản sửa lỗi follow camera.

Các cổng `P5-G5/G6` vẫn FAIL, `P5-G7/G8` PARTIAL. Link tải không đổi:
`https://5183-<sandboxId>.e2b.app/download` (ép tải) và GitHub raw / ZIP mirror.


---

## 11. SỬA LỖI — "zoom out cái mất follow camera theo nhân vật"

Creator phản hồi bản zoom đầu: *"dở ghê á, zoom out cái mất follow camera theo
nhân vật là sao"*. **Đúng là lỗi**, xin nhận.

**Root cause:** `S.x/S.y` là world **pixel**, nhưng `drawOverview()` chiếu thẳng
với `pxPerTile` (px/**tile**) → sai **16×**; `followX` vì thế luôn rơi ngoài biên
clamp, camera đứng im. Cộng thêm việc bản đầu **không vẽ hero** ở tỉ lệ toàn cảnh
→ màn hình không còn nhân vật nào để theo. Nghĩa là follow bị mất cả về toạ độ
lẫn về hình ảnh.

**Sửa:**

- Chia `S.x/TILE` trước khi chiếu; offset / marker / khung viewport đều đúng.
- **Marker nhân vật luôn vẽ** ở mọi mức zoom (`draw.viewerCursor.playerMarker=1`),
  nằm gọn trong canvas và dịch theo WASD (`B` chỉ bật/tắt khung nhìn, mặc định bật).
- **`F`** xoay `FIT_FOLLOW` → `CENTER_FOLLOW` → `LOCK`:
  - Fit: `gain≈0.2444`, bản đồ trượt trong letterbox, **toàn khung map vẫn thấy**.
  - Center: `gain=1`, marker **luôn (320,180)**, map cuộn dưới chân (có thể cắt).
  - Lock: đứng yên để đối chiếu.
- **Khung `Camera 1×`** 192×144 là **canvas HTML riêng** (không phải overlay trên
  canvas game): luôn vẽ nền native 1× với hero 16×24 ở giữa → camera gốc **không
  bao giờ tắt follow**. `L` bật/tắt, `H` ẩn cùng bảng điều khiển.
- `draw.overlays` vẫn **toàn 0**; không có công trình / marker map / label nào
  được thêm. Camera chơi thường vẫn 640×360 1×, hero 16×24, U=0.5, 72 px/s.

QA mới: **T-G16** marker luôn hiện & di chuyển, **T-G17** Fit-follow pan mà vẫn
thấy trọn map, **T-G18** Center giữ nhân vật giữa màn hình / Lock / quay về Fit,
**T-G19** lens native 1× riêng biệt. Cùng 11 ảnh, 0 lỗi, `P6-G2 PASS`.

**Giới hạn vật lý cần nói rõ:** ở mức fit, 4000 tile chỉ còn 514 px → x10 chạy
45 tile/s cũng chỉ dịch ~5.8 px. Muốn thấy camera cuộn rõ rệt thì bấm **`F` →
Center** hoặc nhìn khung **Camera 1×**; không thể vừa "toàn bộ map gọn trong
640×360" vừa "camera luôn center nhân vật" cùng lúc (hai điều kiện mâu thuẫn),
nên đã tách thành 2 chế độ rõ ràng thay vì giả vờ làm cả hai.


---

## 12. SỬA LỖI — "ô A bị 4 ô B vây quanh" (speckle biome)

Creator gửi ảnh màn hình lens 1× và báo: *"có khá nhiều và bất hợp lí các ô A
được vây quanh 4 phía bởi ô B"*.

**Root cause:** `biomeCodeAt()` jitter **độc lập từng tile** `±2.6 AU` khi đọc
raster phân tích 8 AU. Tại ranh giới biome, một tile rơi sang ô raster kia trong
khi 4 hàng xóm trực giao rơi vào ô này → đốm đơn lẻ; PRIO edge-dither của `renderChunk()`
verbatim khuếch đại thêm nhiễu pixel. Lỗi thuộc **sampler cộng thêm U=0.5**, không
phải GOLD / raster 8 AU / block vẽ terrain.

**Fix (`src/u05/world.ts` → `u05Tile()`):** cửa sổ `34×34` (chunk 32×32 + viền 1),
**3 pass deterministic** đọc lưới ĐÃ CẬP NHẬT: tile trung tâm thuộc nhóm biome mà 4 hàng
xóm trên/dưới/trái/phải cùng một loại biome và khác tile trung tâm → nhận loại hàng xóm.
Giải được cả cascade. LRU ≤256 cửa sổ, không cấp phát 11,2 triệu ô. Bản toàn cảnh
500×350 tiếp tục dùng **sampler RAW** (đốm đơn lẻ nhỏ hơn 1 pixel ở stride 8).

**Bảo vệ:** chỉ mã tile biome (`MEADOW/GRASS/FOREST/MARSH/SAND/HILL/SNOW/ASH/
TOXIC`) được sửa. `ROAD/BRIDGE/RIVER/DEEP/SHALLOW/CLIFF/ICE/LAVA/FLOOR/PWALL/
BURNT` không thuộc nhóm → **đường Beacon, sông, hồ, biển, bờ, cầu, vách, băng,
dung nham giữ nguyên từng tile**. QA đếm quanh Beacon: `road 442→442`,
`deep 9513→9513`, `river/bridge/cliff/ice/lava 0→0`. GOLD polygon, raster 8 AU và
`PAL/PRIO/texel` byte-identical **không bị sửa**; vẫn `overlays=0`.

Kết quả 5 cửa sổ 60×40: `102→0`, `59→0`, `25→0`, `68→0`, `65→0`; quét thô toàn
khung không còn cửa sổ nào có ô cô lập. Cụm ≥2×2 tile vẫn giữ (đảo/bãi biome thật).

QA **T-G20…T-G23 PASS**, tổng **T-G0…T-G23 = 24/24 PASS**, 15 ảnh, 0 lỗi,
`P6-G3 PASS`. Ảnh: `speckle_before.png`, `speckle_after.png`,
`terrain_only_despeckled.png`. File HTML build lại 1.407.498 bytes
(`sha256 540f095e…`), ZIP 120.378 bytes. Các cổng `P5-G5/G6` vẫn FAIL,
`P5-G7/G8` PARTIAL; không claim tích hợp Gameplay đầy đủ / chấp nhận thị giác.


---

## 13. NATURE-01 — pilot 5 biome, lớp thiên nhiên trang trí có thể tắt

Yêu cầu mới `SOH — NATURE-01: REAL WORLD ECOLOGY PILOT`. Đây là **file game MỚI**,
không phải sửa file terrain-only:

| File | Bytes | SHA-256 |
|---|---:|---|
| `SoulOfHero_TerrainOnly_U05_x10.html` (**giữ nguyên**) | 1.407.498 | `540f095e…` |
| `SoulOfHero_Nature01_U05.html` (**mới**) | 1.427.241 | `ac4d54e3…` |

Build script **assert SHA baseline trước khi ghi**; `src/terrain-only/*`,
`src/u05/terrain.ts` (PAL/PRIO/texel verbatim), `src/u05/world.ts` (despeckle),
21 raster WMP-04R1 và đường Beacon **không đổi**. `N` bật/tắt lớp thiên nhiên;
khi **TẮT** canvas 640×360 1× **giống hệt từng pixel** file nền tại 6 vị trí
(`N-G1`, so sánh SHA-256 PNG, clock rAF được đóng băng để khung hero xác định).

**5 cửa sổ thử nghiệm có ranh giới** 96×64 tile, lấy đúng GOLD/WMP-04R1:
(01) rừng ôn đới `[1440,1320]`, (02) rừng tuyết `[1360,840]`,
(03) đầm lầy `[2160,840]`, (04) vùng khô `[2640,1320]`,
(05) cao nguyên đá `[1100,1200]`. Ngoài 5 cửa sổ này **không có vật thể nào**
→ đây là **pilot**, chưa nhân rộng toàn map. Beacon `[544,1304]` nằm ngoài,
khi BẬT vẫn 0 vật thể.

**Art & phân loại nguồn:** chỉ 12 mảng sprite có sẵn trong `getArt().src`
(oak/pine/snowpine/willow/dead/rock/bush/bush_empty/grass/reed/herb/mush),
`newArtAssets=0`, không atlas/PNG mới. Mọi vật thể
`decorativeOnly=true, gameplayOwned=false`: **KHÔNG** phải tài nguyên thu hoạch,
không stock/cạn kiệt/thưởng/sở hữu/tương tác, không chặn đường, không đổi
`canStand()`. 7 sprite Gameplay-owned (`iron/coal/sulfur/crystal/stump/rubble/picked`)
và `scrap/wreck` bị loại tường minh. Vẫn có **điểm yếu**: người chơi có thể nhầm
cây trang trí với cây tài nguyên — quyết định phân biệt thuộc Gameplay, chưa bịa.

**Quy tắc đặt (không rải ngẫu nhiên):** lưới jitter 3×3 / 2×2 xác định +
`fbm` ~16 tile (clearings / open gap / rock cluster) + bảng `BIOME_RULES`;
loại `water/road/bridge/river/lake/coast/sourceTile/cliff`, đệm **2 tile** quanh
đường, reed chỉ ở bờ phía đất (`waterDist 1–2`), willow sau reed, cụm đá 1–3 viên
y-sort. `auditPilot`: **2.944 vật thể, 0 vi phạm**, open ground
84,4 % / 89,1 % / 82,4 % / **95,1 %** / 89,9 %. Thứ tự vẽ y-sort cùng hero
(`tile*16+14`), có vật thể cả trước và sau hero ở cả 5 nơi.

**Browser evidence:** `evidence/nature01-shots/` 32 ảnh native — 5 cặp OFF/ON
cùng toạ độ + cặp Beacon + 4 ảnh đi bằng phím thật (`D→S→A→W`, x10,
~1.200 px/mẫu, 4 keydown + 4 keyup, không teleport). `N-G0…N-G11`
**12/12 PASS**, `errors=0`; `tests/test-nature01.mjs` **31/31**;
`tests/test-u05.mjs` **272/0**; `tsc` sạch; p50/p95 = 16,7–16,8 ms ON và OFF
(ratio 1,00), nature chunk ≤36, không cấp phát 11,2 triệu ô.
`N-G9`: 12 tile authority (gồm Beacon) + cấu hình despeckle giống hệt,
ô cô lập đã vẽ vẫn 0.

**Bàn giao:** xin Creator **visual acceptance cho 5 mẫu** (có/không + ghi chú
mật độ, màu sprite, clearing, mép nước, cụm đá, độ đọc đường). QA **không** phải
chấp nhận thị giác. **DỪNG** trước khi nhân rộng toàn thế giới, trước POI
architecture, trước production merge / PR44 / `main`, trước `VISUAL_ACCEPTED`,
`productionAtlas`, `VEYRA_PLAYABLE` và mọi claim tích hợp Gameplay đầy đủ.
`P5-G5/G6` vẫn **FAIL**, `P5-G7/G8` vẫn **PARTIAL**. Chi tiết:
`docs/NATURE01_PILOT.md`, `evidence/nature01-{build,qa,sites,assets}.json`.

**Lưu ý source custody:** trong lúc làm pilot, nhánh Gameplay live đã tiến thêm
1 commit `2f083658…` (*Implement provisional territory cabinet upkeep*) sau HEAD
`5b3e683…` mà Creator đã verify. `git diff … -- web/src/game/art.ts` chỉ đổi
`S.claim` (sprite công trình, **không dùng** trong NATURE-01); `buildSources()`
và 12 sprite thiên nhiên không đổi. Không re-vendor, không sync ngầm, không tạo
atlas mới; gói verification đứng ở `5b3e683…` được **giữ nguyên**, drift được
ghi rõ trong `evidence/source-custody.json → nature01Disclosure`.

---

## 14. NATURE-02 — FOREST QUALITY VERTICAL SLICE (MỘT biome, BA composition)

**Trạng thái:** pilot MỘT cửa sổ rừng ôn đới, có ảnh 640×360 thật, **CHƯA**
`VISUAL_ACCEPTED`, **CHƯA** duyệt production, **CHƯA** merge Gameplay,
**KHÔNG** `VEYRA_PLAYABLE`. Map HEAD bắt đầu: `b5dfafb278eb15333a66a4d3b24c23d4aa17c427`.

| File | Bytes | SHA-256 |
|---|---:|---|
| `SoulOfHero_TerrainOnly_U05_x10.html` (**giữ nguyên**) | 1.407.498 | `540f095e…` |
| `SoulOfHero_Nature01_U05.html` (**giữ nguyên**) | 1.427.241 | `ac4d54e3…` |
| `SoulOfHero_Nature02_ForestSlice.html` (**MỚI**) | 1.436.807 | `6e1e897a…` |

Build script **assert cả 2 SHA được bảo vệ** trước khi ghi. `N` tắt/bật lớp rừng;
khi **TẮT** canvas 640×360 1× giống hệt từng pixel baseline tại 4 vị trí. Chỉ
**MỘT** cửa sổ `[1392,1288,1488,1352)` (96×64 tile) có vật thể; 4 cửa sổ
NATURE-01 kia và toàn bộ phần còn lại của khung **0 vật thể**. Không đụng GOLD,
raster WMP-04R1, đường, sông, `sourceTile`, despeckle hay `canStand()`.

**Ba composition độc lập:** `dense_interior [1416,1320]`, `clearing [1408,1332]`,
`road_forest_edge [1452,1316]`. 13 **stand** (loài quyết theo cụm), 3
**clearing**, 3 **route** chỉ là hành lang KHÔNG vật thể (không vẽ path, không sửa
GOLD, không cấp quyền navigation). Đệm đường **3 tile**, đệm nước 2 tile.
`auditForest()`: 1.350 vật thể, `stabilityHash=5dccf0df`, **0 vi phạm**, open
ground 0,6137 / 0,7035 / 0,6846 → vẫn giữ khoảng trống tự nhiên.

**Sửa lỗi rải đều, đo được:** cùng cửa sổ 96×64, cụm cây lớn nhất (8-connected)
NATURE-01 = **3 tile**, NATURE-02 = **178 tile**; tree tile 207 → 839. Cánh rừng
giờ là một khối gắn kết, không phải cây lẻ cách đều. **51.424 pixel đường/bridge**
có cùng hash `9242f6ad` khi BẬT và TẮT → đường GOLD không bị che.

**Audit art THẬT (không phóng to):** hero 16×24 (alpha bbox 12×23); oak/pine/
willow/dead 24×32; rock/grass 16×16. Tỷ lệ cây/hero = **1,333** chiều cao,
**1,500** chiều rộng. 22 mảng `getArt().src`, đo 12, dùng 6, loại 16.
`newArtAssets=0`, `spriteScaling=false`. Bảng audit 640×360 ở phím `M`
(2× chỉ để soi, KHÔNG có trong game). **Kết luận trung thực:** tán cây CHỈ cao
hơn hero 8 px → **không thể có overhead canopy**; chỉ một tầng tán, không
mid-storey, không undergrowth phi-thu-hoạch. Đây là sửa **composition**, không
phải sửa **asset**.

**XUNG ĐỘT NGỮ NGHĨA — CHƯA GIẢI QUYẾT, CHẶN PRODUCTION:** `catalog.ts:143,149,156`
(`SOURCES.oak/rock/grass` có `stock/yields/block:true`), `render.ts:212,215`
(`r.natureTrees` vẽ **cùng** `A.src.oak`), `sim.ts:199` (rơi gỗ), `engine.ts:189`
(va chạm class 2), `engine.ts:156` (`sourceAt()` sở hữu stock/hp/regrow). Vật thể
NATURE-02 **chỉ trang trí**: không tương tác/va chạm/thưởng/stock/cạn kiệt/sở hữu,
không chiếm `sourceTile`. Nhưng **hai cây trông giống hệt nhau với tương tác trái
ngược không được duyệt production** → `pilotStatus=NOT_APPROVED_FOR_PRODUCTION`.
Map **không** bịa reward, collision hay source ownership; quyết định thuộc
**Gameplay owner** (`arena/d4bfcfff-soul-of-hero`, HEAD verify `5b3e683…`, quan
sát sau `2f083658…`). Đề xuất `N02-ASSET-GAP-01`
(`forest_canopy_oak` 24×40 / `forest_fern` 16×16 / `forest_snag` 24×32) là
**PROPOSED__NOT_CREATED__NOT_APPROVED** — không tạo asset thay thế.

**Bằng chứng:** `evidence/nature02-shots/` **44 ảnh 640×360 thật** — 4 cặp
OFF/ON, 4 bộ so sánh baseline / NATURE-01 / NATURE-02 **cùng toạ độ** (thêm tile
site-01 `[1472,1336]`), 3 ảnh full-viewport Chromium, 12 ảnh đi phím thật
(`D→S→A→W`, 1.152 / 1.188 / 1.224 px, 4 keydown + 4 keyup mỗi composition), 1
bảng audit art. `tests/qa-nature02.mjs` **15/15 PASS, errors=0**;
`tests/test-nature02.mjs` **54/54**; `test-nature01.mjs` 31/31; `test-u05.mjs`
272/0; `tsc` sạch; preview **6/6 route** gồm `/nature02` +
`/nature02-download` (4 route cũ không đổi). p50/p95 16,7–16,8 ms ON=OFF.

**ĐÁNH GIÁ THỊ GIÁC RIÊNG BIỆT** (`evidence/nature02-visual-review.json`, 5 trục
tách khỏi gate tự động): Silhouette `PARTIAL__CANOPY_STILL_MISSING`, Ecological
`PARTIAL_PASS`, Navigation `PASS_FOR_PILOT__LIMITED`, Sprite scale
`PASS_NO_ENLARGEMENT__FAIL_AS_SURVIVAL_FOREST_SCALE`, Semantic
`FAIL_FOR_PRODUCTION`. **12 objective failures** `N02-F1…F12` (tán cây, xung
đột sprite, lặp silhouette, undergrowth thu hoạch được, route vô hình, nền không
đổi, mép đường GOLD bậc thang, shadow render-effect, không animation/LOD, chỉ
review 640×360, walk không chứng minh survival, cố ý không nhân rộng world).

**BÀN GIAO / DỪNG:** xin Creator duyệt hay từ chối (1) hướng stand/clearing/edge
ở 1×, (2) quy ước route âm-không-gian, (3) Gameplay owner phân định cây thu hoạch
vs cây trang trí, (4) có đặt `N02-ASSET-GAP-01` hay không. **DỪNG** trước khi mở
biome khác, nhân rộng world, thêm công trình/POI/tàn tích/hàng rào/prop, merge
Gameplay/PR44/main, `VISUAL_ACCEPTED`, `productionAtlas`,
`VEYRA_PLAYABLE`. QA **không** phải chấp nhận thị giác. Chi tiết:
`docs/NATURE02_FOREST_SLICE.md`.
