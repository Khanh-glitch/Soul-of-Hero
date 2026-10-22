# Ma trận nguồn asset — tái chế, tải miễn phí hay dùng Imagen

Ngày chốt: 2026-07-15

Tài liệu này chuyển `ASSET_GAP_AUDIT_2026_07_15.md` thành quyết định sản xuất cụ thể.
Mục tiêu là không làm project phình thêm bởi các pack trùng chức năng, đồng thời vẫn tạo
được bản sắc riêng cho `SOUL OF HERO`.

## 1. Kết luận điều hành

- **Không tải thêm pack UI, icon fantasy, smoke, impact hoặc VFX tổng hợp.** Kho hiện tại
  đã đủ nguyên liệu để tạo phần lớn effect gameplay còn thiếu.
- **Tải miễn phí có chọn lọc** cho những thứ cần độ chính xác hoặc coverage mà remix
  không giải quyết được: font tiếng Việt, input glyph, ambience/music và thêm variation SFX.
- **Dùng Imagen cho lớp nhận diện/marketing tĩnh**, chủ yếu là key art và emblem không chữ.
  Portrait minh họa là một nâng cấp tùy chọn; roster/bestiary trong game có thể dùng pixel
  dossier dựng từ sprite thật để khớp gameplay hơn.
- **Không dùng Imagen làm spritesheet chiến đấu hoàn chỉnh.** Tính nhất quán frame, pivot,
  timing và hitbox phải được tác giả hóa thủ công.
- Các telegraph, vùng sáng, collision, cooldown mask và visibility mask vẫn nên procedural;
  chúng là dữ liệu gameplay/accessibility, không phải art còn thiếu.

Ước lượng theo các deliverable P0 đang còn thiếu:

| Nhóm xử lý | Phần việc phù hợp |
| --- | --- |
| Xào/nâng asset hiện có | Hầu hết VFX Sword, Axe, Reaper, Vampire; UI shell; 5 pixel dossier; tutorial; level card; app icon; phần lớn SFX feedback |
| Tải free | 3 font, input glyph pixel, một số SFX/foley/ambience/music; light mask chỉ khi thật sự cần |
| Imagen | Chapter I marketing key art, emblem/ornament; portrait minh họa tùy chọn; tối đa một vài base silhouette khi không trích được từ sprite |

## 2. Quy tắc ra quyết định

1. Nếu asset cần **đúng timing, pivot, hướng, collision hoặc phải loop seamless**, ưu tiên
   procedural hoặc remix thủ công; không giao toàn bộ cho Imagen.
2. Nếu asset là **ngôn ngữ chung của game** như font, nút Xbox/PlayStation, âm thanh vật
   liệu, hãy dùng nguồn free có license rõ thay vì tự sinh.
3. Nếu asset cần **nhận diện độc bản của nhân vật/thế giới**, dùng Imagen làm base rồi
   art-direct và chỉnh tay.
4. Nếu kho hiện tại đã có đúng silhouette/motion nhưng sai màu hoặc độ dày, hãy crop,
   repack, recolor, mirror, rotate và composite trước khi tìm pack mới.
5. Mọi asset ngoài phải có `source_url`, tác giả, license, ngày tải và snapshot license
   trước khi đưa vào production.

## 3. Ma trận VFX gameplay P0

### Axe

