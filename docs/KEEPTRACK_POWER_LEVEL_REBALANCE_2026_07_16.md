# SOUL OF HERO — keeptrack Power, Level, equipment và combat

**Ngày chốt:** 2026-07-16  
**Verdict:** `CURRENT`  
**Phạm vi đã triển khai:** Player Level/HP/Mana/Power, damage pipeline, áp lực
quái theo stage và difficulty, ba ô trang bị phụ, nâng cấp bằng đá, Field Codex
với 4 chỉ số lõi + 12 chỉ số hiệu dụng, migration save và hướng đánh khi vừa di
chuyển vừa tấn công.

Đây là authority diễn giải hiện hành cho đợt cập nhật này. Khi tài liệu cũ mâu
thuẫn với trang này, ưu tiên contract executable được liệt kê bên dưới rồi cập
nhật lại tài liệu. Audit này không thay thế resource/code bằng một bộ số thứ hai.

## Kết luận ngắn

Đợt cập nhật đã tách ba việc trước đây dễ bị trộn lẫn:

1. **Level bảo đảm nhân vật không đứng yên:** tự tăng HP và Mana, nhưng đóng góp
   sát thương luôn bằng `0`.
2. **Người chơi tự quyết định sức mạnh tấn công:** Power, Jewelry, Hero Soul và
   skill/action modifier mới làm sát thương tăng. Không cộng Power thì lên Level
   không âm thầm làm đòn đánh mạnh hơn.
3. **Quái giữ áp lực bằng contract riêng:** damage theo stage không đọc damage
   growth hoặc Power của người chơi; difficulty tiếp tục nhân HP/damage/speed,
   density, mutant chance và luck.

Kết quả là người mới vẫn có HP/Mana để tiếp tục học game, còn người hiểu build
được thưởng bằng lựa chọn Power, trang bị, Soul và nhịp kỹ năng. Độ phức tạp được
mở theo thứ tự Vessel → Boots → Jewelry thay vì đưa tất cả affix ra cùng lúc.

## Before → after ở mức hành vi

| Trước cập nhật | Runtime hiện tại |
| --- | --- |
| Lên Level có thể tự mang theo offense, làm mờ giá trị của lựa chọn build. | Level chỉ tăng HP/Mana; `damage_percent` từ Level luôn bằng `0`. |
| Thay curve player có nguy cơ làm damage quái đổi theo ngoài ý muốn. | Damage quái có curve stage riêng `5%`, decay `0,99`, rồi mới nhân difficulty. |
| Ba slot phụ là Vessel/Trace/Focus; crystal bị dùng như equipment, còn boots chỉ có asset. | Ba slot live là Armor `soul_vessel`, Boots `soul_boots`, Jewelry `soul_trace`; crystal là đá nâng cấp stackable. |
| Trang bị không có tiến trình nâng cấp ổn định. | Mỗi item có `upgrade_rank` 0–5; mỗi rank dùng một đá cùng rarity và tăng 3% trên roll gốc. |
| Kho đồ cần cuộn và thao tác nhấn có thể mở chi tiết trước khi drag. | Field Codex cố định 30 ô 6×5, không cuộn; chỉ chọn khi nhả chuột mà chưa drag. |
| Rarity chủ yếu nằm trong chữ/tên. | Ô item và ô trang bị dùng màu viền rarity; Magic–Epic có glow, Legendary+ pulse tiết chế; dòng affix hiếm nhất ở trên. |
| Movement có thể lật visual ngược khỏi hướng đòn đánh đang diễn ra. | Khi Attack/Skill, `action_direction` giữ visual, weapon và hit direction; movement vẫn độc lập nên có thể vừa lùi vừa đánh. |

## Bản đồ authority

