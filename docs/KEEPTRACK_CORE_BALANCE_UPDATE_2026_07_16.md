# KEEPTRACK hậu cập nhật — lõi sát thương, thông số, XP và dungeon

**Ngày chốt:** 2026-07-16  
**Trạng thái:** SUPERSEDED AS CURRENT BALANCE SNAPSHOT  
**Phạm vi:** code, resource, save migration và runtime test thật; không phải bản ý tưởng.

> Tài liệu này là bằng chứng của đợt Core Balance trước. Từ cập nhật Power,
> mô tả Level/Stat/player damage và verdict hiện hành nằm tại
> `docs/KEEPTRACK_POWER_LEVEL_REBALANCE_2026_07_16.md`. Không dùng các bảng
> `DMG level growth` bên dưới để cân content mới.

Audit trước cập nhật được giữ tại
`docs/AUDIT_VAN_HANH_CON_SO_HIEN_TAI_2026_07_16.md`. File đó đã được gắn nhãn
`PRE-UPDATE` và chỉ còn dùng làm bằng chứng before.

## 1. Kết luận dễ hiểu trước

Nhận xét ban đầu là **đúng**: vấn đề lớn nhất không phải thiếu thêm công thức,
mà là một số con số có nhiều nguồn, hoặc laboratory và gameplay dùng hai đường
khác nhau. Khi đó chỉnh một nơi chưa chắc game đổi; càng thêm content càng dễ
lệch.

Đợt này đã cập nhật thật sáu blocker chính:

1. Enemy data trở thành nguồn stat runtime, thay vì chỉ là catalog để nhìn.
2. XP dùng đúng population của level đang chơi và chỉ chốt sau modifier cuối.
3. Elite bỏ scalar “x3” gây gần `9x` sustained DPS; thay bằng các trục riêng.
4. Guaranteed reward không còn được phép trao affix không có tác dụng.
5. Axe chỉ còn một nguồn số cho Heavy Cleave và Throw & Recall.
6. Skill Point trở thành ngân sách specialization, không còn dư đến mức max hết.

Triết lý vận hành sau cập nhật là:

- người chưa hiểu build vẫn mạnh lên tự nhiên nhờ level;
- mỗi điểm Stat luôn có ích, không có mốc ẩn buộc phải tra wiki;
- người hiểu build vẫn tạo được breakpoint thật về số hit, Mana và cooldown;
- enemy chỉ scale theo stage/difficulty đã chọn, **không đọc gear hay allocation
  của người chơi để rubber-band**; vì vậy build tốt tạo lợi thế thật;
- content mới đi vào các authority chung, không thêm một nhánh công thức riêng để
  ép ra kết quả mong muốn.

Automation chứng minh tính nhất quán của code. Nó chưa thể tự chứng minh “vui”
hay retention dài hạn; phần đó vẫn cần playtest người thật.

## 2. Một đường vận hành duy nhất

```mermaid
flowchart LR
    A["Definition / authored data"] --> B["Typed runtime snapshot"]
    B --> C["Stage + difficulty"]
    C --> D["Mutant / Elite / item / Soul / skill"]
    D --> E["CombatResolver"]
    E --> F["HP, hit, kill và resource outcome"]
    F --> G["XP, loot, telemetry và save receipt"]
```

Quy tắc quan trọng:

- baseline chỉ được đọc một lần từ definition;
- projection stage/difficulty chạy đúng một lần;
- modifier về sau phải đánh dấu revision thay đổi;
- XP chỉ hợp lệ nếu được finalize trên đúng combat revision và đúng encounter
  plan signature;
- input thiếu hoặc mâu thuẫn thì fail-closed, không đoán một con số thay thế.

## 3. Damage đang chạy thế nào

`CombatResolver` vẫn là authority của một hit:

```text
(base + tổng flat)
× (1 + tổng additive% / 100)
× action multiplier
× tích các unique multiplier
× variance
× critical
× tích damage-taken multiplier
× defense multiplier
→ round một lần ở cuối request
```

Defense:

```text
effectiveDefense = max(0, rating × (1 - percentPen / 100) - flatPen)
damageReduction  = effectiveDefense / (effectiveDefense + 100)
damageMultiplier = 1 - damageReduction
```

