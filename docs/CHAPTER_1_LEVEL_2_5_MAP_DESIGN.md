# Chapter 1 — Map design Level 1–5

Các map này dùng chung một ngôn ngữ: dungeon top-down ba tầng, black void ngoài
footprint, cửa tầng hai chiều, ấn ký mở cổng, phòng chiến đấu rộng và pit có
collision. Điểm thay đổi chính là nhịp giao chiến: quái được gom thành **ba bãi
lớn** mỗi màn thay vì rải lẻ trên hành lang.

## Luật bố trí chung

- Phòng đầu mỗi tầng là vùng an toàn; không có quái trong awareness range và
  không có bẫy sát điểm xuất hiện/đích cửa/checkpoint.
- Hành lang nối bãi là khoảng nghỉ, dùng coin và torch để dẫn mắt. Quái chỉ nằm
  trong `metadata.combat_camps` và mọi ID quái thuộc đúng một bãi.
- Mỗi bãi có 4–7 quái, khoảng cách đủ cho separation/telegraph nhưng đường kính
  cụm vẫn đủ nhỏ để đọc thành một encounter duy nhất.
- Skeleton cận chiến giữ mặt vào và ép người chơi đổi vị trí. Bone Reaper đặt ở
  góc neo có đường bắn, luôn có pit/vật che và một đường áp sát.
- Spike không nằm trên spawn pad, door pad hoặc checkpoint. Nếu coi toàn bộ
  spike là ô bị chặn, mọi ấn ký và cổng thoát vẫn phải tới được.
- Patrol radius được giữ nhỏ trong camp room vì enemy AI hiện dùng steering/LOS,
  chưa có navigation mesh.

## Level 1 — Hầm Mộ Khai Ấn

Level 1 đã được thiết kế lại thành ba bãi `4/4/4` Skeleton, thay cho năm quái
rải lẻ trước đây. Phòng spawn giữ nguyên tọa độ canonical để tutorial và tool cũ
không bị gãy. Mỗi tầng dạy một kỹ năng không gian: rút lui quanh pit nhỏ, kite
vòng pit lớn, rồi đọc đội hình wedge quanh cover trước cổng thoát.

## Level 2 — Ngã Ba Cốt Trắng

Mục tiêu thiết kế: dạy người chơi đọc route risk/reward trước khi tăng độ khó cơ
chế quái.

| Hạng mục | Thiết kế |
|---|---|
| Roster runtime | 15 Skeleton, chia 5 / 5 / 5 |
| Bẫy | 6 spike, đặt ở hai nhánh, vòng pit và slalom cuối |
| Ấn ký | Có 4, chỉ cần 3; hai nhánh đầu cho phép bỏ một lựa chọn |
| Điểm đặc biệt | Fork hai nhánh hội tụ; ring combat; slalom hai lane |
| Nhịp | Đọc route → bãi 5 → nghỉ/checkpoint → bãi 5 → nghỉ → bãi 5 → exit |

Bãi đầu khóa hai cửa hội tụ bằng đội hình khiên. Bãi hai dùng pit giữa phòng để
người chơi kite quanh vòng. Bãi ba giữ hai lane của slalom, tạo cảm giác đông
nhưng không biến thành một khối collision hỗn loạn.

Bonus density optional đầu tiên được neo tại cell `[50, 13]` để tạo một scout sớm sau
phần đọc route. Scout không thuộc roster/objective và không khóa cổng; mọi bonus density
còn lại vẫn sinh cạnh camp gốc.

## Level 3 — Thư Khố Giao Hỏa

Mục tiêu thiết kế: giới thiệu crossfire có vật che, buộc người chơi quyết định
áp sát Reaper nào trước.

| Hạng mục | Thiết kế |
|---|---|
| Roster runtime | 15 Skeleton + 5 Bone Reaper, chia 7 / 7 / 6 |
| Bẫy | 10 spike, chủ yếu báo hướng lane và phạt chạy thẳng |
| Ấn ký | Có 5, chỉ cần 4; cache phụ là lựa chọn rủi ro/phần thưởng |
| Điểm đặc biệt | Hai Reaper anchor/bãi đầu; pincer crossfire/bãi hai; split lane/bãi cuối |
| Nhịp | Cover lesson → 5+2 → nghỉ → 5+2 → nghỉ → 5+1 → exit |

