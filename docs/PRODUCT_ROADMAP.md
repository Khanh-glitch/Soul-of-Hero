# Product roadmap LIVING ARSENAL

Roadmap này chuyển master spec thành các milestone phụ thuộc lẫn nhau. Đây là thứ tự giao hàng, không phải cam kết lịch. Nguyên tắc xuyên suốt: giữ project chạy sau mỗi milestone, tạo checkpoint trước thay đổi xâm lấn, không tạo menu giả/dead button, và không sản xuất hàng loạt content trước khi data model + save + flow đã ổn định.

## Milestone hiện tại — M0.2 True top-down dungeon + atlas 0x72

Trạng thái: **đang thực hiện trong Phase 0**.

Mục tiêu là sửa vertical slice hiện tại để nhìn và chơi như dungeon top-down thật, dựa trên 0x72 DungeonTileset II v1.7, thay vì các dải platform ngang.

Phạm vi hiện tại:

- Footprint gồm phòng và hành lang kết nối, phần ngoài là black void.
- Floor chỉ nằm trong vùng walkable; perimeter wall thuộc Geometry có collision.
- Dùng full atlas 0x72 cho floor/decor và low-wall atlas riêng cho Geometry.
- Giữ FreeKnight, skeleton, sigil, chest, checkpoint, spikes, torch và exit gate làm sandbox test.
- Desktop ẩn virtual controls mặc định; touch có thể bật bằng mobile feature hoặc `GODOT_FORCE_TOUCH_CONTROLS=1`.
- Live Sync/MCP tiếp tục round-trip `Backdrop`, `Geometry`, `Decor` mà không làm mất entity/metadata.

Definition of Done:

- Ảnh chụp gameplay cho thấy silhouette phòng–hành lang, cửa/kết nối và void rõ; không còn cảm giác platform strip.
- Wall/corner atlas đúng hướng; không có seam hoặc tile sàn biến thành tường.
- Tất cả entity nằm trên floor hợp lệ, không trong pit/void/wall.
- Corridor quan trọng đi qua được; perimeter và pit chặn đúng.
- Có phương án occlusion cho tường/cột cao, không để player luôn vẽ trên mọi kiến trúc.
- Smoke gameplay, editor parse và MCP suite qua; log không có lỗi.
- Tài liệu số cell/atlas được cập nhật sau khi layout chốt.

Milestone này **không đồng nghĩa** với Level 1 của campaign, chưa thêm Sword/Bow Spirit, save hay hub.

## Phase 0 — Audit và ổn định baseline

Mục tiêu: biến prototype thành nền có thể refactor an toàn.

Deliverables:

- `PROJECT_AUDIT.md`, roadmap và danh sách debt có owner/milestone.
- Commit hoặc backup baseline đầu tiên.
- Hoàn tất M0.2 true top-down dungeon + atlas 0x72.
- Quyết định landscape Android, pixel scaling, y-sort/foreground và safe-area baseline.
- Chuẩn hóa UTF-8 cho UI text; bắt đầu translation-ready string table.
- Đóng băng collision/group/public contract hiện dùng bằng characterization tests.
- Gắn dev flag cho MCP/Live Sync; xác định behavior trong release export.
- Sửa tài liệu stale sau khi map chốt.

Exit gate:

- Slice hiện tại chạy sạch trên Godot 4.7.
- Gameplay smoke + MCP tests qua từ working tree sạch.
- Có ảnh visual acceptance desktop và touch-emulated.
- Có đường rollback trước Phase 1.

## Phase 1 — Core combat top-down chính thức

Mục tiêu: tạo controller/combat foundation đủ chắc để vũ khí không phải patch trực tiếp vào Knight.

Deliverables:

- Player state machine typed: `IDLE`, `MOVE`, `ATTACK`, `SKILL`, `DASH`, `HURT`, `SWAP`, `INTERACT`, `DEAD`.
- Transition policy, input buffer, interrupt/cancel rules và pause-safe timers.
- Input Map sản phẩm: WASD, mouse/J Attack, mouse/K Skill, Space Dash, Q/E Spirit selection, Escape Pause; migration alias cho prototype có thời hạn.
- Damage/Hit/Stagger/Knockback/Invulnerability components và confirmed gameplay signals.
- Target acquisition + aim assist nhẹ; giữ vector 360° dù sprite chỉ flip ngang.
- Dash data-driven gần baseline spec, không damage mặc định, i-frame 0,15–0,20 s.
- Enemy base/definition đầu tiên, spatial neighbor strategy thay group scan mỗi frame.
- Baseline feel: hit-stop profiles, hurt flash, trail/particle tối thiểu, restrained shake, damage number toggle hook.
- Audio bus `Master/Music/SFX/UI` và placeholder event map.
- SaveService skeleton: version, default, atomic backup/recovery, migration interface.

Exit gate:

- Không action conflict, duplicate hit hoặc stuck state trong stress test.
- Movement/combat hoạt động desktop và touch.
- Death/retry giữ đúng loadout placeholder và không ghi sai permanent state.
- Test state transition, cooldown frame-rate independence, pause/resume và cleanup qua.

## Phase 2 — Living Arsenal vertical slice và Level 1

Mục tiêu: chứng minh core fantasy `Hand → trigger Spirit → swap` bằng một level hoàn chỉnh.

Deliverables:

- Custom resources: `WeaponDefinition`, AttackProfile, SkillProfile, SpiritTriggerDefinition, SpiritActionDefinition.
- `WeaponManager` hỗ trợ từ đầu 1 Hand + 2 Spirit slot, nhưng gate Spirit slot thứ hai.
- Shared swap 1,5 s, transition khoảng 0,25 s, queued swap và cooldown/progress preservation.
- Sword hoàn chỉnh: combo 3 hit, Dash Slash, trigger 3 confirmed attack instances, Flying Sword.
- Bow hoàn chỉnh: Falling Arrow, Triple Piercing Volley, Dash trigger, Reverse Piercing Shot.
- HUD Chapter 1: HP, Attack, Skill, Dash, Hand identity, một Spirit icon, trigger/cooldown feedback.
- Level 1 tutorial flow: Sword → Bow reward → Bow Spirit → swap Bow Hand/Sword Spirit.
- Boot/Title tối thiểu, New Game/Continue, Level Details/Loadout tối thiểu, gameplay, Results, Retry/Next/Hub.
- Save Bow unlock, loadout, tutorial flags và result reward idempotently.
- Chaser và encounter resource tối thiểu, spawn warning và objective completion.

Exit gate:

- Người mới có thể hiểu loop Hand/Spirit trong một phút mà không cần đọc text dài.
- Sword và Bow đều chơi được ở Hand lẫn Spirit role.
- Swap queue/cooldown/progress tests qua.
- Level 1 được hoàn thành từ Title đến Results rồi Continue sau restart app.

Chỉ sau exit gate này mới được ghi campaign progress là **1/20**.

## Phase 3 — Chapter 1 hoàn chỉnh

Mục tiêu: hoàn thành progression Levels 2–10 trên nền đã chứng minh.

Deliverables:

- Dasher, Shooter, Elite Captain và Chapter 1 boss hai phase.
- Axe hoàn chỉnh: Heavy Cleave, Throw & Recall, Cross Cut, Follow-through.
- Encounter library, arena modules, objective variants và active-enemy cap.
- Levels 2–10, mỗi level 60–120 s, một optional objective và Results thật.
- Campaign Map/Hub, Level Details, Loadout/Arsenal, pause/death/victory flow hoàn chỉnh cho Chapter 1.
- Weapon Mastery cho Sword/Bow/Axe.
- UnlockService data-driven: Bow, Axe, level, second Spirit slot, Forge và feature cards.
- Save progression, best time/objective, mastery, currency và loadout migration.
- Level 10 boss reward transaction mở second Spirit architecture và Monster Forge gate.

Exit gate:

- Manual playthrough Levels 1–10 với baseline loadout; không soft lock.
- Elite/boss telegraph rõ và không one-shot full-health player bằng default attack.
- Restart/crash ở Results không duplicate reward.
- Chapter 1 completion mở đúng flag nhưng chưa phơi feature Chapter 2 sai thời điểm.

## Phase 4 — Foundation ẩn cho hệ thống Chapter 2

Mục tiêu: hoàn thiện kiến trúc dài hạn trước khi bật feature cho người chơi.

Deliverables:

- Second Spirit runtime hoàn chỉnh, per-event trigger lock và two-Spirit HUD contract; vẫn feature-gated.
- MonsterPartDefinition, inventory/socket, compatibility/effect hook và preview contract.
- Predator Jaw, Venom Spine, Giant Heart data + behavior cho Sword/Bow/Axe Hand/Spirit.
- Forge UI/data, Part inventory và save; khóa đúng trước Level 10 completion.
- Hunt target/reward/pity/fragment data foundation.
- Item instance, Common/Rare/Epic/Legendary, compact affix pool, inventory/filter/favorite/lock schema.
- Salvage/crafting/reroll foundations và protection rules.
- Bestiary data model, enemy discovery và source-of-Part relationship.
- Locked feature cards chỉ xuất hiện trong hub screen phù hợp, không ở combat HUD.

Exit gate:

- Feature-gate tests chứng minh locked system không leak vào gameplay sớm.
- Part equip/remove và mọi effect combination Sword/Bow/Axe có test.
- Save round-trip được inventory, Part, affix, favorite/lock và second Spirit state.
- Không có dead button: screen chưa active chỉ dùng locked card có điều kiện rõ.

## Phase 5 — Chapter 2 và post-campaign modes

Mục tiêu: đưa architecture Phase 4 vào gameplay hoàn chỉnh Levels 11–20 và endgame.

Deliverables:

- Onboarding 3 weapon/2 Spirit an toàn đầu Chapter 2.
- Coven Wraith family với ba behavior profile (pressure, venom, Spirit Leech),
  Hexwing Familiar elite, Axe drive-off boss L15 và Hero Soul Wizard boss L20;
  chi tiết canonical ở `docs/CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`.
- Levels 11–20 với Part, rarity/affix và objective pressure tăng dần.
- Monster Forge active, Part acquisition, fragment/pity và Hunt board thật.
- Rarity drops, pickup comparison, Lost Loot, salvage/crafting/reroll thật.
- Challenge locally seeded/rotating với local best score; không hứa leaderboard online khi chưa có backend.
- Depth mở sau Level 20, có room progression, elite modifier, boss/rest/reward/checkpoint.
- Modes, Bestiary, Forge, Arsenal và Results tích hợp đầy đủ.

Exit gate:

- Manual playthrough Levels 11–20 bằng build hợp lệ và test mọi Part trên Sword/Bow/Axe.
- Hunt/Challenge/Depth có loop vào–chơi–results–save–replay thật.
- Wizard death + physical Soul pickup + Level 20 first-clear tách receipt; first-clear
  unlock Depth idempotently. Axe L15 chỉ retreat ở 50%, không cấp Axe Soul.
- Không mất item, duplicate Spirit, stuck Axe projectile hoặc save corruption trong soak test.

## Phase 6 — Polish, accessibility và content hardening

Mục tiêu: đưa feature-complete build tới mức sản phẩm dễ hiểu, dễ đọc và ổn định trên mobile.

Deliverables:

- UI art/pixel theme thống nhất; generated asset prompt được lưu nếu dùng image generation.
- Responsive/safe-area/focus navigation cho phone, tablet và desktop; left-handed preset.
- Settings: volume, shake, vibration, damage numbers, aim assist, joystick/button presets, reduced flash/motion, contrast, telegraph palettes, tutorial reset, save reset.
- Audio đầy đủ theo event map và adaptive music đơn giản cho hub/combat/elite/boss/results.
- VFX readability budget, pooling/deterministic cleanup và performance budget.
- Localization-ready strings, không còn mojibake/clipping.
- Balance pass, economy/mastery/Part/affix/pity tuning qua data resources.
- Hoàn thành tài liệu Architecture, Game Flow, UI/UX Map, Balance, Content Pipeline, Save Schema, Test Plan, Unlocks, Generated Prompts và Changelog.

