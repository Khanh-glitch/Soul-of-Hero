# LIVING ARSENAL — Balance guide

Mục tiêu của tài liệu là chỉ ra **nguồn canonical**, không tạo thêm một bộ số thứ hai. Nếu bảng dưới khác resource/JSON, runtime resource là đúng và tài liệu phải được cập nhật cùng change.

Checkpoint kiến trúc và số đo mới nhất nằm tại
`docs/KEEPTRACK_POWER_LEVEL_REBALANCE_2026_07_16.md`. Content mới không được
tự định nghĩa một công thức song song: nó đăng ký dữ liệu có tên vào các contract sau.

| Contract lõi | Nguồn canonical | Content mới chỉ cung cấp |
|---|---|---|
| Damage/mitigation | `game/combat/combat_resolver.gd` | base action, named flat/additive/unique modifiers, target context |
| Hero projection | `game/heroes/hero_soul_manager.gd` | Hero resource, save allocation, equipment và Soul affix đã có consumer |
| Level/stat growth | `game/meta/progression/player_progression_rules.gd` | level hoặc số point; không có per-level exception |
| Enemy stage/difficulty | `game/meta/progression/difficulty_rules.gd` | authored enemy profile và difficulty selection |
| Encounter population | `game/content/encounters/encounter_pack_rules.gd` | stage profile/override đã validate; map chỉ author anchor |
| XP tempo | `game/meta/progression/progression_pacing_rules.gd` | threat profile và canonical encounter population |
| Complexity/loot | `game/meta/progression/complexity_progression_rules.gd`, `game/loot/loot_director.gd` | catalog entry, entitlement và live affix contract |

Quy tắc mở rộng: thêm item, Hero Soul, enemy, level hay chapter là thay/đăng ký data
trong một contract hiện hữu. Nếu một mechanic thực sự cần layer toán học mới, layer đó
phải được định nghĩa tổng quát, có breakdown và invariant test trước khi content dùng nó;
không branch theo ID để “cân riêng” một màn.

“Data-only” ở đây áp dụng cho content dùng mechanic hiện hữu. Hero mới có action,
animation, targeting hoặc Relay behavior chưa từng có vẫn cần một module hành vi và
đăng ký controller; module đó tái sử dụng các contract trên, không được tạo damage/
progression/loot formula riêng.

## Nguồn tuning

| Phạm vi | Nguồn canonical |
|---|---|
| Player movement, Dash, HP/stamina và combat prototype cũ | `config/gameplay_tuning.json` |
| Sword Hero | `game/heroes/data/sword_hero.tres`; consumer trong `game/characters/knight/knight.gd` |
| Archer Hero | `game/heroes/data/archer_hero.tres`; projectile/profile trong `game/weapons/data/bow.tres` |
| Axe compatibility prototype | `game/weapons/data/axe.tres` |
| Swap/cooldown slot | export/default trong `game/weapons/weapon_manager.gd` |
| KingdomArcher boss | `game/characters/enemies/hooded_archer_miniboss.gd` và `data/content/enemies/hooded_archer_miniboss.tres` |
| Level/objective | LevelDefinition/EncounterDefinition cho contract; runtime objective riêng xử lý các tương tác vật lý; JSON map chỉ giữ geometry/entities |

Không thêm damage/cooldown mới vào HUD, scene hoặc tutorial text. UI đọc trực tiếp WeaponDefinition/runtime state.

## Level và ba core stat hiện hành

- Level chỉ tăng HP và Mana; phần trăm damage từ level luôn bằng `0`.
- Stat người chơi nhìn thấy là `HP / Mana / Power`. Key save/runtime của Power
  vẫn là `damage` để giữ tương thích dữ liệu.
- Mỗi level sở hữu 5 Stat Point; từng stat cap 200.
- Điểm Power thứ `k` cho
  `4 / (1 + (k - 1) / 199)%` core damage, từ 4% ở điểm đầu tới 2% ở điểm 200.
- Enemy stage damage không đọc Power hoặc level damage của player. Nó dùng curve
  riêng `5% × geometric decay 0,99`, sau đó mới nhân Easy/Medium/Hard.
- Enemy stage HP hiện vẫn dùng ratio của đường HP level rồi nhân difficulty.
  Đây là coupling `CURRENT` có test, không phải lý do để content mới tự sửa HP;
  trước Chapter 2 cần quyết định giữ hay tách một enemy-health curve riêng.

Không được cộng lại offense theo level ở Hero, item, Soul, skill hay content
adapter. Muốn tạo sức mạnh tấn công mới phải cung cấp modifier có tên vào damage
pipeline hoặc để người chơi chủ động đầu tư Power.

## Auxiliary equipment hiện hành

Ba slot account-wide duy nhất là:

| Slot | Player Level gate | Vai trò |
| --- | ---: | --- |
| `soul_vessel` | 2 | Armor: HP, hồi phục và chống chịu |
| `soul_boots` | 4 | Boots: movement, Dash và footwork |
| `soul_trace` | 7 | Jewelry: Power, Mana và cooldown |

