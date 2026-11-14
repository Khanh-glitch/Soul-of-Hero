# SOH item inventory vs Last Island — tách item riêng, vai trò tương đương và legacy

**Nguồn:** Bible đang hiệu lực `web/ref/bible.md`; item/recipe hiện có `web/src/game/catalog.ts` trên PR #62 (nền `bb2d4a7`); `item-ontology-decisions.ts` (bảng V2 có quyết định cũ); `LI_SOURCE_ITEMS_AND_RECIPES.json` (139 ID lịch sử nhiều đời, **không bao phủ toàn Last Island**).

**Đếm đúng:** **147 ID hiện có** = **123 định nghĩa trong catalog** + **24 gói công trình `deploy_*` sinh từ `DEPLOYABLE_TYPES`**. 123 chia không trùng: 25 item SOH canon; 4 phần thưởng side boss; 6 đá Elder legacy; 32 item có đối chiếu LI cụ thể trong ontology V2 (trong đó có cả các tương đồng **chỉ chức năng**, không phải item y hệt); 56 item SOH mở rộng/chưa thể chứng minh có đối ứng trực tiếp trong 139 ID LI. **Không được suy ra 56 item là bản quyền độc quyền SOH, hoặc 32 item có cùng recipe LI.**

| Nhóm | Count | Ý nghĩa |
|---|---:|---|
| SOH_CANON | 25 | 7 Creator Core, 4 Field Core, 6 năng lượng/Essence, 6 Primordial Stones, Ragnarok Cash & Escrow |
| SOH_SIDE_BOSS | 4 | Trang bị/di vật từ side bosses Veyra |
| LEGACY_ONLY | 6 | Sáu đá Elder schema cũ, không tính thành 12 đá hiện hành |
| LI_DIRECT_OR_ROLE | 32 | Có item LI tham chiếu ghi cụ thể trong ontology; một số chỉ tương tự chức năng |
| SOH_EXTENSION_OR_UNKNOWN | 56 | Item riêng của cách triển khai SOH hoặc chưa khớp được ID LI do bộ nguồn thiếu |
| deploy_* | 24 | Runtime wrapper: item đóng gói cho 24 loại công trình, không tự tăng 24 loại item Last Island |

**Cảnh báo:** `last_island_comparison` nêu quan hệ so sánh, KHÔNG xác nhận cùng công thức hoặc loot. `livability_notes` lấy từ trạng thái được ghi trong Bible ngày 14/11; catalog present ≠ world source playable. Bản quyết định copy-first mới của Creator thay đổi tiêu chí đánh giá so với verdict V2 cũ, nên không sử dụng `KEEP` V2 để khóa danh mục LI.

## A. Nhóm riêng SOH do Bible xác định (25)

