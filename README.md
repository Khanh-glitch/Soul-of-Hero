# SOUL OF HERO

Prototype action RPG 2D top-down bằng Godot 4.7. Bản hiện tại tập trung vào một
vertical slice Chapter 1 có thể chơi từ Level 1 đến Level 10, với hai Hero
Identity sản xuất là Sword và Archer, Soul Relay hai chiều, tiến trình nhân vật,
Hero Soul, ba ô trang bị phụ Armor/Boots/Jewelry, campaign reward và boss hai phase.

## Trạng thái sản phẩm

- **Đã có route chơi liên tục:** Home Map → Campaign → Level Details → gameplay
  → chọn đi ải kế/chơi lại/chọn ải/trở về nhà, cho toàn bộ Chapter 1
  (Level 1–10). Gameplay không còn bắt người chơi đi qua màn Results.
- **Đã có hai Hero thật:** Sword và Archer. Ở Level 5, Archer xuất hiện như boss
  phe địch; chỉ khi hạ boss rồi tự tay nhặt Normal Archer Hero Soul vật lý thì
  Archer mới thuộc sở hữu. Pickup chỉ đưa Soul vào tủ đồ; người chơi phải bấm
  Equip để kích hoạt đúng Soul/Hero và hiệu ứng ngay, kể cả trong chính ván đó
  nếu mở được tủ đồ. Level 6 dạy Relay Sword ↔ Archer.
- **Đã có meta ảnh hưởng combat:** HP/Power/Mana, sáu track kỹ năng mỗi Hero,
  Hero Soul instance/rarity/affix, ba ô Vessel/Boots/Jewelry, nâng gear bằng đá
  cùng rarity, bán và fusion có feature gate.
- **Đã có loop reward/save realtime:** XP, level-up và đồ nhặt bằng `E` được
  ghi ngay trong trận; reward first-clear vẫn chính xác một lần, replay không
  nhân đôi reward, save có migration và backup.
- **Đã có ba độ khó theo từng màn:** Easy là mặc định; sau first-clear có thể
  chọn Medium/Hard. Độ khó tăng HP/damage/speed, mật độ và quái đột biến, đồng
  thời tăng luck cho rarity rương và đồ rơi.
- **Chưa phải prototype 100 level:** data contract chứa sức chứa 10 chương × 10
  level, nhưng nội dung được author/kiểm thử đầy đủ hiện mới là Chapter 1. Level
  11–100, Monster Soul runtime, Monster Parts, gacha/shop và các mode endgame
  vẫn là roadmap.

Xem trạng thái chi tiết tại
[`docs/IMPLEMENTATION_STATUS_V0_4.md`](docs/IMPLEMENTATION_STATUS_V0_4.md) và
audit phiên làm việc tại
[`docs/AUDIT_TONG_THE_PHIEN_CHAT_2026_07_15.md`](docs/AUDIT_TONG_THE_PHIEN_CHAT_2026_07_15.md).
Trạng thái số liệu và balance **đang vận hành** được chốt tại
[`docs/KEEPTRACK_POWER_LEVEL_REBALANCE_2026_07_16.md`](docs/KEEPTRACK_POWER_LEVEL_REBALANCE_2026_07_16.md);
chỉ mục phân biệt audit hiện hành/lịch sử nằm ở
[`docs/KEEPTRACK_INDEX.md`](docs/KEEPTRACK_INDEX.md).
Contract loop realtime mới nằm tại
[`docs/CONTINUOUS_RUN_LOOT_LOOP_2026_07_16.md`](docs/CONTINUOUS_RUN_LOOT_LOOP_2026_07_16.md).
Đặc tả canonical của boss, playable Hero, cân bằng và asset Archer nằm tại
[`docs/ARCHER_LEVEL_5_DESIGN.md`](docs/ARCHER_LEVEL_5_DESIGN.md).

## Chạy project

Mở thư mục bằng Godot 4.7 rồi chạy project; main scene là
`game/app/app_root.tscn`.

```powershell
.\.tools\godot\Godot_v4.7-stable_win64.exe --path .
```

Nếu Godot Editor đang chạy từ trước khi code được cập nhật, hãy dừng cửa sổ
DEBUG hiện tại và chạy lại để script/scene mới được nạp đầy đủ.

## Điều khiển

| Hành động | Bàn phím/chuột | Controller |
| --- | --- | --- |
| Di chuyển 8 hướng | WASD / phím mũi tên | Left stick |
| Normal Attack / combo | J / chuột trái | X |
| Active Skill | K / chuột phải | Y |
| Dash | Space | A |
| Soul Relay slot 1 | Q | LB |
| Tương tác | E / F | Back; A trong Home Map |
| Sổ Hành Trình trong trận | I / Tab | RB |
| Pause | Esc | Start |

