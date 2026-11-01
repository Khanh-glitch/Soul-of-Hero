# Thiết kế map top-down

> **Designer Mode:** người thiết kế không cần sửa JSON hoặc GDScript. Mở dock
> **Designer** để thêm/kéo-thả entity dưới `AuthoringEntities`, nối cửa tầng và
> bấm **Lưu element**. Dock **Map Layer Live Sync** tiếp tục dùng để paint ba
> TileMapLayer. Xem quy trình cập nhật tại
> [NO_CODE_DESIGNER_MODE.md](NO_CODE_DESIGNER_MODE.md). Các phần schema/JSON bên
> dưới là tài liệu kỹ thuật cho validator và automation, không phải thao tác bắt
> buộc của level designer.

## Baseline hiện tại

`data/levels/crypt_entrance.json` là layout canonical của Campaign Level 1, **Hầm Mộ Khai Ấn**. Map mở đầu bằng vùng hướng dẫn ngắn rồi dồn quái thành ba bãi Skeleton 4/4/4, xen các khoảng nghỉ, checkpoint, bẫy và đường vòng giữa tầng.

| Thuộc tính | Giá trị |
|---|---:|
| Schema | v2 |
| Movement mode | `top_down` |
| Kích thước | 104×76 cell |
| Tile size | 16×16 px |
| Backdrop/floor | 3860 cell |
| Geometry/wall | 880 cell |
| Decor | 17 cell |
| Entity | 53 |
| Room metadata | 9 |

Footprint là hợp của các phòng và hành lang kết nối, trừ ba inner pit. Ngoài footprint không có Backdrop, vì vậy nền clear color hiển thị thành **black void**. Đây là khác biệt quan trọng so với việc fill toàn bộ map rồi đặt các dải tường ngang kiểu platform.

## Hai TileSet source

`DungeonLevel` tạo TileSet runtime từ hai atlas 16×16:

| Source | Grid | File | Dùng cho |
|---:|---:|---|---|
| 0 | 32×32 | `assets/environment/dungeon_0x72/dungeon_tileset_ii.png` | Floor và decor |
| 1 | 12×4 | `assets/environment/dungeon_0x72/atlas_walls_low.png` | Low wall/corner Geometry |

Source 0 là full atlas 512×512. Source 1 là low-wall atlas 192×64. Cả loader và `LevelSchema` kiểm tra source/grid; atlas coordinate ngoài phạm vi bị từ chối.

## Contract ba layer

- `Backdrop`: vùng walkable nhìn thấy. Không có collision.
- `Geometry`: tường, perimeter, viền pit hoặc vật cản. Mỗi cell có full 16×16 collision trong runtime TileSet hiện tại.
- `Decor`: hình ảnh không collision, nằm trên floor nhưng dưới entity.

Chỉ đặt cell thật sự cần chặn movement vào `Geometry`. Nếu tương lai cần half-wall, cửa mở/đóng hoặc collision shape không đầy cell, phải thêm collision profile/scene riêng thay vì lạm dụng full-cell Geometry.

## Sửa trực tiếp trong Godot

1. Mở `game/levels/crypt_entrance.tscn`.
2. Bật dock **Map Layer Live Sync** nếu plugin chưa hiện.
3. Trong dropdown của dock, chọn `Backdrop`, `Geometry` hoặc `Decor`.
4. Paint đúng `TileMapLayer` tương ứng.
5. Dùng **Push selected layer → JSON** để ghi riêng layer đã chọn.
6. Khi JSON được sửa từ MCP/editor ngoài, dùng **Pull JSON → selected layer**.
7. Nếu bật auto sync, conflict hai chiều sẽ dừng tự động và yêu cầu chọn Pull hoặc Push; plugin không tự đoán bên thắng.

Pull/Push luôn validate toàn document schema v2 và tile source trước khi thay cell. Hai layer không được chọn, `entities` và `metadata` được giữ nguyên.

Luôn commit JSON cùng thay đổi generator/schema/test. Scene TileMap là view/editor surface; JSON mới là dữ liệu canonical của sandbox.

## Schema cell

Floor/decor từ source 0:

```json
{
  "x": 10,
  "y": 16,
  "source": 0,
  "atlas": [1, 5],
  "alternative": 0
}
```

Wall từ source 1:

```json
{
  "x": 9,
  "y": 15,
  "source": 1,
  "atlas": [2, 0],
  "alternative": 0
}
```

Ba array canonical nằm tại:

```text
layers.Backdrop
layers.Geometry
layers.Decor
```

Cell được sort theo `y`, sau đó `x` để Git diff ổn định. World position cơ bản bằng cell coordinate × `tile_size`.

Schema v2 kiểm tra:

- Đúng `version=2`, `movement_mode="top_down"`, `tile_size=16`.
- Cell trong bounds, không duplicate coordinate trong cùng layer.
- Source tồn tại, atlas nằm trong grid và `alternative=0`.
- Entity có ID duy nhất, type/field đã đăng ký và position trong pixel bounds.
- Đúng một `player` và một `exit_gate`.
- `required_sigils` không lớn hơn số sigil entity.

## Entity hiện tại

53 entity gồm:

| Type | Số lượng |
|---|---:|
| player | 1 |
| skeleton | 12 |
| sigil | 3 |
| chest | 2 |
| checkpoint | 2 |
| exit_gate | 1 |
| floor_door | 4 |
| spikes | 4 |
| torch | 12 |
| coin | 12 |

Type đã đăng ký: `player`, `skeleton`, `skeleton_reaper`, `vampire`, `coin`,
`sigil`, `checkpoint`, `chest`, `bow_reward`, `exit_gate`, `floor_door`,
`spikes`, `torch`. Ba loại quái nhận `patrol`; chest nhận `score_reward`; cửa
tầng nhận đích liên kết, label và message.

Ví dụ:

```json
{
  "id": "l1_c1_skeleton_01",
  "type": "skeleton",
  "position": [776, 120],
  "patrol": 36
}
```

Khi thêm type/property mới, cập nhật đồng thời `LevelSchema`, `ENTITY_SCENES` và config mapping trong `game/main.gd`.

### Hot reload entity

Runtime đối chiếu bằng stable ID:

- Entity không đổi giữ node, HP, AI và vị trí runtime.
- Entity mới được spawn; entity bị xóa được dọn.
- Thay type trên cùng ID sẽ thay scene instance.
- Actor đã chết/được nhặt không tự spawn lại chỉ vì config của ID đó đổi, tránh nhân đôi score/objective.

Muốn tái tạo actor đã tiêu thụ, restart run hoặc xóa ID, sync một nhịp rồi thêm lại.

## MCP map editing

`set_tile` và `save_runtime_map` nhận `layer` là `Backdrop`, `Geometry` hoặc `Decor`; mặc định là `Geometry`.

Ví dụ preview một floor cell chỉ trong runtime:

```json
{
  "layer": "Backdrop",
  "x": 10,
  "y": 10,
  "source": 0,
  "atlas": [1, 4],
  "alternative": 0,
  "persist": false
}
```

Sau preview, gọi `save_runtime_map` với cùng layer nếu muốn serialize runtime về JSON. Xem chi tiết tại [MCP_REALTIME.md](MCP_REALTIME.md).

## Quy tắc hình ảnh true top-down

- Không fill Backdrop ngoài footprint; black void phải đọc được thành không gian không thể đi.
- Tường là perimeter của phòng/hành lang, không phải platform strip chạy ngang qua floor.
- Dùng corner/concave tile đúng hướng, kiểm tra seam ở mọi cửa nối.
- Giữ lối chính đủ rộng cho player, enemy separation và VFX telegraph.
- Không đặt enemy/pickup vào void, pit hoặc full-cell Geometry.
- Decor phẳng có thể ở layer `Decor`.
- Cột, tượng hoặc tường cao cần che player phải là prop tham gia Y-sort hoặc tách base/foreground. Hiện `Entities` có z cao hơn Geometry, nên occlusion là một gate cần hoàn tất trong milestone map.
- FreeKnight là sprite side-facing; foot-origin, silhouette phòng và occlusion phải cùng củng cố cảm giác top-down.

## Generator

`tools/generators/generate_chapter_1_levels_2_to_5.gd` tái tạo toàn bộ layout Campaign Chapter 1 (Lv1–5) từ định nghĩa room/corridor/pit dùng chung:

```powershell
powershell -ExecutionPolicy Bypass -File tools/regenerate_level.ps1
```

Lệnh này **ghi đè** `data/levels/crypt_entrance.json` và bốn file `chapter_1_level_2.json` đến `chapter_1_level_5.json`. Chỉ chạy khi muốn tái tạo layout do code sinh. Nếu cố ý thay footprint/count, cập nhật generator, smoke expectations và tài liệu trong cùng thay đổi.

Chapter 2 Lv11–20 được sinh bởi `tools/generators/generate_chapter_2_levels.gd`;
per-level `_signature_pits()` là source of truth cho các lane, cover break và
flank route. Sau khi chỉnh generator, chạy script Godot đó để cập nhật toàn bộ
`data/levels/chapter_2_level_11.json` đến `data/levels/chapter_2_level_20.json`, rồi chạy
`tools/run_chapter_2_map_design_tests.ps1`. Test kiểm tra walkability, marker safety,
wall/floor separation và khác biệt silhouette giữa mọi cặp map.

Để xem toàn bộ silhouette mà không bị HUD/entity che, mở và chạy riêng
`tools/map_overview.tscn`. Scene này tự fit camera theo `camera_bounds`, ẩn
`Entities` và không thay đổi JSON canonical.

## Kiểm tra sau khi sửa map

1. Chạy generator nếu thay source data.
2. Chạy `tools/run_tests.ps1` để kiểm tra schema, 3860 floor, 880 wall, void, collision perimeter và spawn.
3. Chạy `tools/run_mcp_tests.ps1` nếu sửa sync/schema/serialization.
4. Chụp gameplay desktop và touch-emulated; kiểm tra wall orientation, seam, occlusion, HUD và entity placement.
5. Đi bộ qua mọi corridor chủ đích và thử ép player vào perimeter/pit.

Các con số hiện tại là baseline của Campaign Level 1 đã thiết kế lại. Contract chi tiết cho cả chuỗi Lv1–5 nằm trong [CHAPTER_1_LEVEL_2_5_MAP_DESIGN.md](CHAPTER_1_LEVEL_2_5_MAP_DESIGN.md).