| SOH ID | Tên hiện có | Đối chiếu LI / Vai trò | Trạng thái/chú ý |
|---|---|---|---|
| `energy_basic` | Basic Energy | Đạn và Essence của Creator Core | Load into a Creator Core for its primary attack. |
| `energy_refined` | Refined Energy | Đạn và Essence của Creator Core | Load for techniques or combine with matching essence for Signature. |
| `essence_fire` | Fire Essence | Đạn và Essence của Creator Core | Fire Signature loading material. |
| `essence_nature` | Nature Essence | Đạn và Essence của Creator Core | Nature Signature loading material. |
| `essence_water` | Water Essence | Đạn và Essence của Creator Core | Water Signature loading material. |
| `essence_spirit` | Spirit Essence | Đạn và Essence của Creator Core | Phụ thuộc Crawler Optic chưa có source |
| `core_blast` | Big Bang | Core đặc thù | Common Fire Core. Reload each reserve with Basic, Refined or Refined plus Fire Essence. |
| `core_meteor` | Meteor | Core đặc thù | Rare Fire Core. A fireball, targeted meteor and ten-meteor storm. |
| `core_dragon` | Dragon's Breath | Core đặc thù | Top-tier Fire Core: flamethrower, fire tornado and dragon dive. |
| `core_elsa` | Elsa's Sword | Core đặc thù | Rare Water Core: ice projectile, one-second self-freeze and viewport freeze. |
| `core_earthmother` | Earth Mother's Breath | Core đặc thù | Common Nature Core: rock, grove and binding roots. |
| `core_mjolnir` | Mjolnir | Core đặc thù | Rare Nature Core: thunder punch, five lightning strikes and electrical attraction. |
| `core_demon` | Demon Core | Core đặc thù | Nguồn nguyên liệu Crawler Optic chưa có |
| `core_fire` | Ember Core | Core đặc thù | Hurls a fireball that ignites trees and grass. Charge spent on release. |
| `core_earth` | Quake Core | Core đặc thù | Raises a spike line that shatters rocks into yield. |
| `core_storm` | Storm Core | Core đặc thù | Chain lightning. Stronger in rain. |
| `core_frost` | Rime Core | Core đặc thù | Frost nova; freezes shallow water into walkable ice for a while. |
| `rcash` | Ragnarok Cash | Ragnarok, ký gửi vật lý | Physical, unsecured. Can be lost. Deposit in an owned Escrow Chest. |
| `escrow_chest` | Escrow Chest | Ragnarok, ký gửi vật lý | Escrow chest. Place on owned land, then deposit physical Ragnarok cash into your profile. |
| `stone_surtur` | Stone of Surtur | Đá của sáu Primordial Elder | Primordial cinder-heart claimed from Surtur in the Volcanic Core. |
| `stone_typhon` | Stone of Typhon | Đá của sáu Primordial Elder | Primordial storm-eye claimed from Typhon at the Tempest Lair. |
| `stone_aion` | Stone of Aion | Đá của sáu Primordial Elder | Primordial hourglass-seed claimed from Aion in the Elderwood. |
| `stone_atlas` | Stone of Atlas | Đá của sáu Primordial Elder | Primordial keystone claimed from Atlas at the Gate of Pillars. |
| `stone_argus` | Stone of Argus | Đá của sáu Primordial Elder | Primordial panopticon lens claimed from Argus in the Hall of Eyes. |
| `stone_anubis` | Stone of Anubis | Đá của sáu Primordial Elder | Primordial scale-seal claimed from Anubis in the Necropolis. |

## B. Phần thưởng riêng các side boss (4)

| SOH ID | Tên hiện có | Đối chiếu LI / Vai trò | Trạng thái/chú ý |
|---|---|---|---|
| `relic_shaleheart` | Shaleheart Coreplate | Đồ hiếm riêng từ side boss | Run-local crystal-veined quarry carapace taken from Greyback Shaleheart (-38% damage). |
| `ronin_nodachi` | Oathless Nodachi | Đồ hiếm riêng từ side boss | Run-local long-bladed nodachi claimed from the Oathless Ronin. |
| `tidemarshal_trident` | Saltwick Trident | Đồ hiếm riêng từ side boss | Run-local brine-tempered polearm of the Saltwick Tidemarshal. |
| `custodian_lantern` | Archive Lantern | Đồ hiếm riêng từ side boss | Run-local silver-violet ward lantern of the Pale Custodian. Steady wide light. |

## C. Item SOH có đối ứng Last Island được nêu rõ (32)