Skeleton tạo màn chắn cận chiến, Reaper đứng ở hai góc khác nhau thay vì chồng
cùng một tuyến bắn. Pit trong arena là cover thật, đồng thời để lại đường vòng đủ
rộng cho player và AI.

Bonus density optional đầu tiên được neo tại cell `[60, 10]`, đưa lần giao tranh đầu
lên trước bãi crossfire mà không thay roster 7 / 7 / 6, objective hay gate.

## Level 4 — Thánh Tích Xoắn Ốc

Mục tiêu thiết kế: kiểm tra khả năng giữ nhịp né bẫy rồi chuyển ngay sang đọc
đội hình elite-ready. Roster Level 4 có xác suất elite cao nhất (40%).

| Hạng mục | Thiết kế |
|---|---|
| Roster runtime | 10 Skeleton + 5 Bone Reaper, chia 5 / 5 / 5 |
| Bẫy | 12 spike theo nhịp xen kẽ quanh spiral/ring |
| Ấn ký | 4/4; ấn ký spiral buộc người chơi hoàn thành vòng dài |
| Điểm đặc biệt | Spiral commitment; pinwheel crossfire; broken-cross arena |
| Nhịp | Trap execution → bãi 5 → nghỉ → bãi 5 → trap ring → nghỉ → bãi 5 |

Số quái thấp hơn Level 3 nhưng vị trí khó hơn: hai Reaper ở bãi hai sở hữu hai
góc chéo, còn bãi cuối tách đội hình qua các pit lệch nhau. Checkpoint luôn nằm
trước phần tăng áp, không nằm giữa bãi.

## Level 5 — Lò Hiến Tế Huyết Cốt

Mục tiêu thiết kế: màn cao trào có ba bãi hộ vệ, Vampire độc nhất và một
antechamber cho boss để người chơi nhìn toàn arena trước khi bước vào.

| Hạng mục | Thiết kế |
|---|---|
| Roster runtime hiện có | 10 Skeleton + 5 Bone Reaper + 1 Vampire, chia 6 / 6 / 4; sau đó 1 KingdomArcher |
| Bẫy | 14 spike, dày nhất nhưng vẫn có lối né không nhận damage |
| Ấn ký | 4/4; mỗi chặng lớn trả một mốc tiến độ rõ ràng |
| Điểm đặc biệt | Blood ring; Vampire court; last guard; KingdomArcher boss crucible |
| Nhịp | 4+2 → nghỉ → 3+2+Vampire → nghỉ → 3+1 → boss antechamber → arena |

`metadata.special_zones.l5_hooded_archer_arena` trỏ tới entity
`l5_hooded_archer_miniboss` tại cell `[95, 74]`. Archer dùng boss scene/profile
riêng với line telegraph, projectile, spacing AI và poise. Encounter theo dõi đủ
17 combatant; hạ 16 guardian vẫn không mở cổng. Sau khi hạ Archer, người chơi còn
phải tương tác với Normal Level-1 Archer Hero Soul vật lý; chỉ pickup transaction
mới cấp ownership và hoàn tất objective mở exit.

## Dữ liệu và kiểm tra

- Generator: `tools/generators/generate_chapter_1_levels_2_to_5.gd`
- Builder dùng chung: `tools/generators/chapter_1_map_builder.gd`
- JSON canonical: `data/levels/crypt_entrance.json` và
  `data/levels/chapter_1_level_2.json` đến `chapter_1_level_5.json`
- Regenerate: `tools/regenerate_chapter_1_maps.ps1`
- Semantic/runtime test: `tools/run_chapter_1_map_design_tests.ps1`

Test kiểm schema, load qua `DungeonLevel`, số roster, camp clustering, enemy
spacing, patrol clearance, ba footprint, cặp cửa hai chiều, reachability qua cửa,
spawn/checkpoint safety, spike bypass và Archer spawn anchor. Focused runtime
suite `tools/run_chapter_1_level_5_miniboss_tests.ps1` xác minh boss bắt buộc,
physical pickup và tính đúng-một-lần. Các suite này cũng được
gắn vào `tools/run_full_regression.ps1`.
