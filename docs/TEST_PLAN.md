# Test plan

> **SUPERSEDED / LEGACY baseline.** Các case Bow/Axe/Hand/Spirit và số kiểm tra
> bên dưới không còn là release gate. Runner hiện hành là
> `tools/run_full_regression.ps1`; contract SOUL OF HERO nằm trong README và
> `docs/SWORD_HERO_SPEC.md`.

## Mục tiêu

Test plan này bảo vệ vertical slice Phase 0–3 và app shell: dungeon top-down, input semantic, player regression, Sword/Bow/Axe Hand + Spirit, đổi toàn bộ character form AxeWarriorRPG, reward/tutorial, save/unlock/settings, ba enemy Training, AppRoot/Title/Hub/Training/Results, typed content contract và MCP/Live Sync local realtime.

Nó chưa phải acceptance plan cho full Living Arsenal. Axe gameplay, ba enemy prototype, typed content foundation và UI shell đã có, nhưng runtime encounter runner, 20 campaign level, campaign rewards/results và các mode vẫn cần implementation/suite riêng trước khi thay đổi trạng thái **0/20**.

## Gate bắt buộc trước khi bàn giao

| Gate | Lệnh | Điều kiện đạt |
|---|---|---|
| Project parse | Godot headless editor | Exit code 0, không `SCRIPT ERROR`/`ERROR` mới |
| Gameplay/map regression | `tools/run_tests.ps1` | 75/75 hoặc cao hơn, 0 failure |
| Semantic input | chạy `tests/input_map_test.gd` | 40/40, không phím semantic/legacy bind trùng |
| WeaponManager | chạy `tests/weapons/weapon_manager_test.gd` | 51/51, 0 failure |
| Weapon effects | chạy `tests/weapon_effects_test.gd` | 25/25, 0 failure |
| Axe character-form asset | `tools/run_axe_tests.ps1` | 68/68; đủ 30 sheet/149 frame, atlas path và manifest timing đúng |
| Save/Unlock/Settings | `tools/run_save_unlock_tests.ps1` | 72/72, dùng profile test riêng; validation/persistence/reset giữ settings |
| Integrated arsenal (legacy) | `tools/run_living_arsenal_tests.ps1` | **RETIRED** — Bow/weapon contract cũ, không phải production gate |
| Axe combat/resource | `tools/run_axe_tests.ps1` | 19/19 Axe combat/resource; runner đồng thời giữ manager/effect xanh |
| Axe/Knight integration | `tools/run_axe_tests.ps1` | 33/33; full-form swap, scale ổn định qua run→charge→cleave, Axe scale 75%/FreeKnight scale 1.0, collider/camera/transform, hold/release, throw/recall và cleanup đúng |
| Typed content contract | `tools/run_content_contract_tests.ps1` | 48/48, SANDBOX không lọt campaign index |
| Enemy roster | `tools/run_enemy_tests.ps1` | 56/56; ba scene/archetype, frame, L/R flip, telegraph/projectile lock, Vampire confirmed-hit leech/drain và Training map |
| App/UI shell | `tools/run_ui_shell_tests.ps1` | 53/53; AppFlow route/retry/victory-authority contract, Title/Hub, 20-slot structure, icon manifest, roster copy, Axe Training preview và screen instantiation |
| MCP/realtime | `tools/run_mcp_tests.ps1` | lifecycle/auth/schema/subscription/action/tile/reconnect đều pass |
| Manual visual | chạy game desktop | Top-down readability, Bow reward và HUD không che gameplay |

Baseline ngày 14/07/2026 sau AppRoot là **563/563 non-MCP checks**: gameplay 75 + input 40 + manager 51 + effects 25 + character form 68 + Axe/Knight 33 + Axe combat/resource 19 + save/settings 72 + runtime 23 + content 48 + enemy 56 + UI shell 53. MCP lifecycle/auth/schema/subscription/bidirectional/reconnect cũng pass. Nếu số check tăng, điều kiện là không giảm coverage đã có và không có failure.

