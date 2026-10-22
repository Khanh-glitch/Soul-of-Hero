# SOUL OF HERO — hợp đồng mở khóa tính năng

Ngày cập nhật: 2026-07-16. Đây là nguồn trạng thái hiện tại của Chapter 1; tài
liệu Living Arsenal cũ đã bị thay thế.

## Nguyên tắc

- `LevelDefinition.granted_feature_ids`, level reward và physical-pickup reward
  là các hợp đồng canonical độc lập; không được suy diễn grant của hợp đồng này
  từ receipt của hợp đồng khác.
- Mỗi completion transaction ghi atomically reward/feature/level kế tiếp của
  chính nó; physical-pickup transaction ghi atomically Soul/feature của pickup.
  Crash/reload không được trộn hai authority hoặc để lại nửa transaction.
- Ngoại trừ starter Sword được khai báo rõ, Hero chỉ mở khi người chơi hạ đối
  thủ mang Soul rồi tự tay tương tác với Hero Soul vật lý. Boss chết, level clear,
  Player Level hoặc level được mở không tự cấp Hero.
- Nhặt Soul chỉ đưa item vào tủ đồ và cấp ownership; pickup không tự đổi
  Active/Reserve, không kích hoạt Hero và không áp hiệu ứng. Người chơi phải mở
  tủ đồ rồi bấm **Equip** trên đúng Soul; thao tác Equip mới đổi team/kích hoạt
  hiệu ứng ngay, kể cả trong chính ván hiện tại nếu tủ đồ truy cập được.
- UI và service phá hủy tài sản phải kiểm tra feature, không chỉ dựa vào Player
  Level hoặc việc node đã tồn tại.
- `required_feature_ids` là gate thật khi vào level, kể cả khi một save cũ hoặc
  save bị sửa có sẵn ID level trong `unlocked_levels`.
- Reconciliation chỉ phục hồi entitlement/unique reward từ level đã hoàn thành;
  không trả lại currency stackable nhiều lần.

## Timeline Chapter 1 đang chạy

| Mốc | Entitlement/reward | Trạng thái runtime |
| --- | --- | --- |
| New profile | Sword Hero Soul, Chapter 1 Level 1 | Có thể chơi |
| Level 1 clear | Magic Soul Vessel Lv2 | Armor/HP lesson; tự equip nếu slot trống |
| Level 3 clear | Magic Soul Boots Lv4, affix movement speed | Boots/movement lesson; tự equip nếu slot trống |
| Level 5 physical pickup | Hạ KingdomArcher rồi nhặt Normal Archer Hero Soul Lv1; `soul_hero`; `soul_relay`; không tự gán Reserve | Có thể chơi; pickup transaction atomic và tách khỏi first-clear reward |
| Level 6 clear | Magic Soul Jewelry Lv7 với cooldown rate; `skill_allocation`, `skill_respec` | Player lên Level 7, nhận Jewelry tutorial và Roster cho phân bổ/respec sáu track mỗi Hero |
| Level 7 clear | `soul_jewelry` | Entitlement Jewelry hiện hành; `soul_focus` legacy không còn là slot live |
| Level 8 clear | `hero_soul_inventory`, `hero_soul_sell` | Inventory onboarding; Sell được hard-gate |
| Level 9 clear | `chapter_1_boss_gate` | Là required feature của Level 10 |
| Level 10 first-clear | `hero_soul_fusion`, `chapter_2_access`, `hunt_replay`; Epic Sword Soul Lv10 | Fusion được hard-gate; Chapter 2 mới là entitlement chờ content; replay Castellan có bounty thật |

`chapter_2_access` không có nghĩa Chapter 2 đã được author. Results phải ghi rõ
đây là entitlement/content pending. `hunt_replay` hiện chỉ bảo đảm loop replay
boss Chapter 1 và bounty theo run receipt, không phải một Hunt mode hoàn chỉnh.

### Chapter 2 canonical target (not yet runtime-complete)

Level 10 must also reconcile a `second_spirit_slot` entitlement exactly once;
Level 11 is its safe, mandatory onboarding rather than a second reward grant.
The Chapter 2 sequence is: Level 12 `monster_parts` + `monster_forge`, Level 13
`hunt`, Level 16 `salvage`, Level 17 `crafting`, Level 18 `challenge`, and Level
20 `depth`. These are implementation targets from
`CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`, not evidence that their runtime
consumers exist today.