| Asset cần | Quyết định | Công thức sản xuất | Fallback |
| --- | --- | --- | --- |
| Spinning axe 32×32, 8–12 frame | **Xào asset hiện có** | Ưu tiên region `Rect2(32,224,32,32)` đang được `game/weapons/effects/axe_throw.tscn` dùng từ `assets/ui/fantasy_icons.png` (`IconLibrary.AXE`, cell `(10,5)`). Palette-map theo Axe Warrior, outline 1 px và pre-render 8 góc 45° bằng nearest để tránh rung pixel khi xoay runtime. Có thể tách rìu từ `_Attack*.png` nếu icon không khớp. | Nếu cả icon lẫn sprite extraction đều không đạt, Imagen chỉ tạo **một base axe nhìn ngang trên nền phẳng**, sau đó vẫn phải pixel-clean và tự dựng frame quay. |
| Heavy Cleave ba cấp | **Xào asset hiện có** | Lấy ring mảnh ở các frame cuối của `VFX Free Pack/Effect_Wheel/30fps/Spritesheets/Effect_Wheel_1_273x273.png`, mask chỉ giữ sector 120–150°, tint amber rồi nearest-downsample thành 64×48, 80×56, 96×64. Hit frame ghép `symmetrical_impact_001_small_yellow`. | QA kỹ để không đọc như vòng phép. Không dùng recolor Sword crescent làm bản final vì sẽ làm Sword/Axe mất identity. |
| Charge aura | **Xào asset hiện có** | Ưu tiên `Super Pixel Effects.../spritesheet/Sci-fi/scifi_charge_up_001/scifi_charge_up_001_large_yellow/spritesheet.png` (12 frame/96×96 theo metadata), downsample 64×64, palette amber, alpha 0.35–0.7. Các mốc 50/100% đổi scale/brightness, không đổi shape. `Effect_Charged`/sparkle là layer phụ. | Dùng sparkle + shader orbit nếu sheet charge vẫn quá sci-fi sau downsample. |
| Throw/return trail | **Xào asset hiện có** | `directional_smoke_burst_001_small_white` được kéo ngắn, tint amber; code quyết định đường outbound/return, sprite chỉ là cosmetic stamp. | Line2D có texture lấy từ cùng mask. |
| Cross Cut X / catch / heavy hit | **Xào asset hiện có** | Spawn hai directional impact quay chéo, lệch 1–2 frame; catch dùng sparkle + impact nhỏ; heavy hit dùng BigHit đã crop và giảm vùng sáng. | Vẽ tay một X-mask trung tính nếu overlap không sạch. |

### Sword / Soul Echo

| Asset cần | Quyết định | Công thức sản xuất | Fallback |
| --- | --- | --- | --- |
| Pursuit target marker 24×24 | **Xào asset hiện có** | Lấy 6 keyframe 0/2/4/6/8/10 từ `scifi_charge_up_001_large_yellow`, tint `#FFFDF0`, downsample 24×24, squash Y còn khoảng 45%, alpha 0.55 và đặt dưới chân mục tiêu. Có thể thêm sword/diamond crop từ atlas ở tâm. | Tự vẽ pixel marker 24×24; không cần Imagen. |
| Authored Echo ribbon 48×24 | **Xào asset hiện có** | Lấy dải alpha sáng từ `sword_crescent_wave.png`, nén chiều cao, mirror theo Echo, animate width/alpha 4–6 frame. Giữ actor Echo là bản copy trắng/translucent của animation Sword thật. | Line2D textured bằng chính mask này; Imagen chỉ làm concept nếu hai bản đều khó đọc. |
| Echo activation / anchor | **Xào asset hiện có** | Composite sparkle trắng + Anima/Constellation đã bỏ cyan, crop còn flash ngắn; một anchor flash ở vị trí Echo giúp người chơi đọc được delay. | Tự vẽ 6 frame burst nhỏ. |
| Combo 4 X execution | **Xào asset hiện có** | Hai directional impact trắng/ivory quay đối xứng, thời điểm giao nhau có `Effect_Impact` rất ngắn. | Tự vẽ X-mask 96×96. |
| Wave launch / hit / wall dissolve | **Xào asset hiện có** | Launch dùng crescent wave + sparkle gọn; hit dùng directional impact; wall dissolve dùng white smoke theo hướng va chạm. | Không cần pack mới. |

Không tạo thêm nhiều “kiếm/linh hồn lơ lửng” quanh Sword. Soul Echo phải được đọc qua
actor phản chiếu có delay, anchor flash và ribbon gọn, không qua một cụm effect trang trí độc lập.

### Bone Reaper

| Asset cần | Quyết định | Công thức sản xuất | Fallback |
| --- | --- | --- | --- |
| Spectral sickle/disc 48×48 | **Xào trước, Imagen chỉ fallback** | Tách lưỡi/vũ khí từ `assets/characters/enemies/enemies-skeleton2_attack.png`; làm neutral-white mask, dựng 8 góc quay, ghép glow tím/xám rất mỏng từ `spell_absorb` hoặc shield. | Imagen tạo một base spectral sickle tĩnh, không tạo spritesheet. Sau đó pixel-clean và rotate thủ công. |
| Outbound/return trail | **Xào asset hiện có** | Directional smoke + spell absorb được crop thành stamp 16×16/32×16. Outbound sáng ở đầu, return sáng ở đuôi; path vẫn do code điều khiển. | Textured Line2D với hai gradient khác nhau. |
| Conjure / recall / wall hit | **Xào asset hiện có** | Conjure dùng absorb co vào tâm; recall đảo timing; wall hit dùng impact nhỏ + smoke xám. | Không cần download hoặc Imagen. |