## Lệnh chạy

Từ thư mục gốc project:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_tests.ps1
```

```powershell
.tools\godot\Godot_v4.7-stable_win64.exe --headless --path . --script res://tests/input_map_test.gd
```

```powershell
.tools\godot\Godot_v4.7-stable_win64.exe --headless --path . --script res://tests/weapons/weapon_manager_test.gd
```

```powershell
.tools\godot\Godot_v4.7-stable_win64.exe --headless --path . --script res://tests/weapon_effects_test.gd
```

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_save_unlock_tests.ps1
```

> `tools/run_living_arsenal_tests.ps1` chỉ còn là diagnostic lịch sử. Không dùng
> kết quả của runner này làm verdict cho Hero Soul/runtime hiện hành.

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_living_arsenal_tests.ps1
```

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_axe_tests.ps1
```

Runner Axe chạy `tests/axe_combat_test.gd`, `tests/weapons/weapon_manager_test.gd`, `tests/weapon_effects_test.gd`, `tests/character_form_asset_test.gd` và chế độ integration `--axe-knight-test` của scene runtime.

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_content_contract_tests.ps1
```

Runner content tải `tests/content/content_contracts_test.tscn`, gắn với `tests/content/content_contracts_test.gd`, dùng save test riêng và ghi report trước khi trả mã thành công.

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_enemy_tests.ps1
```

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_ui_shell_tests.ps1
```

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_mcp_tests.ps1
```

Headless parse:

```powershell
.tools\godot\Godot_v4.7-stable_win64.exe --headless --editor --path . --quit
```

Runner Save/Unlock, Living Arsenal và content đặt `LIVING_ARSENAL_SAVE_PATH` sang `user://tests/...` hoặc profile runtime test trước khi autoload khởi tạo. Không chạy test persistence trực tiếp trên save người chơi.

## Coverage theo hệ thống

### Input semantic

Xác nhận:

- WASD/arrows và Left Stick cùng tạo movement action;
- Attack = J/chuột trái/joy X;
- Skill = K/chuột phải/joy Y;
- Dash = Space/joy A;
- Spirit slot 1/2 = Q/E và LB/RB;
- Interact = F/Back, Pause = Esc/Start;
- alias legacy canonicalize đúng nhưng không giữ physical binding cũ gây double action;
- MCP chỉ dispatch action whitelist.

### WeaponManager contract

Xác nhận:

- loadout có một Hand và tối đa hai Spirit, không duplicate;
- Spirit slot 2 bị khóa cho đến khi feature được mở;
- swap trực tiếp, queued swap, transition 0,25 giây và cooldown 1,5 giây;
- cooldown Hand/Spirit và trigger progress giữ theo weapon ID qua swap;
- raw input không tăng Spirit trigger;
- confirmed attack instance và confirmed Dash chỉ được tính một lần;
- effect đã spawn hoàn tất sau role swap; pre-cast cancellable xử lý đúng;
- save data chỉ chứa ID.

### Integrated Sword/Bow runtime — RETIRED

Contract dưới đây mô tả interaction model cũ trước Soul Relay hiện hành. Giữ
lại để truy vết lịch sử; runner full regression không gọi suite này.

`tests/living_arsenal_runtime_test.gd` kiểm tra trên scene game thật:

1. Sword bắt đầu ở Hand.
2. Bow reward unlock và equip vào Spirit.
3. Sword Attack tạo hit 1 và gây đúng 18 damage một lần.
4. Dash xác nhận kích hoạt Bow Reverse Piercing Shot, để Archer visual tại điểm
   bắt đầu trong 2 giây và nhận Q takeover trong toàn bộ cửa sổ.
5. Q/slot 1 swap Bow vào Hand, Sword sang Spirit.
6. Bow Attack tạo Falling Arrow có delay.
7. Ba confirmed Hand instances kích hoạt Flying Sword.
8. Bow Skill tạo ba projectile xuyên.
9. Sword Dash Slash tạm bỏ collision với unit rồi khôi phục.

