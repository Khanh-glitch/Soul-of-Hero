# SOUL OF HERO — FINAL ITEM SET (COPY-FIRST / 3 NHÓM)

**Khóa phạm vi thiết kế:** 15/11/2026 · **quy tắc từ Creator trong cuộc hội thoại này** · dựa trên `web/ref/bible.md` và nguồn LI đã import trong PR #62. **Đây là quyết định thiết kế final; chưa có nghĩa code production đã đổi hoặc 157 item playable.**

## Nguyên tắc duy nhất

**(A)** Item giữ như Last Island nếu vai trò và nguồn/công thức gốc đủ phù hợp. **(B)** Chỉ chuyển hóa item khi gameplay SOH thật sự khác: cặp **súng/đạn LI ⇒ Core/năng lượng SOH**, PvE không PvP, Core tác động môi trường, một bàn nghiên cứu dùng chung, turret dùng Arrow, keycard phù hợp POI, v.v. **(C)** Chỉ phát minh item nếu cần cho hệ riêng SOH: mùa/vườn/chăn nuôi/vật mẫu của Veyra, side boss, sáu Elder, Ragnarok.

**CÁCH ĐẾM:** 157 ID sản phẩm/pack trong thiết kế = 78 A + 42 B + 37 C. Bao gồm **24 packed `deploy_*`** (mỗi pack là một item mang UID), **1 `door_powered` module còn chưa live**, **3 giống cây có ID mới**; không kể sáu đá Elder đời cũ. Các item LI chưa xác minh edition/source được giữ warning, KHÔNG tự tạo drop rate hay khẳng định chúng live. Với một nguồn lịch sử chưa đầy đủ, đây là bộ final cho **phạm vi dữ liệu đã nghiên cứu**, không phải tuyên bố có mọi item của mọi ấn bản Last Island.

| Nguồn hình thành | A | B | C | Tổng |
|---|---:|---:|---:|---:|
| 123 ID định nghĩa trực tiếp trong catalog SOH | 31 | 37 | 30 | 98 giữ |
| 24 packed deploy item hiện tại | 16 | 4 | 4 | 24 giữ |
| Bổ sung ID LI còn thiếu (nguồn 139) | 31 | 0 | 0 | 31 mới |
| Bổ sung để hoàn chỉnh SOH | 0 | 1 cửa điện | 3 hạt giống | 4 mới |
| **Tổng final** | **78** | **42** | **37** | **157** |

**Loại khỏi set:** 19 ID catalog SOH đời cũ + 6 Elder Stones legacy = 25 ID không xuất hiện trong run mới. Tình trạng save cũ phải được chuyển bằng quy tắc migration, không xóa thẳng trong runtime.

## Đếm 139 ID Last Island đã điều tra

| Quyết định với 139 ID nguồn LI | ID |
|---|---:|
| Giữ trực tiếp LI | 63 |
| Vai trò được tái tạo bằng item SOH khác | 17 |
| Họ súng/đạn/phụ tùng súng được thay bằng Core/Bow (không giữ gun economy) | 32 |
| Loại hệ raiding PvP, phụ liệu mồ côi | 8 |
| Không phù hợp SOH/khác ấn bản hoặc thiếu cơ chế hợp lệ | 5 |
| Biến thể lịch sử chỉ lưu archive, không tạo item trùng | 7 |
| Item sự kiện giới hạn không đưa vào base sinh tồn | 6 |
| Alias trùng `low_quality_fuel_can` vào fuel | 1 |
| **Tổng** | **139** |

**Lưu ý:** nhóm “32 thay bằng Core” không phải chuyển đổi 1:1 32 súng → 32 Core. 11 Core có khả năng khác nhau; năng lượng Core thuộc nhóm B. Vũ khí cận chiến và cung vẫn là đường chiến đấu không Core theo Bible. `parts` LI vẫn chính là `spares` SOH, không craft vô hạn; `electronic_parts` LI trở lại đúng vai trò linh kiện điện tử, không tạo lại `mechanical_parts` để bù.

## A. Y hệt Last Island — nguyên liệu, công cụ, trạm và trang bị gốc (78 ID)

Không sửa tên/công thức/source LI một cách tùy ý. Các sản phẩm hiện có dùng runtime alias ổn định (ví dụ LI Parts = SOH spares); recipe production phải đồng bộ với baseline LI đã xác minh. Những item có source grade thấp phải xác minh trước khi gọi là historical exact.

