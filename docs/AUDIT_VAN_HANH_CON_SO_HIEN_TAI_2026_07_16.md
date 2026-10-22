# Audit vận hành con số trước cập nhật — 2026-07-16

> **TRẠNG THÁI: PRE-UPDATE / BẰNG CHỨNG LỊCH SỬ.** Tài liệu này mô tả trạng
> thái trước đợt sửa numeric authority, XP/Elite, Skill economy và guaranteed
> reward cùng ngày. Không dùng các con số “hiện tại” trong file này để tune
> build mới. Authority hậu cập nhật được ghi tại
> `docs/KEEPTRACK_CORE_BALANCE_UPDATE_2026_07_16.md`.

## 0. Phạm vi và cách đọc

Đây là audit **runtime hiện tại**, không phải bản mô tả ý tưởng. Audit đối chiếu trực tiếp:

- công thức và resource đang được gameplay gọi;
- dữ liệu level/encounter/reward đang được load;
- artifact regression hiện có;
- một probe deterministic các reward có seed cố định.

Ba nhãn được dùng xuyên suốt:

- **LIVE**: có đường runtime thật và có test/probe xác nhận;
- **FORMULA-ONLY**: công thức có thể ngoại suy nhưng chưa có content outcome đủ để gọi là cân production;
- **INERT/LEGACY**: số còn nằm trong catalog hoặc compatibility API nhưng không thay đổi gameplay hiện tại.

Audit này không thay đổi balance hay save. Nó đóng vai trò keeptrack để đợt sửa tiếp theo không vô tình cân trên số không tồn tại.

## 1. Kết luận điều hành

Lõi mới có nền tốt: damage có một pipeline có tên, level/stat curve trơn, stat point luôn dương nhưng giảm dần, HP/Mana/damage cùng đi qua projection chung, random loot có disclosure theo stage và save reward có transaction chống nhận hai lần.

Tuy nhiên trạng thái hiện tại **chưa thể gọi là balance production toàn game**. Early slice L1–L3 có outcome gate đáng tin; Chapter 1 L4–L10 chạy được nhưng có một số đường số liệu lệch authority; L11–L100 chủ yếu là ngoại suy công thức.

Các blocker lớn nhất trước khi tiếp tục tuning:

1. XP matrix dùng population và base score chuẩn, trong khi runtime thật còn scale `score_reward` theo stage/difficulty rồi mới tính threat weight. L7–L10 lại có population override thấp hơn canonical divisor. Vì vậy “15% XP bucket” hiện chỉ là mốc tham chiếu, không phải tổng XP live.
2. Reward Trace L3 và L8 chứa affix không có consumer. Epic Trace L8 có ba affix đều không tác động gameplay; chỉ primary `+1.68 flat damage` hoạt động.
3. `EnemyDefinition` hiện chưa cấp HP/damage/speed cho actor runtime; scene script mới là authority. Catalog và gameplay đã có số khác nhau.
4. Axe có hai bộ số trái nhau: Hero resource ghi combo/cooldown một kiểu, gameplay live lấy charged cleave/Throw từ Weapon resource kiểu khác.
5. Elite “x3” nhân cả damage và chia cooldown cho 3, nên throughput damage có thể thành khoảng `9x`, trong khi XP metadata được tính trước khi elite được áp ở L8/L9.
6. Với ba Hero live, L100 chỉ có `360` rank capacity nhưng người chơi kiếm `500` Skill Point; `140` điểm không có chỗ tiêu.

Do đó đánh giá trung thực là:

| Lớp | Trạng thái |
|---|---|
| Damage/stat core | Tốt, tổng quát, có thể mở rộng |
| Early combat L1–L3 | Có outcome gate đáng tin |
| Chapter 1 L4–L10 | Playable, cần sửa authority/reward/XP parity |
| L11–L100 | FORMULA-ONLY, chưa phải production balance |
| Loot disclosure ngẫu nhiên | Lõi tốt, nhưng slot pool tạo rarity ceiling ngoài ý muốn |
| Reward authored | Có transaction tốt, một số roll deterministic đang cho stat chết |

## 2. Bản đồ authority số hiện tại

| Miền số | Authority LIVE | Điểm lệch cần biết |
|---|---|---|
| Một hit damage | `game/combat/combat_resolver.gd` | Combo/charge/Echo có thể round trước khi tạo request kế tiếp |
| Level/stat/XP bucket | `game/meta/progression/player_progression_rules.gd` | Milestone/surge cũ vẫn nằm trong file nhưng inert |
| Skill rank effect | `game/meta/progression/hero_skill_combat_rules.gd` | Pool 500 lớn hơn capacity ba Hero |
| Hero HP/Mana/damage snapshot | `auxiliary_equipment_combat_stats.gd` + `hero_soul_manager.gd` | Weapon/Hero resource chưa thống nhất cho Sword/Axe |
| Stage/difficulty/mutant | `difficulty_rules.gd` + `enemy_difficulty_scaler.gd` | Score cũng bị scale và làm XP live khác matrix |
| Encounter population | `encounter_pack_rules.gd` + level JSON override | L7–L10 không dùng population canonical 3-floor |
| Enemy base stat | Scene/controller script | `EnemyDefinition.tres` chủ yếu là catalog/role tag, chưa lái stat actor |
| Random loot disclosure | `complexity_progression_rules.gd` + `loot_catalog.gd` | Direct caller không truyền policy giữ legacy unrestricted behavior |
| First-clear reward | Reward bundle `.tres` + `SaveService` transaction | Seed reward auxiliary có thể roll affix authored nhưng chưa LIVE |

Nguyên tắc mở rộng “thêm content là thêm data” mới đạt đầy đủ ở damage/stat/loot-policy core. Enemy stat và một phần Hero action vẫn cần biết đúng đường runtime cụ thể.

