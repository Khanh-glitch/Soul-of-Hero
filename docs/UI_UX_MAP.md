# LIVING ARSENAL — UI/UX map

> **SUPERSEDED / LEGACY (2026-07-14).** Tài liệu này mô tả product cũ và không
> còn là contract production. UI hiện hành dùng Hero/Soul; xem `README.md`,
> `docs/ARCHITECTURE.md` và `docs/ASSET_AUDIT_SOUL_OF_HERO.md`.

UI dùng progressive disclosure: người chơi chỉ thấy hệ thống cần cho mốc hiện tại. Asset visual cần cung cấp được audit tại [ASSET_AUDIT.md](ASSET_AUDIT.md).

## Information architecture

| Khu vực | Trang con chính | Trạng thái hiện tại |
|---|---|---|
| Title | Continue, New Game có xác nhận, Settings, Credits | **Có và đã qua UI-shell regression** |
| Campaign | 20 slot campaign + Training Details | **Shell trung thực: 0/20; chỉ Training launch được** |
| Arsenal | Loadout, weapon detail, slot/unlock state | **Có loadout UI chức năng; Mastery/Forge chưa có** |
| Modes | Hunt, Challenge, Depth | **Locked disclosure; chưa có gameplay** |
| Bestiary | Swordsman, Reaper, Vampire | **Ba card tĩnh đúng roster Training; chưa có discovery/drop data** |
| Settings | audio, display, touch, telegraph/accessibility, reset | **Có UI và persistence; runtime coverage một phần** |
| Gameplay | HUD, tutorial, pause, defeat, Training victory | **Có vertical slice, chưa phải UI production** |
| Results | score, sigil, time; Retry/Arsenal/Hub | **Có cho Training; chưa có campaign reward/Next Level** |
| Credits | attribution/source | **Có từ Title** |

Hub chỉ có tối đa năm destination chính: `Campaign`, `Arsenal`, `Modes`, `Bestiary`, `Settings`. Forge/Hunt/Mastery/Salvage/Depth là trang con, không thêm thành tab thường trực.

## Combat HUD

Logical viewport hiện tại là 640×360 landscape.

```text
┌ HP / status ───── objective/wave ───── pause ┐
│                                               │
│                  play field                   │
│                                               │
│  joystick       Hand identity   Attack Skill │
│                                  Dash Spirit  │
└───────────────────────────────────────────────┘
```

- Chapter 1: joystick, Attack, Skill, Dash, một Spirit icon.
- Sau Level 10: hai Spirit icon trực tiếp; Q/E hoặc LB/RB chọn đúng slot, không cycle.
- Hand identity nằm gần Attack/Skill; cooldown Skill và Dash đọc ngay trên control.
- Spirit icon hiển thị trigger progress + cooldown + ready pulse.
- Objective/wave gọn, tự mờ khi không có cập nhật.
- Không hiển thị currency, inventory, rarity, Part hoặc mastery thường trực trong combat.

HUD dùng atlas Shikashi cho identity/action icon cùng panel text fallback cho cooldown. Icon/radial production, font tiếng Việt và safe-area polish vẫn cần P0; text/shape fallback phải được giữ cho accessibility.

## Responsive layout

Test tối thiểu:

| Tỉ lệ | Kỳ vọng |
|---|---|
| 16:9 desktop 1280×720 | integer-ish 2× từ logical viewport, không blur |
| 16:9 phone | control tránh gesture/navigation inset |
| 18:9 và 20:9 | playfield mở rộng ngang; controls neo safe area, không kéo giãn kích thước |
| tablet landscape | giới hạn khoảng cách joystick/action để không quá xa ngón cái |

Settings đã lưu và áp dụng left-handed, button scale, joystick size/opacity khi gameplay load. Position preset chi tiết, safe-area/device QA và các tỉ lệ trên vẫn là manual acceptance cần làm; UI-shell structural test không chứng minh mobile layout production-ready.

