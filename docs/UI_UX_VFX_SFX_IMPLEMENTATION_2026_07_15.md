# UI / UX / VFX / SFX production pass — 2026-07-15

## Kết quả

Pass này hoàn thiện lớp trình bày cho vertical slice top-down hiện tại bằng các asset mới
tải, kho local đã audit và hai artwork gốc tạo bằng ImageGen. Asset được curate vào production;
không đưa nguyên archive hoặc hàng trăm file không dùng vào runtime.

## Asset đã nhập

- 7 font static: Handjet Regular/SemiBold/Bold, Grenze Gotisch SemiBold/Bold/Black và
  VT323 Regular.
- Kenney Input Prompts Pixel: một atlas packed 544×384 chứa 816 glyph.
- Kenney RPG Audio: 34 OGG đã chọn.
- Kenney Impact Sounds: 49 OGG đã chọn.
- 15 VFX production sheet cho Sword, Axe, Reaper, Vampire và world interaction.
- 2 artwork ImageGen: Chapter I key art và Soul/Hero emblem có alpha.

Nguồn và license:

- `assets/fonts/SOURCES_AND_LICENSES.md`
- `assets/ui/input_prompts/SOURCE_AND_LICENSE.md`
- `assets/audio/sfx/kenney/SOURCE_MANIFEST.md`
- `assets/audio/sfx/kenney/LICENSE_CC0.md`
- `assets/vfx/PRODUCTION_REPACK.md`
- `assets/branding/README.md`

## UI/UX

- Handjet dùng cho UI/body tiếng Việt; Grenze Gotisch dùng cho title/heading; VT323 dùng
  cho HP, stamina, score và sigil counter.
- Title dùng Chapter I key art với lớp phủ tối và emblem riêng; chữ logo vẫn được render bằng
  font thật để localization và scaling không phụ thuộc bitmap.
- Hub, Campaign, Arsenal, Bestiary, Settings, Details, Results và Credits dùng hierarchy,
  spacing và state nhất quán.
- Arsenal có Sword dossier dựng từ sprite gameplay thật.
- HUD desktop có ba panel trên gọn, action deck dưới với glyph Kenney thật cho J/K/Space/Q,
  Soul Echo cooldown, combo và Relay realtime.
- HUD touch ẩn action deck desktop, có joystick và các nút Dùng/Đánh/Echo/Relay/Lướt nằm
  trong viewport. Pause touch không dùng glyph Esc.
- Tutorial đổi prompt theo bước W/J/K/Space; toast interaction dùng E trên desktop và Dùng
  trên touch. E và F đều hoạt động cho `interact`.
- Project icon dùng `assets/branding/soul_hero_emblem_imagen.png`.

## VFX

- Axe: spin 8 hướng, charge 12 frame, cleave, trail, impact và Cross Cut.
- Sword: pursuit marker, Echo anchor/ribbon và white/ivory feedback, không tạo thêm kiếm
  lơ lửng quanh Hero.
- Bone Reaper: sickle/disc riêng và trail; không còn giả bằng Electric Shield.
- Vampire: blink departure/arrival và tether riêng.
- World: portal fantasy, smoke và interaction sparkle.
- `Effect_Anima`, `Effect_Worm`, `Effect_Tentacles` và `soul_anima` không còn reference
  trong combat/runtime. Telegraph timing và hitbox vẫn procedural.
- Builder deterministic: `tools/generators/build_production_vfx.ps1`.

## SFX

- `CombatAudioRouter` hỗ trợ WAV + OGG, cache full path, random variation không lặp ngay
  và pitch jitter nhỏ.
- Giữ cue Sword/Soul đã duyệt; Kenney bổ sung variation cho footstep, Axe, bone, flesh,
  metal, wood và stone.
- World cue đã nối vào coin, chest, floor door và torch pickup/place; sigil/checkpoint và
  objective tiếp tục đi qua GameplayAudioHooks.
- UI cue cũ được giữ nhẹ, không thay bằng một lớp âm thanh dày gây mệt.
- Audio không dùng procedural waveform.

## Character form / Axe

- Input Attack/Skill tự route theo Hand hiện tại: Sword dùng combo/Soul Echo, Axe dùng
  charge-cleave và Throw/Recall.
- Scripted `request_action` cũng route đúng nên MCP/test có thể điều khiển Axe.
- Sword và Axe đều coi vũ khí là phần baked trong character animation; external Hand visual
  không xuất hiện, tránh lỗi kiếm/rìu lơ lửng. Bow legacy mới dùng external visual.
- Realtime state xuất đúng character form, animation library và `baked_hand_weapon`.

## Kiểm thử đã qua

- Full regression: 525 numbered checks.
- MCP: lifecycle, authenticated stdio, bidirectional tuning/map/action và reconnect.
- Axe: 19 combat + 51 manager + 25 effects + 76 character asset + 33 integration.
- VFX integration: 42 checks.
- UI shell: 76 checks; UI skin/font/glyph: 27 checks.
- Responsive HUD: 41 desktop + 48 touch checks.
- Godot 4.7 headless editor import/parse: pass.

Visual captures đã review:

- `.artifacts/ui_shell_title.png`
- `.artifacts/ui_shell_hub.png`
- `.artifacts/ui_shell_level_01_details.png`
- `.artifacts/ui_shell_bestiary.png`
- `.artifacts/ui_hud_polish_desktop00000013.png`
- `.artifacts/ui_hud_polish_mobile00000013.png`

## Những gap thật sự còn lại

- Music loop, dungeon ambience và low-health layer chưa có trong các gói người dùng vừa tải;
  không giả chúng bằng cách loop one-shot SFX.
- Cần lưu bằng chứng license release-ready cho FreeKnight, AxeWarriorRPG và Enemy
  Animations Set.
- Level 02–20, elite và boss vẫn là content/design gap; UI slot đã sẵn sàng nhưng không tạo
  card giả trước khi map/moveset tồn tại.
- Illustrated portraits có thể tạo sau nếu muốn marketing layer; in-game roster/bestiary
  hiện ưu tiên pixel dossier để khớp sprite thật.