| SOH ID | Tên hiện có | Đối chiếu LI / Vai trò | Trạng thái/chú ý |
|---|---|---|---|
| `crude_petroleum` | Crude Petroleum | LI Crude Oil: cùng bản chất dầu thô, nhưng giếng dầu SOH chưa có nguồn thật | CHƯA CÓ NGUỒN DẦU NGOÀI WORLD (fixture only) |
| `salvaged_oil` | Salvaged Oil | LI Crude Oil: cùng công dụng nhiên liệu, khác nguồn (xác xe) | LI Crude Oil: cùng công dụng nhiên liệu, khác nguồn (xác xe) |
| `wood` | Wood | LI wood (historical row exists) | Split timber. Fuel, tools, walls. |
| `fiber` | Plant Fiber | LI Cloth: nguyên liệu đầu vào được tách thô hơn | LI Cloth: nguyên liệu đầu vào được tách thô hơn |
| `iron_ore` | Iron Ore | LI raw_iron_ore (historical row exists) | Smelt in a fueled furnace. |
| `rich_iron_ore` | Rich Iron Ore | LI Refined Iron Ore: nguồn nâng cấp luyện kim gần tương đương | LI Refined Iron Ore: nguồn nâng cấp luyện kim gần tương đương |
| `root_broth` | Root Broth | LI Mushroom Soup: cùng nhóm món canh, nguyên liệu và tác dụng khác | LI Mushroom Soup: cùng nhóm món canh, nguyên liệu và tác dụng khác |
| `salted_meat` | Salted Roast | LI Canned Meat: cùng ý đồ bảo quản/chế biến, không cùng sản phẩm | LI Canned Meat: cùng ý đồ bảo quản/chế biến, không cùng sản phẩm |
| `sulfur` | Sulfur | LI Sulfur Powder: khác dạng nguyên liệu, hiện liên kết Core | LI Sulfur Powder: khác dạng nguyên liệu, hiện liên kết Core |
| `scrap` | Scrap Metal | LI Parts: cùng không gian salvage nhưng bản chất khác (Scrap nấu lại được) | LI Parts: cùng không gian salvage nhưng bản chất khác (Scrap nấu lại được) |
| `spares` | Parts | LI Parts: cùng vai trò vật liệu không chế tạo, loot/tái chế và nghiên cứu | LI Parts: cùng vai trò vật liệu không chế tạo, loot/tái chế và nghiên cứu |
| `iron_ingot` | Iron Ingot | LI iron_ingot (historical row exists) | Smelted iron. |
| `rope` | Rope | LI rope (historical row exists) | Twisted fiber. |
| `cloth` | Cloth | LI cloth (historical row exists) | Woven fiber cloth. |
| `berries` | Berries | LI wild_berry (historical row exists) | Sweet and watery. |
| `meat` | Raw Meat | LI animal_meat (historical row exists) | Risky raw. Cook at a campfire. |
| `cooked_meat` | Roast Meat | LI Dried Meat: gần vai trò món từ thịt, không đồng nhất kỹ thuật chế biến | LI Dried Meat: gần vai trò món từ thịt, không đồng nhất kỹ thuật chế biến |
| `mushroom` | Marsh Cap | LI mushroom (historical row exists) | Edible. Slightly toxic raw. |
| `bandage` | Bandage | LI bandage (historical row exists) | Stops bleeding. |
| `medkit` | Field Medkit | LI medkit (historical row exists) | Herbal dressing. |
| `iron_axe` | Iron Axe | LI iron_axe (historical row exists) | Bites deep into timber. |
| `industrial_axe` | Salvager Axe | LI Refined Iron Axe: cùng bậc công cụ, khác BOM và thông số | LI Refined Iron Axe: cùng bậc công cụ, khác BOM và thông số |
| `wood_spear` | Fire-hardened Spear | LI Wood Club: cùng vị trí vũ khí sớm, khác tầm và kiểu đánh | LI Wood Club: cùng vị trí vũ khí sớm, khác tầm và kiểu đánh |
| `iron_sword` | Iron Sword | LI Machete: vũ khí cận chiến gần vai trò, khác chiêu thức | LI Machete: vũ khí cận chiến gần vai trò, khác chiêu thức |
| `fuel_can` | Fuel Canister | LI Low-Quality Fuel: nhiên liệu được đóng can, không phải 1:1 | LI Low-Quality Fuel: nhiên liệu được đóng can, không phải 1:1 |
| `vehicle_frame` | Utility Frame | LI vehicle_frame (historical row exists) | Welded frame for the motorbike. |
| `refined_iron_ingot` | Refined Iron Ingot | LI refined_iron_ingot (historical row exists) | Furnace-refined iron. Needed for pipe and plate. |
| `metal_pipe` | Metal Pipe | LI metal_pipe (historical row exists) | Pipe section: the tubing of every Utility Frame. One paid bench cycle makes TWO sections. Recyclable at the Foundry Recycler: one section back into 1 Refined Iron In |
| `metal_blade` | Metal Blade | LI metal_blade (historical row exists) | Cut blade stock: the edge of the Salvager Axe, and an optional refit for the Iron Sword and Reinforced Spear. |
| `mechanical_gear` | Mechanical Gear | LI mechanical_gear (historical row exists) | Precision gear for motor drives and powered mechanisms. |
| `iron_plate` | Iron Plate | LI iron_plate (historical row exists) | Plate patch for a damaged wall or door (Shift+click when repairing): restores up to 25% of its max HP per plate. Not a permanent reinforcement. |
| `motorbike_kit` | Utility Motorbike (packed) | LI Motorcycle: cùng phương tiện nhưng SOH đóng gói như item có UID | LI Motorcycle: cùng phương tiện nhưng SOH đóng gói như item có UID |