### Blood Vampire

| Asset cần | Quyết định | Công thức sản xuất | Fallback |
| --- | --- | --- | --- |
| Blink departure/arrival | **Xào asset hiện có** | Composite `scifi_warp_002_large_red` với `burst_splatter_001_large_red`, downsample 48×48 và hue-map crimson. Departure chạy warp thuận + splatter ra ngoài; arrival đảo/trim warp, xoay splatter 180°. Giữ alpha thấp để không đọc như cổng sci-fi. | White smoke/`spell_absorb` chỉ là fallback; không cần Imagen. |
| Lunge smear | **Xào asset hiện có** | Kéo xiên directional splatter theo vận tốc, thêm một dải trắng tối đa 1–2 frame để giữ độ đọc. | Line2D textured. |
| Leech tether + end-cap | **Procedural + xào asset** | Crop một streak ngang từ `VFX Free Pack/Effect_Hyperspeed/...Effect_Hyperspeed_1_517x515.png` thành tile seamless, palette crimson, animate UV trên Line2D; `spell_absorb` làm hai end-cap. Logic chiều dài và va chạm vẫn procedural. | Tự vẽ tile seamless 16×32; Imagen không phù hợp vì khó đảm bảo seamless/pivot. |
| Heal / spirit drain / death | **Xào asset hiện có** | Heal đảo absorb vào tâm; drain dùng violet/red pulse; death dùng red mist + skull/smoke nhưng bỏ mọi glyph/chữ có sẵn trong `spell_death`. | Vẽ tay mist mask nếu glyph không tách sạch. |

### Dungeon và feedback chung

| Nhu cầu | Quyết định | Cách làm |
| --- | --- | --- |
| Torch ember, pickup/place, smoke | **Xào asset hiện có** | Giữ 4 frame torch trong `assets/environment/dungeon/items/torch/`; thêm sparkle/fire crop và smoke nhỏ, không thay ngọn lửa chính. |
| Visibility edge / fog | **Procedural** | Grayscale dither/noise sinh cố định hoặc shader; dễ scale và hỗ trợ reduced-flash hơn một ảnh AI. |
| Coin/chest/sigil/checkpoint/exit | **Xào asset hiện có** | Coin/chest sprites thật + sparkle/impact/vortex đã curate. Portal dùng `Effect_TheVortex` recolor fantasy, không dùng warp sci-fi xanh. |
| Hit theo vật liệu | **Xào asset hiện có** | Bone = skull/smoke + impact vàng nhạt; flesh = splatter đỏ; world = smoke nâu/xám; blade = directional impact trắng. |
| Telegraph | **Giữ code** | Sprite chỉ phủ cosmetic. Không để frame animation quyết định thời điểm nguy hiểm. |
| UI pulse/cooldown/transition | **UI hiện có + shader/mask** | Dùng icon Shikashi, panel Free Inventory, tween alpha/scale, shader wipe; không tải thêm UI VFX. |

## 4. UI/UX: cái nào xào, cái nào tải

