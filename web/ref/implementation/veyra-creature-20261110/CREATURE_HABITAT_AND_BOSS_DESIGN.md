# Soul of Hero — Veyra Ecology & Side Boss Placement (design handoff)
**2026-11-10 · DESIGN ONLY · NOT APPROVED CODE · NO AGENT DISPATCH.**

User-defined: Mafia removed. 9 new mobs across 3 families. Final Veyra map **100% source/presentation preserved**; six Elder remain independent. UI/UX/HUD Gold package to come. AI behavior, drop economy, balance and missing animation are Agent free style in SOH_PROVISIONAL bounds, never override Bible.

## Source grounding

Gold map JSON: frame 2000×1400 AU, 81 POIs, 23 zones, 6 Elder, 4 proposals for player spawn; paper Gold JSON alone is *not* native/playable. Complete enhanced map ZIP has procedural runtime streamer (4000×2800 global tile at 0.5 AU/tile with 200×200 live windows), authored architecture, terrain, flora, rain/wind/water, shadows and effects. Retain all; never substitute the paper JSON for Veyra05 source.

**Source/habitat POI coordinates below are map-authoring AU, NOT spawn coordinates, not runtime tiles, and not promises that a collision-free square exists.** Agent must sample actual loaded walkability/LOS, safe-zone exclusion, POI stair/door access and route viability before materializing any actor.

## Nine confirmed ordinary creatures

| Asset | Fantasy | Real map anchor (AU) | Combat and reason |
|---|---|---|---|
| VAMPIRE_1 | **Dusk Stray / Kẻ săn bóng rừng** | `po_ranger` (800,760) — `bz_elder_clear` | Dò âm thanh và tầm nhìn, lao ngắn rồi hồi sức; dao đầu game vẫn có đường tự vệ; Hollow Oaks Clearing, tuyến rừng quanh Ranger Hut; trú ban ngày dưới mái/độ che, đi săn lúc chạng vạng |
| VAMPIRE_2 | **Blood Archivist / Giám thư huyết** | `po_academy` (936,262) — `bz_argus` | Cho dấu hiệu triệu hồi quầng trước khi gây khống chế ngắn; không xuyên tường; Argus Academy: library stacks và tuyến sân sau, không khóa thư viện hoặc lối đi của người chơi |
| VAMPIRE_3 | **Crimson Warden / Huyết vệ** | `po_tombs` (520,1086) — `bz_dune` | Giáp cao, nhịp combo chậm, tấn công rõ hình nón; vùng nắng ngoài trời giảm ưu thế; Dune Tombs: nhánh hầm mộ bên cạnh, không chắn Necropolis hay đường sơ tán |
| ORC_1 | **Scrap Gnawer / Orc nhặt phế** | `po_freightyard` (690,500) — `bz_typhon_t` | Ra đòn dao ngắn, có thể lùi về vật che; loot vật tư thấp có source hợp lệ; Shattered Freight Yard: đống phế liệu và rìa tuyến hàng, không chiếm toàn bộ đường chính |
| ORC_2 | **Bridge Raider / Kẻ cướp cầu gãy** | `po_viaduct` (655,448) — `bz_typhon_t` | Đánh cán dài có tiền động tác, phối hợp nếu Orc1 gần đó nhưng không xuyên vách; Crushed Viaduct: chân cầu và các lối vòng, tuyệt đối không khóa đường bắt buộc |
| ORC_3 | **Ironvein Marauder / Orc chiến đoàn mỏ** | `po_ironvein` (1205,655) — `bz_ridge` | Bảo vệ đồng bọn/áp lực góc, mạnh hơn Orc1; vẫn quái thường/elite, không boss thưởng hiếm; Ironvein Mine ngoại vi và các bãi đất bên sườn Ironvein Ridge, không chặn cổng mỏ vật lý |
| SLIME_1 | **Lake Droplet / Gel nước** | `po_pumphouse` (850,556) — `bz_greywater` | Nảy/ép thân, va chạm báo trước, hao dao thấp; tránh giả sát thương tiếp xúc liên tục; Greywater Pumphouse: bờ bùn thoáng ngoài trạm; giữ an toàn spawn Greywater South Shore |
| SLIME_2 | **Reagent Ooze / Dịch thuốc thử** | `po_oldpump` (850,985) — `bz_gulfwest` | Để vệt độc hoặc dính có tuổi thọ hữu hạn, khác rõ màu nước tự nhiên; không ghi độc bằng shader suông; Old Pumping Plant: rãnh thoát/lắng phía ngoài và phòng máy có đường rút |
| SLIME_3 | **Cinder Core / Gel tro nóng** | `po_sulfur` (1768,882) — `bz_cinder` | Đập đất tạo vùng nóng nhỏ có cảnh báo và thoát được, không thiêu rụi toàn đảo; Sulfur Works, Cinder Isle: miệng thông hơi và rìa đá lưu huỳnh |

