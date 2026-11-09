# LAST ISLAND MECHANICAL ATLAS v4
## Chuyên khảo: Recycler đa đầu ra, ma trận rương, xác suất item cụ thể, công nghiệp năng lượng và các đồng hồ vận hành

**Nghiên cứu độc lập, 04/11/2026.** Kế thừa toàn bộ v3: **51 công thức có định mức**, **82 quan hệ loot** và **70 nguồn gốc**; v4 bổ sung **18 nguồn định danh**, **43 khẳng định cơ học có dẫn nguồn**, **35 cạnh nhân quả**, **3 dòng xác suất trực tiếp do nhà phát triển công bố** và **8 khoảng trống định lượng** có phương pháp đo cụ thể. Các nguồn bổ sung có thể trùng domain với nguồn v3 nhưng là bài/địa chỉ chuyên biệt khác. Không đối chiếu SOH.

### Chỉ dẫn quan trọng về tính xác thực

- **[A] Công bố nhà phát triển hoặc thông báo chính thức**: chắc chắn về *điều thông báo công bố*, không có nghĩa tất cả server hiện tại vẫn giữ thông số đó.
- **[B] Bài hướng dẫn/công trình quan sát của người chơi**: cơ chế thực tế ở phạm vi bài viết, không tự nâng thành quy tắc toàn trò chơi.
- **[C] Bài tổng hợp thứ cấp**: cần cross-check hơn, đặc biệt nếu không có ảnh số lượng thành phẩm.
- **[TÍNH]** số liệu suy ra bằng phép toán từ công thức hoặc mô hình xác suất; không được trình bày là số liệu game thả trực tiếp.
- **[CHƯA BIẾT]** để trống chính thức (null trong JSON): không đưa một tỷ lệ Recycler, công suất Furnace hay xác suất từng món vào atlas nếu chưa có nguồn định lượng.

## I. Thành tựu cốt lõi: Từ ba loại rương sang ma trận vai trò × cấp chất lượng × quyền truy cập

Nhà phát triển công bố 09/11/2022: Supply Crate bảo đảm nhóm thiết bị/vật liệu; Toolbox chứa các vật như resistor, melee, defense; Military Crate đảm bảo nhóm súng, bộ giáp/trang bị hoặc vật liệu đặc biệt; Food Crate bảo đảm thức ăn; Medical Crate bảo đảm vật tư sơ cứu; Harpoon Crate chứa đồ nghề lặn/harpoon. **Bảo đảm một nhóm không đồng nghĩa bảo đảm một item cụ thể.**

| Cửa thẻ | Supply | Toolbox | Military | Food | Medical | Tổng rương |
|---|---|---|---|---|---|---:|
| Green | 2 Low | 1 Low | 1 Low | 1 Low | 1 Low | 6 |
| Blue | 2 Mid | 1 Low | 1 Mid | 1 Mid | 1 Mid | 6 |
| Purple | 2 High | 1 High | **1 High + 1 Mid** | 1 High | 1 High | **7** |

**Điểm dễ sai:** Blue Room vẫn dùng **Low Toolbox**, không phải Mid Toolbox; Purple Room có **hai Military Crates khác cấp**. Nếu trộn hạng mục với cấp phòng sẽ tính sai cơ hội nhận được vật phẩm.

**Nguồn:** <https://hero.yingxiong.com/info/2022/1109/13052.html> (chính thức, nội dung 09/11/2022).

### I.1. Xác suất item cụ thể — số liệu hiếm hoi được công bố rõ

Thông báo chính thức 06/07/2023 ghi: **bản vẽ xe đạp xuất hiện trong Toolbox của phòng thẻ được tăng tỷ lệ từ 0,5% lên 4%; bản vẽ máy bay chạy bằng sức người tăng lên 2%.** Hai bản vẽ đó **không thể được học qua Drawing Bench**. Điều này biến địa điểm loot thành điều kiện tiếp cận công nghệ thực, không chỉ “đi loot sẽ nhanh hơn tự craft”.

