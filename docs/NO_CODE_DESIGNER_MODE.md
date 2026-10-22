# Designer Mode — thiết kế map và UI không cần sửa script

Project bật sẵn hai dock trong Godot:

- **Designer**: thêm/kéo-thả gameplay element, mở từng màn hình UI, component và asset.
- **Map Layer Live Sync**: vẽ `Backdrop`, `Geometry`, `Decor` và đồng bộ tile hai chiều.

Đóng rồi mở lại Godot một lần nếu dock chưa xuất hiện sau khi cập nhật project.

## Thiết kế map hoàn toàn bằng chuột

1. Trong dock **Designer**, bấm **Mở Level 1 để thiết kế**.
2. Các marker hiện có được nạp tự động vào node `AuthoringEntities`.
3. Muốn thêm element, bấm nút `+ Player`, `+ Skeleton`, `+ Vampire`, `+ Torch`… trong palette. Marker mới xuất hiện giữa viewport.
4. Dùng công cụ **Move** của Godot kéo marker đến vị trí mong muốn. Bật snap 16 px nếu muốn bám lưới tile.
5. Chọn marker và chỉnh trong Inspector:
   - `Entity ID`: ID ổn định của element;
   - `Patrol Distance`: phạm vi tuần tra của quái;
   - `Chest Score Reward`: thưởng rương;
   - `Door Label` và `Door Message`: nội dung cửa tầng.
6. Với cửa tầng, chọn đúng hai marker cửa trong Scene Tree rồi bấm **Nối 2 cửa tầng đang chọn**. Đích đến hai chiều được cập nhật theo vị trí marker, không nhập tọa độ.
7. Bấm **Lưu element**. Tool kiểm tra toàn bộ level trước khi ghi; nếu sai ID, thiếu Player/Exit Gate hoặc objective không hợp lệ, file cũ được giữ nguyên.
8. Nhấn `Ctrl+S` để lưu marker vào scene.

Bạn cũng có thể kéo trực tiếp các scene trong
`res://game/levels/authoring/presets/` vào `AuthoringEntities`.

### Vẽ sàn, tường và trang trí

1. Chọn `Backdrop`, `Geometry` hoặc `Decor` trong dock **Map Layer Live Sync**.
2. Chọn node cùng tên trong Scene Tree và paint bằng TileMap panel.
3. `Backdrop` là footprint sàn đi được; `Geometry` có collision trọn tile; `Decor` không collision.
4. Bấm **Push ... → JSON** sau khi hoàn tất một layer. Dock tự nhận `level_data_path` của scene đang mở, không khóa cứng vào Level 1.
5. Không fill sàn ra toàn canvas; phần không có `Backdrop` là black void của dungeon top-down.

`AuthoringEntities` chỉ là lớp xem trước trong editor. Khi chạy game nó bị ẩn và vô hiệu hóa; runtime vẫn spawn đúng một gameplay entity từ dữ liệu đã validate.

## Tinh chỉnh từng giao diện

1. Trong dock **Designer**, bấm **Mở UI Workbench** và chạy bằng `F6` để xem catalog hoàn chỉnh.
2. Dùng nhóm nút màn hình để mở trực tiếp Boot, HUD, Title, Hub, Campaign, Arsenal, Bestiary, Modes, Settings, Level Details, Results hoặc Credits.
3. Chỉnh anchors, offsets, container sizing, text, texture, theme override và thứ tự visual bằng Inspector.
4. Kéo scene từ `res://game/ui/designer/components/` vào màn hình đang chỉnh. Các component không chứa gameplay script.
5. Dùng hai template trong `res://game/ui/designer/templates/` khi tạo màn hình mới.
6. Chọn **Editable Children** trên component instance nếu muốn chỉnh sâu một bản riêng.
7. Giữ lại các node có biểu tượng **Unique Name** (`%`); bạn có thể reparent chúng mà runtime vẫn tìm đúng node, nhưng không nên xóa hoặc đổi tên.
8. Chạy scene bằng `F6` và kiểm tra cả 640×360 desktop lẫn touch trước khi chốt.

Hướng dẫn UI chi tiết hơn nằm tại `res://docs/NO_CODE_UI_WORKFLOW.md`.

## Asset đã được đưa vào catalog

- Theme: `res://game/ui/theme/living_arsenal_theme.tres`
- Handjet, Grenze Gotisch, VT323: `res://assets/fonts/`
- Kenney input prompts: `res://assets/ui/input_prompts/tilemap_packed.png`
- Fantasy icon atlas: `res://assets/ui/fantasy_icons.png`
- Inventory chrome: `res://assets/ui/free_inventory/`
- Emblem và Chapter key art: `res://assets/branding/`
- Map element preset: `res://game/levels/authoring/presets/`

Các nút trong phần **Asset Library** mở thẳng resource trong Inspector. Có thể kéo texture từ FileSystem vào thuộc tính `Texture`, `Icon`, `Theme` hoặc `Font`.

## Lưu ý để không phá dữ liệu

- Không đặt marker vào node runtime `Entities`; chỉ đặt dưới `AuthoringEntities`.
- Không đổi ID của quái đang được Encounter Resource tham chiếu nếu chưa cập nhật encounter tương ứng. Di chuyển quái không cần đổi ID.
- Đừng sửa map từ hai scene level khác nhau cùng lúc.
- Khi Live Sync báo conflict, chọn rõ **Pull** hoặc **Push**; tool không tự đoán bên nào đúng.
- Không chạy `tools/regenerate_level.ps1` sau khi tự vẽ vì generator sẽ ghi đè layout thủ công.
