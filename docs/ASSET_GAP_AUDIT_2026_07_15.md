# Audit asset còn thiếu sau đợt nâng cấp — 2026-07-15

> **Cập nhật sau production pass:** font tiếng Việt, input glyph, các VFX bespoke P0,
> SFX variation/foley, Chapter I key art và emblem đã được triển khai. Xem trạng thái và
> kiểm thử tại `docs/UI_UX_VFX_SFX_IMPLEMENTATION_2026_07_15.md`. Những gap còn thực sự
> mở là music/ambience, hồ sơ license ba bộ character và content Level 02–20/elite/boss.

Tài liệu này chỉ liệt kê những phần **không thể hoàn thiện tốt bằng kho asset hiện
có**. Các gói hiện hữu đã được ưu tiên tái sử dụng trước; không cần tải thêm một
pack icon, inventory frame, smoke, impact hay UI click chung chung khác.

## 1. Những gì đã dùng được ngay

### UI/UX

- Free Inventory: panel, slot, frame và trạng thái nút.
- Shikashi Fantasy Icons: icon menu, HUD, campaign và CTA.
- Dungeon tiles, torch và sprite Hero: backdrop cho Boot, Title và toàn bộ shell.
- Theme dark-dungeon thống nhất cho Title, Hub, Campaign, Hero Roster, Modes,
  Bestiary, Settings, Details, Results, Credits, HUD và mobile controls.
- Đã có normal, hover, focus, pressed, disabled, cooldown/disabled state và
  phản hồi âm thanh UI tự động cho button được tạo động.

### VFX

- Super Pixel Effects/unTied: smoke, blood splatter, skull smoke, sparkle,
  absorb, impact vàng và impact định hướng.
- CodeManu: Soul manifestation, shield/interception và các impact đã chọn lọc.
- Sword: white/ivory impact, Crescent Recoil, Echo wave, Echo spawn/activation,
  Combo 4 X impact, Soul Interception và Returning Blade.
- Axe: charge milestones, cleave, throw/return trail, catch và Cross Cut.
- Enemy: bone hit/death, Reaper disc/trail/recall, Vampire lunge/blood/leech/death.
- World: torch pickup/place, coin, sigil, chest, checkpoint, floor door và exit.
- Telegraph và hitbox vẫn là code vì đây là lớp timing/accessibility, không phải
  art tạm.

### SFX

- 33 WAV thật từ RPG Essentials đã được chọn lọc vào project thay vì import cả
  archive.
- Đã có cue cho UI, Sword, Soul Echo, Relay, Axe, dash, bước chân, ba enemy,
  player hit/death/respawn, checkpoint, sigil và objective.
- Không còn synth/procedural waveform. SFX và UI có bus/slider riêng, volume mặc
  định được giữ thấp để tránh cảm giác chói hoặc spam.

## 2. P0 — cần bổ sung trước khi gọi bản art/audio là release-ready

Các mục P0 dưới đây không chặn playtest; chúng chặn chất lượng và pháp lý khi
phát hành.

### A. Font pixel tiếng Việt

Kho hiện tại không có font production phù hợp.

Yêu cầu:

- License OFL hoặc commercial rõ ràng.
- Đủ toàn bộ dấu tiếng Việt, chữ hoa, chữ thường, số và ký hiệu gamepad.
- Đọc tốt ở 10–16 px, có thể dùng cho damage number và HUD nhỏ.
- Nên có regular + bold hoặc một family variable duy nhất.

Không dùng font pixel chỉ hỗ trợ ASCII rồi bỏ dấu hoặc ghép dấu bằng sprite.

### B. Art nhận diện riêng

UI hiện đã hoàn chỉnh về cấu trúc nhưng thiếu key art riêng để thoát cảm giác
“UI kit”. Cần tạo:

| Deliverable | Kích thước gợi ý | Ghi chú |
| --- | ---: | --- |
| Logo `SOUL OF HERO` | 1024×256 RGBA | Bản ngang, monochrome và icon vuông |
| Sword portrait | 512×512 | Cùng palette/silhouette với sprite đang dùng |
| Axe portrait | 512×512 | Giữ đúng AxeWarriorRPG đã chốt |
| 3 enemy portraits | 384×384 mỗi ảnh | Skeleton, Bone Reaper, Blood Vampire |
| Chapter I key art | 1280×720 | Hầm mộ top-down, dùng được làm campaign card |
| App icon | 512×512 | Đọc rõ cả ở 32×32 |

Portrait là art UI, không thay sprite gameplay và không yêu cầu thêm bốn hướng.

### C. VFX đặc thù không thể lấy chuẩn từ pack generic

Những effect hiện tại đã chạy và đọc được trong combat. Danh sách dưới đây là
pass bespoke cuối để mỗi tướng/quái có identity riêng:

| Bộ | Asset cần tạo | Chuẩn gợi ý |
| --- | --- | --- |
| Axe | spinning axe projectile thật | 32×32, 8–12 frame |
| Axe | 3 cấp heavy cleave arc | 64×48, 80×56, 96×64; 6–8 frame/cấp |
| Axe | charge aura riêng | 64×64, loop 8 frame |
| Bone Reaper | spectral sickle/disc riêng | 48×48, loop 8 frame |
| Bone Reaper | outbound/return trail riêng | 16×16 hoặc 32×16, loop 4 frame |
| Vampire | blood blink departure/arrival | 48×48, 7–9 frame mỗi effect |
| Vampire | leech tether + hai end-cap | tile 16×32, seamless |
| Sword | pursuit target marker | 24×24, loop 6 frame, trắng/ivory |
| Sword | authored Echo ribbon | 48×24, 4–6 frame, alpha trung tính |

Không cần tạo lại full-body Sword Echo: runtime đã mirror đúng animation của
Sword. Chỉ marker/ribbon bespoke mới còn tạo thêm giá trị.

### D. Audio không có trong kho hiện tại

RPG Essentials đủ cho prototype nhưng không có music/ambience và chưa có nhiều
variation theo vật liệu. Cần tìm hoặc thu/tạo:

1. Dungeon ambience loop 60–120 giây: room tone, gió nhẹ, nước nhỏ, xa mơ hồ;
   không có giai điệu lấn combat.
2. Combat music loop + low-health layer + victory sting.
3. Mỗi nhóm ít nhất 3 variation: blade whoosh, blade hit, axe heavy whoosh,
   axe impact, bone hit, flesh hit và footstep stone.
4. Foley riêng: torch pickup/place, door stone, chest open, coin/sigil pickup,
   Reaper disc outbound/return và Axe catch.
5. Soul Echo activation/execute và Soul Relay arrival/departure có identity âm
   sắc riêng, thay vì reuse spirit wind/teleport chung.

Chuẩn bàn giao:

- Spatial one-shot: WAV mono, 44.1 hoặc 48 kHz, không normalize quá gắt.
- UI: WAV mono hoặc stereo ngắn, tail sạch.
- Music/ambience: OGG stereo có loop point sạch; giữ source WAV master ngoài build.
- Mỗi pack phải kèm license snapshot, tác giả, URL nguồn và điều khoản attribution.

### E. Hồ sơ quyền sử dụng

Cần lưu bản license/readme gốc cho:

- FreeKnight/Sword base.
- Enemy Animations Set/Pixel_Poem.
- AxeWarriorRPG và mọi derivative được dùng trong release.

Đây là P0 release blocker dù game vẫn chạy. License của dungeon, Shikashi,
CodeManu, unTied, Free Inventory và RPG Essentials đã có notice cục bộ.

## 3. P1 — thêm sau khi P0 được chốt

- Input glyph pack đồng bộ cho keyboard, Xbox, PlayStation và touch.
- Tutorial illustration cho move, dash, combo 1–4, Soul Echo, Soul Relay, torch.
- Reward/rarity reveal, mastery level-up và chapter-complete animation riêng.
- Boss/elite VFX chỉ sản xuất sau khi moveset và telegraph shape đã khóa.
- Key art/card cho Level 02–20 chỉ làm khi nội dung từng level tồn tại; UI slot trống
  hiện tại là trạng thái nội dung, không phải lỗi UI asset.
- Accessibility art variants: reduced flash, high-contrast và color-safe telegraph.

## 4. Không nên tải thêm

- Pack icon fantasy chung chung: Shikashi đã đủ coverage.
- Pack inventory/panel chung: Free Inventory + theme hiện tại đã đủ.
- Pack explosion/smoke tổng hợp: hai kho VFX hiện tại đã dư generic effect.
- Character side-view/platformer hoặc bộ 4 hướng bắt buộc: game dùng top-down 360°
  cho logic nhưng visual Hero/enemy chỉ cần trái/phải như thiết kế đã chốt.
- Archive hàng nghìn frame đưa thẳng vào `res://`: chỉ curate các sheet dùng thật.

## 5. Thứ tự mua/tạo đề nghị

1. Chốt license FreeKnight, enemy và Axe.
2. Chọn font pixel tiếng Việt.
3. Làm logo + Sword/Axe/3 enemy portraits.
4. Tạo Axe/Reaper/Vampire bespoke VFX trong bảng P0.
5. Thuê/tìm ambience, music và các SFX variation/foley còn thiếu.
6. Sau khi core loop được duyệt mới sản xuất boss, Level 02–20 và progression art.

## 6. Tiêu chí nhận asset

- PNG RGBA, straight alpha, không black matte; import nearest filtering.
- Sprite gameplay bất đối xứng vẽ hướng phải, pivot rõ, runtime có thể rotate 360°.
- Metadata kèm frame size, count, FPS, loop, pivot và blend mode.
- Không thay telegraph timing bằng animation; sprite chỉ phủ lớp cosmetic.
- Tên file ổn định theo domain: `hero_action_variant`, `enemy_action_variant`,
  `ui_state`, `sfx_family_variant_01`.
- Mọi nguồn ngoài phải có license snapshot trước khi được chuyển vào production.
