# SOH — PHÂN QUYỀN, MỐC GIT VÀ THỨ TỰ TÍCH HỢP v10

**Mốc xác nhận trong lượt kiểm tra 04/11/2026** — phải refresh bằng API GitHub ở đầu session Agent, SHA có thể thay đổi. Không chạy trên seed branch/old preview rồi tuyên bố production.

| Stream | Branch/PR được xác nhận | HEAD tại lúc kiểm tra | Phạm vi |
|---|---|---|---|
| Web Gameplay | `arena/d4bfcfff-soul-of-hero` / PR44 open DRAFT | `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4` | Web TS; UID/action/economy/UI/save, chưa phải native |
| VFX | `arena/3337c864-soul-of-hero` / PR39 open | `3158f0c427570794e6d69fe72c1f701b26ceb384` | 244 PixelFX manifest, ARCANA20, compositor, FX Lab, presentation |
| Map Veyra | `arena/2e3cfbd2-soul-of-hero` (ownership độc lập) | `fdd4a2bae9f81a3c1d8c63d091b6fe23265c7584` | World geography, biome, road, bridge, river, collision, POI physical geometry |
| Native A0/A3/A6/A7/A8 | Control Tower quyết định owner pins | `NOT_REVERIFIED` | Godot 4.7, authority bền vững, native scene, art, code và production integration |

Dữ liệu khác nhau trong Web/native phải nêu rõ; một screenshot Web không đủ chứng minh Godot production được nghiệm thu.

## Tách rõ quyền triển khai

- **Gameplay:** authoritative action ID, Core UID, type-aware ammo, loaded reserves, actual damage/target/AI states, terrain/event intents, cancel/commit, anti-farm and save.
- **Economy/A3:** catalog/recipes/source stock, energy craft+loot, market/parts/recycler, source receipts, efficiency and balance; có contract với Gameplay, không tự xóa logic native.
- **AVFX:** chọn sprite/ARCANA đúng ID, 244 PixelFX inventory; timeline/scale/pixel geometry/lighting/audio, FX Lab; không được tự mint wood/gây damage bằng shader. Contract input là event receipts từ Gameplay.
- **Map:** tọa độ vật lý, nước/vách/cầu/cây/các lớp đất, biome resource opportunity, POV/POI footprint và pathing. Gameplay không tự thêm 7 spawn point Elder nếu chưa có site được duyệt.
- **A0/native integration:** hợp đồng run/save/cross-owner migration, các regression scene native, build Godot, checkpoint handoff; không merge khi chưa có 7 chiều nghiệm thu.
- **A7/QA:** check hành vi và hình ảnh trong game thật, không thay nguyên tắc sản phẩm; nếu sai phải nêu first failing gate và owner.

## 10 vertical slices (dependency topo, không phải 10 PR riêng)

| Lượt | Nội dung | Điều kiện GO | Bằng chứng bắt buộc |
|---|---|---|---|
| V0 | Recover v5/v6, refresh live SHA, reconcile Bible/v10, ownership, baseline | Không sửa code trước khi xác minh scope | hash, manifest, branch pins, source concordance |
| V1 | Input state machine + save migration + six-energy item contract | Bảo toàn 4 Core, E/F/R, UID | old-save snapshots, key tests, 6 SKU validator |
| V2 | **F01 Vụ nổ lớn làm slice mẫu**: LMB Q E, source→item→nạp→cast→hit/world/VFX→save | V1, enough real source, one VFX source verified | actual browser scene, FX phases, no free energy |
| V3 | Công nghiệp/refining/recycler/Workbench III và multi-sink energy chain | V2 real resource sink + A3 owner | recipes, tools, queues, source stock, replay, materials graph |
| V4 | Typed loot barrel/toolbox/military, one-way despawn/refresh, 3 card access | Source policy, Map contract | stocked crate → player loot → empty/despawn/reappear, UID timing |
| V5 | F02, F03; meteor/dragon dynamics | VFX source and damage model reviewed | 10 seed events, dragon hit2 %, overlaps, performance |
| V6 | N01, N02; 10 trees→wood, soil/roots, lightning/AI pull | A3 wood source transaction, Map collision | exactly-once wood, five bolts, root geometry real |
| V7 | W01, S01; full-screen freeze and legal blink | Map terrain and access contract | actor/world freeze thaw, no gate bypass, AI stealth state |
| V8 | Transport/oil/energy, circuitry, vendor and base upkeep | Map routes, A3 stock, fuel, reserve | freight scenarios, offline 8/24/48/72h, no phantom raids |
| V9 | Native composed candidate, long-run feedback and all QA | All owned slices with evidence + blocker list | New Game natural journey, 336h sim and real visual QA |

Mỗi lượt phải đóng đường nguồn đầy đủ trước khi nhân sang hệ khác. Không tạo 7 Core icon trước rồi chờ ai đó 'đem gameplay vào sau'. Nếu Map chưa chứng nhận điểm dịch chuyển, vẫn hoàn thành engine validation và ghi `MAP_SPATIAL_DEPENDENCY`, không tự dựng map giả trong shipping scene.

## Interface/contract cụ thể cần tạo trước khi code chồng nhánh

```
SourceCandidate(source_id, category, biome, world_entity, loot_table_id,
                spawn_stock, respawn_policy, consumed_at, owner_map_id)
EnergyOutput(item_id, qty, recipe_id, station_id, producer_receipt)
CoreCastIntent(cast_id, run_id, body_uid, action_id, aim_world, input_state,
               loaded_energy_ref, start_at, commit_at, seed)
CastCommitted(cast_id, resource_receipt, body_uid, action_id, origin,
              targets_snapshot, material_snapshot, rng_seed)
WorldEffectApplied(effect_id, cast_id, target_id_or_cell, state_before,
                   state_after, expires_at, source_uid, receipt)
FXLayerCue(cast_id, event_id, fx_asset_id, world_anchor, phase,
           start_at, geometry, palette, scale, occlusion_policy)
```

**Nguồn chân lý:** Gameplay tạo trạng thái và receipts; Map xác nhận địa lý/material; VFX chỉ xem thông tin nguồn, không tự phát chứng nhận wood, loot, HP hay token. Offline catchup phải dùng cùng event order hoặc giới hạn actor được mô tả rõ.

## Handoff bắt buộc sau mỗi lượt

`branch, head_before, head_after, baseline SHA, touched ownership, 1:1 source ID, goal, player behavior, code check, numeric model, actual screenshot A/B, save/relaunch, negative test, first blocker, next owner, next exact action, STOP/GO`. Không được chỉ gửi “tests pass”, “merged”, “done”. Không tạo PR khác cạnh tranh hoặc force-push.