| Blueprint | Tỷ lệ bản trước | Tỷ lệ bản sau | Số Toolbox kỳ vọng tới 1 lần rơi (mô hình) | 50 lượt chưa rơi là bao nhiêu? |
|---|---:|---:|---:|---:|
| Bicycle | 0,5% | 4,0% | 25 (bản sau) | (0,96)^50 ≈ 13,0% |
| Human-powered aircraft | Không nêu | 2,0% | 50 | (0,98)^50 ≈ 36,4% |

**[TÍNH]** Các số 25, 50 và phần trăm chưa rơi là mô hình thử Bernoulli độc lập cùng p. Đây không phải định mức guarantee, không phải xác nhận không có pity/cơ chế chia sẻ loot, và **chỉ đúng trong lớp Toolbox của phòng thẻ được thông báo**, không được lấy làm tỷ lệ mọi Toolbox ven đường.

**Nguồn:** <https://bbs.4399.cn/thread-view-tid-40162443> (thông báo chính thức 06/07/2023).

### I.2. Hai kiểu nguồn loot cấp cao không đồng nghĩa nhau

Trong thông báo 2022, Medical Crate làm rõ nhóm vật phẩm y tế, còn Harpoon Crate tách hẳn một nhóm công cụ lặn. Một điều kiện địa lý có thể tạo quyền tiếp cận **lớp công nghệ mới**, thay vì chỉ cho nhiều Parts hơn. Đây là tiền lệ cấu trúc quan trọng.

## II. Recycler: khai mở đầu ra kép, không thể giản lược thành “đổi món đồ lấy Parts”

**Nguồn mới 04/08/2022 (TapTap):** Metal Pipe có thể rơi từ Yellow/Blue Barrel, Supply, Military, Advanced Military và Airdrop; công thức của nó sử dụng Medium Workbench và thời gian chế tạo 3 giây. Quan trọng: **phân giải Metal Pipe có thể cho Parts và 精铁 (vật liệu refined iron)**. Văn bản không xác định refined iron là *quặng hay thỏi*, cũng không định lượng hai đầu ra. Vì thế `ATLAS_v4.json` giữ `refined_iron_unspecified` thay vì tự ép thành `refined_iron_ingot`.

**Nguồn:** <https://www.taptap.cn/moment/304314693734893241>.

Hướng dẫn PvE 2020 (4399) xác nhận Gear, Pipe, Blade nhặt được từ thùng có thể phân giải để thu Parts, và phân rã đồ cũng là đường đi tắt tiếp cận refined iron thay cho việc chỉ trông vào nguồn quặng hiếm.

**Nguồn:** <https://news.4399.com/zhytgz/xinde/m/895633.html>.

**Mạng kinh tế:**

```
Thùng vàng/xanh, Supply, Military, Airdrop
   ├─ Gear ───────────┐
   ├─ Blade ──────────┼── Recycler ──> Parts ──> Drawing/Research/Workbench/Trade
   └─ Metal Pipe ────┤
                     └──────────────> 精铁 (dạng sản phẩm CHƯA XÁC ĐỊNH)
```

Một món đồ có thể vừa là vật liệu chế tạo trực tiếp, vừa là kho tiền nghiên cứu, vừa là nguồn tài nguyên luyện kim. Do đó, bảng Recycler đúng phải có **mảng kết quả**, mỗi kết quả có `item_id`, `quantity`, `rule`, có thể phụ thuộc độ bền/tình trạng. Không được giả định tỉ lệ phần trăm chung cho tất cả item.

**Những gì vẫn mở:** chính xác một Metal Pipe ra bao nhiêu Parts và refined iron; Gear/Blade cho bao nhiêu; vật dụng hỏng có bị giảm giá trị tháo rã không. Atlas v4 cố ý giữ giá trị null.

## III. Xâu chuỗi “Refined Iron → Metal Pipe/Gear → Energy Extractor → Energy Ore → Refinery”

Một công nghiệp thực sự sâu không dừng lại ở cấp công cụ mạnh hơn. Hướng dẫn năm 2021 cho biết Energy Ore không thể khai thác bằng công cụ đào thông thường, cần Energy Extractor; ore đi vào Energy Refinery và tạo dạng năng lượng cấp cao. Có **hai loại công trình khác nhau**, tuyệt đối không được gộp:

- **Energy Extractor**: 30 Refined Iron Ingots + 5 Metal Pipes + 10 Electronic Parts + 10 Mechanical Gears.
- **Energy Refinery**: 200 Refined Iron Ingots + 500 Parts + 50 Electronic Parts. Có thêm điều kiện level 10, đã học blueprint và High Workbench để chế tạo.