## D. Item SOH thêm vai trò / chưa có ID LI xác minh (56)

| SOH ID | Tên hiện có | Đối chiếu LI / Vai trò | Trạng thái/chú ý |
|---|---|---|---|
| `lubricant` | Machine Lubricant | LI có chuỗi nhiên liệu và phương tiện; chưa thấy item dầu bôi trơn 1:1 trong 139 ID | Chăm sóc xe, giảm hao mòn |
| `damaged_drive` | Damaged Drive | LI có Recycler cho phế phẩm; chưa có item Drive hỏng 1:1 | Có trong catalog; cần đánh giá dưới copy-first |
| `mechanical_parts` | Machine Parts | Không có ID Last Island tương ứng; không mặc định giữ trong phương án copy-first | Có trong catalog; xung đột với copy-first nếu tự giữ |
| `fasteners` | Forged Fasteners | Last Island có linh kiện cơ khí như Gear/Plate nhưng chưa thấy Fasteners đúng loại; không mặc định giữ | Có trong catalog; không được phép coi LI tương đương |
| `treated_canvas` | Treated Canvas | LI có Cloth và vật liệu dệt; không chứng minh cùng item | Vải đã xử lý làm túi và bình nước |
| `field_repair_kit` | Field Repair Kit | LI có độ bền/sửa đồ; không có item kit 1:1 được xác thực | Bộ sửa công cụ dùng khi không ở bàn |
| `trail_pack` | Trail Pack | Liên hệ vận chuyển/túi đồ LI, chưa có đối ứng 139 ID | Tăng giới hạn tải, chiếm ô lưng |
| `trail_canteen` | Trail Canteen | Liên hệ cấp nước sinh tồn LI, chưa có đối ứng 139 ID | Bình nước nâng cấp 8 lượt |
| `fuel_briquette` | Packed Fuel Briquette | Liên hệ gỗ/charcoal/fuel của LI, không phải cùng fuel item | Nhiên liệu rắn đóng bánh |
| `plank` | Plank | Nhánh Wood và xây nhà LI, chưa có ID Plank được chứng minh | Plank Wall chưa đặt/nâng cấp hợp lệ |
| `stone` | Stone | Nguyên liệu nền của cơ chế khai thác LI, không có ID tương ứng trong 139 | Đá thô xây dựng và công cụ |
| `coal` | Coal | LI có charcoal, chưa chứng minh Coal (than mỏ) là cùng vật phẩm | Than mỏ/nhiên liệu và tinh luyện |
| `charcoal` | Charcoal | LI có hàng Charcoal trong nguồn 139 nhưng citation của hàng đó chưa đủ xác nhận | Than gỗ làm nhiên liệu |
| `crystal` | Frost Crystal | Nguyên liệu Core/địa lý SOH; không có đối ứng 1:1 LI | Frost Crystal cho Core, Refined Energy, Glass |
| `raw_salt` | Raw Salt | LI có bảo quản thịt (Dried/Canned Meat), không có vật liệu Raw Salt đã xác minh | Muối ven biển nấu ăn và xử lý vải |
| `herb_roast` | Herb Roast | Gần vai trò các món thịt chế biến LI, không phải item trùng | Thịt nướng kèm thảo dược, hồi máu |
| `hide` | Raw Hide | LI animal_hide (hàng hỗ trợ nguồn còn thiếu chứng cứ trực tiếp) | Da sống từ săn bắn/chăn nuôi |
| `leather` | Leather | Nhánh animal_hide và chế tạo trang bị LI, chưa đối ứng 1:1 | Da thuộc làm giáp, dụng cụ và bình nước |
| `fur` | Fur | Họ giáp/chống chịu LI; nhấn mạnh khí hậu tám mùa SOH | Lông thú làm áo lạnh |
| `chitin` | Ash Chitin | Họ giáp LI, nhưng Ash Chitin là nguyên liệu sinh cảnh SOH | Ash Chitin chưa có source ở Veyra |
| `shell` | Crab Shell | Họ loot tự nhiên, Core là đặc thù SOH | Vỏ cua dùng tạo Glass / Core |
| `gland` | Mire Gland | Liên hệ thuốc/hóa chất LI nhưng là loot quái SOH | Mire Gland chế Purge Tonic |
| `brick` | Brick | Họ vật liệu xây LI; Stone→Brick trong SOH chưa chứng minh tương ứng gốc | Brick Wall chưa đặt/nâng cấp hợp lệ |
| `glass` | Glass | Họ nguyên liệu sản xuất LI; chưa có row Glass trực tiếp trong 139 | Thủy tinh cho mask/canteen/máy |
| `seed` | Wild Seeds | LI có nettle_seed/wild_berry_seed (nguồn chưa chắc chắn), chức năng nông nghiệp tương tự | Giống cây cho vườn và thức ăn vật nuôi |
| `herb` | Bitterleaf | LI nettle (cây thuốc), gần vai trò, khác loài | Bitterleaf cho thức ăn, thuốc, vải và thuốc giải |
| `crop` | Sunroot | LI nông nghiệp và food loop, chưa đối ứng 1:1 | Sunroot trồng vườn |
| `stew` | Root Stew | LI có mushroom_soup, cùng nhánh nấu món nước | Món hầm ấm và hồi phục |
| `water_flask` | Water Flask | Vai trò nước uống sinh tồn, không chứng minh 1:1 trong 139 | Bình nước cá nhân 4 lượt |
| `antirad` | Purge Tonic | Vai trò y tế/chống phơi nhiễm LI, không có item 1:1 trong 139 | Purge Tonic xử lý phơi nhiễm |
| `knife` | Survival Knife | LI có dao rựa/cleaver/machete; không đồng nhất với chúng | Dao sinh tồn khởi đầu dùng đa mục tiêu |
| `stone_axe` | Stone Axe | Họ công cụ Stone→Iron của Last Island; thiếu ID trong 139 | Rìu đá khởi đầu |
| `stone_pick` | Stone Pickaxe | Họ công cụ khai mỏ LI; thiếu ID trong 139 | Cuốc đá khởi đầu |
| `iron_pick` | Iron Pickaxe | Họ công cụ Iron LI; thiếu ID cụ thể trong 139 | Cuốc sắt đào đá và quặng |
| `industrial_pick` | Salvager Pick | Họ công cụ Refined Iron LI; chưa xác minh item giống hệt | Cuốc nâng cấp lấy nhiều quặng và phế liệu |
| `bow` | Hunting Bow | LI có hệ bắn xa súng/đạn, nhưng cung không cùng item hay công thức | Cung dùng mũi tên vật lý |
| `reinforced_spear` | Reinforced Spear | LI có dao/rựa cận chiến; không xác nhận cùng loại | Giáo sắt tầm xa và bền |
| `arrow` | Arrow | LI có hệ ammo; không được coi Arrow là súng đạn tương đương nguyên liệu | Đạn của cung và tháp tên |
| `torch` | Torch | LI có công cụ/nhiên liệu; không có item đối chiếu 1:1 trong 139 | Đuốc chiếu sáng, công cụ lửa |
| `leather_armor` | Leather Jerkin | Vai trò bảo vệ LI, không 1:1 với giáp Iron/Refined Iron | Giáp da cơ bản |
| `chitin_armor` | Chitin Plate | Vai trò giáp cao cấp LI, vật liệu riêng SOH | Phụ thuộc Chitin chưa có source |
| `fur_cloak` | Fur Cloak | LI có giáp/trang bị; đặc thù khí hậu và slot của SOH | Áo chống lạnh chiếm ô lưng |
| `gas_mask` | Filter Mask | LI có hazard POI, không có hàng Gas Mask 1:1 trong 139 | Mặt nạ chống khí độc/phơi nhiễm |
| `scrap_helm` | Scrap Helm | LI có Iron Plate Helmet; vai trò mũ bảo hộ tương tự, vật liệu khác | Mũ bảo hộ phế liệu rẻ |
| `blueprint` | Blueprint | LI có Blueprint/drawing mechanism; chưa có ID Blueprint tổng quát trong 139 | Bản vẽ học recipe trong run |
| `wolf_fang` | Wolf Fang (specimen) | LI có nghiên cứu hy sinh vật mẫu/đồ thật; đây là drop riêng SOH | Chưa có source ở Veyra |
| `crawler_optic` | Crawler Optic (specimen) | LI có Electronic Parts; không phải cùng đồ | Chưa có source ở Veyra |
| `boar_tusk` | Boar Tusk (specimen) | LI có nghiên cứu vật mẫu; đây là drop theo quái SOH | Vật mẫu học Iron Sword |
| `beetle_horn` | Beetle Horn (specimen) | LI có nghiên cứu vật mẫu; đây là drop theo quái SOH | Chưa có source ở Veyra |
| `keycard` | Vault Keycard | LI có Green/Blue/Purple Cards; SOH đang gộp cấp thẻ, không 1:1 | CHƯA CÓ CỬA KEYCARD Ở VEYRA |
| `vehicle_drive` | Motor Drive | LI dùng Gear/Plate/Vehicle Frame trực tiếp; SOH thêm Motor Drive trung gian | Cụm truyền động lắp xe máy |
| `cart_kit` | Hand Cart (packed) | LI có xe vận chuyển, nhưng không có Hand Cart cùng ID trong 139 | Xe kéo chở hàng chạy sức người |
| `lead_rope` | Taming Lead | LI chưa có item thuần hóa tương ứng trong 139 | Dây dắt và thuần hóa thú |
| `animal_feed` | Fodder Bundle | LI food/farming; đây là nhánh chăn nuôi SOH | Thức ăn cho gia súc/động vật nuôi |
| `feather` | Grouse Feather | LI ammo crafting, không có Grouse Feather trong 139 | Lông Grouse làm tên tốt hơn |
| `grouse_egg` | Grouse Egg | LI có Egg (event/source), không xác minh loài hay cùng cơ chế | Trứng từ chim nuôi, nguồn dinh dưỡng tái tạo |