| ID final | Tên hoặc sản phẩm | Nguồn trong game / quan hệ | Lý do |
|---|---|---|---|
| `crude_petroleum` | Crude Petroleum | Catalog SOH hiện có • LI: `crude_oil` | Giữ item và vai trò LI crude_oil, khôi phục recipe/source LI có chứng cứ |
| `wood` | Wood | Catalog SOH hiện có • LI: `wood` | Giữ item và vai trò LI wood, khôi phục recipe/source LI có chứng cứ |
| `stone` | Stone | Catalog SOH hiện có | Đá gốc LI xác nhận bởi hướng dẫn sinh tồn 2019, thiếu trong tập 139 |
| `iron_ore` | Iron Ore | Catalog SOH hiện có • LI: `raw_iron_ore` | Giữ item và vai trò LI raw_iron_ore, khôi phục recipe/source LI có chứng cứ |
| `rich_iron_ore` | Rich Iron Ore | Catalog SOH hiện có • LI: `refined_iron_ore` | Giữ item và vai trò LI refined_iron_ore, khôi phục recipe/source LI có chứng cứ |
| `charcoal` | Charcoal | Catalog SOH hiện có • LI: `charcoal` | Giữ item và vai trò LI charcoal, khôi phục recipe/source LI có chứng cứ |
| `spares` | Parts | Catalog SOH hiện có • LI: `parts` | Giữ item và vai trò LI parts, khôi phục recipe/source LI có chứng cứ |
| `iron_ingot` | Iron Ingot | Catalog SOH hiện có • LI: `iron_ingot` | Giữ item và vai trò LI iron_ingot, khôi phục recipe/source LI có chứng cứ |
| `rope` | Rope | Catalog SOH hiện có • LI: `rope` | Giữ item và vai trò LI rope, khôi phục recipe/source LI có chứng cứ |
| `hide` | Raw Hide | Catalog SOH hiện có • LI: `animal_hide` | Giữ item và vai trò LI animal_hide, khôi phục recipe/source LI có chứng cứ |
| `cloth` | Cloth | Catalog SOH hiện có • LI: `cloth` | Giữ item và vai trò LI cloth, khôi phục recipe/source LI có chứng cứ |
| `berries` | Berries | Catalog SOH hiện có • LI: `wild_berry` | Giữ item và vai trò LI wild_berry, khôi phục recipe/source LI có chứng cứ |
| `meat` | Raw Meat | Catalog SOH hiện có • LI: `animal_meat` | Giữ item và vai trò LI animal_meat, khôi phục recipe/source LI có chứng cứ |
| `cooked_meat` | Roast Meat | Catalog SOH hiện có | Thịt nấu ở campfire trong LI (nguồn 2019), thiếu trong tập 139 |
| `mushroom` | Marsh Cap | Catalog SOH hiện có • LI: `mushroom` | Giữ item và vai trò LI mushroom, khôi phục recipe/source LI có chứng cứ |
| `bandage` | Bandage | Catalog SOH hiện có • LI: `bandage` | Giữ item và vai trò LI bandage, khôi phục recipe/source LI có chứng cứ |
| `medkit` | Field Medkit | Catalog SOH hiện có • LI: `medkit` | Giữ item và vai trò LI medkit, khôi phục recipe/source LI có chứng cứ |
| `stone_axe` | Stone Axe | Catalog SOH hiện có | Rìu đá đầu game gốc LI (nguồn 2019), thiếu trong tập 139 |
| `iron_axe` | Iron Axe | Catalog SOH hiện có • LI: `iron_axe` | Giữ item và vai trò LI iron_axe, khôi phục recipe/source LI có chứng cứ |
| `industrial_axe` | Salvager Axe | Catalog SOH hiện có • LI: `refined_iron_axe` | Giữ item và vai trò LI refined_iron_axe, khôi phục recipe/source LI có chứng cứ |
| `torch` | Torch | Catalog SOH hiện có | Đuốc sinh tồn LI (nguồn 2019), thiếu trong tập 139 |
| `gas_mask` | Filter Mask | Catalog SOH hiện có | Mặt nạ phòng phóng xạ LI 2019, thiếu trong tập 139 |
| `blueprint` | Blueprint | Catalog SOH hiện có | Bản vẽ LI học công thức, dữ liệu 139 phản ánh Drawing Bench nhưng thiếu generic Blueprint ID |
| `fuel_can` | Fuel Canister | Catalog SOH hiện có • LI: `low_quality_fuel` | Giữ item và vai trò LI low_quality_fuel, khôi phục recipe/source LI có chứng cứ |
| `vehicle_frame` | Utility Frame | Catalog SOH hiện có • LI: `vehicle_frame` | Giữ item và vai trò LI vehicle_frame, khôi phục recipe/source LI có chứng cứ |
| `refined_iron_ingot` | Refined Iron Ingot | Catalog SOH hiện có • LI: `refined_iron_ingot` | Giữ item và vai trò LI refined_iron_ingot, khôi phục recipe/source LI có chứng cứ |
| `metal_pipe` | Metal Pipe | Catalog SOH hiện có • LI: `metal_pipe` | Giữ item và vai trò LI metal_pipe, khôi phục recipe/source LI có chứng cứ |
| `metal_blade` | Metal Blade | Catalog SOH hiện có • LI: `metal_blade` | Giữ item và vai trò LI metal_blade, khôi phục recipe/source LI có chứng cứ |
| `mechanical_gear` | Mechanical Gear | Catalog SOH hiện có • LI: `mechanical_gear` | Giữ item và vai trò LI mechanical_gear, khôi phục recipe/source LI có chứng cứ |
| `iron_plate` | Iron Plate | Catalog SOH hiện có • LI: `iron_plate` | Giữ item và vai trò LI iron_plate, khôi phục recipe/source LI có chứng cứ |
| `motorbike_kit` | Utility Motorbike (packed) | Catalog SOH hiện có • LI: `motorcycle` | Giữ item và vai trò LI motorcycle, khôi phục recipe/source LI có chứng cứ |
| `animal_fat` | Animal Fat | LI source, cần đưa vào runtime • LI: `animal_fat` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `blue_card` | Blue Card | LI source, cần đưa vào runtime • LI: `blue_card` | Giữ item và recipe/source LI theo edition đã ghi; source grade INDIRECT |
| `canned_meat` | Canned Meat | LI source, cần đưa vào runtime • LI: `canned_meat` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `cleaver` | Cleaver | LI source, cần đưa vào runtime • LI: `cleaver` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `dried_meat` | Dried Meat | LI source, cần đưa vào runtime • LI: `dried_meat` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `electric_resistor` | POI Electrical Resistor | LI source, cần đưa vào runtime • LI: `electric_resistor` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `electronic_parts` | Electronic Parts | LI source, cần đưa vào runtime • LI: `electronic_parts` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `fruit_juice` | Fruit Juice | LI source, cần đưa vào runtime • LI: `fruit_juice` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `fruit_wine` | Fruit Wine | LI source, cần đưa vào runtime • LI: `fruit_wine` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `green_card` | Green Card | LI source, cần đưa vào runtime • LI: `green_card` | Giữ item và recipe/source LI theo edition đã ghi; source grade INDIRECT |
| `grilled_mushroom` | Grilled Mushroom | LI source, cần đưa vào runtime • LI: `grilled_mushroom` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `iron_plate_boots` | Iron Plate Boots | LI source, cần đưa vào runtime • LI: `iron_plate_boots` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `iron_plate_chest` | Iron Plate Chest | LI source, cần đưa vào runtime • LI: `iron_plate_chest` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `iron_plate_helmet` | Iron Plate Helmet | LI source, cần đưa vào runtime • LI: `iron_plate_helmet` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `iron_plate_pants` | Iron Plate Pants | LI source, cần đưa vào runtime • LI: `iron_plate_pants` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `jam` | Jam | LI source, cần đưa vào runtime • LI: `jam` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `large_furnace` | Large Furnace | LI source, cần đưa vào runtime • LI: `large_furnace` | Giữ item và recipe/source LI theo edition đã ghi; source grade INDIRECT |
| `machete` | Machete | LI source, cần đưa vào runtime • LI: `machete` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `mushroom_soup` | Mushroom Soup | LI source, cần đưa vào runtime • LI: `mushroom_soup` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `needle_thread` | Needle Thread | LI source, cần đưa vào runtime • LI: `needle_thread` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `needle_tube` | Needle Tube | LI source, cần đưa vào runtime • LI: `needle_tube` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `purple_card` | Purple Card | LI source, cần đưa vào runtime • LI: `purple_card` | Giữ item và recipe/source LI theo edition đã ghi; source grade INDIRECT |
| `refined_iron_boots` | Refined Iron Boots | LI source, cần đưa vào runtime • LI: `refined_iron_boots` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `refined_iron_chest` | Refined Iron Chest | LI source, cần đưa vào runtime • LI: `refined_iron_chest` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `refined_iron_helmet` | Refined Iron Helmet | LI source, cần đưa vào runtime • LI: `refined_iron_helmet` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `refined_iron_legs` | Refined Iron Legs | LI source, cần đưa vào runtime • LI: `refined_iron_legs` | Giữ item và recipe/source LI theo edition đã ghi; source grade LEGACY_CLAIM |
| `steel_folding_ladder` | Steel Folding Ladder | LI source, cần đưa vào runtime • LI: `steel_folding_ladder` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `syringe` | Syringe | LI source, cần đưa vào runtime • LI: `syringe` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `tin_can` | Tin Can | LI source, cần đưa vào runtime • LI: `tin_can` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `wood_club` | Wood Club | LI source, cần đưa vào runtime • LI: `wood_club` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `wooden_ladder` | Wooden Ladder | LI source, cần đưa vào runtime • LI: `wooden_ladder` | Giữ item và recipe/source LI theo edition đã ghi; source grade DIRECT |
| `deploy_bed_straw` | bed_straw | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_chest_small` | chest_small | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_chest_large` | chest_large | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_campfire` | campfire | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_furnace` | furnace | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_oil_pump` | oil_pump | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_refinery` | refinery | Packed vật thể có UID • LI: `oil_refinery` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_workbench` | workbench | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_base_generator` | base_generator | Packed vật thể có UID • LI: `fuel_generator` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_power_cable` | power_cable | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_power_switch` | power_switch | Packed vật thể có UID • LI: `switch` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_pressure_switch` | pressure_switch | Packed vật thể có UID • LI: `pressure_switch` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_ir_sensor` | ir_sensor | Packed vật thể có UID • LI: `infrared_switch` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_bear_trap` | bear_trap | Packed vật thể có UID • LI: `bear_trap` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_spikes` | spikes | Packed vật thể có UID • LI: `wood_spikes` | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |
| `deploy_barricade` | barricade | Packed vật thể có UID | Gói placeable có UID thuộc run; giữ công trình/cost LI nếu có nguồn; không thêm một bản sao LI |