| Contract | Authority runtime |
| --- | --- |
| Level, XP, Stat Point, Power/HP/Mana | `game/meta/progression/player_progression_rules.gd` |
| Thứ tự tính một hit | `game/combat/combat_resolver.gd` |
| Stage/difficulty của quái | `game/meta/progression/difficulty_rules.gd` |
| Slot, rarity, primary và affix gear | `game/meta/equipment/auxiliary_equipment_definitions.gd` |
| Sinh item, validate và upgrade multiplier | `game/meta/equipment/auxiliary_equipment_rules.gd` |
| Chiếu gear vào HP/Power/Mana | `game/meta/equipment/auxiliary_equipment_combat_stats.gd` |
| Cooldown, Mana, movement, healing và mitigation live | `game/heroes/hero_soul_manager.gd` |
| Save, giao dịch nâng cấp và migration | `game/autoload/save_service.gd` |
| Mở dần độ phức tạp loot | `game/meta/progression/complexity_progression_rules.gd` |
| Field Codex/kho đồ/chi tiết item | `game/ui/field_codex.gd` và các scene/script `field_codex_*` |
| Movement, action-facing và hit direction | `game/characters/knight/knight.gd` |
| Reward/unlock Chapter 1 | `data/content/levels/` và `data/content/rewards/` |

Nguyên tắc mở rộng là đăng ký content vào các contract trên. Item, Hero Soul,
Hero, level hay chapter mới không được tự tạo một nhánh damage/progression riêng
theo ID. Một mechanic toán học mới chỉ được thêm khi có bucket có tên, breakdown,
invariant và migration tương ứng.

## 1. Player Level: chỉ HP và Mana

Gọi `L` là Player Level sau khi clamp trong `[1, 100]`, số bước đã hoàn thành là
`n = L - 1` và:

```text
G(L) = (1 - 0,99^(L - 1)) / (1 - 0,99)

HP do Level   = 20 × G(L)
Mana do Level = 10 × G(L)
Damage do Level = 0
```

Nói theo từng lần lên cấp: bước đầu trả `20 HP + 10 Mana`; mỗi bước sau bằng
`99%` bước trước. Đường cong trơn, không surge và không breakpoint ẩn.

Với baseline 100 HP/100 Mana và chưa cộng stat/gear/Soul:

| Player Level | HP | Mana | Offense từ Level |
| ---: | ---: | ---: | ---: |
| 1 | 100,00 | 100,00 | 0% |
| 2 | 120,00 | 110,00 | 0% |
| 10 | 272,97 | 186,48 | 0% |
| 100 | 1.360,54 | 730,27 | 0% |

Mỗi Player Level sở hữu 5 Stat Point và 2 Skill Point. Mỗi core stat có cap 200
điểm. Level 100 tạo tổng ngân sách 500 Stat Point, vì vậy không thể đồng thời
max cả HP, Mana và Power; build vẫn phải có đánh đổi.

## 2. HP, Mana và Power dùng cùng một đường diminishing return

Với điểm thứ `k`, `1 ≤ k ≤ 200`:

```text
HP(k)    = 14 / (1 + (k - 1) / 199)
Mana(k)  =  7 / (1 + (k - 1) / 199)
Power(k) =  4 / (1 + (k - 1) / 199) phần trăm
```

Điểm đầu trả 14 HP, 7 Mana hoặc 4% Power. Điểm 200 trả đúng một nửa: 7 HP,
3,5 Mana hoặc 2% Power. Lợi ích giảm liên tục; catalog milestone cũ không được
đưa vào projection core hiện tại.

Tổng 200 điểm Power là `+554,746412%` core damage, tức multiplier `×6,54746412`
trước các multiplier riêng của vũ khí/action. Con số cap này là hệ quả của tổng
đường cong, không phải một bonus được cộng ép ở điểm 200.

Key save/runtime vẫn là `damage` để tương thích dữ liệu; tên người chơi nhìn thấy
là **POWER**. Không được hiểu key kỹ thuật này là flat damage trên từng hit.

## 3. “Sát thương nền”, POWER và DMG nghĩa là gì

`hero.base_damage` là mốc Công lực cơ bản của Hero, không phải damage cuối của
mọi nút bấm. Mỗi action giữ damage authored riêng bằng:

```text
action_multiplier = authored_action_damage / hero.base_damage
```

Do đó Power tăng toàn bộ bộ kỹ năng theo cùng tỷ lệ nhưng vẫn giữ quan hệ giữa
các đòn: đòn 40 vẫn nặng gấp đôi đòn 20 trước các modifier riêng của action.

Trong bảng chỉ số Field Codex:

- **POWER** là expected raw character damage sau flat damage và nhóm phần trăm
  cộng dồn (điểm Power, Jewelry damage%, selected Soul core damage%), trước
  multiplier vũ khí và action cụ thể.
- **DMG** là POWER sau multiplier sức mạnh vũ khí của Hero Soul đang chọn.
- Damage thực của Attack/Skill còn nhân action, skill/Soul modifier, variance,
  critical, trạng thái nhận damage và defense của mục tiêu.

Bảng này gọi cùng projection với runtime; UI không sao chép một công thức rút gọn.
Vì vậy đổi item, nâng `+rank`, Equip Soul hoặc cộng stat rồi refresh sẽ cho thấy
HP/Mana/POWER/DMG thay đổi theo chính kết quả combat dùng.

## 4. Thứ tự damage canonical

Một hit dùng đúng thứ tự:

```text
D_raw =
  (base + Σ flat)
  × (1 + Σ additive_percent / 100)
  × action_multiplier
  × Π unique_multiplier
  × variance_multiplier
  × critical_multiplier
  × Π target_damage_taken_multiplier
  × defense_multiplier

D_final = round_once(D_raw)
```

Power nằm trong `additive_percent`; damage flat của Jewelry nằm trước nhóm phần
trăm. Weapon strength, skill track và modifier riêng của Hero Soul/action là
`unique_multiplier`, nên thêm content không cần thay thứ tự tính.

Defense dùng:

```text
effective_rating = max(0, rating × (1 - percent_penetration/100) - flat_penetration)
defense_multiplier = 1 - effective_rating / (effective_rating + constant)
```

`constant` mặc định là 100. Variance đối xứng bị cap 25%; critical chance bị cap
100%; dữ liệu âm/NaN/Infinity bị sanitize. Chỉ làm tròn một lần ở cuối để không
tạo sai lệch do mỗi layer tự round.

## 5. Quái, stage và difficulty

Damage quái không đọc Power hoặc `damage_percent` của Player Level. Với stage
`S` trong `[1, 100]`:

```text
Q(S) = (1 - 0,99^(S - 1)) / (1 - 0,99)
stage_damage_multiplier = 1 + 5 × Q(S) / 100
final_enemy_damage_multiplier = stage_damage_multiplier × difficulty_enemy_damage
```

Difficulty tiếp tục là lớp lựa chọn đặt trên stage:

| Difficulty | Enemy HP | Enemy damage | Enemy speed | Spawn quantity | Mutant chance từ stage 4 | Luck |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | ×1,00 | ×1,00 | ×1,00 | ×1,12 | 3% | ×1,00 |
| Medium | ×1,35 | ×1,25 | ×1,08 | ×1,25 | 10% | ×1,35 |
| Hard | ×1,75 | ×1,55 | ×1,15 | ×1,50 | 20% | ×1,85 |

Stage speed là `1 + min(0,30; (S - 1) × 0,006)` trước difficulty. Stage 10 có
damage growth `+43,24%`; vì vậy damage multiplier xấp xỉ `×1,432 / ×1,791 /
×2,220` cho Easy/Medium/Hard trước modifier riêng của enemy/action.

Enemy HP hiện dùng ratio của cùng đường HP stage:

```text
stage_health_multiplier = (100 + 20 × Q(S)) / 100
final_enemy_health_multiplier = stage_health_multiplier × difficulty_enemy_health
```

Đây là coupling có chủ ý đang chạy để giữ durability Chapter 1, nhưng được ghi
rõ ở phần giới hạn vì thay HP curve player trong tương lai vẫn có thể làm HP quái
đổi. Damage quái đã độc lập; HP quái chưa độc lập hoàn toàn.

