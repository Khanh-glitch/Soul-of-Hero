# SOUL OF HERO — Trạng thái triển khai V0.4

Cập nhật nội dung gần nhất: 2026-07-16. Các suite Archer và hợp đồng Soul/Equip
đã được refresh trong change này; suite Chapter 1 chưa chạy lại vẫn giữ baseline
gần nhất và cần aggregate validation trước release.

## Kết luận sản phẩm

Build hiện tại là một **vertical slice Chapter 1 có thể chơi thật từ Level 1 đến
Level 10**. Luồng sản phẩm đi qua Home Map → Campaign → Level Details → gameplay
→ Results → Next/Retry; không còn là tập hợp data draft hoặc sandbox tách rời.

Đây **chưa phải prototype 100 level hoàn chỉnh**. Project đã có schema và cấu
trúc campaign đủ sức chứa 10 chương × 10 level, nhưng nội dung đã author, nối vào
runtime và kiểm thử end-to-end hiện mới là Chapter 1. Level 11–100, Monster Soul
runtime, Monster Parts và các mode dài hạn vẫn là roadmap.

Quy ước trong tài liệu:

- **LIVE**: có consumer trong gameplay/UI/save thật và có kiểm thử runtime.
- **Entitlement**: quyền đã được mở và lưu đúng, nhưng nội dung phía sau có thể
  vẫn chưa được sản xuất. Ví dụ `chapter_2_access` không có nghĩa Chapter 2 đã có.
- **Foundation**: luật/schema đã tồn tại nhưng chưa đủ save, UI, loot và combat
  để gọi là một hệ thống chơi được.
- **PLANNED / NOT YET LIVE**: được UI ghi rõ, không giả vờ đang ảnh hưởng combat.

## Phạm vi đang chạy thật

| Khu vực | Trạng thái | Nội dung thực tế |
|---|---|---|
| Campaign Level 1–10 | **LIVE** | Registry production, map, encounter, objective, reward, Results, Retry/Next và fresh-save route. |
| Sword Hero | **LIVE** | Combo bốn nhịp, Soul Echo, Dash, Summon/Departure và Soul Relay. |
| Archer Hero | **LIVE baseline** | Focus Chain, Soul Mark, Clear Shot, Piercing Entry/Backstep Volley; physical pickup chỉ đưa exact Soul vào inventory, Active/Reserve và hiệu ứng chỉ áp sau explicit Equip, có hiệu lực ngay cùng ván. |
| Axe Hero | **Compatibility prototype** | Charge/Heavy Cleave và Throw/Recall được giữ cho save cũ; mốc tuyển mộ mới được dời sang campaign sau. |
| HP / Damage / Mana | **LIVE** | Phân bổ điểm, diminishing return, milestone đã có consumer, HUD và save. |
| Sáu track kỹ năng mỗi Hero | **LIVE** | Normal, Active, Dash, Soul Ready, Summon, Departure; tối đa rank 20. |
| Hero Soul | **LIVE** | Tám rarity, UUID/exact instance, affix, equip/team, favorite/lock, sell và fusion có feature gate. |
| Trang bị phụ | **LIVE** | Ba slot dùng chung cho team; chỉ số/effect đã hỗ trợ được áp vào Knight runtime. |
| Reward và entitlement | **LIVE** | First-clear transaction đúng-một-lần, replay idempotent; campaign level chỉ là gate, ownership của Hero không phải starter bắt buộc có physical Hero Soul. |
| Monster Soul | **Foundation** | Luật mở ở Level 50, Reaper profile, rank, Essence, Bonding, Severance; chưa có inventory/UI/loot/combat production. |
| Monster Parts | **Chưa triển khai** | Chưa có vòng lặp drop, forge/craft, UI hay cân bằng. |
| Level 11–100 | **Chưa author đầy đủ** | Mới có định hướng/schema 10 chương, chưa được phép gọi là playable content. |

## Chapter 1 hiện tại

