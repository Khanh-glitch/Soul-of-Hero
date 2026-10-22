# Audit tổng thể phiên làm việc — SOUL OF HERO

> **Historical snapshot:** số liệu kiểm chứng trong tài liệu này thuộc phiên
> 2026-07-15. Quyết định Axe Level 5 / Sword+Axe đã được thay thế ngày 2026-07-16
> bởi Archer Level 5, physical Hero Soul pickup và Sword+Archer. Xem
> `docs/ARCHER_LEVEL_5_DESIGN.md`; không dùng snapshot này làm recruitment spec.

Ngày chốt: 2026-07-15  
Engine: Godot 4.7, GDScript, GL Compatibility  
Phạm vi được kiểm chứng: internal playable prototype Chapter 1, Level 1–10

## 1. Phán quyết điều hành

Dự án không còn ở trạng thái “brainstorm/data scaffold mà vào game không thấy
đổi”. Chapter 1 hiện có route sản phẩm thật từ Home Map đến Campaign, Level
Details, gameplay, Results, Next/Retry; Sword và Axe đều có combat riêng; Soul
Relay hai chiều, Mana, stat/skill, Hero Soul exact-instance, auxiliary gear,
reward/save và boss hai phase đều có consumer runtime.

Nhãn trung thực của build là:

> **Internal already-playable Chapter 1 prototype (Level 1–10), chưa phải bản
> 100 level và chưa phải release candidate thương mại.**

“Core complete” trong phiên này nghĩa là loop Chapter 1 và các hệ thống meta
cần để loop đó vận hành đã được nối thật, có failure/idempotency/save gate và
evidence tự động/trực quan. Nó không có nghĩa Level 11–100, Monster Soul,
Monster Parts, gacha hay endgame mode đã hoàn thành.

## 2. So với mục tiêu ban đầu

| Mục tiêu | Trạng thái | Kết luận |
| --- | --- | --- |
| Thêm cơ chế lõi cần thiết | **Đạt cho Chapter 1** | Combat, objective, reward, retry, save, meta progression và UI đã nối |
| Trang bị/Hero Soul đủ tạo lựa chọn đầu game | **Đạt một phần mạnh** | 3 gear slot, 8 rarity, exact instance, live affix, sell/fusion; loot ngẫu nhiên/gacha chưa có |
| Monster Soul/Monster Part | **Chưa đạt runtime** | Monster Soul mới có rules; Parts/Forge chưa có |
| 10 chương/100 level | **Chưa đạt** | Capacity/schema 100 level có; chỉ L1–10 được author và QA |
| 10 level Chapter 1 + quái/boss | **Đạt prototype** | L1–10 CAMPAIGN_READY, L9 named elite, L10 boss riêng hai phase |
| Already playable, không crash/nhân reward | **Đạt gate tự động** | Fresh route, fail/retry, reload, idempotency và save isolation có test |
| Chơi vui/không chán 100 level | **Chưa thể chứng minh** | Cần telemetry và nhiều human playtest; automation không thay thế cảm giác chơi |

## 3. Vì sao giai đoạn đầu sửa nhiều nhưng vào game gần như không thấy khác

Đây là lỗi quy trình có thật, không phải cảm giác sai của người chơi:

1. Nhiều thay đổi đầu tiên nằm ở schema, resource, rules và test; production
   route chưa tiêu thụ chúng nên code có mà game không biểu hiện.
2. Campaign draft bị giữ ngoài registry playable; card/menu tồn tại nhưng Start
   không đi đến content mới.
3. Active Knight ban đầu chưa đọc stat allocation, Hero Soul exact instance và
   auxiliary gear nên meta chỉ là dữ liệu.
4. Một lỗi kiểu Array ở campaign entry từng đẩy người chơi ra khi vào ải.
5. UI chưa có MP/action state/instance detail, khiến hệ thống mới không quan sát
   được ngay cả khi save đã chứa dữ liệu.
6. Cửa sổ Godot DEBUG cũ không tự nạp đầy đủ script/scene vừa đổi; cần stop/run
   lại sau khi code ổn định.