Các test manager/effect cô lập kiểm tra nhiều nhánh hơn; runtime test chỉ chứng minh integration giữa player, map, enemy, effects và autoload.

### Axe combat và integration

`tests/axe_combat_test.gd` và chế độ `--axe-knight-test` xác nhận:

- Axe ở Hand đổi toàn bộ sprite player sang `axe_warrior_rpg`; Sword/Bow trở
  lại Hand thì khôi phục `free_knight`;
- đổi form không thay `CharacterBody2D`, collider/collision routing, camera,
  world position hoặc facing; swap ngược không để lại trạng thái Axe;
- `HandWeaponVisual` riêng bị ẩn khi Axe đã baked vào character raster và hiện
  lại sau khi trở về FreeKnight;
- realtime state công bố đúng `character_form` ID, animation library,
  animation/frame và trạng thái baked Hand weapon;
- Heavy Cleave giữ/thả đúng, di chuyển chậm khi charge và quick-release không bị treo state;
- charge tăng damage, arc và stagger theo resource nhưng giữ knockback ở mức Axe;
- Throw & Recall có outbound/return, manual/auto recall và return target bám vị trí player hiện tại;
- khi Axe đang bay, Attack thường bị khóa nhưng movement và Dash vẫn dùng được;
- Cross Cut thêm stagger đúng một lần và cleanup khôi phục Attack;
- Follow-through chỉ nhận confirmed Hand-skill resolution có endpoint hữu ích;
- receipt theo `source_weapon_id + skill_instance_id` ngăn một skill kích hoạt Spirit hai lần;
- unlock Axe kiểm tra ngưỡng campaign level 5 từ definition. Đây chỉ là authority contract; test không chứng minh campaign Level 5 đã tồn tại.

`tests/character_form_asset_test.gd` kiểm tra riêng 30 sheet/149 frame của
variant runtime, đường dẫn atlas, frame count cho từng animation và FPS/loop
đọc từ `source_manifest.json`.

### Typed content contracts

`tests/content/content_contracts_test.gd` xác nhận:

- `EnemyDefinition`, encounter spawn/group/wave/warning/objective/completion và `LevelDefinition` validate dữ liệu bắt buộc;
- ID chuẩn, tham chiếu enemy/encounter/level và campaign slot/order không trùng;
- campaign không phụ thuộc dữ liệu `SANDBOX`, và SANDBOX/invalid status không vào campaign index;
- Skeleton/Crypt mẫu tải được nhưng vẫn là development-only, campaign slot `0`;
- content definition xanh không thay thế runtime encounter runner hoặc manual acceptance của level.

### Save, unlock và reward

Xác nhận:

- default profile chỉ mở Sword, Chapter 1 Level 1 và khóa Spirit slot 2;
- Bow/Axe mặc định khóa;
- Bow reward có transaction key ổn định và replay không cấp lại reward;
- loadout từ chối weapon khóa, duplicate và slot 2 chưa mở;
- temp write được parse trước khi promote;
- backup hợp lệ được dùng khi primary hỏng;
- migration v0→v1 giữ dữ liệu cần thiết;
- tutorial flag đã hoàn tất không phát lại;
- snapshot trả deep copy, không cho caller sửa state sống;
- settings defaults/update được validate và persist;
- reset progression chỉ chạy với token xác nhận và giữ nguyên settings.

### Enemy roster Training

`tests/enemy_roster_test.gd` xác nhận:

- Skeleton Swordsman, Skeleton Reaper và Blood Vampire load đúng scene/archetype/animation frame;
- visual chỉ cần lateral L/R + `flip_h`, còn movement/aim/telegraph vẫn top-down 360°;
- Reaper có line telegraph và spectral disc gây hit lượt đi/về;
- Vampire có lunge/leech/Spirit disruption contract;
- canonical Training JSON/schema chứa đủ ba loại.

56 checks không chứng minh encounter balancing, Elite/Boss, drop table hoặc campaign content.

