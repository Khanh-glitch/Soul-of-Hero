# Audit dự án LIVING ARSENAL

> **SNAPSHOT LEGACY, không phải trạng thái hiện tại.** Product đã pivot sang
> SOUL OF HERO. Trạng thái canonical nằm ở `README.md`,
> `docs/IMPLEMENTATION_STATUS_V0_4.md` và
> `docs/AUDIT_TONG_THE_PHIEN_CHAT_2026_07_15.md`. Audit asset hiện tại là
> `docs/ASSET_AUDIT.md`.

Ngày cập nhật: 14/07/2026  
Nguồn yêu cầu: `C:\Users\LE QUOC KHANH\Downloads\LIVING_ARSENAL_FULL_GAME_MASTER_PROMPT_EN.md` (đã đọc toàn bộ) và bản chuẩn hoá `docs/LIVING_ARSENAL_MASTER_SPEC.md`  
Engine: Godot 4.7, GDScript, GL Compatibility

## Kết luận điều hành

Dự án hiện là một **vertical slice kỹ thuật top-down có combat prototype Living Arsenal Sword/Bow/Axe chạy được**. Phase 1–3 đã có input semantic, PlayerState rõ ràng, Hand/Spirit weapon model data-driven, swap, Hand Skill/Spirit Action cho ba weapon, Bow reward trong map, Axe unlock authority Level 5, AxeWarriorRPG full-sprite character form, tutorial, weapon HUD, save/unlock có transaction, typed content contracts và test contract/runtime. Roster Training đã có ba enemy user-approved: Skeleton Swordsman, Skeleton Reaper và Blood Vampire với skill theo bản sắc từng silhouette.

Phạm vi này vẫn nhỏ hơn rất nhiều so với master spec. Typed `EnemyDefinition`/encounter contracts/`LevelDefinition`/`LevelRegistry` mới là data foundation với sample SANDBOX, chưa có runtime encounter runner hoặc campaign content. App entry đã chuyển sang `AppRoot`; full-game-shaped UI shell Boot/Title/Hub năm tab/Training Details/Results/Credits và loadout UI đã hoạt động và pass regression. Sự tồn tại của menu/card/locked state **không đồng nghĩa hệ thống gameplay phía sau đã hoàn thành**. Chưa có campaign Level 5 thực tế để trao Axe; Chapter 1–2 vẫn **0/20 level hoàn chỉnh**. Mastery, Monster Forge, Parts, rarity/affix, crafting, Hunt, Challenge, Depth, campaign Bestiary/discovery, audio content/cue wiring, accessibility đầy đủ và Android export vẫn còn thiếu.

MCP/Live Sync hiện hỗ trợ local bidirectional development workflow và semantic action/state streaming. Nó không phải multiplayer, backend online, cloud save hoặc cơ chế tự triển khai production.

### Quy tắc gọi tên content hiện tại

- `data/levels/crypt_entrance.json` và gameplay scene hiện có là **Training / Test Build**.
- Training dùng để thử map, ba weapon, swap, reward Bow, tutorial, ba enemy và realtime bridge. Nó không được tính là campaign Level 1.
- Campaign chỉ tăng từ 0/20 khi một level có encounter sequence, objective/failure, reward transaction, results, replay/next-level flow và được playtest theo acceptance.
- Một grid 20 node hoặc 20 card `MISSING/DRAFT` trong UI là roadmap hiển thị, không phải 20 level đã triển khai.

## Baseline kiểm chứng

