# Soul of Hero — Hero Systems Completion Audit & Execution Contract

**Ngày:** 2026-10-22  
**Cơ sở kiểm tra:** `main` tại `5214788933b1a827f3a177d11ff486433dfe5e8a` (repository `Khanh-glitch/Soul-of-Hero`).  
**Trạng thái:** Static repository audit / implementation backlog; **CHƯA** chạy Godot runtime trong phiên audit này.  
**Phạm vi:** Hero identities, skill kits, per-Hero progression, Hero Soul, equipment, roster/skill/inventory UI và các contract kiểm thử. Không thay đổi gameplay ở bước này.

## 1. Quy tắc nguồn sự thật

Ưu tiên (1) code và resource đang chạy; (2) `docs/KEEPTRACK_POWER_LEVEL_REBALANCE_2026_07_16.md`, `docs/CONTINUOUS_RUN_LOOT_LOOP_2026_07_16.md` và `docs/KEEPTRACK_INDEX.md`; (3) tài liệu lịch sử chỉ dùng tham khảo.

**Không dùng riêng `docs/IMPLEMENTATION_STATUS_V0_4.md` làm chuẩn balance.** Tài liệu này cũ hơn: từng mô tả 5 Skill Points/level và ba slot Vessel/Trace/Focus. `README.md` và code hiện tại phản ánh 2 Skill Points/level, Armor/Vessel (`soul_vessel`), Boots (`soul_boots`), Jewelry (`soul_trace`), gear upgrade `+0…+5`.

## 2. Trạng thái xác minh từ code

| Mảng | Code / contract quan sát được | Verdict |
|---|---|---|
| Playable Hero | `game/characters/knight/knight.gd`, `game/heroes/hero_soul_manager.gd`, `game/heroes/data/*.tres`; README mô tả Sword và Archer đã production, Axe là compatibility/prototype, Wizard có definition/kit/runtime nhưng chưa được xác nhận production | **Sword/Archer: documented LIVE; Axe/Wizard: completion needed / verify** |
| Hero skill kit | `game/meta/hero_souls/hero_skill_kit_rules.gd`: Basic/Advanced/Legendary+ kit, rarity-based split/rank, per-Hero profiles; `game/meta/progression/player_progression_rules.gd`: 6 tracks / Hero, cap rank 20 | **Implemented rules, verify all runtime/UI consumers** |
| Hero progression | `game/meta/progression/hero_progression_rules.gd` + `SaveService`: XP, level, HP/Power/Mana, stats, skill allocation / respec | **Implemented; test end-to-end** |
| Hero Soul | `hero_soul_rules.gd`, `hero_soul_combat_affixes.gd`, `hero_soul_manager.gd`, `SaveService`: 8 rarity, individual instances, selected exact UUID, affix, equip, lock/favorite, sell/fusion | **Implemented; audit UI transparency, affordability and LIVE effects** |
| Auxiliary gear | `auxiliary_equipment_definitions.gd`, `auxiliary_equipment_rules.gd`, `auxiliary_equipment_combat_stats.gd`: Armor/Boots/Jewelry, affix LIVE whitelist, +5 upgrade using same-rarity stone | **Implemented; verify every player-facing effect and preview** |
| Roster/UI | `game/ui/screens/hub/tabs/arsenal_tab.gd/.tscn`, `hero_library_panel.tscn`, `game/ui/hud.gd` | **Implemented; UX/visual playtest required** |
| Extra systems | Hero Variant foundation; Monster Soul foundation, Monster Parts/Forge, gacha, wider endgame loops are documented roadmap | **Not production; do not mislabel LIVE** |

Các nhận định trên dựa vào code và tài liệu; không thay thế runtime/playtest evidence. Không tuyên bố bug runtime khi chưa tái hiện.

## 3. Rủi ro tích hợp quan trọng

