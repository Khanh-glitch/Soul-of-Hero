# Chapter 2 — Xưởng Hắc Phù: bản thiết kế hoàn chỉnh

**Tên hiển thị:** Xưởng Hắc Phù — *Coven Foundry*  
**ID nội bộ giữ ổn định:** `chapter_2_ashen_foundry`  
**Campaign slots:** 11–20  
**Trạng thái:** canonical design, sẵn sàng tách thành resource/runtime task  
**Ngày khóa thiết kế:** 2026-07-16

Tài liệu này thay thế phần Chapter 2 cũ mang tên *Ashen Foundry* trong các spec
trước đây. Khi có xung đột về Chapter 2, tài liệu này là nguồn ưu tiên. Nó không
tuyên bố Levels 11–20 đã playable; mọi mục dưới đây là hợp đồng sản xuất và cân
bằng phải được hiện thực, test và playtest trước khi quảng bá content là hoàn tất.

## 1. Quyết định khóa

Chapter 2 phải tạo cảm giác vừa thoát khỏi một hầm ngục hữu hình nhưng lập tức rơi
vào một nhà máy phù thủy còn đáng sợ hơn: không rèn kim loại mà tháo rời ký ức,
ý chí và Soul để sản xuất Hero Soul nhân tạo.

Bốn lực lượng có vai trò rõ ràng:

1. **Quái mới thường:** Oán Linh Hắc Khế, dùng visual Ghost đã duyệt. Đây là một
   family duy nhất với ba behavior profile dễ phân biệt để đủ chiều sâu mà không
   làm loãng silhouette và ngân sách asset.
2. **Elite:** Ma Dực Khế Ước, dùng Flying Demon đã duyệt; là tay sai có tên và
   mini-nemesis, không bị director roll như quái thường.
3. **Boss chính:** Hero Soul Wizard ở Level 20, visual flagship đang được thiết kế.
4. **Boss truyện đặc biệt:** Axe ở Level 15. Axe nằm ngoài ba lực lượng chính,
   cực mạnh, phá đội hình và bắt buộc chạy thoát khi còn đúng 50% HP.

Các quyết định không được tự ý đảo ngược trong lúc triển khai:

- Không dùng Skeleton, Reaper hay Vampire làm population thường của Chapter 2.
- Không dùng `Bringer of Death` làm Wizard; asset đó được giữ cho content Reaper
  cấp cao sau này.
- Level 15 **không** cấp Axe Soul, không cấp ownership `axe_hero`, không phát
  death event và không chạy death-loot pipeline.
- Level 20 phải hạ Wizard thật, tạo Wizard Soul vật lý, buộc người chơi tương tác,
  đưa Soul vào inventory và vẫn yêu cầu **Equip** rõ ràng.
- ID Hero canonical là `wizard_hero`. `mage_hero` chỉ là legacy alias cần migration
  một chiều, không phải một Hero thứ hai.
- Không dùng tăng mật độ vô hạn để tạo độ khó. Độ khó đến từ vai trò phối hợp,
  vị trí, telegraph và objective pressure.

## 2. Lời hứa trải nghiệm

Chapter 2 được xây quanh nhịp:

`học một mối đe dọa → phối hợp ba vũ khí/hai Spirit → bị Axe phá nhịp ở giữa
chapter → làm chủ không gian và objective → hạ Wizard → tự tay thu hồi Wizard Soul`

Năm trụ cột:

- **Tối nhưng đọc được:** bóng tối là mood và viền màn hình, không được che nhân
  vật, đường né hoặc telegraph.
- **Ba vũ khí thật sự cần nhau:** enemy composition tạo lý do đổi Hand/Spirit,
  nhưng không hard-lock một vũ khí cụ thể.
- **Áp lực có nhịp thở:** mỗi đợt khó đều có recovery/punish window; không chồng
  Spirit lock, độc, elite dive và spawn ngoài màn hình cùng một lúc.
- **Mỗi level có một động từ riêng:** thanh lọc, hộ tống, quá tải, truy dấu, giải
  mê cung, mang di vật; không biến cả chapter thành `kill all`.
- **Giữ chân bằng mastery, không bằng bẫy:** phần thưởng có mục tiêu, Hunt có pity,
  retry nhanh và preview rõ; không dùng energy gate, FOMO hoặc grind bắt buộc.

Mục tiêu thời lượng:

| Loại | First clear | Replay thành thạo |
|---|---:|---:|
| Level thường | 120–210 giây | 75–135 giây |
| Level 15 | 150–240 giây | 90–150 giây |
| Level 20 | 300–420 giây cả level | 210–300 giây |

Boss finale là ngoại lệ có chủ ý so với nhịp 60–120 giây của level thường. Mọi
retry boss phải bắt đầu ở checkpoint trước cửa và quay lại gameplay trong dưới
5 giây.

## 3. Fantasy, cốt truyện và nhịp kể

### 3.1 Tiền đề

Cổng cuối Chapter 1 không phải lối thoát. Nó là một đường hút Soul của Hắc Hội,
ném người chơi xuống đầm tro bao quanh Xưởng Hắc Phù. Dây chuyền tại đây có ba
công đoạn được kể bằng môi trường thay vì exposition dài:

1. **Khâu xác:** ghép một vật chứa bằng xương, gỗ đen và sáp nghi lễ.
2. **Hòa ký ức:** nấu ký ức trong độc dịch, tạo những Oán Linh mất danh tính.
3. **Hút ý chí:** Wizard ép phần ý chí còn lại vào một lõi Soul nhân tạo.

### 3.2 Axe

Axe từng chống lại dây chuyền nhưng đang bị một Hắc Khế giữ lại. Khi gặp người
chơi mang nhiều dấu Soul, Axe tưởng họ là thợ săn của Hắc Hội. Trận Level 15 phá
được một nửa phong ấn chứ không đánh bại Axe. Ở 50%, Axe tự chém đứt khế ước,
phá đấu trường và trốn sâu vào mạng cổng.

Người chơi nhận **Khế Rìu Nứt** — `fractured_axe_insignia` — làm manh mối truy
dấu. Đây là story/key item, không thể Equip, Sell, Fusion hoặc được biểu diễn như
Hero Soul. Câu chuyện tuyển Axe được dời đến lần Axe thật sự bị hạ và rơi Soul.

### 3.3 Wizard

Wizard là kiến trúc sư của dây chuyền luyện Soul. Kit boss cho người chơi nhìn
thấy một phiên bản đối địch, công bằng của `Wandering Shade`, `Dark Point` và
`Dark Passage` trước khi sở hữu Hero. Khi Wizard chết, lớp hắc hóa tan ra và
Wizard Soul thật xuất hiện. Việc tự tay nhặt Soul là khoảnh khắc kết thúc chapter.

### 3.4 Quy tắc kể chuyện

- Intro/outro không quá 10 giây và luôn cho skip; lần replay mặc định bỏ qua.
- Bark chiến đấu tối đa một câu, không hiện text trên vùng HUD điều khiển.
- Không dùng cutscene để che việc boss chuyển phase hoặc spawn không công bằng.
- Các câu khóa đề xuất:
  - Mở chapter: **“Đây không phải lối thoát. Đây là miệng lò.”**
  - Axe vào trận: **“Mùi khế ước… các ngươi cũng đến lấy ta?”**
  - Axe chạy: **“Không ai sở hữu lưỡi rìu này.”**
  - Wizard: **“Ý chí chỉ là tạp chất.”**

## 4. Art direction và ngôn ngữ thị giác

### 4.1 Palette

| Vai trò | Màu gợi ý | Dùng cho |
|---|---|---|
| Nền hắc ám | `#0B0913` | void, vignette, khoảng chết |
| Đá/xưởng | `#242033` | floor, tường, máy móc |
| Phép Hắc Khế | `#7A3FB0` | portal, Wraith, Wizard |
| Độc dịch | `#79B85A` | pool, cauldron, Venom profile |
| Tương tác an toàn | `#D59A45` | checkpoint, objective, pickup |
| Nguy hiểm | cam/đỏ + shape | hit telegraph, không chỉ dựa vào màu |

Silhouette player và Soul luôn có rim light ấm; enemy dùng rim tím/lục. Không
phủ shader tối toàn màn. Geometry ở mép đường đi phải sáng hơn backdrop ít nhất
một bậc luminance.

### 4.2 Không gian