Ví dụ `50 defense` giảm `33,33%`; `100 defense` giảm `50%`. Penetration phần trăm
chạy trước penetration phẳng và không thể biến giáp âm thành bonus damage.

Projection Hero, viết gọn:

```text
HP = (base + level flat + allocated flat + auxiliary flat)
     × (1 + auxiliary HP%) × selected Soul HP multiplier

Mana = (base + level flat + allocated flat + auxiliary flat)
       × (1 + auxiliary Mana%) × selected Soul Mana multiplier

Damage = (Hero base + auxiliary flat)
         × (1 + level% + allocated% + auxiliary% + Soul core%)
         × Soul weapon multiplier
         × action multiplier × skill-rank multiplier × Soul action multiplier
```

Level/stat/gear tạo các lớp có tên, không lén cộng một “power score” tổng rồi
quy đổi ngược thành damage.

## 4. Level, HP, DMG và Mana

Với `L` từ 1 đến 100 và `n = L - 1`:

```text
G(L) = (1 - 0,99^n) / 0,01

HP level growth   = 20 × G(L) flat
DMG level growth  =  5 × G(L) percentage-points
Mana level growth = 10 × G(L) flat
```

Mỗi level mới trả đúng `99%` marginal của level trước. Không có surge hay bước
nhảy bí mật ở level chia hết cho 5/10.

| L | XP sang level kế | Tổng XP thuần để vào L | Stat Point | Skill Point | HP chưa build | Core DMG chưa build | Mana chưa build |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 0 | 5 | 2 | 100,000 | 20,000 | 100,000 |
| 2 | 128 | 100 | 10 | 4 | 120,000 | 21,000 | 110,000 |
| 3 | 157 | 228 | 15 | 6 | 139,800 | 21,990 | 119,900 |
| 5 | 219 | 573 | 25 | 10 | 178,808 | 23,940 | 139,404 |
| 6 | 251 | 792 | 30 | 12 | 198,020 | 24,901 | 149,010 |
| 10 | 383 | 1.991 | 50 | 20 | 272,966 | 28,648 | 186,483 |
| 20 | 734 | 7.379 | 100 | 40 | 447,663 | 37,383 | 273,831 |
| 40 | 1.496 | 29.193 | 200 | 80 | 748,542 | 52,427 | 424,271 |
| 70 | 2.736 | 91.811 | 350 | 140 | 1.100,326 | 70,016 | 600,163 |
| 100 | 0 | 192.872 | 500 | 200 | 1.360,541 | 83,027 | 730,270 |

Enemy stage HP dùng cùng tỷ lệ với player base HP; enemy stage damage dùng cùng
tỷ lệ với player base damage. Allocation, item và Soul **không** được copy sang
enemy. Đây là cách giữ safety floor cho người mới mà không xóa phần thưởng của
người build giỏi.

## 5. Stat Point: đơn giản nhưng vẫn có lựa chọn

- `5` điểm mỗi level, L100 có `500`.
- Ba stat: HP, Damage, Mana.
- Mỗi stat cap `200`; tổng capacity `600`, lớn hơn pool `500`, nên không thể max
  cả ba.
- Không có milestone sức mạnh ẩn. Catalog milestone V0.4 chỉ còn compatibility.

Lợi ích của điểm thứ `k`, với `k=1..200`:

```text
marginal(k) = initial / (1 + (k - 1) / 199)

initial HP / DMG / Mana = 14 flat / 2 percentage-points / 7 flat
```

| Điểm | Marginal HP | Marginal DMG pp | Marginal Mana |
|---:|---:|---:|---:|
| 1 | 14,000 | 2,000 | 7,000 |
| 50 | 11,234 | 1,605 | 5,617 |
| 100 | 9,349 | 1,336 | 4,674 |
| 150 | 8,006 | 1,144 | 4,003 |
| 200 | 7,000 | 1,000 | 3,500 |

Điểm 200 vẫn bằng đúng một nửa điểm 1: luôn có ích nhưng việc dồn hết vào một
stat ngày càng phải trả opportunity cost cao hơn. Đây là diminishing return tự
nhiên, không phải cap mềm bị ép bằng các if/else theo tier.