## 3. Damage: công thức, thứ tự và rounding

### 3.1 Công thức canonical

`CombatResolver` formula version `1`:

```text
(base + Σ flat)
× (1 + Σ additive% / 100)
× action multiplier
× Π unique multipliers
× variance
× critical
× Π target damage-taken
× defense multiplier
→ roundi một lần ở cuối request
```

Nguồn: `game/combat/combat_resolver.gd:8-11,226-269,411-420`.

Các rule quan trọng:

- base, flat, additive và multiplier đều fail-closed về số không âm;
- variance bị clamp `0–25%`;
- crit chance trong resolver bị clamp `0–100%`, crit multiplier tối thiểu `1`;
- raw damage `<= 0` thành `0`; raw dương luôn gây ít nhất `1`;
- preview crit dùng kỳ vọng `1 + chance × (critMultiplier - 1)`;
- resolve thật dùng roll `< chance`;
- early game hiện mặc định variance `0`, crit `0`, enemy defense thường `0`.

### 3.2 Defense

```text
effective = max(0, rating × (1 - percentPen / 100) - flatPen)
DR        = effective / (effective + 100)
multiplier = 1 - DR
```

| Effective defense | Damage reduction |
|---:|---:|
| 0 | 0% |
| 25 | 20% |
| 50 | 33.33% |
| 100 | 50% |
| 200 | 66.67% |
| 300 | 75% |

Percent penetration chạy trước flat penetration. Penetration vượt 100% chỉ đưa effective rating về 0, không tạo bonus damage âm giáp.

### 3.3 Thứ tự projection của Hero

```text
HP = (base + level flat + allocated flat + auxiliary flat)
     × (1 + auxiliary HP%)
     × selected Hero Soul HP multiplier

Mana = (base + level flat + allocated flat + auxiliary flat)
       × (1 + auxiliary Mana%)
       × selected Hero Soul Mana multiplier

Damage = (Hero base + auxiliary flat)
         × (1 + level% + allocated% + auxiliary% + Soul core%)
         × Hero Soul weapon multiplier
         × action multiplier
         × skill-rank multiplier
         × Hero Soul action multiplier
```

Level/stat/auxiliary/Soul core damage cùng additive bucket. Weapon rarity và action power là unique layer nên nhân riêng.

### 3.4 “Round once” có giới hạn phạm vi

Round-once đúng **trong một request Resolver**, nhưng một số action tạo request lồng nhau:

- Hero combo tạo authored integer bằng `roundi(base × combo multiplier)`;
- Axe charge `30→60` được round trước progression scaling;
- Soul Echo lấy hit đã scale/round, nhân mirror ratio rồi round lần nữa.

Vì vậy pipeline chính không round từng modifier, nhưng Echo/charge/combo vẫn có seam rounding giữa hai action. Đây chưa gây fail early matrix, nhưng có thể tạo bias ở damage rất nhỏ hoặc tỷ lệ mirror lẻ.

## 4. Player level, HP, DMG, Mana

### 4.1 Level curve

Với `L = clamp(level, 1, 100)`, `n = L - 1`:

```text
S(L) = (1 - 0.99^n) / 0.01

HP level growth   = 20 × S(L) flat
DMG level growth  =  5 × S(L) percentage-points
Mana level growth = 10 × S(L) flat
```

Mỗi level kế tiếp trả `99%` marginal level trước. Không có surge hay bước nhảy 5/10 level.

### 4.2 Bảng level không allocation/gear

| L | XP sang level kế | Tổng XP thuần để vào L | Stat / Skill kiếm được | HP | Core DMG | Mana | Enemy H× / D× / V× |
|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 100 | 0 | 5 / 5 | 100 | 20 | 100 | 1 / 1 / 1 |
| 2 | 128 | 100 | 10 / 10 | 120 | 21 | 110 | 1.2 / 1.05 / 1.006 |
| 3 | 157 | 228 | 15 / 15 | 139.8 | 21.99 | 119.9 | 1.398 / 1.0995 / 1.012 |
| 5 | 219 | 573 | 25 / 25 | 178.807980 | 23.940399 | 139.403990 | 1.788080 / 1.197020 / 1.024 |
| 10 | 383 | 1,991 | 50 / 50 | 272.965505 | 28.648275 | 186.482753 | 2.729655 / 1.432414 / 1.054 |
| 20 | 734 | 7,379 | 100 / 100 | 447.662752 | 37.383138 | 273.831376 | 4.476628 / 1.869157 / 1.114 |
| 40 | 1,496 | 29,193 | 200 / 200 | 748.541902 | 52.427095 | 424.270951 | 7.485419 / 2.621355 / 1.234 |
| 70 | 2,736 | 91,811 | 350 / 350 | 1,100.325940 | 70.016297 | 600.162970 | 11.003259 / 3.500815 / 1.3 |
| 100 | 0 | 192,872 | 500 / 500 | 1,360.540725 | 83.027036 | 730.270362 | 13.605407 / 4.151352 / 1.3 |

`192,872` là đường XP thuần. Campaign first-clear cộng thẳng level nên người chơi không phải farm số này để đạt cap.

### 4.3 Ý nghĩa hệ thống của hai curve HP và DMG

Enemy HP dùng cùng scale với player HP; enemy damage dùng cùng scale với player core damage. Vì HP curve lớn hơn damage curve, cùng một archetype và không build sẽ có:

```text
relative TTK scale = enemy HP scale / player DMG scale
relative hits-to-die scale = player HP scale / enemy DMG scale
```

Hai tỷ lệ bằng nhau:

| L | TTK và hits-to-die tương đối so với L1 |
|---:|---:|
| 3 | 1.27× |
| 10 | 1.91× |
| 20 | 2.40× |
| 40 | 2.86× |
| 70 | 3.14× |
| 100 | 3.28× |

Đây là một quan hệ hợp lý cho mục tiêu “chưa hiểu build vẫn chơi được”: người không đầu tư vẫn ngày càng an toàn trước một hit riêng lẻ, nhưng giết quái chậm hơn và tự cảm nhận nhu cầu tăng throughput. Difficulty, mật độ, pursuit và gear mới kéo pressure lên.

Rủi ro: nếu density và gear progression không được outcome-test ở L11–L100, quan hệ này dễ biến thành enemy sponge thay vì bài học build.

## 5. Stat Point

### 5.1 Kinh tế điểm

- Level 1 đã có `5` Stat Point.
- Mỗi level cho `5`; L100 tổng `500`.
- Chỉ có HP, Damage, Mana.
- Mỗi stat cap `200`; tổng capacity `600`, nên không thể max cả ba bằng pool 500.
- Stat allocation hiện chỉ tăng; chưa có Stat respec/refund API.

### 5.2 Diminishing return

Điểm thứ `k`, với cap `P=200`:

```text
return(k) = initial / (1 + (k - 1) / 199)

initial HP / DMG / Mana = 14 flat / 2 percentage-points / 7 flat
```

| Điểm đã đầu tư | HP bonus | DMG bonus (pp) | Mana bonus | Marginal của điểm cuối: HP / DMG / Mana |
|---:|---:|---:|---:|---|
| 1 | 14 | 2 | 7 | 14 / 2 / 7 |
| 5 | 69.306914 | 9.900988 | 34.653457 | 13.724138 / 1.960591 / 6.862069 |
| 50 | 625.884268 | 89.412038 | 312.942134 | 11.233871 / 1.604839 / 5.616935 |
| 100 | 1,136.632957 | 162.376137 | 568.316478 | 9.348993 / 1.335570 / 4.674497 |
| 150 | 1,568.095686 | 224.013669 | 784.047843 | 8.005747 / 1.143678 / 4.002874 |
| 200 | 1,941.612442 | 277.373206 | 970.806221 | 7 / 1 / 3.5 |

Điểm 200 vẫn bằng đúng một nửa điểm 1, không có cliff. Đây là một trong những phần toán học chắc nhất hiện tại.

Ví dụ full-spend hợp lệ ở L100:

| Allocation HP / DMG / Mana | HP | Core DMG | Mana |
|---:|---:|---:|---:|
| 200 / 150 / 150 | 3,302.153167 | 127.829770 | 1,514.318205 |
| 200 / 200 / 100 | 3,302.153167 | 138.501677 | 1,298.586841 |

Damage level và damage allocation cộng percentage-points, không tự nhân nhau.

## 6. Skill Point và skill rank

### 6.1 Pool và gate

- `5` Skill Point mỗi level, L100 tổng `500`.
- `6` track mỗi Hero: Normal, Active, Dash, Soul Ready, Summon, Departure.
- Mỗi track cap `20`, mỗi Hero capacity `120`.
- Rank gate = `ceil(level / 5)`, tối thiểu 1.
- Skill allocation UI/API được mở ở first-clear L6, dù điểm tích từ L1.
- Respec skill miễn phí tới L20; sau đó `min(2500, 100 + 25L)`, chạm cap ở L96.

Ba Hero live chỉ có capacity `3 × 120 = 360`. Từ L11 trở đi, pool hiện tại đã đủ max mọi rank đang được level gate cho phép trên cả ba Hero; L100 dư `140` điểm. Skill không còn là lựa chọn build dài hạn nếu roster vẫn chỉ có ba Hero.

Để pool 500 tạo trade-off endgame, hệ thống cần ít nhất năm Hero capacity (`5 × 120 = 600`) hoặc một sink/rank structure khác. Đây là nợ content/core, không phải lỗi công thức cộng điểm.

### 6.2 Hiệu ứng rank

| Track | Mỗi rank | Rank 20 |
|---|---:|---:|
| Normal damage | +2.5% | ×1.50 |
| Active damage | +3% | ×1.60 |
| Active cooldown recovery | +1.5 percentage-points | cooldown ×0.70 trước cap tổng |
| Dash cooldown | -1.25% | ×0.75 |
| Dash distance/speed | +1.5% | ×1.30 |
| Dash invulnerability | +0.75% | ×1.15 |
| Ready window | +2.5% | ×1.50 |
| Ready radius | +1% | ×1.20 |
| Summon damage | +3% | ×1.60 |
| Departure damage | +3% | ×1.60 |

Ready requirement giảm `1` ở rank 10 và thêm `1` ở rank 20. Đây là breakpoint rời rạc duy nhất đáng kể trong skill curve.

## 7. Mana, cooldown, movement và stamina

- Base Mana `100`; base regen `2/s`.
- Active mana-cost reduction cap `50%`.
- Tổng active cooldown reduction từ rank + Soul + auxiliary cap `35%`.
- Damage reduction cap live `50%`.
- Health regen cap live `5% max HP/s`.
- Dash nền: speed `265`, duration `.18s`, cooldown `2s`, quãng đường khoảng `47.7 px`.
- Move speed config live `112`.
- Hit invulnerability sau khi nhận hit `.75s`.
- Stamina `100`, regen `26/s`; dash tốn `22`, roll `18`, slide `12`, hop `10`.
- Normal Hero combo/Archer/Axe combat route hiện có stamina cost `0`; Mana là resource chính của active skill.

Global caps Dodge `25%`, bonus attack speed `60%`, crit `60%` tồn tại trong progression metadata nhưng hiện chưa có consumer đồng bộ. Resolver riêng vẫn cho crit chance đến `100%`. Không nên trình bày ba cap đó như power đang LIVE.

