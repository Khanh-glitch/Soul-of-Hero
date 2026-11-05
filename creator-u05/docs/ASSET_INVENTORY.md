# U=0.5 — Asset Inventory (không atlas mới)

Nguồn số liệu máy đọc được: `creator-u05/evidence/asset-inventory.json`
(tạo lại bằng `node creator-u05/tools/build-asset-inventory-u05.mjs`).

## Chính sách

`REUSE_EXISTING_SOH_GAME_ART_RENDERER_AND_SPRITES_FIRST` ·
`productionAtlas=NOT_AUTHORIZED` · `creatorVisualApproval=NOT_REQUESTED`.
U05 là lớp **additive physical POI proof**, không phải đợt art production.

## Kết quả

| Mục | Giá trị |
|---|---|
| PNG art mới trong `web-u05/src/` | **0** |
| Atlas mới | **0** (`noNewAtlas=true`) |
| Sprite cấu trúc có sẵn trong live `art.ts buildStructs()` | **68** |
| Sprite thực sự dùng trong 6 cảnh | **12** |
| Sprite dùng mà không tồn tại trong nguồn | **0** |
| Hero | `buildHero()` **16×24 px**, `stretched=false`, 1× |
| Raster WMP-04R1 | **21** (analysis data, 8 AU + dither 1 AU của LW-01) |
| File Gameplay live vendored verbatim | **231 / 2,535,968 bytes**, `verbatimMismatches=0` |
| Ảnh evidence P4 | **48 PNG / 6,724,090 bytes** (evidence, KHÔNG phải game art) |
| File runtime additive | **9** (`u05.html`, `tsconfig.u05.json`, 7 module TS + generated scenes) |

### 12 sprite được reuse
`barrel`, `floor_stone`, `floor_wood`, `poi_door`, `poi_door_open`,
`roof_thatch`, `roof_tile`, `roof_tin`, `roof_wood`,
`wall_brick`, `wall_stone`, `wall_wood`.

Tất cả lấy từ `b5c8004ca4e77be62484fb3cd296fe296d7de4c9:web/src/game/art.ts`.
`art.ts` **byte-identical** giữa pin và live head `291fee6f`.

### Cố ý KHÔNG dùng làm vật thay thế
`wreck`, `roof_hull`, `cart`, `cargo` tồn tại trong `art.ts` nhưng **không** được dùng để
giả làm helicopter / car wreck / ship hull. Beacon helicopter `PROVEN_MISSING`;
U05 chỉ vẽ **nét đứt reservation helipad** (không sprite, không entity, không relocation).

### Terrain painter
`render.ts` block PAL/PRIO/texel `sha256=f29c1a68803505c2dbf82aaae3ed37ab7240cb71dff47937f964e753c8d0f803`,
byte-identical với block LW-01 `e11a9b44` (đây là lý do đường Beacon U=0.5 tái tạo đúng).
Module sinh `src/u05/terrain.ts` có **7 substitution** được liệt kê trong header;
không đổi palette, road edge rule, kích thước pixel hay material language.

### Benchmark khoá
`large-world-01/evidence/shots/beacon_beacon_u05.png` — **VISUAL PRESERVATION REFERENCE ONLY**.
Không reauthor / redraw / widen / recolour. `U05_BENCHMARK.json` ghi `physicalLayer=OFF`,
`status=LOCKED_VISUAL_PRESERVATION_REFERENCE__NOT_VISUAL_ACCEPTANCE__NOT_REAUTHORIZATION`.

## Không phải asset
door lock/key state · power/HP · loot/ownership/cash · boss/reward ·
marine/boat/ferry permission · helicopter entity. Các socket này thuộc `GAMEPLAY_SOCKETS`,
vẫn `UNRESOLVED`.
