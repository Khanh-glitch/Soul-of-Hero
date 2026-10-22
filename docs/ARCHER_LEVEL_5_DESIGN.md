# Archer Level 5 — thiết kế, cân bằng và hợp đồng mở khóa

Ngày chốt: 2026-07-16  
Trạng thái: baseline gameplay, Archer Hero Soul và bộ VFX texture-driven của
`KingdomArcher` đã nối vào vertical slice; cân bằng người chơi thật, HUD/portrait,
audio và visual acceptance đa độ phân giải vẫn cần pass nghiệm thu.

Tài liệu này là nguồn thiết kế canonical cho Archer ở Chapter 1 Level 5. Khi
con số trong tài liệu khác resource/runtime, resource phải được sửa hoặc tài
liệu phải được cập nhật trong cùng change; không duy trì hai bộ số song song.

## Quyết định sản phẩm

- Axe không còn là boss/reward Level 5. Nội dung Axe hiện có được giữ tương
  thích cho save cũ và dời sang một mốc tuyển mộ sau.
- `KingdomArcher` là tên hiển thị của đối thủ cuối Level 5; ID ổn định vẫn là
  `hooded_archer_miniboss` để tương thích map/save. Trước lần nhặt Soul thành
  công, Archer chỉ là phe địch; Player Level hoặc việc mở được Level 5 không
  cấp quyền sở hữu Archer.
- Sword và Archer là **sidegrade trải nghiệm**. Sword là melee duelist chủ động
  áp sát/đuổi mục tiêu; Archer là ranged spacing-controller phải giữ cự ly,
  line of sight và Focus. Archer không phải nâng cấp sức mạnh trực tiếp từ Sword.

## Hợp đồng mở khóa Hero — không được phá vỡ

Chuỗi duy nhất hợp lệ ở Level 5 là:

1. Người chơi vào trận với team snapshot đã chọn trước trận; chưa có Archer.
2. Người chơi hạ `KingdomArcher` (`hooded_archer_miniboss` trong dữ liệu).
3. Boss chết chỉ tạo một **Archer Hero Soul vật lý** tại vị trí chết. Cái chết
   của boss tự nó không thêm Soul, Hero hoặc Reserve vào save.
4. Người chơi phải đến gần và tương tác `E` với vật phẩm.
5. Pickup thành công mới commit transaction
   `campaign:chapter_1_level_5:archer_soul_pickup:v1` và ghi event
   `archer_hero_soul_collected`.
6. Transaction cấp đúng một `archer_hero` Soul **Normal, item level 1**, affinity
   `ranger`, cùng `soul_hero` và `soul_relay`. Nó không tự gán Archer vào Reserve.
   Hai feature flag này chỉ cấp quyền cho tủ đồ thực hiện Equip; chúng không chọn
   instance, không đổi team và tự thân không tạo combat effect.
7. Pickup chỉ đưa Soul vào tủ đồ, chưa kích hoạt Hero hoặc bất kỳ hiệu ứng nào và
   không tự đổi Active/Reserve. Người chơi phải mở tủ đồ và bấm **Equip** trên
   đúng Soul; chính thao tác đó mới kích hoạt Archer/hiệu ứng ngay, kể cả trong
   chính ván hiện tại. Tủ đồ tạm dừng world trong lúc chọn để Equip không thể cắt
   ngang action hoặc dùng làm cách reset cooldown.

Completion reward của Level 5 là transaction riêng: currency, material,
fragment, Player Level và blueprint. Bundle này tuyệt đối không chứa Archer
Soul. Exit cũng yêu cầu cả ba objective: dọn màn, hạ Archer và nhặt Soul; vì vậy
không thể vô tình bỏ vật phẩm rồi vẫn hoàn thành lần đầu.

Nếu save đã có pickup receipt, replay không tạo Soul thứ hai và collection
objective được khôi phục từ receipt; objective hạ boss vẫn bắt buộc. Save/reload,
tín hiệu chết lặp hoặc callback lặp không được nhân bản UUID. Reconciliation
không được suy diễn Hero ownership chỉ từ level-clear receipt.

