# Last Island → SOH — Atlas truy vết đa tầng / Vòng 1

**Dữ liệu đã truy được trong vòng này**: 19 công thức cụ thể, 10 họ nguồn loot, 10 địa điểm có thống kê nguồn, 3 cấu trúc phòng thẻ và 24 URL nguồn liên kết. Đây là tập dữ liệu truy vết được, **không phải toàn bộ item database của trò chơi**.

**Phương pháp:** một thành phẩm thiếu nguồn thành phần → truy tiếp công thức thành phần; thiếu nguyên liệu thô → truy nguồn quặng/thùng/hộp; thiếu điều kiện truy cập → truy chuỗi thẻ điện/POI; gặp biến thể khác nhau → ghi cả quy tắc thay đổi, không lấy một phiên bản làm cớ để bỏ phần hữu ích.

## I. Đồ thị công thức và khai triển nguyên liệu

| Thành phẩm | Công thức trực tiếp | Workbench | Nguyên liệu gốc nếu tự chế mọi thành phần | Nguồn |
|---|---|---|---|---|
| **Metal Blade** | 30 iron ingot + 15 parts | 2 | 30 iron ingot + 15 parts | [s_blade](https://www.9game.cn/daihaoyingxiong/3294352.html) |
| **Metal Pipe** | 5 refined iron ingot + 30 parts | 2 | 5 refined iron ingot + 30 parts | [s_pipe](https://www.aspxhome.com/youxi/2023/388245.htm) |
| **Torsion Spring** | 5 refined iron ingot + 65 parts | 2 | 5 refined iron ingot + 65 parts | [s_spring](https://www.9game.cn/news/3305575.html) |
| **Mechanical Gear** | 50 iron ingot + 65 parts | 2 | 50 iron ingot + 65 parts | [s_gear](https://www.9game.cn/daihaoyingxiong/3279007.html) |
| **Iron Plate** | 5 refined iron ingot + 30 parts | 2 | 5 refined iron ingot + 30 parts | [s_plate](https://www.9game.cn/news/3334146.html) |
| **Vehicle Frame** | 100 iron ingot + 30 refined iron ingot + 50 parts | 3 | 100 iron ingot + 30 refined iron ingot + 50 parts | [s_frame](https://shouyou.3dmgame.com/gl/135015.html) |
| **Iron Axe** | 75 iron ingot + 100 wood | 1 | 75 iron ingot + 100 wood | [s_ironaxe](https://www.aspxhome.com/youxi/2023/397622.htm) |
| **Refined Iron Axe** | 2 refined iron ingot + 5 metal blade + 1 metal pipe | 2 | 7 refined iron ingot + 150 iron ingot + 105 parts | [s_axe](https://www.9game.cn/daihaoyingxiong/4515476.html) |
| **Machete** | 100 iron ingot + 3 metal blade | 2 | 190 iron ingot + 45 parts | [s_machete](https://www.9game.cn/daihaoyingxiong/3298149.html) |
| **Semi-auto Rifle** | 450 iron ingot + 30 refined iron ingot + 2 torsion spring | 2 | 450 iron ingot + 40 refined iron ingot + 130 parts | [s_rifle](https://www.9game.cn/news/3425504.html) |
| **Rocket Launcher** | 50 refined iron ingot + 6 metal pipe + 5 torsion spring + 1 launcher mechanism | 3 | 105 refined iron ingot + 505 parts + 1 launcher mechanism | [s_rocket](https://www.aspxhome.com/youxi/2023/388245.htm) |
| **Electric Door** | 50 iron ingot + 5 electronic parts + 1 mechanical gear + 10 iron plate | 3 | 100 iron ingot + 5 electronic parts + 365 parts + 50 refined iron ingot | [s_door](https://www.9game.cn/news/3336352.html) |
| **Fuel Generator** | 20 refined iron ingot + 100 iron ingot + 30 electronic parts + 100 parts | 3 | 20 refined iron ingot + 100 iron ingot + 30 electronic parts + 100 parts | [s_door](https://www.9game.cn/news/3336352.html) |
| **Switch** | 10 iron ingot + 2 electronic parts + 10 parts | 3 | 10 iron ingot + 2 electronic parts + 10 parts | [s_door](https://www.9game.cn/news/3336352.html) |
| **Pressure Switch** | 50 iron ingot + 15 parts + 10 electronic parts + 2 iron plate | 3 | 50 iron ingot + 75 parts + 10 electronic parts + 10 refined iron ingot | [s_door](https://www.9game.cn/news/3336352.html) |
| **Infrared Switch** | 30 iron ingot + 10 electronic parts + 15 parts | 3 | 30 iron ingot + 10 electronic parts + 15 parts | [s_door](https://www.9game.cn/news/3336352.html) |
| **Motorcycle** | 200 refined iron ingot + 1 vehicle frame + 30 mechanical gear + 30 iron plate | 3 | 380 refined iron ingot + 1600 iron ingot + 2900 parts | [s_motor](https://www.9game.cn/news/3676549.html) |
| **Oil Refinery** | 500 iron ingot + 200 wood + 250 low quality fuel | 3 | 500 iron ingot + 200 wood + 750 animal fat + 250 cloth | [s_refinery](https://www.9game.cn/news/3448709.html) |
| **Low Quality Fuel** | 3 animal fat + 1 cloth | chưa xác định | 3 animal fat + 1 cloth | [s_fuel](https://www.9game.cn/news/3448709.html) |

**Khai triển không phải chi phí lúc nào cũng phải trả.** Một Gear/Plate/Pipe/Frame nhặt được loại bỏ nhánh sản xuất tương ứng. Đây là mối nối kinh tế bản chất mà SOH cần học. Tổng chưa tính nhiên liệu, giá xây trạm, chi phí học công thức, vận tải hoặc đạn.

### Ví dụ khép kín — Electric Door

- Cửa: 50 Iron + 5 Electronic + 1 Gear + 10 Plate. Gear: 50 Iron +65 Parts. 10 Plate: 50 Refined Iron +300 Parts. **Cửa đơn lẻ = 100 Iron +50 Refined Iron +365 Parts +5 Electronic** nếu tự chế hết.
- Thêm Generator và một Switch: **210 Iron +70 Refined Iron +475 Parts +37 Electronic**. Hệ điện chỉ vận hành nếu có nhiên liệu và kết nối điều khiển; không phải chỉ craft xong Door.

### Ví dụ khép kín — Motorcycle

- 200 Refined Iron +1 Frame +30 Gear +30 Plate. Frame: 100 Iron +30 Refined Iron +50 Parts. Gear: 50 Iron +65 Parts. Plate: 5 Refined Iron +30 Parts.
- Tổng giả định tự sản xuất = **1600 Iron +380 Refined Iron +2900 Parts**. Chính vì chi phí quá lớn, việc nhặt được Gear/Plate/Frame hoặc phương tiện hoàn chỉnh tạo ra bước ngoặt đáng giá. Đây là *bill of materials*, không phải balance đề xuất cho SOH.

### Ví dụ khép kín — Refined Iron Axe và Rocket Launcher

- Refined Axe: 2 Refined +5 Blade +1 Pipe → **150 Iron +7 Refined +105 Parts**; một nhánh phụ thuộc đồng thời luyện kim thường + tinh luyện + Parts.
- Rocket Launcher: 50 Refined +6 Pipe +5 Spring +1 Launcher Mechanism → **105 Refined +505 Parts +1 Launcher Mechanism**. Launcher Mechanism đến từ nguồn đồ hiếm, nên ngay cả khi có mỏ và Parts vẫn có lý do đi khám phá.

## II. Cấu trúc loot theo công dụng

| Nguồn | Lời hứa kinh tế | Phân bố | Trạng thái định lượng |
|---|---|---|---|
| Yellow/Blue Oil Barrel | Parts + assorted manufactured materials | Roadside scrap piles | Guarantee category described; not a per-item percentage |
| Red Oil Barrel | Crude Oil + low-grade fuel | Roadside scrap and concentrated oil base | Source differentiated by fuel economy |
| Toolbox | Higher tools, melee weapons; some equipment | Roads and POIs | May bypass tool crafting and enable specimen study |
| Supply Crate | Parts, industrial semifinished materials, selected equipment | Roads, POIs, gated interiors | Common source of plate/blade/pipe-type items |
| Food Crate | Finished food | Roads and POIs | Carries a dedicated survival promise |
| Military Crate | Weapon/equipment/industrial components | Hazardous POIs and gated zones | Higher-value technology sink/source |
| Advanced Military Crate | High-level weapons, specialty components | High-tier POIs and card rooms | Found Refined Iron Axe in item guide |
| Airdrop | Rare equipment, key mechanisms, high-tier parts | Special delivery in world | Launcher mechanism is a special drop; not all parts craftable |
| Medical Crate | Medical supplies by grade | Green/blue/purple rooms | Explicit official crate family |
| Harpoon Crate | Diving equipment and harpoon tools | Special underwater-oriented content | Explicit official content category; not an instruction to clone content |

**Thống kê khác với xác suất.** Thùng vàng/xanh được hướng dẫn là rơi Parts/vật liệu; không thể từ đó suy ra tỷ lệ Blade 12% hay Gear 3%. Bảng xác suất từng item cần dữ liệu bảng loot gốc hoặc mẫu quan sát có nhãn; không tự sáng tác.

## III. Nguồn theo POI

| POI | Số lượng container theo nguồn hướng dẫn | Gate/Key | Nguy hiểm |
|---|---|---|---|
| Supermarket | food_box ×1 | Green card ×1 | Infected ×1 |
| Gas Station | food_box ×1, red_barrel ×2–4 | Green card ×1 | Infected ×1 |
| Bunker | supply_box ×4, toolbox ×1, food_box ×1 | Blue room → Purple card ×1 | 1 Heavy +6 armored infected |
| Airport | supply_box ×9, military_box ×1, food_box ×1 | Green room→Blue; Blue room→Purple | 6 worker infected +1 sniper |
| Nuclear Plant | supply_box ×3–5, military_box ×1 | Blue room, electricity | Hunter + other infected |
| Harbor | supply_box ×9, toolbox ×1 | Green→Blue; Purple room | Hunter + infected + dogs |
| Radar Station | supply_box ×5, food_box ×1, toolbox ×1 | Blue room→Purple | Low hazard in cited guide |
| Warehouse | supply_box ×1, toolbox ×1 | Recycler access | Very low hazard |
| Oil Extraction Base | supply_box ×4, red_barrel ×many | Open fuel resource zone | Low hazard in cited guide |
| Biolab | Chưa có số nguyên vẹn | Green room and Purple room, high-value loot | EG mutant + infected |

### Cấu trúc card room trong cập nhật chính thức

- **Green**: Low Supply ×2, Low Toolbox ×1, Low Military ×1, Low Food ×1, Low Medical ×1.
- **Blue**: Medium Supply ×2, Low Toolbox ×1, Medium Military ×1, Medium Food ×1, Medium Medical ×1.
- **Purple**: High Supply ×2, High Toolbox ×1, High Military ×1, Medium Military ×1, High Food ×1, High Medical ×1.

Đây là điểm rất quan trọng: mỗi cấp cửa khác nhau **cả loại container lẫn phẩm cấp**. Như vậy công cụ đầu, vật liệu trung gian, vũ khí và đồ chữa trị có distribution gradient theo địa điểm, thay vì chỉ một loot table tăng số lượng.

## IV. Đối chiếu đúng cơ chế với SOH Web HEAD d73aa63f

| Trục LI | SOH đã có | Khoảng trống mechanics rõ ràng | Suy ra gameplay nào đang bị thu hẹp? |
|---|---|---|---|
| Đường phố: 3 loại oil barrel + Toolbox/Supply/Food | Roadside Scrap và Car Wreck; POI crate tĩnh | Không có hệ barrel đỏ–vàng/xanh riêng, nhiều class hộp phân biệt qua table | Người chơi khó quyết định loại nguồn trước khi chạy tuyến |
| Hợp kim & bán thành phẩm chung | Iron Ingot, Fasteners, Mechanical Parts, Spares, Cloth | Chưa có Refined Iron / Blade / Pipe / Plate / Gear / Spring / Electronics như một mạng tiêu thụ | Tìm được bán thành phẩm chưa bỏ qua nhiều công đoạn độc lập |
| Workbench level × recipe knowledge | 2 stationLevel, knowledge tier độc lập; 49 recipes | Thiếu hệ công nghệ xưởng cấp sâu tương đương 3 mức; không đồng nhất với tier | Đầu tư vào công nghệ trạm ít tạo các bước nhảy công nghiệp |
| Đồ loot cao cấp trực tiếp + sao chép thiết kế | Có Core gốc → học recipe, vài blueprint/gear trên POI | Nguồn đồ công nghiệp hoàn chỉnh nhiều lớp chưa phân tầng đầy đủ | Ít tình huống nhặt được một vật thay đổi quyết định lâu dài |
| Thẻ xanh→lam→tím với power/resistor | Keycard một loại, cửa keycard và power tại POI | Không có mạng ba cấp thẻ/room graded tương đương ở game loop Web | Ít địa điểm dẫn đến một nơi mới qua khám phá |
| Generator + switch + pressure + infrared + appliance | Base Generator → Arrow Turret; POI generator→door | Thiếu tầng điều khiển điện đa dụng và chi phí năng lượng để duy trì tự động | Ít khả năng tự thiết kế hành vi công trình |
| Refinery và red barrel tạo nhánh nhiên liệu | Fuel Can có recipe charcoal+sulfur+glass, Furnace/Generator | Chưa có Raw Crude → low-grade fuel → refining loop tương đương | Tuyến dầu không tồn tại như một loại chuyến loot chuyên môn |
| Motorcycle/Frame/Gear/Plate/road economy | Hand Cart và freight upgrade, tải trọng & roads | Chưa có chuỗi chế tạo phương tiện nhiều linh kiện/động lực | Bỏ qua tầng công nghiệp vận tải có thể thay đổi phạm vi hoạt động |
| Các hành vi PvE sinh tồn | Traces, weather, flames, hunger, fire, offline and buildings | SOH có hướng mở rộng riêng, không cần clone PvP | Cần để các trục kinh tế cùng đổ vào sinh tồn và hành trình |

## V. Quan sát thiết kế: các cạnh kinh tế phải nối nhau

Tối thiểu cần phân biệt **raw resource** (đến từ biome/nhà máy), **processed stock** (cần trạm+nhiên liệu), **salvage parts** (đến từ hộp/đồ phế), **rare-only modules** (rơi POI), **knowledge** (blueprint/study), **capability** (cấp trạm/điện/đường), **final item** (vũ khí, công cụ, xe, cửa, thiết bị) và **geographic access**. Khi thay một mảnh, đo các consumer, các nguồn thay thế, lối loot ngắn và lối tự sản xuất dài.

## VI. Các nhánh đã truy được và nhánh cần đo thêm

**Đã truy:** Gear/Plate/Blade/Pipe/Spring/Frame từ recipe, nguyên liệu gốc và nguồn vật liệu; Refined Axe/Machete/Rifle/Rocket/Motorcycle/Electric Door/Generator/Switch; source roles cho thùng đỏ/vàng/xanh, hộp và airdrop; số hộp và gate của 10 POI; cấp room green/blue/purple từ ghi chú chính thức.

**Chưa thể định lượng bằng số chính xác từ các nguồn này:** phần trăm rơi từng item theo từng thùng, yield quặng theo một lần khai thác trong mọi biome, bảng phân giải từng vật phẩm, lượng nhiên liệu vận hành trạm, bảng phân bố tất cả POI trên mọi map, hiệu suất công cụ trên từng material. Phương pháp tiếp là truy UI item guide/video gameplay/data resources tại từng thiếu hụt. Không cho phép nguồn không có số bị biến thành số tùy ý.

## VII. Danh mục nguồn liên kết

- [s_gear: Mechanical Gear 50 Iron Ingots + 65 Parts, mid Workbench](https://www.9game.cn/daihaoyingxiong/3279007.html)
- [s_plate: Iron Plate 5 Refined Iron + 30 Parts, mid Workbench](https://www.9game.cn/news/3334146.html)
- [s_blade: Blade 30 Iron + 15 Parts, mid Workbench](https://www.9game.cn/daihaoyingxiong/3294352.html)
- [s_spring: Torsion Spring 5 Refined Iron + 65 Parts, mid Workbench](https://www.9game.cn/news/3305575.html)
- [s_pipe: Rocket launcher raw recipe and Pipe material 5 Refined Iron + 30 Parts](https://www.aspxhome.com/youxi/2023/388245.htm)
- [s_door: Electric Door + generator + multiple control recipes](https://www.9game.cn/news/3336352.html)
- [s_frame: Vehicle Frame 100 Iron + 30 Refined Iron + 50 Parts](https://shouyou.3dmgame.com/gl/135015.html)
- [s_motor: Motorcycle 200 Refined Iron + Frame + 30 Gears + 30 Plates](https://www.9game.cn/news/3676549.html)
- [s_axe: Refined Iron Axe recipe, tool source, craft time and durability](https://www.9game.cn/daihaoyingxiong/4515476.html)
- [s_ironaxe: Iron Axe 75 Iron +100 Wood, basic Workbench](https://www.aspxhome.com/youxi/2023/397622.htm)
- [s_machete: Machete 100 Iron + 3 Blades, mid Workbench](https://www.9game.cn/daihaoyingxiong/3298149.html)
- [s_rifle: Semi-Auto Rifle 450 Iron +30 Refined Iron + 2 Springs](https://www.9game.cn/news/3425504.html)
- [s_rocket: Rocket Launcher 50 Refined +6 Pipes +5 Springs +Launcher mechanism](https://www.aspxhome.com/youxi/2023/388245.htm)
- [s_refinery: Oil Refinery crafting requirements and low-grade fuel inputs](https://www.9game.cn/news/3448709.html)
- [s_recycler: PvE recycler, refined iron, iron barrels and source traversal](https://news.4399.com/zhytgz/xinde/m/895633.html)
- [s_2019poi: POI crate counts and enemies, 2019-06](https://www.hackhome.com/info/483950.html)
- [s_poicensus: POI crate and keycard rooms by place](https://m.duote.com/tech/wmcq/135559.html)
- [s_cards: Developer-published 2019 location/keycard gate source](https://hero.yingxiong.com/info/2019/0807/7028.html)
- [s_loot: 2019 item categories for barrel/crate types](https://shouyou.3dmgame.com/gl/133819.html)
- [s_official2022: Official 2022 crate tiers and card-room composition](https://hero.yingxiong.com/info/2022/1109/13052.html)
- [s_2019community: 2019 community source families and green-blue-purple cards](https://www.taptap.cn/moment/15201304955586452)
- [s_2020pve: 2020 PvE beginner experience and recycler loop](https://news.4399.com/zhytgz/xinde/m/895633.html)
- [s_fuel: Crude oil refinery and low-quality fuel from fat+cloth](https://www.9game.cn/news/3448709.html)
- [s_2022future: Updates to crate tier segmentation](https://hero.yingxiong.com/info/2022/1109/13052.html)