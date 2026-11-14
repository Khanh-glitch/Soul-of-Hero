# Li → SOH Bible delta: kết quả phân loại có đếm (2026-11-14)

## Quy tắc đếm và giới hạn

Đếm trên **139 hàng ID nguồn** ở `LI_SOURCE_ITEMS_AND_RECIPES.json`, là tập hợp **137 historical + 2 Atlas-only** từ **nhiều phiên bản Last Island**, KHÔNG phải kiểm kê hoàn chỉnh một bản 2019/2022 cụ thể. Bảo toàn độ tin cậy và nguồn gốc; `DIRECT` trong bảng cũ không đồng nghĩa nguồn gốc được đọc lại hiện tại.

| Mục | Số | Tính chất |
|---|---:|---|
| Tổng ID nguồn LI | 139 | Reference union, chứa version/event |
| Biến thể version/công thức giữ trong archive, không làm item độc lập | 7 | Tránh trùng |
| Event-only không đưa vào item list sinh tồn mặc định | 6 | Không phải loại bởi SOH Bible |
| LI self-revive defibrillator *không thể bê nguyên luật* sang SOH K5 | 1 | Cần sửa Bible nếu muốn trạng thái downed |
| **Không nhập nguyên dạng vào base LI→SOH** | **14** | 7+6+1 |
| **Còn ứng viên import** | **125** | Không tự bỏ item chỉ vì thiếu mechanic SOH |
| Trong 125: item rule thực sự cần đổi do Bible, đã xác minh | **3** | drawing_bench, territory_cabinet, electric_door |
| Trong 125: cần nối thế giới/runtime SOH cụ thể, nhưng không tự đổi recipe LI | **3** | motorcycle, fuel_generator, oil_refinery |
| Trong 125: chưa xác định được override item-specific nào | **119** | Không đồng nghĩa đã nghiệm thu bản gốc |
| Trong 125: `UNSUPPORTED_CITATION` ở hồ sơ nguồn | **13** | Chờ kiểm chứng, chưa gọi verified |

## Các nguồn tạo ra 14 hàng không nhập nguyên dạng

- **7 version variants:** `ammo_556_base`, `ammo_556_he_old`, `ammo_762_base`, `ammo_762_he_old`, `ammo_9mm_base`, `gunpowder_legacy`, `iron_folding_ladder`. Không được coi version-formula khác là item identity mới; vẫn giữ gốc như tài liệu nghiên cứu.
- **6 event limited:** `birthday_cake_2022`, `cream`, `egg_flour`, `flour`, `red_bean_paste`, `reunion_mooncake_lottery_pack`. Nếu Creator mở lại các sự kiện đó, sẽ xét riêng đúng edition/time/event source.
- **1 incompatible-as-is:** `self_revive_defibrillator`. Dữ liệu LI 2022 là kích hoạt khi *downed*, trong khi Bible SOH K5 đang chốt HP về 0 → chết/túi đồ/respawn; không mở thêm downed-state ngầm. Không cấm một thiết bị y tế khác với khả năng không xung đột Bible nếu được duyệt.

## LI items thực sự phải chuyển luật (3)

1. `drawing_bench` — tích hợp vào K4: một hệ quyền recipe run-local, có nhiều đường R&D; dữ liệu source recipe LI giữ theo phiên bản.
2. `territory_cabinet` — alias `claim`; không PvP, phải có nền để đặt tủ mới, upkeep và 24 slot vật lý theo K6, xóa khi hết run.
3. `electric_door` — nguồn điện/khóa điện LI giữ, nhưng cần cơ chế thoát an toàn hợp lệ khi mất điện và không softlock người chơi K6.

**Cần nối đúng world/runtime, nhưng không đủ cơ sở sửa chi phí LI (3):** `motorcycle` (K7: cargo, va chạm địa hình, nhiên liệu, lưu trạng thái), `fuel_generator` (nhiên liệu/dây/đầu tải và chronology offline), `oil_refinery` (dầu nguồn vật lý và queue online/offline).