| Hạng mục | Trạng thái hiện tại |
|---|---|
| Main scene | `game/app/app_root.tscn`; normal run đi Boot→Title→Hub, test/MCP direct-load gameplay để giữ automation; UI shell 53/53 |
| Viewport | 640×360, override 1280×720, `canvas_items`, GL Compatibility |
| Project scale | 88 script `.gd`, 38 scene `.tscn`, 9 resource `.tres` (gồm audio bus layout), 118 PNG tại snapshot audit |
| Autoload | `InputBootstrap`, `GameEvents`, `GameSession`, `SaveService`, `UnlockService`, `RealtimeBridge`, `AppFlow` |
| Player | Stable Knight entity với form `free_knight` mặc định và `axe_warrior_rpg` cho Axe Hand; movement top-down 8 hướng, PlayerState và WeaponManager |
| Weapon resource | `sword.tres`, `bow.tres`, `axe.tres` |
| Content data | Typed Enemy/Encounter/Level contracts + `LevelRegistry`; sample `data/content/` là development-only/SANDBOX |
| Map canonical | `data/levels/crypt_entrance.json`, schema v2, 100×72 |
| Map content | 3.136 floor cell, 756 geometry cell, 24 decor cell, 30 entity, black void ngoài footprint |
| Bow reward | Entity `bow_reward` ở hành lang phía Đông, gate sau onboarding; unlock/equip/save idempotent |
| Save | Schema v1 tại `user://living_arsenal_save.json`, temp/backup/recovery/migration; settings validation/persistence và reset progression giữ settings |
| Plugin editor | `addons/live_sync`, ba layer Backdrop/Geometry/Decor |
| Local realtime | Authenticated WebSocket loopback + MCP stdio adapter, state/event/action/tile hai chiều |
| Export | Chưa có `export_presets.cfg`; chưa có bằng chứng Android profile/signing |
| Enemy roster | Training có 3 Swordsman + 1 Reaper + 1 Vampire trong canonical JSON; enemy roster test gần nhất 56/56 |
| Campaign | **Training/Test Build**, không phải Level 1; **0/20 campaign level hoàn chỉnh** |
| App shell | Boot→Title→Hub năm tab→Training Details→Gameplay→Training Results; Credits; loadout chức năng; Modes locked; Bestiary ba enemy |
| Audio | `default_bus_layout.tres` có Master/Music/SFX/UI; 0 ship clip và chưa wire gameplay/UI cue |

## Phần đã triển khai trong Phase 1–3

### Input và player contract

- Input gameplay dùng `attack`, `skill`, `dash`, `spirit_swap_1`, `spirit_swap_2`, `interact`, `pause` và movement semantic.
- Desktop: J/chuột trái Attack, K/chuột phải Skill, Space Dash, Q/E Spirit slot, F Interact; joypad tương ứng X/Y/A/LB/RB/Back.
- Action legacy vẫn tồn tại làm alias cho test và bridge cũ, nhưng phím vật lý không còn bind trùng.
- `KnightController` có state `IDLE/MOVE/ATTACK/SKILL/DASH/HURT/SWAP/INTERACT/DEAD` và vẫn giữ physics/facing/camera/health/animation/respawn.
- MCP `trigger_action` chấp nhận semantic action; realtime snapshot trả thêm state, weapon runtime state và `character_form`.

### WeaponDefinition và WeaponManager

- `WeaponDefinition` ghép attack, Hand skill, Spirit trigger, Spirit action và target rules.
- `WeaponManager` quản lý 1 Hand + tối đa 2 Spirit, direct swap theo slot, transition 0,25 giây, shared cooldown 1,5 giây và queued swap khi action không thể ngắt.
- Cooldown/trigger progress được giữ đúng khi đổi vai trò; effect đã tạo được phép hoàn tất sau swap.
- Trigger chỉ tiến triển từ confirmed event, không từ raw input.
- Loadout serialize ID; không ghi `Node`, `Resource`, `RID` hoặc scene reference vào save.
- Signal `loadout_changed` refresh character form ngay cả khi loadout được configure/equip trực tiếp ngoài flow swap input.

### Sword hoàn thành trong phạm vi vertical slice

| Vai trò | Hành vi đã có |
|---|---|
| Hand Attack | Combo ba hit, damage 18/20/32 |
| Hand Skill | Dash Slash 44 damage, 96 px/0,18 giây, cooldown 4 giây, bounded invulnerability và bỏ unit collision tạm thời |
| Spirit Trigger | Sau 3 Hand attack instance được tạo xác nhận |
| Spirit Action | Flying Sword 28 damage, cooldown 2,5 giây, chọn target rồi bay về orbit |

### Bow hoàn thành trong phạm vi vertical slice

| Vai trò | Hành vi đã có |
|---|---|
| Hand Attack | Falling Arrow 22 damage, khóa/predict vị trí, delay 0,35 giây, forgiving radius 18 px |
| Hand Skill | Triple Piercing Volley, 3 projectile xuyên, 32 damage, cooldown 6 giây, fallback spread ±14° |
| Spirit Trigger | Một Dash xác nhận cùng vector dash |
| Spirit Action | Reverse Piercing Shot 24 damage, cooldown 2 giây, bắn ngược hướng dash không cần target |

