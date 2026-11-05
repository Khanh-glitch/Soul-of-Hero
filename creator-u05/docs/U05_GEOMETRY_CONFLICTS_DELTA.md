# U=0.5 — Báo cáo xung đột hình học & delta (Geometry Conflicts / Delta Report)

> Phạm vi: **P1–P5 additive physical POI program** trên nhánh Arena `arena/2e3cfbd2-soul-of-hero`.
> Tài liệu này KHÔNG phải là chấp nhận Gameplay runtime, KHÔNG phải chấp nhận thị giác,
> KHÔNG phải `VEYRA_PLAYABLE`, `MERGE_READY`, `WORLD_MASTER_SEALED`.
> Creator chỉ **khoá ý định tỉ lệ U=0.5**; `visualAcceptance = NOT_REQUESTED_AND_NOT_GRANTED`.

---

## 1. Chuỗi thẩm quyền đã dùng (không tự ý thay thế)

| Tầng | Nguồn | Vai trò |
|---|---|---|
| Active pointer | `veyra-world-master/CURRENT_WORLD_MASTER.json` | `activeRevision=WMP-04R1`, `MAP_GEO_R1_CORRECTED__GAMEPLAY_INTAKE_PENDING`, `productionAtlas=NOT_AUTHORIZED`, `creatorVisualApproval=NOT_REQUESTED` |
| GOLD canon | `veyra-world-master/data/canon/VEYRA_GOLD_MAP.sohmap.json` (332,249 bytes, byte-identical với bản copy trong LW-01) | 8 land / 5 lakes / 17 rivers / **92 roads** / 12 bridges / 27 docks / **81 POIs** / 23 zones / 280 resources / 4 spawns / 6 elders |
| Kiến trúc | `veyra-world-master/layers/architecture.v1.json` | 81 POI, 210 rooms, 153 covered rooms, 153 roof polygons, 43 open-air POIs, 18 vertical links (10 proposed / 8 named blockers) |
| Raster phân tích | `v4/r1/manifest.r1.json`, `v4/r1/data/*.u8`, `v4/data/marineRegion.v4.u8`, `data/rasters/geo01/*.u8` | 21 raster, `CELL_AU=8`, lưới 250×175, khung 2000×1400 AU |
| Luật | `/tmp/u05_bible.md` (§11.3 C07/C11/C24, §11.5) | Chỉ dẫn bằng chứng; Map Lead **không** chọn giá / quest / luật Gameplay |
| Gameplay nguồn (đã pin & kiểm chứng) | `b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web` | 934 files / 87,954,910 blob bytes; U05 vendored **231 files / 2,535,968 bytes**, `verbatimMismatches=0` |
| Gameplay head lúc xác minh | `arena/d4bfcfff-soul-of-hero` = `291fee6fde9aaa0dec256c93f0c185493309dd44` (PR44 OPEN/DRAFT) | 6 commit mới sau pin; xem §7 |
| Benchmark thị giác | `large-world-01/evidence/shots/beacon_beacon_u05.png` | **CHỈ** tham chiếu bảo tồn đường Beacon; không reauthor / redraw / widen / recolour |

`source-custody.json` ghi rõ `ARENA_BRANCH_PINNED__NO_ISOLATED_BRANCH_CREATED`: Arena cố định nhánh làm việc,
nên U05 **không** tạo nhánh riêng; sự cô lập được thực hiện bằng thư mục/app `creator-u05/` + `web-u05/u05.html`.

---

## 2. Delta so với từng tầng (chính xác, không phóng đại)

| Đối tượng | WMP-04R1 / GOLD / v3 | LW-01 | U=0.5 (bản này) | Thay đổi |
|---|---|---|---|---|
| Tỉ lệ | chưa có U runtime được duyệt; `api/current.mjs` 8 AU/cell | pilot `beacon-u05` 4000×2800 | **U=0.5 AU/tile** = 2 tile/AU = 32 px/AU, 4000×2800 tile = 11,200,000 ô địa chỉ | Chỉ là **ý định tỉ lệ**; chưa tích hợp runtime sản xuất |
| Camera / hero | 640×360, hero 16×24, 72 px/s | giữ nguyên | giữ nguyên, `dpr=1`, `zoom=1`, `cameraTrick=false` | **0** |
| Đường Beacon | GOLD `rd_27` 3.0 AU half-width | tái tạo U=0.5 | giữ nguyên centreline / palette / edge rule; render block `sha256=f29c1a68…` byte-identical | **0** (không nới / tô lại / vẽ lại) |
| `poi.foot` | site envelope, KHÔNG phải toà nhà | giữ nguyên | giữ nguyên đa giác full-precision, `noPolygonAmendment=true`, `noShrinkRelocateExpand=true` | **0** |
| Islands / coastline / lakes / rivers / docks / POI anchors / resource authoring | GOLD | giữ nguyên | giữ nguyên (`U05_AUDIT.json.noChanges` toàn số 0) | **0** |
| Room/roof descriptor | `architecture.v1` | không có | giữ **verbatim** trong `sourceRoomPolygonTiles` / `sourceRoof`; chỉ THÊM `footprintTiles` inset + `roofMode` đề xuất | additive proposal |
| Sprite / atlas | `buildStructs()` 68 sprite | reuse | reuse **12** sprite có sẵn, **0 PNG mới**, `noNewAtlas=true` | **0** atlas mới |
| Chunk identity | legacy `cy*100+cx` (200×200) | `large-world` key | `creator-u05\|cx:cy`, 125×88 = **11,000** chunks, `legacyKeyCollisions=2175` chỉ để đối chiếu | không dùng legacy key |
| Bộ nhớ | — | LRU ≤36 | LRU ≤36 geometry chunks + ≤36 display canvases, `materializedAllCells=false` | không cấp phát 11.2M ô |