## 6. Ba slot equipment và độ phức tạp tăng dần

Thứ tự live là Armor → Boots → Jewelry:

| Slot/key | Mở ở Player Level | Primary | Affix live |
| --- | ---: | --- | --- |
| Armor — `soul_vessel` | 2 | `max_hp_flat` 8–18 | Max HP%, damage reduction, HP regen, healing received, guard while attacking |
| Boots — `soul_boots` | 4 | movement speed 2–5% | movement speed%, dash cooldown rate, dash speed%, footwork damage reduction, Max HP% |
| Jewelry — `soul_trace` | 7 | `damage_flat` 1–3 | damage%, Mana%, Mana regen, cooldown rate, Mana efficiency |

Mỗi slot có pool riêng; affix không được rò sang slot khác. Tám rarity là Normal,
Magic, Rare, Epic, Legendary, Crystal, Mythic, Eternal với số affix lần lượt
`0/1/2/3/4/4/4/5`. Roll multiplier theo rarity là
`0,80/0,90/1,00/1,12/1,25/1,38/1,52/1,70`.

Các consumer và cap runtime đáng chú ý:

- cooldown recovery tổng: 35%; damage reduction tổng: 50%;
- HP regen: 5% Max HP/s; Mana efficiency: 50%; healing received: 50%;
- movement speed: 25%; dash speed: 35%; guard while Attack/Skill: 20%;
- Mana regen flat không có cap riêng nhưng chỉ nhận roll từ pool đã validate.

Tutorial/reward Chapter 1 hiện dẫn người chơi theo nhịp:

- first-clear Level 1: Magic Vessel Lv2;
- first-clear Level 3: Magic Boots Lv4 với affix movement speed đơn giản;
- first-clear Level 6: Magic Jewelry Lv7 với cooldown rate;
- Level 7 cấp entitlement `soul_jewelry`; random complexity không mở Jewelry
  trước mốc Player Level 7.

Stage 6 chỉ cho random Armor + Boots với toàn bộ affix live của hai slot; từ
stage 7 mới có Jewelry. Người chơi vì vậy học sống sót, di chuyển rồi mới ghép
Power/Mana/cooldown.

## 7. Nâng cấp item và đá cùng rarity

Mỗi auxiliary item lưu `upgrade_rank` nguyên từ 0 đến 5:

```text
upgrade_multiplier(rank) = 1 + 0,03 × rank
effective_roll = original_roll × upgrade_multiplier
```

`+0` là 100% roll gốc; `+5` là 115%. Multiplier áp cho cả primary và từng affix,
không roll lại item và không thay rarity. Mỗi lần nâng tiêu đúng một stack
`soul_upgrade_stone_<rarity>` cùng rarity với item.

`upgrade_auxiliary_equipment(uuid, transaction_key)` là giao dịch atomic: chỉ
commit khi item hợp lệ, rank chưa cap và có đá; request lỗi không tiêu đá/không
tăng rank. Transaction key làm retry an toàn và chặn double-spend.

Crystal icon 321–400 là family vật liệu, không còn chiếm equipment slot. Runtime
hiện dùng một silhouette Radiant cho mỗi rarity làm tám loại đá; các affinity
crystal còn lại là catalog dự phòng, không được giả làm gear.

## 8. Field Codex và cảm giác kiểm soát chỉ số

Mặt equipment của Sổ Hành Trình hiện có:

- bốn số lớn **HP/MANA/POWER/DMG**: đủ để quyết định nhanh; `DMG` là damage
  sau Hero Soul weapon multiplier, không phải một damage riêng do UI tự tính;
- mười hai số hiệu dụng gọn, đọc từ `secondary_stats` của chính combat
  projection: DR, Tốc chạy, HP/s, Hồi lướt, Hồi nhận, Tốc lướt, Guard, Hồi
  chiêu, Footwork, Mana/s, Kỹ năng và Tiết kiệm Mana. Tooltip nói rõ điều kiện
  (ví dụ Guard chỉ khi tấn công; Footwork chỉ khi đang di chuyển);