## Side bosses / candidate triage

| Asset | Fantasy | Authored location (AU) | Art feasibility |
|---|---|---|---|
| ROCK | **Greyback Shaleheart / Tâm đá mỏ** | `po_greyquarry` (506,652) | Idle/Walk/Swipe/Stomp, no explicit Hurt/Death |
| SAMURAI | **Oathless Ronin / Kiếm sĩ thất thệ** | `po_cairns` (470,990) | Intro/Walk/Melee/Ranged/Death |
| WATER | **Saltwick Tidemarshal / Hộ vệ thủy triều** | `po_saltlight` (1732,262) | One sprite sheet + Aseprite source; classify frames before making attacks |
| MAID_IDLE | **Pale Custodian / Hầu gái lưu ảnh** | `po_academy` (936,262) | Maid Idle and Run PNG only (both 144×144 per cell, 20 and 40 frames) |

**Placement logic:** Rock stays in optional deep Greyback pocket, not on early main road; Samurai in Sunken Cairns side-ruin, not Anubis Elder entrance; Water at Saltwick Light, not the Saltwick Harbor Ragnarok safe; Maid in the *authored* Argus Academy sealed archive/service corridor, not an invented manor; The scythe-wielding boss is **not verified** in the scanned assets; Enemy Pixel Pack looks polearm/rider rather than confirmed scythe, so this is a reserve, not an accepted fifth boss. No boss gates to normal surface loot, cash, transit, evacuations or Elder alternatives.

## Five wild animals, not yet livestock

Boar (Greyback/West Woods), Deer (Silverrun/Hook Meadow), Hare (Greywater/West Woods), Black grouse (North Woods/Hook), Fox (West Woods/North Woods). Asset pack contains wild species, **not cows/sheep/domestic chickens**. Husbandry requires capture/taming, feed/water/pen HP/collision, reproduction, source-valid yields, predation and offline catch-up, all causal. Do not invent mandatory daily login or random offline predator raids.

## Asset preload refs (verified Drive folder inventory plus user uploads)

