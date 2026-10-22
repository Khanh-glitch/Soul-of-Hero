# Downloaded asset library & content plan — 2026-07-15

> **Superseded milestone notice (2026-07-16):** phần inventory/license audit của
> tài liệu này vẫn hữu ích, nhưng kế hoạch “Archer ở Level 15” không còn
> canonical. Archer hiện là boss/recruitment Level 5 bằng chuỗi hạ boss → Soul
> vật lý → tự tay nhặt vào tủ đồ → chủ động bấm Equip để kích hoạt ngay; Axe được
> dời sang mốc sau. Xem
> `docs/ARCHER_LEVEL_5_DESIGN.md`.
>
> **Chapter 2 supersession (2026-07-16):** the asset inventory and license
> evidence below remain useful, but its old Chapter 2 roster, Level 15 plan and
> Soulforged Colossus recommendation are historical candidates only. Do not use
> this document to author Chapter 2; use
> `docs/CHAPTER_2_COMPLETE_DESIGN_2026_07_16.md`.

## Kết luận ngắn

Toàn bộ asset có liên quan trực tiếp tới **SOUL OF HERO** trong đợt tải hiện tại
đã được đối chiếu và đưa vào một candidate library cục bộ. Godot đã import đủ
mọi texture/audio/font mà engine hỗ trợ. Kho này sẵn sàng để duyệt và promote,
nhưng không tự động được xem là content production hoặc an toàn để phát hành.

Hướng mạnh nhất từ chính asset đang có là:

1. **Hero kế tiếp: Archer / Ash Ranger** cho mốc tuyển mộ Level 15.
2. **Chapter 2: Ashen Foundry** dùng Pixel Crawler làm visual family chủ đạo.
3. **Boss tiềm năng nhất cho Chapter 2: Soulforged Colossus** dùng Orange Golem
   làm prototype, nhưng chỉ production sau khi có bằng chứng license.
4. **Boss production có license mạnh nhất hiện tại: Bringer of Death**, phù hợp
   Reaper Sovereign của Hollow Cathedral hơn là ép vào Chapter 2.
5. **Creep production thuận lợi nhất:** Orc/Skeleton Pixel Crawler và Flying
   Demon; nhiều pack Mushroom/Goblin/Mimic đẹp nhưng còn gate license.

## Phạm vi quét và kết quả import

- Đã quét workspace, Downloads, Desktop và Documents: **111 archive** tổng cộng.
- Cụm game asset gần đây trong Downloads: **60 archive / 184,33 MiB**.
- Catalog local cuối cùng: **45 archive package + 11 loose asset**.
- Candidate source/design files được giữ: **5.589 file / 98,43 MiB**.
- Godot-importable: **4.925 file**, đủ **4.925 `.import` sidecar**.
- PNG pixel preset: **4.669/4.669** có `compress/mode=0` và
  `mipmaps/generate=false`.
- `Free Bow and Crossbow Icons (1).zip` bị bỏ qua đúng chủ đích vì SHA-256
  trùng tuyệt đối với archive cũ và 156/156 PNG đã có trong vendor folder.

Nguồn khai báo máy đọc được nằm tại
`data/asset_library/download_catalog.json`. Import có thể chạy lại bằng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/import_downloaded_asset_library.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/validate_downloaded_asset_library.ps1
```

`assets/library/downloaded/` được Git ignore để tránh vô tình stage hoặc
redistribute pack gốc. Nó **không** có `.gdignore`, nên media vẫn duyệt được
trong Godot và load được qua `res://assets/library/downloaded/...`.

## Ranh giới trạng thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| Downloaded | Archive/file tồn tại ngoài project, chưa đối chiếu hash |
| Local candidate | Đã hash, lọc cache/code, copy vào library và được Godot import |
| Prototype-ready | Có perspective/animation đủ để dựng scene thử, có thể còn gate license hoặc polish |
| Production-ready | Đã promote sang namespace canonical, có source/license manifest, frame metadata, scene/behavior và test |

Việc import lần này đưa asset tới **local candidate**. Hero, boss hay map chỉ đạt
production khi có definition/runtime riêng; file sprite không tự tạo gameplay.

## License gate

Trong 56 catalog entry có **25 entry thiếu bằng chứng license cục bộ**. Các entry
này vẫn dùng được để prototype trên máy nhưng không được đưa vào release build.

Các nguồn có bằng chứng local tốt nhất hiện tại:

- Pixel Crawler: cho phép commercial use và chỉnh sửa, cấm bán asset như sản
  phẩm cuối độc lập.
- Huntress/Huntress 2/Martial Hero: CC0 theo file license trong archive.
- Knight, Flying Demon, Kobold: commercial use và modify được phép; cấm
  resale/redistribution như asset pack.