Đây là nguyên lý chung cho mọi Hero về sau: **gặp Hero ở phe địch → hạ đối thủ →
Soul vật lý rơi ra → tự tay nhặt để đưa Soul vào tủ đồ → chủ động bấm Equip →
đúng Hero/Soul/hiệu ứng mới được kích hoạt ngay**. Pickup không bao giờ tự đổi
team; Equip cũng không bị khóa theo ranh giới ván. Starter Sword là ngoại lệ
onboarding được khai báo rõ, không phải tiền lệ cho auto-unlock các Hero tiếp theo.

## Playable Archer — bản sắc và bộ số

### Focus

- Tối đa 2 Focus; thời hạn 4 giây và mỗi lần nhận Focus sẽ làm mới thời hạn.
- Quick Shot hoặc Split Step Shot chỉ cấp 1 Focus khi projectile xác nhận trúng
  một mục tiêu còn sống ở cự ly 96–260 px và vẫn có line of sight.
- Có hostile còn sống trong 72 px và có line of sight sẽ làm mất 1 Focus sau
  mỗi 0,45 giây bị áp sát.
- Nhận damage, chết, đổi team hoặc Soul Relay xóa toàn bộ Focus. Dash thường giữ
  Focus nhưng đồng hồ 4 giây vẫn chạy.
- Armor Piercer chụp snapshot rồi tiêu toàn bộ Focus ngay lúc bắn; bắn trượt
  không hoàn lại. Soul Line không tạo Focus.

### Normal attack — Focus Chain

Combo được nối trong cửa sổ 2 giây.

| Bước | Damage | Stagger | Action / release | Projectile | Di chuyển | Focus / target cap |
| --- | ---: | ---: | --- | --- | --- | --- |
| 1. Quick Shot | 18 | 6 | 0,32 s / 0,13 s | 520 px/s; range 300; width 6 | 80% move speed | +1 khi thỏa Focus; cap 1 |
| 2. Split Step Shot | 20 | 8 | 0,40 s / 0,16 s | 540 px/s; range 300; width 6 | bước 24 px trong 0,16 s, không i-frame | +1 khi thỏa Focus; cap 1 |
| 3. Armor Piercer | 30 / 36 / 42 | 14 / 17 / 20 | 0,70 s / 0,40 s | 600 px/s; range 360; width 10 | 30% khi kéo cung, 65% sau release | tiêu 0 / 1 / 2 Focus; cap 1 / 2 / 4 |

Split Step ưu tiên hướng input; khi không có input thì lùi khỏi hướng bắn. Mọi
projectile dừng ở World collision. Armor Piercer tăng số mục tiêu xuyên, không
tự biến thành AoE không giới hạn.

Focus Chain aim-assist trong 300 px, cone 140° và chỉ khóa mục tiêu có line of
sight; nếu không có target hợp lệ, projectile bay theo hướng đang nhìn. Soul
Mark dùng 300 px/cone 150°, bắt buộc target hợp lệ và không khóa xuyên tường.

### Active — Soul Mark

| Mana | Cooldown | Cast | Target | Mark | Soul Line |
| ---: | ---: | ---: | --- | ---: | --- |
| 32 | 12 s | 0,22 s | 300 px, cone 150°, bắt buộc có target | 4 s | 44 damage; 14 stagger; 640 px/s; range 360; width 16; cap 5 |

Soul Mark không gây damage tức thì. Normal hit xác nhận kế tiếp lên đúng target
được đánh dấu sẽ tiêu mark và bắn Soul Line theo hướng đòn đó. Mark hết hạn,
target chết, Archer nhận damage, chết hoặc Relay thì bị xóa. Soul Line được tính
là active-skill damage nên không cấp Focus. Mark chỉ bắt đầu đủ 4 giây sau khi
cast 0,22 giây hoàn tất; trong cast Archer vẫn di chuyển ở 80% move speed.

### Soul Relay