- **Ngoại vi:** đầm tro, cửa hang, cầu đá cong và cây khô dùng RPG Worlds Caves.
- **Khu xưởng:** nền đá, phòng giả kim, giá sách, nồi phép, bàn mổ và rune dùng
  Pixel Crawler.
- **Lõi xưởng:** hình tròn, đối xứng hơn, ít clutter để Wizard telegraph rõ.
- Tile/grid chuẩn: 16×16, nearest filtering, integer scale khi có thể.
- Prop không gameplay phải có collision tối thiểu; mọi vật che nhân vật cần fade
  hoặc cắt thấp để không giấu hitbox.

### 4.3 Telegraph dictionary

| Mối đe dọa | Hình | Màu/nhịp |
|---|---|---|
| Poison | vòng tròn đặc + icon giọt | lục, pulse chậm |
| Spirit lock | xích/móc quanh đúng Spirit icon | magenta, countdown số |
| Elite dive | lane có đầu mũi tên | cam–tím, quét một chiều |
| Axe outbound/return | nét liền / nét đứt | đỏ sẫm / vàng trắng |
| Wizard Passage | vòng rỗng đánh số I–II–III | tím, pitch tăng dần |
| Safe interaction | diamond/rune rỗng | vàng, không pulse như danger |

Chế độ color-blind thay đổi hue nhưng giữ nguyên shape, line style và icon.

## 5. Asset mapping và production gate

| Nội dung | Asset/proxy đã chọn | Gate |
|---|---|---|
| Map ngoài | `assets/library/downloaded/rpg_worlds_caves_2_1/MainLev2.0.png` | Có bundled license; production được |
| Nội thất | `assets/library/downloaded/pixel_crawler_free_2_11/Environment/Tilesets/Dungeon_Tiles.png` | Terms cho phép thương mại/chỉnh sửa |
| Prop phù thủy | `.../Environment/Props/Static/Esoteric.png`, `.../Environment/Structures/Stations/Alchemy/Alchemy_Table_03-Sheet.png` | Cùng Pixel Crawler; production được |
| Wraith family | `assets/library/downloaded/legacy_collection/Assets/Gothicvania/Characters/Ghost-Files/` | Public-license pack; production được sau perspective/palette pass |
| Elite | `assets/library/downloaded/flying_demon_2d_pixel_art/Sprites/with_outline/` | License rõ; production được |
| Axe | `assets/characters/axe_warrior/` + `assets/vfx/axe/` | Gameplay có; phải chốt provenance và bổ sung throw/catch không rìu trước release |
| Wizard boss | Art custom đang thiết kế | Flagship blocker; không ship bằng proxy |
| Wizard greybox | Pixel Crawler `Entities/Npc's/Wizzard/` | Licensed proxy; chỉ dùng nội bộ |
| Wizard Soul | `assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons79.png` | Dùng làm icon identity/loot; credit LimeZu |
| Shade icon | `.../staffs/rpg_icons71.png` | Skill/normal icon |
| Dark Passage icon | `.../staffs/rpg_icons87.png` | Active skill icon |
| Portal/absorb VFX | `assets/vfx/world/fantasy_portal_64x64_12.png`, `assets/vfx/untied/spell_absorb_001_small_violet.png` | Dùng được theo source note/credit |
| Poison/violet lightning | Super Pixel Effects Gigapack Free | Commercial với attribution; ghi Credits |

Không được promote `wizard_pack`, `dark_vfx_01_02`, Golem hoặc các pack thiếu
local license proof thành production asset. Có thể dùng trong greybox nội bộ với
watermark `PROTOTYPE_ONLY`, nhưng build release phải fail asset validation nếu
đường dẫn đó còn được tham chiếu.

Wizard art final tối thiểu cần: idle 6f, move 6–8f, Shade cast 8f, Passage cast 8f,
teleport out/in 6+6f, Distillation 10f, hurt 3f, poise break 6f, transition 12f,
death 12–16f; canvas 64 hoặc 96 px, foot pivot cố định.

## 6. Roster thường — family Oán Linh Hắc Khế

Để giữ đúng ba headline category người dùng đã khóa, Chapter 2 có **một family
quái thường** dùng cùng Ghost silhouette. Family có ba behavior resource/palette
profile nhằm tránh một-note combat và vẫn thỏa nhu cầu counter ba-vũ-khí. Cả ba
đều là content mới; không phải reskin chỉ đổi HP.

### 6.1 Oán Linh Truy Ấn — `coven_wraith`

Vai trò: pressure cơ bản, dạy nhịp appear/vanish và tạo khoảng trống cho hai
profile chiến thuật hơn.

| Thuộc tính authored | Giá trị |
|---|---:|
| HP | 82 |
| Damage | 13 |
| Move | 64 px/s |
| Telegraph | 0,65–0,75 s |
| Recovery | 0,85 s |
| Cooldown | 2,3 s |
| Mastery | 16 |
| Threat cost | 1,0 |

Moves:

- **Soul Swipe:** wedge ngắn, khóa hướng sau 60% wind-up.
- **Shriek Step:** báo bằng rune 0,45 giây, biến mất rồi tái hiện ở safe point
  96–144 px; không tấn công hoặc va chạm khi vô hình.
- Nếu tái hiện thất bại ba candidate liên tiếp, trở lại vị trí cũ và vào recovery;
  tuyệt đối không teleport vào geometry hoặc ngay trên player.

### 6.2 Oán Hồn Độc Chú — `venom_bound_wraith`

Vai trò: ranged hazard và cắt đường, dùng cùng Ghost sheet với lõi lục và poison
VFX; không thêm một silhouette pack thiếu license.

| Thuộc tính authored | Giá trị |
|---|---:|
| HP | 84 |
| Bite / Spit | 14 / 9 |
| Move | 64 px/s |
| Preferred range | 144–176 px |
| Spit telegraph | 0,65 s |
| Cooldown | 2,15 s |
| Threat cost | 1,25 |

Moves và giới hạn:

- **Venom Spit:** khóa hướng khi release; landing circle xuất hiện trước impact.
- **Poison Pool:** radius 38 px, tồn tại 3,6 giây, 4 authored damage mỗi 0,75
  giây. Nhiều pool không cộng tick damage trên cùng player.
- **Fang Drift:** khi bị áp sát dưới 44 px, cắn rồi lùi; không nổ độc khi chết.
- Tối đa 2 pool/profile actor, 4 pool/room; pool cách exit, chest và objective
  ít nhất 72 px.
- Hazard coverage tối đa 22% Easy, 25% Medium, 28% Hard; luôn còn một đường liên
  thông rộng ít nhất 48 px.

### 6.3 Oán Linh Đoạt Phách — `spirit_leech`

Vai trò: tạo target priority và kiểm tra khả năng điều hành hai Spirit, nhưng
không được tước toàn bộ Arsenal.

| Thuộc tính authored | Giá trị |
|---|---:|
| HP | 96 |
| Touch/Shriek damage | 11 |
| Move | 55 px/s |
| Preferred range | 128 px |
| Soul Clamp channel | 0,9 s |
| Cooldown | 3,6 s |
| Threat cost | 1,5 |

**Soul Clamp contract:**

- Chọn Spirit slot có trigger progress cao nhất và hiển thị chain icon trên đúng
  slot trong toàn bộ 0,9 giây channel.
- Skill hit hoặc 12 stagger ngắt channel; Leech lộ sơ hở 0,8–0,9 giây.
- Nếu hoàn tất, slot đó tạm không tăng trigger và không phát Summon trong 3 giây.
  Progress không mất, cooldown vẫn tick, Hand action và swap vẫn dùng được.
- Chỉ một lock được tồn tại toàn màn. Sau khi lock hết, player miễn lock 5 giây.
- Không có Spirit hợp lệ thì Clamp đổi thành bolt yếu; không chạy mechanic vô dụng.
- Tối đa 1 Leech trên Easy/Medium, 2 trên Hard; không spawn khi player đang bị
  khóa trong tương tác objective bắt buộc.

### 6.4 Effective stat check

Mọi số authored đi qua `DifficultyRules` đúng một lần, không nhân thêm curve riêng:

| Stage | HP multiplier | Damage multiplier | Speed multiplier |
|---:|---:|---:|---:|
| 11 | 2,912 | 1,478 | 1,060 |
| 15 | 3,625 | 1,656 | 1,084 |
| 20 | 4,477 | 1,869 | 1,114 |