- Bringer of Death: personal/commercial + modification; cấm redistribute/resell.
- Tiny RPG Town, Legacy Collection, Magic Cliffs: có public-license trong pack.
- Kenney input/audio: CC0; các font có OFL local.

Các blocker quan trọng nhất: Golems, Necromancer, Mimic/monster packs,
TopDownFantasy Forest, Tiny Swords, Tiny RPG Soldier/Orc, Water Effect và các
loose card atlas chưa có proof đủ rõ.

## Hero shortlist

### P0 — Archer / Ash Ranger

**Nguồn ưu tiên:** `GandalfHardcore Archer`.

- 64×64, nhiều palette, projectile riêng, visual lateral dùng `flip_h` phù hợp
  hợp đồng presentation hiện tại.
- License local cho phép commercial/non-commercial game và modification; cấm
  resale, redistribution, AI training, tool/NFT/print use.
- Khớp trực tiếp progression đã duyệt: Level 15 đánh bại
  `hooded_archer_miniboss` để tuyển `archer_hero`.

Concept đề nghị:

- Normal chain: quick shot → split step → armor-piercing finisher.
- Core resource: **Focus** tăng khi giữ đúng khoảng cách, mất khi bị áp sát.
- Active: **Soul Mark**; bắn mục tiêu đã mark tạo charged line shot xuyên đám.
- Summon: **Piercing Entry** từ ngoài màn hình theo đường aim đã xác nhận.
- Departure: **Backstep Volley**, vừa rời Hand vừa tạo khoảng cách cho Hero mới.

Việc cần làm trước khi production: copy toàn bộ sheet cần dùng sang
`assets/characters/archer_hero/`, map frame/FPS, chốt foot pivot và scale so với
Sword/Axe, tạo HeroDefinition, projectile socket, portrait và Level 15 reward.

### P0 fallback — Huntress 2

- CC0; Idle 10, Run 8, Attack 6, Hit 3, Death 10, projectile riêng.
- Coverage sạch hơn Gandalf, nhưng silhouette/scale ít hợp roster hiện tại hơn.
- Dùng làm fallback nếu ưu tiên tốc độ wiring và license certainty.

### P1 — Sky Lancer

**Nguồn:** `huntress` (CC0), có ba attack, spear projectile, hit/death.

Identity tốt nhất là spear/ranged hybrid, không phải archer thứ hai: ném giáo
ghim mục tiêu, dash tới hoặc kéo giáo về, tạo Spirit trigger khi xuyên hai enemy.

### P1 — Aegis Knight

**Nguồn:** `knight_2d_pixel_art`, đủ Idle/Walk/Run, ba Attack, Defend, Hurt,
Death và license commercial rõ.

Chỉ nên làm Hero nếu gameplay xoay quanh guard meter, perfect counter và ward;
nếu chỉ chém ba hit thì sẽ trùng Sword Hero.

### P2 — Runebinder

**Nguồn:** `wizard_pack`, coverage attack/hit/death khá nhưng thiếu license
local. Có thể prototype Magician đầu tiên cho Moonlit Wilds: tích rune bằng bolt,
chain/detonate, để lại ward khi Relay.

### Backlog, không ưu tiên Hero mới

- Martial Hero 2, Samurai, Fantasy Warrior: phần lớn side-view platformer và
  identity gần Sword; tốt hơn cho enemy Fallen Hero, NPC hoặc skin/variant.
- Tiny RPG Soldier: true top-down, coverage mạnh, nhưng thiếu license và visual
  chibi; rất tốt cho prototype/creep hơn một Hero flagship.
- Skeleton Army: hình tĩnh, hợp concept/portrait/statue, không đủ actor runtime.

## Boss và elite shortlist

| Ưu tiên | Asset | Coverage | Vai trò đề nghị | Gate |
| --- | --- | --- | --- | --- |
| P0 licensed | Bringer of Death | Idle/Walk/Hurt/Attack/Cast/Spell/Death | Reaper Sovereign, scythe lanes + sigil + summon + phase fake-out | Có license; cần top-down readability pass |
| P0 prototype | Orange Golem | Attack 11, Die 13, Hurt 4, Idle 8, Walk 10 | Soulforged Colossus: heat armor, furnace slam, exposed core | Thiếu license proof |
| P1 prototype | Necromancer | Idle 50, Walk 10, Attack 47, Spawn 20, Hit 9, Death 52 | Soul Binder / Chain Confessor | Thiếu license; cần trim/repack clip dài |
| P1 Hunt | Mimic | closed/open/transform/walk/2 attack/hurt/death | Treasure Hunt miniboss, phase 2 truy đuổi | Thiếu license proof |
| Elite | Flying Demon | Idle/Fly/Hurt/Attack/Death + projectile | Cinder Wisp / dive caster | License rõ; perspective/palette pass |

