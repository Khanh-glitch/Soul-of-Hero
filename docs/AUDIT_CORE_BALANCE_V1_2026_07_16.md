# Audit keeptrack — Core Balance V1 (2026-07-16)

## Kết luận checkpoint

Đợt này thay đổi **runtime thật**, không chỉ viết design. Mục tiêu là biến damage,
HP, Mana, enemy HP/DMG scaling, XP budget, encounter pressure và loot disclosure
thành các contract toán học chung. Item, Hero Soul, enemy profile, level hay chapter
mới cung cấp dữ liệu có tên vào các contract đó; chúng không được tự tạo một công
thức sát thương hoặc growth curve thứ hai.

Phạm vi mở rộng được nói chính xác: content dùng mechanic đã có là data/catalog
registration. Một Hero hoàn toàn mới với animation, targeting hay Relay behavior
độc nhất vẫn cần một runtime module riêng; module đó được phép thêm hành vi nhưng
không được sửa lại damage resolver, stat curve, XP hay loot core. Đây là ranh giới
giữa “thêm content” và “phát minh mechanic mới”, không phải lời hứa rằng mọi hành
vi độc nhất đều có thể mô tả bằng vài con số.

Ba nguyên tắc khóa:

1. Một hit có đúng một pipeline, giữ full precision và round đúng một lần cuối.
2. Tăng trưởng tạo breakpoint có thể đo, không sửa số bằng exception theo level.
3. Độ phức tạp được mở dần; dữ liệu chưa có runtime consumer không được roll.

## 1. Damage authority

Nguồn canonical: `game/combat/combat_resolver.gd`, formula version `1`.

```text
(base + Σ flat)
× (1 + Σ additive% / 100)
× action
× Π unique
× variance
× critical
× Π target damage-taken
× defense multiplier
→ round once
```

- Các nguồn trong cùng bucket cộng với nhau; các layer độc lập nhân với nhau.
- Mọi source có tên và xuất hiện trong breakdown.
- Defense dùng diminishing return:
  `effective = max(0, rating × (1 - %pen) - flatPen)`;
  `DR = effective / (effective + K)`, mặc định `K = 100`.
- Variance bị chặn ở `±25%`; critical chance bị chặn `0–100%`.
- Runtime Hero, UI Arsenal và balance simulator dùng cùng request/preview.
- Enemy có hai provenance rõ: authored damage chưa scale, hoặc runtime-projected;
  difficulty không được áp hai lần. Target canonical đưa mitigation vào request
  rồi nhận `take_resolved_damage`, nên không giảm/round lần hai.

### Contract mở rộng damage-bearing content

Content mới chỉ truyền:

- `flat_modifiers` cho flat power;
- `additive_percent_modifiers` cho nhóm generic damage%;
- `unique_multipliers` cho cơ chế độc lập;
- `damage_taken_multipliers` và `defense` cho target;
- authored action damage/timing trong resource Hero.

Unknown structured enemy modifier bị ignore và ghi diagnostic; nó không âm thầm
tạo power. Chính `CombatResolver` không có branch theo `hero_id`, `enemy_id`,
chapter hay rarity; controller tạo hành động vẫn là module riêng của từng mechanic.

## 2. Level, HP, DMG và Mana

Save vẫn lưu đúng các count cũ. Derived value được tính lại bằng hai curve chung.

### Level growth

Với `n = level - 1`:

```text
G(n) = (1 - 0.99^n) / (1 - 0.99)
HP level bonus   = 20 × G(n)
DMG level bonus  =  5 × G(n) percentage-points
Mana level bonus = 10 × G(n)
```

Mỗi level luôn mạnh hơn level trước, nhưng marginal tiếp theo bằng `99%` marginal
trước. Numeric surge cưỡng ép mỗi 5 level đã bị bỏ; celebration/milestone về sau
có thể là presentation hoặc mechanic riêng, không được giấu vào base stat.

