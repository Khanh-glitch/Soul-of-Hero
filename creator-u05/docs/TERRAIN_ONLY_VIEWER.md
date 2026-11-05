# TERRAIN-ONLY GAME — U=0.5, tốc độ tùy chỉnh đến x10

> Yêu cầu Creator: *"bỏ toàn bộ công trình và các lớp nổi, chỉ giữ phần nền của
> đường, sông, biome,... và đưa tôi file game để di chuyển trên map đó với tốc độ
> nhanh tùy chỉnh lên x10"*.

## File nhận được

**`creator-u05/SoulOfHero_TerrainOnly_U05_x10.html`** — **1 file HTML duy nhất**,
1,394,306 bytes, `sha256` trong `evidence/terrain-only-build.json`.

- Bấm đúp mở bằng trình duyệt (`file://`) — **không cần server, không cần mạng,
  không cần cài đặt, không nạp atlas mới**. Mọi module + 21 raster WMP-04R1
  (base64) đã được inline.
- Hoặc mở live preview: `http://<preview-host>:5182/terrain-only.html`.
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
| `C` | bật/tắt **chặn địa hình tự nhiên** (nước / sông / cliff). Mặc định **TẮT = đi tự do toàn bản đồ** để xem hết map |
| `H` | ẩn/hiện bảng điều khiển |
| `R` | về điểm Beacon `[544,1304]` tile = `[272,652]` AU |

- **Tốc độ gốc `SPEED = 72 px/s` không đổi.** `x10` = **720 px/s** là hệ số
  *viewer*, không phải luật Gameplay, không sửa `core.ts`, không sửa đồng hồ game.
- Camera **640×360 @ DPR 1, zoom 1**, `cameraTrick=false`. Khung
  `4000×2800 tile = 11,200,000 ô` **không** được cấp phát; LRU ≤36 geometry chunks
  + ≤36 display canvases như cũ.
- Ở x10 có sub-step ≤6 px/frame để không xuyên tile khi bật chặn địa hình.
- Không tạo luật marine/boat/ferry/swim: chế độ mặc định cho đi qua biển chỉ là
  **tự do quan sát bản đồ**, không phải quyền đi bộ trên biển.

## QA (`evidence/terrain-only-qa.json`)

Playwright 640×360 DPR1, mở **cả `file://` lẫn HTTP**, phím thật:

| Gate | Kết quả |
|---|---|
| T-G0 boot từ `file://` | PASS |
| T-G1 `overlays` toàn 0, `physicalLayerLoaded=false`, `sceneDataLoaded=false` | PASS |
| T-G2 đi thật x1 → x10, **tỉ lệ ~9.4×** (9.37 trong lần chạy cuối; dao động nhẹ theo khung hình) | PASS |
| T-G3 slider + phím `+`/`-`, clamp `1..10` | PASS |
| T-G4 chặn địa hình tự nhiên + toggle free-roam | PASS |
| T-G5 ẩn HUD, `hudOnCanvas=0` | PASS |
| T-G6 LRU bounded sau chạy dài x10 | PASS |
| T-G7 640×360 1×, hero 16×24, base 72 px/s | PASS |
| T-G8 entry HTTP cũng terrain-only | PASS |
| T-G9 **0** console / page / request errors | PASS |

6 ảnh trong `evidence/terrain-only-shots/`: Beacon, Beacon không HUD, x10,
x10 chạy dài (bờ biển + cỏ), natural collision, HTTP.

## Không khẳng định

`FULL_GAMEPLAY_RUNTIME_INTEGRATION` · `VISUAL_ACCEPTANCE` · `VEYRA_PLAYABLE` ·
`MERGE_READY` · production game · atlas mới. Đây là **viewer nền** để đi nhanh
trên map, không phải bản game hoàn chỉnh.