### Soulforged Colossus encounter

Golem là visual match rõ nhất cho boss Chapter 2 hiện đã được spec. Prototype:

1. Heat armor giảm damage, boss đập tạo hai heat lane có warning dài.
2. Người chơi kích coolant valve để đóng một lane và làm nứt armor.
3. Boss hút Hero về Crucible Core; Dash đúng nhịp phá tether.
4. Core exposed là damage window ngắn, khuyến khích Relay thay vì tank.
5. Phase 2 trộn molten projectile + collapsing safe zones, không chỉ tăng HP.

Nếu chưa lấy được license Golem, không promote art này. Dùng silhouette/proxy để
test encounter rồi commission/repaint boss; không ép Bringer of Death thành
Colossus vì sẽ phá theme và lãng phí Bringer cho Chapter 5.

## Creep mapping

### Chapter 2 — Ashen Foundry

| Contract | Candidate mạnh nhất | Ghi chú |
| --- | --- | --- |
| Ash Thrall melee swarmer | Pixel Crawler Orc/Skeleton body | Cùng family map, license rõ, modular animation |
| Forge Archer ranged line | Pixel Crawler ranged body hoặc Gandalf palette phụ | Ưu tiên Pixel Crawler để enemy không lẫn Hero |
| Armored Bone returning | Pixel Crawler Skeleton + Chapter 1 behavior adapter | Giữ continuity từ Crypt sang Foundry |
| Furnace Kobold | Kobold Warrior | Licensed; thiếu hit/death nên dùng generic flash+dissolve |
| Cinder Wisp | Flying Demon | Licensed, full combat/projectile |
| Iron Husk | Golem thu nhỏ/Blue variant | Prototype tới khi license Golem được khóa |

`tiny_rpg_soldier_orc` là true top-down và full hit/death/attacks, rất tốt để
đối chứng pipeline/pivot. Do thiếu license, không chọn làm family production.

### Chapter 3 — Moonlit Wilds

- Mushroom, Goblin, Flying Eye, Rat, Bat, Slime có animation khá đầy đủ.
- Forest Mushroom có thêm stun/VFX, rất hợp Spore Witch hoặc spore minion.
- Tất cả family chính vẫn thiếu license snapshot; chưa production.
- Gap lớn: chưa có Feral Stalker/Moonfang wolf family và Matriarch boss đủ mạnh.

### Chapter 4 — Drowned Archive

- Blue Golem có thể prototype Drowned Guard/Tide Archivist.
- Water Blast/Ball và Waterfalls giải quyết một phần VFX/environment.
- Gap lớn: chưa có Ink Oracle, aquatic roster và Keeper of the Deep Index có
  animation + license phù hợp.

### Chapter 5 — Hollow Cathedral

- Bringer of Death + Necromancer + Skeleton Army concept + dark VFX tạo theme
  mạnh nhất sau Foundry.
- Bringer có thể production Reaper Sovereign ngay sau perspective/pivot pass.
- Necromancer/Skeleton Army chỉ prototype tới khi license được khóa.

## Map shortlist

### P0 — Ashen Foundry / Pixel Crawler

Đây là pack phù hợp nhất vì environment, props, stations, VFX và actor chung một
pixel family. Có floor/wall/water tiles, furnace-like cooking/forge stations,
anvil, bonfire/smoke, furniture, building/interior props và weapon/body modules.

Map spine đề nghị:

1. **Bellows Gallery** — heat lanes theo nhịp, dạy safe zone.
2. **Molten Conveyor** — ranged pressure + moving timing windows.
3. **Crucible Core** — arena boss có coolant valve và exposed core.

Không copy toàn pack sang map production. Curate một atlas canonical, định nghĩa
TileSet source/atlas coordinates, collision và map schema trước.

### P1

- `legacy_collection` TinyRPG top-down + `tiny_rpg_town`: hub/town, TechLab,
  Plague Metropolis hoặc Moonlit Wilds subset; có public license.
- `rpg_worlds_caves_2_1`: cave Hunt/branch, có license; cần collision adapter.
- `topdown_fantasy_forest`: rất hợp Moonlit Wilds nhưng thiếu license local.
- `free_topdown_pixel_dungeon` + Waterfalls: Drowned Archive candidate; cần
  license proof và density/palette pass.

### Không dùng làm top-down map

- Magic Cliffs và Legacy Gothicvania là platformer/side-view.
- Tiny Swords là top-down coherent nhưng chibi và thiếu license; chỉ dùng nếu
  chọn nguyên family riêng, không trộn props lẻ vào Pixel Crawler/0x72.

## VFX, UI và audio

