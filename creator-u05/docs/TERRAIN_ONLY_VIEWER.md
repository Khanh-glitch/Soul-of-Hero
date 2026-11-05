# TERRAIN-ONLY GAME — U=0.5, tốc độ tùy chỉnh đến x10

> Yêu cầu Creator: *"bỏ toàn bộ công trình và các lớp nổi, chỉ giữ phần nền của
> đường, sông, biome,... và đưa tôi file game để di chuyển trên map đó với tốc độ
> nhanh tùy chỉnh lên x10"* + *"thêm chức năng zoom map nhỏ nhất có thể để nhìn
> toàn cảnh map"*.

## File nhận được

**`creator-u05/SoulOfHero_TerrainOnly_U05_x10.html`** — **1 file HTML duy nhất**,
1.400.483 bytes, `sha256` trong `evidence/terrain-only-build.json`.

- Bấm đúp mở bằng trình duyệt (`file://`) — **không cần server, không cần mạng,
  không cần cài đặt, không nạp atlas mới**. Mọi module + 21 raster WMP-04R1
  (base64) đã được inline.
- Hoặc mở live preview: `http://<preview-host>:5182/terrain-only.html`.
- **Mở thẳng ở chế độ toàn cảnh**: thêm `?zoom=fit` vào URL (cả `file://` lẫn HTTP),
  ví dụ `https://5183-<sandboxId>.e2b.app/?zoom=fit`.
- **Tải thẳng (ép `Content-Disposition: attachment`)**: `http://<preview-host>:5183/download`
  (server `tools/serve-terrain-only.mjs`, bind `0.0.0.0:5183`); trên Arena preview là
  `https://5183-<sandboxId>.e2b.app/download`.
- **Link vĩnh viễn trên GitHub** (repo public, đã push):
  - HTML: `https://github.com/Khanh-glitch/Soul-of-Hero/raw/refs/heads/arena/2e3cfbd2-soul-of-hero/creator-u05/SoulOfHero_TerrainOnly_U05_x10.html`
  - ZIP mirror (115 KB, browser tự tải về, giải nén ra đúng HTML):
    `https://github.com/Khanh-glitch/Soul-of-Hero/raw/refs/heads/arena/2e3cfbd2-soul-of-hero/creator-u05/SoulOfHero_TerrainOnly_U05_x10.zip`
  - Blob + nút *Download raw file*: `https://github.com/Khanh-glitch/Soul-of-Hero/blob/arena/2e3cfbd2-soul-of-hero/creator-u05/SoulOfHero_TerrainOnly_U05_x10.html`
- Nguồn để sửa: `web-u05/terrain-only.html` + `web-u05/src/terrain-only/main.ts`;
  build lại bằng `node creator-u05/build-terrain-only-game.mjs`.

## Những gì CÒN trên canvas

| Giữ |
|---|
| Biome (grass / meadow / forest / sand / snow / hill / cliff / marsh / ash / toxic / lava / ice …) |
| Đường GOLD `rd_*` (edge rule + palette verbatim, 3.0 AU half-width) |
| Cầu `T.BRIDGE` |
| Sông, hồ, nước nông, biển sâu, đường bờ biển |
| Hero gốc `buildHero()` **16×24 px**, 1×, không kéo giãn |

Painter là block PAL/PRIO/texel **byte-identical** từ
`b5c8004c:web/src/game/render.ts` (`sha256=f29c1a68…`), cùng block tạo ra benchmark
Beacon U=0.5 mà Creator thích → **đường Beacon giữ nguyên**, không reauthor /
redraw / widen / recolour.

## Những gì BỎ (bằng chứng `draw.overlays` toàn số 0)

`buildings / footprints` · `walls / solid collision meshes` · `doors / rooms` ·
`roofs / occlusion` · `props` · `markers / labels` · helipad reservation outline ·
HUD vẽ trên canvas · particles / VFX · **toàn bộ 6 scene JSON** · `PhysicalLayer` ·
`scenes.generated.ts`. Bundle không chứa `PhysicalLayer`, `U05_SCENES`,
`SITE_ENVELOPE`, `roofHiddenCount` (kiểm tra trong `build-terrain-only-game.mjs`).

Bảng điều khiển tốc độ là **HTML nằm ngoài canvas**, ẩn được bằng `H` — khi ẩn,
màn hình chỉ còn nền + hero (ảnh `evidence/terrain-only-shots/terrain_only_beacon_no_hud.png`).

> Gói P1–P5 đã commit vẫn được giữ nguyên làm **bằng chứng lịch sử**; file game mới
> **không nạp** bất kỳ dữ liệu cảnh / công trình nào của gói đó.

## Điều khiển

| | |
|---|---|
| Di chuyển | `WASD` hoặc `↑ ↓ ← →` |
| Tốc độ | slider **x1 → x10** (bước 0.5), preset `x1 x2 x5 x10`, phím `+` / `-` hoặc `[` / `]` |
| **Zoom toàn cảnh** | **`Z`** = thu nhỏ tới mức nhỏ nhất (toàn bộ map gọn trong 640×360) ↔ 1×; slider *Zoom bản đồ*; `,` / `.` từng nấc; **lăn chuột**; `V` về 1× |
| Khung nhìn (tuỳ chọn) | `B` bật khung 640×360 + dấu chấm vị trí (mặc định **TẮT** để canvas vẫn thuần nền) |
| `C` | bật/tắt **chặn địa hình tự nhiên** (nước / sông / cliff). Mặc định **TẮT = đi tự do toàn bản đồ** để xem hết map |
| `H` | ẩn/hiện bảng điều khiển |
| `R` | về điểm Beacon `[544,1304]` tile = `[272,652]` AU |