Bow được biểu diễn bằng visual code-native ở Hand/Spirit và reward world entity. Đây là implementation gameplay có thể kiểm thử; chưa phải bộ sprite/animation sản xuất cuối cùng cho cung.

### Axe hoàn thành trong phạm vi combat prototype

| Vai trò | Hành vi đã có |
|---|---|
| Hand Attack | Heavy Cleave press/hold/release, slow khi charge, quick release hợp lệ, scale damage/arc/stagger |
| Hand Skill | Throw & Recall lượt đi/về, recall thủ công/tự động về vị trí player hiện tại, cho phép movement/dash và khóa normal attack khi Axe rời tay |
| Cross Cut | Giao cắt đường đi/đường về tạo thêm stagger và feedback |
| Spirit Trigger | Một receipt duy nhất cho mỗi `source_weapon_id + skill_instance_id` có endpoint hợp lệ |
| Spirit Action | Follow-through tới endpoint của Hand skill rồi quay lại, damage ở cả hai lượt |

Axe đã nối save/HUD/runtime và có `unlock_campaign_level = 5`. Đây là authority/gate có test, không phải bằng chứng rằng campaign Level 5 hoặc reward flow Level 5 đã tồn tại.

Khi Axe ở Hand, toàn bộ player sprite đổi sang form `axe_warrior_rpg`, dùng runtime subset AxeWarriorRPG **Colour1/Outline** gồm 30 PNG sheet/149 frame. Form Axe dùng presentation scale 75% và rest anchor riêng để giữ foot baseline; swap về Sword/Bow khôi phục `free_knight` cùng scale/anchor mặc định. Pha giữ lực khóa pose AttackNoMovement đứng cao và chuỗi Bổ Nặng dùng cùng strip 4 frame, tránh frame Attack2 thấp 28 px gây cảm giác co nhỏ khi chuyển từ chạy sang đánh. Position, facing, collider, camera và gameplay entity được giữ nguyên. Vì Axe bake trong raster, Hand weapon visual procedural được ẩn ở form này.

Đây mới là integration kỹ thuật, chưa phải production art top-down đã release-clear: nguồn là side-view hai hướng; runtime đã cân chiều cao nhưng silhouette rìu vẫn rộng so với dungeon. Throw & Recall còn trùng Axe bake trên nhân vật với projectile do thiếu frame weaponless/throw/catch. Sword/Bow vẫn cùng dùng FreeKnight. Provenance/license AxeWarriorRPG chưa đủ bằng chứng để phát hành thương mại.

### Combat service và effect

- `TargetingService` lấy target theo yêu cầu, có facing cone, range, prediction và low-health bias; manager không global-scan mỗi frame.
- `CombatDamage` chuẩn hóa confirmed damage/hit context.
- Falling Arrow, Piercing Arrow, Flying Sword, Axe Throw và Axe Follow-through là scene effect độc lập, phát signal hit/completed.
- Melee Sword dùng hit window, target deduplication và line-of-sight hiện hữu; Dash Slash khôi phục collision deterministically.

### Save, unlock, reward và tutorial

- `SaveService` schema v1 ghi atomic qua `.tmp`, validate, rotate `.bak`, recover backup và có migration v0→v1.
- `transact_once()` chống áp reward trùng; `set_loadout()` kiểm tra weapon đã mở, duplicate và gate Spirit slot 2.
- Default profile: Sword mở; Bow/Axe khóa; Chapter 1 Level 1; Spirit slot 2 khóa. Debug/editor Arsenal có Training-only Axe preview unlock để kiểm thử character swap; nó không phải campaign reward và không xuất hiện ở release build.
- `UnlockService` là API duy nhất để query/mở weapon và feature.
- Axe chỉ được cấp qua unlock authority khi campaign progress đạt Level 5; project chưa có campaign Level 5 thực tế.
- Bow reward dùng transaction key ổn định, tự equip vào Spirit slot 1 và biến mất ở profile đã mở.
- Tutorial event-driven lưu từng bước: movement, Attack, Dash Slash, Dash, Bow reward, Bow Spirit và swap.

### HUD

- Weapon panel hiển thị Hand name, normal attack, Skill cooldown, Spirit name, trigger progress/action cooldown và swap cooldown.
- Mobile surface dùng analog virtual joystick cùng Attack/Skill/Dash/Spirit thay cho dãy nút prototype cũ; desktop vẫn ẩn touch controls mặc định.
- App shell dùng atlas Shikashi và Godot theme/StyleBox; Arsenal/loadout, Hub và Training Results đã hoạt động.
- Settings áp dụng audio/fullscreen ngay; touch opacity/size/button scale/left-handed layout được áp dụng khi gameplay load; enemy nhận palette/high-contrast telegraph. Radial polish, safe-area/device QA, font production và nhiều accessibility consumer vẫn thiếu.