- `game/characters/knight/knight.gd` (~5,859 lines), `game/autoload/save_service.gd` (~4,671 lines), `game/heroes/hero_soul_manager.gd` (~1,483 lines), `game/ui/screens/hub/tabs/arsenal_tab.gd` (~1,390 lines): thay đổi tại đây dễ tác động cả combat, progression, save và presentation.
- Chapter 2 agent đang thực hiện map/runtime/playtesting trong workspace khác; branch/worktree và diff chưa được publish tại thời điểm audit. Nhánh `main` hiện không có `tools/run_chapter_2_map_design_tests.ps1` dù agent đã nhắc tới; **không suy diễn rằng file bị mất**.
- Các file giao nhau rủi ro cao: `game/main.gd`, `game/characters/knight/knight.gd`, `game/heroes/hero_soul_manager.gd`, `game/autoload/save_service.gd`, `game/autoload/app_flow.gd` (thực tế `game/app/app_flow.gd`), `game/loot/loot_director.gd`, campaign registries/rewards.
- Chỉnh schema/entitlement cần giữ save migration, receipt idempotency và exact-instance ownership; **không tạo unlock Hero từ boss defeat hoặc campaign level** ngoài rule canonical.
- Không dùng cách đổi/ẩn test để biến failures thành pass.

## 4. Phân chia ownership khi làm song song

**Agent A — Chapter 2 / Godot playtest:** sở hữu map/scene, enemy placements, objective runtime, chapter spawning, campaign level/data, encounter/reward integration và tooling cho playtest của chính nó.

**Agent B — Hero Systems:** sở hữu audit + thay đổi cô lập trong `game/meta/hero_souls/`, `game/meta/equipment/`, `game/meta/progression/`, `game/ui/screens/hub/tabs/` và các test chuyên biệt. Không coi những thư mục đó là 100% độc quyền: kiểm tra diff thực tế trước mỗi patch.

**Protected/shared files — cần báo rõ và tách PR nhỏ trước khi đụng:** `knight.gd`, `hero_soul_manager.gd`, `save_service.gd`, `app_flow.gd`, `game/main.gd`, `loot_director.gd`, `game/ui/hud.gd`, registries, progression/entitlement receipts. Tuyệt đối không dùng chung writable worktree, không force push hay cherry-pick chưa review, không merge thẳng vào `main`.

## 5. Implementation backlog theo dependency

### H0 — Inventory of contracts (P0, không đụng gameplay)
- Map full flow: roster selection → Soul/gear instance choice → saved loadout → live combat projection → HUD/tooltip → save reload.
- Với mỗi Hero, 6 skill track và mỗi rarity band, tạo matrix `DEFINED` / `WIRED` / `TESTED` / `PLAYTESTED`. Không gộp 4 trạng thái thành “done”.
- Với mỗi live gear/weapon affix, đối chiếu generator whitelist, UI description, live stat/effect consumer, save migration và visual evidence.
- Chỉ ra các tài liệu hoặc UI label cũ mâu thuẫn code; không tự sửa balance ngoài scope.

### H1 — Hero Roster / Skills / Equipment legibility (P1, ưu tiên xung đột thấp)
- Một màn hình phải đọc nhanh được: Hero đang active/reserve; rarity/level của Soul được chọn; HP/Mana/Power/weapon DMG; 2 active skills và trạng thái rank/cooldown; 3 gear slots; projected change khi equip.
- Chỉ tiết lộ chi tiết affix/secondary trong expandable panels/tooltips; giữ nút hành động/feedback gần item được chọn, không làm người chơi phải cuộn nhiều lớp.
- Rõ `LOCKED`, `NOT OWNED`, `EQUIPPED`, `AVAILABLE`, `NOT YET LIVE`; không hiển thị skill/effect chỉ có data như đã hoạt động.
- Kiểm tra 640×360, 847×437, 1280×720; desktop/controller/input focus/drag/drop. Bảo toàn interaction trong combat.

### H2 — Skill & Hero loop correctness (P1; chỉ đụng runtime sau integration review)
- Sword/Archer: rank, mana, cooldown, targeting, cancel, combo, summon/departure, relay, death/reserve, save reload, basic/advanced/legendary+ profile consistency.
- Tất cả 6 track mỗi Hero phải có runtime effect đọc đúng từ snapshot hoặc được dán `NOT YET LIVE`.
- Không tạo skill được quảng cáo chỉ bằng text/UI khi không có consumer.
- Chụp video/capture đối chiếu tooltip, HUD và actual damage/cooldown; test boundary và cancel cases.