Outcome early-game đã khóa bằng matrix:

- L3 Reaper Easy, build base: `5 hit`, TTK khoảng `1,94s`;
- cộng 5 Damage: `4 hit`, TTK khoảng `1,48s`;
- cộng 5 HP: số hit sống sót tăng `10 → 14`;
- cộng 5 Mana: số active cast trong cửa sổ 180 giây tăng `14 → 16`.

## 6. Skill Point: từ checklist thành specialization

Before: `5` Skill Point/level, L100 có `500`. Ba Hero code-live chỉ có
`3 × 6 × 20 = 360` rank capacity; campaign hai-Hero còn thấp hơn. Người chơi có
thể max mọi thứ đang mở và vẫn dư điểm, nên lựa chọn build biến mất.

After:

```text
earnedSkillPoints(L) = 2 × clamp(L, 0, 100)
rankGate(L) = clamp(ceil(L / 5), 1, 20)
capacity = heroCount × 6 track × rankGate
maximumSpendable = min(earned, capacity)
```

| L | Rank gate/track | Điểm kiếm được | Capacity 1 Hero | Capacity 2 Hero | Gap 2 Hero |
|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 2 | 6 | 12 | 10 |
| 5 | 1 | 10 | 6 | 12 | 2 |
| 6 | 2 | 12 | 12 | 24 | 12 |
| 10 | 2 | 20 | 12 | 24 | 4 |
| 25 | 5 | 50 | 30 | 60 | 10 |
| 50 | 10 | 100 | 60 | 120 | 20 |
| 100 | 20 | 200 | 120 | 240 | 40 |

UI Skill mở ở L6: người chơi có 12 điểm trước 24 lựa chọn đang hợp lệ. Đây là
lúc bắt đầu specialization, nhưng họ vẫn có thể chơi được dù chưa hiểu hết.

Ở L100, một Hero có thể full `120`; còn `80` cho reserve. Thêm Hero mới chỉ thêm
capacity/lựa chọn, không mint điểm và không cần retune đường 1–100.

Save migration:

- allocation cũ `<=` budget mới được giữ nguyên;
- allocation vượt budget được archive nguyên bản vào
  `legacy_audit.skill_allocations_pre_specialization`;
- profile nhận full respec miễn phí, điểm unspent tự derive lại từ level;
- marker `skill_economy_version=2` làm migration idempotent;
- respec Skill miễn phí đến L20, sau đó theo `min(2500, 100 + 25L)`.

Không cắt ngầm vài rank ngẫu nhiên vì cách đó có thể phá build mà người chơi
không biết lý do.

## 7. Enemy: data thật sự lái gameplay

Before, `EnemyDefinition` chứa số nhưng Main instantiate scene/controller có bộ
số riêng. Resource chủ yếu cấp role tag. Sửa data có thể không đổi actor live.

After:

1. Registry resolve canonical definition bằng `enemy_definition_id` hoặc layout
   alias.
2. `EnemyRuntimeConfigurator.instantiate_bound()` tạo actor và bind typed
   `EnemyRuntimeSnapshot` trước `_ready()`.
3. JSON chỉ thêm position/patrol/context.
4. Actor vào tree.
5. Stage/difficulty chạy đúng một lần.
6. Special runtime mới áp Elite/objective modifier.

Main không còn bảng enemy scene/type hardcode. Density và mutant đọc trực tiếp
từ `density_eligible` của definition. Đổi canonical definition khi hot-reload sẽ
thay actor, không rebind một actor đã scale.

Base số hiện tại trước stage/difficulty:

| Enemy | HP | Damage base | Move/chase | Attack range | Awareness | Cooldown | Score | Density |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Skeleton Swordsman | 70 | 14 | 58 | 38 | 184 | 0,85 | 100 | có |
| Bone Reaper | 86 | 14 | 48 | 188 | 205 | 2,10 | 150 | có |
| Blood Vampire | 112 | 16 | 70 | 118 | 215 | 1,85 | 190 | có |
| Bone Reaper Captain | 258 | 18 | 52 | 204 | 230 | 1,80 | 650 | không |
| Hooded Archer miniboss | 360 | 12 | 72 | 360 | 360 | 0,85 | 650 | không |
| Crimson Reaper trước promotion | 86 | 14 | 48 | 188 | 205 | 2,10 | 150 | không |
| Vampire Castellan | 720 | 14 | 58 | 270 | 560 | 1,55 | 1.800 | không |