### 2.1 Delta runtime trong `web-u05/` (9 file additive)
`u05.html`, `tsconfig.u05.json`, `src/u05/{contract,world,display,physical,game,main,scenes.generated,terrain}.ts` +
`src/u05/lw/*`. Không sửa `src/game/*` (231 file verbatim từ live head). `terrain.ts` là extract
byte-identical của block PAL/PRIO/texel với **7 substitution** được ghi rõ trong header.

---

## 3. Xung đột hình học đo được — `map-data/U05_GEOMETRY_CONFLICTS.json`

**62 items**, mỗi item có `measureAu2` / `measureTile2`, `status`, `owner`, `resolution`.

| Loại | Số lượng | Owner | Xử lý |
|---|---:|---|---|
| `MISSING_EXTERIOR_ENTRANCE_RECORD` | 26 | `MAP_U05 / GAMEPLAY A8` | `NONE_APPLIED` — 26/81 POI không có `EXTERIOR_ENTRANCE`; KHÔNG tự bịa cửa |
| `BUILDABLE_SITE_OVERLAPS_POI_OR_ELDER` | 19 | `MAP_U05 / GAMEPLAY` | `UNRESOLVED__LEGAL_PLACEMENT_GAMEPLAY_ONLY` |
| `POI_ENVELOPE_OVERLAP` | 11 | `MAP_U05 / CREATOR` | `HOST_SUBSITE_OR_INTENTIONAL__UNRESOLVED` |
| `HELICOPTER_VS_LIGHTHOUSE` | 1 | `CREATOR / GAMEPLAY A8` | `UNRESOLVED__HELIPAD_COLLISION_PLAN_ONLY__NO_RELOCATION__NO_SUBSTITUTE` |
| `ROAD_CENTRELINE_ENTERS_POI_ENVELOPE` | 1 | `GAMEPLAY / CREATOR` | `NO_ROAD_CHANGE` — connector schematic, không phải entrance được author |
| `VERTICAL_LINK_NAMED_BLOCKERS` / `POI_RETREAT_POLYLINE` / `CART_SWEPT_CLEARANCE` / `MARINE_FOOT_PERMISSION` | 4 | Gameplay | unresolved, không tạo luật |

```json
{ "amendedPolygons": [], "relocatedObjects": [], "expandedEnvelopes": [],
  "recolouredRoads": [], "widenedRoads": [] }
```

### 3.1 11 cặp envelope chồng nhau (Sutherland–Hodgman đã hiệu chỉnh)
`po_archive/po_hall_eyes 560.0523`, `po_gulfhead/po_vend_gulf 156.6744`,
`po_strait/po_vend_strait 136.8639`, `po_gullnest/po_gullwreck 115.2011`,
`po_kestrel/po_rc_kestrel 102.5458`, `po_saltharbor/po_rc_salt 102.3998`,
`po_southfoot/po_evac_south 50.665`, `po_ironvein/po_rc_ironvein 37.644`,
`po_sandgate/po_rc_sandgate 96.466`, `po_westmouth/po_evac_west 7.549`,
`po_meridian/po_rc_meridian 0.956` (AU²). **Không** tự thu nhỏ / dời / mở rộng.

> Dead-end đã loại: clip sai cạnh cho 86 cặp giả; đảo dấu inside cho 0 cặp.
> Công thức đúng: `f(p)=cross(e,p−a)>=0`, sanity area = 1.0.

