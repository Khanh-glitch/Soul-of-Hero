# Audit asset SOUL OF HERO — 2026-07-14

> **Có audit mới hơn:** inventory/import/downloaded-library và shortlist content
> ngày 2026-07-15 nằm tại
> `docs/DOWNLOADED_ASSET_LIBRARY_AND_CONTENT_PLAN_2026_07_15.md`. File này giữ
> lại baseline 2026-07-14 để đối chiếu lịch sử.
>
> **Archer delta 2026-07-16:** GandalfHardcore Archer đã được promote làm
> playable/boss runtime cho Level 5. Audit coverage, gap và giới hạn cấm dùng
> sheet làm AI reference nằm tại `docs/ARCHER_LEVEL_5_DESIGN.md`; các dòng gọi
> Archer là “legacy Bow” bên dưới chỉ là snapshot cũ.

Đây là inventory hiện hành để lên kế hoạch asset. Trạng thái gameplay/UI được
phân biệt rõ với chất lượng art production; một hệ thống chạy được không đồng
nghĩa art đã hoàn chỉnh.

## Nguồn đã kiểm tra hôm nay

Downloads có 9 archive: 8 ZIP và 1 RAR.

| Archive | Quyết định hiện tại |
| --- | --- |
| `2D Pixel Dungeon Asset Pack v2.0.zip` | Nguồn dungeon top-down đang dùng; cần giữ snapshot giấy phép/tác giả gốc |
| `Enemy_Animations_Set.zip` | Skeleton Swordsman, Bone Reaper và Blood Vampire đang dùng; cần lưu notice Pixel_Poem trước release |
| `FreeKnight_v1.zip` | Visual nền của Sword Hero; **chưa có license/readme local**, là release blocker |
| `Shikashi's Fantasy Icons Pack v2.zip` | Nguồn icon HUD; commercial/remix được cho phép theo notice local, các design dẫn xuất `game-icons.net` cần credit CC BY 3.0 |
| `Knight.rar` | Candidate/reference; không tự động đưa vào production |
| `VFX Free Pack.zip` | Một số sheet CodeManu đã được chọn và lưu attribution thận trọng CC BY 4.0 |
| `Martial Hero.zip` | Side-view, không khớp camera top-down hiện tại |
| `Free Bow and Crossbow Icons.zip` | Legacy Bow/reference, không phải Hero production |
| `GandalfHardcore Archer.zip` | Legacy Bow/reference, không phải Hero production |

`AxeWarriorRPG` không thuộc 9 archive trên. Nó được import từ output Codex tại
`Documents/Codex/2026-07-14/fol/outputs/AxeWarriorRPG`; runtime legacy đã có full
character-form swap và 30 animation sheet. Provenance hiện **chưa được duyệt cho
commercial release**. Axe không nằm trong roster/save/tutorial/UI production của
SOUL OF HERO; để trở thành Hero thứ hai cần HeroDefinition, Active/Summon/Departure,
art approval và license approval riêng.

## Asset đang chạy

- Sword Hero: FreeKnight + bốn strip riêng `4/6/10/10` frame cho combo 1–4.
- Map: dungeon top-down, connected rooms/corridors, wall/pit/void collision.
- Skeleton Swordsman: melee threat, làm tăng Sword Soul readiness.
- Bone Reaper: ranged returning projectile, **không** cộng melee readiness.
- Blood Vampire: lunge/melee threat + leech chỉ sau confirmed hit.
- HUD icon: atlas Shikashi; giữ credit Matt Firth (`shikashipx`) và
  `game-icons.net` theo notice local.
- VFX CodeManu: Blood Impact cho hit Sword; Electric Shield cho Soul
  Interception. `Impact`, `BigHit`, `Anima`, `TheVortex`, `Hyperspeed` mới là
  candidate chưa được coi là production wiring.
- Crescent Recoil đã có projectile thật, tầm 150 px, dừng bởi World collision và
  dùng visual crescent code-native. Mục “thiếu” bên dưới chỉ là sprite art cuối,
  không phải thiếu gameplay.

## Hợp đồng visual top-down

- Hero và quái chỉ cần **hai hướng visual trái/phải**, dùng `flip_h`.
- Di chuyển, aim, dash, projectile, hitbox, telegraph và navigation vẫn là
  top-down 360°/8 hướng.