7. Một số headless QA process cũ bị treo và chiếm CPU, làm tiến độ chậm và log
   khó theo dõi. Các process test cũ đã được dọn; editor của người dùng được giữ.
8. Tài liệu chính vẫn nói Sword-only/L1–5 hoặc campaign 0 level, nên người dùng
   không có một nguồn sự thật để keep-track.

Phiên này đã sửa cả ba tầng: data contract, production consumer và bề mặt nhìn
thấy trong game; đồng thời viết lại nguồn trạng thái.

## 4. Những gì đã cập nhật thật vào game

### 4.1 Luồng sản phẩm và campaign

- `AppRoot/AppFlow` điều hướng Loading/Home Map/Campaign/Level Details/gameplay/
  Results/Next/Retry.
- Registry có đúng 10 `CAMPAIGN_READY` LevelDefinition liên tiếp.
- Mỗi completion dùng một atomic transaction cho reward, feature, completed
  state và level kế tiếp.
- Replay không cấp lại first-clear Soul, Player Level hay feature.
- Level 10 có bounty nhỏ theo run receipt; callback lặp không trả hai lần.
- `required_feature_ids` được kiểm tra lại trước khi tin cache
  `unlocked_levels`; save forge/stale không mở được Level 10 thiếu boss gate.
- Reconciliation v5 sửa profile cũ đã có receipt v2/v4: phục hồi Player Level,
  feature, 3 campaign Soul và 4 auxiliary item unique, không nhân currency hay
  stackable.

### 4.2 Combat Hero

**Sword**

- Combo bốn nhịp có pursuit/wave/recoil/execution.
- Soul Echo tiêu 32 Mana, copy các nhịp còn lại với effect riêng.
- Active/Summon/Departure damage nhận skill rank và Soul affix tương ứng.

**Axe**

- Hold/release Charge → Heavy Cleave.
- Throw tiêu 24 Mana; lần nhấn sau Recall miễn phí.
- Cross Cut/Follow-through và form/HUD riêng.
- Level 5 first-clear trao Magic Axe Hero Soul và gán Reserve 1.

**Soul Relay**

- Q1 summon Reserve; Q2 trong takeover window đổi Active/Reserve.
- Chạy hai chiều Sword → Axe và Axe → Sword.
- Preserve đúng HP/state/cooldown cần thiết và có soak/idempotency coverage.

### 4.3 Mana

- Có current/max MP và thanh MP trong HUD.
- Hồi cơ bản 2 Mana/giây.
- Thiếu Mana từ chối cast trước khi tạo effect, không bật cooldown.
- Respawn hồi đầy và dọn cooldown/effect treo; death giữ snapshot đúng contract.
- Milestone Mana LIVE đầu tiên: +regen ở 10/50, giảm cost ở 20, cooldown recovery
  ở 30, +Max Mana ở 40.
- Tổng cooldown reduction từ rank + milestone + Soul + gear dùng chung cap 35%.

### 4.4 Player progression và kỹ năng

- Player Level cap 100.
- Mỗi level cấp 5 Stat Point và 5 Skill Point.
- HP/Damage/Mana có diminishing returns theo ba tier; mỗi stat cap 200 điểm.
- Milestone ở 10/20/30/40/50/60/70/80/90/100/125/150/175/200.
- UI ghi `LIVE` cho effect có consumer và `PLANNED/NOT YET LIVE` cho hook chưa có.
- Mỗi Hero có sáu track: Normal, Active, Dash, Soul Ready, Summon, Departure;
  rank cap 20, mỗi rank thay đổi runtime number.
- Allocate/respec mở sau Level 6 và lưu theo Hero Identity.

Điểm thiết kế cần người dùng chốt lại: code hiện gate rank theo
`ceil(PlayerLevel/5)`, nên rank 20 mở ở Player Level 100. Câu brainstorm “1 cấp
cộng 1 level” có thể được hiểu khác; không nên tự đổi curve này mà không chốt.

