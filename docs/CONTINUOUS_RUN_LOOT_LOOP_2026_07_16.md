# Continuous run, progression và loot loop — 2026-07-16

Tài liệu này ghi contract runtime thay cho flow cũ phụ thuộc Results. Mục tiêu là
giữ người chơi trong nhịp đánh–nhặt–nâng cấp–đi tiếp và làm mọi phần thưởng có
phản hồi ngay tại thời điểm nhận.

## Flow sản phẩm

1. Level Details chọn Easy; Medium/Hard chỉ mở cho riêng màn đã first-clear.
2. Trong gameplay, mỗi kill trả XP bằng transaction riêng của run + enemy.
3. XP bar, `+XP`, damage/combo popup và level-up SFX/VFX phản hồi ngay.
4. Quái/rương có rarity lúc spawn. Kill hoặc mở rương có thể bung nhiều món;
   jackpot tăng số món nhưng không tự đưa vật phẩm vào inventory.
5. Đồ đáp xuống, nằm trên map và chỉ commit vào save khi người chơi đứng gần,
   nhấn `E` và transaction thành công.
6. `I`/`Tab` mở Field Codex không pause và chỉ có hai khu lớn. **Tủ đồ &
   Trang bị** gom Hero Soul như một loại trang bị bình thường, có ô trống,
   chọn-xem chi tiết-trang bị và kéo thả. **Nâng cấp** gom Stat + Skill trên
   cùng trang. Tất cả cùng đọc/ghi SaveService; Knight refresh sau mỗi commit.
7. Khi objective hoàn tất, flow commit first-clear trước rồi hiện câu hỏi tại
   chỗ: đi ải kế, chọn/chơi lại ải để farm, hoặc về nhà. Không route qua Results.

## Difficulty và tăng tiến

| Hệ số | Easy | Medium | Hard |
| --- | ---: | ---: | ---: |
| Enemy HP | 1.00 | 1.35 | 1.75 |
| Enemy damage | 1.00 | 1.25 | 1.55 |
| Enemy speed | 1.00 | 1.08 | 1.15 |
| Mật độ authored | 1.12 | 1.25 | 1.50 |
| Mutant chance | 3% | 10% | 20% |
| Luck | 1.00 | 1.35 | 1.85 |
| Rare chest/drop multiplier | 1.00 | 1.45 | 2.10 |

Stage tiếp tục nhân HP/damage/speed của quái theo số màn. Mutant được roll ổn
định từ `run_id + entity_id`, có thêm HP/damage/speed/reward, thuộc nhóm elite và
có rarity loot tối thiểu Rare. Boss và entity objective đặc biệt không bị nhân
bản bởi density adapter.

Mỗi Player Level tự cộng 18 HP, 4% Core Damage và 8 Mana. Năm Stat Point mới
cho phép tạo spike thứ hai ngay trong trận; return đầu tier là 12 HP, 1,5% Core
Damage hoặc 5 Mana mỗi điểm.

## Rarity và loot vật lý

Một palette duy nhất được dùng cho quái, rương, trang bị, Hero Soul, ground
loot và text UI:

`Normal → Magic → Rare → Epic → Legendary → Crystal → Mythic → Eternal`.

Rarity của source là floor của món rơi. Difficulty/luck chỉ dịch xác suất lên
tier cao hơn; không được làm một Rare source rơi món Normal. Boss có floor Epic,
mutant có floor Rare. Loot payload được roll một lần trước khi hiện trên đất và
chứa exact item instance, nên mở UI hoặc chờ nhặt không thể reroll.

## Presentation asset

- Thanh XP, Field Codex và continuation chooser dùng TravelBookLite:
  BookCover, BookPageLeft/Right, Bar, Fill, Frame, Slot và Popup. Credit:
  Crusenho Agus Hennihuno; license/product link được giữ tại
  `assets/library/downloaded/complete_ui_book_styles_free/License.txt`.
- Tên quái/loot và `+XP` là chữ raw có outline, không có paper/card riêng. Tên
  quái dùng `TÊN (Lv X)` và màu rarity; máu nằm ngay bên dưới. Tên loot dùng
  màu rarity và prompt E cạnh đó.
- Icon loot runtime là transparent cutout byte-identical từ RPG Arsenal v1.1;
  khung đến từ ô trang bị hoặc rarity aura thay vì nền vuông bake hai lần.
  Mapping và credit nằm tại `assets/ui/loot/SOURCE_AND_LICENSE.md`.
- Rarity aura, drop/pickup/jackpot, level-up và combat skill feedback dùng các
  spritesheet/VFX/SFX đã import. Damage và combo giữ kiểu chữ outline trên
  gameplay, không đóng khung như thẻ UI; cảm giác lực đến từ tween scale lớn,
  giật lên rất nhanh và phóng/fade khi thoát. Không raster chữ bằng `_draw`.
- `WorldTint` mặc định là trắng; map không còn lớp CanvasModulate che tối.

## Cổng kiểm thử tập trung

- `tools/run_progression_difficulty_tests.ps1`
- `tools/run_realtime_loot_tests.ps1`
- `tools/run_continuous_hud_ui_tests.ps1`
- `tools/run_combat_feedback_tests.ps1`
- Godot headless editor parse và full regression không gồm MCP.

Automation xác nhận tính đúng của contract và layout cơ bản; nhịp combat,
độ “phê” của level-up và tần suất jackpot vẫn cần playtest người thật trước khi
chốt balance release.
