# Designer Control Center — hướng dẫn làm game bằng Godot, không sửa code

Mục tiêu của cấu trúc này là: bạn thay đổi **nội dung game** trong dock Designer và kéo-thả; code chỉ giữ luật nền, không phải nơi chỉnh số thường ngày.

Nếu bạn cần biết **ý nghĩa của từng loại số và nên chỉnh thế nào**, đọc [Hướng dẫn chỉnh game bằng tiếng Việt](DESIGNER_TUNING_GUIDE_VI.md) trước; đây là playbook có ví dụ cụ thể cho tướng, quái, skill, wave, reward và VFX.

Mở project bằng Godot. Ở góc dưới-trái sẽ có dock **Designer**. Nếu chưa thấy, đóng và mở lại Godot một lần.

## Bản đồ nhanh: cái gì nằm ở đâu

| Bạn muốn chỉnh | Nơi mở trong dock Designer | Dữ liệu thật được lưu ở |
| --- | --- | --- |
| Tốc độ, HP, damage cơ bản | 1. Chỉnh Balance | data/content/tuning/gameplay_tuning.tres, sau đó áp dụng sang config/gameplay_tuning.json |
| Tướng, vũ khí, skill đã có | Balance chi tiết → Tướng + chiêu hoặc Vũ khí + kỹ năng | game/heroes/data/, game/weapons/data/ |
| Máu, damage, tốc độ, AI ID của quái | Balance chi tiết → Quái + Elite + tỉ lệ | data/content/enemies/ |
| Số quái, wave, vị trí spawn, điều kiện thắng | encounters / ... và rosters / ... | data/content/encounters/, data/content/rosters/ |
| Ải, khóa/mở ải, thưởng ải | levels / ..., rewards / ... | data/content/levels/, data/content/rewards/ |
| Item stack: tên, icon, mô tả, loại | items / item_catalog hoặc item riêng | data/content/items/ |
| Texture, frame, màu, scale, vị trí VFX | Chỉnh thư viện VFX | data/content/vfx/vfx_library.tres |
| Sàn/tường/trang trí/vị trí entity từng map | Map Workbench | data/levels/*.json |
| Màn hình, HUD, theme | UI Workbench | game/ui/, game/ui/theme/ |

Không cần tự tìm folder mỗi lần: danh sách content trong dock quét tất cả file .tres thiết kế được.

## Quy tắc cấu trúc (đừng phá)

~~~text
assets/        ảnh, âm thanh, font gốc — chỉ thay asset tại đây
data/content/  dữ liệu thiết kế (.tres) — nguồn chỉnh balance/nội dung
data/levels/   dữ liệu map (.json) — tile, entity, metadata của từng ải
game/          scene và code runtime — chỉ sửa khi muốn luật/hành vi mới
addons/        công cụ trong Godot Editor (Designer, Map Live Sync)
config/        cầu nối cấu hình runtime; không sửa JSON bằng tay
tests/         kiểm tra tự động
tools/         lệnh chạy game/test
docs/          hướng dẫn và đặc tả
~~~

Đừng di chuyển hoặc đổi tên tùy ý các file trong assets, game, data: Godot tham chiếu chúng bằng đường dẫn. Nếu muốn biến thể mới, hãy **duplicate một .tres hoặc scene mẫu**, đổi ID, rồi tham chiếu bản mới từ asset content phù hợp.

## Luồng làm việc hằng ngày

1. Mở dock **Designer**.
2. Chỉ thay đổi **một nhóm** (ví dụ VFX hoặc Level 5).
3. Bấm **Lưu nội dung này** trong Designer sau khi sửa một resource.
4. Chạy scene/game để xem kết quả.
5. Bấm test tương ứng trước khi chuyển sang nhóm khác.

Mỗi ô số trong Designer có giới hạn an toàn. Nếu một quan hệ quan trọng sai (ID trùng, frame không hợp lệ, wave thiếu quái, map thiếu Player/Exit...), tool hoặc test sẽ báo thay vì âm thầm ghi dữ liệu hỏng.

## 1. Chỉnh balance

1. Bấm **1. Chỉnh Balance**.
2. Bảng Balance hiện ngay bên dưới nút, gồm Di chuyển, Máu/thể lực và Chiến đấu cơ bản.
3. Chỉnh số, ví dụ max_health, dash_cooldown, light_damage.
4. Bấm **2. Áp dụng** trong dock Designer.
5. Chạy game. Nếu game đang chạy, nó tự nạp lại file trong khoảng hai giây.

Nút **Nạp số Balance đang chạy** dùng để bỏ bản nháp trong bảng và quay lại đúng số game đang dùng.

Lưu ý: Hero/weapon/enemy có các chỉ số riêng. Balance ở đây là **chỉ số nền** của nhân vật chính; damage hoặc cooldown của từng vũ khí nên chỉnh trong asset vũ khí tương ứng.

## 2. Hero, vũ khí, quái, wave và thưởng

Trong phần **Balance chi tiết**, chọn một loại trước, sau đó chọn asset rồi bấm **Chỉnh**. Bảng chỉnh luôn mở ngay trong Designer. Với nút **Mở: ...**, bạn đi sâu vào chiêu, profile hoặc wave con; dùng **Quay lại** để trở lại resource cha. Nút **Lưu nội dung này** luôn lưu đúng file đang sở hữu phần bạn chỉnh (ví dụ skill/weapon riêng, hoặc VFX library cha khi profile là phần nhúng).

- Hero: chỉnh identity, skill, combo, số mana, VFX ID đang được Hero dùng.
- Vũ khí: chỉnh normal attack, hand skill, spirit action/trigger, damage, cooldown, scene projectile/VFX/SFX.
- Quái: chỉnh HP, tốc độ, range, telegraph, recovery, damage, reward và scene/VFX hook.
- Encounter: chỉnh wave → group → spawn entry để chọn quái, số lượng, thời gian, marker spawn và điều kiện hoàn thành.
- Roster: bản tóm tắt số lượng quái của từng ải; dùng để nhìn balance nhanh.
- Reward: chỉnh tiền, material, Hero Soul, trang bị phụ và Item Stacks.

Với behavior hoàn toàn mới (ví dụ một kiểu AI hay skill chưa từng có), vẫn cần code một lần. Nhưng tạo biến thể mới của hệ đang có — quái mới dùng AI cũ, vũ khí mới dùng behavior cũ, ải/wave/reward mới — làm bằng resource trong Designer.

## 3. Item: quyết định game có vật phẩm nào

data/content/items/item_catalog.tres là danh sách item stack hiện có. Mỗi item có ID, tên hiển thị, mô tả, loại, icon và giới hạn stack.

Để thêm item mới:

1. Trong FileSystem, vào data/content/items/, chuột phải → **Create New Resource** → chọn StackItemDefinition.
2. Điền Item ID theo dạng snake_case, tên, mô tả, loại và icon; lưu file.
3. Mở item_catalog.tres, thêm item mới vào mảng Items để catalog kiểm tra ID trùng.
4. Mở Reward cần cấp vật phẩm. Trong Item Stacks, tạo RewardItemStack, kéo item mới vào trường Item Definition, đặt số lượng.
5. Chạy tools/run_content_contract_tests.ps1.

Các reward cũ đã được nối tới item catalog. Nếu một reward dùng Item Definition, game lấy đúng tên/icon/mô tả từ catalog khi hiển thị hoặc thả item, nhưng save vẫn giữ schema gọn và tương thích cũ.

## 4. VFX: chọn asset, màu, frame và căn vị trí

1. Bấm **Chỉnh thư viện VFX**.
2. Mở Profiles, chọn effect muốn sửa (ví dụ bow_impact, world_portal, axe_charge).
3. Chỉnh trong bảng Designer:
   - Texture: bấm **Đổi file** để chọn spritesheet mới trong project;
   - Cell Size, Frame Count, Columns, Frames Per Second: định nghĩa animation;
   - Base Scale, Tint, Use Monochrome Tint, Default Z Index: hình thức;
   - Local Position Offset, Rotation Offset Degrees: căn chỉnh chính xác điểm xuất hiện mà không sửa script.
4. Giữ nguyên Effect ID với effect đang dùng nếu mục tiêu là thay VFX cũ.
5. Chạy **Chạy test VFX** rồi vào game xem thực tế.

Local Position Offset là offset quay theo hướng bắn/đánh. Ví dụ VFX mũi tên bị lệch về sau: tăng trục X một ít; lưỡi chém cao/thấp: chỉnh trục Y. Đây là cách chỉnh pivot an toàn nhất.

Bạn có thể thêm profile mới. Profile chỉ xuất hiện trong game khi một field VFX ID của Hero hoặc scene/resource gameplay tham chiếu tới ID đó; vì vậy, với phần lớn trường hợp, hãy thay Texture của profile sẵn có thay vì đổi ID.

## 5. Thiết kế từng map

1. Ở MAP, chọn ải trong danh sách và bấm **Mở map**.
2. Workbench nạp đúng JSON của ải, bao gồm tile và entity marker.
3. Vẽ Backdrop, Geometry, Decor bằng TileMap panel. Dùng dock **Map Layer Live Sync** để Push ... → JSON sau từng layer.
4. Thêm/di chuyển quái, rương, checkpoint, cửa, spike, torch bằng palette trong dock Designer. Chỉnh field của marker trong panel bên phải của Godot.
5. Bấm **Lưu element**. Tool validate toàn bộ map trước khi ghi JSON.
6. Chạy game, chọn ải đó từ Campaign để kiểm tra gameplay.

Map Workbench là scene xem trước dùng chung. **Không cần Ctrl+S scene workbench**; hai nút cần dùng để chốt dữ liệu là Lưu element và Push layer → JSON. Vì thế scene level chính không bị dính dữ liệu preview của ải cuối bạn mở.

Khi đổi map hoặc bấm nạp element lần nữa, marker cũ được thay thế hoàn toàn — không còn lỗi marker trùng ID.

## 6. UI

Mở UI Workbench, chọn screen hoặc component. Chỉnh text, texture, anchor, container, theme override bằng Inspector. Giữ nguyên các node có ký hiệu % (Unique Name): script runtime có thể đang tìm chúng.

## Kiểm tra trước khi chốt

| Việc vừa làm | Cách kiểm tra |
| --- | --- |
| Balance/VFX/item/tool | tools/run_designer_control_center_tests.ps1 |
| VFX | tools/run_vfx_tests.ps1 |
| Reward, encounter, level, roster | tools/run_content_contract_tests.ps1 |
| Map marker/ghi JSON | tools/run_map_authoring_tests.ps1 |
| Toàn bộ game | tools/run_full_regression.ps1 (chạy khi bạn chuẩn bị chốt một mốc lớn) |

Bạn không cần thuộc lệnh: dock có nút chạy test VFX, còn các lệnh còn lại có thể chạy bằng PowerShell từ folder project.

## Khi có lỗi

- Dock Designer không hiện: đóng/mở lại Godot; kiểm tra Project > Project Settings > Plugins, cả Designer Suite và Where I Am Live Sync phải Enabled.
- Lưu element từ chối: đọc status dock; thường là ID trùng hoặc map thiếu Player/Exit Gate. Dữ liệu JSON cũ vẫn được giữ nguyên.
- Push layer báo conflict: chọn rõ Pull hoặc Push; không chỉnh cùng JSON bằng hai cửa sổ/công cụ một lúc.
- VFX không hiện: kiểm tra Texture, Cell Size/frame count/columns và giữ Effect ID không rỗng.
- Item mới hiển thị icon túi mặc định: kiểm tra Item Definition đã được kéo vào RewardItemStack và item có icon.