Ví dụ `coven_wraith` đạt khoảng 239 HP / 19 damage / 68 speed ở Easy L11 và
367 HP / 24 damage / 71 speed ở Easy L20. Medium/Hard chỉ áp multiplier hiện có;
không giảm telegraph để bù HP.

## 7. Elite — Ma Dực Khế Ước

**ID:** `hexwing_familiar`  
**Tên:** Ma Dực Khế Ước — *Hexwing Familiar*  
**Asset:** Flying Demon có outline

| Thuộc tính | Giá trị authored/bespoke |
|---|---:|
| Base HP | 124 |
| Base damage | 14 |
| Base move | 70 px/s |
| HP axis | ×2,25 |
| Damage axis | ×1,25 |
| Cadence axis | ×1,10 |
| Move/range axis | ×1,05 |
| Mastery | 64 |
| Threat cost | 4,5 ordinary |
| Alive cap | 1 |

Không dùng nguyên modifier Elite Chapter 1 nếu nó đồng thời nhân mạnh damage và
cadence của multishot. Named Elite không nhận mutant.

Moves:

1. **Triune Bolt:** ba đạn ở `-18° / 0° / +18°`, telegraph 0,65 giây. Mỗi bolt
   chỉ nhận 45% pattern damage và một target nhận tối đa hai bolt.
2. **Hex Dive:** lane telegraph 0,8 giây; hụt hoặc đập tường tạo vulnerable 1 giây.
3. **Familiar Pact:** nối một Wraith trong 160 px, cho 25% damage reduction; link
   vỡ khi Elite stagger, xa hơn 190 px hoặc target chết. Tổng DR cap 50%.
4. **Wingbreak:** dùng một lần dưới 50%; hai dive lane lệch nhau 0,25 giây, sau
   đó recovery 1,2 giây. Không tăng tốc toàn bộ AI.

Arena có Elite tối thiểu 320×240 px. Support cap là ba Wraith và phải nằm trong
threat budget; Elite không được cộng thêm bên ngoài population cap.

Elite xuất hiện thoáng qua ở L14, trực tiếp can thiệp L18 và là named continuous
actor của L19. Hai lần rút lui trước L19 không được giả làm death hoặc phát loot.

## 8. Boss phụ Level 15 — Axe, Kẻ Phá Khế

**ID giữ ổn định:** `axe_soul_boss`  
**Objective type:** `FORCE_RETREAT`  
**Objective event:** `axe_retreated`  
**Story receipt:** `campaign:chapter_2_level_15:axe_retreat:v1`

### 8.1 Baseline

| Thuộc tính | Authored | Easy Stage 15 effective |
|---|---:|---:|
| HP | 1.100 | khoảng 3.988 |
| Damage core | 22 | khoảng 36 |
| Move | 76 px/s | khoảng 82 px/s |
| Poise | 100 | không scale bằng HP |
| Stagger resistance | 50% | 50% |
| Break / immunity sau break | 1,0 s / 3,0 s | như authored |
| Retreat threshold | 50% | cần gây khoảng 1.994 damage |

Axe hồi 18 HP/s nếu không nhận damage trong 1,25 giây, nhưng chỉ trong combat
state và không hồi vượt đầu phase hiện tại. Mục đích là ngăn cheese ngoài tầm,
không biến trận đấu thành DPS check. Nếu telemetry cho thấy người chơi low-Power
bị mất tiến trình, giảm regen trước khi tăng thời lượng hoặc HP.

### 8.2 Phase 1 — 100–75%

| Chiêu | Damage authored | Telegraph/recovery | Luật đọc |
|---|---:|---|---|
| Quick Cleave | 24 | 0,48 / 0,55 s | wedge 70°, khóa hướng sau 60% wind-up |
| Execution Cleave | 54 | 1,0 / 0,9 s | wedge mở tới 150°, âm charge riêng |
| Throw & Recall | 16 mỗi pass | return cue trước 0,38 s | line đi liền, line về đứt |

Khi rìu đang bay, Axe không được dùng Cleave; chỉ reposition hoặc Dash. Một target
nhận tối đa một outbound và một return hit trên mỗi cast. Không cho phép recall
và Execution Cleave tạo hit window cách nhau dưới 1,1 giây.

### 8.3 Phase 2 — 75–50%

Mở thêm:

- **Soul Sever:** X telegraph 0,9 giây, 18 damage. Nếu trúng, khóa tạm Spirit slot
  có progress cao nhất trong 3 giây nhưng không xóa progress; dùng cùng immunity
  chống lock của Spirit Leech.
- **Ironwood Rush:** lane 0,72 giây, 22 damage rồi Quick Cleave; nếu hụt cho punish
  window 1 giây.
- **Ground Rupture:** 46 authored damage, tell 1,1 giây; phá một cover đã đánh dấu
  và để lại crack chỉ làm chậm trong 2,5 giây, không gây damage liên tục.

Scheduler không lặp cùng signature attack hai lần liên tiếp. Sau mỗi signature
phải có một action nhẹ hoặc reposition; Axe mạnh nhờ kiểm soát hình học và ép đổi
vị trí, không nhờ spam một đòn gần one-shot.

### 8.4 Damage safety

Execution Cleave vào người chơi hoàn toàn không đầu tư HP chiếm xấp xỉ 24,5% HP
ở Easy, 30,7% Medium và 38% Hard Stage 15. Đây là đòn nặng có tell dài; không đòn
đơn nào được one-shot full HP và một lần chết phải phản ánh ít nhất hai lỗi lớn.

Boss có thể displacement, phá cover và lock một Spirit, nhưng không được dùng cả
ba trong cùng hit window. Axe không có add để trận đấu vẫn đọc được.

### 8.5 Arena

- Kích thước mục tiêu 400×280 px.
- Hai obelisk mảnh giúp bẻ đường Throw/Recall nhưng đều có thể bị Ground Rupture
  phá theo thứ tự authored.
- Hai lane bên hông rộng ít nhất 64 px luôn tồn tại.
- Axe cách cửa vào ít nhất 220 px, không attack trong 1,2 giây đầu.
- Boss checkpoint hồi player lên tối thiểu 75% Max HP; retry không chơi lại đoạn
  dọn đường.
- Boss bar có notch hình dây xích ở đúng 50% để người chơi hiểu đây là objective.

### 8.6 State machine chạy thoát

Khi bất kỳ damage instance nào vượt threshold:

1. Clamp HP đúng `max_hp * 0.5`; không cho hit, DoT hoặc multihit đi qua.
2. Emit `retreat_threshold_reached` đúng một lần, khóa damage và dừng scheduler.
3. Xóa toàn bộ projectile, hitbox, slow crack và timer thuộc Axe.
4. Chạy time-slow ngắn 0,25 giây; Axe chém vỡ Hắc Khế trong 0,45–0,60 giây.
5. Axe chạy tới cổng bắc trong khoảng 1,2 giây. Player không bị khóa quá 0,6 giây
   và không nhận một objective giả kiểu “bắt hắn”.
6. Nếu navigation/path bị chặn, sau tối đa 4 giây dùng portal/vanish fallback.
7. Chỉ khi actor rời arena mới emit `axe_retreated`, commit story receipt và mở exit.

Tuyệt đối không emit `died`, `enemy_killed` hoặc boss mastery. Retry trước khi
retreat hoàn tất phục hồi Axe full HP và reset arena. Callback trùng phải no-op.

### 8.7 Reward

- `fractured_axe_insignia` / **Khế Rìu Nứt**.
- Account currency, Hero Materials, Monster Fragments và `player_level_grant=1`
  nằm trong bundle L15.
- Không có `axe_hero`, Axe Soul, death loot hoặc ownership reconciliation.
- Item này mở story breadcrumb và có thể làm key cho encounter tuyển Axe sau này;
  bản Chapter 2 không được hứa ngày/level tuyển nếu chưa author.

## 9. Boss chính Level 20 — Hero Soul Wizard

**Boss ID:** `wizard_hero_boss`  
**Hero/reward ID:** `wizard_hero`  
**Tên boss:** Wizard, Kẻ Luyện Hồn  
**Affinity:** `magician`

Boss dùng enemy controller riêng. Không reuse player state machine hoặc copy
nguyên cooldown/i-frame của playable Wizard; nó chỉ dạy cùng ngôn ngữ gameplay.

### 9.1 Baseline và arena