## E. ID Elder cũ cần xử lý dữ liệu (6)

| SOH ID | Tên hiện có | Đối chiếu LI / Vai trò | Trạng thái/chú ý |
|---|---|---|---|
| `stone_frost` | Stone of Rime | Đá Elder của hệ cũ, không phải sáu đá Primordial | Taken from the Glacier Matron. |
| `stone_magma` | Stone of Cinder | Đá Elder của hệ cũ, không phải sáu đá Primordial | Taken from the Caldera Titan. |
| `stone_bog` | Stone of Mire | Đá Elder của hệ cũ, không phải sáu đá Primordial | Taken from the Mire Mother. |
| `stone_grove` | Stone of Roots | Đá Elder của hệ cũ, không phải sáu đá Primordial | Taken from the Elder Treant. |
| `stone_tide` | Stone of Tides | Đá Elder của hệ cũ, không phải sáu đá Primordial | Taken from the Tide Serpent. |
| `stone_rust` | Stone of Rust | Đá Elder của hệ cũ, không phải sáu đá Primordial | Taken from the Rust Colossus. |

## F. 24 ID công trình đóng gói theo runtime

`deploy_claim`, `deploy_bed_straw`, `deploy_chest_small`, `deploy_chest_large`, `deploy_campfire`, `deploy_furnace`, `deploy_oil_pump`, `deploy_refinery`, `deploy_workbench`, `deploy_research`, `deploy_garden`, `deploy_farm_controller`, `deploy_barrel`, `deploy_feed_trough`, `deploy_base_generator`, `deploy_power_cable`, `deploy_power_switch`, `deploy_pressure_switch`, `deploy_ir_sensor`, `deploy_arrow_turret`, `deploy_bear_trap`, `deploy_spikes`, `deploy_barricade`, `deploy_torch_post`