Dùng các công thức riêng đã truy ở v2 (Pipe = 5 Refined Iron + 30 Parts; Gear = 50 Iron + 65 Parts), khai triển:

| Đầu tư | Iron Ingot | Refined Iron Ingot | Parts | Electronic Parts |
|---|---:|---:|---:|---:|
| Energy Extractor — tự chế Pipe/Gear | 500 | 55 | 800 | 10 |
| Energy Refinery | 0 | 200 | 500 | 50 |
| **Cả bộ thiết bị** | **500** | **255** | **1.300** | **60** |

**[TÍNH]** Đây chỉ là BOM công trình khi không loot Pipe/Gear; không bao gồm chi phí Workbench, blueprint, nhiên liệu, nhân vật level 10 hay các hao phí trên đường thu gom. Đây cũng không phải lượng ore cần khai thác vì tỷ lệ Furnace chưa được ghi định lượng.

**Nguồn:** <https://www.biubiu001.com/wpzzwmcq/38708.html> và các công thức Pipe/Gear liên kết trong v2/v3.

**Kết luận chuyên môn:** công nghệ mới không chỉ tăng tốc tác vụ cũ; nó tạo ra **quyền tiếp cận một loại node mà công cụ thường không tác động được**. Chừng nào không có máy, độ giàu của mỏ gần như vô nghĩa. Đây là một “khóa công nghệ–nguồn vật chất” rất mạnh.

## IV. Tầng thời gian: loot, thẻ, năng lượng và lịch hồi là những biến độc lập

Vòng này kiểm tra thêm một hướng dẫn Port ngày 24/08/2021:

| Hệ con tại Port | Chu kỳ người chơi ghi nhận | Điều kiện/ghi chú |
|---|---|---|
| Green Room: loot | khoảng 20 phút | Supply thường có, Military không chắc |
| Green Room: Blue Card | khoảng 60 phút | Không đồng bộ với loot |
| Blue Room: loot | khoảng 40 phút | Có Supply + Military |
| Blue Room: Purple Card | khoảng 60 phút | Người hướng dẫn ghi là có |
| Purple Room: loot | khoảng 60 phút | Chứa Military nâng cấp |

Người chơi hướng dẫn rằng nếu đã vào phòng và ở lại đợi loot hồi, có thể tiết kiệm số lần quẹt thẻ so với rời đi và vào lại; nhưng vẫn phải tính nguồn điện và nguy cơ bị khóa. Đây là hành vi chiến lược phát sinh từ nhiều đồng hồ của cùng POI, không phải “dungeon refresh một lần theo timer chung”.

**Nguồn:** <https://www.taptap.cn/moment/179173829145264747>.

Một bài mẹo năm 2019 còn báo cáo **quẹt thẻ khi chưa có điện cũng trừ durability**, cho thấy sai trình tự tương tác có chi phí vật lý. Bài đó cũng ghi công việc craft đã bắt đầu thì không buộc đứng sát Workbench và có thể chia ore thành nhiều stack để luyện song song. Đây là cơ chế micro quan trọng: người chơi có thể sắp lịch di chuyển hoặc sản xuất khác lúc máy làm việc.

**Nguồn:** <https://www.taptap.cn/moment/15218919606324324>.

## V. Khai thác, lò và phần thưởng công nghệ: bổ sung gỗ vào bảng công cụ

Tài liệu cây của cộng đồng 2022 ghi Stone/Iron/Refined Axe cần **6/5/4 cú** để khai thác một cây; gỗ là đầu vào của nhà, đồ lưu trữ, lò, thiết bị, hoặc nhiên liệu, và có thể đem đốt tạo Charcoal. Điều này tiếp tục xác nhận ba cấp công cụ cùng cơ chế giảm thao tác khai thác, nhưng chưa có tổng gỗ/node nên không được suy “mỗi cấp cho thêm x% sản lượng”.

**Nguồn:** <https://www.taptap.cn/moment/298912206311918558>.

Xâu chuỗi nhiên liệu:

`Tree → Wood → (Building / Furnace Fuel / Charcoal)`