| Hạng mục | Nguồn đúng | Lý do |
| --- | --- | --- |
| Panel, slot, button, focus/disabled | **Free Inventory hiện có** | Đã đồng bộ toàn shell; pack UI mới chỉ tạo thêm ngôn ngữ hình ảnh thứ hai. |
| Menu/HUD/skill icons | **Shikashi hiện có** | Coverage đủ; biến thể bằng crop, tint, cooldown mask và border state. |
| Hero/enemy card trong roster/bestiary | **Pixel dossier từ sprite hiện có** | Chọn pose mạnh từ `_Attack2NoMovement.png` của Sword/Axe và attack sheet của ba enemy; nearest-upscale, rim light hai tông, dungeon vignette + Free Inventory frame. Đây là lựa chọn in-game ưu tiên. |
| Font HUD/body tiếng Việt | **Tải Handjet** | OFL 1.1, có Vietnamese, variable 100–900; đọc tốt hơn việc ghép dấu bằng sprite. |
| Logo/chapter heading | **Tải Grenze Gotisch** | OFL 1.1, có Vietnamese, dark-fantasy; chỉ dùng heading để không làm HUD khó đọc. |
| Damage/combo accent | **Tải VT323** | OFL 1.1, có Vietnamese; dùng phụ vì chỉ có Regular. |
| Keyboard/gamepad/touch glyph | **Tải Kenney Input Prompts Pixel** | CC0, pixel-native 16×16, hơn 800 glyph; chính xác hơn Imagen và đồng bộ đa thiết bị. |
| Tutorial illustration | **Gameplay capture + input glyph** | Ảnh chụp đúng build hiện tại, không hứa một UI/moveset khác thực tế. |
| Chapter I/level card | **Viewport/map capture thật** | Render `game/levels/crypt_entrance.tscn` ở 640×360, bố trí Sword + Reaper/Vampire + torch, nearest-upscale 2×, rồi thêm Free Inventory border. Chỉ tạo card level khác khi level đó tồn tại. |
| App icon chức năng | **Composite local trước** | Ghép Sword cell `(1,5)` + Soul cell `(13,4)` trong `fantasy_icons.png`, `Inventory_select.png` và palette dungeon. Kiểm thử 16/32/64 px; sau khi emblem chính được duyệt thì thay bằng cùng emblem đó. |
| Light cookie cho torch | **Tải Kenney Light Masks nếu cần** | CC0; chỉ tải nếu falloff hiện tại còn phẳng sau khi tinh chỉnh PointLight2D. |
| Reward/mastery/chapter complete | **Super Pixel Effects hiện có** | Curate `symbol_level_up_text_001`, `symbol_crown_001`, `symbol_success_001`, rank A–S và `round_firework_burst_002`; recolor theo rarity, ghép frame hiện có. |
| Reduced-flash/high-contrast/color-safe | **Shader + shape hiện có** | Bỏ peak-white frame/giảm alpha, palette-map bằng `game/vfx/monochrome_tint.gdshader`, và phân biệt silhouette/outline thay vì chỉ đổi màu. |

Font nên tải từ nguồn chính thức:

- [Handjet — Google Fonts](https://fonts.google.com/specimen/Handjet)
- [Grenze Gotisch — Google Fonts](https://fonts.google.com/specimen/Grenze+Gotisch)
- [VT323 — Google Fonts](https://fonts.google.com/specimen/VT323)
- [Kenney Input Prompts Pixel](https://kenney.nl/assets/input-prompts-pixel)
- [Kenney Light Masks](https://www.kenney.nl/assets/light-masks)

Giữ `OFL.txt` và copyright notice của từng font trong hồ sơ third-party. Kenney là CC0,
nhưng glyph console vẫn phải tuân thủ guideline/certification của từng nền tảng khi phát hành.

## 5. SFX/music: remix trước, tải đúng chỗ sau

### 5.1 Xào 33 WAV hiện có

| Cụm âm thanh | Recipe đề nghị |
| --- | --- |
| Sword swing/hit | Luân phiên `sword_slash`, `weapon_swing`, `attack_miss`; tạo ba biến thể ±3–5%, trim/start offset khác nhau, peak không vượt -3 dB. Hit ghép transient theo vật liệu. |
| Axe heavy | Render `weapon_swing` ở khoảng -8/-12/-16% + một lớp `attack_miss` rất nhỏ; impact = `heavy_impact` + material hit lệch 10–25 ms. Catch dùng `guard_block` + `ui_equip`, không dùng full impact. |
| Soul Echo | `spirit_wind` + `soul_absorb` rất ngắn, high-pass nhẹ; execute thêm impact nhưng không lặp teleport. |
| Soul Relay | `soul_teleport` + tail `spirit_wind`; arrival/departure dùng envelope ngược nhau. |
| Skeleton/Reaper | `guard_block`/heavy impact cho xương, spirit wind cho disc; tránh blood/flesh layer. |
| Vampire | `enemy_bite`, `vampire_drain`, `impact_flesh`; blink chỉ dùng tail rất ngắn để không che telegraph. |
| Footstep stone | `step_stone` + tail `player_land` rất nhỏ, pitch khoảng ±3% và volume/spacing khác nhau; đây vẫn chỉ là giải pháp prototype vì một file nguồn sẽ sớm lặp. |
| UI | Bộ cue hiện tại đã đủ; không tải thêm interface pack trừ khi playtest phát hiện một state không phân biệt được. |

Pitch variation runtime của một family chỉ nên nhỏ; các bản Axe hạ pitch mạnh hơn phải được
render/QA riêng. Cần route theo material: bone, flesh, stone, metal và spirit. Không loop một
one-shot wind/footstep để giả ambience hoặc music.

### 5.2 Nguồn free nên tải

| Ưu tiên | Nguồn | Dùng cho | License / lưu ý |
| ---: | --- | --- | --- |
| 1 | [Kenney RPG Audio](https://www.kenney.nl/assets/rpg-audio) | Footstep, weapon, inventory/foley variation | CC0; curate từng file, không import cả pack. |
| 1 | [Kenney Impact Sounds](https://www.kenney.nl/assets/impact-sounds) | Bone/flesh/stone/axe impact variation | CC0; layer với cue hiện có. |
| 2 | [Incompetech](https://incompetech.com/music/royalty-free/music.html) | Music prototype và ambience có giai điệu | CC BY 4.0; bắt buộc credit. Audition `Ghost Processional`, `Darkest Child`, `Unseen Horrors`, `8bit Dungeon Level/Boss`; không coi lựa chọn đầu tiên là nhạc final mặc định. |
| 2 | [Freesound](https://freesound.org/help/faq/) | Một ambience/foley rất cụ thể mà Kenney không có | License theo từng file; chỉ chọn CC0 hoặc CC BY cho bản thương mại, tránh CC BY-NC; lưu URL/author/license từng file. |
| 3 | [Sonniss GDC 2026 Game Audio Bundle](https://gdc.sonniss.com/) | Foley/ambience chất lượng cao sau khi đã có shot list | Royalty-free cho media production, không cần attribution; archive rất lớn, chỉ curate file cần dùng. **Cấm dùng các file này để train AI/ML** và không phân phối raw source ngoài điều khoản license. |

Image generation không giải quyết audio. Nếu sau audition vẫn thiếu nhạc có identity, lựa chọn đúng
là thuê composer/sound designer hoặc mua license một bộ nhạc phù hợp, không tiếp tục gom SFX pack.

## 6. Queue Imagen sau local pass

### Nên tạo vì local asset không thể tạo cùng mức độ nhận diện

| Batch | Deliverable | Cách dùng | Hậu kỳ bắt buộc |
| ---: | --- | --- | --- |
| 1 | Chapter I **marketing** key art 1280×720 | Title/campaign hero image, store/social crop; campaign card trong game vẫn có thể dùng render level thật | Safe zone cho chữ, không sinh chữ trong ảnh; palette-grade về dungeon tiles và kiểm tra crop 16:9/1:1. |
| 1 | Emblem/ornament không chữ | Logo, loading seal và app icon cuối | Ghép chữ `SOUL OF HERO` bằng Grenze Gotisch/Handjet thủ công; kiểm tra silhouette ở 16/32/64 px. |
| 2, tùy chọn | Sword + Axe illustrated portrait 512×512 | Chỉ thêm nếu roster/detail đã duyệt hướng “illustrated”; pixel dossier local vẫn là fallback chính xác | Giữ silhouette/vũ khí, crop và palette-grade; không tự thêm giáp/vũ khí mới. |
| 3, tùy chọn | Ba enemy illustrated portrait 384×384 | Nâng bestiary/encounter sau khi hai hero portrait đã chứng minh art direction | Skeleton, Reaper và Vampire phải khác silhouette, material và palette; không dùng một template face chung. |

Như vậy năm portrait không còn là blocker P0: dùng pixel dossier local để hoàn thiện full UI trước,
rồi chỉ chạy Imagen nếu illustrated layer thật sự làm màn hình tốt hơn.

### Chỉ tạo khi remix thất bại

- Một base silhouette rìu quay, nhìn ngang, nền phẳng.
- Một base spectral sickle/disc, neutral-white, nền phẳng.
- Concept sheet tĩnh cho pursuit marker hoặc Echo ribbon; bản production vẫn phải vẽ
  lại thành pixel asset đúng kích thước.

### Không dùng Imagen

- Full attack spritesheet, walk cycle hoặc animation frame-by-frame.
- Chữ logo cuối cùng, font, damage number, nút Xbox/PlayStation hoặc tutorial glyph.
- Telegraph chính xác, hitbox, collision, visibility mask, cooldown mask hoặc seamless noise.
- Audio, music, SFX hoặc hồ sơ license.
- Portrait/key art miễn phí tải ngẫu nhiên trên mạng: chúng sẽ không khớp identity đã khóa
  của Sword, Axe và ba enemy.

### Cổng quyền sử dụng trước khi gọi Imagen

- License unTied/Super Pixel Effects cấm dùng pack làm training material; **không upload**
  `Super Pixel Effects...` hoặc `assets/vfx/untied/*` làm reference cho Imagen.
- Chưa đưa FreeKnight, AxeWarriorRPG và enemy sheets vào Imagen trước khi hồ sơ nguồn xác nhận
  rõ quyền derivative/AI transformation. Quyền dùng trong game không tự động đồng nghĩa với quyền
  gửi file vào một dịch vụ tạo sinh.
- Với source chưa được duyệt, dùng brief chữ do dự án tự viết hoặc concept mà dự án sở hữu hoàn
  toàn; sau đó chỉnh tay để khớp gameplay. Thêm trường `ai_reference_allowed` vào source manifest.

Workflow Imagen sau khi qua cổng quyền: một deliverable mỗi prompt, khóa palette và silhouette,
không chữ/không watermark. Portrait có alpha nên tạo trên nền chroma phẳng rồi tách nền và
pixel/palette QA thủ công. Không import thẳng output thô vào build.

## 7. Nguồn kỹ thuật free tùy chọn

- [Brackeys — VFX in Godot](https://github.com/Brackeys/vfx-in-godot): CC0; dùng để tham khảo
  particle/trail/shader Godot-native, không copy cả project vào `res://`.
- Không dùng Pixogen VFX Lite cho đến khi chủ asset công bố license commercial rõ ràng.
- Không dùng BDragon Retro Impact: provenance/copyright không đủ an toàn cho release.
- Không tải thêm các pack VFX/icon generic; chúng trùng coverage và làm import/indexing nặng hơn.

Những local asset cũng **không được tái chế cho combat**:

- `Effect_Anima`, `Effect_Worm`, `Effect_Tentacles`: silhouette móng/tentacle/lửa trắng chính
  là kiểu effect gây rối và đã bị loại khỏi đòn đánh.
- `spell_death_001_large_red` nếu còn glyph/chữ; chỉ được dùng khi tách sạch phần đó.
- `scifi_warp_003_large_blue` cho Sword/Soul Relay; đọc quá sci-fi và sai palette trắng/ivory.
- Waterfall xanh sáng, side-view/platformer asset hoặc icon cung UI làm projectile top-down.
- Không phóng thẳng enemy 32×32 lên 384×384 rồi gọi là portrait; pixel dossier phải có bố cục,
  rim light, backdrop và frame có chủ ý.

## 8. Thứ tự triển khai đề nghị

1. Chốt license của FreeKnight, Enemy Animations Set và AxeWarriorRPG.
2. Tải ba font + Kenney Input Prompts Pixel; thêm source manifest và notices.
3. Repack chín nhóm VFX P0 ở mục 3 từ kho hiện có; chỉ giữ production sheet trong
   `assets/vfx/<domain>/`.
4. Tách raw pack khỏi luồng import Godot bằng `.gdignore` hoặc source vault ngoài `res://`.
5. Curate Kenney RPG Audio + Impact Sounds theo danh sách cue còn thiếu; tạo material router
   và variation pool trước khi tìm thêm nguồn.
6. Audition ambience/music. Chỉ dùng Freesound/Sonniss khi có shot list cụ thể.
7. Dựng năm pixel dossier + Chapter I gameplay card local. Sau đó chạy Imagen Batch 1 cho
   marketing key art/emblem; chỉ tạo illustrated portraits khi art direction này đã được duyệt.
8. Chỉ sản xuất boss/elite VFX và Level 02–20 card sau khi moveset/map tương ứng đã khóa.

## 9. Cấu trúc lưu trữ đề nghị

```text
_source_assets/                 # ngoài res:// hoặc có .gdignore
  packs/<vendor>/<pack>/
  downloads/<vendor>/<asset>/
  generated/imagen/<batch>/
  licenses/<vendor>/<asset>/

assets/
  fonts/
  input_prompts/
  portraits/
  branding/
  vfx/<sword|axe|enemy|world|ui>/
  audio/<sfx|ambience|music>/

data/asset_manifest/
  sources.json
  licenses.json
  vfx_catalog.tres
  audio_catalog.tres
```

Chỉ asset đã crop/repack, đặt tên ổn định, có metadata frame/pivot/FPS và source record mới
được chuyển từ `_source_assets` sang `assets/`.