Ba slot auxiliary live mở theo Player Level 2/4/7: `soul_vessel`, `soul_boots`,
`soul_trace` (Jewelry). Reward Level 1/3/6 là bài học deterministic; random loot
mở dần Armor → Boots → Jewelry và không được rơi slot chưa đạt gate. Crystal là
đá nâng cấp stackable cùng rarity, không cấp feature/equipment slot riêng.

## Hành vi reward/replay

- First-clear mỗi level tăng Player Level theo bundle đúng một lần.
- Level 5 Archer Soul, Level 9 Rare Sword Soul và Level 10 Epic Sword Soul là
  unique deterministic grant; reload/replay không tạo UUID thứ hai. Riêng Archer
  chỉ được cấp bởi receipt
  `campaign:chapter_1_level_5:archer_soul_pickup:v1`, không bởi level-clear.
- Hạ KingdomArcher nhưng chưa nhặt Soul không đổi ownership và chưa mở exit.
  Pickup thành công cấp Normal item-level-1 `archer_hero` vào tủ đồ nhưng không
  tự sửa team; chỉ nút Equip do người chơi bấm mới kích hoạt Soul/Hero/hiệu ứng.
- Khi replay đã có pickup receipt, objective nhặt được khôi phục và không sinh
  Soul thứ hai; objective hạ boss vẫn yêu cầu trận đánh thật.
- Level 10 replay trao 120 account currency, 2 Hero Materials và 1 Monster
  Fragment cho một run ID mới. Gọi lại callback cùng run ID không trả lần hai.
- Soul đang equipped/selected, locked hoặc favorite không được Sell/Fusion.
- Sell chỉ hợp lệ sau Level 8; Fusion chỉ hợp lệ sau Level 10. Request bị gate
  không tiêu Soul/Gold và không tạo transaction receipt.

## Những flag chưa phải gameplay hoàn chỉnh

Save có các vùng/flag dự phòng cho Monster Soul, Monster Parts, Forge, Hunt,
Challenge, Depth và Chapter 2–10. Sự tồn tại của schema/card/flag không được dùng
để tuyên bố tính năng đã chơi được. Trạng thái hiện tại:

- Monster Soul: rules/foundation; dự kiến mở ở Level 50; chưa có inventory/drop/UI/combat production.
- Monster Parts/Forge: chưa có loop loot/socket/crafting.
- Hunt/Challenge/Depth: chưa có mission runtime hoàn chỉnh.
- Chapter 2–10: capacity 100 level đã có; Level 11–100 chưa được author/playtest.

## Gate acceptance

1. First-clear, reload và replay không nhân đôi reward/feature.
2. Feature bắt buộc được kiểm tra ở service và UI; Player Level giả không bypass.
3. Save hoàn thành level từ schema cũ được reconciliation đúng một lần.
4. Level 10 không mở khi thiếu `chapter_1_boss_gate`, kể cả `unlocked_levels`
   chứa ID bị forge/stale.
5. Failure/retry không commit first-clear; completion callback lặp lại an toàn.
6. Tên unlock trong Results phân biệt entitlement đang có consumer với content
   chỉ mới được dành chỗ.
7. Boss death Level 5 không cấp Archer; chỉ tương tác pickup cấp đúng một Soul.
8. Level 5 completion/reconciliation không thể tạo Archer nếu thiếu exact pickup
   receipt; pickup không tự đổi Hand/Reserve. Chỉ explicit Equip mới đổi team và
   áp hiệu ứng, có hiệu lực ngay không phụ thuộc việc bắt đầu ván mới.
9. Reconciliation v6 xóa entitlement stale `soul_focus`, phục hồi
   `soul_jewelry` từ completion tương ứng và không nhân đôi reward tutorial.
10. Slot 5 của layout equipment là Boots, slot 6 là Jewelry; đá cùng rarity chỉ
    được tiêu qua transaction nâng gear hợp lệ.

## Developer/QA profile

Test và debug phải dùng save path riêng qua cả `SOUL_OF_HERO_SAVE_PATH` và
`LIVING_ARSENAL_SAVE_PATH`. Không dùng test fixture để sửa profile người chơi
thật. Full regression runner đã thiết lập hai biến này cho mỗi lần chạy.
