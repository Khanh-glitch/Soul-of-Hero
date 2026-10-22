# LIVING ARSENAL — Asset audit và kế hoạch cung cấp asset

> **SUPERSEDED / LEGACY.** Không dùng backlog này cho kế hoạch tải mới. Audit
> đúng product và đúng 9 archive ngày 14/07 nằm tại
> `docs/ASSET_AUDIT_SOUL_OF_HERO.md`.

Ngày audit: 2026-07-14; cập nhật sau khi quét đệ quy toàn bộ `Downloads`  
Phạm vi: asset đang nằm trong project, **31 ZIP / khoảng 1,67 GB** trong `Downloads` (27 ZIP ở thư mục gốc và 4 ZIP tài liệu học tập ở thư mục con), output `AxeWarriorRPG` ở workspace Codex bên ngoài project, master prompt gốc và các trang nguồn chính thức được dẫn link trong tài liệu này. Không tải thêm asset. License trên trang nguồn chỉ được xem là bằng chứng tham chiếu cho audit; trước khi phát hành vẫn phải lưu snapshot, hash và notice vào repo.

## 1. Kết luận ngắn

- **Nền map top-down đang dùng đúng hướng:** `DungeonTileset II v1.7` của 0x72 có grid 16×16, atlas floor/decor và wall/corner riêng, đã được dùng trực tiếp bởi `DungeonLevel`. Đây là bộ duy nhất hiện vừa phù hợp top-down, vừa có bằng chứng CC0 được lưu local.
- **Swap sang Axe nay đổi cả character form:** Sword/Bow vẫn dùng FreeKnight; khi Axe thành Hand, runtime đổi sang `AxeWarriorRPG` Colour1/Outline và đổi ngược về FreeKnight khi swap lại. Mỗi bộ có 30 animation sheet/149 frame, nhưng cả hai vẫn là silhouette side-view/platform chỉ flip trái/phải, chưa đồng nhất với dungeon nhìn từ trên xuống.
- **Ba enemy từ cùng một pack đã được nối vào runtime:** Skeleton Swordsman là melee chaser, Skeleton Reaper giữ cự ly và ném đĩa linh hồn quay lại, Vampire lao hút máu và rút tiến độ Spirit. Cả ba dùng visual trái/phải + `flip_h`, đúng quyết định hai hướng của người dùng. Đây vẫn là roster prototype trong Training, chưa thay thế yêu cầu encounter data, Elite/Boss và campaign 20 level.
- **Axe body/action art đã được tích hợp, không còn hoàn toàn là placeholder:** 30 PNG sheet `AxeWarriorRPG` được runtime dùng cho form Axe. Tuy nhiên Axe bị baked vào mọi frame, nên Throw & Recall hiện có thể hiện hai cây rìu cùng lúc; chưa có frame weaponless/throw/recall/catch. Axe Spirit, projectile/path effect, reward, Cross Cut, Follow-through, VFX và icon vẫn là code-native/placeholder.
- **Sword/Bow vẫn thiếu production art:** character form của hai vũ khí này vẫn là FreeKnight; weapon/Spirit, reward, Falling Arrow, Piercing Arrow và Flying Sword vẫn dựa nhiều vào `draw_*`/shape nội bộ.
- **HUD icon có thể dùng ngay đã được lọc từ toàn bộ ZIP:** atlas Shikashi 245 icon 32×32 đang có trong project là bộ chính; CraftPix Bow/Crossbow có 156 PNG 32×32 là bộ phụ nếu cần nhiều biến thể cung; `2D Pixel Dungeon Asset Pack` có icon/interface 16×16 chỉ phù hợp chi tiết phụ. Không ZIP nào chứa một bộ full UI chrome đồng nhất, nên panel/button/focus/cooldown vẫn phải tạo bằng Godot theme/StyleBox hoặc art riêng. Chưa có pixel font ship-safe hỗ trợ đầy đủ tiếng Việt.
- **Audio gameplay thực tế bằng 0:** `default_bus_layout.tres` đã có các bus `Master/Music/SFX/UI`, nhưng không có music/SFX asset và chưa wire gameplay/UI cue. Các `.wav` trong `.artifacts/` là file ghi hình/test capture, không phải asset để ship.
- **Ưu tiên cung cấp trước:** khóa style hai hướng + hoàn thiện hero/Sword/Bow/Axe visual + font tiếng Việt + core VFX + khoảng 35 combat/UI cue có variation. Không cần tải thêm enemy cơ bản hoặc HUD icon ở P0; hãy dùng ba enemy và atlas Shikashi hiện có, rồi dành ngân sách cho boss, environment variation, audio và art còn thật sự thiếu.

## 2. Chuẩn kỹ thuật đang có

| Hạng mục | Giá trị hiện tại | Ràng buộc khi cung cấp asset |
|---|---|---|
| Logical viewport | 640×360, landscape | UI phải đọc được ở 640×360; test thêm 16:9, 18:9, 20:9 và safe area |
| Desktop test | 1280×720 | Project đang scale 2× từ logical viewport |
| Stretch | `canvas_items` | Không đặt chi tiết 1 px quá mảnh nếu nó phải chịu nhiều tỉ lệ màn hình |
| Renderer | GL Compatibility | Tránh shader/VFX phụ thuộc Forward+ nếu không có fallback |
| Pixel filter | Nearest (`default_texture_filter=0`) | PNG pixel-art không blur, không mipmap |
| Map grid | 16×16 px | Prop/environment nên bám bội số 16; object lớn có thể 32/48/64 px nhưng chân phải snap grid |
| Player hiện tại | FreeKnight và AxeWarriorRPG đều frame 120×80; Axe anchor `(60,80)`, runtime scale 75%, nhưng body/rìu vẫn rộng so với tile 16 px | Nếu thay art, dùng frame cố định và cùng foot anchor; không trim từng frame; test scale/readability trực tiếp trên map |
| Enemy hiện tại | frame 32×32 | Enemy mới nên thống nhất 32×32 hoặc 48×48; boss 64×64/96×96 |

### 2.1 Import profile dùng trong các bảng

Mỗi backlog item bên dưới tham chiếu một profile để không lặp toàn bộ setting.

| Mã | Format và Godot import |
|---|---|
| `PX-TILE` | PNG RGBA; lossless; mipmaps off; nearest; repeat off; atlas grid 16×16; không trim; collision/terrain khai báo trong TileSet resource, không bake vào ảnh |
| `PX-SPRITE` | PNG RGBA spritesheet; frame cố định; lossless; mipmaps off; nearest; repeat off; foot/pivot không đổi giữa frame; animation bằng `AtlasTexture`/`SpriteFrames` |
| `PX-VFX` | PNG RGBA; cell 16/32/64 px; lossless; mipmaps off; nearest; one-shot, loop chỉ khi được ghi rõ; blend bình thường/additive phải có bản fallback GL Compatibility |
| `PX-UI` | PNG RGBA; icon source 32×32 hoặc 48×48; lossless; mipmaps off; nearest; panel dùng 9-patch với border ghi rõ; padding trong suốt nhất quán |
| `FONT-PX` | Ưu tiên bitmap font `.fnt + .png`; nếu là `.ttf/.otf` pixel font thì phải có license, Vietnamese glyph, antialias/hinting được test ở cỡ logical 8/10/12/18 px |
| `SFX` | WAV PCM 48 kHz, 16/24-bit; mono trừ âm thanh không gian rộng; không loop; peak/headroom được xử lý trước import; route vào bus `SFX` hoặc `UI` |
| `MUSIC` | OGG Vorbis 48 kHz stereo; có loop point/cue sheet; import loop on; route `Music`; giữ WAV master ngoài export nếu có |
| `AMBIENCE` | OGG Vorbis 48 kHz stereo, seamless loop; route `SFX/Ambience`; không chứa nhạc có bản quyền chưa xác minh |

## 3. Inventory asset đang có trong project

### 3.1 Environment/map

