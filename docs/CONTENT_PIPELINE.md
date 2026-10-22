# LIVING ARSENAL — Content pipeline

Pipeline này giữ content ngoài player script và tránh sản xuất 20 level trước khi data contract ổn định. Mọi ID là `snake_case`, ổn định sau khi ship và là thứ được lưu; Node/Resource/RID sống không được đưa vào save.

## Thứ tự an toàn

```text
contract/resource → validation test → placeholder runtime → gameplay test
→ asset import + license manifest → visual/audio pass → campaign registration
```

Không đánh dấu campaign-complete nếu chỉ có map geometry.

## Thêm weapon

1. Tạo `game/weapons/data/<weapon_id>.tres` từ `WeaponDefinition`.
2. Điền normal attack, Hand skill, Spirit trigger, Spirit action và target rules; tất cả timing/damage/cooldown nằm trong resource.
3. Dùng behavior/effect component riêng cho cơ chế mới; player chỉ điều phối state/input và confirmed events.
4. Đăng ký stable ID trong weapon catalog/registry và SaveService sanitizer.
5. Thêm unlock condition/transaction trong LevelDefinition, không auto-unlock theo việc file tồn tại.
6. Thêm visual fallback, HUD icon/description và animation mapping.
7. Test validation, Hand behavior, Spirit trigger, swap during cooldown/effect, save restore và cleanup.

Checklist WeaponDefinition:

```text
ID/display/unlock
normal attack + movement permission + target rules
Hand skill + cooldown + resolved context
Spirit confirmed-event trigger + deduplication
Spirit action + cancel/role-swap behavior
animation/SFX/VFX/projectile references
mastery/Part/rarity compatibility tags
Hand/Spirit UI descriptions
```

## Thêm enemy

1. Tạo EnemyDefinition với role, stats, movement, attack IDs, telegraph, scene và rewards.
2. Mỗi dangerous attack phải có anticipation/telegraph và recovery state đọc được.
3. Scene dùng collision layer/mask canonical, group `enemies`, deterministic death/cleanup.
4. Tách behavior khỏi art; animation set chỉ ánh xạ states.
5. Thêm Bestiary/Hunt metadata nhưng feature giữ gated.
6. Test damage, death once, pause/death freeze, navigation/separation và missing asset fallback.

Skeleton hiện tại là prototype và không tự động trở thành production Chaser chỉ vì có animation.

## Thêm encounter

EncounterDefinition cần:

- stable ID và ordered groups/waves;
- spawn references/positions theo level marker ID, không hard-code node path tạm;
- warning/pre-delay, completion rule và timeout/fail behavior;
- objective/gate contract;
- reward candidates, elite/boss tags và deterministic seed policy;
- validation cho missing enemy/marker, duplicate group ID và wave không thể hoàn tất.

Runtime chỉ mở gate/complete objective sau confirmed encounter completion, không dựa vào `get_nodes_in_group()` một lần rồi suy luận.

## Thêm campaign level

1. Dựng map JSON v2 với `Backdrop`, `Geometry`, `Decor`, gameplay entities/markers.
2. Validate tile source/atlas/collision và connected walkable footprint.
3. Tạo LevelDefinition: chapter/index, map scene/data, encounter IDs, objectives, optional objective, rewards/unlocks, recommended mastery, next level.
4. Đăng ký vào LevelRegistry; registry từ chối duplicate ID/chapter-index và missing dependency.
5. Nối Level Details → Loadout → Gameplay → Results bằng ID.
6. Chạy desktop + touch, victory/defeat/retry, save/reload và reward idempotency.

Definition of done một level:

```text
playable start-to-result
encounters/objective/gate cannot soft-lock
major reward is idempotent
optional objective records correctly
retry preserves loadout and permanent progression
next level unlocks only on valid victory
no missing resource, orphan effect, console error or HUD clipping
```

## Map/live-sync authoring

- Canonical data: `data/levels/<level_id>.json`.
- Runtime loader: `game/levels/dungeon_level.gd` + schema validation.
- Live Sync đồng bộ cả ba layer theo hai chiều nhưng không thay thế version control/backup.
- Khi push runtime → JSON, dùng expected signature/write lock; khi JSON → runtime, validate trước khi mutate.
- Map ngoài footprint là black void; không dùng platform silhouette cho wall/floor.

Xem `docs/LEVEL_DESIGN.md` và `docs/MCP_REALTIME.md`.

## Asset import

Trước khi tải/tạo, chọn backlog item trong [ASSET_AUDIT.md](ASSET_AUDIT.md). Mỗi set phải có:

- native grid/canvas, directions, frame count/FPS, fixed pivot/foot anchor;
- PNG RGBA nearest/no mipmap hoặc WAV/OGG profile đúng loại;
- source file nếu có và manifest animation tags;
- license proof trong `assets/licenses/<asset_id>/`;
- prompt + edit log nếu generated.

Không ghi đè placeholder ngay. Import set mới, chuyển reference, chạy smoke/visual check, rồi mới archive placeholder.

## Content validation gates

- Resource `get_validation_errors()` trả rỗng.
- Stable ID không trùng và dependency tồn tại.
- Mọi PackedScene/Texture/Audio reference load được trong headless editor parse.
- Save sanitizer xử lý ID cũ/missing an toàn.
- Automated suite cho contract; runtime test cho hành vi; screenshot/mobile pass cho readability.
- README/changelog/audit chỉ cập nhật sau khi gate xanh.

## Templates cần tạo cùng Phase 3+

Khi các contract đã ổn định, giữ example canonical cho:

```text
weapon + Spirit trigger/action
enemy + dangerous attack
encounter group + elite/boss
campaign level + optional objective + reward
Monster Part + compatibility behavior
rarity modifier + mastery node
Hunt target + Challenge + Depth modifier
```

Example phải chạy validation nhưng không được giả làm content campaign đã hoàn tất.