### 3.2 Road × POI
122 cặp `road×poi.foot`, 148 segment hits, **73 POI** bị centreline cắt, **78 road**,
61 tâm POI cách centreline ≤ 1 AU, 116 boundary crossing / 73 POI / 72 road.
Con số cũ **73** là *số POI phân biệt*, không phải số cặp; đã ghi rõ trong
`U05_AUDIT.json.roadCentrelineCrossings.verdict`. Không thay đổi centrelines.

### 3.3 Reconciliation 19/23 ↔ v3 S-03 18/23 (QUAN TRỌNG)
- v3 `STRUCTURAL S-03` = **18/23** theo rubric **ô surveyed 8 AU**.
- U05 đo lại ở **1 AU** (tâm tile U=0.5) → **19/23**.
- `U05_AUDIT.json.buildableSiteOverlap.correction` ghi `formerSiteIds` (18 ID v3),
  `extraZoneIds:["bz_verdant"]`, `hosts:["po_timberyard"]`, `overlapCells1Au=30`.
- **Không** khẳng định biên zone canon đổi; `legalPlacement` vẫn `UNKNOWN / GAMEPLAY`.

### 3.4 Diện tích `poi.foot`
min / median / max = **176.0 / 851.84 / 2034.56 AU²** → **704 / 3407.36 / 8138.24 tile²** ở U=0.5.
Đây là **site envelope**, không phải diện tích sàn sử dụng được; không dùng để kết luận
"physical readiness".

### 3.5 Helicopter Beacon — kiểm chứng lại trên live source
`git grep` trên `b5c8004c` (và `291fee6f`) cho thấy **chỉ** có metadata tĩnh
`poi_beacon_engine_out_helicopter` / `kind: stranded_helicopter` trong
`web/src/game/veyra/wmp04r1.generated.ts`; `art.ts` và `render.ts` **không** có sprite/entity
helicopter / helipad / chopper, cũng không có `car_wreck` / `ship_hull`.
→ `spriteEntityStatus = PROVEN_MISSING` là chính xác. `marine_sites.v4.json` chỉ là metadata,
không phải runtime object. U05 **chỉ vẽ nét đứt reservation helipad**, không thay thế bằng
`wreck`, `roof_hull`, `cart`, `cargo`. Khoảng cách lighthouse `[268,656]` ↔ helicopter `[272,652]`
= 5.6569 AU = 11.3137 tile; `NO_RELOCATION`.

---

## 4. Delta thiết kế 6 cảnh (before → after, có số đo)

Before = WMP-03 **PROPOSED full rooms**; After = U05 **PROPOSED inset footprints**.
Cả hai là trạng thái THIẾT KẾ, không phải sửa GOLD. `goldEnvelopeChanged=false`.

| Cảnh | Source room coverage | Proposed footprint | Drawn roof | Drawn | **Open space after** | Structures | Roofs | Solids | Doors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Beacon | 0.8190 | 0.0829 | 0.0406 | 0.0829 | **0.9171** | 1 | 1 | 7 | 2 |
| Greywater | 0.7363 | 0.2309 | 0.1131 | 0.2309 | **0.7691** | 6 | 6 | 15 | 8 |
| Academy | 0.7602 | 0.2737 | 0.3283 | 0.3283 | **0.6717** | 4 | 5 | 11 | 5 |
| Ironmine | 0.8409 | 0.2544 | 0.0572 | 0.0572 | **0.9428** | 2 | 1 | 7 | 2 |
| Westmouth | 0.8281 | 0.2597 | 0.1273 | 0.2597 | **0.7403** | 2 | 2 | 7 | 2 |
| Typhon | 0.9117 | 0.9117* | 0.0649 | 0.0649 | **0.9351** | 1 | 1 | 5 | 1 |

\* Typhon `inset=1.0` nhưng `floor='none'`: sàn arena là **OPEN TERRAIN**, chỉ roof deep-vault
reservation được vẽ. `drawn` vì thế 0.0649, không phải 0.9117.

**Override có ghi rõ `overrideNote` (không giấu):**
- Beacon: bỏ 1 trong 2 room thành sân đá mở (Creator yêu cầu open space / tối giản).
- Greywater: WMP-03 ghi 6 cell là *canopy-only open yard*, **KHÔNG phải phòng kín**; U05 **đề xuất**
  6 nhà ở kín có mái đầy đủ để đáp ứng yêu cầu "làng nhiều nhà". Trước/sau được đo.
- Academy: giữ enclosed rooms, chỉ inset.
- Ironmine: WMP-03 `covered=false` → **không vẽ** sàn/mái tầng mặt (open-air material handling);
  chỉ roof của deep vault là reservation.