| Level | Gameplay chính | Mốc tiến trình/entitlement |
|---:|---|---|
| 1 | Ba bãi phục kích Skeleton, ba ấn ký và cổng thoát | Onboarding campaign |
| 2 | Chọn đường và thu 3/4 ấn ký | Dạy đọc route thay thế |
| 3 | Reaper, pit và áp lực tầm xa | Soul Trace |
| 4 | Bẫy xoắn ốc và Elite | Dạy nhận biết Elite |
| 5 | KingdomArcher, hạ boss rồi nhặt Soul vật lý | Normal Archer Soul Lv1 vào inventory và identity entitlement; Equip mới kích hoạt Archer/Soul Hero/Soul Relay |
| 6 | Ba Soul Anchor, đổi Sword ↔ Archer | Skill allocation và respec |
| 7 | Bảo vệ Beacon 900 HP qua ba wave | Soul Focus |
| 8 | Chọn Reaper/Vampire, một Elite theo các trục áp lực tách biệt, rương vật lý | Epic Soul Vessel, Hero Soul inventory và sell |
| 9 | Ba Gate Seal vật lý, Crimson Reaper Elite theo các trục áp lực tách biệt | Rare Sword Soul và `chapter_1_boss_gate` |
| 10 | Vampire Castellan 720 HP, một actor liên tục qua hai phase | Epic Sword Soul, Fusion, Chapter 2 entitlement và Boss Replay Bounty |

Level 8–9 có authority transaction cho tương tác vật lý: branch chỉ bị khóa sau
khi spawn đủ quái và áp Elite thành công; chest/seal chỉ cấp điểm, sigil hoặc
runtime progress sau khi canonical encounter event commit thành công. Khi fault
được chèn vào, actor/state/reward rollback và tương tác vẫn thử lại được.

Level 10 replay chỉ trao bounty nhỏ theo run receipt: 120 Gold, 2 Hero Materials
và 1 Monster Fragment. Replay không trao lại Epic Soul, Player Level hoặc feature
unlock. `hunt_replay` hiện là entitlement cho **Boss Replay Bounty**, không phải
một Hunt mission hoàn chỉnh.

## Combat và meta đang nối thật

### Ba stat và milestone

- Player Level hỗ trợ tới 100; mỗi level trao 5 Stat Point và 5 Skill Point.
- HP, Damage và Mana tăng theo tier có diminishing return; milestone ở các mốc
  10/20/30/... được phân biệt rõ `LIVE` và `PLANNED` trong Arsenal.
- Max HP, core damage, Max Mana, defense, active-skill power, mana regeneration,
  mana efficiency và một số cooldown milestone đã có consumer thật.
- Milestone/affix chưa có consumer không được cộng ngầm; UI ghi `PLANNED` hoặc
  `NOT YET LIVE`.

### Mana và cooldown

- HUD có Mana bar/value và trạng thái đủ/thiếu Mana.
- Sword Soul Echo và Archer Soul Mark cùng tốn 32 Mana, cooldown baseline 12
  giây; Axe Throw/Recall chỉ còn là compatibility prototype.
- Mana hồi cơ bản 2/giây và nhận modifier từ stat/Soul/trang bị đã hỗ trợ.
- Cooldown recovery từ skill rank, milestone, Hero Soul và gear được cộng vào
  cùng một nguồn và giới hạn tổng ở 35%, tránh vượt cap bằng cách nhân tách rời.

### Hero Soul

- Tám rarity: Normal, Magic, Rare, Epic, Legendary, Crystal, Mythic, Eternal.
- Mỗi Soul là một instance có UUID, Hero Identity, item level, rarity, affix,
  trạng thái equipped/favorite/locked; chọn Soul theo đúng UUID, không chỉ theo
  loại Hero.
- Soul đang được chọn, đang dùng, khóa hoặc favorite được bảo vệ khỏi thao tác
  phá hủy không hợp lệ.
- Các affix LIVE hiện phủ Max HP, Damage, Max Mana, melee/action power,
  Active/Summon/Departure power, cooldown recovery, defense và defense trong lúc
  tấn công. Crit chance, crit damage, attack speed và các hook chưa có consumer
  vẫn được ghi trung thực là chưa hoạt động.