- **Tốc độ gốc `SPEED = 72 px/s` không đổi.** `x10` = **720 px/s** là hệ số
  *viewer*, không phải luật Gameplay, không sửa `core.ts`, không sửa đồng hồ game.
- **Camera chơi bình thường vẫn 640×360 @ DPR 1, zoom 1**, `cameraTrick=false`.
  Zoom là chế độ *viewer* riêng, **không đổi luật camera**. Khung
  `4000×2800 tile = 11,200,000 ô` **không** được cấp phát; LRU ≤36 geometry chunks
  + ≤36 display canvases như cũ.
- Ở x10 có sub-step ≤6 px/frame để không xuyên tile khi bật chặn địa hình.
- Không tạo luật marine/boat/ferry/swim: chế độ mặc định cho đi qua biển chỉ là
  **tự do quan sát bản đồ**, không phải quyền đi bộ trên biển.

## Zoom toàn cảnh — "nhỏ nhất có thể"

`Z` đưa `zoomLevel` về **0** → `0.128571 px/tile` = **0.8036%** của 1×
(tỉ lệ `1:124`). Khi đó `4000 × 0.128571 = 514.3 px` và
`2800 × 0.128571 = 360 px` → **toàn bộ khung 4000×2800 tile nằm gọn trong
640×360** (có 63 px letterbox hai bên). Đây là mức nhỏ nhất có thể mà vẫn thấy
hết map; không zoom nhỏ hơn nữa.

Bản toàn cảnh là **bản xem mẫu** (`src/terrain-only/overview.ts`):

| | |
|---|---|
| Kích thước | **500 × 350 px = 175.000 pixel** (1 px = 8×8 tile = 4 AU) |
| Nguồn | **cùng `u05Tile()`** lấy đúng **tâm tile GOLD**, 3 điểm mẫu cố định trong mỗi block, chọn tile có ưu tiên hiển thị cao nhất → đường rộng 6 tile và sông vẫn hiện |
| Màu | base colour của PAL `render.ts` verbatim → đường Beacon giữ đúng material language |
| Xây dựng | progressive 6 hàng/frame (~3,3 s tổng, không đơ UI), hiện dần từ trên xuống |
| **Không** | **không** cấp phát 11.200.000 ô · **không** phải raster phân tích 8 AU phóng to · **không** quảng cáo là chi tiết authored · **không** vẽ công trình/marker/lên canvas |

Ở chế độ này hero 16×24 **không** vẽ (sẽ sai tỉ lệ); `draw.overlays` vẫn toàn **0**.
`B` nếu bật chỉ thêm khung nhìn + dấu chấm, được ghi riêng trong
`draw.viewerGuides` (mặc định tắt). WASD/x10 vẫn chạy → **pan được cả bản đồ**
(QA đo 360 px trong 500 ms ở x10). `V` hoặc `Z` lần nữa về **1× native**.

Ảnh: `evidence/terrain-only-shots/terrain_only_whole_map.png` và
`..._whole_map_guides.png`.

## QA (`evidence/terrain-only-qa.json`)

Playwright 640×360 DPR1, mở **cả `file://` lẫn HTTP**, phím thật:

| Gate | Kết quả |
|---|---|
| T-G0 boot từ `file://` | PASS |
| T-G1 `overlays` toàn 0, `physicalLayerLoaded=false`, `sceneDataLoaded=false` | PASS |
| T-G2 đi thật x1 → x10, **tỉ lệ ~9.4–9.7×** (dao động nhẹ theo khung hình; số chính xác trong `evidence/terrain-only-qa.json`) | PASS |
| T-G3 slider + phím `+`/`-`, clamp `1..10` | PASS |
| T-G4 chặn địa hình tự nhiên + toggle free-roam | PASS |
| T-G5 ẩn HUD, `hudOnCanvas=0` | PASS |
| T-G6 LRU bounded sau chạy dài x10 | PASS |
| T-G7 640×360 1×, hero 16×24, base 72 px/s | PASS |
| T-G8 entry HTTP cũng terrain-only | PASS |
| T-G9 **0** console / page / request errors | PASS |
| T-G10 `Z` đạt mức nhỏ nhất, cả khung 4000×2800 gọn trong 640×360 | PASS |
| T-G11 overview 500×350 / stride 8 / 525.000 mẫu, **không** cấp phát 11,2M ô | PASS |
| T-G12 overview thuần nền, `overlays` toàn 0 | PASS |
| T-G13 `B` khung nhìn tuỳ chọn, ghi rõ không phải lớp map | PASS |
| T-G14 slider/wheel zoom, pan x10 lúc zoom out, `V` về 1× native | PASS |
| T-G15 deep link `?zoom=fit` mở ngay mức zoom nhỏ nhất | PASS |

9 ảnh trong `evidence/terrain-only-shots/`: Beacon, Beacon không HUD, x10,
x10 chạy dài (bờ biển + cỏ), natural collision, HTTP, **toàn cảnh**,
**toàn cảnh + khung nhìn**, **deep link `?zoom=fit`**.

## Không khẳng định

`FULL_GAMEPLAY_RUNTIME_INTEGRATION` · `VISUAL_ACCEPTANCE` · `VEYRA_PLAYABLE` ·
`MERGE_READY` · production game · atlas mới. Đây là **viewer nền** để đi nhanh
trên map, không phải bản game hoàn chỉnh.