`Sulfur Ore → Furnace → Sulfur Powder`

`Sulfur Powder + Charcoal → Gunpowder → Ammunition`

Nguồn 2023 cho một công thức 5.56mm ammunition dùng **10 Iron Ingots + 5 Gunpowder**, yêu cầu Medium Workbench và đã học recipe; **không ghi số viên đạn đầu ra**, nên chưa thể suy hao phí mỗi phát.

**Nguồn:** <https://www.taptap.cn/moment/183268152694539005>; <https://www.aspxhome.com/youxi/2023/392480.htm>.

Hệ này phức tạp hơn mô hình “mỏ sắt để ra công cụ” vì **wood cạnh tranh giữa nhiên liệu, xây nhà và chế biến**, trong khi sulfur/charcoal kéo một nhánh kinh tế quân sự khác. Tốc độ lò, số slot và tỷ lệ fuel/ingot là biến cần xác định trực tiếp từ UI, không thể bịa.

## VI. Phương tiện và y tế là ví dụ của “mechanics nối chéo không cần recipe mới”

**Xe đạp (công bố 2022):** một người, điều khiển đạp nhanh/chậm, dùng “không khí phổi” làm năng lượng; tốc độ đạp tăng làm tiêu nhanh hơn; thả đạp hồi không khí; cạn không khí rồi tiếp tục sẽ mất HP. Xe có thể thu hồi lại vào inventory và không được đặt trong vùng phóng xạ.

**Máy bay sức người (2023):** lên cao tiêu stamina, bay lượn hồi stamina. Hai phương tiện đều đưa một chỉ số sinh tồn vào bài toán quãng đường, không dựa hoàn toàn vào nhiên liệu.

**Defibrillator tự cứu (công bố 2022):** 10 giây sử dụng lúc downed; trong khi dùng ngừng mất máu; bị tấn công không gián đoạn; Port boss được ghi rơi 4, Avenger rơi 2. Đây là mối nối trực tiếp giữa nguồn Boss, đồ y tế, thời gian thực hiện action và rủi ro sống sót.

**Nguồn:** <https://hero.yingxiong.com/info/2022/1109/13052.html>; <https://bbs.4399.cn/thread-view-tid-40162443>.

## VII. Những chỗ có thể định lượng ngay, những chỗ buộc đo

| Thông số | Trạng thái hiện tại | Chú ý |
|---|---|---|
| Xác suất Bicycle Blueprint | **4%** (sau cập nhật; trước 0,5%) | Chỉ Toolbox phòng thẻ theo thông báo 2023 |
| Xác suất Human-powered Plane Blueprint | **2%** | Toolbox phòng thẻ; không thể Drawing |
| Số rương Green/Blue/Purple | **6/6/7** | Cơ cấu từng họ rương ở thông báo 2022 |
| Số cú đánh cây theo ba rìu | **6/5/4** | Dữ liệu người chơi 2022 |
| Metal Pipe công thức thời gian | **3 giây** | Medium Workbench theo guide 2022 |
| Metal Pipe → Parts/refined iron | **có hai loại output** | Chưa biết đơn vị và số lượng refined iron |
| Metal Pipe → đúng số Parts | **CHƯA BIẾT** | Không có bảng output đáng tin trong những nguồn đã truy |
| 1 Ore → bao nhiêu Ingot / tiêu hao nhiên liệu | **CHƯA BIẾT** | Cần screenshot lò trước/sau |
| 1 Crude → bao nhiêu Low-quality Fuel | **CHƯA BIẾT** | Cần screenshot Refinery trước/sau |
| Card-door power consumption per scan | **CHƯA BIẾT** | Biết có tiêu nguồn và lỗi quẹt khi chưa có điện vẫn mất độ bền |

### Những chỉ số có thể tự khai triển nhưng không nên giả làm xác suất game

Với tỷ lệ item p, mô hình IID cho xác suất có ít nhất một item sau n lần mở là `1−(1−p)^n`; số lần kỳ vọng đến lần đầu là `1/p`. Atlas HTML có bộ tính động với chú thích *mô hình thống kê, không phải game drop guarantee*.