- Westmouth: room 2 source không covered → U05 **đề xuất** thêm kho hàng kín thứ 2.
- Typhon: source có **0 static solids / 0 openings** (open-air arena). U05 **đề xuất** vành rào
  chu vi với 1 khe cửa thật để tầng `SOLID_COLLISION` có thể chứng minh bằng walk thật.
  Ghi rõ `PROPOSED_ARENA_PERIMETER_BARRIER__NOT_SOURCE_AUTHORED`, **KHÔNG phải GOLD canon**,
  **KHÔNG** tạo boss / reward / loot / ownership.

---

## 5. Tách tầng (không gộp)

`SITE_ENVELOPE` (GOLD, reprojected) → `BUILDING_COMPOSITION` (proposed footprint, nguồn room verbatim)
→ `DOORS_ROOMS` (static holes; `doorState='UNRESOLVED_GAMEPLAY'`) → `ROOF_OCCLUSION`
(roof hidden khi player đứng dưới, đo bằng `roofHiddenCount()`) → `SOLID_COLLISION`
(line-segment spans, cùng predicate với WASD thật) → `NAV_RETREAT` (BFS chọn đường + phím thật)
→ `GAMEPLAY_SOCKETS` (gate/power/locks/HP/ownership/loot/enemy = `GAMEPLAY`, chưa resolve).

Label overlay **không** được tính là walk test. Mọi walk trong P4 dùng
`page.keyboard.down/up` thật, 72 px/s, đối chiếu `player.tile` từng bước.

---

## 6. Bằng chứng P4 (xem `evidence/qa-report.json`)

6/6 cảnh: approach + reentry **arrived**, real keyboard events > 0; roof transition
`roofHiddenInside>0 → roofHiddenOutside=0`; wall collision `blocked=true`;
before/after **cùng camera** (`physical OFF → ON`); 48 PNG; **0** console/page/request errors;
`uniqueKeys=11000/11000`, `collisions=0`, `materializedAllCells=false`,
`residentChunks≤36`, `displayCanvases≤36`.

QA spawn fixture chỉ đặt player ở tile bắt đầu / tile probe tường, được ghi rõ
`spawnFixture.recorded=true`, `teleportUsedAsRoute=false`, `cameraUsedAsRoute=false`.
**Không** có pixel-diff so với benchmark (PIL/cv2/matplotlib không có trong sandbox;
benchmark có HUD, ảnh `physical=0` của audition không có HUD) → không khẳng định pixel equality.

---

## 7. Drift Gameplay / PR44 lúc xác minh

| | SHA |
|---|---|
| U05 pin (đã vendor, đã kiểm chứng) | `b5c8004ca4e77be62484fb3cd296fe296d7de4c9` |
| Live `arena/d4bfcfff-soul-of-hero` / PR44 head | `291fee6fde9aaa0dec256c93f0c185493309dd44` |
| PR44 base `arena/4795760e-soul-of-hero` | `8421b9c3335c7648488ce8ae5dab43eb5787977e` |
| Map Arena branch | `b12d05866366de0d50e4d305ff7b72fcf36b4921` (trước commit U05) |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` |

6 commit mới: `1b460360`, `dada8dc3`, `d6e2d462`, `00c86c38`, `ae268550`, `291fee6f`
(owner VFX, isolated VFX review build, Bible docs, persist tweak).
`render.ts` đổi **3 dòng** ở projectile/hazard VFX hooks — **ngoài** block PAL/PRIO/texel.
`art.ts`, `core.ts`, `veyra/wmp04r1.generated.ts` và terrain block **byte-identical**
(`u05RelevantBlocksIdentical=true`). U05 **không** re-vendor từ head cũ một cách im lặng và
**không** loại bỏ commit mới; drift được ghi vào `evidence/source-custody.json.verificationDrift`.
Owner VFX atlas mới bị loại khỏi U05 vendor vì `productionAtlas=NOT_AUTHORIZED`.

---

## 8. Còn PARTIAL / FAIL (không được nâng cấp)

`VEYRA_PLAYABLE` **BLOCKED**. Full Gameplay runtime integration `NOT_YET_VALIDATED`.
Chưa có: luật marine/boat/ferry/swim, helicopter entity, car wreck / ship hull thay thế,
production inventory/transactions/traces/monsters/ownership, harvest economy thật,
interaction range, gate/key/power/HP/loot/boss/reward, 81 POI art-complete/interactive,
full 4000×2800 streaming & sustained 60 FPS, traversal toàn thế giới, 4 spawn walk +
3 build position + 2 POI access/retreat + no-Elder cash trip theo §11.5,
`VISUAL_ACCEPTED`, `MERGE_READY`, `WORLD_MASTER_SEALED`.

Mọi cổng `P5-G*` không có bằng chứng runtime tương ứng đều giữ **PARTIAL / FAIL**
(xem `evidence/verification.json`).