## 8. Hero action numbers LIVE

### 8.1 Sword

| Step | Authored damage | Action duration | Hit window |
|---|---:|---:|---:|
| C1 | 20 | .34s | .10–.25 |
| C2 | 20 | .40s | .13–.29 |
| C3 wave | 24 | .52s | .20–.40 |
| C4 pursuit | 40 | .58s | .22–.45 |
| C4 fallback | 28 | .58s | .22–.45 |

Full pursuit combo = `104` authored damage trong `1.84s`. C3 là wave và không gây thêm melee hit trùng.

Soul Echo:

- Mana `32`, cooldown `12s`, duration `4s`;
- mirror ratio `[.45, .45, .50, .60]`;
- delay `[.11, .13, .15, .08]`;
- baseline mirror `[9, 9, 12, 24]`; C4 fallback mirror `17`.

### 8.2 Archer

| Step | Damage | Duration / hit | Focus |
|---|---:|---|---|
| Quick | 18 | .32 / .13–.18 | +1 khi spacing đúng |
| Split | 20 | .40 / .16–.22 | +1 khi spacing đúng |
| Piercer | 30 | .70 / .40–.48 | Focus 0/1/2 → 30/36/42 |

- Full Focus chain = `80` damage / `1.42s`; không giữ spacing = `68`.
- Focus max `2`, timeout `4s`.
- Spacing hợp lệ `96–260`; hostile trong `72` làm mất 1 Focus mỗi `.45s`.
- Piercer target cap `1/2/4` theo Focus.

Soul Mark:

- cast `.22s`, Mana `32`, cooldown `12s`, mark `4s`;
- normal hit kế tiếp vào đúng target giải phóng Soul Line `44` damage;
- line range `360`, speed `640`, width `16`, target cap `5`.

### 8.3 Axe — số live và số stale

Gameplay LIVE lấy `game/weapons/data/axe.tres`, không lấy combo Hero resource:

- Heavy Cleave base `30`, charge tối đa `1.15s`, damage `30→60`;
- action `.44s`, hit `.16–.32`;
- arc `70°→150°`, stagger `20→45`;
- charge movement multiplier `.36`.

Throw & Recall:

- outbound `26`, return `26`; cùng target có thể nhận `52`;
- cross-cut cộng `28 stagger`, không cộng damage;
- Mana `24`, cooldown live `6.5s`;
- outbound/return speed `340/470`, auto recall `1.4s`, range `220`, width `14`.

`axe_hero.tres` vẫn ghi combo `[20,24,36]`, charge `1s/+60%`, cooldown `8s`. Đây là stale/alternate authority và không được dùng để cân Axe live.

### 8.4 Relay damage

- Sword summon: `11` rồi `25`; departure `18`.
- Archer summon: `28`; departure ba arrow `12`, mỗi target tối đa hai arrow = `24`.
- Axe summon impact `27`; departure `21`.

## 9. Enemy base numbers LIVE

### 9.1 Floor enemies

| Enemy | HP / damage | Movement/range | Timing |
|---|---|---|---|
| Skeleton | `70 / 14` | patrol/chase `34/58`, detect/disengage `184/264`, attack range `38` | cooldown `.85s` |
| Bone Reaper | `86 / 14` | `30/48`, `205/280`, preferred `82–150`, ability `188` | telegraph `.56`, strike `.28`, recovery `.72`, CD `2.10` |
| Blood Vampire | `112 / 16`, leech `8` | `38/70`, `215/290`, preferred `0–86`, range `118` | `.44/.52/.66`, CD `1.85` |
| Reaper Captain | `258 / 18` | `32/52`, `230/310`, preferred `78–148`, range `204` | `.64/.30/.68`, CD `1.80` |

Catalog `EnemyDefinition` hiện khác live ở vài chỗ, ví dụ Blood catalog damage `18` nhưng profile runtime `16`; Bone catalog không phản ánh đầy đủ live movement/timing. `Main` instantiate scene rồi chỉ lấy role tags từ registry, không copy stat resource vào actor.

### 9.2 Miniboss/Boss

Hooded Archer:

- HP `360`, poise `50`, score `650`;
- Quick/Pierce/Mark damage `12/18/20`;
- phase thresholds `65%` và `30%`;
- common cooldown `.85s`, các telegraph khoảng `.44–1.0s`.

Vampire Castellan:

- HP `720`; phase 2 ở `55% = 396 HP`;
- phase cooldown `1.55/1.30s`;
- Blood Lunge `14/16` theo phase;
- Blink Lanes `18`;
- Disc Fan ba disc × `10`; mỗi disc có outbound/return receipt riêng nên theoretical cùng target tối đa `60` trước scaling.

Direct boss attacks vẫn đi qua authored damage seam của Resolver; số trong `EnemyDefinition` không tự thay thế các attack-site constants này.

## 10. Stage, difficulty, mutant, elite

### 10.1 Difficulty raw

| Mode | HP | DMG | Speed | Legacy spawn quantity | Mutant từ L4 | Luck / Rare multiplier |
|---|---:|---:|---:|---:|---:|---:|
| Easy | 1.00 | 1.00 | 1.00 | 1.12 | 3% | 1.00 / 1.00 |
| Medium | 1.35 | 1.25 | 1.08 | 1.25 | 10% | 1.35 / 1.45 |
| Hard | 1.75 | 1.55 | 1.15 | 1.50 | 20% | 1.85 / 2.10 |

Trước stage 4, mutant chance bị ép `0`.

Stage multiplier:

```text
stage HP    = 1 + .20S(stage)
stage DMG   = 1 + .05S(stage)
stage speed = 1 + min(.30, (stage - 1) × .006)
```