| Bộ asset | Nội dung thật | Runtime dùng ở đâu | License local | Đánh giá |
|---|---|---|---|---|
| 0x72 DungeonTileset II | `dungeon_tileset_ii.png` 512×512, grid 32×32 tile 16 px; `atlas_walls_low.png` 192×64, grid 12×4 | `game/levels/dungeon_level.gd`, level JSON hiện tại | Có `assets/environment/dungeon_0x72/THIRD_PARTY.md`, ghi CC0 1.0, author/source/archive | **Production candidate / READY.** Hợp top-down, import đúng nearest/no mipmap. Cần thêm module/prop nếu làm đủ 20 level để tránh lặp |
| Dungeon atlas cũ | `dungeon_tileset.png` 160×160; `source_reference.png` 256×256 | Atlas cũ chỉ còn để đối chiếu; reference không phải runtime map canonical | Archive local không có license text | **Reference/migration only.** Không nên dùng thêm trước khi có proof |
| Chest | 4 frame đóng + 4 frame mở, mỗi file 16×16 | `game/world/interactables/chest.gd` | Chưa có proof | **Technically usable, license-blocked** |
| Coin/sigil source | 4 frame coin 16×16 | Coin, sigil và seal của exit gate đang tái sử dụng | Chưa có proof | **Prototype.** Một sprite đang bị dùng cho nhiều meaning khác nhau |
| Flag/checkpoint | 4 frame 16×16 | `checkpoint.gd` | Chưa có proof | **Technically usable, license-blocked** |
| Spikes | 4 frame 16×16 | `spikes.gd` | Chưa có proof | **Technically usable, license-blocked** |
| Torch/candlestick | 4 loại × 4 frame = 16 PNG, 16×16 | `torch.gd` và lighting | Chưa có proof | **Technically usable, license-blocked.** Hợp palette dungeon hiện tại |

### 3.2 Player và enemies

| Bộ asset | Nội dung thật | Runtime dùng ở đâu | License local | Đánh giá |
|---|---|---|---|---|
| FreeKnight Colour1/Outline | 30 sheet, cell 120×80, tổng 149 frame: idle/run, light/combo/heavy attack, crouch, dash, roll, slide, jump/fall, hit/death, wall states và root-motion variants | Character form mặc định của Sword/Bow qua `knight_animation_library.gd`; `knight.tscn` | `FreeKnight_v1.zip` có PNG/GIF nhưng không có license/readme local | **Functional placeholder.** Master cho phép left/right + flip, nhưng art là side-view/platform; cần proof và quyết định style trước khi ship |
| AxeWarriorRPG Colour1/Outline | 30 PNG sheet, cell 120×80, tổng 149 frame, anchor `(60,80)`; animation timing/loop nằm trong `source_manifest.json`; rìu được baked vào body | Character form `axe_warrior_rpg` khi Axe là Hand; runtime scale 75% + foot baseline riêng; `axe_warrior_animation_library.gd`; collider/entity player được giữ nguyên khi swap | Output Codex local không có `LICENSE`/`CREDITS`; `ASSET_SOURCE.md` chỉ ghi provenance kỹ thuật, **không** cấp quyền commercial | **Integrated prototype / release-blocked.** Runtime đã dùng thật, nhưng chỉ side-view + flip, silhouette rộng, thiếu weaponless throw/recall/catch và chưa clear provenance/license |
| Skeleton 1 / Swordsman | 32×32 cell: idle 6, move 10, attack 9, hurt 5, death 17 | `skeleton_enemy.gd/.tscn`; melee pursuit, patrol/chase/attack/hurt/death, separation, LOS; có trong Training | ZIP không kèm license; trang nguồn Pixel_Poem ghi commercial use, modification được phép, credit không bắt buộc và cấm redistribute/resell | **Integrated prototype.** Phủ vai trò Chaser cơ bản nhưng chưa có telegraph riêng trước melee; separation còn global group scan trong physics tick; cần chuyển profile sang resource và lưu license snapshot trước release |
| Skeleton 2 / Bone Reaper | idle 6, move 10, attack 15, hurt 5, death 15 + death2 15; cell 32×32 | `skeleton_reaper.tscn` + `advanced_enemy.gd`; giữ cự ly, strafe/retreat, line telegraph 0,56 s, ném `SpectralDisc` gây damage ở lượt đi/về; có trong Training | Cùng archive/source/license tham chiếu như Skeleton 1 | **Integrated prototype.** Phủ vai trò Shooter theo bản sắc Reaper; neighbor cache 0,22 s; profile vẫn là Dictionary hard-code và projectile/VFX còn code-native |
| Vampire / Blood Vampire | idle 6, move 8, attack 16, hurt 5, death 14; cell 32×32 | `vampire_enemy.tscn` + `advanced_enemy.gd`; line telegraph 0,44 s, lunge, hồi 8 HP khi trúng, rút một nấc ở Spirit đang có trigger progress cao nhất; có trong Training | Cùng archive/source/license tham chiếu như Skeleton 1 | **Integrated prototype.** Phủ áp lực kiểu Dasher/Spirit Leech nhưng chưa có profile resource, wall-miss vulnerable state rõ, elite/boss pattern hay content reward |

### 3.2.1 Checkpoint kỹ thuật AxeWarriorRPG

- Nguồn ngoài project: `C:\Users\LE QUOC KHANH\Documents\Codex\2026-07-14\fol\outputs\AxeWarriorRPG`; runtime chỉ chọn biến thể `Axe_v1/Colour1/Outline/120x80_PNGSheets` và copy 30 PNG, không copy GIF hay `.import` cũ.
- Project lưu manifest và ghi chú nguồn tại `assets/characters/axe_warrior/`; manifest ghi 30 action, 149 frame, frame 120×80, anchor `(60,80)` và alpha binary.
- Bộ QA ở dự án nguồn **báo cáo** 821 assertion pass. Test runtime riêng xác minh 68 điều kiện về sheet/frame/atlas/manifest; full regression sau AppRoot hiện pass **563/563** kiểm tra non-MCP và MCP lifecycle/auth/schema/subscription/bidirectional/reconnect pass. Integration test khóa scale 75% qua run→charge→cleave; pose Attack2 thấp 28 px không còn được dùng làm frame giữ lực.
- Các con số trên chỉ chứng minh hợp đồng kỹ thuật và integration, **không** chứng minh art đã đúng top-down, scale đã production-ready, hay quyền phát hành thương mại đã được clear.

### 3.2.2 Enemy roster và provenance đã xác minh

Nguồn duy nhất cho ba enemy hiện tại là `C:\Users\LE QUOC KHANH\Downloads\Enemy_Animations_Set.zip`, SHA-256 `4E17A982F71F688DE7C86C9FA5FEB63AD2709C649281B62B46CF6CE3DE900DCD`. Archive có 16 PNG strip và một `enemies.aseprite`; 16 PNG trong `assets/characters/enemies/` byte-match nguồn tại thời điểm audit. Tên file `enemies-skeleton2_movemen.png` thiếu chữ `t` là tên gốc, không phải lỗi import.