### 4.5 Hero Soul

- Tám rarity: Normal, Magic, Rare, Epic, Legendary, Crystal, Mythic, Eternal.
- Mỗi Soul là một instance UUID thật với hero, rarity, item level, affinity,
  affix, variant ID, source, favorite/lock/equipped.
- `selected_soul_instances` lưu UUID theo Hero; runtime không kích hoạt chỉ vì
  một cờ `equipped` mơ hồ.
- Soul đang selected/equipped, favorite hoặc locked được bảo vệ khỏi Sell/Fusion.
- Sell mở ở Level 8; Fusion 3→1 mở ở Level 10; gate fail không tiêu tài sản và
  không ghi receipt.
- Fusion đã được stress bằng 1.792 seed/5.888 affix: chỉ sinh affix LIVE và đúng
  action kit của Sword/Axe; không thể đổi 3 Soul + Gold lấy output vô dụng.
- Reward deterministic L9/L10 giữ nguyên seed/UUID/affix sau hardening.

Affix Hero Soul đang LIVE:

- `max_hp`, `core_damage`, `max_mana`, `melee_damage`;
- `active_skill_power`, `active_power`, `summon_power`, `departure_power`;
- `cooldown_recovery`, `active_cooldown`;
- `defense`, `defense_while_attacking`.

Các affix như crit chance/damage, attack speed, movement, dodge, projectile,
effect shape... vẫn có trong catalog thiết kế nhưng bị gắn `NOT YET LIVE` và
không được Fusion trả ra trong prototype này.

### 4.6 Trang bị phụ

- Ba slot: Soul Vessel, Soul Trace, Soul Focus.
- Item có UUID, rarity, level, primary/affix, favorite/lock/equipped.
- Flat/percent HP, Damage, Mana đi vào Knight runtime.
- Effect LIVE: health regen, cooldown rate, damage reduction, mana regen,
  mana efficiency.
- Equip cùng slot thay item cũ mà không phá item; selected item được bảo vệ.
- Chapter 1 có bốn auxiliary reward deterministic và reconciliation unique.

### 4.7 Nội dung Level 1–10

| Level | Gameplay thật | Reward/mốc |
| ---: | --- | --- |
| 1 | 12 Skeleton, 3 encounter, 3 sigil, exit | onboarding/reward đầu |
| 2 | Nhánh đường, 15 Skeleton, 3/4 sigil | route choice |
| 3 | 15 Swordsman + 5 Reaper, pit/pressure | Magic Soul Trace |
| 4 | Spiral hazard, 10+5 Skeleton, elite | elite literacy |
| 5 | 10+5 Skeleton, Vampire, Bone Reaper Captain | Magic Axe Soul, Soul Relay |
| 6 | 3 Soul Anchor, 9 Swordsman + 3 Reaper | dạy Relay hai chiều, skill UI |
| 7 | Beacon 900 HP, 3 wave, 12+4 | fail/retry thật, Soul Focus |
| 8 | chọn 6 Reaper hoặc 3 Vampire, 1 Elite theo trục áp lực, chest vật lý | Epic vessel, inventory/sell |
| 9 | 3 Gate Seal, Crimson Reaper identity riêng theo trục áp lực | Rare Sword Soul, boss gate |
| 10 | Vampire Castellan 720 HP, phase 2 ở 55% | Epic Soul, Fusion, Chapter 2 entitlement |

### 4.8 Boss và elite cuối chương

- Crimson Reaper là class/scene/identity riêng, không proxy Bone Reaper.
- Gate Seal thứ ba mới spawn boss; exit cần đủ event + death.
- Vampire Castellan là một actor liên tục hai phase, không spawn proxy phase 2.
- Phase 1: Blood Lunge. Phase 2: Blink Lanes, Blood Lunge và fan ba disc.
- Boss HUD cùng lúc có tên, HP, phase, pattern; không đè Objective ở 847×437.
- Death/retry reset về full Phase 1 và dọn projectile thuộc boss.
- Blink dùng collider/world layer + bounds arena và 8 candidate deterministic;
  nếu mọi điểm bị chặn, boss ở nguyên vị trí an toàn.

