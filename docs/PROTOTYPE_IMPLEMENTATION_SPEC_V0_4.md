# SOUL OF HERO — Prototype Implementation Spec V0.4

Ngày khóa quyết định: 2026-07-15  
Engine: Godot 4.7  
Mục tiêu dài hạn: 10 chương / 100 level  
Production gate hiện tại: hoàn thiện Chapter 1 thành lát cắt 10 level chơi trọn vẹn trước khi sản xuất hàng loạt Chapter 2–10.

Tài liệu này là bản canon gọn để implementation và test cùng đọc. Bản brainstorm đầy đủ V0.4 được lưu cùng phiên làm việc; nếu tài liệu cũ mâu thuẫn với các quyết định bên dưới thì V0.4 được ưu tiên.

> **Chapter 2 exception (2026-07-16):** V0.4 predates the locked Coven Foundry
> plan. For campaign slots 11–20, the authority is
> `docs/CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`, including Axe's Level 15
> retreat, the Wizard Soul pickup at Level 20, and the Chapter 2 feature cadence.

## 1. Trạng thái thật của project

Đã có:

- Sword Hero và Soul Relay nền tảng.
- Axe combat prototype/legacy compatibility; Archer is the authored Level 5
  physical-Soul recruitment route.
- Ba quái Chapter 1: Skeleton Swordsman, Bone Reaper, Blood Vampire.
- Năm map campaign đầu.
- Campaign registry nhận đủ 10 chương × 10 slot, từ Level 1 đến Level 100.
- Encounter objective theo dõi quái runtime, exit yêu cầu cả objective lẫn Sigil khi level khai báo cả hai.
- First-clear reward transaction idempotent cho Level 1–5.
- Hero Soul instance inventory, grant, sell và fusion nền tảng.

Chưa được phép gọi là game 100 level hoàn chỉnh:

- Level 6–10 chưa đủ production content.
- Vampire Castellan chưa là production boss hoàn chỉnh.
- Chưa có UI hoàn chỉnh cho stat, skill, Hero Soul inventory, gear và fusion.
- Level 11–100 hiện là cấu trúc/roster slot, chưa phải 90 level đã được author và playtest.
- Monster Soul chỉ được chuẩn bị schema; runtime/content mở ở Level 50.

## 2. Player stat progression

Ba stat dùng chung cho account:

- `hp_points`
- `damage_points`
- `mana_points`

Mỗi player level cấp 5 Stat Point. Mỗi stat cap 200.

### Raw return

| Điểm | HP | Damage | Mana |
|---:|---:|---:|---:|
| 1–100 | +8 Max HP/điểm | +0,45% Core Damage/điểm | +3 Max Mana/điểm |
| 101–150 | +5 Max HP/điểm | +0,25% Core Damage/điểm | +2 Max Mana/điểm |
| 151–200 | +3 Max HP/điểm | +0,15% Core Damage/điểm | +1 Max Mana/điểm |

### Milestone

Milestone tự mở ở 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175 và 200 điểm. Bonus thuộc đúng trường chỉ số; milestone 100 và 200 có thể là mechanic riêng.

HP:

- 10: +5% Max HP.
- 20: +5% Defense.
- 30: +10% hiệu quả hồi máu/HP pickup.
- 40: +10% stagger resistance.
- 50: +5% Max HP.
- 60: +5% damage reduction khi dưới 40% HP.
- 70: +10% shield effectiveness.
- 80: +5% Defense.
- 90: +10% healing nhận từ Hero skill.
- 100: `Last Soul`, một lần mỗi level giữ lại 1 HP và 0,8 giây invulnerability.
- 125: +5% Max HP.
- 150: +5% damage reduction trước elite/boss.
- 175: +15% stagger resistance.
- 200: `Relay Guard`, sau Q2 nhận shield 8% Max HP trong 3 giây, internal cooldown 12 giây.

Damage:

- 10: +2% Critical Chance.
- 20: +5% Attack Speed.
- 30: +10% Critical Damage.
- 40: +5% Active Skill damage.
- 50: +5% Core Damage.
- 60: +6% Summon Skill damage.
- 70: +6% Departure Skill damage.
- 80: +5% armor penetration.
- 90: +8% damage trước elite/boss.
- 100: `Relay Overdrive`, sau Q2 +12% damage trong 4 giây, internal cooldown 10 giây.
- 125: +5% Attack Speed.
- 150: +4% Critical Chance.
- 175: +15% Critical Damage.
- 200: `Execution`, +15% damage lên mục tiêu dưới 25% HP.

Mana:

- 10: +1,5 Mana/giây.
- 20: -5% Active Skill mana cost.
- 30: +5% Active Skill cooldown recovery.
- 40: +5% Max Mana.
- 50: +1,5 Mana/giây.
- 60: -5% reserve-Soul support cooldown.
- 70: +8% skill area/effect duration.
- 80: +5% global skill cooldown recovery.
- 90: Q2 hồi 8% Max Mana.
- 100: `Flow State`, Q2 xóa 15% cooldown còn lại của Active Skill.
- 125: +5% Max Mana.
- 150: -8% mọi Skill mana cost.
- 175: +5% global skill cooldown recovery.
- 200: `Soul Reservoir`, Active Skill đầu trong 4 giây sau Relay không tốn Mana, internal cooldown 15 giây.