| Thuộc tính | Authored | Easy Stage 20 effective |
|---|---:|---:|
| HP | 1.400 | khoảng 6.267 |
| Damage core | 16 | khoảng 30 |
| Move | 62 px/s | khoảng 69 px/s |
| Poise | 120 | không scale bằng HP |
| Stagger resistance | 45% | 45% |
| Poise break / immunity | 1,2 s / 3,5 s | như authored |
| Target duel time | 150–240 s | telemetry target |

Arena 448×320 px, bốn góc vát, hai trụ mảnh để Shade bounce và chặn line of
sight cho Distillation. Trung tâm phải có vòng trống đường kính tối thiểu 144 px;
mọi teleport landing đi qua safe-landing resolver. Camera thấy toàn bộ arena hoặc
chỉ dịch rất nhẹ, không để boss cast ngoài màn hình.

### 9.2 Phase 1 — 100–70%: học ngôn ngữ Wizard

- **Wandering Shade:** 14 authored damage, speed 110 px/s, lifetime 6 giây,
  deterministic bounce, cap hai Shade. Hết hạn tạo Dark Point tồn tại 7 giây.
- **Sigil Bolt:** 16 damage, projectile chậm, dùng để buộc player không đứng yên.
- **Single Passage:** một Dark Point có hollow ring 0,65 giây trước teleport;
  arrival burst 20 damage và boss lộ 1,2 giây sau khi hiện.
- Không cast Passage khi mọi landing candidate nằm trong hazard hoặc bán kính
  48 px quanh player; chọn candidate kế hoặc hủy cast không tốn scheduler token.

Transition 70% kéo dài 0,9 giây, boss invulnerable, xóa projectile cũ và bảo vệ
player thêm 0,25 giây sau khi phase mới bắt đầu.

### 9.3 Phase 2 — 70–35%: bài kiểm tra không gian và Spirit

- Shade cap tăng lên ba.
- **Dark Passage Chain:** ba destination theo nhịp `attack → escape → attack`.
  Burst authored lần lượt `18 / 0 / 24`; mỗi ring báo riêng 0,65 giây, cách nhau
  1 giây và đánh số I–II–III. Sau stack III boss lộ 1,25 giây.
- **Soul Distillation:** channel 2,2 giây theo line of sight. 30 stagger hoặc núp
  sau trụ ngắt cast. Nếu hoàn tất, khóa trigger/Summon của một Spirit trong 4
  giây; không xóa progress, không khóa Hand và dùng chung immunity chống lock.
- Tại 60%, summon đúng một Spirit Leech bằng sigil warning 1 giây. Add tự tan sau
  15 giây hoặc khi boss bị poise break. Boss nhường attack token 0,75 giây quanh
  lúc summon.

Transition 35% kéo dài 1 giây và cleanup toàn bộ add, Shade, Dark Point, pending
teleport và projectile.

### 9.4 Phase 3 — 35–0%: mastery loop

Loop deterministic ưu tiên khả năng học:

`3 Shade → 1,0 s thở → Passage attack/escape/attack → 1,25 s punish →
Soul Distillation hoặc Soul Eclipse → recovery → lặp`

- Không summon add mới.
- **Soul Eclipse:** tối đa mỗi 10–12 giây, tell 1,35 giây, 29 authored damage.
  Vành nguyền thu play space tối đa 15% trong cả phase và không co tiếp vô hạn.
- Chỉ tăng cadence ×1,12 **hoặc** damage ×1,10 ở Hard tuning; không tăng cả hai.
- Không dùng Dark Frenzy để cưỡng chế movement/input của player.
- Hard có soft enrage sau 7 phút 30 bằng edge pressure tăng chậm; không có
  instant-kill hoặc arena fill 100%.

### 9.5 Pattern budget

- Tối đa ba Shade, một add, 20 projectile và bốn damaging zone.
- Tối đa hai danger telegraph lớn đồng thời; Passage ring có priority cao nhất.
- Mỗi pattern nguy hiểm phải chừa safe lane rộng ít nhất 64 px.
- Boss không teleport hai lần tới cùng quadrant liên tiếp nếu quadrant khác hợp lệ.
- Hết phase luôn cleanup projectile/hazard; không để đạn “mồ côi” giết player
  trong cut/transition.

### 9.6 Death, Soul vật lý và Equip

Wizard chết thật và emit boss death. Sau death animation:

1. Cleanup toàn bộ actor/add/projectile/hazard và tắt harmful gameplay.
2. Resolve một `safe_drop_anchor` ở tâm arena; nếu invalid, thử vòng 16/32 px.
3. Spawn Wizard Soul vật lý, dùng `rpg_icons79.png` trong loot presentation.
4. Exit first-clear chỉ mở sau event `wizard_hero_soul_collected`.
5. Pickup transaction atomic:
   `campaign:chapter_2_level_20:wizard_soul_pickup:v1`.
6. Soul vào inventory, cấp ownership/feature `wizard_hero`, không auto-equip,
   không auto-assign Active/Reserve và không tự áp hiệu ứng.
7. Results dẫn người chơi tới Arsenal, highlight Soul và nút **Equip**; bỏ qua
   vẫn hợp lệ, không chặn Depth.

Grant khởi điểm:

| Field | Giá trị |
|---|---|
| `hero_id` | `wizard_hero` |
| rarity | Normal (`0`) |
| item level | `20` |
| source | `chapter_2_level_20_wizard_drop` |
| seed | `22020` |
| affinity | `magician` |
| variant | `coven_foundry` |
| tags | `normal_attack`, `dark`, `projectile`, `active`, `summon`, `departure`, `relay` |

Normal Lv20 giữ Wizard là một sidegrade có thể dùng ngay, không biến Hero mới
thành lựa chọn bắt buộc chỉ vì rarity. Hero Soul rarity cao hơn được target-farm
qua Hunt/Depth sau đó. Nếu playtest economy chứng minh Normal Lv20 tụt xa loadout
trung vị, tăng item level/guaranteed upgrade path trước khi đổi recruitment rarity.

Boss-death receipt, Soul-pickup receipt và level first-clear là ba authority độc
lập. Nếu crash sau boss death nhưng trước pickup, save/run state dựng lại
`pending_wizard_soul` tại safe anchor. Nếu pickup receipt đã có, replay không
spawn Soul thứ hai và tự reconcile collection objective sau khi boss chết thật.

## 10. Cấu trúc Levels 11–20

### 10.1 Bảng campaign

Số lượng dưới đây là tổng actor thường qua các phòng trên Easy, không phải số
active cùng lúc. Medium/Hard chỉ thêm tối đa một Wraith trong một số pack; tuyệt
đối tắt `allow_difficulty_extra_packs` cho override Chapter 2.

| L | Tên/flow | Objective chính | Combat Easy | Nhịp mới | Optional |
|---:|---|---|---|---|---|
| 11 | **Cổng Rơi** — điểm đáp → cầu cong → ward | Kích hoạt hai Spirit trực tiếp và tới cổng trú ẩn | 18 Wraith cơ bản | Ba vũ khí/hai Spirit | Ngắt 3 Shriek Step |
| 12 | **Mạch Độc Tro** — bờ khô → hai dòng độc → cauldron | Thanh lọc hai dòng độc, lấy Venom Spine | 16 cơ bản + 6 Venom | Hazard + Forge | Không nhận quá 3 poison tick |
| 13 | **Rừng Đèn Tắt** — nhận Ember → hai trạm → cổng ward | Mang ngọn lửa di động đến cổng | 15 cơ bản + 5 Venom + 4 Leech | Spirit priority | Không để Soul Clamp hoàn tất |
| 14 | **Xóm Giả Kim** — hai lab → lò trung tâm → thoát | Nạp Overload quanh cauldron rồi kích nổ | 12/8/6 theo ba profile | Mix đầu tiên; Elite reveal | Nổ cả hai lab trong một run |
| 15 | **Kẻ Phá Khế** — dọn đường → checkpoint → arena | Ép Axe về 50% và chứng kiến hắn chạy | 8 Wraith + Axe | Midboss reversal | Poise-break Axe 2 lần |
| 16 | **Mê Lộ Cổng Nguyền** — portal hub → sanctum | Chọn chuỗi portal đúng; sai tối đa 2 ambush | 28 Wraith mixed | Memory/route | Không chọn sai portal |
| 17 | **Nghi Lễ Giữ Lửa** — procession → 2 trạm → sanctum | Hộ tống ngọn lửa; mỗi trạm thủ 20–25 s | 20 Wraith, 4 wave | Mobile defense | Flame còn trên 50% integrity |
| 18 | **Di Vật Biết Thở** — vault → curse choice → extraction | Mang relic ra ngoài; Elite cướp giữa đường | 18 Wraith + Elite tới 70% | Carry/drop/recover | Không làm rơi relic |
| 19 | **Sabbath Ma Dực** — ba arena nối nhau | Săn named Hexwing qua ba ngưỡng và hạ thật | 18 Wraith + named Elite | Elite mastery | Phá cả 3 Familiar Pact |
| 20 | **Trái Tim Xưởng Hắc Phù** — gate → checkpoint → đại điện | Hạ Wizard và nhặt Wizard Soul vật lý | 6 Wraith gate + Wizard; 1 Leech add tối đa | Final exam/recruit | Ngắt 2 Distillation |