Hard L100 hợp thành khoảng `23.8095× HP / 6.4346× DMG / 1.495× speed` trước mutant/elite.

### 10.2 Mutant

Sau stage/difficulty:

- HP ×`1.40`;
- damage ×`1.25`;
- speed ×`1.08`;
- score reward scale còn nhân thêm `1.60` ngoài geometric threat scale.

Mutant XP metadata được tính sau modifier nên thực sự trả nhiều XP hơn normal.

### 10.3 Elite

Elite modifier hiện:

- nhân `3` cho HP, damage, movement, ranges, strike speed và nhiều profile field;
- chia cooldown/recovery cho `3`;
- nhân score field và reward label `3`;
- visual scale `1.3`; rarity tối thiểu Rare.

Vì damage `×3` và cooldown `/3`, sustained attack throughput có thể gần `×9`, chưa kể range/speed. Gọi đây là “3x threat” là không chính xác.

Ở L8/L9, enemy được stage/difficulty-scale và nhận `experience_reward` metadata trước, sau đó level controller mới áp elite. `Main` trả XP từ metadata cũ. Do vậy score field sau elite là `×3` nhưng XP của kill không được recompute theo elite. Loot role tốt hơn, nhưng XP risk/reward không đi cùng contract `reward_multiplier=3`.

## 11. Dungeon encounter pressure

### 11.1 Canonical population profile

Canonical profile giả định 3 floor:

| Stage | Pack × member × floor | Easy total | Skeleton / Reaper / Vampire raw weight |
|---:|---:|---:|---|
| 1 | 1×5×3 | 15 | 100 / 0 / 0 |
| 2 | 1×6×3 | 18 | 100 / 0 / 0 |
| 3 | 1×7×3 | 21 | 90 / 10 / 0 |
| 4 | 2×4×3 | 24 | 75 / 25 / 0 |
| 5 | 2×5×3 | 30 | 68 / 25 / 7 |
| 6 | 2×6×3 | 36 | 60 / 27 / 13 |
| 7 | 2×7×3 | 42 | 53 / 29 / 18 |
| 8 | 2×8×3 | 48 | 46 / 31 / 23 |
| 9 | 3×6×3 | 54 | 39 / 33 / 28 |
| 10 | 3×7×3 | 63 | 32 / 34 / 34 |

Medium thêm `1 member/pack`. Hard L1–L10 cũng chỉ thêm `1 member/pack`; extra pack Hard bị gate tới stage 11. Advanced family weight được nhân `1.15` Medium / `1.35` Hard rồi normalize; family đang khóa ở zero vẫn bằng zero.

### 11.2 Population thật của Chapter 1

L1–L6 dùng profile canonical. L7–L10 có `floor_count=1` và authored override:

| Level | Easy / Medium / Hard regular pack population | So với canonical Easy | Objective enemy thêm ngoài regular pack |
|---:|---:|---:|---|
| 1 | 15 / 18 / 18 | 100% | — |
| 2 | 18 / 21 / 21 | 100% | — |
| 3 | 21 / 24 / 24 | 100% | encounter objective riêng nếu authored |
| 4 | 24 / 30 / 30 | 100% | — |
| 5 | 30 / 36 / 36 | 100% | Hooded Archer miniboss |
| 6 | 36 / 42 / 42 | 100% | Soul Anchor objective |
| 7 | 21 / 24 / 24 | 50% | Beacon/wave authority |
| 8 | 21 / 24 / 24 | 43.75% | một branch Elite guardian |
| 9 | 24 / 27 / 27 | 44.44% | Crimson Reaper Elite |
| 10 | 16 / 18 / 18 | 25.40% | Vampire Castellan |

Việc giảm regular population có thể hợp lý vì L7–L10 có objective/boss riêng. Vấn đề không nằm ở việc override, mà ở chỗ XP divisor vẫn dùng `get_pack_plan(stage, Easy)` canonical thay vì `get_level_pack_plan(metadata, ...)` thực tế.

### 11.3 Pressure ngoài HP/damage

| Stage | Tactical gap | Trap/floor | Pursuit multiplier |
|---:|---:|---:|---:|
| 1 | 7.5s | 4 | 1.30 |
| 3 | 6.2s | 6 | 1.38 |
| 5 | 5.3s | 8 | 1.46 |
| 7 | 4.7s | 9 | 1.54 |
| 10 | 3.8s | 10 | 1.66 |
| 21 | 3.6s | 11 | 1.71 |
| 41 | 3.5s | 11 | 1.74 |
| 71 | 3.2s | 12 | 1.80 |
| 100 | 3.1s | 12 | 1.82 |

`tactical_gap` là target authoring, không phải timer bị runtime ép. Pursuit thực sự scale detection/disengage. L11+ population band có công thức, nhưng repo hiện chưa có authored chapter map đủ để xác nhận realization 3-floor.

Pack-model map bỏ qua `DifficultyRules.spawn_quantity` và dùng EncounterPackRules. Non-pack legacy map vẫn dùng `spawn_quantity`. Đây là hai density algorithm song song.

## 12. XP và tốc độ lên level

### 12.1 XP bucket

```text
XP_required(L) = 0, nếu L=100
XP_required(L) = 100 + 25(L-1) + floor(3(L-1)^1.35), nếu L<100
```

XP lưu là progress trong bucket hiện tại, không phải lifetime XP. Overflow có thể qua nhiều level; ở cap XP về 0.

### 12.2 Base supplementary kill XP

```text
ordinary base per reference kill = .15 × XP_bucket / canonical Easy population
boss base                         = .10 × XP_bucket
threat weight = clamp(sqrt(score / referenceScore), .65, 1.75)
referenceScore ordinary/boss = 100 / 650
reward units = base × threat weight
```