- Sell được mở sau Level 8. Fusion được mở sau Level 10, dùng ba Soul hợp lệ để
  tạo một Soul mới; output chỉ lấy affix đã có runtime consumer. Cả UI lẫn
  SaveService đều kiểm tra feature gate, nên gọi API trực tiếp không thể vượt
  entitlement.

### Trang bị phụ

- Ba slot: Soul Vessel, Soul Trace và Soul Focus.
- Flat/percent HP, Damage, Mana cùng các effect đã hỗ trợ như health/mana regen,
  mana efficiency, cooldown recovery và damage reduction được dùng trong combat.
- Item equip/unequip/favorite/lock/sell được lưu theo instance. Effect chưa có
  consumer không được quảng bá là LIVE.

## Save, reward và entitlement

`SaveService` lưu progression, campaign completion/unlock, Player Level, stat và
skill allocation, Hero Soul exact instances/team selection, auxiliary equipment,
currencies, feature flags và applied transaction receipts. Writer dùng file tạm,
validation, rotating backup và migration thay vì ghi đè mù.

Các đảm bảo hiện có:

- Campaign reward, Level completion, feature grant và next-level unlock commit
  trong cùng transaction/revision.
- Level 5 completion không trao Hero. Hạ KingdomArcher tạo physical drop; chỉ
  exact pickup transaction trao một Normal item-level-1 Archer Soul, không tự
  đổi team/Reserve và không thể bị suy diễn từ level-clear receipt. Soul chỉ có
  hiệu lực khi người chơi bấm Equip; thao tác này áp ngay, không chờ ván mới.
- Level 9 chỉ mở Level 10 khi vừa hoàn thành prerequisite vừa có
  `chapter_1_boss_gate`; forged `unlocked_levels` không vượt được gate.
- Level 10 trao Fusion/Chapter 2 entitlement/Boss Replay entitlement đúng-một-lần.
- Content-entitlement reconciliation sửa reward/feature hợp lệ từ receipt gốc,
  nhưng tuyệt đối không suy diễn Archer ownership từ Level 5 completion. Việc
  repair không nhân đôi currency, stackable loot hoặc unique instance.
- Results gọi Chapter 2 đúng là “entitlement (content pending)”, không tuyên bố
  Chapter 2 đã được sản xuất.

QA luôn đặt cả `SOUL_OF_HERO_SAVE_PATH` và `LIVING_ARSENAL_SAVE_PATH` vào profile
cách ly; runner không được dùng save thật của người chơi.

## Bằng chứng kiểm thử gần nhất

Các focused gate sau đã trả exit code 0:

| Suite | Kết quả |
|---|---:|
| Campaign Entry Runtime, toàn bộ `CAMPAIGN_READY` | **475 checks pass** |
| KingdomArcher Level 5 behavior/VFX/contracts | **72 pass** |
| Physical pickup + FieldCodex same-run Equip + boss nameplate | **63 pass** |
| Playable Archer combat/sidegrade | **57 pass** |
| Campaign Progression | **39 pass** |
| Save/Unlock Soul-required contract | **143 pass** |
| Campaign Reward | **48 pass** |
| Campaign Entitlement Hardening | **65 pass** |
| Level 8 static / live / authority-failure / fresh route | **62 / 70 / 20 / 59 pass** |
| Level 9 static / live / authority-failure / fresh route | **58 / 51 / 11 / 67 pass** |
| Level 10 static / live / fresh Level 1→10 route | **41 / 50 / 79 pass** |
| Mana Meta Core | **77 pass** |
| Hero Soul exact-instance live / Knight runtime | **53 / 33 pass** |
| Hero Soul Fusion live-affix audit | **40 pass; 1.792 outputs, 5.888 affix được quét** |
| Save compatibility và migrations | **118 pass** |

Visual acceptance đã render OpenGL cho KingdomArcher ở 640×360, 847×437 và
1280×720, xác nhận nameplate HP/poise/phase, bow-local charge, target rune và
không có line telegraph. Baseline 847×437/1280×720 của Axe HUD, Mana, Beacon
Level 7, Roster Souls/Skills và Vampire Castellan vẫn giữ. Automation không thay
thế playtest người thật về độ vui, nhịp độ hoặc cân bằng.