### 10.2 Level 11 — Cổng Rơi

- Safe pocket đầu level không có damage, hiển thị hai Spirit icon Q/E hoặc hai nút
  touch. Tutorial hoàn thành bằng confirmed swap/action, không bằng button press.
- Pack 1 chỉ có Wraith cơ bản, xuất hiện từ rift trước mặt.
- Pack 2 đến từ hai góc nhưng chừa sector thoát 120°.
- Pack 3 yêu cầu kích hoạt ít nhất một Spirit action của mỗi equipped Spirit;
  nếu build không thể kích do loadout legacy invalid, runtime tự sửa loadout trước
  level hoặc cho skip tutorial, không soft-lock objective.
- Results chỉ nhắc Monster Forge sắp mở; không đưa thêm tutorial hệ thống.

### 10.3 Level 12 — Mạch Độc Tro

- Hai poison channel có thứ tự tự chọn nhưng đều dẫn về cauldron trung tâm.
- Venom profile được dạy riêng trước khi phối với Wraith cơ bản.
- Người chơi tương tác purifier sau khi vùng quanh nó an toàn; Leech chưa xuất hiện.
- Venom Spine đầu tiên là deterministic physical Part pickup. Nếu rơi invalid hoặc
  bị bỏ lại, Lost Loot chuyển nó tới Results; Part không khóa exit.
- Sau Results mở một guided Forge interaction duy nhất: preview → socket → thấy
  thay đổi → xác nhận. Có thể tháo miễn phí.

### 10.4 Level 13 — Rừng Đèn Tắt

- Ember là objective actor đi theo player, không phải vật thể đứng yên như L7.
- Mỗi trạm chỉ bắt đầu wave khi player đặt Ember. Thất bại reset segment gần nhất,
  không reset toàn level và không mất Ember.
- Spirit Leech xuất hiện một mình ở trạm một; trạm hai phối tối đa một Leech với
  Venom, không spawn khi player đang đặt Ember.
- Ánh sáng Ember tăng contrast/vision nhưng bóng tối ngoài vòng không gây damage;
  người chơi không bị phạt vì cài đặt brightness/accessibility.

### 10.5 Level 14 — Xóm Giả Kim

- Hai lab có thể xử lý theo thứ tự tùy ý nhưng không phải binary branch bỏ mất
  content. Mỗi lab nạp 50% Overload qua combat gần cauldron.
- Giết địch ngoài vùng vẫn hợp lệ nhưng nạp chậm hơn; không ép đứng trong hazard.
- Khi đạt 100%, người chơi có 6 giây thoát khỏi vùng nổ đã vẽ rõ.
- Hexwing xuất hiện, phá một ống Soul và rời đi; sequence không có damage và không
  dùng boss bar. Đây là reveal, chưa phải lần hạ.

### 10.6 Level 15 — Kẻ Phá Khế

- Hai room đầu ngắn, tổng tám Wraith, dùng để dựng việc Axe đã phá xưởng.
- Checkpoint/heal ngay trước arena; Retry bắt đầu tại đây.
- Combat và escape tuân tuyệt đối contract Mục 8.
- Level chỉ complete sau `axe_retreated`, không phải khi HP chạm 50%.

### 10.7 Level 16 — Mê Lộ Cổng Nguyền

- Portal dùng symbol/shape, không chỉ màu. Chuỗi đúng dài ba bước.
- Chọn sai tạo một ambush ngắn, quay về hub và ghi một mistake; tối đa hai lần.
- Sau hai lỗi, symbol đúng pulse và narrator hint; không có vòng lặp vô hạn.
- Director không spawn lên portal destination hoặc trong 96 px quanh điểm đến.

### 10.8 Level 17 — Nghi Lễ Giữ Lửa

- CarryEscort runtime cho phép flame đi cùng player giữa hai trạm.
- Mỗi defense 20–25 giây; wave sau bắt đầu khi threat budget còn chỗ, không phải
  timer cưỡng bức spawn xuyên cap.
- Flame mất integrity vì enemy channel có telegraph, không nhận friendly damage.
- 0 integrity reset trạm hiện tại và hồi player lên tối thiểu 50%, không xóa
  reward/progress trạm trước.

### 10.9 Level 18 — Di Vật Biết Thở

- Player chọn một curse/reward profile được preview rõ; cả hai đường đều có cùng
  power budget, khác cách chơi chứ không có “đáp án bẫy”.
- Relic có thể rơi khi player bị heavy hit. Nếu rơi vào void/geometry, sau 1 giây
  quay về last-safe anchor; không mất vĩnh viễn.
- Hexwing tấn công tới 70%, cướp năng lượng relic rồi rút. HP/state của named
  actor được lưu vào run state để chuẩn bị L19, không emit death/loot.

### 10.10 Level 19 — Sabbath Ma Dực

- Một Hexwing actor liên tục qua ba arena; không spawn ba bản sao.
- Ngưỡng 70% → 45% → 0%; qua cửa giữ HP, cooldown và phase receipt đúng cách.
- Wraith support lần lượt 3 → 4 → 5 tổng actor qua ba arena, nhưng active threat
  không vượt cap. Elite nhường attack token lúc support materialize.
- Chỉ arena cuối emit death, Bestiary kill, mastery, Predator Jaw và gate key.

### 10.11 Level 20 — Trái Tim Xưởng Hắc Phù

- Gate combat chỉ sáu Wraith để kiểm tra nhanh ba profile, không làm hao máu dài.
- Checkpoint xóa gate actors/projectile, hồi ít nhất 75% Max HP và lưu loadout.
- Retry vào thẳng Wizard arena.
- Boss, Soul pickup và replay tuân Mục 9; không có thêm cutscene dài sau pickup.

## 11. Spawn director và encounter intelligence

Fallback hiện tại của `EncounterPackRules` có thể đẩy Level 11 lên khoảng 72 actor
Easy và hơn 100 Hard, đồng thời family catalog vẫn chứa Skeleton/Reaper/Vampire.
Chapter 2 không được dùng fallback đó. Từng level cần roster override và một
`Chapter2SpawnDirector` kích hoạt dormant marker theo threat budget.

### 11.1 Threat/actor budget

| Difficulty | Active threat cap | Actor hard cap | Attack token | Projectile cap thường/elite/boss |
|---|---:|---:|---:|---:|
| Easy | 7 | 7 | 3 | 12 / 16 / 20 |
| Medium | 8 | 8 | 4 | 12 / 16 / 20 |
| Hard | 9 | 9 | 4 | 14 / 18 / 20 |

Threat cost: Wraith `1,0`, Venom `1,25`, Leech `1,5`, Hexwing `4,5`. Mutant
ordinary `+0,75`, tối đa một và không xuất hiện cùng named Elite. Boss có scheduler
riêng nhưng vẫn dùng chung danger/projectile budget.

Luật scheduler:

- Không quá hai ranged/zone pattern cùng hit window.
- Không quá ba danger telegraph cùng lúc; tối đa hai cone/line lớn.
- Hexwing chiếm hai attack token. Wizard Passage/Eclipse chiếm hai.
- Wave tiếp theo chỉ materialize khi threat hiện tại còn tối đa `3` và có đủ cap.
- Ordinary active cap `6` trong tutorial/objective interaction, `7/8/9` trong
  traversal theo difficulty.
- Hard tăng mutant/HP/damage/speed đã có; không thêm nguyên pack.
- Không hidden rubber-band HP/damage theo kỹ năng người chơi. Director chỉ được
  trì hoãn wave để giữ readability, không bí mật “nương tay” hoặc “trừng phạt”.

### 11.2 Candidate vị trí

Một marker chỉ hợp lệ khi thỏa toàn bộ:

- Nằm trên connected walkable component của arena và có path đến combat space.
- Không nằm trong Geometry, void, pickup, active hazard, portal destination hoặc
  safe-lane mouth; đường đi ra rộng ít nhất 64 px.
- Cách objective/interactable 80 px; checkpoint/entrance/exit 96 px; hazard 80 px.
- Khoảng cách giữa Wraith 48 px, Wraith–Elite 96 px.
- Off-camera spawn cách player 260–480 px; Elite 300–520 px.
- Không spawn phía sau player trong cone 120° dưới 320 px nếu chưa có audio cue và
  edge indicator. Tối đa 30% một wave đến từ phía sau.
- Luôn để lại một sector thoát tối thiểu 90°.

Ưu tiên off-camera ngoài visible rect đã nới 48 px. Nếu phòng nhỏ bắt buộc spawn
trong tầm nhìn, dùng rift diegetic: Wraith warning ít nhất 1,0 giây, Elite 1,25
giây; trong materialization actor không collision, target hoặc damage.

### 11.3 Formation thông minh

- Wraith cơ bản vào pressure band 72–128 px.
- Venom đứng flank 144–210 px, không xếp tất cả cùng một phía với poison pool.
- Leech ở hậu tuyến nhưng phải nhìn thấy; director ưu tiên vị trí có line of sight
  để player đọc channel, không giấu sau wall.
- Không cho wave mở đầu có `Leech + Elite + 2 Venom`.
- Không cho hai Bulky/pressure actor chặn cùng một corridor hẹp.
- Pack anchor cách nhau 420–480 px hoặc bị ngăn bởi door/gate để tránh chain pull.
- Sau camera transition dừng director 1,5 giây; sau checkpoint 2 giây; sau revive
  2,5 giây. Awareness khóa thêm 0,35–0,5 giây sau materialization.
- Nghỉ wave thường 2–3 giây; trước Elite 3,5–4,5 giây kèm HUD/audio.

### 11.4 Hazard safety

- Poison/Wizard damaging zone cap: 3 phòng thường, 4 boss.
- Tổng walkable bị nguy hiểm tối đa 22/25/28% cho poison profile và không quá 40%
  khi tính tất cả boss hazard.
- Luôn còn safe region liên thông ít nhất 35% arena và dodge lane 64 px.
- Không ghép Elite projectile fan với hazard cắt toàn màn trong cùng hit window.
- Teleport/dive/landing lấy player position tại commit đúng theo chiêu; không dùng
  tọa độ stale từ trước telegraph.
- Boss transition và checkpoint cleanup mọi hazard/projectile thuộc encounter.

### 11.5 Failsafe

- Marker reject phải rollback reservation/threat token hoàn toàn.
- Deferred queue thử candidate kế sau 0,25 giây; sau ba lần thất bại, giảm pack
  chứ không spawn bất hợp lệ.
- Required actor thất bại phải dùng authored fallback anchor và log error; nếu vẫn
  thất bại, objective controller mở recovery interaction thay vì soft-lock.
- Optional/density actor không được nằm trong `DEFEAT_ALL` authority.

## 12. Cân bằng sức mạnh

### 12.1 Player reference

Level tự tăng survivability/mana nhưng không tự tăng offense; Power đến từ Stat
Point. Reference build chia tương đối cân bằng HP/Power:

| Mốc | HP base | HP khoảng | Power multiplier | Sword combo khoảng |
|---:|---:|---:|---:|---:|
| L11 | 291 | 559 với 20 HP point | ×1,764 với 20 Power point | 183 |
| L15 | 363 | 693 với 25/25 | ×1,944 | 202 |
| L20 | 448 | 900 với 35/35 | ×2,293 | 238 |

Free respec còn hiệu lực đến L20, nên Level Details phải nhắc respec miễn phí khi
build lệch quá xa recommended band; không tự phân bổ điểm.

### 12.2 Difficulty authority

Không tạo multiplier Chapter 2 riêng. Dùng đúng `DifficultyRules` hiện hành:

| Difficulty | HP | Damage | Speed | Mutant ordinary |
|---|---:|---:|---:|---:|
| Easy | ×1,00 | ×1,00 | ×1,00 | 3% |
| Medium | ×1,35 | ×1,25 | ×1,08 | 10% |
| Hard | ×1,75 | ×1,55 | ×1,15 | 20% |

Stage multiplier tiếp tục áp trên các số này. Named Elite, Axe, Wizard và objective
actor không nhận mutant. First clear chỉ Easy như contract hiện tại; Medium/Hard
mở sau khi level đã clear.

### 12.3 TTK và damage target

| Target | Easy target |
|---|---:|
| Wraith cơ bản | 2–4 s nếu tập trung |
| Venom/Leech | 3–6 s; nhanh hơn khi ngắt đúng mechanic |
| Elite active segment | 10–18 s mỗi segment; L19 tổng 35–55 s |
| Axe tới 50% | 75–120 s |
| Wizard duel | 150–240 s |

Gates:

- Đòn thường Easy cần khoảng 12–18 hit để hạ player không đầu tư HP.
- Một đòn nặng boss có tell dài không vượt 30% HP reference Easy.
- Một overlap hợp lệ không vượt 45% HP reference; không có unavoidable overlap.
- Không sửa HP toàn roster để chữa riêng một Hero/affix quá mạnh. Retune coefficient,
  cap, projectile, i-frame hoặc affix consumer trước.
- Player hurt chain phải có đủ invulnerability/separation để không bị ba actor
  tiêu hết HP trong một stun lock.

### 12.4 Tuning order

Khi playtest sai mục tiêu, chỉnh theo thứ tự:

1. Telegraph/recovery và pattern overlap.
2. Threat/active budget và composition.
3. Hazard lifetime/coverage, projectile speed/cap.
4. Enemy damage.
5. Enemy HP.

Không dùng HP làm nút đầu tiên; nó kéo dài cả đoạn đúng lẫn đoạn sai và dễ tạo cảm
giác sponge.

## 13. Reward, progression và feature cadence

Mỗi first-clear vẫn cấp đúng `player_level_grant=1`. Các số sau là first-pass cho
economy; phải retune cùng sink/crafting price, không tăng chỉ vì muốn “nhiều số”.

| L | Recommended mastery | Currency | Hero Materials | Fragments | Major reward/unlock |
|---:|---:|---:|---:|---:|---|
| 11 | 3.200 | 1.050 | 28 | 13 | Onboarding second Spirit |
| 12 | 3.500 | 1.150 | 31 | 14 | Venom Spine; Monster Forge/Part inventory |
| 13 | 3.850 | 1.260 | 34 | 16 | Hunt board |
| 14 | 4.250 | 1.380 | 38 | 18 | Chapter cache; full rarity-loot disclosure |
| 15 | 4.750 | 1.900 | 45 | 22 | Khế Rìu Nứt; không Axe Soul |
| 16 | 5.200 | 1.550 | 49 | 24 | Salvage |
| 17 | 5.750 | 1.700 | 54 | 27 | Controlled crafting/reroll |
| 18 | 6.200 | 1.880 | 59 | 30 | Challenge |
| 19 | 6.650 | 2.100 | 65 | 34 | Predator Jaw; Depth key preview |
| 20 | 7.100 | 3.200 | 80 | 45 | Wizard Soul; Depth |

L15 là milestone spike nên reward L16 thấp hơn có chủ ý; UI phải phân biệt story
item với currency để người chơi không đọc nó như bị giảm phần thưởng.

### 13.1 Major-system rule

- L11 chỉ thực hành second Spirit đã được L10 cấp entitlement.
- L12 mở Forge + Part inventory như một cụm; rarity loot chỉ được giải thích trong
  cùng guided flow, không thêm tutorial giữa combat.
- L13 mở Hunt sau khi đã biết nguồn Part.
- L16 mở Salvage; L17 mới mở Crafting/reroll để không dạy phá và tạo đồ cùng lúc.
- L18 mở Challenge; L20 mở Depth.
- Locked cards chỉ hiện trong Hub/Modes với điều kiện cụ thể, không chiếm combat HUD.

### 13.2 Monster Parts tối thiểu

Ba Part duy trì các ID roadmap và dùng hook/event chung, không rải `if weapon_id`:

| Part | Source | Behavior baseline |
|---|---|---|
| `venom_spine` | Venom profile/Hunt | Spirit action đầu tiên mỗi 6 s đặt poison mark không stack trong 3 s |
| `giant_heart` | Spirit Leech core/Hunt | Hand skill hit cho barrier 6% Max HP trong 2,5 s, ICD 10 s |
| `predator_jaw` | Hexwing L19/Hunt | Sau Dash, Hand hit kế trong 2 s được +20 stagger và lunge ngắn, ICD 5 s |

Các Part đầu tiên deterministic; Hunt sau đó cho full drop hoặc fragment/pity.
Main campaign không được phụ thuộc random drop. Part unique/equipped/locked/favorite
không thể bị salvage.

### 13.3 Optional objective

- Thưởng thêm khoảng 15–20% currency/material của level hoặc fragment target.
- Không cấp exclusive combat power, không khóa level tiếp theo.
- Không yêu cầu một Hero/vũ khí cụ thể; wording mô tả hành vi như interrupt,
  poise break hoặc giữ objective.
- Retry/replay lưu best completion nhưng reward stackable phải có run receipt.

### 13.4 Hunt, Challenge và Depth

- **Hunt:** mở L13, cho target Wraith profile/Part, source preview và pity; mission
  60–120 giây, không energy gate.
- **Challenge:** mở L18, fixed seed/layout/modifier, local best score nếu chưa có
  online infrastructure. Không dựng leaderboard giả.
- **Depth:** mở sau L20 first-clear. Wizard Soul pickup không cần Equip để mở Depth;
  Depth là level reward, ownership Wizard là pickup reward độc lập.

## 14. UI/UX và onboarding

### 14.1 Campaign/Level Details

Mỗi card hiển thị: objective một câu, enemy silhouettes đã discover, possible
reward, optional objective, recommended mastery, difficulty và loadout. L15 dùng
boss icon có notch 50%; L20 preview Staff silhouette nhưng không tiết lộ full kit.

### 14.2 Combat HUD

- Hai Spirit icon chỉ xuất hiện sau gate; Q/E map trực tiếp, không cycle.
- Spirit lock phủ chain/counter trên **đúng slot**, không làm mờ cả HUD.
- Objective text tối đa hai dòng, tự fade khi không đổi.
- Boss bar L15 ghi **“Đẩy lùi Axe”** và notch 50%; không ghi “Hạ Axe”.
- Wizard Passage hiển thị I/II/III trong world, không thêm panel giữa màn.
- Pickup Wizard Soul dùng time-slow nhẹ, card một câu và action `Nhặt`; Equip nằm
  ở Arsenal/Results, không ép inventory giữa combat.

### 14.3 Touch/accessibility

- QA tối thiểu ở 640×360; telegraph không bị joystick/nút Attack/Skill/Dash che.
- Touch target ít nhất 44–48 px theo scale thực; hỗ trợ left-handed layout.
- Reduced flash giảm alpha/pulse, không xóa warning frame.
- Reduced motion bỏ mạnh camera shake/zoom nhưng giữ hit-stop nhẹ.
- High-contrast outline cho Wraith/Wizard; damage number có thể tắt.
- Không dùng darkness/poison vignette làm nguồn thông tin duy nhất.

## 15. VFX và audio

### 15.1 VFX budget

- Tối đa 32 VFX ngắn hạn và 20 boss projectile đồng thời ở viewport mục tiêu.
- Telegraph nằm ở canvas/layer trên cosmetic particles.
- Poison, lock, Passage và Soul pickup có silhouette/shape khác nhau.
- Axe screen shake nhẹ/vừa/nặng theo Quick/Execution/Rupture; setting có thể về 0.
- Wizard phase transition không full-screen white flash; dùng violet collapse và
  outline để an toàn reduced-flash.

### 15.2 Audio map

Có thể dùng tạm các file hiện hữu:

- `assets/audio/sfx/rpg_essentials/soul_teleport.wav` cho Passage/vanish;
- `.../spirit_wind.wav` cho Wraith materialize;
- `.../debuff.wav` cho Soul Clamp;
- `.../soul_absorb.wav` cho Wizard Soul pickup.

Cần sản xuất/commission trước release:

- ambience đầm tro, loop xưởng, combat, Elite, Axe và Wizard;
- cue riêng cho poison landing, Spirit lock channel/break, Hexwing dive/phase;
- Axe charge/outbound/return/rupture/escape;
- Wizard Shade bounce, Passage I–II–III, Distillation, Eclipse, death;
- stinger L15 escape, L19 Elite death, L20 victory và Soul pickup.

Music có state `explore → combat → elite/boss → phase → victory`, crossfade ngắn,
không restart track mỗi room. Không dùng music bright của Magic Cliffs chỉ vì đã
có sẵn.

## 16. Data/technical contract

### 16.1 Stable IDs

| Loại | IDs |
|---|---|
| Chapter | `chapter_2_ashen_foundry` |
| Levels | `chapter_2_level_11` … `chapter_2_level_20` |
| Regular | `coven_wraith`, `venom_bound_wraith`, `spirit_leech` |
| Elite | `hexwing_familiar` |
| Boss | `axe_soul_boss`, `wizard_hero_boss` |
| Hero | `wizard_hero` |
| Story | `fractured_axe_insignia`, `axe_survived_coven` |

`mage_hero` phải migrate một chiều sang `wizard_hero` trong save/catalog/UI. Các
hardcode hiện còn ở `loot_asset_catalog.gd` và `field_codex.gd` phải được thay bằng
catalog lookup; không duy trì hai inventory identity.

### 16.2 Feature IDs dự kiến

`second_spirit_slot`, `monster_parts`, `monster_forge`, `rarity_loot`, `hunt`,
`salvage`, `crafting`, `challenge`, `depth`, `wizard_hero`.

Level 10 hiện có `chapter_2_access` nhưng tài liệu/runtime phải kiểm tra rõ gate
second Spirit; không suy diễn slot chỉ từ Player Level. Save cũ hoàn thành L10
được reconciliation đúng một lần.

### 16.3 Resource layout dự kiến

```text
data/content/levels/chapter_2_level_11.tres ... chapter_2_level_20.tres
data/content/rosters/chapter_2_level_*_roster.tres
data/content/enemies/coven_wraith.tres
data/content/enemies/venom_bound_wraith.tres
data/content/enemies/spirit_leech.tres
data/content/enemies/hexwing_familiar.tres
data/content/enemies/axe_soul_boss.tres
data/content/enemies/wizard_hero_boss.tres
data/content/rewards/chapter_2_level_*_reward.tres
data/content/rewards/chapter_2_level_20_wizard_soul_pickup.tres
data/content/parts/venom_spine.tres
data/content/parts/giant_heart.tres
data/content/parts/predator_jaw.tres
```

Đăng ký resource qua registry/catalog; không thêm chuỗi `if level_id` mới vào
`main.gd` cho từng level.

### 16.4 Objective/runtime mới

Runtime generic hiện chỉ đáng tin cho `DEFEAT_ALL`, `DEFEAT_COUNT` và
`CUSTOM_EVENT`. Các objective vật lý phải có controller rồi emit custom event:

- `Chapter2SpawnDirector`
- `PurificationObjectiveRuntime`
- `CarryEscortObjectiveRuntime`
- `CauldronOverloadRuntime`
- `PortalMazeRuntime` với mistake budget/auto-hint
- `RelicCarryRuntime` với drop/recovery
- `AxeRetreatRuntime`
- `WizardBossRuntime`
- generic `HeroSoulRecruitmentRuntimeProfile` tách từ L5 để Wizard dùng lại

Tái dùng L7 dormant activation, L8 transactional rollback, L9 authority-first
interaction, L10 continuous phase/HUD/reset, reward receipts và safe gate sync.

### 16.5 Transactions/idempotency

- First clear: `campaign:chapter_2_level_<N>:first_clear:v1`.
- Axe retreat: `campaign:chapter_2_level_15:axe_retreat:v1`.
- Wizard pickup: `campaign:chapter_2_level_20:wizard_soul_pickup:v1`.
- Boss death không được commit Wizard ownership.
- Level completion không được synthesize missing Wizard Soul.
- Crash/reload/reconcile không cấp currency stackable hoặc unique item hai lần.
- Replay có receipt Wizard không spawn duplicate; vẫn buộc hạ boss thật.

## 17. Telemetry và playtest targets

Thu thập cục bộ/dev trước khi có consent/production analytics:

- completion time, retry count, phase reached, quit point;
- damage source và tỷ lệ hit của từng pattern;
- offscreen hit rate, spawn-to-first-attack time;
- Spirit lock uptime, number of interrupted Clamps/Distillations;
- active threat/projectile/hazard peak;
- Power/HP allocation, loadout và swap/Spirit action frequency;
- Axe burst vượt threshold, retreat fallback usage;
- Wizard Soul safe-drop relocation/reconciliation;
- optional completion và Hunt pity length.

Tuning alert:

| Chỉ số | Cờ đỏ |
|---|---|
| Offscreen damage | >5% tổng damage ở level thường |
| Spirit lock uptime | >12% combat time Easy |
| L15 first-clear | median >240 s hoặc >3 retry |
| L20 boss | median >300 s duel Easy hoặc phase 2 chiếm >50% death |
| Spawn fallback | >0,5% required spawn |
| Wizard pickup failure | bất kỳ case không recover được |

Không tối ưu retention bằng cách tăng grind khi completion thấp; trước hết sửa
readability, checkpoint, objective clarity và encounter overlap.

## 18. QA và acceptance

### 18.1 Automated/static

- Level/roster/reward IDs unique, prerequisite chain 10→11→…→20 đúng.
- Chapter 2 catalog không leak Skeleton/Reaper/Vampire.
- Director không vượt threat/actor/projectile/hazard cap trong bất kỳ frame test.
- Required marker nằm trên connected Backdrop và ngoài protected radius.
- Asset validation chặn mọi `PROTOTYPE_ONLY`/missing-license dependency trong
  release profile.
- Named Elite/Axe/Wizard không nhận mutant.
- Reward receipts và `player_level_grant` idempotent.

### 18.2 Objective/soft-lock

- L11 legacy/invalid loadout không khóa tutorial.
- L12 Part invalid drop đi Lost Loot; exit vẫn mở.
- L13 flame không mất; failure chỉ reset segment.
- L14 overload callback trùng không nổ/mở exit hai lần.
- L15 hit cực lớn/DoT/multihit không hạ Axe dưới 50%; event một lần; blocked path
  dùng fallback; không có Axe Soul/mastery/death receipt.
- L16 hai mistake bật hint, không portal loop vô hạn.
- L17 objective integrity/reset/save-load đúng.
- L18 relic rơi void về last-safe anchor.
- L19 chỉ một named Hexwing, HP/phase giữ qua ba arena, chỉ chết/rơi loot ở cuối.
- L20 boss death chưa mở exit; safe pickup, crash/reload, duplicate receipt và
  replay đều không mất/nhân đôi Wizard Soul.

### 18.3 Combat/manual

- Fresh sequential save L10→L20, debug direct-load, retry và replay.
- Sword/Archer/Axe ở Hand và hai Spirit; low-investment build clear Easy.
- Medium/Hard sau clear không tạo one-shot, spawn crush hoặc hazard fill.
- Color-blind presets, reduced flash/motion, left-handed touch và text scale.
- 640×360 touch: telegraph/safe lane không bị HUD che.
- Soak 30 phút; hard floor 30 FPS trên thiết bị mục tiêu; không orphan projectile,
  timer, HUD hoặc actor sau transition/retry.

### 18.4 Definition of Done

Chapter 2 chỉ được gọi là hoàn tất khi:

1. Cả 10 level chơi nối tiếp được từ save fresh, Results/unlock/save đúng.
2. Ba Wraith profile, Hexwing, Axe và Wizard có animation/telegraph/audio đủ và
   asset release-clear.
3. L15 chạy thoát đúng 50%, không thể tuyển Axe.
4. L20 rơi Wizard Soul vật lý, pickup/Equip/replay/idempotency đúng.
5. Forge, Hunt, Salvage, Crafting, Challenge và Depth có consumer/runtime thật;
   không chỉ có card hoặc flag.
6. Spawn director giữ readability/performance trên mobile.
7. Không critical error, soft-lock, duplicate reward, stale actor hoặc console spam.
8. Balance matrix đạt band thời lượng/damage trên Easy/Medium/Hard sau playtest.

## 19. Kế hoạch sản xuất

| Gate | Phạm vi | Điều kiện ra gate |
|---|---|---|
| C2-0 Canon/data | ID, migrations, level/reward/roster schemas | Validator xanh; không còn L15 Axe recruitment claim |
| C2-1 Greybox core | Map modules, director, ba Wraith profile | L11–13 chơi được, cap/spawn tests xanh |
| C2-2 Systems | Forge/Part/Hunt onboarding | L12–14 + save/reward flow hoàn chỉnh |
| C2-3 Midboss | Axe controller/arena/retreat | L15 threshold/retry/idempotency tests xanh |
| C2-4 Mastery levels | L16–19, carry/portal/relic/named Elite | Không soft-lock; mobile perf đạt |
| C2-5 Finale | Wizard art/controller/Soul pickup | L20 full loop, ownership/Equip/Depth đúng |
| C2-6 Polish | Audio/VFX/UI/accessibility/localization | Asset license gate và visual QA xanh |
| C2-7 Balance/release | 3 difficulties, soak, fresh save | Definition of Done đạt toàn bộ |

Mỗi gate phải mở project, chạy smoke/regression Chapter 1 và giữ build playable.
Không author cả 10 map final trước khi C2-1 chứng minh spawn/roster/balance bằng
greybox; map đẹp không cứu được encounter runtime sai.

## 20. Canon migration bắt buộc khi bắt đầu implementation

1. `CAMPAIGN_HERO_PROGRESSION.md` và `soul_hero_campaign_plan.tres` đã bỏ Axe
   recruitment L15 và ghi future Wizard pickup L20; runtime level/reward còn phải
   hiện thực đúng contract này.
2. Tạo milestone runtime L20 Wizard defeat + physical Soul pickup, tách pickup
   khỏi level-completion bundle.
3. Migrate `mage_hero` → `wizard_hero` ở loot catalog, Field Codex, save/UI.
4. Thay Chapter 2 cũ Ash Thrall/Forge Archer/Iron Husk/Colossus bằng contract này.
5. Cập nhật `EncounterPackRules`/catalog để Chapter 2 không kế thừa family cũ và
   không dùng population 72/108.
6. Sửa metadata Axe hiện còn ghi unlock Chapter 1 Level 5; save tương thích không
   đồng nghĩa new-profile entitlement.
7. Ghi đầy đủ attribution/source và chặn pack thiếu license trong release build.

## 21. Checklist A–Z

- **A — Art:** palette, tile, silhouette, icon và asset gate đã khóa.
- **B — Balance:** authored baseline, stage/difficulty và TTK target có authority.
- **C — Combat:** profile, elite và hai boss có move/punish/cap.
- **D — Difficulty:** tăng áp lực có giới hạn, không thêm mob vô tận.
- **E — Economy:** first-clear, Part, Hunt/pity và sink cadence đã định.
- **F — Flow:** 10 level có động từ và escalation riêng.
- **G — Gating:** mỗi level tối đa một cụm hệ thống mới.
- **H — HUD:** two-Spirit, lock, boss threshold và pickup rõ.
- **I — Input:** desktop/touch, direct Q/E, không cưỡng chế input.
- **J — Juice:** hit-stop/VFX/audio có budget, không che telegraph.
- **K — Knowledge:** Bestiary/Hunt dạy counter và nguồn Part.
- **L — Level design:** map module, objective, optional và checkpoint cụ thể.
- **M — Mobile:** caps, 640×360 QA và 30 FPS floor.
- **N — Narrative:** cổng hút Soul, Axe phá khế, Wizard luyện Soul.
- **O — Objectives:** controller vật lý, custom event và recovery.
- **P — Progression:** second Spirit → Forge → Hunt → Salvage → Craft → Challenge → Depth.
- **Q — QA:** static, soft-lock, combat, replay và soak gates.
- **R — Rewards:** Axe item không Soul; Wizard pickup tách first-clear.
- **S — Spawn:** threat budget, candidate geometry và attack token.
- **T — Telemetry:** đo đúng friction trước khi retune.
- **U — UX:** Results dẫn hành động kế, không text wall/FOMO.
- **V — VFX:** shape-coded, color-blind/reduced-flash safe.
- **W — Wizard:** ba phase, safe teleport, physical Soul, explicit Equip.
- **X — Axe:** clamp 50%, retreat idempotent, không death loot.
- **Y — Yield/retention:** mastery/replay target rõ, không grind ép buộc.
- **Z — Zero soft-lock:** mọi drop, carry, portal, escape và receipt đều có fallback.