## Phần nền tiếp tục tái sử dụng

### Map và runtime composition

- `main.gd` spawn entity từ JSON theo stable ID và giữ actor không đổi qua hot reload.
- `DungeonLevel` validate schema rồi tạo ba `TileMapLayer`; Geometry là lớp collision duy nhất.
- Dungeon có footprint phòng–hành lang top-down, pit và black void, không còn bố cục dải platform.
- 0x72 DungeonTileset II v1.7 có notice CC0 tại `assets/environment/dungeon_0x72/THIRD_PARTY.md`.

### Enemy và world object

- Skeleton Swordsman có `PATROL/CHASE/ATTACK/HURT/DEAD`, LOS, cooldown, separation và knockback; phủ vai trò melee Chaser cơ bản.
- Skeleton Reaper dùng `PATROL/CHASE/TELEGRAPH/STRIKE/RECOVER/HURT/DEAD`, giữ cự ly, strafe/retreat, telegraph đường ném và spectral disc gây hit lượt đi/về.
- Blood Vampire dùng cùng state-machine nâng cao, báo đường lunge, hồi máu khi trúng và rút một nấc Spirit trigger progress. Đây là Spirit disruption có warning, không phải disable toàn bộ Arsenal.
- Cả ba dùng visual lateral trái/phải + `flip_h` theo quyết định người dùng; movement/targeting/telegraph vẫn là top-down 360°. Không còn yêu cầu asset N/S hay bốn hướng.
- `advanced_enemy.gd` cache neighbor 0,22 giây; riêng Skeleton Swordsman vẫn quét group trong separation mỗi physics tick và cần refactor trước density lớn. Profile Reaper/Vampire vẫn là Dictionary trong script, chưa đạt yêu cầu data resource của master prompt.
- Coin, sigil, chest, checkpoint, exit gate, spikes, torch và Bow reward là scene nhỏ, độc lập.
- Layer collision: World, Player, Enemy, PlayerHitbox, EnemyHitbox, Interactable, Hazard.

### Content data foundation

- Typed `EnemyDefinition`, encounter spawn/group/wave/warning/objective/completion contracts, `LevelDefinition` và `LevelRegistry` có validation.
- Sample Skeleton/Crypt trong `data/content/` được đánh dấu development-only/SANDBOX và không đi vào campaign index.
- Chưa có runtime encounter runner, chưa cross-check spawn marker/region với map JSON và Skeleton runtime chưa được definition điều khiển.

### Live editing và MCP

- Level/tuning được validate trước apply/persist.
- Live Sync chọn từng layer, pull/push không phá hai layer còn lại, có conflict detection và backup/recovery.
- RealtimeBridge chỉ listen loopback, xác thực workspace token, giới hạn message/rate, stream state/event và dispatch action/tuning/tile/reload/save.
- Adapter MCP có lifecycle, auth, resource subscription, reconnect và bidirectional tests.

## Trạng thái theo miền master spec

Quy ước: “shell” nghĩa là màn hình/navigation/locked card có thể tồn tại nhưng system phía sau chưa có; không được cộng shell như gameplay completion.