Fractional reward tích trong run carry; chỉ `floor(total)` được commit. Rời run có thể bỏ dưới `1 XP`.

### 12.3 Công thức LIVE còn scale score

Trước khi tạo XP metadata, `EnemyDifficultyScaler` làm:

```text
score' = round(score × sqrt(max(1, healthMultiplier × damageMultiplier))
                     × (1.60 nếu mutant))

live threat weight = clamp(sqrt(score' / referenceScore), .65, 1.75)
```

Do đó stage và difficulty tăng XP per kill gián tiếp. Với reference Skeleton:

| Scenario | Live threat weight xấp xỉ | Regular XP nếu đủ canonical population |
|---|---:|---:|
| L1 Easy | 1.000 | 15.0% bucket |
| L3 Easy | 1.114 | 16.7% bucket |
| L3 Hard | 1.428; population 24/21 | khoảng 24.5% bucket |
| L10 Easy canonical | 1.407 | khoảng 21.1% bucket |
| L23+ Easy | chạm cap 1.75 | 26.25% bucket |

Reference Skeleton chạm threat cap ở khoảng L23 Easy, L14 Medium, L9 Hard. Advanced enemy có base score cao nên chạm cap sớm hơn.

`chapter_1_balance_matrix_report.json` hiện tính Hard XP bằng density ratio nhưng không đưa live score scaling này vào. Vì vậy matrix `15–18.75%` không phải tổng XP actor live.

### 12.4 Population override làm chiều ngược lại

Vì divisor vẫn canonical nhưng L7–L10 có ít regular enemy hơn, reference-score Easy regular population trước live score weight chỉ trả:

| Level | XP bucket ratio từ regular packs |
|---:|---:|
| 7 | 7.50% |
| 8 | 6.5625% |
| 9 | 6.6667% |
| 10 | 3.8095% |

Boss/elite/objective enemy bù một phần. Kết quả cuối không thể gọi là một curve 15% thống nhất cho đến khi divisor dùng realized plan hoặc outcome gate đo run thật.

### 12.5 First clear

Mỗi Chapter 1 level L1–L10 grant trực tiếp `+1 Player Level` đúng một lần. XP đang có được giữ nguyên khi grant level. Replays không trả lại first-clear bundle nhưng vẫn có kill XP/random loot.

Khởi đầu L1 và hoàn thành đủ 10 first clear bảo đảm ít nhất tới L11, chưa tính level-up từ kill XP. Đây là nhịp campaign chính; kill XP là nhịp farm/replay phụ.

## 13. Loot disclosure, rarity và item power

### 13.1 Disclosure theo stage

| Stage | Rarity cap | Surface random mở |
|---:|---|---|
| 1 | Normal | Material only |
| 2–3 | Magic | Vessel, simple LIVE affix |
| 4 | Rare | Vessel + Trace, simple core |
| 5 | Rare | thêm Hero Soul core nếu có `soul_hero` |
| 6–9 | Epic | policy cho cả 3 slot + toàn bộ LIVE affix |
| 10–20 | Legendary | cùng surface, cap rarity tăng |
| 21–40 | Crystal | cùng surface |
| 41–70 | Mythic | cùng surface |
| 71–100 | Eternal | cùng surface |

Malformed/tampered policy fail về Normal material. Direct caller bỏ hẳn policy giữ legacy unrestricted behavior để tương thích; guaranteed authored reward đang đi đường này.

### 13.2 Auxiliary equipment

| Slot | Equip unlock | Primary | Random LIVE affix pool |
|---|---:|---|---|
| Vessel | L2 | HP flat `8–18` | HP%, damage reduction, health regen — 3 ID |
| Trace | L4 | Damage flat `1–3` | damage% — 1 ID |
| Focus | L7 | Mana flat `5–14` | Mana%, Mana regen, cooldown, efficiency — 4 ID |

Rarity yêu cầu affix count `[0,1,2,3,4,4,4,5]`. Generator cần unique LIVE IDs và downgrade rarity nếu pool không đủ:

- Trace random tối đa **Magic**;
- Vessel random tối đa **Epic**;
- Focus random tối đa **Mythic**;
- Eternal auxiliary random không thể giữ Eternal vì không slot nào có 5 LIVE affix.

Stage rarity cap vì vậy là trần request, không phải rarity item thực tế. Với pool hiện tại, người chơi late game sẽ thấy Trace tiếp tục Magic và Vessel dừng Epic dù source roll cao.

Policy cho Focus từ stage 6 nhưng equip unlock ở account L7. Guaranteed L6 reward đồng thời cho item level 7 và `+1 level`, nên đường tutorial hoạt động; random Focus stage6 có thể rơi trước khi người chơi equip được.

### 13.3 Hero Soul

Rarity Normal→Eternal có affix slots `0→7`. Weapon damage percent:

```text
weapon% = rarity_base[100,108,122,140,162,188,218,252]
          + .75 × (itemLevel - 1)
```

Ví dụ:

- Normal L1 `100%`;
- Rare L9 `128%`;
- Epic L10 `146.75%`;
- Eternal L100 `326.25%`.

Weapon% là unique multiplier. Core/action/cooldown/defense affix có cap lần lượt khoảng `50% / 60% / 35% / 50%`.

Fusion dùng `3` Soul cùng rarity/Hero; cost = `2 × tổng sell value`; output lên một rarity, item level bằng max input. Sell base dùng rarity weights `1,3,9,27,81,243,729,2187` và `+1%/item level`. Salvage material = `2^rarityIndex`.

Monster Soul có schema/bond/fusion-adjacent rules nhưng hiện không được Hero combat projection đọc để tạo power. Không tính Monster Soul catalog như combat stat LIVE.

### 13.4 Drop/RNG chính