Với Recycler đa đầu ra, giá trị kỳ vọng của một item `V = q_parts×u_parts + q_refined×u_refined + ... − access_cost`, nhưng `q_parts`, `q_refined` vẫn NULL, nên chỉ xây mô hình ký hiệu, không phán giá trị tối ưu.

## VIII. Kết luận: Những cơ chế quyết định chiều sâu nền

1. **Nguồn loot có bản sắc kinh tế rõ:** mỗi class rương cung cấp một họ vật liệu; tier tăng độ hiếm; các trường hợp như Toolbox phòng thẻ còn có item độc quyền với xác suất định lượng.
2. **Recycler là một bộ chuyển đổi đa sản phẩm:** linh kiện có thể bị phân rã thành Parts và refined metal, không chỉ dùng như tiền. Mỗi loại input có thể có tradeoff riêng.
3. **Công nghệ có thể khóa quyền khai thác:** energy ore đòi bộ extractor và refinery, không thể chỉ nâng cấp rìu thường là đủ.
4. **Thời gian không phải một biến đơn nhất:** mỗi POI có các chu kỳ loot/card/power khác nhau; trạm có khả năng xử lý khi người chơi không đứng cạnh.
5. **Điều kiện môi trường làm thay đổi công dụng vật phẩm:** xe đạp/phi cơ dùng sức người và chịu điều kiện sinh tồn; cứu hộ y tế có thời gian hành động và nguồn rơi cụ thể.

Trong giới hạn tìm kiếm vòng này, **không có bảng công khai đầy đủ đáng tin về từng món → từng đầu ra Recycler / Furnace**. Trạng thái đúng của chúng là biến chưa đo, không phải 0 hay 50%. Phần còn lại của mạng công thức và khả năng truy nguồn được kế thừa từ Atlas v3, không nhân bản thành số liệu mới để tăng thành tích nghiên cứu.

### Tài liệu nguồn mới chính

- **v4_official_chest_2022:** Developer 2022-11-09: crate category guarantees, tier/type distributions in green/blue/purple rooms; bicycle mechanics, defibrillator. https://hero.yingxiong.com/info/2022/1109/13052.html
- **v4_official_transport_2023:** Official announcement 2023-07-06: 0.5%→4% bicycle blueprint; 2% human-powered aircraft blueprint; both in card-room toolboxes and cannot be learned by drawing. https://bbs.4399.cn/thread-view-tid-40162443
- **v4_metal_pipe_2022:** Community item glossary 2022-08-04: Metal Pipe from yellow/blue barrels, supply/military/advanced military/airdrop; dismantle into Parts AND Refined Iron; medium bench 3s. https://www.taptap.cn/moment/304314693734893241
- **v4_2019_mechanics_tips:** Community post 2019-05-25: unpowered card scan still consumes durability; parallel furnace stacks; craft continues away from station; support and biome relationships. https://www.taptap.cn/moment/15218919606324324
- **v4_port_2021:** Community port route 2021-08-24: two card rooms, supply vs card refresh separate, hazards and power/fuse management. https://www.taptap.cn/moment/179173829145264747
- **v4_2020_pve_route:** First-person PvE 001 guide 2020-06-03: select home by road+supermarket+recycler+barrels; original weapon study, recycler shortcuts. https://news.4399.com/zhytgz/xinde/m/895633.html
- **v4_wood_harvest_2022:** Community resource glossary 2022-07-21: wood trees 6/5/4 axe hits; wood uses wood/charcoal/fuel. https://www.taptap.cn/moment/298912206311918558
- **v4_2021_energy:** 2021-08-09 energy refinery 200 refined iron+500 Parts+50 electronics; extractor 30 refined+5 pipe+10 electronics+10 gears. https://www.biubiu001.com/wpzzwmcq/38708.html
- **v4_2021_base_clock:** 2021-10-21 Action Base: 4h road, 12h POI, 8h mine, 15–30m local natural, 24h large enemies; base outbound cargo class caps. https://www.taptap.cn/moment/200202902059354018
- **v4_2019_card_path:** 2019-08-07 radiation key tier and locations; 3 charges; generator and resistance requirement. https://shouyou.3dmgame.com/gl/144071.html
- **v4_2021_ore:** 2021-09-04 ore→furnace (wood)→ingot, sulfur powder, charcoal→gunpowder. https://www.taptap.cn/moment/183268152694539005