Sword dùng combo bốn nhịp và Soul Echo (32 Mana). Archer dùng chuỗi Quick Shot →
Split Step → Armor Piercer để tích/tiêu Focus và Soul Mark (32 Mana). Axe được
dời sang mốc tuyển mộ sau; prototype combat cũ vẫn được giữ tương thích. HUD hiển thị HP,
stamina, Mana, mục tiêu/rarity, damage-combo popup và thanh XP realtime. Sổ
Hành Trình BookLite chỉ có hai khu lớn: **Tủ đồ & Trang bị** (Hero Soul được
xử lý như trang bị, có 4 số lớn HP/Mana/POWER/DMG và 12 chỉ số hiệu dụng; khi
chọn gear chưa equip, các số bị tác động hiện chênh lệch `+/-`, cùng sáu slot và
kho 30 ô 6×5 không cần cuộn) và **Nâng cấp** (stat + skill), tất cả cập nhật mà
không dừng combat. Click chỉ mở chi tiết khi nhả chuột; nếu đã bắt đầu kéo thì
thao tác selection bị hủy để drag/drop không tự bật item.

Khi Archer ở Reserve, Dash để lại Archer bắn ngược tại điểm bắt đầu trong 2
giây; bấm `Q` trong cửa sổ này để Chuyển Hồn sang Archer ngay tại đó.

Chuột trái/phải ưu tiên mục tiêu hợp lệ gần con trỏ; nếu không có mục tiêu thì
đòn đánh vẫn đi theo hướng trỏ chuột. Click trong animation bắn của Archer được
buffer đúng một phát kế tiếp. Độ rộng vùng bắt mục tiêu được chỉnh bằng **Hỗ trợ
ngắm** trong Settings.

Trong Attack/Skill, visual, vũ khí và hit direction giữ theo hướng tấn công đã
chốt; input di chuyển vẫn độc lập. Nhân vật vì vậy có thể vừa lùi vừa đánh mà
không quay đòn về phía lùi, rồi trả quyền facing cho movement ngay khi recovery
kết thúc.

Khi Sword ở Reserve, ba melee threat độc nhất gần người chơi tự materialize Soul
Interception; Sword dùng đúng visual riêng và một lần bấm `Q` trong lúc visual còn
hiện sẽ chuyển quyền điều khiển sang Sword.

## Chapter 1 hiện tại

| Level | Nội dung chính | Mốc tiến trình |
| ---: | --- | --- |
| 1 | Ba bãi phục kích Skeleton, 3 ấn ký, cổng thoát | Magic Vessel Lv2 |
| 2 | Chọn nhánh và thu 3/4 ấn ký | Pacing/route choice |
| 3 | Reaper, pit và pressure tầm xa | Magic Boots Lv4 |
| 4 | Bẫy xoắn ốc và elite | Elite literacy |
| 5 | Hooded Archer boss + Archer Soul vật lý | Nhặt Normal Archer Soul Lv1, mở Soul Relay |
| 6 | Ba Soul Anchor, Relay Sword ↔ Archer | Magic Jewelry Lv7; mở phân bổ/respec kỹ năng |
| 7 | Bảo vệ Beacon 900 HP qua ba wave | Mở entitlement `soul_jewelry` |
| 8 | Chọn Reaper/Vampire, Elite theo các trục áp lực, rương vật lý | Epic Vessel, inventory và sell |
| 9 | Ba Gate Seal + Crimson Reaper x3 | Rare Sword Soul, mở boss gate |
| 10 | Vampire Castellan liên tục hai phase | Epic Soul, Fusion, Chapter 2 access |

Level 10 replay có bounty nhỏ theo run receipt; nó không trao lại Epic Soul,
Player Level hay feature unlock.

## Hệ thống meta đã nối vào gameplay

- Account/Player Level tối đa 100; mỗi level cấp 5 Stat Point và 2 Skill Point.
  Level chỉ tăng tự động HP và Mana theo đường hình học trơn: bước đầu là
  20 HP và 10 Mana, mỗi bước sau bằng 99% bước trước. Level không cộng sát
  thương; muốn tăng sát thương nền phải đầu tư vào Power.
- Ba stat HP, Power, Mana dùng một diminishing-return liên tục, không có
  breakpoint sức mạnh ẩn; milestone cũ chỉ còn là catalog compatibility.
- Sáu skill track mỗi Hero, rank tối đa 20: Normal, Active, Dash, Soul Ready,
  Summon và Departure. Mỗi rank đã dùng bởi runtime combat.
- Tám rarity Hero Soul: Normal, Magic, Rare, Epic, Legendary, Crystal, Mythic,
  Eternal. Mỗi Soul có UUID, item level, affix, favorite/lock/equipped state.