Boss nhiều chiêu vẫn giữ identity bằng ratio có tên thay vì hardcode một bộ base
thứ hai. Ví dụ Archer `12/18/20`; Castellan lấy base 14 rồi sinh phase lunge
`14/16`, lane `18`, disc `10` theo ratio. Đổi base làm toàn bộ family thay đổi có
chủ đích.

Thêm enemy mới cần definition + scene/controller hỗ trợ snapshot + đăng ký
resource. Không cần sửa Main, population algorithm hay XP formula.

## 8. Stage, difficulty, Mutant và Elite

Stage:

```text
stageHP    = (100 + 20 × G(stage)) / 100
stageDMG   = 1 + (5 × G(stage)) / 100
stageSpeed = 1 + min(0.30, 0.006 × (stage - 1))
```

Difficulty nhân bên ngoài stage:

| Mode | HP | Damage | Speed | Mutant chance từ L4 |
|---|---:|---:|---:|---:|
| Easy | 1,00 | 1,00 | 1,00 | 3% |
| Medium | 1,35 | 1,25 | 1,08 | 10% |
| Hard | 1,75 | 1,55 | 1,15 | 20% |

Mutant bị khóa trước stage 4. Khi mở:

- HP `×1,40`;
- damage `×1,25`;
- speed `×1,08`;
- score/threat được recompute sau modifier.

Elite before dùng một scalar 3 cho cả damage và attack cadence. Damage `×3` đồng
thời cooldown `/3` tạo sustained DPS gần `×9`, dù copy chỉ nói “x3”.

Elite after dùng các trục:

| Trục | Multiplier |
|---|---:|
| HP | 2,25 |
| Damage mỗi hit | 1,35 |
| Attack rate | 1,15 |
| Movement | 1,08 |
| Range | 1,05 |
| Reward score | 2,50 |
| Sustained DPS hợp thành | **1,5525** |

Elite vì vậy đọc chủ yếu là một trận lâu hơn và ép vị trí hơn, không phải một
cú one-shot cộng với cadence vô lý. Ở cùng normal actor, reward XP mục tiêu tăng
theo khoảng `sqrt(2,5) = 1,581×`, kể cả khi chạm clamp thường.

## 9. Dungeon population và độ phức tạp

Campaign pack model là authority của số quái. Level author camp/anchor an toàn;
rules quyết định pack, member, family và difficulty pressure.

| Level | Easy | Medium | Hard | Ghi chú |
|---:|---:|---:|---:|---|
| 1 | 15 | 18 | 18 | Skeleton lesson |
| 2 | 18 | 21 | 21 | tăng density trước khi thêm family |
| 3 | 21 | 24 | 24 | bắt đầu Reaper |
| 4 | 24 | 30 | 30 | Mutant/Rare bắt đầu có nghĩa |
| 5 | 30 | 36 | 36 | thêm Vampire nhỏ + miniboss riêng |
| 6 | 36 | 42 | 42 | pack đông nhất trước objective-heavy arc |
| 7 | 21 | 24 | 24 | override 1 floor + Beacon/wave |
| 8 | 21 | 24 | 24 | branch guardian Elite riêng |
| 9 | 24 | 27 | 27 | Crimson Gate Elite riêng |
| 10 | 16 | 18 | 18 | duel/boss objective riêng |

L7–L10 ít regular pack hơn là có chủ ý vì objective/boss gánh phần pressure còn
lại. Điểm đã sửa là XP divisor giờ dùng đúng plan riêng này, không dùng nhầm
population 3-floor generic `42/48/54/63`.

Family ramp cũng tăng dần: L1–L2 chỉ Skeleton; L3 mới có Reaper; L5 mới có
Vampire; đến L10 ba family mới gần cân nhau. Người chơi học từng biến trước khi
phải tối ưu cùng lúc.