## Screen contracts

### Level Details

Training Details hiện có tên/mô tả, mục tiêu sandbox, roster ba enemy và selected loadout; `Start`, `Arsenal`, `Back` đều có route thật. Campaign Level Details tương lai vẫn cần objective/optional objective/reward/major unlock từ `LevelDefinition`; slot MISSING không được Start.

### Arsenal/Loadout

- Tách Hand và Spirit rõ bằng label + shape, không chỉ màu.
- Weapon detail: normal attack, Hand skill, Spirit trigger, Spirit action.
- Spirit slot 2 hiện khóa trong Arsenal trước Level 10 với điều kiện cụ thể; không hiện trong combat.
- Part/rarity/mastery section chỉ xuất hiện sau gate tương ứng.
- Mọi thay đổi loadout validate duplicate weapon và slot count trước khi save.

UI hiện đã gọi save validation cho loadout và biểu diễn weapon/slot bị khóa. Part/rarity/mastery/Forge chưa được render như hệ thống hoạt động.

### Results

Training Results hiện chỉ hiển thị score, sigil và time, với `Retry`, `Arsenal`, `Hub`; không commit campaign reward. Thứ tự major unlock → item/Part → mastery → currency → optional objective và `Next Level` là contract cho Results campaign tương lai, khi đã có reward transaction idempotent.

### Pickup quan trọng

Time-slow ngắn, không dừng inventory lâu. Card có icon, tên, rarity nếu đã mở, một dòng behavior và hành động phù hợp (`Take`, `Equip After Level`, `Inspect Later`). Overflow đi Results/Lost Loot.

## Tutorial rules

- Dạy theo thứ tự movement → Sword attack → Dash Slash → Dash → Bow reward → Bow Spirit → swap.
- Chỉ một khái niệm lớn mỗi bước; callout nằm gần control liên quan.
- Tutorial flag lưu bền, không lặp trừ khi reset trong Settings.
- Pause bắt buộc chỉ dùng cho interaction đầu tiên thật cần thiết; không dùng text wall.

## Accessibility acceptance

- Icon mới có text/tooltip hoặc shape khác biệt; không dựa riêng vào màu.
- Enemy telegraph đọc palette setting và high-contrast mode; cần manual color-blind/readability acceptance trên mật độ encounter thật.
- Font production hỗ trợ đầy đủ tiếng Việt, không clip ở 8/10/12/18 logical px.
- Controller focus, touch pressed/disabled, mouse hover và keyboard back-stack đều có trạng thái rõ.
- Audio volume và fullscreen áp dụng từ panel; touch opacity/size/button scale/left-handed áp dụng ở gameplay load.
- Damage numbers, vibration, shake, aim assist, reduced effects/motion và localization còn là gap runtime dù schema/settings UI có thể đã dành chỗ.

## Visual asset dependency

Atlas HUD Shikashi đã được dùng trong HUD/app shell; panel/button/focus vẫn là Godot theme/StyleBox code-native vì các ZIP không có full UI chrome đồng nhất. Trước production polish vẫn cần P0 trong [ASSET_AUDIT.md](ASSET_AUDIT.md): 9-patch/identity skin nếu muốn art riêng, Vietnamese pixel font, tutorial micro-art, weapon portrait/VFX và accessibility variants. Shape/code-native hiện tại được giữ làm fallback.

## Trạng thái kiểm thử

Suite UI shell gần nhất pass **53/53** sau AppRoot, bao phủ Boot/Title/Hub năm tab/Campaign/Arsenal/Modes/Bestiary/Settings/Training Details/Results/Credits, retry receipt, một authority thắng qua nút Tiếp tục và Axe Training preview trong debug build. Kết quả này bảo vệ cấu trúc/navigation và product-truth states; nó không thay manual visual QA ở desktop, controller, touch device, safe area hoặc 20 campaign level chưa tồn tại.