Baseline world rarity `%` Normal→Eternal:

```text
68 / 20 / 8 / 3 / .78 / .17 / .045 / .005
```

Payload rarity:

```text
56 / 24 / 11 / 5.2 / 2.4 / .95 / .36 / .09
```

Role floor: standard Normal, elite Magic, miniboss Rare, boss Epic. Difficulty luck và rare multiplier làm nghiêng high tier; stage policy vẫn cap kết quả.

Random payload family theo rarity index `i`:

- Hero Soul `4.5% + 2.2%i`;
- equipment `30% + 3.5%i`;
- chest/boss/miniboss cộng thêm `5.5%` Hero Soul và `8%` equipment;
- phần còn lại material.

Nếu policy không cho family đã roll, payload đổi thành material thay vì reroll.

## 14. Probe reward deterministic Chapter 1

Probe load thẳng reward resource và gọi chính `create_item_instance()/to_summary()` của runtime.

### 14.1 Auxiliary rewards

| Reward | Primary LIVE | Affix roll | Tình trạng thật |
|---|---|---|---|
| L1 Magic Vessel L2 | `+11.30 HP` | `+0.33% max HP/s health regen` | Cả hai LIVE; reward bypass simple stage pool và giới thiệu regen sớm |
| L3 Magic Trace L4 | `+1.56 flat damage` | `+8.33% critical damage` | Primary LIVE; affix **INERT** |
| L6 Magic Focus L7 | `+8.73 Mana` | `+5.25% cooldown recovery` | Cả hai LIVE |
| L8 Epic Trace L8 | `+1.68 flat damage` | `+16.11% crit damage`, `+4.31% attack speed`, `+2.15% crit chance` | Primary LIVE; cả 3 affix **INERT** |

Nguyên nhân: guaranteed reward gọi Auxiliary generator không truyền `allowed_affix_ids`, nên lấy full authored catalog, trong khi random progressive loot chỉ lấy LIVE intersection.

Epic L8 nhìn như reward build lớn nhưng gameplay hiện chỉ nhận `+1.68 flat damage`. Đây là lỗi reward integrity, không phải vấn đề tooltip nhỏ.

### 14.2 Hero Soul rewards

| Reward | Weapon | Affix deterministic | LIVE |
|---|---:|---|---|
| L5 Archer Normal L1 pickup | 100% | 0 affix | Hero unlock + `soul_hero/soul_relay` LIVE |
| L9 Sword Rare L9 | 128% | `3.79% defense while attacking`, `7.54% active power` | Có |
| L10 Sword Epic L10 | 146.75% | `9.24% defense`, `5.8% active cooldown`, `10.4% melee damage` | Có |

Hero Soul deterministic L9/L10 hiện roll trúng LIVE IDs. Tuy nhiên reward chỉ khóa seed, không khóa explicit affix list; thay đổi catalog/RNG order có thể đổi build của reward cũ.

## 15. First-clear economy Chapter 1

| L | Account currency | Hero materials | Monster fragments | Reward nổi bật |
|---:|---:|---:|---:|---|
| 1 | 120 | 2 | 0 | Magic Vessel L2, 2 Bone Shard |
| 2 | 160 | 3 | 0 | 3 Bone Shard |
| 3 | 220 | 4 | 1 | Magic Trace L4, Reaper Essence |
| 4 | 280 | 5 | 2 | 4 Bone Shard |
| 5 | 400 | 8 | 4 | Blood Crucible Blueprint; physical Archer Soul pickup riêng |
| 6 | 480 | 10 | 4 | Magic Focus L7 |
| 7 | 560 | 12 | 5 | progression currency/material |
| 8 | 680 | 15 | 6 | Epic Trace L8 |
| 9 | 820 | 18 | 8 | Rare Sword Soul L9 |
| 10 | 1,200 | 25 | 12 | Epic Sword Soul L10 |

Cumulative first-clear: `4,920` account currency, `102` Hero materials, `42` Monster fragments, cộng 10 level. Reward transaction idempotent nên replay/reload không nhân đôi.

Audit này chưa tuyên bố economy sink/source cân bằng dài hạn; hiện mới có các contract sell/fusion/respec và Chapter 1 source rõ ràng.

## 16. Outcome breakpoint đã được regression khóa

Artifact: `.artifacts/chapter_1_balance_matrix_report.json`, `ok=true`, `536 checks`.

| Scenario | Enemy HP | Sword cycle | Hits kill / TTK | Incoming | Player HP | Hits die |
|---|---:|---:|---:|---:|---:|---:|
| L1 Skeleton Easy | 70 | 104 | 4 / 1.48s | 14 | 100 | 8 |
| L2 Skeleton Easy | 84 | 109 | 4 / 1.48s | 15 | 120 | 8 |
| L3 Reaper Easy | 120 | 114 | 5 / 1.94s | 15 | 139.8 | 10 |
| L3 +5 DMG | 120 | 125 | 4 / 1.48s | 15 | 139.8 | 10 |
| L3 +5 HP | 120 | 114 | 5 / 1.94s | 15 | 209.107 | 14 |
| L3 +15 DMG | 120 | 145 | 4 / 1.48s | 15 | 139.8 | 10 |
| L3 Hard +5 DMG | 210 | 125 | 8 / 3.32s | 24 | 139.8 | 6 |

Giải thích:

- +5 DMG tạo breakpoint rõ: 5 hit → 4 hit.
- +15 DMG vẫn 4 hit; 10 điểm thêm chưa tạo hit-count benefit ở target này. Đây là plateau tự nhiên của discrete hit, không phải điểm bị mất.
- +5 HP tăng 10 → 14 hit sống sót.
- Hard tăng TTK mạnh và giảm survival rõ.

Mana L3 trong cửa sổ 180s:

| Build | Max Mana | Cost / CD / regen | Casts | Casts/min |
|---|---:|---|---:|---:|
| Base | 119.9 | 32 / 12s / 2s⁻¹ | 14 | 4.667 |
| +5 Mana | 154.553457 | như trên | 16 | 5.333 |

Đây là bằng chứng early stat choices tạo outcome khác nhau. Matrix chưa khóa outcome L4–L100, boss TTK theo build tier, realized XP per run hay late-game item ceiling.

## 17. Risk register ưu tiên

### P0 — phải xử lý trước khi tuning thêm content

1. **XP authority không parity**
   
   Matrix/canonical divisor và actor live score scaling/population override đang đo hai hệ khác nhau. Nếu tiếp tục chỉnh XP dựa trên matrix, live có thể đi ngược kết luận.

2. **Guaranteed reward có stat chết**
   
   L3 Trace có affix inert; L8 Epic Trace có ba affix inert. Reward cao trào đang quảng cáo power không tồn tại.

3. **Enemy stat catalog không phải runtime authority**
   
   Thêm enemy bằng `EnemyDefinition` chưa đủ; scene script vẫn giữ HP/damage/timing. Đây là blocker trực tiếp của yêu cầu mở rộng dài hạn.

4. **Hero numeric authority bị chia**
   
   Axe Hero resource và Weapon resource cho hai kit số khác nhau; Sword WeaponDefinition cũng chứa combo legacy không route. Tool/UI có nguy cơ đọc nhầm.

### P1 — cần xử lý trước khi gọi Chapter 1/late game cân production

5. **Elite x3 thực tế có thể gần 9x throughput** nhưng XP metadata không recompute sau elite ở L8/L9.
6. **Skill Point surplus**: ba Hero không tiêu hết pool; từ L11 choice skill gần như biến mất nếu max mọi gate.
7. **Auxiliary rarity ceiling**: Trace dừng Magic, Vessel Epic, Focus Mythic; rarity cap UI không phản ánh item achievable.
8. **Late-game formula chưa outcome-test**: population, TTK, boss, resource uptime, drop time-to-build và XP/run L11–L100 chưa có production evidence.
9. **Hai density path**: pack-model và non-pack legacy spawn quantity có semantics khác nhau.

### P2 — debt/UX clarity

10. Focus policy xuất hiện stage6 nhưng equip L7; guaranteed path tự giải quyết, random path có một-level wait.
11. Không có Stat respec trong khi Skill respec miễn phí sớm; allocation sai có thể tạo cảm giác bị khóa.
12. Surge/milestone catalogs inert vẫn nằm cạnh live constants, dễ làm designer/tool đọc nhầm.
13. Nested action rounding cần convention rõ nếu sau này thêm DoT/multi-hit rất nhỏ.
14. Global Dodge/Attack Speed/Crit caps chưa có consumer nhưng item catalog vẫn có các affix tương ứng.

## 18. Những gì hiện đang làm đúng

- Một Resolver có named breakdown và fail-closed input.
- Stage/stat curve không có exception theo level hay forced surge.
- Stat point diminishing return trơn, luôn hữu ích, không có cliff.
- Người chưa hiểu build vẫn mạnh lên và sống lâu hơn; người hiểu build tìm được damage/resource breakpoint.
- Early L1–L3 đã có outcome gate cụ thể thay vì chỉ so tổng power score.
- Random progressive loot không roll affix không LIVE.
- Hero Soul selected instance là authority; flag `equipped` giả không tự kích hoạt power.
- First-clear reward/save transaction chống duplicate.
- Difficulty family boost không mở family đang bị lesson gate khóa.
- Mutant bị khóa trước stage 4, complexity tăng theo bài học.

## 19. Kết luận cuối

Phần **toán lõi** hiện tại đã đi đúng hướng người dùng yêu cầu: quan hệ giữa level, stat, enemy, action và gear có logic; không cần patch riêng theo từng level để tạo số mong muốn. Người không hiểu toàn bộ vẫn có safety từ HP growth, còn người hiểu build nhận breakpoint thật từ DMG/HP/Mana.

Phần chưa đạt yêu cầu dài hạn nằm ở **authority và integration**, không phải vì thiếu thêm công thức:

- một số resource không phải nguồn số gameplay thật;
- XP laboratory chưa mô phỏng actor live;
- guaranteed reward đi vòng qua LIVE-affix filter;
- elite, skill pool và late-game bands chưa được outcome khóa.

Vì vậy không nên thêm tiếp item/chapter rồi cân bằng bằng mắt trên nền này. Bước hợp lý kế tiếp là làm cho một nguồn số duy nhất thật sự lái Enemy/Hero/reward/XP simulation, sau đó mở outcome matrix theo band và boss. Khi parity đó xong, việc thêm item, Hero Soul, Hero, level và chapter mới mới đúng nghĩa “thêm data vào lõi” thay vì phải làm lại.

## 20. Evidence

- Core audit trước: `docs/AUDIT_CORE_BALANCE_V1_2026_07_16.md`
- Machine-readable early matrix: `.artifacts/chapter_1_balance_matrix_report.json`
- Combat resolver report: `.artifacts/combat_resolver_report.json`
- Enemy outgoing report: `.artifacts/enemy_outgoing_damage_report.json`
- Progression report: `.artifacts/player_progression_save_report.json`
- Skill runtime report: `.artifacts/hero_skill_live_runtime_report.json`
- Auxiliary combat report: `.artifacts/auxiliary_equipment_combat_report.json`
- Realtime loot report: `.artifacts/realtime_loot_report.json`
- Full checkpoint regression: 62 PowerShell suites + input map, no observed failure; 38 JSON reports parsed without failure at Core Balance V1 checkpoint.