## 10. XP và tốc độ lên level

XP cần cho bucket hiện tại:

```text
XPRequired(L) = 0                                      nếu L = 100
XPRequired(L) = 100 + 25(L-1) + floor(3(L-1)^1.35)   nếu L < 100
```

Kill XP là nhịp phụ; first-clear Chapter 1 vẫn grant trực tiếp `+1 level` đúng
một lần. Hoàn thành L1–L10 từ profile mới bảo đảm ít nhất tới L11, chưa tính kill
XP.

Per-run XP contract:

```text
ordinaryBudget = 15% × XP bucket của stage
ordinaryBasePerKill = ordinaryBudget / population Easy riêng của level
bossBase = 10% × XP bucket

threatWeight = clamp(sqrt(finalScore / referenceScore), 0,65, 1,75)
referenceScore = 100 regular / 650 boss
rewardUnits = basePerKill × threatWeight
```

`finalScore` được đọc sau stage, difficulty, mutant và Elite. Population context
chứa revision + SHA-256 plan signature và so realized population với expected
population. Thiếu/sai context trả `0 XP`, không fallback sang divisor đoán.

Reward lẻ dùng carry:

```text
wholeXP = floor(carry + rewardUnits)
nextCarry = carry + rewardUnits - wholeXP
```

Vì vậy 30 enemy trả tổng gần đúng ngân sách, không bị `ceil` từng enemy thành
30 XP giả.

Matrix actor regular tham chiếu:

| L | Easy/Hard pop | Easy reference | Hard reference | Easy live | Hard live |
|---:|---:|---:|---:|---:|---:|
| 1 | 15 / 18 | 15,00% | 18,00% | 15,00% | 23,12% |
| 2 | 18 / 21 | 15,00% | 17,50% | 15,87% | 23,80% |
| 3 | 21 / 24 | 15,00% | 17,14% | 16,70% | 24,48% |
| 4 | 24 / 30 | 15,00% | 18,75% | 17,43% | 28,00% |
| 5 | 30 / 36 | 15,00% | 18,00% | 18,12% | 27,94% |
| 6 | 36 / 42 | 15,00% | 17,50% | 18,79% | 28,16% |
| 7 | 21 / 24 | 15,00% | 17,14% | 19,38% | 28,48% |
| 8 | 21 / 24 | 15,00% | 17,14% | 20,01% | 29,34% |
| 9 | 24 / 27 | 15,00% | 16,88% | 20,57% | 29,53% |
| 10 | 16 / 18 | 15,00% | 16,88% | 21,11% | 29,53% |

`reference` đo population thuần. `live` cao hơn vì actor đã thật sự nguy hiểm
hơn theo stage/difficulty. Hard trả thêm vì có cả density và risk; không chỉ đổi
màu enemy. Boss/objective XP nằm ngoài ordinary row và first-clear level vẫn là
nhịp chính.

## 11. Guaranteed reward: nhìn mạnh thì phải mạnh thật

Before:

- L3 Magic Trace roll `critical_damage` không có consumer live;
- L8 Epic Trace roll crit damage, attack speed và crit chance đều inert;
- L8 thực tế chỉ có primary `+1,68 damage` hoạt động.

After, mọi guaranteed auxiliary grant bắt buộc có:

- lowercase UUID ổn định dạng `8-4-4-4-12`;
- explicit affix recipe;
- đúng số affix theo rarity;
- không trùng, đúng slot và nằm trong `live_affix_ids(slot)`;
- contract sai thì validation fail và `create_item_instance()` trả `{}`.

| Level | Reward hiện tại | Affix LIVE cố định | Stable entitlement UUID |
|---:|---|---|---|
| 1 | Magic Vessel L2 | `health_regen` | `fba8e191-1d1e-ee33-4c24-13a374822f17` |
| 3 | Magic Trace L4 | `damage_percent` | `43986abd-1311-8633-c8ff-90139b2d74a2` |
| 6 | Magic Focus L7 | `cooldown_rate` | `516d1291-7d9a-ab52-7784-10b69b55b2b0` |
| 8 | Epic Vessel L8 | `max_hp_percent`, `damage_reduction`, `health_regen` | `5444fa20-0680-b49a-dbb5-4a553e46a8b1` |