Không thêm `soul_focus` hoặc slot crystal thứ tư. Crystal là stackable upgrade
stone. Item mới đăng ký primary/affix vào
`auxiliary_equipment_definitions.gd`; chỉ affix có consumer trong
`AuxiliaryEquipmentCombatStats`/`HeroSoulManager` mới được đưa vào random LIVE.

Mỗi gear có rank 0–5. Giá trị hiệu dụng là `roll_gốc × (1 + 0,03 × rank)`;
mỗi rank tiêu một `soul_upgrade_stone_<rarity>` đúng rarity qua transaction
atomic. Content không được tự thêm upgrade multiplier khác theo item ID.

Direct HP/Power/Mana gear luôn theo hai bước: cộng toàn bộ flat, sau đó nhân
tổng percent. Cooldown recovery cap 35%, damage reduction 50%, movement 25%,
dash speed 35%, guard while Attack/Skill 20%, healing received 50%, Mana cost
reduction 50% và HP regen 5% Max HP/s.

Field Codex phải đọc cùng projection runtime và giữ bốn số HP/Mana/POWER/VŨ KHÍ.
Slot visual thứ 5 là Boots, thứ 6 là Jewelry; affix hiếm nhất ở trên và màu/viền
rarity không được suy từ item name.

## Action-facing invariant

Attack/Skill giữ sprite, weapon và hit direction theo `action_direction` cho đến
hết recovery; velocity vẫn theo movement input. Backpedal không được lật hướng
đòn đánh, và movement lấy lại visual-facing ngay sau action. Hero/action mới tái
dùng invariant này thay vì viết một nhánh facing riêng.

## Player baseline hiện tại

| Giá trị | Baseline |
|---|---:|
| Move speed | 96 px/s |
| Acceleration / friction | 900 / 1100 px/s² |
| Max HP / stamina | 100 / 100 |
| Stamina regen | 26/s |
| Dash speed / duration | 265 px/s / 0.18 s |
| Dash cooldown | 2.0 s |
| Dash invulnerability | hiện bằng dash duration; mục tiêu giữ khoảng 0.15–0.20 s data-driven |

Roll/slide/hop/crouch và các attack alias cũ còn phục vụ asset/controller prototype; chúng không phải core Living Arsenal action set và không được dùng để cân campaign nếu chưa có LevelDefinition yêu cầu.

## Shared arsenal baseline

| Giá trị | Baseline |
|---|---:|
| Hand ↔ Spirit transition | 0.25 s |
| Shared swap cooldown | 1.5 s |
| Spirit slot đầu game | 1 |
| Spirit slot sau Level 10 | 2 |
| Combo state khi rời Hand | reset |
| Hand skill cooldown khi thành Spirit | tiếp tục tick |
| Spirit action cooldown khi thành Hand | tiếp tục tick |
| Spirit progress khi thành Hand | pause và preserve |

## Sword Hero hiện tại

### Normal — bốn nhịp pursuit combo

Base damage 20. Cửa sổ nối combo là 2 giây tính từ khi action trước hoàn tất;
Dash thường giữ bước kế và thời gian còn lại.

| Bước | Damage | Duration | Vai trò movement |
| --- | ---: | ---: | --- |
| Opening Slash | 20 | 0,34 s | mở nhịp ổn định |
| Passing Slash | 20 | 0,40 s | đi xuyên qua safe point của target |
| Crescent Recoil | 24 | 0,52 s | kiếm khí tiến, Hero giật lùi |
| Pursuit Execution | 40 | 0,58 s | truy đuổi và vượt qua target; fallback yếu hơn nếu không có target |

Tổng đúng execution là 104 damage / 1,84 giây = **56,52 raw DPS**.

### Active — Soul Echo

Soul Echo tốn 32 Mana, cooldown baseline 12 giây và phản chiếu các bước combo
còn lại bằng Echo riêng. Nó giữ bản sắc melee pursuit và không cấp i-frame.
Contract đầy đủ nằm tại `docs/SWORD_HERO_SPEC.md`.

## Archer Hero hiện tại

Archer là ranged line-controller, không phải Bow weapon chung cho mọi Hero.

### Focus

- Max 2, timeout 4 giây.
- Quick/Split hit xác nhận ở 96–260 px và có line of sight: +1 Focus.
- Hostile có line of sight trong 72 px: mất 1 Focus mỗi 0,45 giây.
- Damage/death/team change/Relay xóa Focus; Dash giữ Focus nhưng timer vẫn chạy.

### Normal — Focus Chain