- chọn một auxiliary item chưa equip hiển thị chênh lệch xanh/đỏ `+/-` cho cả
  chỉ số lõi lẫn những chỉ số hiệu dụng mà item đó thực sự thay đổi;
- sáu vị trí theo đúng thứ tự: Active Soul, Reserve 1, Reserve 2, Vessel,
  **Boots ở slot 5**, **Jewelry ở slot 6**;
- kho cố định 30 ô theo lưới 6×5 và tắt vertical scroll; dữ liệu legacy vượt
  30 không bị xóa mà được giữ an toàn kèm cảnh báo chưa hiển thị;
- chọn chi tiết ở mouse release; bắt đầu drag sẽ hủy selection đã arm nên kéo
  thả không tự mở item;
- chi tiết compact, giá trị đã nhân upgrade, affix sắp tier cao xuống thấp và
  từng dòng dùng màu rarity của chính affix;
- viền item/slot phản ánh rarity: ô trống/khóa neutral, Normal tĩnh,
  Magic–Epic glow, Legendary trở lên pulse nhẹ;
- nút `NÂNG +1` chỉ hiện khi auxiliary gear chưa `+5` và giải thích cần một đá
  cùng rarity.

Điều người chơi kiểm soát không phải một “điểm sức mạnh” mơ hồ. Họ nhìn thấy
đổi gear/cộng Power ảnh hưởng POWER/DMG, cộng HP/Mana ảnh hưởng hai pool tương
ứng, còn Boots tác động trực tiếp tốc độ/Dash/Footwork. Bốn số lớn giúp quyết
định nhanh; mười hai số phụ mở dần ý nghĩa của build mà không bắt người chơi tự
phục dựng công thức. Mọi giá trị và preview đều đi qua `HeroSoulManager`
projection, nên UI không thể tạo ra một bộ số thứ hai lệch runtime.

## 9. Hướng đánh và backpedal

Trong trạng thái Attack/Skill, hướng ngắm được snapshot thành `action_direction`.
Trong toàn action:

- sprite/weapon/hitbox giữ hướng tấn công;
- input movement vẫn quyết định velocity độc lập;
- vì vậy giữ hướng ngược lại tạo backpedal thật, không lật đòn đánh;
- khi recovery kết thúc, movement lấy lại quyền điều khiển visual-facing ngay.

Invariant này dùng chung controller, không branch riêng theo level. Hero/action
mới chỉ cần cung cấp hướng action đúng cho contract hiện có.

## 10. Save migration và tính đúng-một-lần

### Stat economy v2

Profile cũ được giữ nguyên `stat_allocation`, archive vào
`legacy_audit.stat_allocation_pre_power`, đặt `stat_economy_version = 2` và nhận
đúng một `free_stat_reallocation_credit`. Credit dùng qua giao dịch atomic ngoài
combat. Reload/retry không mint thêm credit.

### Auxiliary equipment v2

`inventory.auxiliary_equipment_version = 2` thực hiện migration trước merge và
sanitize:

- item Vessel/Trace hợp lệ cũ được giữ, bổ sung `upgrade_rank = 0`;
- mọi legacy `soul_focus` hợp lệ được archive dưới
  `legacy_audit.soul_focus_equipment_pre_v2`, bỏ khỏi equipment/loadout và đổi
  thành đúng một đá cùng rarity cho mỗi item;
- `soul_trace` cũ đang equip khi Player chưa đạt gate Level 7 được unequip an
  toàn nhưng item vẫn còn trong inventory;
- loadout live chỉ còn `soul_vessel`, `soul_boots`, `soul_trace`;
- entitlement reconciliation v6 xóa flag stale `soul_focus` và phục hồi
  `soul_jewelry` cho campaign completion tương ứng;