- Không yêu cầu bộ sprite N/S/4 hướng; không dùng bố cục platform/side-scroller.
- Anchor, shadow và chân nhân vật phải nhất quán để đổi animation không đổi scale
  hay “nhảy” vị trí.

## Audit UI full-game

Shell chức năng hiện có: Boot, Title, Hub 5 tab, Campaign, Hero Roster, Modes,
Bestiary, Settings, Training Details, gameplay HUD, Pause, Death, Victory và
Training Results. Các nút production dùng thuật ngữ Hero/Soul; roster chỉ có
Sword và Reserve Soul để trống. Đây là **functional shell**, chưa phải campaign
20 level hay UI art ship-ready.

| Cần cung cấp/tạo | Deliverable đề nghị | Ưu tiên |
| --- | --- | --- |
| Theme/panel thống nhất | 9-slice panel, modal, tooltip, divider, frame 3 trạng thái | P0 |
| Button states | normal/hover/focus/pressed/disabled cho desktop + touch | P0 |
| Sword identity | portrait, roster card, Soul Echo skill card, pursuit marker | P0 |
| Combat HUD | Attack/Skill/Dash/Relay icons, radial cooldown, ready/pulse/disabled states | P0 |
| Vietnamese pixel font | OFL, đủ dấu tiếng Việt, số damage và cỡ UI nhỏ | P0 |
| Enemy presentation | 3 portrait/card + telegraph/role/drop icon | P1 |
| Campaign presentation | chapter map, level/boss/locked/completed cards, objective/reward icon | P1 |
| Tutorial micro-art | movement, dash, combo 1–4, Soul Echo; keyboard/gamepad/touch variants | P1 |
| Results/modes/bestiary | reward frame, score medal, mode card, silhouette/discovery states | P1 |
| Accessibility variants | reduced-flash, reduced-motion, high-contrast outline, color-safe telegraph | P1 |
| Mobile QA states | safe-area frame, left-handed layout, button scale presets | P1 |

## Art/VFX còn thiếu

- Sprite production cho Crescent Recoil; code-native wave vẫn là fallback hợp lệ.
- Sword-shaped pursuit marker, Passing Slash ribbon và Returning Blade trail.
- Soul Echo silhouette/trail riêng đã chạy bằng translucent visual nhưng cần
  authored sprite pass để đạt chất lượng ship.
- Combo 4 X execution burst; ưu tiên repack `BigHit/Hyperspeed` thay vì load cả
  sheet lớn.
- Portrait/card cho Hero thứ hai chỉ sau khi Hero đó được duyệt; không dùng Dummy.

## Audio — tạm hoãn theo quyết định hiện tại

Cả 9 archive có **0 audio file**. Runtime cue map được giữ để thay asset sau,
nhưng `Master` bus đang mute và cả CombatAudioRouter lẫn Soul Echo fallback đều
không phát tiếng. Slider Music/SFX được giữ để không phá save/UI tương lai.

Không cần tải audio ở P0 hiện tại. Khi mở lại phase audio, ưu tiên pack CC0 hoặc
commercial royalty-free có snapshot license: blade whoosh/impact, armor-bone-
flesh hit, dash, Soul Echo/Relay và UI cue. Không dùng file không rõ quyền.

## Release blockers về license

1. Lấy và lưu license/readme gốc của `FreeKnight_v1`.
2. Lấy và lưu license/author notice gốc của `Enemy_Animations_Set`/Pixel_Poem.
3. Duyệt provenance của AxeWarriorRPG trước khi dùng ngoài legacy/debug.
4. Giữ `assets/licenses/shikashi_fantasy_icons.txt`, credit Matt Firth và phần
   dẫn xuất game-icons.net; không gán nhầm toàn pack thành CC BY 4.0.
5. Giữ `assets/vfx/codemanu/SOURCE_AND_LICENSE.md` và attribution CodeManu.
6. Dungeon `0x72` có notice CC0 local và có thể tiếp tục dùng.

## Thứ tự plan đề nghị

1. Chốt license FreeKnight + enemy trước khi tạo thêm art phụ thuộc chúng.
2. Tạo P0 UI kit + Vietnamese font + Sword portrait/HUD states.
3. Tạo Sword wave/pursuit/trail/Combo 4 production VFX.
4. Chỉ sau đó duyệt Hero thứ hai và portrait/card tương ứng.
5. Audio để deferred cho tới khi quyết định bật lại.
