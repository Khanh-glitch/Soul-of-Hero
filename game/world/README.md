# World components — top-down

Toàn bộ scene trong thư mục này dùng tọa độ 2D tự do, không có gravity, mặt sàn
hay giá trị Y cố định. Có thể đặt hoặc di chuyển entity ở bất kỳ vị trí nào trên
map top-down. Visual của prop có gốc ở chân vật thể để tương thích Y-sort; vùng
tương tác và vùng damage vẫn nằm trong mặt phẳng X/Y quanh node gốc.

## Scene dùng trực tiếp

| Thành phần | Scene | Tùy chỉnh chính trong Inspector |
| --- | --- | --- |
| Skeleton | `res://game/characters/enemies/skeleton_enemy.tscn` | máu, damage, tốc độ, bán kính tuần tra/phát hiện/tách đàn |
| Coin | `res://game/world/interactables/coin.tscn` | điểm thưởng, độ cao/tốc độ hiệu ứng bay |
| Ấn ký | `res://game/world/interactables/sigil.tscn` | điểm thưởng, màu glow |
| Checkpoint | `res://game/world/interactables/checkpoint.tscn` | màu active/inactive |
| Rương | `res://game/world/interactables/chest.tscn` | atlas 32×32: 9 cấp thường, 6 cấp monster, rarity/family/jackpot, điểm và `contains_sigil` |
| Cổng thoát | `res://game/world/interactables/exit_gate.tscn` | màu khóa/mở |
| Gai | `res://game/world/hazards/spikes.tscn` | damage, chu kỳ gây damage |
| Đuốc | `res://game/world/props/torch.tscn` | kiểu đuốc, màu/cường độ/độ rộng sáng |

## Quy ước top-down

- Skeleton dùng `MOTION_MODE_FLOATING`, di chuyển bằng `Vector2` trên cả hai trục.
- AI chọn điểm tuần tra trong một vòng tròn quanh vị trí spawn, đuổi và đánh bằng
  khoảng cách Euclid. Steering từ normal va chạm giúp lướt quanh tường đơn giản;
  separation giữ nhiều enemy không dồn vào cùng một điểm.
- Player phải thuộc group `player` và có `take_damage(amount, source_position)`.
- Enemy thuộc group `enemies`, nhận damage bằng cùng chữ ký hàm.
- Coin, sigil, chest, checkpoint và exit gate cập nhật qua `GameSession`; UI và
  realtime tiếp tục nhận thay đổi qua `GameEvents`.
- Collision layer theo `project.godot`: enemy 3, interactable 6, hazard 7.
- Rương mở bằng action `interact` (mặc định `E` hoặc nút Back trên tay cầm).
- Node chứa entity nên bật `y_sort_enabled` để nhân vật và prop chồng lớp đúng.

Các scene tự tạo `SpriteFrames` từ PNG khi chạy. `sprite_frame_factory.gd` là
helper dùng chung cho loạt PNG rời và sprite sheet ngang; không cần tạo `.tres`
thủ công khi thêm animation mới.
