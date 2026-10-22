# Điều khiển SOUL OF HERO

| Semantic action | Desktop | Controller | Gameplay |
| --- | --- | --- | --- |
| `move_left/right/up/down` | WASD / arrows | Left stick | Di chuyển top-down 8 hướng |
| `attack` | J / left mouse | X | Sword combo 1–4; Archer: Quick Shot → Split Step → Armor Piercer |
| `skill` | K / right mouse | Y | Sword: Soul Echo (32 Mana); Archer: Soul Mark (32 Mana) |
| `dash` | Space | A | Dash; Sword giữ combo step/timer; Archer giữ Focus nhưng timer vẫn chạy |
| `soul_relay_1` | Q | LB | Summon Reserve Soul / Relay trong takeover window |
| `soul_relay_2` | không bind | không bind | Capacity tương lai, hidden/locked |
| `interact` | E / F | Back | Tương tác world và nhặt ground loot; E là phím hiển thị chính |
| `field_codex` | I / Tab | RB | Mở/đóng Sổ Hành Trình realtime; combat không pause |
| `pause` | Esc | Start | Pause |

Sword là Hero mở đầu. Ở Level 5, người chơi phải hạ KingdomArcher, đến gần Soul
vật lý rơi ra và nhấn `E`; chỉ pickup đó mới cấp Normal Archer Soul Lv1 cùng
Soul Relay vào tủ đồ. Pickup không tự vào Reserve và chưa áp hiệu ứng. Người chơi
mở khu **Tủ đồ & Trang bị** rồi bấm **Trang bị** trên đúng Soul (hoặc kéo Soul
vào ô chính/dự bị) để kích hoạt Archer/hiệu ứng ngay, kể
cả trong chính ván đó; sau khi Archer đã được xếp vào team, Q gọi Summon Skill
của Reserve rồi Q lần hai trong takeover window để đổi Active/Reserve hai chiều.
HUD tự đổi tên Attack/Skill theo Hero đang Active.

Đồ do quái/rương làm rơi không tự vào kho: chờ món đồ đáp đất, đứng gần rồi
nhấn `E`. Tên món gần nhất xuất hiện bằng màu rarity ở giữa phía trên, không có
panel bọc riêng. Field Codex chỉ có hai khu: **Tủ đồ & Trang bị** (Hero Soul và
đồ dùng chung, có ô trống/kéo thả/chi tiết) và **Nâng cấp** (stat + skill).
World pickup chỉ thêm Soul vào kho và không tự đổi team; thao tác Trang bị trong
Codex là trigger duy nhất để kích hoạt exact Soul/Hero/hiệu ứng ngay. Việc kích
hoạt này không phụ thuộc vào lúc bắt đầu ván mới.

Mana hồi cơ bản 2 điểm/giây và có thể được tăng bởi stat milestone, Hero Soul
hoặc trang bị phụ. Nếu không đủ Mana, cast bị từ chối trước khi tạo effect:
không trừ Mana, không bật cooldown và HUD hiện `THIẾU MANA current/cost`.

Các tên `spirit_swap_1/2` chỉ là alias automation cũ, không có physical binding
và không xuất hiện trong UI.