## B. Gần vai trò Last Island — thay đổi vì hướng game SOH (42 ID)

Không copy cả vật phẩm cũ lẫn vật phẩm thay thế nếu chúng phục vụ cùng một vai trò. Creator/Field Core thay vũ khí nóng và các loại năng lượng thay ammo súng. Các dụng cụ, bow/arrow và phòng thủ bằng cung vẫn có thể dùng độc lập khi chưa có Core.

| ID final | Tên hoặc sản phẩm | Nguồn trong game / quan hệ | Lý do |
|---|---|---|---|
| `energy_basic` | Basic Energy | Catalog SOH hiện có | Kho đạn Core cơ bản; thay đạn súng LI |
| `energy_refined` | Refined Energy | Catalog SOH hiện có | Kho đạn kỹ thuật Creator Core; thay đạn cao cấp LI |
| `essence_fire` | Fire Essence | Catalog SOH hiện có | Nhiên liệu Signature của Creator Core lửa |
| `essence_nature` | Nature Essence | Catalog SOH hiện có | Nhiên liệu Signature của Creator Core thiên nhiên |
| `essence_water` | Water Essence | Catalog SOH hiện có | Nhiên liệu Signature của Creator Core nước |
| `essence_spirit` | Spirit Essence | Catalog SOH hiện có | Nhiên liệu Signature của Creator Core linh hồn |
| `core_blast` | Big Bang | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_meteor` | Meteor | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_dragon` | Dragon's Breath | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_elsa` | Elsa's Sword | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_earthmother` | Earth Mother's Breath | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_mjolnir` | Mjolnir | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_demon` | Demon Core | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `trail_pack` | Trail Pack | Catalog SOH hiện có | Túi đi loot; đổi quyền chở hàng và ô lưng K7 |
| `trail_canteen` | Trail Canteen | Catalog SOH hiện có | Bình nước nhiều lượt phục vụ tuyến xa K7 |
| `plank` | Plank | Catalog SOH hiện có | Ván qua gia công thật cho nhà (Bible K4), cần cấu trúc sử dụng được |
| `fiber` | Plant Fiber | Catalog SOH hiện có | Sợi thực vật hỗ trợ thủ công LI và nhịp sinh tồn tự do |
| `crystal` | Frost Crystal | Catalog SOH hiện có | Quặng tinh thể đặc thù dùng Core, thay nhánh năng lượng LI |
| `sulfur` | Sulfur | Catalog SOH hiện có | Khoáng lưu huỳnh SOH phục vụ Essence/Core; không làm hệ đạn thuốc súng |
| `leather` | Leather | Catalog SOH hiện có | Gia công da thú dùng công cụ, trang bị/đồ đựng |
| `glass` | Glass | Catalog SOH hiện có | Kính cửa sổ, mặt nạ, vật dụng sinh tồn Veyra |
| `water_flask` | Water Flask | Catalog SOH hiện có | Bình nước khởi đầu dùng nước thật K5 |
| `antirad` | Purge Tonic | Catalog SOH hiện có | Thuốc giảm phơi nhiễm theo hazard K2/K5 |
| `knife` | Survival Knife | Catalog SOH hiện có | Dao sinh tồn ban đầu đa chức năng, vẫn tự vệ khi chưa có Core |
| `stone_pick` | Stone Pickaxe | Catalog SOH hiện có | Cuốc đá chuyên khai mỏ trong world K3 |
| `iron_pick` | Iron Pickaxe | Catalog SOH hiện có | Cuốc sắt nâng khai thác quặng |
| `industrial_pick` | Salvager Pick | Catalog SOH hiện có | Cuốc khai thác nâng cao; dùng chất lượng công cụ, không bắt Gear vô cớ |
| `wood_spear` | Fire-hardened Spear | Catalog SOH hiện có | Giáo đầu run tạo tầm đánh khác LI Wood Club |
| `bow` | Hunting Bow | Catalog SOH hiện có | Vũ khí bắn xa tiêu Arrow cho đường PvE không Core |
| `reinforced_spear` | Reinforced Spear | Catalog SOH hiện có | Giáo cao cấp cho tuyến PvE không Core, có tầm đánh riêng |
| `arrow` | Arrow | Catalog SOH hiện có | Đạn cho Bow và Arrow Turret, không giữ ammo súng |
| `leather_armor` | Leather Jerkin | Catalog SOH hiện có | Giáp nhẹ đầu run dùng sinh vật thay tuyến giáp đắt LI |
| `scrap_helm` | Scrap Helm | Catalog SOH hiện có | Mũ bảo hộ rẻ dành cho sinh tồn PvE đầu run |
| `core_fire` | Ember Core | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_earth` | Quake Core | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_storm` | Storm Core | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `core_frost` | Rime Core | Catalog SOH hiện có | Core đặc thù thay vũ khí nóng LI; giữ nguyên luật Creator/Field Core Bible |
| `deploy_claim` | claim | Packed vật thể có UID • LI: `territory_cabinet` | Tủ lãnh địa theo Bible K6 (không PvP; nền thật; upkeep; 24 ô) |
| `deploy_research` | research | Packed vật thể có UID • LI: `drawing_bench` | Nghiên cứu K4 hợp nhất theo run |
| `deploy_arrow_turret` | arrow_turret | Packed vật thể có UID • LI: `auto_rifle_turret` | Phòng thủ quái dùng Arrow, thay toàn bộ tháp súng LI |
| `deploy_torch_post` | torch_post | Packed vật thể có UID | Đèn trụ hiển thị tầm nhìn thật K2 |
| `door_powered` | Powered Door | ID mới trong thiết kế final • LI: `electric_door` | Cửa điện kiểu LI nhưng khóa quyền/thoát hiểm theo K6; hiện MODULE_PENDING |

## C. Đặc thù SOH — chỉ tồn tại vì Core, Veyra, nông nghiệp, Elder và Ragnarok (37 ID)

Chỉ item thực sự phục vụ luật Bible hoặc sinh cảnh Veyra được phép tồn tại. Hạt giống khác loài, gia súc cần thức ăn-nước, thiết bị tự động hóa do người chơi chủ động xây, đá Elder và tiền Ragnarok có nguồn hạn định.

| ID final | Tên hoặc sản phẩm | Nguồn trong game / quan hệ | Lý do |
|---|---|---|---|
| `fur` | Fur | Catalog SOH hiện có | Khí hậu tám mùa: giữ ấm / động vật địa phương |
| `chitin` | Ash Chitin | Catalog SOH hiện có | Sinh vật Veyra: nguyên liệu giáp vỏ; cần thêm nguồn thật |
| `shell` | Crab Shell | Catalog SOH hiện có | Động vật vùng nước và Essence nước |
| `gland` | Mire Gland | Catalog SOH hiện có | Quái vùng độc và thuốc chống phơi nhiễm |
| `herb` | Bitterleaf | Catalog SOH hiện có | Bitterleaf: thảo dược nuôi trồng phụ thuộc mùa |
| `crop` | Sunroot | Catalog SOH hiện có | Sunroot: nông sản do vườn SOH tạo ra |
| `stew` | Root Stew | Catalog SOH hiện có | Món hầm tạo giá trị thức ăn + nhiệt khi có mùa lạnh |
| `chitin_armor` | Chitin Plate | Catalog SOH hiện có | Giáp sinh học từ Ash Chitin; phải có quái nguồn |
| `fur_cloak` | Fur Cloak | Catalog SOH hiện có | Áo chịu lạnh chiếm vị trí lưng khi thời tiết theo mùa |
| `wolf_fang` | Wolf Fang (specimen) | Catalog SOH hiện có | Vật mẫu quái để học công thức Fur Cloak |
| `crawler_optic` | Crawler Optic (specimen) | Catalog SOH hiện có | Vật mẫu quái vùng nguy hiểm để nghiên cứu |
| `boar_tusk` | Boar Tusk (specimen) | Catalog SOH hiện có | Vật mẫu từ heo rừng để nghiên cứu |
| `beetle_horn` | Beetle Horn (specimen) | Catalog SOH hiện có | Vật mẫu bọ để nghiên cứu giáp |
| `rcash` | Ragnarok Cash | Catalog SOH hiện có | Tiền vật lý Ragnarok chỉ từ rương POI hữu hạn cuối72h |
| `escrow_chest` | Escrow Chest | Catalog SOH hiện có | Rương tự mua bằng Ragnarok Cash, đặt ở nhà rồi gửi tiền hợp lệ |
| `cart_kit` | Hand Cart (packed) | Catalog SOH hiện có | Xe kéo phục vụ vận tải hàng thật không xăng (Bible K7) |
| `stone_surtur` | Stone of Surtur | Catalog SOH hiện có | Đá duy nhất của Primordial Surtur trong run |
| `stone_typhon` | Stone of Typhon | Catalog SOH hiện có | Đá duy nhất của Primordial Typhon trong run |
| `stone_aion` | Stone of Aion | Catalog SOH hiện có | Đá duy nhất của Primordial Aion trong run |
| `stone_atlas` | Stone of Atlas | Catalog SOH hiện có | Đá duy nhất của Primordial Atlas trong run |
| `stone_argus` | Stone of Argus | Catalog SOH hiện có | Đá duy nhất của Primordial Argus trong run |
| `stone_anubis` | Stone of Anubis | Catalog SOH hiện có | Đá duy nhất của Primordial Anubis trong run |
| `lead_rope` | Taming Lead | Catalog SOH hiện có | Thuần/dắt thú từ world đến chuồng vật lý |
| `animal_feed` | Fodder Bundle | Catalog SOH hiện có | Thức ăn thật cho chuồng; không tự sinh sản lượng offline |
| `feather` | Grouse Feather | Catalog SOH hiện có | Sản phẩm chăn nuôi Grouse, dùng mũi tên |
| `grouse_egg` | Grouse Egg | Catalog SOH hiện có | Sản phẩm chăn nuôi Grouse; thức ăn tái tạo có nguồn |
| `relic_shaleheart` | Shaleheart Coreplate | Catalog SOH hiện có | Vật phẩm độc nhất từ side boss Shaleheart |
| `ronin_nodachi` | Oathless Nodachi | Catalog SOH hiện có | Vũ khí độc nhất từ side boss Oathless Ronin |
| `tidemarshal_trident` | Saltwick Trident | Catalog SOH hiện có | Vũ khí độc nhất từ side boss Tidemarshal |
| `custodian_lantern` | Archive Lantern | Catalog SOH hiện có | Đồ hiếm từ side boss Custodian |
| `deploy_garden` | garden | Packed vật thể có UID | Luống trồng thủ công có đất/nước/mùa |
| `deploy_farm_controller` | farm_controller | Packed vật thể có UID | Thiết bị thu hoạch-trồng lại theo input điện/nước/giống thật K4 |
| `deploy_barrel` | barrel | Packed vật thể có UID | Bể nước mưa làm nguồn tưới có custody thật |
| `deploy_feed_trough` | feed_trough | Packed vật thể có UID | Máng thức ăn nước cho thú nuôi vật lý |
| `seed_sunroot` | Sunroot Seed | ID mới trong thiết kế final | Hạt riêng loài Sunroot, không spawn cùng giống loại khác |
| `seed_bitterleaf` | Bitterleaf Seed | ID mới trong thiết kế final | Hạt riêng loài Bitterleaf; thời vụ, đất và nước đúng K4 |
| `seed_wildberry` | Wild Berry Seed | ID mới trong thiết kế final | Giống bụi Berry cho vườn SOH, tách nguồn hái dại LI |

## Các ID SOH không còn được phát hành trong run mới (19)

| ID cũ | Lý do cụ thể / kế hoạch |
|---|---|
| `salvaged_oil` | Gộp về LI Crude Oil; giữ nguồn lấy từ barrel/wreck phù hợp, không tự phát dầu vô hạn |
| `lubricant` | Không cần một vật liệu bảo trì xe riêng khi dùng spare/repair chuẩn LI |
| `damaged_drive` | Recycler xử lý vật phẩm máy nguồn LI trực tiếp; không ép phải qua một ID Drive hỏng tổng quát |
| `mechanical_parts` | Loại phụ phí công thức SOH; chuyển consumers trở về Mechanical Gear / Parts / Electronic Parts LI |
| `fasteners` | Loại vật liệu lắp ráp phổ quát không có LI source đúng; trả về Needle Thread, Gear, Iron Plate theo trường hợp; thay quyết định V2 trước |
| `treated_canvas` | Không bắt mọi túi/bình nước qua phụ phẩm vải xử lý ngoài LI |
| `field_repair_kit` | Sửa chữa bằng trạm/vật liệu thật, tránh một kit ảo cho 40 mục tiêu |
| `fuel_briquette` | Không thêm tầng nhiên liệu rắn nếu LI có wood/charcoal/low-quality fuel |
| `coal` | Không thêm nguồn than mỏ riêng khi nhiệt công nghiệp LI dùng nguồn đã có; không tự xóa node trước migration |
| `raw_salt` | Không tạo chuỗi muối SOH phụ nếu LI đã có Dried/Canned Meat |
| `root_broth` | Dùng Mushroom Soup LI; món Stew SOH khác vì chống lạnh |
| `herb_roast` | Trùng vai trò món thịt chế biến LI |
| `salted_meat` | Dùng Canned Meat/Dried Meat LI, không tạo preservation loop mới |
| `scrap` | LI Parts để R&D; phế liệu kim loại thu hồi theo source/recipe LI thay vì một tài nguyên không có tương ứng; chuyển giá trị tồn kho cũ |
| `brick` | Ưu tiên vật liệu/liên kết nhà LI Stone/Iron; không nung đá vô lý thành Brick; đổi recipe/wall liên quan |
| `seed` | Thay generic Seed bằng ba giống cây có định danh loài và mùa thực |
| `iron_sword` | Dùng LI Machete; SOH có Knife/Spear tạo sự khác biệt PvE |
| `keycard` | Trả về Green/Blue/Purple Cards của LI; POI chỉ cấp quyền nào thật sự có cửa |
| `vehicle_drive` | Motorbike craft LI từ Frame + Gear + Plates, không bắt thêm Motor Drive trung gian |

### Sáu Elder Stone cũ (legacy only)

`stone_frost`, `stone_magma`, `stone_bog`, `stone_grove`, `stone_tide`, `stone_rust`. Giữ alias/migration cho save cũ nếu có, không có loot hoặc công thức trong run mới. Canon 6 stones là `stone_surtur`, `stone_typhon`, `stone_aion`, `stone_atlas`, `stone_argus`, `stone_anubis`.

## LI không copy nguyên dạng — phân rã rõ theo nguyên nhân

- **Họ súng, đạn, phụ tùng (32):** `akm`, `ammo_12g`, `ammo_12g_ap`, `ammo_556`, `ammo_556_he`, `ammo_762`, `ammo_762_he`, `ammo_8mm_handmade`, `ammo_9mm`, `bizon_smg`, `double_barrel_shotgun`, `famas`, `flamethrower`, `flamethrower_gas_ammo`, `handgun_body`, `k31`, `launcher_mechanism`, `m24`, `mg4`, `qbz97`, `rifle_body`, `rocket_ammo`, `rocket_launcher`, `semi_auto_pistol`, `semi_auto_rifle`, `shotgun_body`, `simple_revolver`, `single_shot_shotgun`, `smg`, `smg_body`, `sniper_body`, `torsion_spring`. Thay chiến đấu cao cấp bằng Core/Essence; Bow/Arrow cho ranged cơ bản, không giữ gunpowder/ammo economy.
- **Raiding / vật liệu mồ côi (8):** `barrel_bomb`, `explosive_material`, `gunpowder`, `handmade_explosive_pack`, `handmade_explosives`, `military_c4`, `old_military_mine`, `suicide_robot`.
- **Khác bản chất hoặc thay vai trò (17):** `auto_rifle_turret`, `auto_shotgun_turret`, `dirt_grenade`, `drawing_bench`, `egg`, `electric_door`, `energy_extractor`, `energy_refinery`, `improved_grenade`, `molotov_cocktail`, `nettle`, `nettle_seed`, `rocket_turret`, `sulfur_powder`, `territory_cabinet`, `tracking_auto_turret`, `wild_berry_seed`. Đã có item tương ứng trong B hoặc C, không tạo bản sao.
- **Không phù hợp nền hiện hành (5):** `glider_legacy`, `inferno_chariot`, `inferno_chariot_blueprint`, `mountain_bicycle_blueprint`, `self_revive_defibrillator`.
- **7 công thức đời khác + 6 item sự kiện + 1 alias:** giữ riêng như chứng cứ lịch sử, không sinh thành item mới của base.

## Tác động thiết kế bắt buộc khi triển khai — không phải quyền tùy ý

1. **LI sources/recipes như gốc:** `electronic_parts`, `needle_thread`, `animal_fat`, `low_quality_fuel`, `iron_plate_*`, `refined_iron_*`, `mushroom_soup`, `canned_meat`, `green/blue/purple_card`, `syringe` và các item khác phải có world source, recipe, inventory/use/target, không chỉ ID. Giữ giá trị LI đã xác nhận, cảnh báo mọi source chưa rõ edition.
2. **Nghiên cứu/nhà điện:** `drawing_bench`↔`deploy_research`, `territory_cabinet`↔`deploy_claim`, LI auto turrets↔`deploy_arrow_turret`, `electric_door`↔`door_powered` có 1 vật thể SOH duy nhất mỗi loại; không spawn song song.
3. **K2/K4 thời gian:** các item của vườn/chuồng/`deploy_farm_controller` có source vật lý + nước/giống/điện/kho + thời gian/season offline. Không sản sinh item khi thiếu input. Ba giống cây mới không được tự tăng số lượng qua trồng lại.
4. **Run reset:** toàn bộ 157 item thuộc run; `rcash` chỉ được profile hóa bằng chest secured, `escrow_chest` chính nó cũng bị xóa cuối run. Sáu stones chỉ một lần mỗi Elder, không sinh thêm.
5. **Chiến đấu:** không thêm gun projectiles/backpack ammo; Core Gold có nhiều chức năng, không cấm kiếm/cung/dao đánh quái, cây, thùng nếu profile cho phép; turrets dùng arrow ammo và phòng thủ theo dấu quái hợp lệ.
6. **Save/recipe migration:** ID 19 retired không được xóa thẳng khỏi save cũ; chuyển inventory, pending jobs, sources và learned flags có receipt một lần, bảo toàn giá trị, không tạo loop hồi dương. 6 legacy stone cũng phải có quy tắc tương thích.
7. **World blockers chưa được giải:** `crude_petroleum` chưa có oil site thật; Veyra chưa có cửa dùng keycard; Ash Chitin, Crawler Optic, Wolf Fang, Beetle Horn chưa có nguồn; `door_powered` còn module-pending; thẻ/tháp/giáp mới chưa được xem như playable cho tới khi map/action/loots dùng được.

## Phân biệt 3 lớp chứng cứ

- **Bible:** canon game, gói run, Core, Ragnarok, farming, husbandry và policy chặn PvP. **Hướng chọn không có súng** là quyết định thiết kế mới theo yêu cầu ba nhóm Creator (Core thay vũ khí đặc biệt), không giả làm lệnh cấm súng xuất hiện trong Bible từ trước.
- **Last Island:** 139 ID nguồn đa phiên bản và 63 item gốc được chọn giữ; tài liệu 2019 bổ sung các chức năng Stone, Stone Axe, Torch, Cooked Meat, Radiation Mask, Blueprint. Nguồn: `LI_SOURCE_ITEMS_AND_RECIPES.json`; bảng đánh giá provenance ở `li-historical-crosswalk.csv`.
- **SOH runtime:** catalog/STRUCTS cho item ID và cơ chế sẵn có nhưng catalog present không đồng nghĩa world source active hoặc player-ready; nhánh PR #62 chỉ là thiết kế/dữ liệu, chưa sửa bảng production `ITEMS`/`RECIPES`.

**Quyền ưu tiên:** tài liệu này và JSON `FINAL_THREE_GROUP_ITEM_SET_20261115.json` thay toàn bộ các quyết định cắt/giữ không còn phù hợp trong bảng audit V2 và `BIBLE_DELTA_RESULTS.md`; những bảng cũ chỉ để truy dấu tại thời điểm trước khi Creator chốt 3 nhóm.