### AppRoot và UI shell

`tests/ui_shell_test.gd` xác nhận 47 contract cho:

- AppFlow mở Title/Hub/Training Details, tạo active Training run, chuyển Results và clear run khi về Hub;
- Title Continue nối tới Hub; Hub có đúng năm tab và giữ selected tab;
- hai chapter render đủ cấu trúc slot 1–20;
- manifest Shikashi map đúng Sword/Bow/Axe/Campaign icon;
- Bestiary và Training Details ghi đúng Swordsman/Reaper/Vampire;
- Arsenal, Modes, Bestiary, Settings tab, Training Details, Results, Settings screen và Credits đều load/instantiate.

Save/loadout validation nằm trong suite 72 checks; behavior locked/no-dead-button và direct-load test/MCP còn được giữ qua code review/full regression/manual flow, không được suy diễn chỉ từ 53 structural checks.

Đây là structural/navigation regression, không thay manual focus/responsive/touch-device/visual acceptance.

### Settings, display và audio

Xác nhận tự động hoặc manual theo consumer tương ứng:

- panel áp dụng Master/Music/SFX volume và fullscreen; bus UI tồn tại nhưng chưa có slider riêng;
- gameplay load áp dụng joystick opacity/size, button scale và left-handed layout;
- enemy áp dụng telegraph palette/high contrast;
- `default_bus_layout.tres` có bốn bus.

Không đánh dấu audio hoàn thành: vẫn không có ship music/SFX clip và chưa có gameplay cue wiring. Shake, vibration, damage numbers, reduced effects/motion và localization cũng vẫn là gap nếu không có runtime consumer/test riêng. Aim assist đã có consumer/test riêng cho chọn mục tiêu bằng chuột.

### Gameplay/map regression

Giữ suite cũ vì refactor arsenal không được làm hỏng:

- main scene load, 30 FreeKnight animation và movement X/Y;
- footprint floor liên thông, void/tường hợp lệ và entity trên floor;
- collision perimeter/pit;
- damage, combo legacy adapter, dash, death/respawn;
- skeleton LOS/state cơ bản;
- entity hot reload, tile update, write lock và JSON recovery.

### MCP và bidirectional realtime

Xác nhận:

- JSON-RPC lifecycle/stdio đúng protocol;
- workspace token bắt buộc và bridge chỉ bind loopback;
- schema lỗi/rate/message limit bị từ chối an toàn;
- state/event subscription nhận cập nhật runtime;
- player state phản ánh hai chiều form đang chạy qua trường `character_form`,
  bao gồm library/animation/frame và cờ baked Hand weapon;
- `trigger_action` điều khiển semantic Attack/Skill/Dash/Spirit;
- tuning và tile thay đổi runtime → JSON và JSON → runtime;
- `Backdrop`, `Geometry`, `Decor` giữ độc lập khi pull/push/save;
- reconnect phục hồi subscription;
- canonical level hợp lệ và không bị thay đổi ngoài payload test dự kiến.

MCP pass không chứng minh online multiplayer hay cloud deployment; đây chỉ là development tooling local.

## Manual QA checklist

### Desktop gameplay

- Knight đi 8 hướng, không có gravity/platform behavior.
- J/chuột trái nối combo Sword; K/chuột phải tạo Dash Slash.
- Dash Slash đi xuyên unit nhưng không xuyên World geometry.
- Bow reward thức tỉnh sau onboarding, phát sáng trên floor ở hành lang phía Đông và không thể nhận sớm bằng cách chạy thẳng.
- Nhặt Bow làm reward biến mất, HUD Spirit đổi sang Bow.
- Space khi Bow ở Spirit bắn projectile ngược hướng dash.
- Q swap Bow vào Hand; Falling Arrow khóa mục tiêu hợp lý.
- Với profile dev đã mở Axe, đưa Axe vào Hand phải đổi toàn bộ nhân vật sang
  AxeWarriorRPG; swap Sword/Bow trở lại phải phục hồi FreeKnight ngay cả sau
  attack/skill/throw đang cleanup.