| Purpose | File | Drive original | SHA256 |
|---|---|---|---|
| USER_UPLOAD_MAP_FINAL | `veyra-world-art-upgrade (4).zip` | User-attached in current chat; no Drive URL verified | `d9d69d18e5db4f2d8075c76af9f4e712042cc078cee7938aeb329c118c2dcda4` |
| USER_UPLOAD_ELDER_FINAL | `six-primordials-boss-lab (9).zip` | User-attached in current chat; no Drive URL verified | `74940d11c42fa883101b43a252cb4071955a8995f70a9f2ecd0bdba2f5d6dfe2` |
| CREATURE | `craftpix-net-208004-free-vampire-4-direction-pixel-character-sprite-pack.zip` | [Drive](https://drive.google.com/file/d/1R7xtjUNg_fRzfOCDdjYkCZnTFG54YZF9/view) | `15a67afa275dc14b22072071a7dd8c9397a99e8df8cae884ad66b7288b6c9909` |
| CREATURE | `craftpix-net-363992-free-top-down-orc-game-character-pixel-art.zip` | [Drive](https://drive.google.com/file/d/1pqKwVsLeL-y6EDw3qqTPA6Mroyg2mCDU/view) | `5a1f8640a355d34c93799abade98112d00e74e183cea8d0bd07e7f51c377b15d` |
| CREATURE | `craftpix-net-788364-free-slime-mobs-pixel-art-top-down-sprite-pack.zip` | [Drive](https://drive.google.com/file/d/1reP-N5I_FS2tgHLUyeXt83bg1674bHv8/view) | `91d234d83b88a59b9252842b7dc8b30258ed644403c494bd7a83748d953fb347` |
| BOSS | `EBros_Boss_Samurai.zip` | [Drive](https://drive.google.com/file/d/1LycUvqYY_0lwUWySu3mz6a8Gnd8W9CYs/view) | `276b25b32bae0046223d39775f8be3309745f02ed6fb9613605830a035ddc477` |
| BOSS | `TopDown_RockBoss_EBrosAssets.zip` | [Drive](https://drive.google.com/file/d/1bffc6zdTH_8L6qI5uLtJj3kh_WwYx0m2/view) | `66d9a47f1ecef2ef79a096aff191d1db0efc8225030ca425c8677dcb14ca9618` |
| BOSS_CANDIDATE | `Water Warrior.zip` | [Drive](https://drive.google.com/file/d/1NxE840zIgQ3lzgE-YG-0k7i_c3PUNrDb/view) | `62bffb05c7f566e7e214da5344f9237d0a515d57fe5fa2de8c8888d1a51cf1fe` |
| BOSS_CANDIDATE | `Maid Idle (1).png` | [Drive](https://drive.google.com/file/d/1sf4V1LhbexoiAtAfqUPGSdqEbJqPy7Fm/view) | `d8cabfa78d189cabac5d47f4afbbd5c754ef6e6f4f32220b7adb60db30160d9b` |
| BOSS_CANDIDATE | `Maid Run (1).png` | [Drive](https://drive.google.com/file/d/16pmtMYnouHqoizLnB5a5fWmG-BLmbGBl/view) | `cf3b5c3c5add8f33ccca4f514409b885bffccbac881a845d024715c53ac2851d` |
| OPTIONAL_ENEMY_PACK_NOT_CONFIRMED_SCYTHE_BOSS | `craftpix-net-221601-free-enemy-pixel-pack-for-top-down-defense.zip` | [Drive](https://drive.google.com/file/d/1M00yeqhMo6fl60g3OjYYBxUwWTGxFSp7/view) | `6b3a24f645eebd946083bbeaf10eb7f06f70077509dcb62904b854afa0e74d25` |
| RESERVE_ONLY | `craftpix-net-180537-free-swordsman-1-3-level-pixel-top-down-sprite-character.zip` | [Drive](https://drive.google.com/file/d/1w2-KbWydIKlcn7AprGYKtoqXQSuCA7J_/view) | `7cefa8ddb129c799c8c31965b367056545334e349cd343f13f3b292ff33d8fe4` |
| WILDLIFE | `craftpix-net-789196-free-top-down-hunt-animals-pixel-sprite-pack.zip` | [Drive](https://drive.google.com/file/d/13cckJXRa-S1upzJFA99tTSwTBg-xwhw-/view) | `02737af10e371b9c1d3e58e790498d07272a326d2daafe0cf6e8ebd939ab0e2c` |

## Agent implementation contract

1. User must approve encounter layout before dispatch. Single Gameplay Agent must target verified R12-clean PR #47 ancestry, never use prior multi-agent orders; working PR stays draft.
2. Preserve enhanced Veyra source byte-for-byte where practical and prove visual parity for many zones/biomes/night and animated FX. Do not port paper-map only.
3. Add creatures as actors to existing global scene/source identity, with streaming-safe global positions and unique death/loot receipts, no window duplication, no illegal spawn in wall/deep-water/safe point.
4. Eleven dynamics to test: natural knife combat, collision/LOS, telegraph, fleeing/loss of target, day-night shadow, weather/season, trace-only base discovery, offline chronology, unload/reload, corpse loot UID, path availability without bosses.
5. Agent may invent attacks, telegraphs, rewards, temporary states and balance, after measuring against player knife and travel cost; record SOH_PROVISIONAL and do not invent Creator-locked lore/priority.
6. Missing Maid/Water/Rock animation needs actual art work — a moving still cannot be accepted as boss.
7. UI/UX/HUD Gold is pending; do not invent or replace it. Preserve existing interaction until Gold review.
8. This is a design and preload handoff, not a functional certification. No production claim, no human-play acceptance.

## Six Elder — existing fixed territory, NEVER redistribute

| Elder | Domain | Map site ID | Gold map AU |
|---|---|---|---|
| el_surtur | Reality | po_surtur — Foundry of the First Fire | (1694, 826) |
| el_typhon | Power | po_typhon — Typhon's Fracture | (556, 352) |
| el_aion | Time | po_elderwood — Heart of the Elderwood | (868, 712) |
| el_atlas | Space | po_gate — Threshold Gate | (168, 512) |
| el_argus | Mind | po_hall_eyes — Hall of Eyes | (992, 212) |
| el_anubis | Soul | po_necropolis — Necropolis of the Hollow Sun | (604, 1042) |

These six places are explicit in the authored Gold geography. Boss Lab is their art/AI reference with two forms and 48 skills; retain 6 unique stones, optionality, Ragnarok timing and existing authored geography. No additional boss gets an Elder token.