### H3 — Gear / Hero Soul lifecycle (P1; guarded shared contracts)
- Equip/unequip/upgrade/sell/fuse/favorite/lock: test exact instance, no cross-Hero ghost effect, consume-once/idempotency, gate, full inventory, swap, restore after reload, upgrade cap +5.
- Random roll chỉ rút từ LIVE pool; source / rarity / item level rõ ràng.
- Preview +/- của HP/Mana/Power/weapon DMG và secondary effects phải khớp runtime sau equip; nâng cấp cần hiển thị đúng stone + cost + effect delta.
- Nếu chạm SaveService/loot code: patch nhỏ, migration plan, negative tests, tuyệt đối không nâng schema tùy tiện.

### H4 — Axe, Wizard, Hero Variant (P2, phase riêng sau H1–H3)
- Reconcile playable content: art/action readable, 2 active skills, full combat kit, Relay, ownership rule, exact Soul equip, loot/reward, identity portrait, SFX, test.
- Axe phải giữ story-only recruitment; Wizard không tự được mở chỉ vì definition tồn tại.
- Hero Variant đầu tiên chỉ production khi có asset, skill delta, loot, save, pity/duplicate rules (nếu áp dụng) và end-to-end tests.
- Không tự thêm Hero/skill/balance định lượng mới nếu chưa có brief thiết kế được owner duyệt.

**Out of scope hiện tại:** Monster Soul Level 50, Monster Parts/Forge, gacha/shop, Chapter 3–10, redesign toàn core controller, thay đổi campaign progression Chapter 2.

## 6. Regression & evidence bắt buộc

Focused runners đã có trên `main` (đều gọi Godot 4.7 Windows trong script; Linux adaptation nếu cần **giữ nguyên test semantics**):

- `tools/run_hero_aware_hud_runtime_test.ps1`
- `tools/run_hero_roster_responsive_tests.ps1`
- `tools/run_hero_skill_combat_tests.ps1`
- `tools/run_hero_soul_instance_live_tests.ps1`
- `tools/run_hero_soul_fusion_live_affix_tests.ps1`
- `tools/run_auxiliary_equipment_tests.ps1`
- `tools/run_auxiliary_equipment_save_tests.ps1`
- `tools/run_auxiliary_equipment_combat_tests.ps1`
- `tools/run_auxiliary_equipment_upgrade_migration_tests.ps1`
- `tools/run_player_progression_tests.ps1`
- `tools/run_mana_meta_core_tests.ps1`
- `tools/run_continuous_hud_ui_tests.ps1`
- `tools/run_save_compatibility_regression_tests.ps1`
- Full gate: `tools/run_full_regression.ps1 -SkipMcp`.

Required evidence: exact HEAD SHA; Godot executable/version; commands, exit codes, errors, test results; isolated saves for both `SOUL_OF_HERO_SAVE_PATH` and `LIVING_ARSENAL_SAVE_PATH`; screenshots/video for affected UI/combat; known limitations. **No “PASS” without actual execution.**

## 7. Definition of Done / merge gates

1. `H0` contract matrix reviewed; work restricted to smallest missing behavior, without rewriting working systems.
2. Every implemented feature has rules + live consumer + save/reload contract (if persistent) + meaningful UI feedback + negative and happy-path tests.
3. No regression to current Sword/Archer or campaign 1–10; no contradictory documentation.
4. No edits collide with Agent A's unpublished work. Integrate only after A's commit/PR is available; rebase and rerun tests on combined commit.
5. A production feature requires actual Godot evidence; static audit or historical logs are not production sign-off.

## 8. Agent B execution brief

> Continue on `feat/hero-systems-completion` using an **independent worktree**. Read this contract, README and current keeptracks. First produce the matrix in H0; implement H1 only where provably incomplete, with focused tests. Prepare small commits and a draft PR. Never modify shared/protected files without listing the exact necessary changes and checking Agent A's latest diff. Do not claim gameplay playtested until Godot actually runs. After H1, propose the minimal H2/H3 follow-up PR slices. Do not merge autonomously.

**Current evidence status of THIS audit:** source inspection done; no Godot execution, visual capture, runtime tests, or gameplay edits performed.