| Miền yêu cầu | Trạng thái kiểm chứng | Hiện có | Gap bắt buộc để đạt master prompt |
|---|---|---|---|
| True top-down map/camera | **Foundation verified** | Footprint phòng–hành lang, void, collision, camera ổn định, atlas 0x72 | Door/high-wall module, foreground occlusion/y-sort, lighting/decor polish, nhiều module cho campaign |
| Visual direction contract | **Decision verified** | Movement 8 hướng; body hero/enemy visual L/R + flip; hitbox/projectile/telegraph 360° | Đồng bộ foot anchor/shadow/scale để không còn cảm giác platform; không cần asset N/S hoặc 4 hướng |
| Input desktop/mobile | **Playable prototype** | Input Map semantic, keyboard/mouse/joypad, joystick và Attack/Skill/Dash/Spirit | Hold/drag aim UI, touch safe-area presets, left-hand layout runtime QA, device test |
| Player state machine | **Playable prototype** | `IDLE/MOVE/ATTACK/SKILL/DASH/HURT/SWAP/INTERACT/DEAD` | Input buffering sâu hơn, transition/animation QA trên toàn content, polished defeat flow |
| Weapon data model | **Foundation verified** | Definition/profile/rules/manager/events/save IDs cho Sword/Bow/Axe | Tất cả balance chuyển về resource/central data; authoring/content validation cho future weapon |
| Sword | **Playable vertical slice** | Combo 3 hit, Dash Slash, three-attack Spirit trigger, Flying Sword | Production art/VFX/SFX/hit-stop/readability/balance pass |
| Bow | **Playable vertical slice** | Falling Arrow, Triple Volley, reverse-dash Spirit, Bow reward | Production sprite/impact marker/audio, aim assist/drag polish, campaign unlock flow thật |
| Axe | **Playable combat prototype** | Heavy Cleave, Throw/Recall, Cross Cut, Follow-through, full form swap | Weaponless throw/catch frames, duplicate-Axe visual fix, proof license, Level 5 content/reward thật |
| Swap/cooldown persistence | **Contract verified** | Direct slot swap, queue, 0,25 s transition, 1,5 s shared cooldown, progress/cooldown preservation | End-to-end dual-Spirit unlock/onboarding and combat HUD with two direct icons |
| Second Spirit slot | **Architecture/gate only** | Manager/save/loadout support tối đa hai Spirit, slot 2 locked by default | Level 10 boss reward, transaction, guided Chapter 2 encounter, dual-trigger readability |
| Baseline combat feel | **Partial** | Damage/stagger/knockback hooks và một số code-native trails/feedback | Audio, hit particles, damage-number option, shake/vibration, reduced flashes/motion, profile tuning |
| Basic enemy roster | **3 integrated prototypes** | Swordsman melee, Reaper returning ranged disc khóa theo telegraph, Vampire chỉ leech/drain sau confirmed hit; 56-check suite | Data-resource profiles, Swordsman scan optimization, encounter tuning, production VFX/SFX/drop/bestiary data |
| Prompt Chaser/Dasher/Shooter roles | **Partially covered by approved roster** | Swordsman≈Chaser, Vampire≈Dasher/disruptor, Reaper≈Shooter | Explicit acceptance/tuning for missing details: melee anticipation, wall-miss vulnerable state, projectile/recovery behavior |
| Elite Captain + Chapter 1 boss | **Missing** | Không có production encounter/AI/content | Elite pattern/summons; boss hai phase; rewards; tests; art/audio |
| Chapter 2 enemies/elite/boss | **Missing** | Vampire đã thử Spirit drain trong Training, không phải Chapter 2 content | Bulwark, Venom role, Spirit Leech scope/variant decision, elite, boss, data-driven patterns |
| Encounter system | **Data contracts only** | Spawn/group/wave/warning/objective/completion resources + registry validation | Runtime runner, active cap/timing, marker validation, objectives, gates, rewards, cleanup |
| Campaign | **0/20** | Một Training/Test Build, không phải campaign level | 2 chapter × 10 level, objective/optional challenge, reward/result/replay, manual playtest từng level |
| Boot/Title/Hub shell | **Functional shell verified** | `AppRoot`/`AppFlow`, Boot/Title/Hub năm tab, Settings/Credits; UI suite 53/53 | Manual responsive/controller/touch/focus/visual acceptance; production identity/polish |
| Campaign map/Level Details | **Honest shell / incomplete content** | Campaign ghi 0/20; 20 slot MISSING không launch; Training Details có route thật | 20 `LevelDefinition`, chapter progression, reward/enemy/objective data và launch flow thật |
| Arsenal/Loadout | **Functional foundation** | Equip/save validation qua UI, weapon/slot locked state và detail cơ bản | Mastery/Part/rarity/Forge disclosure khi system tồn tại; controller/touch/manual QA |
| Results/victory/defeat | **Functional cho Training** | Score/sigil/time; Retry/Arsenal/Hub; không commit campaign reward | Idempotent campaign rewards, Next Level, major unlock hierarchy, objective/failure cases |
| Mastery | **Missing** | Chỉ có hook/metadata foundation | XP sources, 3 tracks, sidegrades, UI, save, balance/test |
| Monster Forge/Parts | **Missing** | Compatibility hook metadata; no functional Part inventory/socket | 3 Parts × 3 weapons × Hand/Spirit behaviors, equip/remove, preview, save, source/hunt/pity |
| Rarity/affix/inventory | **Missing** | Không có item-instance/generation pipeline | Four tiers, compact affix pool, compare/filter/favorite/lock/auto-salvage/Lost Loot/save |
| Currency/crafting/salvage | **Missing** | Coin/score demo không phải economy | Purposeful currencies, duplicate rules, crafting/reroll preview, protected-item safety |
| Progression/unlock | **Foundation only** | `UnlockService`, transaction rewards, Bow/Axe/slot gates | Data-driven feature timeline tied to real levels/results; focused onboarding for each unlock |
| Hunt | **Missing; shell may be locked** | Không có target mission/runtime/reward | Functional Chapter 2 mode, drop chance/fragments/pity/source display/replay |
| Challenge | **Missing; shell may be locked** | Không có mission generation/score save | Seeded rotation, modifiers/objectives/restrictions/local best and future ranking contract |
| Depth | **Missing; shell may be locked** | Không có room sequence/checkpoint/scaling | Post-Level-20 runtime, room types, modifiers, bosses, checkpoints/rewards/save |
| Bestiary | **Static Training shell verified** | Card Swordsman/Reaper/Vampire đúng roster | Discovery/save, behavior/telegraph/drop/Part data, silhouettes, Hunt access, all campaign enemies |
| Settings/accessibility | **Partial runtime verified** | Validated defaults/update/reset giữ settings; audio/fullscreen; touch layout ở gameplay load; enemy palette/high contrast; save suite 72/72 | Shake, vibration, damage numbers, aim assist, reduced effects/motion, localization và device accessibility QA |
| Audio | **Routing foundation only** | `default_bus_layout.tres` có Master/Music/SFX/UI; settings điều chỉnh Master/Music/SFX, bus UI chưa có slider riêng | Ship clips, AudioManager/event map, gameplay/UI cue wiring, hub/combat/elite/boss states, legal assets |
| Save robustness | **Foundation verified** | Schema v1, safe defaults, atomic temp/backup/recovery, migration, transactions, settings update/reset | Inventory/Parts/rarity/mastery/modes/bestiary/pity/result idempotency and future migrations |
| Debug tools | **Partial via tests/MCP** | Semantic actions, snapshots, tuning/tile/reload tools | Hidden in-game developer panel, spawn/content controls, export guard |
| MCP/Live Sync | **Local development verified** | Authenticated loopback, state/event/action/tile bidirectional, reconnect tests | Dev-only export guard; this is not multiplayer/cloud/deployment |
| Long-term content pipeline | **Typed foundation** | Enemy/encounter/level resources and registry sample | Runtime consumers, templates/examples for boss/Part/mastery/Hunt/Challenge/Depth, validation CI |
| Android/export/performance | **Missing** | Landscape logical viewport, GL Compatibility | Export preset/orientation/signing, safe area, touch/device QA, performance budget/profile |
| Full acceptance/QA | **Not started at product scale** | Automated prototype suites | Manual all-20-level playthrough, every build/Part/mode, scene cleanup, save corruption/reward duplication/mobile profiling |