- **Ready — Clear Shot:** một hostile còn sống, đang chủ động target người chơi,
  có line of sight và nằm trong 112–280 px liên tục 1 giây. Khi đạt, Archer
  `READY` trong 5 giây; mất điều kiện trước mốc 1 giây sẽ reset tiến độ.
  Tiến độ gắn với đúng hostile đó; đổi target reset toàn bộ phần hold trước.
- **Summon — Piercing Entry:** duration 1 giây; 28 damage, 18 stagger,
  620 px/s, range 360, width 14, cap 6. Takeover windows:
  `0,18–0,30`, `0,48–0,62`, `0,78–0,94` giây.
- **Dash opportunity — Reverse Piercing Shot:** khi Archer đang ở Reserve, Dash
  để lại visual Archer ngay tại điểm bắt đầu lướt. Archer quay về hướng ngược
  vector Dash, bắn mũi tên hiện có rồi đứng lại tổng cộng 2 giây; `Q` hợp lệ
  trong toàn bộ 2 giây để Chuyển Hồn về đúng vị trí đó. Nếu không bấm `Q`, visual
  tự tan và Relay về IDLE, không cộng thêm cooldown ngoài cooldown Dash/Bow đã có.
- **Departure — Backstep Volley:** duration 0,65 giây; ba mũi tên ở
  `-12° / 0° / +12°`; mỗi mũi 12 damage, 8 stagger, 520 px/s, range 260.
  Cả volley dùng chung hit ledger và một target chỉ nhận tối đa hai hit.
- READY tự hết sau 5 giây chỉ quay về IDLE, không tạo cooldown. Nếu đã gọi
  Piercing Entry nhưng không takeover trong bất kỳ cửa sổ nào trước khi summon
  kết thúc ở 1 giây, support hoàn tất rồi vào cooldown 10 giây.

## Vì sao Archer là sidegrade của Sword

Baseline so sánh không tính stat allocation, rarity, affix, gear hoặc skill
rank:

| Chỉ số | Sword | Archer đủ 2 Focus | Archer không Focus |
| --- | ---: | ---: | ---: |
| Chuỗi damage | 20 + 20 + 24 + 40 = **104** | 18 + 20 + 42 = **80** | 18 + 20 + 30 = **68** |
| Tổng action duration | **1,84 s** | **1,42 s** | **1,42 s** |
| Raw combo DPS | **56,52** | **56,34** | **47,89** |

Chênh lệch full-execution chỉ khoảng 0,3%; Archer không được trả thêm damage chỉ
vì đánh xa. Nếu để mất cự ly/line of sight, Armor Piercer hụt đúng 12 damage và
giảm target cap: đây là execution tax có chủ ý, không phải random penalty.

Sự đánh đổi nằm ở cách chơi:

| Sword | Archer |
| --- | --- |
| Áp sát, pass-through, recoil và pursuit theo thân mục tiêu | Giữ band 96–260, đọc line of sight và dẫn projectile |
| Combo dài hơn, ít bị mất damage vì sai cự ly | Combo ngắn hơn nhưng phải tích/tiêu Focus đúng lúc |
| Rủi ro melee, đổi lại hit confirmation trực tiếp và khả năng bám mục tiêu | An toàn cự ly, đổi lại travel time, wall stop, close-pressure và miss tax |
| Soul Echo nhân bản nhịp melee còn lại | Soul Mark đổi một normal hit thành đường xuyên có setup |

Hai active cùng dùng 32 Mana và baseline cooldown 12 giây để lựa chọn không bị
lệch bởi economy. Đây mới là điểm xuất phát; quyết định release cần playtest
moving target, phòng hẹp, 1/3/6 target, elite stagger và boss pressure.

## KingdomArcher — boss Level 5

### Thông số nền

| HP | Move / strafe | Preferred band | Detect / disengage | Attack range | Score |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 360 | 72 / 64 px/s | 144–220 px | 360 / 440 px | 360 px | 650 |