Global caps:

- Cooldown reduction 35%.
- Dodge chance 25%.
- Damage reduction 50%.
- Bonus attack speed 60%.
- Critical chance 60%.

## 3. Skill progression

- Mỗi level cấp 5 Skill Point.
- Pool điểm thuộc account; allocation lưu theo Hero Identity, không theo từng bản sao Hero Soul.
- Một điểm tăng đúng một rank.
- Sáu track chuẩn: Normal/Basic, Active, Dash, Ready Condition, Summon, Departure.
- Mỗi track cap 20.
- Rank gate: `clampi(ceili(player_level / 5.0), 1, 20)`.
- Respec miễn phí đến hết level 20; sau đó theo từng Identity với `min(2500, 100 + player_level * 25)`.
- Respec chỉ thực hiện ngoài combat và không dùng premium currency.

## 4. Rarity và Hero Soul

Chuỗi rarity cuối cùng:

| Index | Rarity | Màu | Access campaign sớm nhất |
|---:|---|---|---|
| 0 | Normal | Gray | Level 1 |
| 1 | Magic | Blue | Level 1 |
| 2 | Rare | Yellow | Level 3 |
| 3 | Epic | Orange | Level 8 |
| 4 | Legendary | Red | Chapter 2 |
| 5 | Crystal | Cyan | Chapter 4 |
| 6 | Mythic | Purple | Chapter 5 |
| 7 | Eternal | Green | Chapter 9 |

Không tồn tại Quality stat.

Affix count: `0 / 1 / 2 / 3 / 4 / 4 / 4 / 5`.

Roll multipliers:

- Magic: 0,75–1,00.
- Rare: 0,90–1,15.
- Epic: 1,05–1,30.
- Legendary: 1,20–1,50.
- Crystal: 1,35–1,65.
- Mythic: 1,50–1,85.
- Eternal: 1,70–2,10.

Affix pool có bốn nguồn: Universal, matching Affinity, Soul-Action và off-Affinity. Weight trước Legendary là 35/45/15/5; từ Legendary là 35/40/15/10. Không duplicate affix ID và tối đa hai affix cùng stacking group.

Hero Soul instance bắt buộc lưu:

- UUID/instance ID.
- Hero Identity và optional Variant.
- Rarity, item level, affinity.
- Rolled base bonus và affix rolls.
- Source.
- Equipped slot, favorite, locked.
- Optional bonded Monster Soul ID.

## 5. Sell, fusion và Variant

Sell weight theo rarity: `1, 3, 9, 27, 81, 243, 729, 2187`.

```text
hero_soul_sell_value = round(10 × rarity_weight × (1 + 0,01 × (item_level - 1)))
aux_gear_sell_value = round(hero_soul_sell_value × 0,60)
```

Fusion:

- Ba Hero Soul khác instance nhưng cùng Identity và cùng rarity.
- Kết quả luôn thành công và tăng đúng một rarity.
- Item level kết quả bằng item level cao nhất của input.
- Base rolls/affixes reroll theo rarity mới.
- Gold cost bằng hai lần tổng sell value của ba input.
- Eternal không fuse tiếp.
- Không consume item equipped, favorite, locked hoặc bonded Monster Soul.
- Campaign không được buộc người chơi fusion để clear.

Variant:

- Là authored sub-kit, không phải affix ngẫu nhiên.
- Earliest rarity = `min(Eternal, hero_minimum_rarity + 4)`.
- Chance khi fusion ra Legendary/Crystal/Mythic/Eternal: 5%/8%/12%/20%.
- Mỗi lần eligible fail cộng 5 điểm phần trăm; lần eligible thứ năm được guarantee.
- Chapter 1 không phát hành Variant content; schema được làm trước.

## 6. Auxiliary equipment

Ba slot account-level dùng chung cho cả active và reserve Hero:

- `Soul Vessel`: HP, Defense, healing, stagger resistance; mở ở Level 2.
- `Soul Trace`: movement, Dash, Dodge, Relay movement/arrival; mở ở Level 4.
- `Soul Focus`: Mana, regeneration, cooldown, Active/Summon/Departure power; mở ở Level 7.

Gear dùng cùng tám rarity, có một primary đúng slot và affix pool giới hạn theo slot. Không đổi sprite Hero, không có Hero Identity/Variant/Monster Soul socket.

## 7. Monster Soul

- Một bonded Monster Soul trên mỗi Hero Soul.
- Ẩn hoàn toàn trước Level 50; mở sau boss Chapter 5.
- Monster Soul đầu tiên là Reaper Monster Soul và được guarantee.
- Mutation profile có stat package, Normal/Active modifier, Summon modifier, Departure modifier, VFX/audio theme và compatibility tags.
- Tối đa ba module bị rewrite mechanic; phần còn lại chỉ numeric/cosmetic.
- Bonding permanent theo mặc định, auto-lock Hero Soul.
- `Soul Severance` kiếm được qua gameplay có thể tháo nhưng phá hủy Monster Soul.
- Duplicate chuyển thành family Essence; ba Essence nâng rank, cap Rank 3, không fail.