## Kiểm thử hiện có

| Suite | Phạm vi | Kết quả gần nhất được ghi nhận |
|---|---|---:|
| Gameplay smoke | Map, player legacy regression, entity, hot reload/write recovery | 75/75 |
| Input Map | Semantic bindings, aliases, keyboard/mouse/joypad | 40/40 |
| WeaponManager contract | Swap, queue, cooldown, trigger, persistence contract | 51/51 |
| Weapon effects | Targeting/effect lifecycle và damage | 25/25 |
| Character-form asset | 30 AxeWarriorRPG sheets, 149 frame, atlas source, manifest timing và Axe definition form ID | 68/68 |
| Save/Unlock smoke | Defaults, unlock, idempotency, backup recovery, migration, Axe Level 5 authority, settings validation/persistence, reset giữ settings | 72/72 |
| Living Arsenal runtime | Sword/Bow reward, Hand/Spirit actions, confirmed projectile routing, swap, Dash Slash collision | 23/23 |
| Axe Knight integration | Full form swap/restore, collider-state preservation, realtime form, scale ổn định run→charge→cleave, throw, recall và skill receipt | 33/33 |
| Axe combat/resource | Heavy Cleave, Throw & Recall, Cross Cut, Follow-through và resource validation | 19/19 |
| Content contracts | ID/status/registry, enemy/encounter/level validation và SANDBOX isolation | 48/48 |
| Enemy roster | Ba scene/archetype, frame counts, telegraph lock, flip L/R, confirmed-hit leech/drain, spectral disc, canonical map/schema | 56/56 |
| UI shell | Boot/Title/Hub/Campaign/Arsenal/Modes/Bestiary/Settings/Level Details/Results/Credits navigation/retry/victory authority/debug preview | 53/53 |
| MCP suites | lifecycle/auth/schema/subscription/bidirectional/reconnect | Pass |