- rank lỗi, Focus lỗi, reference hỏng hoặc stack overflow đều fail closed.

Migration và reward reconciliation dùng marker/receipt versioned nên chạy lặp
không nhân đôi item, đá hoặc entitlement.

## 11. Evidence đã chạy trong phiên cập nhật

Các kết quả dưới đây là invariant/runtime automation, không phải đánh giá cảm
giác của người chơi:

| Suite/scope | Kết quả |
| --- | ---: |
| Player progression formulas và invariant | 323/323 |
| Player save/economy migration | 90/90 |
| Auxiliary equipment rules | 179/179 |
| Gear → combat projection (kể cả defense/secondary profile) | 101/101 |
| Gear → Knight runtime | 56/56 |
| Auxiliary v2 + stone/rank migration | 52/52 |
| Mana/meta core sau taxonomy Jewelry | 77/77 |
| Hero Soul live projection | 56/56 |
| Hero Soul/Knight runtime | 39/39 |
| Campaign reward | 62/62 |
| Campaign entitlement hardening | 64/64 |
| Visible progression reward runtime | 82/82 |
| Chapter 1 balance matrix | 583/583 |
| Field Codex release-vs-drag | 20/20 |
| Continuous HUD/Field Codex contract | 49/49 |
| Archer combat, aim và backpedal-facing | 90/90 |

Visual capture Field Codex đã được sinh ở 847×437 và 1280×720 cho inventory,
preview item có delta secondary, và upgrade page: **141/141** ở mỗi kích thước.
Cảnh báo root certificate hoặc RealtimeBridge port 9080 trong một số log không
phải failure gameplay khi suite vẫn hoàn thành và report không có failure.

## 12. Giới hạn và rủi ro còn mở

1. **Chưa có bằng chứng người chơi thật dài hạn.** Automation chứng minh công
   thức, gate và runtime wiring, không chứng minh game đã “gây nghiện”, TTK luôn
   vui hoặc mọi build đều đáng dùng. Cần playtest cohort và telemetry theo build.
2. **Nội dung author đầy đủ mới là Chapter 1.** Contract chạy tới Level 100,
   nhưng Level 11–100 chưa được author/playtest; không suy từ công thức rằng
   endgame đã cân bằng.
3. **Enemy HP vẫn dùng player HP stage curve.** Damage đã tách độc lập, nhưng
   đổi `HP_PER_PLAYER_LEVEL`/decay vẫn làm durability quái đổi. Trước khi mở
   Chapter 2 nên tách một enemy-health curve riêng hoặc khóa coupling bằng test
   chủ đích.
4. **Kho 30 ô là surface UI, không xóa overflow legacy.** Save cũ vượt 30 được
   giữ và cảnh báo, nên nếu sản phẩm cần hard capacity/economy pressure thì phải
   bổ sung transaction rule cho loot nhận mới, không chỉ dựa vào UI.
5. **Rarity/upgrade cần economy telemetry.** `+15%` ở cap và một đá/rank đã có
   invariant, nhưng drop rate/sink/source dài hạn chưa được playtest để chứng
   minh không quá grind hoặc quá rẻ.
6. **Asset provenance vẫn là release gate.** RPG400/crystal/chest asset cần giữ
   EULA/receipt trước phát hành thương mại.

## 13. Keeptrack cho lần cập nhật kế tiếp

Mỗi thay đổi lớn sau trang này phải ghi:

1. outcome cũ → mới và contract authority bị tác động;
2. công thức/thứ tự bucket/cap, không chỉ số cuối;
3. migration cùng quy tắc retry/idempotency nếu dữ liệu persisted đổi;
4. UI projection nào giúp người chơi quan sát lựa chọn;
5. test evidence và playtest evidence tách riêng;
6. giới hạn mới, đặc biệt với Chapter 2+, enemy HP, inventory capacity và stone
   economy;
7. cập nhật `docs/KEEPTRACK_INDEX.md` để chỉ một balance audit mang nhãn
   `CURRENT`.