Enemy **HP và DMG** stage growth đọc chính snapshot này. Speed/pursuit là pressure
axis riêng có cap và metadata riêng; vì vậy chúng không bị ngụy trang thành một
phần của HP/DMG curve.

### Stat-point marginal

Với stat `s`, điểm thứ `i`, cap `P = 200`:

```text
r_s(i) = initial_s / (1 + (i - 1) / (P - 1))
bonus_s(p) = Σ r_s(i), i = 1..p
initial HP / DMG / Mana = 14 flat / 2 percentage-points / 7 flat
```

- Mọi điểm đều dương.
- Marginal giảm trơn và nghiêm ngặt.
- Điểm 200 còn đúng một nửa point 1; không có cliff tier 100/150.
- Cả ba stat dùng cùng shape; khác nhau ở unit và initial return, không ở exception.
- Arsenal tính next-point delta bằng clone save rồi project lại, không hiển thị số
  lý thuyết tách khỏi runtime.

## 3. Encounter và bài học chiến đấu

Map chỉ author anchor an toàn. `EncounterPackRules` quyết định pack, member,
family và difficulty pressure. Easy Chapter 1 tăng theo ladder không có cliff;
Reaper được giới thiệu trước Vampire, mutant không xuất hiện trước Level 4.
Family selector lặp qua ordered `FAMILY_CATALOG`; difficulty tác động bằng category
metadata. Test synthetic đã thêm family thứ tư và chọn nó chỉ bằng catalog/weight,
không thêm branch vào thuật toán.

| Level | Pack × member × floor | Easy total | Khái niệm mới chính |
|---:|---:|---:|---|
| 1 | 1 × 5 × 3 | 15 | Skeleton, movement, confirmed Sword combo |
| 2 | 1 × 6 × 3 | 18 | Củng cố nhịp cơ bản, Soul Vessel |
| 3 | 1 × 7 × 3 | 21 | Một tỷ lệ nhỏ Bone Reaper, build breakpoint |
| 4 | 2 × 4 × 3 | 24 | Mutant + Soul Trace; chưa thêm Vampire |
| 5 | 2 × 5 × 3 | 30 | Vampire + Hero Soul core |
| 6 | 2 × 6 × 3 | 36 | Full live slots/skill layer |
| 7 | 2 × 7 × 3 | 42 | Mixed pressure |
| 8 | 2 × 8 × 3 | 48 | Mixed pressure |
| 9 | 3 × 6 × 3 | 54 | Tăng pack frequency |
| 10 | 3 × 7 × 3 | 63 | Chapter climax cadence |

Chapter 2+ tiếp tục bằng population bands nhỏ và dừng ở Easy `120`, không biến
late stage thành một mob vô hạn. Hard có HP/DMG/speed pressure riêng và population
ratio bị gate; difficulty không được leak family chưa học.

Tutorial Level 1 chỉ hoàn thành Sword 1–4 khi có confirmed hit, damage dương, đúng
Hero và đúng `combo_step`; Soul Echo cần confirmed `is_echo=true`. Button press,
swing cue, hit 0 damage hoặc input hụt không còn giả vờ rằng người chơi đã học.

## 4. XP pacing

- First-clear `+1 level` vẫn là nhịp campaign chính.
- Ordinary kill budget = `15%` XP bucket của stage trên canonical Easy population.
- Boss budget riêng = `10%`.
- Threat weight = `clamp(sqrt(score/reference), 0.65, 1.75)`.
- Reward giữ fractional units trong run và chỉ commit whole XP; bỏ run mất dưới
  `1 XP`, không còn round-up từng enemy.
- Boss budget opt-in bằng role tag/metadata/group chung; scaler không liệt kê boss ID.

Hard có thể trả thêm do density thật, nhưng population/XP ratio đều có gate; nó
không nhân reward chỉ vì label difficulty.

## 5. Progressive loot disclosure

Một bảng `TIER_PROFILES` phủ toàn bộ stage 1–100:

| Stage | Rarity cap | Surface mới |
|---:|---|---|
| 1 | Normal | Material only |
| 2–3 | Magic | Soul Vessel, simple live affix |
| 4–5 | Rare | Vessel + Trace; Hero Soul core từ L5 + entitlement |
| 6–9 | Epic | Ba auxiliary slot, full LIVE affix set |
| 10–20 | Legendary | Build expansion |
| 21–40 | Crystal | Build expansion |
| 41–70 | Mythic | Build expansion |
| 71–100 | Eternal | Endgame cap |

Hero Soul cần đồng thời đạt lesson stage và có feature `soul_hero`. Tier core chỉ
cho `max_hp`, `core_damage`, `max_mana`, `defense`; tier sau mới mở action/
conditional affix. Auxiliary/Hero Soul chỉ roll ID có runtime consumer. Nếu một
rarity đòi nhiều unique affix hơn pool LIVE hiện có, item hạ về rarity hợp lệ cao
nhất thay vì tạo stat giả hoặc biến mất. Caller không opt-in policy vẫn giữ legacy
behavior cho test/tool cũ.

## 6. Breakpoint đo từ runtime formula

Ma trận Chapter 1 dùng Sword resource, Hero projection, enemy stage/difficulty,
CombatResolver và XP policy thật:

| Scenario | Enemy HP | Combo damage | Hit kill | TTK | Player HP | Hit die |
|---|---:|---:|---:|---:|---:|---:|
| L1 floor vs Skeleton Easy | 70 | 104 | 4 | 1.48 s | 100 | 8 |
| L2 floor vs Skeleton Easy | 84 | 109 | 4 | 1.48 s | 120 | 8 |
| L3 floor vs Reaper Easy | 120 | 114 | 5 | 1.94 s | 139.8 | 10 |
| L3 +5 DMG vs Reaper Easy | 120 | 125 | 4 | 1.48 s | 139.8 | 10 |
| L3 +5 HP vs Reaper Easy | 120 | 114 | 5 | 1.94 s | 209.107 | 14 |
| L3 +5 DMG vs Reaper Hard | 210 | 125 | 8 | 3.32 s | 139.8 | 6 |

L3 +5 Mana tăng effective pool `119.9 → 154.553`, làm Soul Echo trong cửa
sổ 180 giây tăng `14 → 16` cast. Đây là breakpoint do resource/cooldown event
simulation, không phải bonus riêng cho L3.

## 7. UI/runtime parity

Arsenal hiển thị effective active Hero HP, Mana, character DMG, base-hit expected
range và formula version. Next point và candidate Hero Soul đều clone full save,
thay đúng một input rồi project lại. Affix chưa hỗ trợ cho delta `0`, không tạo
“sức mạnh UI” không tồn tại trong gameplay.

## 8. Save impact

- Không đổi save schema/shape do Core Balance V1 sở hữu.
- Với document hợp lệ theo schema cũ được khóa trong fixture, `level`, `xp`,
  `stat_allocation`, `skill_allocations`, equipment UUID và Hero Soul selection
  được giữ nguyên sau load/sanitize/roundtrip. Save thiếu field hoặc XP vượt bucket
  vẫn được SaveService canonicalize theo migration contract; không cam kết byte-for-byte.
- Derived base stats được re-project theo curve mới khi load. Đây là intentional
  prototype rebalance, không phải migration làm mất allocation.
- Công thức damage có `formula_version = 1` trong snapshot/breakdown để audit.

## 9. Verification và artifacts

Canonical machine-readable balance result:
`.artifacts/chapter_1_balance_matrix_report.json`.

Full configured non-MCP regression: **PASS**.

- `62` PowerShell suites chạy tuần tự tới suite cuối, cộng `input_map_test.gd`:
  tổng `63` gate. Input map còn được chạy lại độc lập với exit code `0`.
