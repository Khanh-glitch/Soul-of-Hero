# Asset notes

> **LEGACY NOTES.** Inventory/trạng thái runtime trong file này có thể đã cũ.
> Nguồn audit hiện hành: `docs/ASSET_AUDIT_SOUL_OF_HERO.md`.

Tài liệu này ghi nguồn và vai trò của asset đang có trong project. “Free asset” không tự động đồng nghĩa với public domain; bản build phát hành phải có license manifest đầy đủ.

## Atlas map canonical: 0x72 DungeonTileset II

- Asset: **DungeonTileset II v1.7**
- Tác giả: 0x72
- Trang nguồn: <https://0x72.itch.io/dungeontileset-ii>
- License: CC0 1.0 / public-domain dedication
- Archive gốc: `0x72_DungeonTilesetII_v1.7.zip`
- Notice trong project: `assets/environment/dungeon_0x72/THIRD_PARTY.md`

Hai file được loader map dùng trực tiếp:

| TileSet source | File | Kích thước | Grid 16×16 | Vai trò |
|---:|---|---:|---:|---|
| 0 | `assets/environment/dungeon_0x72/dungeon_tileset_ii.png` | 512×512 | 32×32 | Floor và decor |
| 1 | `assets/environment/dungeon_0x72/atlas_walls_low.png` | 192×64 | 12×4 | Wall/corner Geometry có collision |

Schema level và `DungeonLevel` cùng khai báo hai grid trên. Cell có `source`/`atlas` ngoài phạm vi sẽ bị từ chối trước khi apply hoặc persist.

CC0 không bắt buộc attribution, nhưng notice vẫn được giữ để truy vết nguồn và license.

## Các ZIP ban đầu trong Downloads

Các asset sau được chọn từ archive trong `C:\Users\LE QUOC KHANH\Downloads` ngày 14/07/2026:

- `2D Pixel Dungeon Asset Pack v2.0.zip`: chest, coin, torch, spikes, flag và atlas dungeon cũ.
- `FreeKnight_v1.zip`: 30 PNG sheet từ `Colour1/Outline/120x80_PNGSheets`.
- `Enemy_Animations_Set.zip`: skeleton và vampire sheets; runtime hiện chỉ dùng skeleton 1.
- `Shikashi's Fantasy Icons Pack v2.zip`: `fantasy_icons.png` và license text.

Asset đã được đặt lại theo vai trò dưới `assets/`, không giữ cấu trúc archive có khoảng trắng.

## Asset dungeon cũ còn được dùng

Thư mục `assets/environment/dungeon/` không còn là atlas canonical của map. Nó vẫn chứa:

- Chest, coin, torch, spikes và flag dùng cho scene world/interactable.
- `source_reference.png` làm ảnh tham khảo cách ghép asset pack cũ.
- `dungeon_tileset.png` để đối chiếu/migration, không phải source floor/wall hiện tại.

Không xóa các file này cho tới khi từng scene prop đã được chuyển hoặc xác nhận không còn dependency.

## FreeKnight và enemy art

- FreeKnight cung cấp 30 sheet 120×80; `knight_animation_library.gd` đăng ký toàn bộ.
- Gameplay top-down dùng foot-origin và sprite flip ngang; asset gốc có silhouette side-facing nên map/occlusion phải giúp giữ cảm giác top-down.
- Skeleton 1 đang có runtime scene; skeleton 2 và vampire chỉ là nguồn content tiềm năng, chưa phải enemy hoàn chỉnh.
- Các archive này không kèm license text rõ trong bản đã kiểm tra. Trước khi phát hành/bán game, cần quay lại trang nguồn, lưu license snapshot và điều khoản redistribution/commercial use.

## UI icons

`assets/licenses/shikashi_fantasy_icons.txt` cho phép dùng/remix cho dự án thương mại và ghi chú nhiều thiết kế dựa trên game-icons.net CC BY 3.0. Khi đưa icon tương ứng vào shipping UI, cần lập attribution list chính xác thay vì chỉ giữ file license tổng quát.

## Audio và asset còn thiếu

Project hiện không có audio asset hoặc audio bus layout. Không tải asset âm thanh không rõ nguồn. Phase audio phải lưu source, author, license, file gốc và mọi attribution cùng lúc import.

## Trạng thái sản phẩm

Việc atlas 0x72 đã được import không có nghĩa Living Arsenal đã hoàn tất. Milestone hiện tại chỉ là true top-down dungeon foundation. Xem:

- [Master spec](LIVING_ARSENAL_MASTER_SPEC.md)
- [Project audit](PROJECT_AUDIT.md)
- [Product roadmap](PRODUCT_ROADMAP.md)