UUID entitlement không phụ thuộc seed/catalog. Profile cũ có L8 Trace cùng UUID
được thay tại chỗ thành Vessel, giữ favorite/locked; equip chỉ chuyển nếu slot
đích đã mở và trống. Không tạo item thứ hai.

Thêm affix mới vẫn được phép, nhưng guaranteed reward không thể dùng nó trước
khi có consumer runtime thật. Đây là guardrail khiến mở rộng content không quảng
cáo power giả.

## 12. Axe: một nguồn action number

Before có hai bộ số:

- Hero resource: chain `[20,24,36]`, charge 1 giây/+60%, cooldown 8 giây,
  Cross Cut +50% damage;
- gameplay Weapon resource: Heavy `30→60`, charge 1,15 giây, cooldown 6,5,
  Cross Cut +stagger.

After, `axe_hero.tres` chỉ giữ identity, readiness, Summon và Departure; field
`primary_weapon` trỏ tới `axe.tres`. Knight và HUD đọc các accessor resolved.

Canonical Axe live:

- Heavy Cleave: `30 → 60` damage theo charge `0 → 1,15s`;
- arc `70° → 150°`;
- stagger `20 → 45`;
- action `0,44s`, hit window `0,16–0,32s`;
- Throw & Recall: `26` outbound + `26` return;
- cooldown `6,5s`, Mana `24`;
- speed outbound/return `340/470`, auto recall `1,4s`;
- Cross Cut cộng `28 stagger`, không có phantom bonus damage;
- Recall không tốn Mana lần hai.

Đổi số trong canonical Weapon profile đi tới Hero-facing accessor, Knight action
và HUD; không còn một bộ Axe local cạnh tranh.

## 13. Before → after ở mức kiến trúc

| Vấn đề | Before | After |
|---|---|---|
| Enemy authority | resource và controller khác số | typed snapshot bind trước `_ready()` |
| Main enemy onboarding | sửa scene/type arrays trong Main | registry alias + definition scene |
| XP population | divisor generic, L7–L10 lệch live | level plan + realized count + signature |
| XP modifier order | chốt trước Elite | combat revision, finalize sau modifier cuối |
| Elite | một scalar gây gần 9x DPS | sáu trục, DPS 1,5525x |
| Skill economy | 500 point, max hết và dư | 200 point trước 240 minimum capacity |
| Axe | Hero/Weapon hai bộ số | Weapon profile là action authority |
| Guaranteed affix | seed vào full catalog | explicit LIVE recipe, fail-closed |
| Reward migration | tuning có thể duplicate | stable UUID, replace entitlement in-place |

## 14. Cách thêm content từ đây

### Thêm enemy

Tạo `EnemyDefinition`, scene/controller nhận snapshot, khai báo layout aliases và
`density_eligible`, rồi thêm resource vào registry. Main, difficulty, XP và pack
population không cần branch theo tên enemy.

### Thêm level/chapter

Author map JSON + `encounter_pack_model`, combat camps/objective và registry
entry. Population projection tạo plan; Main materialize cùng plan; XP ký đúng
plan đó. Không viết divisor XP riêng theo level.

### Thêm item/affix

Thêm definition và consumer có test. Chỉ sau khi ID xuất hiện trong LIVE pool,
guaranteed recipe mới hợp lệ. Random progressive loot cũng lấy giao của policy
với LIVE pool.

### Thêm Hero/Hero Soul

Skill curve không đổi: Hero mới thêm capacity chứ không thêm point. Kit dùng
`HeroDefinition`; normal/active có thể dùng typed `WeaponDefinition`, như Axe.
Unique behavior mới vẫn cần handler và presentation riêng—đó là content code có
ý nghĩa, không phải viết lại HP/DMG/Mana/XP algorithms.

### Thêm difficulty modifier

Modifier phải khai báo trục combat, tăng combat revision, rồi finalize reward.
Không được thay một scalar mơ hồ vào cả damage lẫn cadence.

## 15. Verification hậu cập nhật

Focused gates trên snapshot cuối:

| Gate | Kết quả |
|---|---:|
| Player progression rules | 321/321 |
| Player progression save/migration | 65/65 |
| Main enemy authority integration | 104/104 |
| Enemy definition runtime authority | 179/179 |
| Content contracts | 208/208 |
| Encounter pack/trap | 1.044/1.044 |
| Progression/difficulty | 191/191 |
| Chapter 1 balance matrix | 582/582 |
| Campaign reward | 59/59 |
| Campaign entitlement hardening | 63/63 |
| Axe combined suite | 231/231 |
| Axe Soul Team runtime | 18/18 |
| Mana/meta | 77/77 |
| Already-playable QA | 40/40, Relay soak 100/100 |
| Combat feedback | 33/33 |
| Gameplay click + auto-pickup | exit 0 |
| Input map | exit 0 |

`run_full_regression.ps1 -SkipMcp` có `63` PowerShell suites. Aggregate cuối đã
đi qua toàn bộ suite và tìm thấy hai test harness dùng API/interaction cũ ở QA
Relay và click routing. Hai test được sửa theo contract runtime hiện hành, không
đổi production behavior; focused rerun sau sửa đều pass. Các suite trước đó đã
pass trên cùng production snapshot.

`living_arsenal_runtime_report.json` không thuộc full runner. Đây là contract
Bow/weapon legacy đã được `docs/QA_ALREADY_PLAYABLE_REPORT_2026_07_15.md` đánh
dấu retired trước đợt cập nhật này; không dùng report 23-check đó làm verdict
cho Hero Soul runtime hiện hành.

Machine-readable evidence chính:

- `.artifacts/chapter_1_balance_matrix_report.json` — 582 checks;
- `.artifacts/player_progression_save_report.json`;
- `.artifacts/main_enemy_authority_stdout.log`;
- `.artifacts/enemy_definition_runtime_authority_stdout.log`;
- `.artifacts/campaign_reward_report.json`;
- `.artifacts/already_playable_qa_report.json`.

## 16. Biên giới còn lại — không che giấu

1. L11–L100 có formula bands nhưng chưa có đủ authored map/boss/outcome test để
   gọi là production balance.
2. Sword/Archer vẫn dùng local fallback fields trong `HeroDefinition`; Axe là
   identity đầu tiên gom normal/active vào typed Weapon authority.
3. Thêm Hero hoàn toàn mới vẫn cần đăng ký identity ở một số UI/save mapping và
   viết unique behavior nếu kit mới; balance curve không cần làm lại.
4. Stat allocation hiện chưa có Stat respec, dù Skill respec đã có. Diminishing
   curve giảm nguy cơ “điểm chết”, nhưng đây vẫn là UX debt nên xử lý trước khi
   khóa economy production.
5. Crit/crit damage/attack speed/dodge còn catalog/compatibility nhưng chưa đồng
   bộ consumer action tempo/per-hit. Guaranteed reward đã bị chặn dùng chúng.
6. Random auxiliary rarity thực tế còn bị giới hạn bởi số affix LIVE unique của
   từng slot; mở rarity cao phải thêm consumer, không chỉ thêm tên stat.
7. Non-pack sandbox vẫn dùng legacy density semantics; campaign pack model là
   đường production được audit ở đây.
8. Automation không thay cho playtest. Cần đo completion time, death cause,
   allocation entropy, respec rate và replay conversion trước khi kết luận nhịp
   game đủ cuốn trong thực tế.

## 17. Verdict

Lõi sau cập nhật đã đạt mục tiêu quan trọng: **logic đi từ dữ liệu tới outcome
theo một đường có thể kiểm tra**, thay vì ép từng level/actor ra một con số đẹp.
Người mới có safety floor từ level; người hiểu game có specialization, breakpoint
và risk/reward thật; content mới không cần viết lại các đường HP/DMG/Mana/XP.

Đây là nền đủ chắc để tiếp tục thêm item, enemy và level mà không tune trên số
không tồn tại. Nó chưa phải tuyên bố toàn bộ Level 1–100 đã cân production; các
biên giới ở mục 16 phải tiếp tục được keeptrack sau mỗi update lớn.