Lệnh aggregate chuẩn:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_full_regression.ps1 -SkipMcp
```

Các runner tập trung:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_5_miniboss_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_5_archer_visual_capture.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_level_5_archer_pickup_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_archer_hero_combat_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_campaign_progression_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_save_unlock_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_8_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_9_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_chapter_1_level_10_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_mana_meta_core_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_hero_soul_fusion_live_affix_tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_visual_runtime_acceptance.ps1
```

Cảnh báo `RealtimeBridge ... 9080 (Already in use)` chỉ cho biết một Godot process
khác đang giữ cổng debug tùy chọn. Nếu suite vẫn trả exit code 0 và không có
`SCRIPT ERROR`/`ERROR`, đây không phải lỗi gameplay.

## Khoảng trống chưa được phép gọi là hoàn thành

1. **Chưa có 100 level playable.** Level 11–100 cần map, roster, objective,
   reward, fresh-route test, visual QA và playtest thật theo từng chapter.
2. **Monster Soul chưa phải hệ thống production.** Mục tiêu mở ở Level 50 vẫn
   cần SaveService inventory, loot source, UI, equip/bonding flow và combat adapter.
3. **Monster Parts/Forge chưa có.** Chưa có part taxonomy, drop table, crafting,
   sink kinh tế hoặc balance.
4. **Hero Variant chưa có content hoàn chỉnh.** Schema/rule có thể mở rộng, nhưng
   chưa có variant roster, art, skill delta, loot rule và migration đã kiểm thử.
5. **Gacha/shop chưa triển khai.** Chưa có pity, banner, pricing hay purchase flow;
   không có quyết định thanh toán hoặc asset trả phí nào được thực hiện.
6. **Loot loop còn hẹp.** Chapter 1 chủ yếu dùng campaign reward deterministic;
   random loot, Hunt mission và hệ thống farm dài hạn chưa đủ để giữ 100 level.
7. **Cân bằng chưa được chứng minh.** Cần nhiều phiên người thật đo thời gian mỗi
   ải, tỷ lệ chết/retry, Hero usage, mana pressure, reward cadence và độ chán.
8. **Art còn release debt.** Generated Archer Soul icon và texture-driven
   KingdomArcher VFX đã tích hợp; Soul pickup không còn là asset thiếu. Debt còn
   lại là portrait, Focus/Clear Shot HUD identity, audio và manual
   multi-resolution QA. Toàn bộ generated asset dùng prompt
   text-only; GandalfHardcore sprites không được dùng làm AI reference.
   Axe vẫn cần provenance/frame weaponless khi quay lại production.
9. **Export/device QA chưa khép.** Chưa có release export đã kiểm thử đầy đủ trên
   target hardware, performance budget, input matrix, localization và packaging.

## Thứ tự sản xuất đề xuất

1. Đóng băng Chapter 1 thành P0, chạy nhiều fresh-save playthrough người thật và
   cân bằng Level 1–10 trước khi tăng số lượng content.
2. Khép toàn bộ affix/milestone còn `NOT YET LIVE`, random loot, Fusion tutorial,
   economy sink và Boss Replay/Hunt loop.
3. Sản xuất Chapter 2–5 theo template tái sử dụng, thêm Hero Identity/variant có
   kiểm soát; tích hợp Monster Soul đúng mốc Level 50.
4. Sản xuất Chapter 6–10, Monster Parts/Forge và endgame Challenge/Depth sau khi
   retention loop 1–50 đã được đo và chứng minh.
5. Khép art provenance, âm thanh, localization, export/device/performance QA trước
   khi gọi build là release-ready.

## Kết luận ngắn

V0.4 hiện đã có **core gameplay và Chapter 1 chơi được từ đầu tới boss cuối**, với
meta, Mana, Hero Soul, gear, Fusion, reward/save/entitlement nối vào runtime thật.
Phần còn thiếu lớn nhất không phải thêm một nút UI, mà là sản xuất và cân bằng
90 level tiếp theo cùng Monster Soul, Monster Parts, variants, loot/endgame và
release-quality art/export một cách tuần tự, có kiểm chứng.