Poise là 50. Boss nhận đúng `stagger × 0,75` vào poise (25% resistance) ở mọi
trạng thái; aim không có hệ số bonus ẩn. Poise hồi 20/s sau 1 giây không nhận
stagger; break kéo dài 0,85 giây, sau đó có 2 giây miễn break. Boss không có
i-frame trong Split Step hoặc Escape.

### Pattern và phase

| Pattern | Cảnh báo trước đòn | Damage | Projectile / movement |
| --- | --- | ---: | --- |
| Quick Shot | kéo cung + charge cyan tại mũi tên; 0,44 s, Phase 3 là 0,40 s | 12 | 390 px/s; range 320; width 6 |
| Split Step | sau Quick đầu | — | ngang 24 px / 0,16 s; không i-frame |
| Quick Shot 2 | như Quick Shot | 12 | nối thẳng sang Pierce aim |
| Armor Pierce | charge violet nặng + aura thân; 0,72 s, Phase 3 là 0,64 s | 18 | 520 px/s; range 360; width 10 |
| Escape | animation đứng thẳng + foot-skid trail; kích hoạt khi player ≤64 px | — | windup 0,22 s; lùi 72 px / 0,26 s; cooldown 4 s; không i-frame |
| Soul Mark | rune bám đúng target + aura thân; Phase 2: 1,0 s, Phase 3: 0,85 s | 20 | 600 px/s; range 380; width 16; cooldown 6 s / 5,2 s |

- Phase 2 bắt đầu ở 65% HP và thêm Soul Mark Line.
- Phase 3 bắt đầu ở 30% HP, rút ngắn telegraph/recovery nhưng không tăng move
  speed ngoài baseline.
- Mỗi phase shift kéo dài 0,65 giây, miễn damage trong transition và xóa toàn bộ
  projectile do boss sở hữu để không tạo hit mù.
- Recovery là 0,60 giây ở Phase 1–2 và 0,51 giây ở Phase 3; nhịp ability nội bộ
  có khoảng nghỉ 0,85 giây.

### Counterplay bắt buộc phải đọc được

- Boss **không dùng line telegraph phủ màn hình**. Quick/Pierce báo bằng animation
  kéo cung, charge ngay tại cung, aura/silhouette và nhịp âm thanh; Soul Mark đặt
  rune trực tiếp lên target. Projectile thật vẫn dừng ở tường. Người chơi dùng
  cột/tường để cắt line of sight hoặc sidestep sau hard-lock 0,15 giây cuối của
  Quick/Pierce; Mark hard-lock 0,55 giây ở Phase 2 và 0,45 giây ở Phase 3.
- Sword có thể áp sát để ép Escape, rồi dùng pass-through/pursuit bắt điểm đáp;
  Escape và Split Step đều không cho boss bất tử.
- Aim là cửa sổ phản công dễ đọc vì boss đang commit, không phải do được cộng
  poise damage. Chặn pattern bằng poise break là phần thưởng kỹ năng, không phải
  yêu cầu để sống sót.
- Damage tối đa mỗi projectile là 20; độ khó đến từ nhịp, hướng bắn và spacing,
  không đến từ one-shot hoặc HP inflation.
- Charge/rune/aura phải giữ palette `standard`, `colorblind` và `high_contrast`;
  màu không được là tín hiệu duy nhất phân biệt Quick/Pierce/Mark.

## Audit asset hiện tại

Nguồn runtime là **GandalfHardcore Archer**: atlas 704×320, cell 64×64, năm
hàng `idle 5 / fire 11 / run 8 / hurt 5 / death 6`; projectile
`archer_arrow.png` là 30×5. Base palette dùng cho playable Archer, purple
palette dùng cho boss. Sheet không có dodge riêng nên dash/roll reuse row run;
row death tuyệt đối không còn được dùng cho reposition sống.