### VFX

- Super Pixel Effects: hơn 5.000 PNG source, license rõ; curate sparks, fire,
  poison, lightning, impact và reward symbols, không nối raw trực tiếp.
- VFX Free Pack: 22 family, phù hợp Magma/Charged/Explosion/Vortex/Shield nhưng
  thiếu license local; tiếp tục repack deterministic như pipeline hiện tại.
- Dark VFX 01–02: 17/16 frame, tốt cho Soul Binder/Reaper, thiếu license.
- Water Effect 2: blast + ball startup/loop/end/impact, thiếu license.
- Lightning Skill Animations: sáu family, có license document cần review cụ thể.
- Waterfalls: 10 variant ×8 frame, phù hợp Chapter 4/ambience, thiếu license.

### UI

- Complete UI Book có license và phù hợp Bestiary/quest codex hơn combat HUD.
- RPG Arsenal + Raven Armor giải quyết icon weapon/equipment nhanh.
- Năm loose card atlas và card rip/sheen FX rất hợp Hero Soul/reward cards nhưng
  thiếu provenance; chỉ prototype.
- Bốn ảnh branding generated đã được giữ làm reference. Checkerboard đã bake
  vào pixel, nên phải làm sạch alpha hoặc dựng lại trước khi production.

### Audio

Library có **184 OGG + 48 WAV** candidate, gồm full Kenney RPG/Impact và RPG
Essentials. SFX combat/UI/forge có nhiều lựa chọn hơn audit cũ, nhưng vẫn thiếu:

- music loop cho Hub/Foundry/Boss/Wilds;
- ambience forge/forest/archive/cathedral;
- identity cue riêng cho Archer, Colossus và Reaper Sovereign.

## Những gì vẫn cần thêm

1. License proof cho 25 candidate entry, ưu tiên Golem, Necromancer, monster
   families, forest/water map và Tiny RPG Soldier/Orc.
2. `AssetAnimationDescriptor` chung: cell size, frame count, FPS, foot pivot,
   scale, facing/flip, hit frame, projectile socket và fallback state.
3. Generic hit flash + authored dissolve/death để dùng Kobold/0x72 mob thiếu clip.
4. Hero Archer portrait, roster card, HUD icons, Soul state và Level 15 recruit art.
5. Soulforged Colossus portrait/phase VFX và art thay thế nếu Golem license fail.
6. Moonfang wolf family/Matriarch boss cho Chapter 3.
7. Ink/aquatic enemy family và boss cho Chapter 4.
8. Music/ambience; audio hiện mạnh ở SFX nhưng trống ở soundtrack.
9. Quyết định canonical Chapter 2 roster: spec hiện nêu Ash Thrall/Forge Archer,
   trong khi roadmap/audit cũ còn Bulwark/Venom Crawler/Spirit Leech. Chốt một
   contract trước khi tạo scene/definition để tránh sản xuất hai roster song song.

## Thứ tự thực hiện đề nghị

1. Promote Archer candidate, làm descriptor/pivot test và prototype normal chain.
2. Curate Pixel Crawler atlas để dựng một Foundry greybox hoàn chỉnh.
3. Prototype Ash Thrall + Forge Archer bằng cùng visual family.
4. Lấy license Golem; song song test Colossus bằng proxy để không khóa gameplay.
5. Nếu license Golem đạt, promote Orange Golem + magma/charged VFX; nếu không,
   commission boss mới theo encounter đã test.
6. Sau Chapter 2 vertical slice mới promote Moonlit Wilds/Hollow Cathedral asset.

## Asset bị loại khỏi SOUL OF HERO

- Dolphin 10-frame folder, Kraken và chín pack sinh vật biển thuộc Maris/
  MatrixWar: cartoon HD sáng màu, không pixel-native và đã an toàn trong project
  gốc của chúng.
- Coral/beach/water-vortex videos, thư mục `0712` và media bất động sản không
  phải game asset của SOUL OF HERO.
- Các archive backup/project binary không được coi là asset pack.

Không file nào trong các nhóm bị loại trên được copy vào project này.

## Validation sau import

- Godot headless scan/import: exit 0, không parse/import error.
- Home Map direct load: exit 0; hai NPC preload đã chuyển sang canonical assets.
- Downloaded library validator: PASS, 45 package + 11 loose, 4.925 importable.
- Chapter 1 asset manifest: PASS — 6 production-ready, 5 placeholder-only.
- VFX integration: PASS — 49 checks.
- Enemy roster: PASS — 56 checks.
- UI shell: PASS — 149 checks.

Cảnh báo duy nhất trong các suite là RealtimeBridge không bind được port 9080 vì
editor/game Godot đang giữ port; không ảnh hưởng test và mọi suite exit 0.