**Mọi item** vẫn cần adapter chung K1/K3/K8: item ownership/UID, run-local, 336h+72h, world source, on/offline/restart. Không tính 125 lần thay đổi chỉ vì cùng một global rule. PvP target matrix chuyển thành solo PvE ở gameplay hệ thống; **không xóa súng/đạn/bẫy vì lý do PvP**.

**Không tự đổi `parts`:** SOH có công thức Core tiêu Parts, nhưng Bible không chốt bắt buộc các recipe đó. Parts giữ nguyên nguồn và các công thức LI có chứng cứ; mọi consumer Core bổ sung phải đánh dấu là SOH proposal, không là delta bắt buộc.

## SOH cần item riêng gì?

**25 item ID hiện có được Bible khóa trong các nhóm SOH-only:**
- **11 Core:** `core_blast`, `core_meteor`, `core_dragon`, `core_elsa`, `core_earthmother`, `core_mjolnir`, `core_demon`; `core_fire`, `core_earth`, `core_storm`, `core_frost`.
- **6 năng lượng:** `energy_basic`, `energy_refined`, `essence_fire`, `essence_nature`, `essence_water`, `essence_spirit`.
- **6 Primordial Stones:** `stone_surtur`, `stone_typhon`, `stone_aion`, `stone_atlas`, `stone_argus`, `stone_anubis`.
- **2 Ragnarok:** `rcash` và `escrow_chest`.

**Ngoài 25 ID:** Bible K4 còn khóa **một thiết bị vật lý tự động hóa vườn tùy chọn** (chức năng bắt buộc tồn tại, ID cụ thể không chốt); code hiện có `deploy_farm_controller`, nằm trong 24 packed-device adapters. Nó không bắt buộc phải là một item UI độc lập thứ 26 trong danh sách.

**Đừng nhầm số SOH-only:** 147 item hiện tại gồm 25 canon SOH, 24 `deploy_*` wrapper, 6 Elder Stone ID cũ cần xử lý legacy, 3 SOH-only non-LI `mechanical_parts`, `fasteners`, `damaged_drive` là ứng viên loại khỏi new run, 23 mapping được (15 ID exact + 8 aliases), và **66 SOH IDs chưa có match được chứng minh với nghiên cứu LI hiện có**. 66 không có nghĩa 66 SOH-exclusive; nhiều món là nguyên liệu sinh tồn phổ biến nhưng bộ 139 nguồn LI chưa đủ bao phủ.

## Phân bố 125 ứng viên theo mảng

| Mảng LI | Nguồn | Ngoài base | Ứng viên |
|---|---:|---:|---:|
| Combat | 41 | 6 | 35 |
| Raw | 4 | 0 | 4 |
| Food | 18 | 4 | 14 |
| Defense | 15 | 0 | 15 |
| Medical | 5 | 1 | 4 |
| Access | 7 | 2 | 5 |
| Metal | 13 | 0 | 13 |
| Oil | 4 | 0 | 4 |
| Production | 2 | 0 | 2 |
| Power | 9 | 0 | 9 |
| Armor | 9 | 0 | 9 |
| Transport | 4 | 0 | 4 |
| Tools | 2 | 0 | 2 |
| Building | 4 | 1 | 3 |
| Iron ore/Refined ore | 2 | 0 | 2 |
| **Tổng** | **139** | **14** | **125** |

## Status / handoff

- Dữ liệu source và phân loại đã ghi vào `BIBLE_ITEM_DELTA_AUDIT.json` (mỗi ID có bucket, nguồn và cảnh báo). Đây là **audit của scope đã nghiên cứu**, không phải kiểm chứng toàn bộ item Last Island, cũng không phải 125 mechanic production-ready.
- Không overwrite `web/src/game/catalog.ts`, không merge PR. Cần thêm nghiên cứu đúng edition/mode cho 13 UNSUPPORTED trước khi copy thông số; thêm các item missing vào runtime với full action→cost→world→save, không cấp vật phẩm giả để đi tắt game.
- Không lấy danh sách 81 `NOT_ADDED` từ ontology v2 làm danh sách được phép bỏ: thiếu code SOH ≠ không thuộc scope copy.