## 8. Chapter 1 production slice

| Level | Nội dung chính | Unlock/reward chính |
|---:|---|---|
| 1 | Sword tutorial, Skeleton, Sigil + exit | Normal Sword Soul |
| 2 | Kích hoạt hai brazier | Soul Vessel |
| 3 | Bone Reaper, projectile đi/về, hai Sigil | Stat allocation, Rare drop |
| 4 | Blood Vampire, marked target + chest | Soul Trace |
| 5 | Bone Reaper Captain miniboss | Magic Axe Soul, hai-Hero loadout |
| 6 | Ba Soul Anchor, Sword↔Axe Relay | Skill allocation/respec |
| 7 | Defend Soul Beacon | Soul Focus |
| 8 | Reaper/Vampire branch và elite chest | Inventory/sell, Epic drop |
| 9 | Ba Gate Seal + Crimson Reaper elite | Rare Hero Soul, boss gate |
| 10 | Vampire Castellan hai phase | Epic Hero Soul, Fusion, Chapter 2, Hunt |

Chapter 1 chỉ được coi là `Already Playable` khi:

- Level 1–10 chơi trọn từ Level Details đến Results/Next.
- Sword và Axe đều vui khi không có loot bonus.
- Relay hai chiều tạo hai flow khác nhau; Q1 support và Q2 takeover đều hữu ích.
- Objective, encounter, reward và exit data-driven.
- Boss có hai phase, telegraph, retry, first-clear và repeat reward.
- Stat/skill/Hero Soul/gear/sell/fusion có UI đủ hiểu mà không cần tài liệu ngoài.
- Fresh save clear được bằng reward deterministic, không cần gacha/fusion/grind.
- Retry dưới 5 giây; normal level 3–6 phút, boss 5–8 phút.
- Fresh save và migrated save ổn định, không duplicate reward.

## 9. Khung 10 chương

1. Crypt of the Broken Oath — crypt, Axe, Vampire Castellan.
2. Xưởng Hắc Phù / Coven Foundry — ash mire, witch gates, three-Spirit onboarding and the Wizard Soul finale; see `CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`.
3. Moonlit Wilds — ambush/poison and Magician build expansion; it is no longer the first Magician-Hero chapter.
4. Drowned Archive — current/projectile direction, Crystal.
5. Hollow Cathedral — anti-Relay zones, Monster Soul, Mythic.
6. Frostbound Citadel — ice/sliding, Hero Variant.
7. Shattered Skyforge — wind vectors và advanced Hunts.
8. Plague Metropolis — enemies mutate trong encounter.
9. Astral Labyrinth — alternating room rules, Eternal/Challenge.
10. Throne of Echoes — mastery remix, final boss, Depth/endless.

Mỗi chapter có 10 level: giới thiệu biome/rule, enemy A, enemy B, mixed/elite, milestone, mastery, composition, branch/Hunt prep, miniboss gate, boss.

## 10. Thứ tự implementation

P0 — Chapter 1:

1. Campaign 10×100 definitions.
2. Objective/EncounterRunner/RewardBundle và migrate Level 1–5.
3. Stat/skill progression + save schema.
4. Hero Soul rarity/affix/inventory/two-slot equip.
5. Soul Vessel/Trace/Focus.
6. Sell + guaranteed fusion.
7. Axe production kit và Relay hai chiều.
8. Author Level 6–10.
9. Vampire Castellan.
10. Pass `Already Playable` gate.

P1 — Chapters 2–5:

- Live Legendary/Crystal drops, reroll/Hunt, Ranger/Magician Hero.
- Variant pity schema.
- Monster Soul interfaces và runtime ở Level 50.

P2 — Chapters 6–10:

- Hai Variant đầu, Mythic/Eternal properties, Monster Soul families.
- Challenge, Depth và release hardening sau khi campaign ổn định.

## 11. Nguyên tắc monetization và asset

- Hero Soul hiếm có thể đến từ drop, deterministic hard content, quest và shop bằng currency gameplay.
- Không có paid-only Hero/Monster Soul source trong prototype.
- Không thực hiện hoặc giả định bất kỳ quyết định thanh toán nào.
- Chỉ đưa asset ngoài vào production khi có bằng chứng license miễn phí/commercial-use phù hợp.
- Nếu chưa xác minh license, dùng placeholder tự tạo/original; không coi asset tìm thấy trên mạng là hợp lệ mặc định.

## 12. Test bắt buộc

- Rarity index/color, affix range/tag/group/cap.
- Fusion input, cost, output, pity; protection cho equipped/locked/favorite/bonded.
- Skill rank gate mọi band; stat cap/diminishing/milestone.
- 10 chương × 10 ID mà chưa bắt buộc mọi scene tồn tại.
- Reward idempotent qua reload/crash.
- Save/load 500+ item instance.
- Objective ngoài Sigil; retry không giữ encounter/reward state sai.
- Fresh profile clear Chapter 1 không random summon/fusion.
- Monster Soul không lộ trước Level 50.
