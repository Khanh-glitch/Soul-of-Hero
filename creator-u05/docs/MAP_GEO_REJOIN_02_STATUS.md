# MAP-GEO-REJOIN-02 — Correct Real Bridge & Cliff Projection (KHÔNG tạo địa lý mới)

> **Tiếp tục MAP-GEO-REJOIN-01, không tạo world / geography viewer / POI audition /
> nature system / product roadmap mới.** Hai defect do Map đo được đã được sửa trong
> một bản **QA verification executable** tách biệt, dùng **đúng** renderer SOH `U=0.5`.
> Quyền đi lại / xe / tải trọng / va chạm vẫn thuộc **Gameplay `WorldTraversal`**.
> Active authority: `WMP-04R1` / `v4/r1/manifest.r1.json` / `CREATOR_CHOSEN_U05.v1`.
> Ngày 2026-11-05. Bằng chứng máy đọc được tại `creator-u05/evidence/mapgeo02-*.json`.

---

## 1. Ref sống đã verify trước khi làm việc

| Mục | Giá trị |
|---|---|
| Map branch / HEAD local + remote | `arena/2e3cfbd2-soul-of-hero` @ `3e02fde05a24f6d645ea00ed5ab78900655e1272` (MAP-GEO-01 delivery) |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` |
| Gameplay HEAD **được pin trong yêu cầu** | `6e7d116b4400ea3c24373fe884b7fad258f4f7bc` |
| Gameplay / PR44 **HEAD sống hiện tại** | `c2418b5405ff3325e0ac4806a5309785e816b093` — PR44 **OPEN**, **không** edit/merge/close |
| Drift Gameplay trong lúc làm task | **CÓ** (`6e7d116b…` → `c2418b54…`, motorbike/loot/respawn); báo cả hai SHA |
| Creator-verified / U05 pin | `5b3e683402bbc8540dea9404576164097e753f97` / `b5c8004ca4e77be62484fb3cd296fe296d7de4c9` |
| GOLD | `88780f78b9e80278792c85c5fba7b09b43a5d22b891fb5fc4bb47245b1a3a256` — **không đổi** |
| Terrain painter block | `f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803` — **byte-identical ở 4 head**; `art.ts` sống vẫn có `S.claim`, **không re-vendor** |
| 3 executable bảo vệ | `540f095e…` / `ac4d54e3…` / `6e1e897a…` — **đều không đổi** (verify ở preflight, build, QA) |
| QA executable **mới, có nhãn riêng** | `creator-u05/SoulOfHero_MapGeo02_CorrectedProjection.html` — 1,421,388 B, SHA `41b2203bbbab47c0f4f215461e9e7571c2d1a46b0d982a7a2fbf177bbcac2339` |

Bản QA **không phải sản phẩm / world mới**: cùng `terrain.ts`, cùng 21 raster, cùng
`640×360` `1×`, hero `16×24`, `U=0.5`, `TILE=16`, frame `4000×2800`. Chỉ module
`world` được thay bằng overlay `src/mapgeo02/corrected-world.ts` (re-export base
world + override `u05Tile` / `u05TileRaw` / `terrainBlocked`). Không art/atlas mới.

## 2. Hai discrepancy đã sửa

### `MGP-D01` — 12/12 tâm cầu bị chặn, 0 crossing được

MAP-GEO-01 đo: tại `br_1` có **888** tile `T.BRIDGE` **trên đất** (thảm gỗ) và
**0** tile `T.BRIDGE` **trên nước** (khoảng trống); `lake||river` thắng bridge
rendering. Nguyên nhân: `lw/geometry.ts` dùng node circle bán kính **12 AU** làm
footprint cầu, trái với `REAL_MAP_CONVERSION_CONTRACT.md` (cần span/bearing/load
thật, **không stamp tuỳ tiện**).

Sửa: deck **có giới hạn**, suy từ chính GOLD `bridges[].id/at/ang/load`, mã
`crossingCandidate.u8` (`1=foot`, `2=cart`, `3=ford`), **hai bờ sông đo được**,
đường/footpath tiếp cận hai bên, hướng `ang`, seams và tính liên tục 4-kết-nối.
Bề rộng deck = **3.0 AU** (độ rộng centreline đường GOLD), **không** phải bán kính
marker 12 AU. `T.BRIDGE` **chỉ** đặt trên tile nước nằm trong hình chữ nhật đã đo.

Kết quả runtime: **596** deck tile, **596 trên nước / 0 trên đất**; tại `br_1`
thảm gỗ 888 → deck 46 tile. `br_3`: 0 → 83 deck tile, số tile `T.ROAD` **không đổi**
(307 → 307). **10/12** cầu có deck CANDIDATE, **2/12** để nguyên chưa giải quyết —
**không ép 12 PASS**, không stamp cho ID chưa rõ.

### `MGP-D10` — 305 cliff candidate, 0 vách vật lý

`cliffCandidate.v3.u8` là raster **nhị phân 0/1** (305 cell mã `1`, 43,445 cell mã
`0`, max code = **1**), trạng thái `PROPOSED`, **không có** luật mét/độ/leo/va chạm.
Consumer U05 dùng `cliff >= 2 && heightClass >= 2` nên không bao giờ khớp.

Sửa: predicate `cliffCandidate >= 1` cộng kiểm chứng độc lập
`heightClass>=4` (305/305), `slope>=20` (305/305), `slopeClass>=3` (305/305),
độ dốc xuống 4-hàng-xóm `>=12` (305/305) từ `elevation.u8`. Hiển thị **dải mặt
dốc mỏng 2–4/16 tile** ở cạnh đổ dốc của mỗi cell, dùng chính art `T.CLIFF` với
`hash2` jitter + ~6% lỗ hổng + răng đá thưa → vách đá gãy, **không** phải tấm xám
phẳng / thanh grid. Phần trong cell giữ nguyên biome/đồi. Không repaint đường.

Kết quả: 187 tile `T.CLIFF` trong cửa sổ cao địa `T4` (bản cũ **0**), tối đa
50/256 tile trong một cell 16×16 → **0 slab đầy**. `productionCollisionCells = 0`
(vách **không** phải tường chặn vĩnh viễn); QA candidate collision tách biệt có
187 blocker trong cùng cửa sổ. `activeCollisionPermission.v3.u8` = **0** cell ≠ 0.

## 3. Bảng 12 cầu (đầy đủ ID, outcome)

| ID | load/code | kênh | span / ⟂ span (AU) | footprint (AU) | deck tile | outcome |
|---|---|---|---|---|---|---|
| `br_0` | cart/2 | RIVER | 5 / 7.5 | 5.5 × 3.0 | 53 | CANDIDATE DECK |
| `br_1` | cart/2 | RIVER | 4 / 7 | 4.5 × 3.0 | 46 | CANDIDATE DECK |
| `br_2` | cart/2 | RIVER | 7 / 15.5 | 7.5 × 3.0 | 77 | CANDIDATE DECK |
| `br_3` | cart/2 | RIVER | 7 / 24.5 | 7.5 × 3.0 | 83 | CANDIDATE DECK |
| `br_4` | cart/2 | RIVER | 4 / 13 | 4.5 × 3.0 | 46 | CANDIDATE DECK |
| `br_5` | cart/2 | RIVER | 7 / 47.5 | 7.5 × 3.0 | 84 | CANDIDATE DECK |
| `br_6` | foot/1 | RIVER | 4 / 20.5 | 4.5 × 3.0 | 49 | CANDIDATE DECK |
| `br_7` | cart/2 | RIVER | 2 / 20.5 | 2.5 × 3.0 | 28 | CANDIDATE DECK |
| `br_8` | foot/1 | RIVER | 6 / 27 | 6.5 × 3.0 | 75 | CANDIDATE DECK |
| `br_9` | foot/1 | RIVER | 6.5 / 5 | 7 × 3.0 | **0** | **UNRESOLVED** — hai trục crossing đều bị chặn; cần Creator/Gameplay chọn bearing |
| `br_a` | foot/1 | RIVER | 5 / 7 | 5.5 × 3.0 | 55 | CANDIDATE DECK |
| `br_b` | foot/1 | RIVER | 32 / 37.5 | 32.5 × 3.0 | **0** | **UNRESOLVED** — không có bờ thứ hai, water run unbounded 30 AU, vượt guard, thiếu đường tiếp cận, seams đứt |

Mỗi CANDIDATE đã đo: cả hai bờ là đất khô, road/footpath approach hai bên,
span bị chặn (≤16 AU), hướng theo `ang` tác giả, deck 4-kết-nối, span coverage
≥0.90, seams chạm đất hai đầu, đủ source evidence. `br_9`/`br_b` có tile **đo**
nhưng **không render** — không tự ý chọn phương án thay chủ sở hữu.

## 4. Phân loại 31 đường bị nước override

| Nhóm | Số | ID / ghi chú |
|---|---|---|
| `FERRY_NAVIGATION_REFERENCE` | **8** | `rd_2c rd_2d rd_2e rd_2f rd_2g rd_2h rd_2i rd_2j` — `waterTraversalClass=2`, `foot=false`, `boat/swim/ferryFoot=false`, tile hiển thị là **nước**, **không** biến thành đường khô |
| `AUTHORED_BRIDGE` | **9** | có cell `BRIDGE_DECK_PROPOSAL` WMP-03; cell `FORD_PROPOSAL` đi kèm chỉ ghi nhận, không thăng cấp |
| `UNBRIDGED_LAND_ROAD_CROSSING` | **8** | `FORD_PROPOSAL` / `crossingCandidate=3`, depth & flow **UNKNOWN**; không bịa cầu |
| `AMBIGUOUS_OWNER_REVIEW` | **6** | `rd_a rd_1g rd_22 rd_23 rd_26 rd_28` — override đo ở 0.5 AU nhưng **không** có classification WMP-03 ở 8 AU; báo đúng ID, không đoán geometry |

Đường Beacon được Creator chấp thuận: **0 tile code đổi** (340 `T.ROAD` ở cả bản
cũ và bản sửa), không nới rộng / đổi màu / vẽ lại. T1/T2/T4/T5/T6 ở **đúng toạ
độ** MAP-GEO-01 cũng có **0 tile code đổi**; chỉ `T3` đổi 702 tile (656 thảm gỗ
→ 46 deck trên nước).

## 5. Ảnh runtime thật + đi phím thật

* **17** lượt đi bằng **WASD / mũi tên thật**, `NATURAL_TERRAIN_ONLY` collision ON,
  x10 viewer speed; `reset(tx,ty)` **1 lần** mỗi lượt làm spawn control, **không**
  phải route/teleport. **52** ảnh PNG **native 640×360** lấy bằng
  `document.getElementById('game').toDataURL('image/png')`. **0** lỗi browser.
* Sáu lượt MAP-GEO-01 được lặp lại **đúng toạ độ + đúng legs**, kèm ảnh tĩnh tại
  đúng `endTile` cũ và so sánh tile-code từng ô (pixel diff thô còn lẫn offset
  camera nhỏ giữa hai lần chạy độc lập).
* Production `br_2`: **78 blocked substeps / 3.38 tile** → crossing **vẫn bị chặn**
  (không lén cấp quyền). QA `br_2`: **0 blocked / 28.5 tile** qua hai bờ.
  QA `br_7`: 24 tile bằng `d` / `d+s`. QA `br_1`: hero đứng trên deck `br_1`.
  `br_b`: **0 deck art**, di chuyển bị chặn.
* Cao địa `T4` production: **0 blocked** (không có tường vách). QA candidate
  collision: **98 blocked**; đường thay thế bằng phím thật đi **1572 px / 0 blocked**.
* Kiểm chứng thêm: nearby chunks có giới hạn (`materializedAllCells=false`),
  deterministic khi reload, source id từng deck tile, toạ độ save-compatible
  (`U=0.5`, `TILE=16`, frame `4000×2800`, GOLD `at` không đổi),
  **0 rò rỉ quyền trên 10,086 tile** (`activeCollisionPermission`, `foot` trên nước,
  `boat/swim/ferryFoot/build` đều `false`, deck production vẫn blocked,
  cliff production không blocked).
* **28/28** runtime check PASS; **125/125** static test PASS; `tsc --noEmit` sạch;
  MAP-GEO-01 **130/130** vẫn PASS (chỉ cập nhật tối thiểu assertion `S07` để
  whitelist đúng một file QA executable có nhãn riêng; mọi gate khác giữ nguyên).

Ảnh QA **không** phải visual acceptance hay production acceptance.

## 6. Ranh giới quyền (không vượt)

| Map (đã làm) | Gameplay `WorldTraversal` (chưa làm, cần quyết định) |
|---|---|
| deck geometry, continuity, seams, banks, orientation, source ID, hiển thị vách, QA candidate crossing/collision tách biệt | đi bộ, xe/cart, bearing/load, clearance, va chạm production, luật leo vách, ferry/boat/swim, `activeCollisionPermission` |

Hai mode luôn **tên riêng, tách biệt**: mặc định `PRODUCTION_NO_PERMISSION`
(deck **vẫn chặn**, vách **không** phải tường); `QA_CANDIDATE_CROSSING` chỉ để
**đo geometry** bằng phím thật, **không bao giờ** tự động cấp quyền production.
`sampleTile().permissions` giữ nguyên; `activeCollisionPermission.v3.u8` = 0.

## 7. Các việc còn cần quyết định bên ngoài (ID chính xác)

* `br_9` — bearing: hai trục crossing đều bounded → **Creator / Gameplay**.
* `br_b` — thiếu bờ thứ hai / cửa sông → **Creator / Gameplay**.
* `rd_a rd_1g rd_22 rd_23 rd_26 rd_28` — 6 giao cắt nước ambiguous → **owner review**.
* 8 ferry route, 19 ford proposal, 26 thiếu entrance vẫn như MAP-GEO-01 (MGP-D02/03/04),
  dock boarding / Beacon helicopter / marine permission / `po_timberyard` **không** thuộc task này.

Chi tiết intake: `creator-u05/docs/MAPGEO02_GAMEPLAY_HANDOFF.md` §8 và
`creator-u05/evidence/mapgeo02-gameplay-handoff.json :: worldTraversalIntake`.

## 8. Acceptance

`PAPER=MEASURED` · `RUNTIME=ISOLATED_VIEWER_PHYSICAL_VERIFIED_QA_ONLY` ·
`VISUAL=NOT_REQUESTED_AND_NOT_GRANTED` · `GAMEPLAY=NOT_REQUESTED_AND_NOT_GRANTED`.

**Không** có `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED`, `MERGE_READY`, production merge,
PR44 edit/merge, GOLD amendment, atlas/art mới, chấp nhận visual toàn thế giới hay
tích hợp Gameplay toàn phần. PAPER / RUNTIME / VISUAL / GAMEPLAY tách riêng.
NATURE-01/02 vẫn là R&D lưu trữ, không phải production resource placement.

## 9. File bằng chứng

| File | Nội dung |
|---|---|
| `creator-u05/evidence/mapgeo02-preflight.json` | Ref sống, drift PR44, painter 4 head, 3 baseline |
| `creator-u05/evidence/mapgeo02-build.json` | Build deterministic, source SHA, 12 identity, self-contained |
| `creator-u05/evidence/mapgeo02-bridge-geometry.json` | 12 cầu đo đầy đủ + cliff stats |
| `creator-u05/evidence/mapgeo02-road-water-classification.json` | 31 route / 4 nhóm / 8 ferry / 6 ambiguous |
| `creator-u05/evidence/mapgeo02-traversal.json` | 17 lượt phím thật, 28 check, 52 ảnh, 0 leak |
| `creator-u05/evidence/mapgeo02-shots/*.png` | 52 ảnh native 640×360 |
| `creator-u05/evidence/mapgeo02-gameplay-handoff.json`, `creator-u05/docs/MAPGEO02_GAMEPLAY_HANDOFF.md` | Bàn giao Gameplay |
| `creator-u05/build-mapgeo02.mjs`, `vite.mapgeo02.config.mjs`, `web-u05/src/mapgeo02/*` | Nguồn build + overlay (additive) |
| `tools/preflight-mapgeo02.mjs`, `tools/classify-mapgeo02-crossings.mjs`, `tools/build-mapgeo02-handoff.mjs` | Tool chỉ-đọc / phân loại / bàn giao |
| `creator-u05/tests/qa-mapgeo02-traversal.mjs`, `creator-u05/tests/test-mapgeo02.mjs` | QA browser + 125 static test |