Trang chính thức [2D Pixel Dungeon Asset Pack của Pixel_Poem](https://pixel-poem.itch.io/dungeon-assetpuck) liệt kê đúng Vampire, Skeleton swordsman và Reaper cùng năm animation `Idle/Walk/Attack/Take damage/Death`, đồng thời công bố quyền dùng trong dự án free/commercial và được chỉnh sửa; không được redistribute/resell. Tuy nhiên ZIP tải về **không chứa LICENSE**, vì vậy trước release phải lưu snapshot trang nguồn, URL, ngày truy cập, hash archive và notice vào `assets/licenses/pixel_poem_enemy_animations/`. Không xem một URL còn sống là bằng chứng release lâu dài duy nhất.

| Runtime ID/scene | Vai trò đã chốt với người dùng | Animation strip | Hợp với prompt đến đâu | Khoảng trống còn lại |
|---|---|---|---|---|
| `skeleton` / `skeleton_enemy.tscn` | Skeleton Swordsman — melee chaser | 6/10/9/5/17 frame | Phủ Chaser pursuit + melee cơ bản | Telegraph anticipation riêng; profile resource; bỏ global per-frame group scan; mastery/drop/bestiary |
| `skeleton_reaper` / `skeleton_reaper.tscn` | Skeleton Reaper — ranged/mobile controller | 6/10/15/5/15 frame | Phủ Shooter giữ cự ly + projectile dễ đọc, thêm đường đi/về có bản sắc | Projectile art/SFX; profile resource; encounter tuning; hit readability khi đông quái |
| `vampire` / `vampire_enemy.tscn` | Blood Vampire — lunge/leech/Spirit disruptor | 6/8/16/5/14 frame | Phủ dash pressure và một phần Spirit Leech sớm theo lựa chọn roster | Miss/wall vulnerability rõ; warning cho Spirit drain; giới hạn disruption; data/reward/bestiary |

Suite `tests/enemy_roster_test.gd` gần nhất ghi nhận **56/56 checks pass** cho scene/archetype, frame count, telegraph, flip hai hướng, projectile direction lock, Vampire confirmed-hit leech/drain và sự hiện diện của cả ba loại trong Training. Kết quả này không phải acceptance cho encounter, boss hoặc campaign.

### 3.3 UI, weapon art, VFX, font và audio

| Bộ asset | Nội dung thật | Runtime dùng ở đâu | License local | Đánh giá |
|---|---|---|---|---|
| Shikashi Fantasy Icons v2 | 1 atlas transparent 512×867; local pack ghi 209 icon unique + 36 recolor = 245 icon 32×32 | `hud.gd` và `game/ui/theme/icon_library.gd` cắt region 32×32 cho HUD/shell | Notice local cho commercial/remix; nhiều icon dựa trên game-icons.net CC BY 3.0. Trang pack hiện yêu cầu credit `Matt Firth (shikashipx)` và `game-icons.net` | **Primary HUD/UI atlas / conditional for ship.** Dùng ngay, không cần tải bộ HUD icon khác ở P0; phải credit và giữ manifest cell đã dùng |
| Hand/Spirit world visual | `weapon_visual_2d.gd` vẽ line/arc/circle; Axe form có rìu baked nên external Hand visual bị ẩn | Sword/Bow Hand và toàn bộ Spirit orbit; Axe body/rìu dùng raster tích hợp | N/A cho code; Axe raster xem dòng AxeWarriorRPG | **Mixed.** Axe Hand silhouette đã có trong raster; Sword/Bow Hand và cả ba Spirit vẫn thiếu sprite production riêng |
| Bow reward | `bow_reward.gd` vẽ cung/pedestal/glow bằng code | Reward Level 1 | N/A, code nội bộ | **Placeholder** |
| Falling/Piercing/Flying Sword/Axe effects | Các effect scene vẽ bằng code, gồm Axe projectile/path Throw/Recall, Cross Cut và Follow-through | Sword Spirit, Bow Hand/skill/Spirit, Axe Hand/Spirit | N/A, code nội bộ | **Gameplay-ready, art-placeholder.** Khi Axe projectile bay, rìu baked trong character raster vẫn còn trên người |
| HUD skin/joystick/overlay | `StyleBoxFlat`, `Label`, circle/arc code-native | Combat HUD, mobile controls, pause/death/win; app shell dùng theme/code-native | N/A | **Code-native foundation.** Không ZIP nào cung cấp full chrome đồng bộ; vẫn cần runtime QA cho focus/disabled/pressed, cooldown mask, safe area và nhiều tỉ lệ màn hình |
| Font | Không có `.fnt`, `.ttf`, `.otf` | Đang dùng font mặc định Godot | Không có | **Missing.** Cần font hỗ trợ dấu tiếng Việt và license rõ |
| SFX/music/ambience | Không có audio trong `assets/`; `default_bus_layout.tres` chỉ tạo Master/Music/SFX/UI | Bus tồn tại nhưng gameplay/UI cue chưa được wire | Không có | **Missing content/runtime wiring.** `.artifacts/*.wav` chỉ là test recording, loại khỏi inventory game audio |
| Source art | Không có `.aseprite/.kra/.psd` trong project; Axe chỉ giữ 30 PNG + manifest, generator/work files nằm ngoài project | Không có pipeline sửa asset canonical trong repo | N/A | **Missing/externally-held.** Enemy/Tiny RPG archive có `.aseprite`; Axe phải đóng gói source/generator revision trước production handoff |

## 4. Nguồn/archive local: dùng được đến đâu

| Archive | Đã import | Proof nằm trong archive | Quyết định |
|---|---:|---|---|
| 0x72 DungeonTileset II v1.7 | Hai atlas chính đã vào project; **không thấy archive gốc trong Downloads tại lúc audit** | Project đã lưu notice CC0 và source, nhưng chưa có archive/hash local | Giữ làm canonical map pack; nên lưu lại archive gốc + SHA-256 vào hồ sơ license |
| `2D Pixel Dungeon Asset Pack v2.0.zip` | Prop/interface 16×16 và atlas cũ | Không thấy license/readme trong ZIP local; trang nguồn Pixel_Poem công bố free/commercial, cho modify, cấm redistribute/resell | Dùng prop/interface phụ ở prototype; lưu snapshot nguồn trước release, không thay atlas 0x72 canonical nếu chưa có lý do |
| `FreeKnight_v1.zip` | 30 sheet Colour1/Outline | Không thấy license/readme | Không mở rộng phụ thuộc vào bộ này trước khi có proof; vẫn có thể giữ làm placeholder |
| `Enemy_Animations_Set.zip` | **Đã import đủ 16 sheet** cho Swordsman/Reaper/Vampire | Có source `.aseprite`, không có license/readme; SHA-256 và trang nguồn đã ghi ở mục 3.2.2 | Giữ làm roster Training và base enemy production; trước release lưu license snapshot/notice, không phân phối lại source pack |
| `Shikashi's Fantasy Icons Pack v2.zip` | Transparent atlas đã vào `assets/ui/fantasy_icons.png` | [Trang nguồn Shikashi](https://shikashipx.itch.io/shikashis-fantasy-icons-pack); notice local cho commercial/remix và game-icons.net CC BY 3.0; SHA-256 `EB3725A63EC7AFA04C8942057717758CC0A9388CEB1D4348A7E8487DFBC0492E` | **Primary HUD/UI icon set.** Credit `Matt Firth (shikashipx)` + `game-icons.net`, lưu cell manifest; không cần nhập mọi background variant |
| `Free Bow and Crossbow Icons.zip` | **Chưa import**; 156 PNG 32×32, gồm transparent tại folder gốc viết sai `PNG/Transperent/` | [Trang asset](https://craftpix.net/freebies/free-bow-and-crossbow-pixel-art-icons/) + [CraftPix File Licenses](https://craftpix.net/file-licenses/); freebie dùng/modify trong commercial project, không yêu cầu attribution, cấm redistributing source; SHA-256 `AF6C505251B623B33607F4420FDB57B4C5A9DDD139BC0ADA95CBAF49C6A85574` | Bộ phụ cho portrait/icon Bow nếu Shikashi thiếu biến thể; chỉ import những PNG thật sự dùng, không copy cả PSD/source vào game |
| `VFX Free Pack.zip` | **Chưa import**; 22 family/2.392 entry, có frame/GIF/spritesheet 30/60 fps | ZIP không có LICENSE/README; SHA-256 `D706FF61B7B72BA444A76916F74D1549A5AFEC573594BF656661E4187D1F118E` | Chỉ shortlist `Impact`, `SmallHit`, `BigHit`, `Charged`, `BloodImpact`, `Anima`, `ElectricShield`; không import cả pack 90 MiB và không ship trước khi lưu bằng chứng license/source |
| `Tiny RPG Character Asset Pack 01 v2.0 -Free Soldier&Orc.zip` | **Chưa import** | Có Soldier/Orc 100×100, arrow 32/100, `.aseprite`; không thấy license/readme | Candidate local để thử style, nhưng không đưa vào project trước khi xác minh license và perspective |
| Codex output `AxeWarriorRPG` | Đã import 30 PNG Colour1/Outline + source manifest; các variant/GIF còn ở output ngoài project | Không có `LICENSE`/`CREDITS`; tài liệu nguồn nói timing/root tham chiếu FreeKnight nhưng không chứng minh quyền derivative/commercial | Giữ làm integrated prototype; trước release phải audit prompt/input/generator, xác minh quyền với mọi reference và lưu proof theo mục 10 |

### 4.1 Kết quả quét toàn bộ ZIP trong Downloads

| Nhóm | Archive tiêu biểu | Dùng cho game? | Hành động |
|---|---|---:|---|
| Map/character/enemy | `2D Pixel Dungeon Asset Pack`, `Enemy_Animations_Set`, `FreeKnight`, `Tiny RPG`, `GandalfHardcore Archer`, `Martial Hero` | Một phần | Giữ pack đang tích hợp; pack nhân vật còn lại chỉ là candidate cho thử nghiệm, không trộn thêm khi chưa qua perspective/palette/license review |
| HUD/icon | `Shikashi's Fantasy Icons Pack v2`, `Free Bow and Crossbow Icons` | **Có** | Shikashi là primary; CraftPix Bow là secondary; Pixel Dungeon 16×16 dùng cho micro-detail nếu cần |
| VFX | `VFX Free Pack` | Candidate | Chỉ extract vài effect đã shortlist sau license review và resize/pixel-density test; không đưa 2.392 entry vào repo |
| Font | `jaapokkienchance_regular.zip` | Chưa | Không dùng cho shipping vì chưa chứng minh đủ glyph tiếng Việt và license trong hồ sơ dự án; ưu tiên font OFL có dấu Việt |
| Music/audio | `AUDIO-*`, `heloo Stems*`, `Si Tình Khúc Stems*`, `samples*` | **Không mặc định** | Đây không phải pack SFX game đã clear quyền; không đưa vào game chỉ vì file nằm trong Downloads |
| Tool | `Godot_v4.7-stable_win64.exe.zip`, `unikey46RC2-*` | Không phải asset | Loại khỏi inventory game |
| Tài liệu học tập/Office | `WORD-*`, `SÁCH ETS*`, `ĐỀ RC*`, các ZIP trong `bài đã làm`, các ZIP tên tài liệu | Không | Loại khỏi audit asset; không mở rộng/di chuyển vào project |

### 4.2 HUD icon manifest đề xuất từ atlas Shikashi

Toạ độ dưới đây là pixel origin và cell `(column,row)` trên atlas transparent 32×32. Phải xem trực tiếp trong UI trước khi khóa vì tên icon không được đóng gói dưới dạng metadata máy đọc.

| Mục đích | Pixel origin | Cell |
|---|---:|---:|
| HP/heart | `(0,32)` | `(0,1)` |
| Sword slash skill | `(32,96)` | `(1,3)` |
| Rain arrows / Bow skill | `(128,96)` | `(4,3)` |
| Forge | `(128,128)` | `(4,4)` |
| Spellbook/Spirit | `(224,128)` | `(7,4)` |
| Sword weapon | `(32,160)` | `(1,5)` |
| War axe weapon | `(320,160)` | `(10,5)` |
| Bow weapon | `(96,192)` | `(3,6)` |
| Inventory/knapsack | `(0,320)` | `(0,10)` |
| Chest/reward | `(352,352)` | `(11,11)` |
| Gold/currency | `(320,384)` | `(10,12)` |
| Gem/material | `(448,384)` | `(14,12)` |
| Mastery/open book | `(256,416)` | `(8,13)` |
| Campaign/map | `(384,416)` | `(12,13)` |
| Hunt/monster claw | `(288,544)` | `(9,17)` |

Nếu một màn hình cần logo, chapter illustration, full panel chrome hoặc boss portrait thì các ZIP hiện có **không** giải quyết được. Những phần đó phải tạo/commission/generate có cleanup, hoặc dùng layout code-native có chủ ý thay vì ghép nhiều pack lệch style.

## 5. Quyết định art direction đã chốt: visual hai hướng

### 5.1 Hướng nhân vật

Master prompt gốc ghi rõ nhân vật di chuyển tám hướng nhưng body sprite chỉ cần visual trái/phải và có thể flip ngang. Người dùng cũng đã chốt cùng hướng này cho cả tướng và quái. Vì vậy backlog **không còn yêu cầu N/S hoặc 4/8-direction sprite**; mọi dòng cũ yêu cầu bốn hướng được thay bằng một lateral authored direction + `flip_h` hoặc hai sheet L/R nếu asymmetry bắt buộc.

Contract art hai hướng:

1. Gameplay movement vẫn là 8 hướng; hitbox, dash, projectile, targeting, trail và telegraph vẫn xoay 360°. Chỉ body presentation bị giới hạn trái/phải.
2. Chọn một lateral pose gốc, flip an toàn cho hướng còn lại; logo, chữ, khiên/vũ khí bất đối xứng phải có bản sửa riêng nếu flip tạo lỗi.
3. Để không còn cảm giác platform, dùng foot anchor cố định, shadow ngay dưới chân, y-sort đúng, không có ground line trong sprite, attack arc/telegraph nằm trên mặt sàn và scale body hợp tile 16 px.
4. Body nominal nên cao khoảng 24–32 px trên canvas 48×48 hoặc 64×64; FreeKnight/Axe 120×80 chỉ là ngoại lệ prototype đã scale, không phải target mặc định cho asset mới.
5. Không trộn hero 100×100 anti-alias với dungeon 16 px sắc nét nếu chưa làm một pixel-density pass chung.

### 5.2 Style token nên giao kèm mọi order/generation

- Perspective: top-down world với lateral two-direction character presentation; không vẽ nền/platform line trong character sheet, không isometric.
- Grid: environment 16 px; body nominal 24–32 px; frame 48/64 px.
- Palette: dungeon lạnh, desaturated; Sword vàng-trắng, Bow cyan, Axe cam-đỏ; telegraph nguy hiểm đỏ/cam nhưng luôn có shape khác nhau.
- Outline: 1 px ở native scale; không outline mềm/anti-aliased.
- Light: key light từ trên-trái; shadow ngắn ở chân, không shadow dài baked vào mọi frame.
- Alpha: background hoàn toàn trong suốt; không matte trắng/đen; không trim frame.
- Direction: `L` authored + `R` via flip là mặc định; sheet L/R riêng chỉ khi thiết kế bất đối xứng không flip được.
- Naming: `<subject>_<action>_<direction>_<frame>.png` với direction `L/R`, hoặc spritesheet + JSON/Aseprite tags.

### 5.3 Kế hoạch cung cấp đã lọc theo ưu tiên

| Ưu tiên | Tái dùng ngay | Cần tạo/commission | Có thể tải sau khi kiểm license | Không nên làm lúc này |
|---|---|---|---|---|
| **P0 — game shell + Training rõ ràng** | Atlas 0x72; ba enemy Swordsman/Reaper/Vampire; Shikashi HUD icon; theme code-native | Hero/Sword/Bow/Axe readability pass; weapon/Spirit VFX cốt lõi; telegraph overlays; font tiếng Việt; khoảng 35 combat/UI SFX; title/logo chỉ nếu shell cần identity | Font OFL; một SFX pack; chỉ vài VFX `Impact/BigHit/Charged/BloodImpact/Anima/ElectricShield` sau proof | Tải thêm enemy pack, import cả VFX pack, mua 20 map riêng, làm portrait cho hệ chưa có runtime |
| **P1 — Chapter 1 thật** | Cùng ba enemy làm archetype cơ bản/variant; Shikashi/CraftPix cho icon phụ | Elite Captain; boss hai phase; Axe weaponless/throw/catch; environment module variation; Chapter map/Results/Arsenal art; audio boss/hub | Dungeon extension cùng style/license; music/SFX production | Gọi Training là Level 1; tạo 10 level chỉ bằng đổi spawn; mở Forge/Hunt giả |
| **P2 — Chapter 2/endgame** | Reuse component, icons và enemy family khi phù hợp | Bulwark/Venom/Spirit-Leech variant hoặc quyết định scope thay thế rõ; Chapter 2 elite/boss; Forge/Parts/rarity/mode UI; endgame environment/audio | Pack environment/VFX/audio đã qua style và license gate | Tạo asset endgame trước khi data contract/runtime của Forge/Hunt/Challenge/Depth có test |

Mọi acquisition phải có owner, source URL, exact version/hash, license snapshot và scene/resource consumer cụ thể. Asset không có consumer không được import chỉ để “dự phòng”.

## 6. P0 — Asset cho Training shell và campaign Level 1 tương lai

P0 là gói phải có trước để Sword/Bow loop và full-game shell trông như một game top-down thật. Map đang có chỉ là Training/Test Build; các dòng nhắc Level 1 là dependency cho campaign level tương lai, không phải tuyên bố Level 1 đã hoàn thành. “Tạo” nghĩa là tự vẽ/commission/generate rồi pixel-cleanup; “Tải” nghĩa là lấy pack có license rõ. Asset generated phải lưu prompt và post-process note theo master spec.

| ID | Asset/loại | Minimum deliverable: animation, hướng, frame | Kích thước/format/alpha | Tải hay tạo | License proof phải lưu | Import | Dependency / nơi dùng |
|---|---|---|---|---|---|---|---|
| P0-01 | **Hero two-direction core set** | Một lateral direction authored + flip: idle 4–6; run 6–8; hurt 2–3; death 8; interact 4; swap 4–6; sheet R riêng chỉ khi asymmetry không flip được | Canvas 48×48 hoặc 64×64; body 24–32 px; PNG RGBA + `.aseprite`/tag manifest | **Tạo/commission — ưu tiên cao nhất** | Author, work-for-hire/usage grant, source file, prompt nếu generated | `PX-SPRITE` | Thay FreeKnight cho Sword/Bow, làm chuẩn scale/socket để retarget Axe; giữ `knight.tscn`/collider/form registry ổn định |
| P0-02 | **Hero Sword action set** | Lateral + flip: combo hit 1 4f; hit 2 4f; finisher 6f; Dash Slash 6–8f; anticipation/contact/recovery rõ | Cùng canvas/pivot P0-01; PNG RGBA | Tạo cùng artist P0-01 | Như P0-01 | `PX-SPRITE` | State ATTACK/SKILL, hit timing, Sword identity |
| P0-03 | **Hero Bow action set** | Lateral + flip: Falling Arrow cast 5–6f; Triple Volley 7–8f; không bake mũi tên vào body nếu dùng overlay socket | Cùng canvas/pivot P0-01; PNG RGBA | Tạo cùng artist P0-01 | Như P0-01 | `PX-SPRITE` | Bow Hand attack/skill; thay cảm giác code-only hiện tại |
| P0-04 | **Sword weapon kit** | 1 Hand sprite, 1 Spirit/orbit sprite hoặc chung sprite; 1 icon; slash light 4–6f; finisher slash 6–8f; Dash Slash trail 6–8f; Flying Sword slash/return 6–8f | Weapon 16×32 hoặc 32×32; icon 32×32; VFX cell 32/64; PNG RGBA | Tạo; có thể dùng pack cho prototype nhưng unique art tốt hơn | Author/source/prompt; nếu pack phải có redistribution/commercial proof | `PX-SPRITE`, `PX-VFX`, `PX-UI` | `weapon_visual_2d`, `flying_sword`, HUD/Arsenal |
| P0-05 | **Bow weapon kit** | 1 Hand bow, 1 cyan Spirit bow, 1 icon; normal arrow; large piercing arrow; impact marker 6–8f; Falling Arrow impact 6–8f; Triple Volley trail 4–6f; Reverse Shot color variant | Bow/arrow 32×32; icon 32×32; impact 64×64 max; PNG RGBA | **Tạo — Bow hiện là code-native placeholder** | Author/source/prompt; commercial proof | `PX-SPRITE`, `PX-VFX`, `PX-UI` | `bow_reward`, `falling_arrow`, `piercing_arrow`, weapon HUD |
| P0-06 | **Core combat feedback VFX** | Light hit 4f; heavy/finisher 6f; stagger stars 4f loop; hurt flash mask; dash smoke 6f; swap burst 6f; Spirit-ready pulse 6f; death puff 8f | 16/32/64 cells, PNG RGBA; telegraph không che enemy | Tạo hoặc tải một VFX pack đồng palette | Source URL, author, exact license, attribution | `PX-VFX` | Combat feel, swap, hit confirmation, readability |
| P0-07 | **Skeleton Swordsman production pass** | Giữ asset đã tích hợp: lateral + flip, idle 6; move 10; attack 9; hurt 5; death 17. Tạo thêm telegraph/stagger overlay nếu attack silhouette chưa đủ rõ | 32×32 fixed cell; PNG RGBA + source `.aseprite` đã có trong ZIP | **Không tải enemy thay thế ở P0**; polish/recolor từ source sau khi lưu proof | Pixel_Poem source snapshot, archive hash, modification/license notice | `PX-SPRITE`, `PX-VFX` | Chaser cơ bản trong Training/Level 1 tương lai; giữ scene/runtime contract hiện tại |
| P0-08 | **Universal enemy telegraph set** | Melee arc 4–6f; line dash 4–6f; target circle 4–6f; projectile warning 4–6f; vulnerable/open state 1 icon + 4f pulse | 32/64 px PNG RGBA; shape-coded, palette normal + color-blind | Tạo | Author/source/prompt | `PX-VFX` | Chaser trước; tái dùng Dasher/Shooter/Boss sau này |
| P0-09 | **Dungeon reward/interaction props** | Bow pedestal closed/claimed: 2 states × 4–6f glow; exit gate closed/open: 2 clips × 6–8f; checkpoint inactive/active: 2×4f; health pickup 4–6f | Bội số 16: 16/32/48 px; PNG RGBA | Tạo theo palette 0x72; hoặc tải pack có license tương thích | Proof cho từng pack/artist | `PX-SPRITE` | Thay Bow reward/gate code-native; onboarding Level 1 |
| P0-10 | **HUD weapon/control icon mapping** | Dùng Shikashi cho Sword, Bow, Axe, attack/skill, Spirit, Campaign, Arsenal, Modes, Bestiary, Settings; thêm normal/pressed/disabled/ready bằng tint/frame/mask. CraftPix chỉ bổ sung portrait Bow nếu thật sự cần | Atlas 32×32 source, padding hiển thị nhất quán; state shape không chỉ dựa vào màu | **Tái dùng asset local**, không tạo pack icon mới ở P0 | Credit Shikashi/game-icons.net; manifest cell; CraftPix license nếu import | `PX-UI` | `hud.gd`, `icon_library.gd`, touch controls, app shell; kiểm tra lại cell bằng mắt trước khi khóa |
| P0-11 | **UI skin/state + Vietnamese font** | Panel/button có normal/hover/pressed/disabled/focus; cooldown ring/mask; HP frame; tutorial callout; font regular + bold hoặc một family đầy đủ dấu Việt | 16/32 px 9-patch hoặc StyleBox/theme; font `.fnt`/`.ttf`/`.otf` | Giữ theme code-native nếu đọc tốt; **tải font OFL/compatible**; chỉ tạo chrome art khi cần identity | Font license, author, version; UI source/prompt nếu tạo raster | `PX-UI`, `FONT-PX` | Toàn HUD/shell; ưu tiên touch/focus/safe-area hơn trang trí |
| P0-12 | **World shadow/decal set** | Hero shadow 1; enemy shadow 2 size; projectile shadow 2; landing marker 4f; dash dust 6f; footprint optional 4f | 16/32 px PNG RGBA, alpha mềm chỉ theo nấc pixel có chủ ý | Tạo | Author/source | `PX-VFX` | Top-down depth, đặc biệt Falling Arrow |
| P0-13 | **P0 combat SFX** | Sword whoosh light ×3, heavy ×2, Dash Slash ×2, hit flesh ×3, hit armor ×2, Bow launch ×2, fall whistle ×1, arrow impact ×3, volley ×1, Reverse Shot ×1, Spirit trigger ×2, swap ×2, dash ×2, player hurt ×3, enemy hurt/death ×4, pickup/unlock ×3, UI navigate/confirm/back ×3: **tối thiểu 35 cue/variation** | WAV 48 kHz; đa số mono; mỗi cue 0.1–1.5 s | Tải legal SFX pack hoặc tự thu/synthesize; không lấy audio game khác | License, source URL, receipt nếu paid, attribution, raw master | `SFX` | Bus Master/Music/SFX/UI đã có; cần import clip hợp pháp, event/cue map và gameplay/UI wiring |
| P0-14 | **P0 music + ambience** | Dungeon exploration/combat loop 1 (60–120 s), elite sting 1, victory 1, defeat 1, crypt ambience loop 1 | OGG stereo 48 kHz; seamless loop; WAV master lưu ngoài export | Tải/commission/generate có commercial grant | Composer/model terms, source, stem/master, cue sheet | `MUSIC`, `AMBIENCE` | Level 1, state transition, result overlay |
| P0-15 | **P0 objective/reward micro-art** | Bow unlock badge 1; Sword/Bow swap diagram 2; tutorial hand/tap/drag arrows 4; objective/sigil icons 2 | 32/64 px PNG RGBA | Tạo, có thể generate rồi pixel-clean | Prompt/source + commercial proof | `PX-UI` | Contextual tutorial và Bow unlock; không dùng text wall |

### P0 acceptance cho asset

- Nhìn screenshot tĩnh phải nhận ra world top-down ngay dù body chỉ có visual trái/phải; foot anchor, shadow, y-sort và ground telegraph không được tạo cảm giác platform.
- Sword và Bow phân biệt được chỉ bằng silhouette, không cần đọc text/màu.
- Bow reward, Falling Arrow và Reverse Shot không còn phụ thuộc hoàn toàn vào line/arc code-native.
- Mỗi enemy attack nguy hiểm có anticipation và shape telegraph đọc được khi VFX đang chạy.
- Tất cả file có proof license trước khi đánh dấu production-ready.

## 7. P1 — Asset cho Chapter 1 hoàn chỉnh (Level 1–10)

Axe combat và character form `AxeWarriorRPG` đã chạy được ở Phase 3. P1-01 vì vậy **không còn là yêu cầu vẽ lại toàn bộ Axe từ số 0**; nó là gói hoàn thiện production bắt buộc để sửa perspective/scale, tách rìu khỏi các trạng thái projectile và thay phần Spirit/reward/VFX/icon còn code-native.

| ID | Asset/loại | Minimum deliverable: animation, hướng, frame | Kích thước/format/alpha | Tải hay tạo | License proof phải lưu | Import | Dependency / nơi dùng |
|---|---|---|---|---|---|---|---|
| P1-01 | **Axe production completion + top-down readability** | Giữ visual lateral + flip theo user decision; body weaponless hoặc body + Axe overlay/socket; Throw release 4–6f, outbound/return spin 6–8f, recall/catch 4–6f; Axe Spirit, reward/pedestal, Cross Cut 6f, Follow-through 6–8f, impact/trail và icon; không còn rìu duplicate khi projectile bay | Ưu tiên canvas 48/64 và body 24–32 px theo P0; nếu giữ 120×80 phải khóa anchor `(60,80)` và pass scale trên tile 16 px; Axe 32×32, VFX 64 px; PNG RGBA + source | Sửa/commission từ source tích hợp; không tải pack lệch style để vá | Author/contract hoặc generator + prompt/input + edit log; commercial/derivative proof cho mọi reference, đặc biệt FreeKnight; hash/source manifest | `PX-SPRITE`, `PX-VFX`, `PX-UI` | Level 5 unlock; giữ contract swap/animation và gameplay Axe Hand/Spirit |
| P1-02 | **Blood Vampire production pass** | Giữ strip 6/8/16/5/14; lateral + flip; bổ sung lunge trail, miss/wall-recovery cue, blood-leech hit, Spirit-drain warning và vulnerable pulse | Enemy 32×32; VFX 32/64 px | Polish asset/source hiện có; không tải Dasher thay thế | Pixel_Poem source/license snapshot + edit log | `PX-SPRITE`, `PX-VFX`, `PX-UI` | Phủ dash pressure/Spirit disruption trong roster user-approved |
| P1-03 | **Bone Reaper production pass + projectile** | Giữ strip 6/10/15/5/15; lateral + flip; spectral disc fly/turn/return 4–8f, impact 6f, line tell, ranged pressure SFX | Enemy 32×32; projectile 16/32 px | Polish asset/source hiện có | Pixel_Poem source/license snapshot + edit log | `PX-SPRITE`, `PX-VFX` | Phủ Shooter-like role trong roster user-approved |
| P1-04 | **Skeleton Swordsman variants** | Hai palette/silhouette variants có readable weapon/body difference; lateral + flip; có thể reuse timing P0-07 | 32×32 PNG RGBA | Tạo từ source P0-07 nếu modification grant cho phép | Modification/license proof | `PX-SPRITE` | Encounter variety, summon của Elite |
| P1-05 | **Elite Captain** | Lateral + flip: idle 6; move 8; melee pattern A/B 8f mỗi; dash 6; ranged/AOE 8; summon 8; stagger/break 4; phase/enrage 6; hurt 2; death 10–12 | 64×64 fixed cell; PNG RGBA | Tạo/commission unique | Contract/source/prompt | `PX-SPRITE`, `PX-VFX` | Level 4 elite; elite event/readability |
| P1-06 | **Chapter 1 boss — 2 phase** | Lateral + flip; tối thiểu 4 attack clip/phase 8–12f; phase transition 12–16; stagger/break 6; hurt 3; death 16; boss projectiles/AOE/summon effects; portrait 1 | Boss 64×64 hoặc 96×96; VFX 64/96; portrait 128×128 | Tạo/commission; không ghép random pack | Contract/source/prompt | `PX-SPRITE`, `PX-VFX`, `PX-UI` | Level 10, Monster Part reward, Bestiary/level card |
| P1-07 | **Dungeon module expansion** | Ít nhất 3 floor families, 3 wall trims, 6 pillar/corner, 8 rubble/decal, 4 door/arch, 6 breakable props, 2 arena markers; auto-tile/terrain combinations đầy đủ | Atlas bội 16, PNG RGBA/opaque theo layer | Tải extension cùng license/style hoặc tạo palette-compatible | Pack version/source/license | `PX-TILE`, `PX-SPRITE` | Levels 2–10; tránh một map lặp 10 lần |
| P1-08 | **Hazard/breakable set** | Spikes 4–6f; poison/fire floor 6–8f; falling debris tell+impact 6f; breakable pot/crate 3 states + break 6f; health pickup 6f | 16/32/48 px PNG RGBA | Tạo/tải coherent pack | Source/license | `PX-SPRITE`, `PX-VFX` | Encounter variation, rare heal, tutorial hazards |
| P1-09 | **Title/Hub/Campaign shell** | Logo 1; title background 1 layered scene; five nav icons; Chapter 1 map nodes 10 + boss marker; locked card frame; level-detail frame; transition/loading motif | UI icons 32/48; panels 9-patch; art 640×360 hoặc layered 320/640 width PNG | Tạo/generate + manual pixel cleanup | Prompt, model terms, author, source layers | `PX-UI` | Boot/Title → Hub → Campaign → Level Details |
| P1-10 | **Arsenal/Loadout/Mastery UI** | Slot frames Hand/Spirit/locked Spirit; Sword/Bow/Axe portraits; 6 ability icons; cooldown/trigger badges; 3 mastery track headers + ~12 node icons; Test Build icon | 32/48/64 PNG RGBA; 9-patch panels | Tạo | Prompt/source/license | `PX-UI` | Progressive disclosure, loadout, Chapter 1 mastery |
| P1-11 | **Results/unlock/bestiary UI** | Victory/defeat header; reward card; weapon unlock burst; 4 enemy portraits/silhouettes; optional objective icons 10; currency/mastery icons 4 | Icon 32/48; portrait 96/128; PNG RGBA | Tạo/generate | Prompt/source/license | `PX-UI` | Results, unlocks, Bestiary, Chapter progress |
| P1-12 | **Chapter 1 audio expansion** | Axe actions ×10; Dasher cues ×5; Shooter/projectile ×6; Elite cues ×8; Boss phase/attack/death ×15; chest/sigil/gate/health ×8; UI/loadout/mastery/result ×12; hub/elite/boss/victory music 4 loops/stings: **tối thiểu 60 cue + 4 music state** | WAV SFX, OGG music | Tải/commission/synthesize | Per-pack/per-composer proof | `SFX`, `MUSIC` | Toàn Chapter 1 và menu flow |
| P1-13 | **First Monster Part presentation** | Part icon 1; boss drop 6–8f; pickup card art 1; socket marker 1; attached Sword/Bow/Axe effect accent 3 | Icon 32/48; VFX 32/64; PNG RGBA | Tạo | Author/prompt/source | `PX-UI`, `PX-VFX` | Level 10 reward/foundation cho Forge; không cần mở full Forge sớm |

### P1-01 acceptance riêng cho Axe

- Swap Sword/Bow ↔ Axe vẫn chỉ đổi presentation form: position, facing, collider, HP/stamina và combat state hợp lệ được giữ nguyên.
- Ở 640×360, body/rìu không lấn át enemy 32–48 px và chân bám mặt sàn; kiểm tra thêm mobile 20:9.
- Idle/run và action chính đọc rõ ở visual trái/phải; flip phải an toàn cho outline/highlight, còn hitbox/projectile vẫn theo vector gameplay 360°.
- Từ lúc projectile rời tay đến lúc catch, character không còn rìu baked; outbound/return/catch khớp event gameplay, không chỉ khớp độ dài clip bằng mắt.
- Bàn giao gồm source editable hoặc generator revision, sheet PNG, tag/timing/pivot manifest, icon/VFX, preview trên map, edit log và trọn bộ proof ở mục 10.
- Test asset contract, swap integration, combat regression và MCP phải tiếp tục pass; test kỹ thuật không được dùng để miễn visual/license review.

## 8. P2 — Asset cho Chapter 2, Forge và endgame

| ID | Asset/loại | Minimum deliverable: animation, hướng, frame | Kích thước/format/alpha | Tải hay tạo | License proof phải lưu | Import | Dependency / nơi dùng |
|---|---|---|---|---|---|---|---|
| P2-01 | **Bulwark enemy** | Lateral + flip: idle/move; shield raise 4f; block loop 4f; shield bash 8f; turn/exposed 4f; break/stagger 6f; hurt/death | 48×48 hoặc 64×64 PNG RGBA | Tạo/commission cùng enemy family | Contract/source | `PX-SPRITE`, `PX-VFX` | Chapter 2 frontal-projectile counter; facing logic gameplay không phụ thuộc số sprite direction |
| P2-02 | **Venom Crawler** | Lateral + flip: idle 4; crawl 8; bite 6; spit 6; lay hazard 8; hurt 2; death 8; poison pool spawn/loop/fade 6/6/6 | Enemy 32/48; pool 64 px; PNG RGBA | Tạo/commission | Contract/source | `PX-SPRITE`, `PX-VFX` | Chapter 2 ground-hazard role |
| P2-03 | **Spirit Leech** | Lateral + flip: float idle 6; move 6; disruption charge 6; beam/drain 6–8; interrupted 4; hurt 2; death 10; Spirit lock warning icon/pulse | 48×48; beam 64/128 strip; PNG RGBA | Tạo/commission | Contract/source | `PX-SPRITE`, `PX-VFX`, `PX-UI` | Chapter 2 Arsenal disruption; warning phải rõ |
| P2-04 | **Chapter 2 elite** | Tối thiểu 7 clip lateral + flip: idle, move, 3 attacks, stagger, death; thêm summon/phase nếu pattern cần; 6–12f/clip | 64/96 px PNG RGBA | Tạo/commission unique | Contract/source | `PX-SPRITE`, `PX-VFX` | Late Chapter 2 elite encounter |
| P2-05 | **Chapter 2 boss — 2+ phase** | Lateral + flip; tối thiểu 5 attack/phase; transition, break, death; 8–16f/clip; projectile/AOE/summon suite; portrait | 96×96 hoặc 128×128; VFX 64/128 | Tạo/commission flagship | Contract/source layers | `PX-SPRITE`, `PX-VFX`, `PX-UI` | Level 20 finale và Depth unlock |
| P2-06 | **Second Spirit HUD expansion** | Spirit slot 2 normal/selected/ready/cooldown/locked; dual-ready pulse; Q/E callout; direct-swap tutorial diagram 2 | 32/48 px PNG RGBA, shape-coded | Tạo cùng P0/P1 UI family | Author/source/prompt | `PX-UI` | Level 10 completion và Chapter 2 onboarding |
| P2-07 | **Monster Part set** | Predator Jaw, Venom Spine, Giant Heart: 3 icons, 3 drop objects 6–8f, 3 socket accents, Hand/Spirit VFX variants cho Sword/Bow/Axe = tối thiểu 18 effect variants | Icon 48; VFX 32/64/96 PNG RGBA | Tạo; giữ palette theo Part và shape riêng | Prompt/source/author | `PX-UI`, `PX-VFX` | Forge, Hunt, Bestiary, Part behavior readability |
| P2-08 | **Forge UI/art** | Forge background/module; compatible socket; before/after comparison; craft/refine/salvage buttons; pity/fragment meter; confirmation; 3 Part cards | Panels 9-patch; icon 32/48; illustration tối đa 320×180 | Tạo/generate + cleanup | Prompt/model terms/source | `PX-UI` | Monster Forge, crafting, Part inventory |
| P2-09 | **Rarity/affix/loot set** | Common/Rare/Epic/Legendary frames; 12–16 affix icons; locked/favorite/equipped/protected; salvage material; lost-loot marker; pickup beam 4 màu × 8f | 32/48 PNG; VFX 64 px | Tạo | Author/source/prompt | `PX-UI`, `PX-VFX` | Inventory, quick compare, salvage, Lost Loot |
| P2-10 | **Hunt/Challenge/Depth mode art** | 3 mode cards; Hunt target badge; 8 modifier icons; timer/score icons; Depth floor/room marker; checkpoint/rest/boss-room icons; local leaderboard badge | Icon 32/48; card illustration 256×144 hoặc 320×180 | Tạo/generate | Prompt/source/license | `PX-UI` | Modes screen và result flows |
| P2-11 | **Bestiary/encounter portraits** | Portrait/silhouette cho toàn bộ 3 weapon + tối thiểu 9 enemy/elite/boss; discovered/undiscovered states; telegraph thumbnails 3 shape families | Portrait 96/128; thumbnail 64; PNG RGBA | Tạo từ source character sheets | Derivative/source proof | `PX-UI` | Bestiary, level details, Hunt board |
| P2-12 | **Endgame environment variants** | Ít nhất 2 palette/prop families mới; 12 room markers; 6 Depth modifier decals; 3 rest/reward props; 3 boss-gate variants; foreground occluder set | Tile atlas 16 px; props 16/32/64 PNG | Tải coherent CC0/commercial pack hoặc tạo | Exact pack/version/license | `PX-TILE`, `PX-SPRITE` | Levels 11–20, Hunt, Challenge, Depth |
| P2-13 | **Chapter 2/endgame audio** | 3 enemy families ×5 cue; elite ×8; boss ×18; Forge/craft/salvage ×12; rarity/pickup ×8; Hunt/Challenge/Depth UI ×10; Chapter 2/Forge/Boss/Depth music 5 loops; mode/victory stings 5 | WAV SFX, OGG music/ambience | Tải/commission/synthesize | Per-pack/per-composer proof | `SFX`, `MUSIC`, `AMBIENCE` | Chapter 2 và repeatable modes |
| P2-14 | **Accessibility visual variants** | Normal + 3 telegraph palette LUT/token sets; high-contrast enemy outline mask; reduced-flash versions cho 10 core VFX; icon shape alternatives nơi chỉ khác màu | PNG mask/palette table; shader-safe | Tạo từ source, không cần art mới hoàn toàn | Source revision log | `PX-VFX`, `PX-UI` | Color-blind, reduced flashes, high contrast |

## 9. Audio cue checklist theo master spec

Đây là checklist để tránh mua một pack “combat sounds” nhưng vẫn thiếu cue quan trọng.

- **Sword:** light swing/hit, finisher swing/hit, Dash Slash start/path/impact, Flying Sword launch/slash/return.
- **Bow:** launch/upward release, falling whistle, landing marker tick, impact, Triple Volley launch/line pass/impact, Reverse Shot trigger/pass.
- **Axe:** charge loop/tick, release, cleave hit, outbound spin, outbound hit, recall, return hit, catch, Cross Cut, Follow-through.
- **Player/system:** dash, swap, Spirit ready/trigger, trigger progress tick, hurt, low HP, death, heal, interaction, pickup, unlock.
- **Enemy:** telegraph, melee, projectile, dash, miss/wall stun, hurt, stagger, death; elite spawn/phase; boss attack/phase break/death.
- **UI:** navigate, focus, confirm, back, locked, error, equip, unequip, favorite, salvage, craft, result, reward reveal.
- **Music states:** hub, normal combat/exploration, elite, boss, victory, defeat, Forge, Challenge/Hunt, Depth.

Mỗi family cần 2–4 variation cho cue lặp nhiều; không chỉ pitch-random một file duy nhất nếu nghe rõ artifact.

## 10. License manifest bắt buộc

Mỗi asset tải/commission/generate nên có folder bằng chứng riêng:

```text
assets/licenses/<asset_id>/
  LICENSE.txt                 # toàn văn license hoặc grant
  SOURCE_URL.txt              # URL + ngày lấy
  AUTHOR.txt                  # tên tác giả/studio
  VERSION.txt                 # version pack/model/date
  ATTRIBUTION.txt             # dòng credit phải hiển thị
  archive.sha256              # hash file tải gốc
  purchase_receipt.pdf        # nếu paid, có thể lưu private ngoài repo
  source_page_snapshot.pdf    # snapshot điều khoản lúc tải
  GENERATION_PROMPT.md        # nếu AI-generated
  EDIT_LOG.md                 # crop, recolor, pixel cleanup, derivative
```

Điều kiện đổi trạng thái sang `production-ready`:

1. Có quyền commercial use và quyền chỉnh sửa.
2. Điều khoản redistribution cho phép đưa texture/audio đã đóng gói vào game.
3. Attribution có thể thực hiện được và đã được đưa vào Credits/Third Party.
4. Không dùng asset “free” chỉ dựa vào tên file/tiêu đề archive.
5. Với generated asset, lưu model/tool/version, prompt, reference quyền sở hữu và bước chỉnh sửa.

Riêng `AxeWarriorRPG`, tối thiểu phải bổ sung `LICENSE.txt` hoặc usage grant, prompt/input provenance, revision/hash của generator, danh sách reference và quyền tạo derivative, cùng `EDIT_LOG.md`. `ASSET_SOURCE.md`, manifest và kết quả test hiện tại là bằng chứng kỹ thuật, không thay thế các tài liệu pháp lý này.

## 11. Cấu trúc asset đề xuất

```text
assets/
  art_direction/
    palette.png
    scale_reference.png
    style_guide.md
  characters/
    player/<set_id>/
    enemies/<enemy_id>/
    bosses/<boss_id>/
  weapons/<weapon_id>/
    hand/
    spirit/
    projectiles/
    vfx/
    ui/
  environment/<biome_id>/
    tiles/
    props/
    hazards/
    decals/
  ui/
    icons/
    panels/
    tutorials/
    portraits/
    fonts/
  vfx/
    shared/
    telegraphs/
    accessibility/
  audio/
    sfx/<system>/
    music/
    ambience/
  licenses/<asset_id>/
art_source/                    # .aseprite/.kra/.psd, không nhất thiết export
```

Không ghi đè asset placeholder cho tới khi scene/resource đã trỏ sang set mới và smoke test pass. Mỗi set nên có `manifest.json` hoặc `.md` ghi cell size, directions, tag names, FPS, pivot/foot anchor và license ID.

## 12. Thứ tự mua/tạo thực tế

1. **Chốt style guide trong một ngày:** 16 px tile grid, body size, lateral visual L/R + flip, foot anchor/shadow top-down, palette, outline, light direction và UI icon style.
2. **Làm một art test nhỏ:** Hero idle/run + Sword hit 1 + một Chaser + một Bow sprite + một telegraph trên chính map hiện tại. Chụp ở 640×360 và mobile 20:9.
3. Chỉ sau khi test đạt mới đặt/tải toàn bộ **P0-01 → P0-15**.
4. Hoàn thành vertical slice và kiểm tra readability trước khi polish/retarget AxeWarriorRPG, boss và UI lớn của P1.
5. Tạo P2 theo system đã thực sự được implement; không mua hàng loạt portrait/Forge/rarity trước khi data contract ổn định.

### Budget bucket gợi ý

- **Phải custom/commission hoặc generate có cleanup:** Hero, Sword/Bow; phần production completion của AxeWarriorRPG; Weapon Spirits, bosses, core UI identity, title/logo, Part effects.
- **Có thể tải pack coherent có license:** Dungeon extension, generic props, common enemies nếu perspective/palette khớp, SFX, music, font.
- **Có thể giữ từ project hiện tại:** 0x72 map atlas; ba enemy Pixel_Poem và Shikashi làm production candidates sau khi đóng gói proof; props cũ chỉ sau khi bổ sung proof; FreeKnight làm placeholder; AxeWarriorRPG làm integrated prototype cho tới khi giải quyết readability/scale/throw-state/provenance/license.

## 13. Definition of done cho audit này

Audit chỉ xác nhận **inventory và nhu cầu**, không tuyên bố game đã đủ asset. Tại thời điểm 2026-07-14:

- Map foundation: **ready**.
- Hero art coherence: **chưa đạt**; hai hướng là contract đúng, nhưng FreeKnight/AxeWarriorRPG vẫn có silhouette/platform staging chưa hòa với foot anchor, shadow và tile scale top-down.
- Sword/Bow production art: **chưa có**, vẫn dùng FreeKnight và visual code-native.
- Axe body/action raster: **đã tích hợp ở mức prototype**; production completion **chưa đạt** vì scale/perspective, rìu baked khi Throw & Recall, các visual Spirit/projectile/reward/VFX/icon và license/provenance.
- Enemy roster art: **đã có đủ ba silhouette user-approved ở mức integrated prototype** — Skeleton Swordsman, Bone Reaper, Blood Vampire; chưa có Elite/Boss, campaign variants và production VFX/SFX/data pass.
- UI production skin/font: **chưa có**.
- Audio asset/cue wiring: **chưa có**; bốn bus chỉ là routing foundation.
- Campaign content: **0/20 level**; Chapter 1/2/boss/endgame art **chưa có**.

Backlog P0 phải được hoàn thành trước khi gọi một campaign Level 1 tương lai là visual vertical slice. Map hiện tại phải gọi là **Training/Test Build**, không phải Level 1. P1/P2 triển khai dần theo milestone gameplay để tránh tạo asset sai contract; campaign vẫn **0/20 level hoàn chỉnh**.