| Phạm vi | Mức đủ hiện tại | Đã có | Thiếu để đạt presentation tốt |
| --- | ---: | --- | --- |
| Boss gameplay | ~95% | sprite thật; animation-fit timing; bow-local Quick/Pierce charge; target-bound Mark rune; motion-only Quick/Pierce/Mark trails; dash foot trail; phase/poise/death burst; KingdomArcher HP/poise nameplate; capture 640×360/847×437/1280×720 | release silhouette riêng; SFX identity |
| Playable gameplay | ~82% | locomotion/fire; Focus chain; persistent textured Soul Mark; animated Summon/Departure avatar; projectile widths thật | Focus pips/timer; Clear Shot identity; Soul Line polish và SFX |
| Physical pickup | ~92% | Soul icon RGBA 64×64 dùng chung world drop + FieldCodex; bob/glow; pickup burst/toast; exact UUID transaction | manual readability QA ở logical 24/32 px |
| UI/presentation | ~58% | generated Soul icon, KingdomArcher HP/poise/phase nameplate và text hooks | Hero/boss portrait, Focus pips, Clear Shot progress/READY badge |

Kết luận: asset hiện tại **đủ cho core gameplay và boss presentation tốt hơn
prototype**. Khoảng trống lớn nhất không còn là Soul pickup hay line VFX, mà là
HUD identity, boss nameplate, portrait, audio và manual multi-resolution QA.

### Thứ tự sản xuất asset

1. **Đã hoàn tất:** Soul icon + inventory reuse; Quick/Pierce/Mark projectile
   trails không chứa arrowhead; bow-local charge; target Mark; dash trail;
   phase/poise/death burst; persistent playable Mark.
2. P0: Focus pip 0/1/2 kèm timer; Clear Shot progress/READY badge.
3. P1: portrait playable Archer và KingdomArcher 128–256 px; action-release
   silhouette riêng; player Soul Line polish và SFX identity.

## License và quy tắc image generation

README cục bộ của GandalfHardcore cho phép dùng/chỉnh sửa asset trong game
thương mại và phi thương mại; cấm resale/repackaging/redistribution dưới dạng
asset, AI training, game-creation tools, NFT và sản phẩm in. Vì vậy:

- Không upload `archer_player_sheet.png`, `archer_boss_sheet.png`, arrow hoặc
  screenshot chứa chúng làm reference cho image generation.
- Generated Soul/portrait/VFX phải dùng prompt text-only độc lập, không yêu cầu bắt
  chước đúng nhân vật trong pack. Prompt, model/output và post-process phải ghi
  tại `docs/GENERATED_ASSET_PROMPTS.md`.
- Output generated là asset riêng; phải kiểm tra alpha, readability ở pixel size,
  nearest-neighbor import và quyền sử dụng trước khi promote.
- Trước release cần lưu exact source version/hash và license snapshot/notice vào
  manifest shipping. `assets/characters/archer/ASSET_SOURCE.md` là provenance
  kỹ thuật, không thay thế checklist phát hành.

## Nguồn runtime canonical

| Hợp đồng | File |
| --- | --- |
| Playable Archer numbers | `game/heroes/data/archer_hero.tres` |
| Bow/normal/active profile | `game/weapons/data/bow.tres` |
| Player combat consumer | `game/characters/knight/knight.gd` |
| Boss behavior | `game/characters/enemies/hooded_archer_miniboss.gd` |
| Boss content stats | `data/content/enemies/hooded_archer_miniboss.tres` |
| Level 5 encounter/objectives | `data/content/encounters/chapter_1_level_5_crypt.tres` |
| Physical pickup grant | `data/content/rewards/chapter_1_level_5_archer_soul_pickup.tres` |
| Level completion economy | `data/content/rewards/chapter_1_level_5_reward.tres` |
| Pickup authority/idempotency | `game/levels/objectives/level_5_archer_recruitment_runtime.gd` |
| Nonstarter ownership gate | `game/autoload/unlock_service.gd` |
| Explicit Equip + same-run refresh | `game/ui/field_codex.gd` |
| Relay state/missed-summon cooldown | `game/heroes/hero_soul_manager.gd` |
| Focus/Mark/Relay HUD | `game/ui/hud.gd` |
| Generated prompts and hashes | `docs/GENERATED_ASSET_PROMPTS.md` |
| Sprite provenance | `assets/characters/archer/ASSET_SOURCE.md` |