### 4.9 Save và chống nhân đôi

- Temp verification, backup rotation, recovery và migration schema/rules.
- Atomic first-clear, Sell, Fusion, unique grants và replay bounty.
- Fresh/reload/replay tests khẳng định reward không nhân UUID/currency/level.
- Full regression ép cả hai biến save path sang profile cách ly.
- Hash save thật trước cổng QA: `B392361FBA8A9FF070AC5BA6A1141CC1FEE6604A247C20828724E4D2A3F94C23`.

## 5. Bằng chứng QA

Focused evidence nổi bật trước cổng aggregate:

- Mana/meta: 77/77; HUD desktop 34/34, mobile 36/36.
- Hero Soul Fusion: 40/40, 1.792 output, 5.888 affix; Soul runner 221/221.
- Hero Soul exact-instance: 53/53; Knight runtime 33/33.
- Campaign entitlement v5: 65/65.
- Save compatibility: 118/118; Save/Unlock: 143/143.
- Level 8: static 62, live hai nhánh 70, fresh route 59.
- Level 9: static 58, live 51, fresh route 67.
- Level 10: static 41, live 50, fresh route 79.
- Campaign entry mọi READY level: 475/475.
- UI shell: 149/149; already-playable QA: 40/40, playable_levels=10.

Aggregate gate cuối cùng (chạy sau toàn bộ thay đổi code):

- Lệnh: `tools/run_full_regression.ps1 -SkipMcp`.
- Kết quả: **PASS, exit code 0**, 45 suite PowerShell + Input Map, tổng 46 cổng cấu hình.
- Thời gian: **386,6 giây**.
- MCP bị bỏ qua có chủ đích vì đây là kiểm định gameplay/offline; runner đã ghi rõ
  `all configured non-MCP suites; MCP skipped`.
- Warning ở failure-injection Level 8/9 là tình huống test chủ động từ chối authority;
  cả hai đều xác nhận không cấp tiến độ/reward trước khi retry, không phải lỗi build.
- Save QA dùng đường dẫn cô lập qua cả `SOUL_OF_HERO_SAVE_PATH` lẫn
  `LIVING_ARSENAL_SAVE_PATH`.
- SHA-256 save thật sau regression vẫn là
  `B392361FBA8A9FF070AC5BA6A1141CC1FEE6604A247C20828724E4D2A3F94C23`, trùng
  hoàn toàn với trước regression; dung lượng vẫn 18.247 byte, thời điểm sửa vẫn
  22:08:22 ngày 2026-07-15.

Visual OpenGL artifacts:

- Axe/Mana: `.artifacts/visual_acceptance_axe_847x437.png` và
  `.artifacts/visual_acceptance_axe_1280x720.png`.
- Level 7 Beacon: hai độ phân giải 847×437 và 1280×720.
- Level 9 Crimson Reaper: `.artifacts/level9_crimson_reaper_847x437.png`.
- Level 10 Castellan: `.artifacts/level10_vampire_castellan_847x437.png` và
  `.artifacts/level10_vampire_castellan_1280x720.png`.
- Roster Souls/Skills responsive ở 847×437.

## 6. Những gì chưa hoàn thành

### P0/P1 trước khi gọi là release candidate

- Human playtest/balance toàn L1–10; automation không chứng minh “vui”.
- Art Hero/Axe/boss chưa có coherence top-down và provenance/license release đủ.
- Axe vẫn có rìu baked trong body khi Throw, có thể tạo cảm giác hai rìu.
- Audio/VFX đã có routing/candidate asset nhưng chưa đạt boss/music polish.
- Copy còn trộn tiếng Việt và tiếng Anh.
- Chưa có export preset/device performance/safe-area QA.
- Không có clean git baseline; toàn bộ workspace đang là top-level untracked,
  nên diff/rollback/audit lịch sử chưa đáng tin.

### Hệ thống chưa có production runtime