Full regression sau AppRoot ghi nhận **563/563 non-MCP checks pass**. MCP lifecycle/auth/schema/subscription/bidirectional/reconnect cũng pass. Các con số này chứng minh foundation/vertical slice và UI shell hiện tại, không phải acceptance test cho full game hoặc 20 level. Lệnh và gate chi tiết nằm trong [TEST_PLAN.md](TEST_PLAN.md).

## Rủi ro còn lại

| Rủi ro | Mức | Giảm thiểu |
|---|---:|---|
| KnightController vẫn chứa adapter legacy và weapon orchestration | Cao | Tiếp tục chuyển behavior sang component/effect, giữ characterization test trước mỗi refactor |
| Hai nguồn action profile mới/legacy cùng tồn tại | Trung bình | Không thêm content mới vào legacy profiles; xóa từng phần sau khi regression contract được thay thế |
| Có content definitions nhưng chưa có runtime encounter runner | Rất cao cho campaign | Xây runner, marker/region validation, objective/gate/reward execution trước khi sản xuất hàng loạt 20 level |
| UI shell có thể khiến 20 card trông như 20 level thật | Rất cao cho product truth | Gắn `MISSING/DRAFT/LOCKED` rõ, chỉ enable Start cho Training/content có definition + encounter + result; giữ campaign count 0/20 trong audit |
| Enemy Reaper/Vampire dùng profile Dictionary hard-code; Swordsman còn group scan mỗi physics tick | Cao khi tăng density/content | Chuyển mọi profile sang `EnemyDefinition`/balance resource, cache neighbor/spatial query và benchmark active cap trước campaign |
| AxeWarriorRPG là lateral hai hướng, silhouette rìu rộng và bake Axe trong frame Throw/Recall; Sword/Bow cùng dùng FreeKnight | Cao cho cảm giác sản phẩm | Giữ contract visual L/R, duyệt scale/foot origin/shadow top-down, thêm weaponless throw/catch và character form presentation nhất quán; không yêu cầu N/S |
| MCP/Live Sync có thể lọt shipping build | Trung bình | Thêm dev feature flag/export guard trước release |
| Chưa có audio clip/cue wiring, export hoặc mobile device QA | Cao | Dùng bus layout hiện có, thêm legal audio + event map, test device thật và budget performance |
| License/provenance AxeWarriorRPG, FreeKnight và enemy chưa có evidence snapshot đầy đủ trong repo | Cao khi phát hành | Enemy có source page/hash đã audit nhưng vẫn phải lưu snapshot/notice; Axe/FreeKnight phải xác minh grant trước commercial release; test kỹ thuật không phải license clearance |

## Gate tiếp theo

1. Xây runtime encounter runner và cross-check marker/region với map JSON trên typed content contracts hiện có; đồng thời chuyển profile ba enemy sang resource.
2. Tạo campaign Level 1 thật với encounter, objective/failure, reward transaction, campaign Results và replay; chỉ khi đạt acceptance mới đổi 0/20 thành 1/20.
3. Đóng gói proof cho Pixel_Poem enemy và Shikashi; dùng atlas/icon local theo [ASSET_AUDIT.md](ASSET_AUDIT.md), không tải thêm pack HUD/enemy ở P0.
4. Thêm legal audio clip, event/cue map và wire gameplay/UI vào bốn bus đã có; tiếp tục runtime wiring cho các accessibility setting còn thiếu.
5. Tạo campaign Level 2–5 thật, bao gồm flow mở Axe ở Level 5, trước khi mở rộng Chapter 1.
6. Giữ full non-MCP + MCP regression sau mỗi thay đổi AppRoot/gameplay; UI shell pass không được dùng để miễn manual responsive/device QA.

Không tuyên bố full game trước khi Chapter 1–2 đủ 20 level và các flow bắt buộc trong master spec được triển khai và kiểm thử.