- Nếu yêu cầu swap bị từ chối do cooldown/loadout không hợp lệ, presentation
  phải rollback/giữ form hiện tại; một swap ngược hợp lệ sau đó phải khôi phục
  đúng form, animation library và Hand weapon visual trước đó.
- Trong cả hai chiều swap, kiểm tra world position, hướng nhìn, camera và vùng
  collision không nhảy hoặc thay kích thước ngoài ý muốn; Hand weapon rời chỉ
  ẩn ở form Axe và hiện lại ở form FreeKnight.
- Realtime inspector/MCP state phải đổi `character_form.id` cùng frame đang
  phát, không giữ ID hoặc animation library cũ sau swap ngược.
- Bow Skill tạo đúng ba line xuyên và không bị tường/void trình bày sai.
- Sau restart, Bow/loadout/tutorial flag được khôi phục và reward không spawn lại.
- HUD không che player, objective hoặc khu vực chiến đấu chính.
- Chạy flow bình thường phải vào Boot/Title/Hub; Campaign ghi 0/20 và Training không mang nhãn Level 1.
- Mọi route/nút shell hoặc hoạt động, hoặc có locked explanation; không có dead button.
- Training victory đi Results; Retry tạo lại gameplay, Arsenal/Hub thoát run đúng route.
- Volume/fullscreen áp dụng từ Settings; touch layout và enemy telegraph settings có hiệu lực sau khi gameplay load.

### Touch surface

Chạy với:

```powershell
$env:GODOT_FORCE_TOUCH_CONTROLS='1'
powershell -ExecutionPolicy Bypass -File tools/run_game.ps1
```

Xác nhận analog joystick đi đủ 8 hướng; chỉ còn các nút gameplay chính Attack/Skill/Dash/Spirit; mọi control release khi mất focus/ẩn và không có stuck action. Đây chưa thay thế QA trên thiết bị Android thật.

### Top-down visual

- Room/corridor đọc như dungeon nhìn từ trên, không thành dải platform.
- Ngoài footprint và pit là black void.
- Player/enemy shadow bám chân; weapon visual không trôi khỏi owner.
- Geometry chặn movement nhưng Backdrop/Decor không tạo collision bất ngờ.
- Đánh giá AxeWarriorRPG trong room/corridor vì nguồn hiện là side-view hai
  hướng: kích thước, baseline chân và silhouette không được làm scene đọc như
  platform hoặc che mục tiêu chiến đấu.
- Khi Throw & Recall làm projectile rời player, ghi nhận hiện tượng Axe baked
  vẫn còn trong raster là gap đã biết; không coi đây là hành vi production
  được chấp nhận cho đến khi có frame weaponless/throw/recall/catch.

## Artifact và báo cáo

Runner ghi log/report vào `.artifacts/`, gồm tối thiểu:

- `smoke_report.json`
- `save_unlock_report.json`
- `living_arsenal_runtime_report.json`
- `content_contracts_report.json`
- `enemy_roster_stdout.log` / `enemy_roster_stderr.log`
- `ui_shell_stdout.log` / `ui_shell_stderr.log`
- stdout/stderr tương ứng

Không commit save profile hoặc token MCP. Khi test thất bại, giữ log, ghi rõ suite/check đầu tiên lỗi và không đổi baseline thành pass bằng cách xóa assertion.

## Acceptance chưa được phép tuyên bố

Không dùng các suite trên để tuyên bố:

- full game hoàn thành;
- Chapter 1 hoặc Chapter 2 hoàn chỉnh;
- 20/20 campaign level;
- runtime campaign/encounter content, Forge, Parts, Hunt, Challenge, Depth hoặc Bestiary discovery/progression đã hoàn chỉnh;
- Android release-ready;
- MCP là backend online/realtime multiplayer.

Các claim đó chỉ hợp lệ sau khi hệ thống tương ứng có implementation, test tự động và manual acceptance riêng.