- Level 11–100 và Chapter 2–10.
- Monster Soul inventory/drop/equip/UI/combat; rules dự kiến mở Level 50 mới là nền.
- Monster Parts, Forge/socket/crafting.
- Random loot loop kiểu Dungeon Quest, gacha/shop/quest source, pity economy hoàn chỉnh.
- Hero Variant content/kit/asset/pity persistence production.
- Hunt mission, Challenge và Depth.
- Bestiary discovery/drop-source production đầy đủ.

Không có purchase hoặc quyết định thanh toán nào được thực hiện. Asset mới trong
phiên này đều dùng local/existing/code-native/prototype; không tải asset trả phí.

## 7. Rủi ro kỹ thuật còn lại

- `knight.gd` là controller rất lớn, chịu nhiều orchestration; cần tách component
  sau khi Chapter 1 balance ổn, không refactor lớn trước characterization tests.
- Catalog affix/milestone lớn hơn tập consumer LIVE; mọi nguồn loot mới phải dùng
  whitelist/fail-closed như Fusion.
- Reconciliation version phải được bump mỗi khi thêm unique entitlement mới.
- Density cao hơn Chapter 1 cần profile enemy neighbor query và projectile cap.
- Cần watchdog/timeout cho PowerShell runner để không tái tạo stale Godot process.
- Test fixture có thể dùng debug damage để tiết kiệm thời gian; đó không phải bằng
  chứng thời lượng/cân bằng đánh boss tự nhiên.

## 8. Định hướng tiếp theo đề xuất

### Giai đoạn A — đóng băng Chapter 1 (ưu tiên kế tiếp)

1. Người chơi thật hoàn thành fresh L1→10 bằng Sword/Axe, không debug damage.
2. Ghi telemetry: thời lượng, death, retry, damage, Q1/Q2, Mana starvation.
3. Chốt skill-rank gate và stat economy theo ý người dùng.
4. Tuning Beacon/L8 choice/L9 elite/L10 pattern từ dữ liệu người chơi.
5. Việt hóa copy, audio/VFX readability và fix Axe duplicate visual.
6. Tạo git baseline sau khi owner duyệt build.

### Giai đoạn B — hoàn thiện loot/meta trước khi nhân content

1. Biến toàn affix cần dùng trong 100 level thành LIVE hoặc loại khỏi roll pool.
2. Random drop/source display, filter, compare, salvage và Lost Loot.
3. Fusion tutorial/cost tuning; Hero Variant production đầu tiên.
4. Monster Parts/Forge contract + một set nhỏ có consumer thật.
5. Không mở gacha/shop trước khi pity, duplicate protection và economy simulation
   có test; không có thanh toán trong prototype.

### Giai đoạn C — mở rộng campaign có kiểm soát

1. Chapter 2 template 10 level với environment/enemy family/boss riêng.
2. Chapter 3–5 tăng biến thể objective và chuẩn bị Monster Soul Level 50.
3. Level 50 mới mở Monster Soul với save → drop → UI → combat theo thứ tự.
4. Chapter 6–10 dùng Legendary/Crystal/Mythic/Eternal và Hero Variant có nhịp,
   không chỉ tăng HP/damage.
5. Mỗi chapter phải qua fresh route, reward idempotency, human balance và visual
   gate trước khi tạo chapter kế.

## 9. Tiêu chí để gọi prototype 100 level hoàn thành

- 100 level đều có map/objective/enemy/reward/Results/replay thật, không phải card.
- Tối thiểu mỗi chapter có mechanic/pacing/environment/boss identity riêng.
- Mọi reward roll ra đều có consumer LIVE và source disclosure.
- Save migration từ Chapter 1 hiện tại lên mọi schema mới không mất entitlement.
- Full fresh 1→100, retry/death/reload và reward exactly-once đều pass.
- Nhiều phiên người chơi thật cho thấy progression không dead-zone hoặc vỡ economy.
- Asset/audio/font/export/license đạt release gate, không còn prototype-only blocker.