Đây là `DEPLOYABLE_TYPES` được tạo thành item có UID/trạng thái, không phải 24 món LI mới. Một số cùng chức năng LI (lò, bàn nghiên cứu, cabinet, máy phát, bẫy); số khác là lớp mô hình thế giới SOH (vườn, thùng mưa, vật tư đường dây, chăm vườn). Giá và các chức năng cần đối chiếu từng entity `STRUCTS`.

## Các lỗi suy diễn cần tránh

1. `bow` có ghi “only ranged weapon” trong V2 hiện tại, nhưng **đó là mô tả code**, không là điều khoản Bible chốt cấm mọi súng; không tự quyết định giữ/bỏ 32 gun-related LI ID.
2. `keycard` SOH gộp nhiều quyền, **không tương đương nguyên dạng** LI Green/Blue/Purple; Bible còn nêu Veyra chưa có cửa dùng keycard.
3. `scrap` đừng gọi là LI `parts`: Scrap nấu thành sắt, Parts là progression currency loot/recycling.
4. `machine_parts` có tên thật là `mechanical_parts`: bản V2 cho giữ, nhưng yêu cầu copy-first mới đặt câu hỏi cần loại/giữ vì khác LI; chưa có quyền xóa save.
5. `charcoal` và `animal_hide` *có xuất hiện* trong bộ 139 nhưng bằng chứng nguồn chưa đủ. Không thể nói chưa từng có ở LI.
6. Biome vật liệu Ash Chitin, Crawler Optic, Wolf Fang, Beetle Horn, dầu thô và keycard có thiếu đường nguồn/điều kiện hiện tại, không được gọi PLAYABLE chỉ vì catalog có tên.
7. 6 `stone_frost...stone_rust` là **legacy**, khác với `stone_surtur...stone_anubis` hiện hành.

## Trạng thái thực thi

Audit **chỉ đọc dữ liệu hiện hữu và phân loại**, không thêm/sửa item vào catalog, không điều chỉnh recipe, không merge; PR #62 vẫn Draft. Những từ “SOH riêng” phải đọc là **SOH-specific identity/implementation**, không phải một khẳng định không tồn tại trong mọi phiên bản Last Island.