- Hero Soul được chọn theo exact instance; Soul đang dùng/khóa/favorite được bảo
  vệ khỏi thao tác phá hủy. Sell mở sau Level 8; fusion 3→1 mở sau Level 10.
- Ba ô trang bị phụ dùng chung cho team là Vessel/Armor (HP và chống chịu),
  Boots (movement/Dash) và Jewelry (Power/Mana/cooldown). Mọi affix trong pool
  random live đều có consumer runtime; slot thứ 5 trên trang equipment là Boots,
  slot thứ 6 là Jewelry.
- Gear có `upgrade_rank` 0–5; mỗi lần dùng một đá cùng rarity và tăng toàn bộ
  primary/affix thêm 3% roll gốc. Crystal là vật liệu nâng cấp, không phải slot
  trang bị.
- Mana hồi cơ bản 2/s; tổng cooldown reduction từ rank, milestone, Soul và gear
  dùng chung cap 35%.

Điểm đầu tư đầu tiên trả 14 HP, 4% Power hoặc 7 Mana; lợi ích giảm trơn
đến đúng một nửa ở điểm 200 để lựa chọn có phản hồi rõ. Các affix/milestone
chưa có consumer combat vẫn được Arsenal ghi
`NOT YET LIVE`/`PLANNED`.

## Save và tính đúng-một-lần

`SaveService` lưu progression, campaign, Hero Soul exact instances, team,
skills, stat allocation, gear, feature unlock và transaction receipts. Writer
dùng file tạm, validation, rotating backup và migration cho save cũ. Campaign
reward, fusion, sell và Level 10 replay bounty đều có gate/idempotency test.
Save tạo trước economy Power được giữ nguyên allocation, lưu bản audit và nhận
một lần phân bổ lại Stat miễn phí theo giao dịch atomic ngoài combat.
Save equipment v1 được nâng lên v2: gear cũ nhận rank 0; legacy Soul Focus được
archive rồi đổi thành đúng một đá cùng rarity cho mỗi item; loadout live được
chuẩn hóa thành Vessel/Boots/Jewelry mà không xóa item Jewelry bị khóa bởi level.

QA script sử dụng cả `SOUL_OF_HERO_SAVE_PATH` và
`LIVING_ARSENAL_SAVE_PATH` để cách ly profile; không được trỏ test vào save người
chơi thật.

## Kiểm thử

Chạy cổng regression không gồm MCP:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_full_regression.ps1 -SkipMcp
```

Các runner tập trung đáng chú ý:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_10_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_10_visual_capture.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_mana_meta_core_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_visual_runtime_acceptance.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_progression_difficulty_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_realtime_loot_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_continuous_hud_ui_tests.ps1
```

Cảnh báo `RealtimeBridge ... 9080 (Already in use)` chỉ nói một Godot process
khác đang giữ cổng debug tùy chọn; nó không phải lỗi gameplay nếu suite vẫn trả
exit code 0.

## Biên giới trung thực của bản build

- Chapter 1 đã có automation mạnh, nhưng vẫn cần nhiều phiên chơi người thật để
  chứng minh cân bằng, độ vui và nhịp 3–8 phút/ải.
- Monster Soul mới có rules/foundation và được định hướng mở ở Level 50; chưa có
  save inventory, loot, UI hay combat adapter production.
- Monster Parts/Forge, gacha/shop, Hunt mission, Challenge, Depth và nội dung
  Level 11–100 chưa hoàn thiện.
- Archer đủ asset để chạy gameplay prototype; Hero Soul/portrait/HUD identity,
  visual polish và release manifest vẫn là gate. Asset GandalfHardcore cấm dùng
  làm đầu vào AI; generated presentation art phải dùng prompt text-only độc lập.
- Axe đã rời milestone Level 5. Combat/save prototype được giữ tương thích nhưng
  boss, reward và asset production được dời sang một mốc campaign sau.
- Không có asset trả phí hoặc quyết định thanh toán nào được thực hiện trong quá
  trình này.

## Cấu trúc chính

```text
game/app/                     AppRoot/AppFlow và route sản phẩm
game/main.gd                  runtime level/encounter production
game/characters/knight/       controller Sword/Archer, Axe compatibility, Mana
game/heroes/                  Hero definitions và Soul Relay/team manager
game/meta/                    progression, Hero Soul, equipment, Monster Soul rules
game/content/                 typed level/encounter/reward contracts
game/levels/objectives/       runtime riêng cho các objective L6–L10
game/ui/                      HUD, BookLite Field Codex, continuation, Home/Arsenal
game/loot/                    rarity, jackpot, physical ground loot, runtime director
data/content/                 registry, level, encounter, roster và reward
data/levels/                  map JSON deterministic
tests/                        static/live/fresh-route/idempotency/visual tests
tools/                        generators và regression runners
docs/                         spec, audit, QA và implementation status
```