- Artifact window của full gate: `17:00:03–17:19:47` (khoảng `19m44s` trên máy này).
- `230` artifact/log được cập nhật; `38` JSON report parse được, không report nào có
  `ok=false`, failure, error hoặc failed-count dương.
- Cảnh báo duy nhất quan sát được là RealtimeBridge không bind được port `9080` vì
  editor đang giữ port; các test và compile đều exit `0`.

Focused evidence quan trọng sau merge:

| Gate | Kết quả |
|---|---:|
| CombatResolver | 77/77 |
| Enemy authored/configured outgoing seam | 63/63 |
| Combat balance model | 33/33 |
| Chapter 1 balance/XP/loot matrix | 536/536 |
| Player progression invariants | 314/314 |
| Serialized progression save fixture | 55/55 |
| Difficulty/progression integration | 178/178 |
| Encounter catalog/population | 1044/1044 |
| Level 1 confirmed-action tutorial | 66/66 |
| Realtime progressive loot | 312/312 |
| Hero Soul live / Knight incoming seam | 55/55 + 38/38 |

## 10. Contract thêm content sau checkpoint

| Update | Việc phải thêm | Lõi không được sửa |
|---|---|---|
| Item auxiliary | catalog/slot, rarity data, affix có LIVE consumer | CombatResolver, stat curve |
| Hero Soul | instance definition, entitlement, affix trong live contract | damage formula, save schema |
| Enemy/family | EnemyDefinition, family catalog/category, authored attack data, role tag | weighted selector, XP formula |
| Level/chapter | encounter profile/validated override, objective và reward data | player/enemy growth formula |
| Difficulty mới | named modifier profile và invariant population/reward caps | từng level JSON |

Nếu update cần một operation chưa tồn tại, nó là mechanic mới chứ không phải content
data. Khi đó phải thêm operation tổng quát có tên, breakdown, cap/fail-closed behavior
và counterexample test trước; không vá một ID cụ thể để ra con số mong muốn.

## 11. Ranh giới chưa được tuyên bố hoàn tất

- Variance/crit tồn tại trong core nhưng early campaign mặc định `0`; chỉ mở khi
  có UI lesson và preview đủ rõ.
- Defense core đã live, nhưng enemy thường mặc định rating `0`; không gắn armor
  chỉ để làm TTK dài hơn.
- Ma trận production hiện khóa teaching slice L1–3 và Hard replay; L4–100 cần
  thêm outcome gates theo boss/objective cụ thể trước khi gọi final balance.
- Skill-rank economy/effect curve vẫn là gate kế tiếp; đợt này không âm thầm đổi
  rank đã lưu trong lúc đang sửa stat/level foundation.
- Quest hiện dùng objective runtime và contextual tutorial; chưa tuyên bố có một
  hệ quest-log tổng quát cho mọi chapter.
- Hero thứ tư có thể dùng ngay formula/progression/loot core, nhưng action animation,
  targeting và Relay behavior độc nhất vẫn cần đăng ký runtime module; controller
  hiện chưa phải một plugin catalog hoàn toàn data-only.

## 12. File manifest

- Canonical runtime/test manifest: `.artifacts/core_balance_v1_sha256.txt`
- Manifest entries: `36`; verification mismatches: `0`.
- Manifest SHA-256:
  `20c7148cf0039f2d0319f9475700345ac25e302ba22e6d54c212c31606792ffd`
- Chapter 1 matrix SHA-256:
  `6812f32e8e3800b9885bcc2f84665f246c9f274cc25da4f2a2294fcc5829a1dd`
- Enemy outgoing report SHA-256:
  `b15af5c4cc77f2b61a6248e2de79bfc6e3b425be2d56a8bf47b80a6f332e6ecb`

Manifest cố ý hash các file runtime/test canonical, không tự hash tài liệu audit để
tránh vòng tham chiếu. Mỗi đợt balance lớn tiếp theo phải sinh checkpoint mới thay
vì sửa im lặng checkpoint này.