Exit gate:

- Test trên ít nhất một phone và một tablet/aspect simulation; frame-time/memory đạt budget đã ghi.
- Accessibility toggles tác động thật và persist.
- Không console spam, missing resource hoặc placeholder/dead UI trong shipping flow.

## Phase 7 — Full QA và export-ready

Mục tiêu: tạo build alpha có thể phân phối và tái lập.

Deliverables:

- Full regression automation và manual test matrix cho 20 campaign level, 3 weapon, mọi Hand/Spirit role, mọi Part và mọi mode.
- Save migration từ các version đã phát sinh, corruption/backup/reset/dev profile tests.
- Android export preset, signing handoff, orientation/safe area, permissions và release dev-feature stripping.
- Desktop test export, clean install/upgrade/uninstall checks.
- Soak test scene cleanup, projectiles/VFX, repeated retry/next/hub và memory.
- License manifest cho toàn bộ asset/audio/font.
- README cuối: setup, controls, scope, architecture, balance, save location, export và extension workflow.
- Release checklist, known issues và reproducible build notes.

Exit gate:

- Tất cả acceptance criteria trong master spec có bằng chứng test hoặc được ghi rõ là blocker.
- Không critical error, soft lock, reward duplication, lost item hoặc save corruption.
- Shipping build không mở MCP/debug panel và không chứa unfinished navigation.
- Có bản export cài/chạy được và checksum/artifact được lưu.

## Critical path và dependency

```text
Phase 0 baseline/map
  → Phase 1 state + damage + input + save skeleton
    → Phase 2 weapon model + Sword/Bow + swap + Level 1
      → Phase 3 Axe + Chapter 1 + progression
        → Phase 4 Part/rarity/second-Spirit foundations
          → Phase 5 Chapter 2 + Hunt/Challenge/Depth
            → Phase 6 polish/performance/accessibility
              → Phase 7 QA/export
```

Không nên đảo các dependency sau:

- Không sản xuất Levels 2–20 trước khi EncounterDefinition và result/save contract ổn định.
- Không làm Monster Part bằng `if weapon_id` rải rác trước modifier/event hook.
- Không bật rarity trước inventory/save/salvage protection.
- Không làm hai Spirit trước khi single-Spirit event semantics và swap queue đã test.
- Không thêm UI page chỉ để “giữ chỗ”; dùng data-driven locked card trong hub phù hợp.
- Không coi MCP realtime là online infrastructure hoặc progression backend.

## Quy tắc đếm tiến độ nội dung

Một campaign level chỉ được tính hoàn thành khi:

1. Có LevelDefinition + EncounterDefinition + objective/reward rõ.
2. Vào được từ Campaign Map/Level Details với loadout hợp lệ.
3. Chơi được từ spawn tới victory/failure, retry không soft lock.
4. Results cấp reward idempotently và save tiến trình đúng.
5. Có automated smoke phù hợp và manual completion bằng baseline loadout.
6. Không có placeholder bắt buộc, dead button hoặc missing asset.

Theo quy tắc này, tiến độ hiện tại là **0/20 campaign level hoàn chỉnh**; dungeon đang sửa là sandbox nền của Phase 0.

## Quality gate áp dụng sau mọi phase

- Godot parse/load không có script/resource error.
- Gameplay smoke và toàn bộ test của phase trước vẫn qua.
- Không có input action kẹt sau pause, overlay, focus loss hoặc touch cancel.
- Không có node/projectile/effect tồn dư sau restart/scene transition.
- Save cũ được migrate hoặc từ chối an toàn, không reset im lặng.
- Có visual capture hoặc manual checklist cho thay đổi UI/map/VFX.
- Docs, schema và balance data được cập nhật cùng implementation.
- Chỉ đánh dấu milestone complete khi exit gate có bằng chứng, không dựa trên số file đã tạo.