| Bước | Damage | Stagger | Duration / release | Speed / range / width | Movement | Focus cap |
| --- | ---: | ---: | --- | --- | --- | --- |
| Quick Shot | 18 | 6 | 0,32 / 0,13 s | 520 / 300 / 6 | 80% | +1; cap 1 |
| Split Step Shot | 20 | 8 | 0,40 / 0,16 s | 540 / 300 / 6 | 24 px / 0,16 s; no i-frame | +1; cap 1 |
| Armor Piercer | 30/36/42 | 14/17/20 | 0,70 / 0,40 s | 600 / 360 / 10 | 30%, rồi 65% sau release | tiêu 0/1/2; cap 1/2/4 |

Full-Focus combo là 80 / 1,42 giây = **56,34 raw DPS**, gần bằng Sword
56,52. Không Focus chỉ còn 68 / 1,42 = 47,89 DPS; 12 damage thiếu là execution
tax khi không giữ đúng spacing, không phải chênh lệch rarity hay Player Level.

### Active — Soul Mark

- 32 Mana; cooldown 12 giây; cast 0,22 giây.
- Bắt buộc có target trong 300 px/cone 150°; mark tồn tại 4 giây.
- Normal hit kế tiếp lên target tiêu mark và tạo Soul Line: 44 damage,
  14 stagger, 640 px/s, range 360, width 16, cap 5.
- Soul Line không tạo Focus.

### Soul Relay

- Clear Shot: hostile đang target player, có line of sight, 112–280 px liên tục
  1 giây; READY tồn tại 5 giây.
- Piercing Entry: 28 damage, 18 stagger, 620 px/s, range 360, width 14, cap 6;
  takeover `0,18–0,30 / 0,48–0,62 / 0,78–0,94`.
- Backstep Volley: 0,65 giây, ba arrow ±12°, mỗi arrow 12 damage/8 stagger,
  520 px/s, range 260; một target nhận tối đa hai hit.

Đặc tả đầy đủ và boss counterpart nằm tại
`docs/ARCHER_LEVEL_5_DESIGN.md`.

## Axe compatibility prototype

Axe đã có `axe.tres` và combat prototype, nhưng không còn là boss/reward Level 5.
Nó được giữ để tương thích save cũ và dời sang mốc tuyển mộ sau. Các số dưới đây
là **baseline testable của prototype**, không phải cam kết cân bằng campaign;
nguồn canonical vẫn là `game/weapons/data/axe.tres`.

### Hand normal — Heavy Cleave

| Base damage | Base stagger | Knockback | Duration | Hit window | Move multiplier | Max charge |
|---:|---:|---:|---:|---:|---:|---:|
| 30 | 20 | 9 | 0.44 s | 0.16–0.32 s | 0.36 | 1.15 s |

| Charge scaling | Quick release | Full charge |
|---|---:|---:|
| Damage | 30 | 60 |
| Arc | 70° | 150° |
| Stagger | 20 | 45 |

- Quick release vẫn dùng được ngay; charge chỉ tăng damage/arc/stagger đến cap trên.
- Knockback giữ ở 9 để Axe vẫn là chém/stagger, không thành hammer launch.

### Hand skill — Throw & Recall

| Cooldown | Damage | Stagger | Knockback | Target range | Outbound speed | Return speed |
|---:|---:|---:|---:|---:|---:|---:|
| 6.5 s | 26 | 16 | 7 | 220 px | 340 px/s | 470 px/s |

| Auto recall | Path width | Cross Cut stagger bonus | Return snap | Stop outbound on world |
|---:|---:|---:|---:|---|
| 1.4 s | 14 px | +28 | 8 px | Có (`true`) |

- Movement và Dash vẫn được phép khi Axe đang bay.
- Mỗi enemy nhận tối đa một outbound hit và một return hit; CROSS CUT cộng 28 stagger khi cùng target trúng cả hai path.

### Spirit — Follow-through

| Cooldown | Damage | Stagger | Knockback | Range | Outbound / return speed | Max lifetime | Path width | Return snap |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 3.0 s | 20 | 14 | 6 | 420 px | 430 / 540 px/s | 4.0 s | 13 px | 8 px |

- Một Hand skill resolve chỉ tạo tối đa một Follow-through.
- Không có meaningful endpoint/target thì Axe Spirit không trigger.

## Phương pháp cân

1. Chốt encounter role và time-to-kill mục tiêu trước khi tăng HP/damage.
2. Đo separately: single target, ba target, moving target, elite stagger và boss phase.
3. Giữ core loop Sword/Archer vui khi không có rarity/Part/mastery; Axe chỉ vào
   lại ma trận khi milestone tuyển mộ mới được chốt.
4. Sidegrade/mastery không xóa weakness của weapon.
5. Tránh chỉ tăng HP: tăng áp lực bằng pattern, density, objective và stagger resistance có kiểm soát.
6. Mọi thay đổi số phải có test invariant (cooldown, count, path, once-only) và playtest note.

## Balance change template

```text
Date / author:
Resource + property:
Old → new:
Reason / observed problem:
Scenario and loadout tested:
Automated tests:
Mobile readability/performance check:
Result / follow-up:
```
