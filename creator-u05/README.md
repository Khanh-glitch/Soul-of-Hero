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
| `docs/TERRAIN_ONLY_VIEWER.md` | Hướng dẫn file game terrain-only |
| `docs/NATURE01_PILOT.md` | Báo cáo pilot 5 biome + bàn giao Control Tower |
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
