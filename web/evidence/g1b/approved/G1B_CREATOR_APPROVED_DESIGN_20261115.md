# SOH — G1B: HỢP ĐỒNG RƯƠNG ĐẦY ĐỦ ĐỂ CREATOR DUYỆT

> **TRẠNG THÁI: CREATOR ĐÃ PHÊ DUYỆT TOÀN BỘ THIẾT KẾ NGÀY 2026-11-15.** Thông số trong tài liệu có hiệu lực để Agent triển khai; chưa đồng nghĩa rương đã xuất hiện tại đúng ô, đã vượt QA hình học hay đã được người chơi nghiệm thu.
> Cơ sở gốc: `SOH_RUONG_NPC_WORLD_SITUATIONS_HANDOFF_2026-11-15.md` 788 dòng, đặc biệt §§0,2,4–7,10,12,14–16; Item Crafting Master Rev6 đúng HEAD PR #61; Veyra GOLD 81 POI; các quyết định bổ sung ở cuộc chat (rương hồi không giới hạn, Core chung độ bền, cooldown riêng, tự trừ đạn).
> Đầu ra gồm tài liệu này, JSON machine-readable, CSV của toàn bộ xác suất dương và CSV phân bố/nguồn Core. Các bảng đều mang nhãn PROPOSAL.

## A. Phạm vi thiết kế và phân biệt quyền nguồn

- Đúng **5 họ / 16 biến thể** rương thường: Supply 4; Toolbox 3 (**không có Toolbox Mid**); Military 3; Food 3; Medical 3. Harpoon không có sprite/role xác nhận nên **giữ OPEN ngoài 16**; Airdrop riêng; Ragnarok Cash/escrow/player storage không dùng loot table này.
- **7 Creator Core** là item ID hiện hữu nhưng cần sửa quyền từ `CRAFT_ONLY` → `BOTH` bằng Item Master revision có migration và source whitelist; loot Core level được lưu trên INSTANCE, không thêm item ID. **4 Field Core** không có level, không trộn vào 16 rương ngẫu nhiên; nguồn authored Shipping cũ được bảo toàn.
- **50 item ID** trong bảng có xác suất rơi >0; còn **107/157 item** không có quyền/không phù hợp trong hệ 16 rương này (vẫn có thể xuất hiện ở world, craft, unique, NPC inventory thật hoặc nguồn đặc biệt hợp lệ). **219 cặp (chest, item) có xác suất dương** được xuất ở CSV — không in các ô 0%.
- Không có súng LI mới, không có 16 menu riêng, không tự drop `CRAFT_ONLY` nấu ăn, Essence, công trình, Field, item Ragnarok. `spares` là Parts.

## B. Luật lấy loot 100% xác định (không để Agent tự đoán)

Một **chu kỳ hợp lệ** của mỗi rương: (1) luôn rút **1 anchor stack** từ bảng trọng số của biến thể; (2) rút đúng N lần từ pool vật tư, các lần **có hoàn lại**, kết quả trùng ID được gộp; (3) một lượt bonus công cụ/đồ giá trị với xác suất ghi ở bảng; (4) **một** phép rút kết quả Core loại trừ lẫn nhau (hoặc không có Core). Không bao giờ có 2 Core từ nhiều lượt trúng độc lập ở cùng chu kỳ. Số lượng trong mỗi lượt rút lấy ngẫu nhiên nguyên từ `min…max` bao gồm hai đầu.

Gọi `A_i` là trọng số item / tổng anchor, `R_i` trọng số / tổng regular, `B_i` trọng số / tổng bonus, `n` lần rút thường, `b` xác suất xuất hiện bonus. Với item thường, xác suất nhìn thấy ít nhất một: `P_i=1−(1−A_i)(1−R_i)^n(1−b·B_i)`. Với Creator Core, `P(type,level) = P(outcome tier-level) × weight(type)/sumWeights(tier)`. **Các Core outcome phải cộng, không nhân như những lần roll độc lập.** Trong CSV, `at_least_one_pct` là tỷ lệ ít nhất một item theo công thức này; `expected_units_per_open` là lượng kỳ vọng đã tính cả số lần rút và qty.

Mỗi kết quả Core là một UID vật lý với `coreLevel` và độ bền tối đa 100/100 (tham số đề xuất); không chứa đạn miễn phí. Công cụ hoàn chỉnh từ bonus rơi trực tiếp để dùng được, không chỉ vật liệu. Các result từ một loại có thể chiếm tối đa 1+N+1+1 slot trước gộp; HUD inventory vẫn phải xử lý vượt stack cap chứ không cắt mất vật phẩm.

## C. Danh mục 16 biến thể: số slot, xác suất Core, timer, số nguồn

| Rương | 1 anchor + N thường | Bonus (một món) | Core / chu kỳ | Max slot trước gộp | Hồi mặc định | Nguồn cơ bản |
|---|---:|---:|---:|---:|---:|---:|
| `supply_damaged` | 1+1 | 10% | 3% | 4 | 12h | 4 |
| `supply_low` | 1+2 | 16% | 4% | 5 | 24h | 20 |
| `supply_mid` | 1+3 | 25% | 6% | 6 | 36h | 20 |
| `supply_high` | 1+4 | 35% | 8% | 7 | 48h | 2 |
| `toolbox_damaged` | 1+1 | 15% | 3.5% | 4 | 12h | 5 |
| `toolbox_low` | 1+2 | 30% | 5% | 5 | 24h | 13 |
| `toolbox_high` | 1+4 | 65% | 13% | 7 | 48h | 6 |
| `military_low` | 1+2 | 50% | 26% | 5 | 24h | 8 |
| `military_mid` | 1+3 | 65% | 44% | 6 | 48h | 4 |
| `military_high` | 1+4 | 80% | 53.5% | 7 | 72h | 2 |
| `food_low` | 1+2 | 10% | 0% | 5 | 24h | 8 |
| `food_mid` | 1+3 | 20% | 0% | 6 | 36h | 4 |
| `food_high` | 1+4 | 35% | 0% | 7 | 48h | 1 |
| `medical_low` | 1+2 | 15% | 0% | 5 | 24h | 9 |
| `medical_mid` | 1+3 | 30% | 0% | 6 | 36h | 3 |
| `medical_high` | 1+4 | 55% | 0% | 7 | 48h | 2 |

Dấu **timer là SOH_PROVISIONAL** và chỉ là mốc mặc định theo grade, không được gọi canon. Điểm đặt bảo mật ở §G dùng override 48h Mid /72h High và có *giá thành di chuyển/rủi ro*, không chỉ timer. Rương đặt cạnh đường Damaged 12h/Low 24h; Mid/High không đặt vô tội vạ ven đường.

## D. Trọng số và số lượng CHI TIẾT: từng item ở từng biến thể

Cú pháp: `item_id (trọng số w, số lượng min–max)`. Trọng số chỉ có ý nghĩa **bên trong pool tương ứng**. CSV kèm theo chứa xác suất xuất hiện cuối cùng **đã tính cả anchor/regular/bonus**, không cần người đọc tự đổi weight thành %.

### `supply_damaged`

- **Anchor chắc chắn 1 stack:** wood (4w, 2–5); spares (4w, 1–2); iron_ore (2w, 1–3).
- **1 lần rút thường:** wood (5w, 2–5); fiber (4w, 2–5); stone (4w, 2–5); spares (3w, 1–2); cloth (1w, 1–1).
- **Bonus 10%:** iron_axe (2w, 1–1); iron_pick (2w, 1–1); cleaver (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 3%.

### `supply_low`

- **Anchor chắc chắn 1 stack:** wood (3w, 2–5); spares (5w, 2–4); iron_ore (2w, 2–4).
- **2 lần rút thường:** wood (3w, 2–5); fiber (2w, 2–5); spares (4w, 2–4); iron_ore (3w, 1–3); iron_ingot (2w, 1–2); cloth (2w, 1–2); tin_can (1w, 1–1).
- **Bonus 16%:** iron_axe (2w, 1–1); iron_pick (2w, 1–1); cleaver (1w, 1–1); leather_armor (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 4%.

### `supply_mid`

- **Anchor chắc chắn 1 stack:** spares (5w, 3–5); iron_ingot (3w, 1–3); cloth (2w, 1–2).
- **3 lần rút thường:** spares (4w, 2–5); iron_ingot (3w, 1–3); cloth (2w, 1–3); refined_iron_ingot (1w, 1–1); mechanical_gear (2w, 1–1); metal_pipe (2w, 1–2); iron_plate (2w, 1–2); glass (1w, 1–1); electric_resistor (2w, 1–2); electronic_parts (1w, 1–1); fuel_can (1w, 1–1).
- **Bonus 25%:** iron_axe (2w, 1–1); iron_pick (2w, 1–1); cleaver (2w, 1–1); leather_armor (1w, 1–1); water_flask (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 5%, CL2 0.5%, ML1 0.5%.

### `supply_high`

- **Anchor chắc chắn 1 stack:** spares (5w, 4–7); iron_ingot (2w, 2–4); refined_iron_ingot (2w, 1–2).
- **4 lần rút thường:** spares (4w, 3–6); refined_iron_ingot (2w, 1–2); mechanical_gear (3w, 1–2); metal_pipe (2w, 1–2); iron_plate (2w, 1–2); glass (2w, 1–2); electronic_parts (3w, 1–2); electric_resistor (3w, 1–3); crystal (1w, 1–1); fuel_can (2w, 1–1).
- **Bonus 35%:** machete (2w, 1–1); iron_axe (2w, 1–1); iron_pick (1w, 1–1); gas_mask (1w, 1–1); leather_armor (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 6%, CL2 1%, ML1 1%.

### `toolbox_damaged`

- **Anchor chắc chắn 1 stack:** spares (5w, 1–2); iron_ingot (3w, 1–1); metal_blade (2w, 1–1).
- **1 lần rút thường:** spares (4w, 1–3); iron_ingot (3w, 1–2); metal_blade (2w, 1–1); cloth (1w, 1–1); electric_resistor (1w, 1–1).
- **Bonus 15%:** cleaver (3w, 1–1); iron_axe (2w, 1–1); iron_pick (2w, 1–1).
- **Core outcome tuyệt đối:** CL1 3.5%.

### `toolbox_low`

- **Anchor chắc chắn 1 stack:** spares (5w, 2–4); iron_ingot (3w, 1–2); metal_blade (2w, 1–1).
- **2 lần rút thường:** spares (4w, 2–4); iron_ingot (3w, 1–3); metal_blade (3w, 1–1); mechanical_gear (1w, 1–1); electronic_parts (1w, 1–1); electric_resistor (2w, 1–2); metal_pipe (1w, 1–1); iron_plate (1w, 1–1).
- **Bonus 30%:** cleaver (3w, 1–1); iron_axe (3w, 1–1); iron_pick (3w, 1–1); machete (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 5%.

### `toolbox_high`

- **Anchor chắc chắn 1 stack:** spares (4w, 3–6); mechanical_gear (3w, 1–2); refined_iron_ingot (3w, 1–2).
- **4 lần rút thường:** spares (3w, 3–6); mechanical_gear (4w, 1–2); metal_blade (3w, 1–2); electronic_parts (3w, 1–2); electric_resistor (2w, 2–3); metal_pipe (2w, 1–2); iron_plate (2w, 1–2); refined_iron_ingot (2w, 1–2); glass (1w, 1–1).
- **Bonus 65%:** machete (4w, 1–1); cleaver (2w, 1–1); iron_axe (2w, 1–1); iron_pick (2w, 1–1); gas_mask (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 9%, CL2 2%, ML1 2%.

### `military_low`

- **Anchor chắc chắn 1 stack:** energy_basic (5w, 3–7); arrow (4w, 3–7); spares (2w, 1–3).
- **2 lần rút thường:** energy_basic (5w, 3–6); arrow (4w, 3–8); spares (2w, 1–3); iron_ingot (2w, 1–2); cloth (2w, 1–1); bandage (2w, 1–2); metal_blade (1w, 1–1).
- **Bonus 50%:** cleaver (3w, 1–1); iron_axe (2w, 1–1); iron_pick (2w, 1–1); leather_armor (2w, 1–1); medkit (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 21%, ML1 5%.

### `military_mid`

- **Anchor chắc chắn 1 stack:** energy_basic (4w, 5–8); energy_refined (3w, 1–2); arrow (3w, 4–8).
- **3 lần rút thường:** energy_basic (4w, 4–8); energy_refined (4w, 1–3); arrow (3w, 4–8); bandage (2w, 1–2); medkit (2w, 1–1); mechanical_gear (2w, 1–1); metal_blade (2w, 1–1); iron_plate (2w, 1–1); electronic_parts (2w, 1–1); spares (2w, 2–4).
- **Bonus 65%:** machete (4w, 1–1); cleaver (2w, 1–1); leather_armor (2w, 1–1); gas_mask (1w, 1–1); medkit (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 4%, ML1 35%, ML2 3%, RL1 2%.

### `military_high`

- **Anchor chắc chắn 1 stack:** energy_refined (5w, 2–4); energy_basic (3w, 6–10); arrow (2w, 7–12).
- **4 lần rút thường:** energy_refined (5w, 1–4); energy_basic (2w, 6–10); mechanical_gear (3w, 1–2); metal_blade (2w, 1–2); iron_plate (3w, 1–2); electronic_parts (3w, 1–2); spares (2w, 2–5); bandage (1w, 1–3); medkit (2w, 1–1).
- **Bonus 80%:** machete (5w, 1–1); gas_mask (2w, 1–1); leather_armor (2w, 1–1); cleaver (1w, 1–1).
- **Core outcome tuyệt đối:** CL1 3%, ML1 25%, ML2 13%, RL1 10%, RL2 2%, RL3 0.5%.

### `food_low`

- **Anchor chắc chắn 1 stack:** berries (5w, 2–5); meat (2w, 1–2); mushroom (3w, 2–4).
- **2 lần rút thường:** berries (5w, 2–5); mushroom (4w, 2–4); meat (2w, 1–3); crop (2w, 2–4); tin_can (2w, 1–1); grouse_egg (1w, 1–2).
- **Bonus 10%:** canned_meat (2w, 1–1); water_flask (1w, 1–1).
- **Core outcome tuyệt đối:** Không có Creator Core.

### `food_mid`

- **Anchor chắc chắn 1 stack:** berries (3w, 3–6); meat (2w, 2–3); canned_meat (2w, 1–1); mushroom (3w, 3–5).
- **3 lần rút thường:** berries (4w, 3–6); mushroom (3w, 3–5); meat (3w, 1–3); crop (3w, 2–4); canned_meat (2w, 1–2); tin_can (2w, 1–2); grouse_egg (2w, 1–3); seed_bitterleaf (1w, 1–2).
- **Bonus 20%:** canned_meat (3w, 1–1); water_flask (2w, 1–1).
- **Core outcome tuyệt đối:** Không có Creator Core.

### `food_high`

- **Anchor chắc chắn 1 stack:** canned_meat (2w, 1–2); meat (2w, 2–4); crop (3w, 3–6); mushroom (3w, 3–6); berries (2w, 4–8).
- **4 lần rút thường:** berries (3w, 4–8); meat (3w, 2–5); crop (4w, 3–6); canned_meat (2w, 1–2); tin_can (2w, 1–2); mushroom (3w, 4–7); grouse_egg (2w, 2–4); seed_bitterleaf (1w, 1–2); seed_wildberry (1w, 1–2).
- **Bonus 35%:** canned_meat (3w, 1–1); water_flask (2w, 1–1).
- **Core outcome tuyệt đối:** Không có Creator Core.

### `medical_low`

- **Anchor chắc chắn 1 stack:** bandage (5w, 1–3); herb (4w, 2–4); needle_tube (1w, 1–1).
- **2 lần rút thường:** bandage (5w, 1–3); herb (4w, 2–5); needle_tube (2w, 1–1); cloth (2w, 1–2); gland (1w, 1–1).
- **Bonus 15%:** medkit (3w, 1–1); water_flask (1w, 1–1).
- **Core outcome tuyệt đối:** Không có Creator Core.

### `medical_mid`

- **Anchor chắc chắn 1 stack:** bandage (4w, 2–4); medkit (2w, 1–1); herb (3w, 2–5); needle_tube (1w, 1–1).
- **3 lần rút thường:** bandage (4w, 2–4); herb (3w, 2–5); needle_tube (3w, 1–2); cloth (2w, 1–2); medkit (2w, 1–1); antirad (1w, 1–1); syringe (1w, 1–1).
- **Bonus 30%:** medkit (4w, 1–1); syringe (2w, 1–1); gas_mask (1w, 1–1).
- **Core outcome tuyệt đối:** Không có Creator Core.

### `medical_high`

- **Anchor chắc chắn 1 stack:** medkit (3w, 1–2); bandage (3w, 3–5); syringe (2w, 1–1); herb (2w, 3–6).
- **4 lần rút thường:** bandage (3w, 2–5); medkit (3w, 1–2); syringe (2w, 1–1); antirad (2w, 1–2); needle_tube (3w, 1–2); cloth (2w, 1–2); herb (2w, 3–6); gland (1w, 1–1).
- **Bonus 55%:** medkit (4w, 1–1); syringe (3w, 1–1); gas_mask (2w, 1–1).
- **Core outcome tuyệt đối:** Không có Creator Core.

## E. Core: phân phối cấp/loại không chồng roll

- C = Big Bang (`core_blast`) và Earth Mother (`core_earthmother`); M = Meteor (`core_meteor`), Elsa (`core_elsa`), Mjolnir (`core_mjolnir`); R = Dragon (`core_dragon`) và Demon (`core_demon`). **Tier != Level.**
- Các tỷ lệ trong bảng là **xác suất tuyệt đối trên một lần hồi rương**, không phải xác suất sau khi đã trúng Core. Không có pity, không có cap, không giảm xác suất lần sau. Mỗi lần refill đúng một lần roll và toàn bộ RNG được gắn run+sourceId+cycle.

| Rương | Kết quả Core loại trừ lẫn nhau | Không ra Core |
|---|---|---:|
| supply_damaged | CL1 3% | 97% |
| supply_low | CL1 4% | 96% |
| supply_mid | CL1 5%, CL2 0.5%, ML1 0.5% | 94% |
| supply_high | CL1 6%, CL2 1%, ML1 1% | 92% |
| toolbox_damaged | CL1 3.5% | 96.5% |
| toolbox_low | CL1 5% | 95% |
| toolbox_high | CL1 9%, CL2 2%, ML1 2% | 87% |
| military_low | CL1 21%, ML1 5% | 74% |
| military_mid | CL1 4%, ML1 35%, ML2 3%, RL1 2% | 56% |
| military_high | CL1 3%, ML1 25%, ML2 13%, RL1 10%, RL2 2%, RL3 0.5% | 46.5% |

- Mặc định các Core **trong cùng tier** chia đều. Với POI theo chủ đề, có **proposal** tăng trọng số x2 cho đúng Core đó *trong tier*, rồi chuẩn hóa lại (giữ **nguyên tổng xác suất Core của biến thể**): `po_academy`,`po_observatory`→Meteor; `po_wreck`→Elsa; `po_falls`→Mjolnir; `po_slag`→Dragon; `po_archive`→Demon. Bảng CSV `SOURCE_CORE_ODDS` ghi lại tất cả xác suất per-source sau bước này; những POI khác/đường giữ phân bố đều.
- Ví dụ `Military High`: 25% M Lv1, 13% M Lv2, 10% R Lv1, 2% R Lv2, 0,5% R Lv3, 3% C Lv1 = **53,5% có đúng một Core**, 46,5% không có; mỗi Meteor/Elsa/Mjolnir ở nguồn không thiên chủ đề có **12,6667%** gộp Lv1+Lv2; mỗi Dragon/Demon có **6,25%** gộp Lv1–3. Bộ item thường và bonus vẫn ra độc lập.

## F. 14 nâng cấp Core + chi phí sửa + đạn: tính gộp với rương

14 entries dưới đây là **UPGRADE ACTIONS**, không tạo 14 item ID và không tự gắn là 14 recipe mới trong 114 recipe Rev6. Mỗi action tiêu nguyên liệu + giữ đúng UID/độ bền, dùng Workbench Lv2 hoặc Lv3, không đòi học recipe mới để nâng món đang sở hữu. `craft Core mới` vẫn theo 7 recipe Rev6 và tạo Lv1.

| Core | Lv1→Lv2 (WB2, 45s) | Lv2→Lv3 (WB3, 75s) |
|---|---|---|
| `core_blast` | spares×5, iron_ingot×3, crystal×2, sulfur×2 | spares×10, refined_iron_ingot×3, crystal×4, sulfur×4 |
| `core_earthmother` | spares×5, iron_ingot×3, crystal×2, herb×3, seed_bitterleaf×2 | spares×10, refined_iron_ingot×3, crystal×4, herb×5, seed_bitterleaf×4 |
| `core_meteor` | spares×7, iron_ingot×4, crystal×3, sulfur×3 | spares×12, refined_iron_ingot×4, crystal×5, sulfur×5, mechanical_gear×1 |
| `core_elsa` | spares×7, iron_ingot×3, crystal×3, shell×3 | spares×12, refined_iron_ingot×3, crystal×5, shell×5, glass×2 |
| `core_mjolnir` | spares×7, iron_ingot×4, crystal×3, electronic_parts×2 | spares×13, refined_iron_ingot×4, crystal×5, electronic_parts×4, mechanical_gear×2 |
| `core_dragon` | spares×11, refined_iron_ingot×3, crystal×4, sulfur×5 | spares×17, refined_iron_ingot×6, crystal×7, sulfur×8, mechanical_gear×2 |
| `core_demon` | spares×9, iron_ingot×4, crystal×4, crawler_optic×2 | spares×16, refined_iron_ingot×5, crystal×6, crawler_optic×3, glass×2 |

Sửa Core: max durability **100** (đề xuất); mỗi lần bảo trì phục hồi **25** điểm tại Workbench, không phá UID; nhóm thường: Parts×1+Iron Ingot×1; trung: Parts×2+Iron Ingot×1; hiếm: Parts×2+Refined Iron Ingot×1. Core không tự biến mất khi durability=0, chỉ tạm không dùng được; sửa đúng vật phẩm. **Nâng cấp không miễn phí sửa chữa.**

Nhiên liệu vẫn dùng Basic/Refined và 4 loại Essence hiện có: LMB=1 `energy_basic`; Q=1 `energy_refined`; E=1 `energy_refined` +1 Essence đúng hệ. Đạn trừ **thẳng inventory đúng lúc cast được chấp nhận**. Không có R, không kho 40/12/4, không tạo item mới, không đổi VFX Gold.

| Core | LMB cooldown/wear | Q cooldown/wear | E cooldown/wear | E Essence |
|---|---:|---:|---:|---|
| `core_blast` | 0.7s / 1 dur | 10s / 4 dur | 50s / 12 dur | `essence_fire` |
| `core_earthmother` | 0.9s / 1 dur | 18s / 5 dur | 55s / 12 dur | `essence_nature` |
| `core_meteor` | 0.9s / 1 dur | 14s / 5 dur | 60s / 14 dur | `essence_fire` |
| `core_elsa` | 0.8s / 1 dur | 22s / 5 dur | 70s / 12 dur | `essence_water` |
| `core_mjolnir` | 0.8s / 1 dur | 15s / 5 dur | 65s / 13 dur | `essence_nature` |
| `core_dragon` | 1.1s / 1 dur | 12s / 6 dur | 75s / 16 dur | `essence_fire` |
| `core_demon` | 1s / 1 dur | 12s / 5 dur | 80s / 16 dur | `essence_spirit` |

**Quan trọng:** cooldown/durability wear ở trên là giá trị thử **do tôi đề xuất, chưa được phê duyệt**; phải so với tick/channel/targeting thực của Gold trước khi áp dụng. Các trường hợp cast lỗi, thiếu đạn, thiếu durability, invalid target, teleport blocked không trừ đạn, cooldown hay durability. Cooldown theo physical UID, lưu đúng thời gian khi offline. Không vô tình cho phép cây do Q tạo ra phát sinh Wood vô hạn nếu Gold không định nghĩa tài nguyên như thế.

## G. Phân bố 111 vị trí dự kiến trên Veyra GOLD — có tên thật, không bịa tọa độ runtime

**Quy mô ứng viên:** 34 POI /81 POI GOLD, **85 rương tại POI**, **26 rương theo 11 đoạn đường GOLD**, tổng **111** rương bình thường. **Không** tính 19 rương phòng thẻ chưa kiểm định hình học, 3 nguồn G1A, NPC, Harpoon, Airdrop, Ragnarok. Không tạo một POI mới.

Các tọa độ dưới đây là **maplab GOLD 2000×1400**, tuyệt đối KHÔNG phải tile/runtime coordinates hợp lệ đã đo bằng flood-fill. Agent cần chọn điểm đặt cụ thể từ floor/collision thực, giữ sourceId cố định, không đặt cản cửa/hành lang/tuyến thoát.

| POI GOLD (ID, vị trí maplab) | Số rương × biến thể dự kiến |
|---|---|
| `po_greywater` — Greywater Hamlet (812,592) | 2×supply_low, 1×food_low, 1×medical_low, 1×toolbox_low |
| `po_pumphouse` — Greywater Pumphouse (850,556) | 1×supply_low, 1×toolbox_low, 1×medical_low |
| `po_confluence` — Confluence Waystation (918,668) | 1×supply_damaged, 1×toolbox_damaged |
| `po_sawaion` — Aion Edge Sawmill (748,668) | 1×supply_mid, 1×toolbox_low |
| `po_mill` — Mossbrook Mill (1002,730) | 1×food_mid, 1×supply_low |
| `po_ranger` — Ranger Hut (800,760) | 1×food_low, 1×medical_low |
| `po_siloc` — Grain Silo Complex (1090,760) | 2×supply_mid, 1×food_high |
| `po_slag` — Slagworks Foundry (1190,936) | 1×toolbox_high, 1×military_mid, 1×supply_high |
| `po_gulfhead` — Gulfhead (1052,878) | 2×supply_low, 1×food_low |
| `po_freightyard` — Shattered Freight Yard (690,500) | 1×supply_mid, 1×toolbox_low, 1×military_low |
| `po_falls` — Falls Powerhouse (722,438) | 1×military_mid, 1×military_high, 1×toolbox_high, 1×supply_mid |
| `po_academy` — Argus Academy (936,262) | 1×toolbox_high, 1×supply_mid, 1×medical_mid |
| `po_observatory` — Argus Observatory (958,170) | 1×supply_mid, 1×toolbox_low |
| `po_archive` — Argus Archive Vaults (1018,226) | 1×supply_mid, 1×military_high, 1×medical_high |
| `po_ironmine` — Ironholm Mine (1186,1290) | 1×toolbox_low, 1×supply_mid, 1×military_low |
| `po_ironwh` — Ironholm Depot (1236,1290) | 1×supply_mid, 1×toolbox_high, 1×military_low |
| `po_ironharbor` — Ironholm Harbor (1108,1264) | 1×supply_mid, 1×food_mid |
| `po_wreck` — Wreck Isle Salvage (184,872) | 1×supply_mid, 1×toolbox_high, 1×military_mid |
| `po_filter` — Delta Sluice & Filter Station (934,868) | 1×medical_mid, 1×supply_mid |
| `po_meridian` — Meridian Research Station (1120,690) | 1×supply_mid, 1×medical_mid, 1×medical_high |
| `po_kestrel` — Kestrel Radio Tower (700,300) | 1×toolbox_low, 1×military_low |
| `po_tidecamp` — Tidepool Fishing Camp (170,548) | 1×food_low, 1×supply_low |
| `po_fishcamp` — Fish Camp (352,846) | 1×food_low, 1×medical_low |
| `po_saltpans` — Salt Pans (1640,322) | 1×supply_low, 1×toolbox_low |
| `po_ember` — Emberport (1244,838) | 1×supply_mid, 1×military_low |
| `po_sulfur` — Sulfur Works (1768,882) | 1×supply_mid, 1×toolbox_high |
| `po_geo` — Geothermal Station (1736,916) | 1×supply_high, 1×military_mid |
| `po_emberwatch` — Ember Watch (1620,746) | 1×military_low, 1×medical_low |
| `po_kilns` — Charcoal Kilns (905,785) | 1×supply_mid, 1×toolbox_low |
| `po_greyquarry` — Greyback Quarry (506,652) | 1×toolbox_damaged, 1×supply_damaged |
| `po_saltharbor` — Saltwick Harbor (1546,334) | 1×supply_mid, 1×food_mid |
| `po_ironvein` — Ironvein Mine (1205,655) | 1×supply_mid, 1×toolbox_low |
| `po_lantern` — Lantern Light (1050,152) | 1×supply_low, 1×medical_low |
| `po_strait` — Strait Landing (1268,490) | 1×supply_mid, 1×food_mid, 1×medical_low |

11 hành lang/road corridor có thật trong GOLD:
- `rd_b`: supply_low ×2, toolbox_low ×1, food_low ×1
- `rd_6`: supply_low ×2, toolbox_low ×1, military_low ×1
- `rd_11`: supply_damaged ×1, toolbox_damaged ×1
- `rd_13`: supply_low ×1, food_low ×1
- `rd_16`: supply_low ×1, medical_low ×1
- `rd_19`: supply_low ×1, toolbox_damaged ×1
- `rd_1a`: supply_low ×1, military_low ×1
- `rd_1b`: supply_low ×1, medical_low ×1
- `rd_1c`: supply_low ×1, toolbox_low ×1
- `rd_2`: supply_damaged ×1, toolbox_damaged ×1
- `rd_3`: supply_low ×1, food_low ×1

### Vị trí High / cửa có điều kiện — phải có đường chơi thật
- `po_falls` → **military_high×1**: DEEP: verify powered door, manual release & escape. Không cho spawn cho tới khi cổng/nguồn thẻ/điện/PPE/hành lang và hand release đã được chứng minh.
- `po_archive` → **military_high×1**: DEEP: verify keycard+power+PPE & escape. Không cho spawn cho tới khi cổng/nguồn thẻ/điện/PPE/hành lang và hand release đã được chứng minh.
- `po_archive` → **medical_high×1**: DEEP: verify keycard+power+PPE & escape. Không cho spawn cho tới khi cổng/nguồn thẻ/điện/PPE/hành lang và hand release đã được chứng minh.
- `po_meridian` → **medical_high×1**: DEEP: verify keyed door, power & escape. Không cho spawn cho tới khi cổng/nguồn thẻ/điện/PPE/hành lang và hand release đã được chứng minh.

### Phòng thẻ theo benchmark LI 2022 — 19 nguồn dự kiến bổ sung sau kiểm chứng
- **GREEN** tại ứng viên `po_academy`: **6 rương** = supply_low, supply_low, toolbox_low, military_low, food_low, medical_low; phải chứng minh verified green_card source + real door + safe hand release. Phòng phải có đủ diện tích, tương tác, thoát ra được khi mất điện. Không bắt buộc mọi POI phải có phòng này.
- **BLUE** tại ứng viên `po_meridian`: **6 rương** = supply_mid, supply_mid, toolbox_low, military_mid, food_mid, medical_mid; phải chứng minh verified blue_card source + real door + safe hand release. Phòng phải có đủ diện tích, tương tác, thoát ra được khi mất điện. Không bắt buộc mọi POI phải có phòng này.
- **PURPLE** tại ứng viên `po_archive`: **7 rương** = supply_high, supply_high, toolbox_high, military_high, military_mid, food_high, medical_high; phải chứng minh verified purple_card + power + PPE + real door + safe hand release. Phòng phải có đủ diện tích, tương tác, thoát ra được khi mất điện. Không bắt buộc mọi POI phải có phòng này.

Thẻ mở phòng: **proposal bổ sung ba nguồn WORLD_ONLY nhưng được authored cố định và hữu hạn**: `green_card` trong case ngoại vi không cần Green ở Kestrel; `blue_card` ở văn phòng freight yard tự do tiếp cận; `purple_card` từ khu vận hành Slagworks có hazard vật lý nhưng không cần Purple để vào. Đây là vị trí đề nghị (chưa chứng minh engine). Đảm bảo người chơi có thể tìm nguồn thẻ bằng manh mối môi trường; không yêu cầu chuỗi Green→Blue→Purple toàn run, không auto-NPC gift. Hệ cửa phải giữ cơ chế tiêu/không tiêu thẻ theo contract hiện hành, không tự lựa chọn.

### Kiểm kê định danh vật lý đầy đủ: 111 + 19 nguồn

CSV `SOH_G1B_ALL_SOURCE_SLOTS_v0.1.csv` ghi đủ **130 source ID** không trùng: **111 rương base** và **19 slot dự kiến** tại ba phòng thẻ. Mỗi dòng có POI/đoạn đường, grade, access, timer và UID; trường `runtime_tile=UNRESOLVED` phải được Agent đo trên world geometry thật rồi ghi bền vững, không bịa tọa độ từ maplab.

## H. Vòng đời một rương THẬT trong game

1. **Source ownership:** rương là thực thể độc lập 3 nguồn công nghiệp G1A và các cache Shipping cũ. SourceId là key authored `veyra.g1b:<poiId/roadId>:<slotUid>` lưu bền vững, không dựa riêng tọa độ ngẫu nhiên mỗi lần mở window.
2. **Spawn/roll:** giữ `runId`, `sourceId`, `cycle`, `lootTableRevision`, `seed`; roll một lần theo bảng trên, lưu danh sách stack/UID. Việc mở F không roll lại.
3. **UI:** một bảng nhỏ 640×360, hiển thị tên và icon item hiện có, số lượng, tình trạng, sức chứa/tải trọng, thao tác 1 / cả stack / lấy hết, có phản hồi khi đầy. Không làm 16 menu. Độ bền/level của Core xem ngay tooltip.
4. **Partial:** chưa nhặt hết thì sprite OPENED, loot còn nguyên trong save khi đóng game, offline, rời window. Không tự thay đồ hoặc bắt timer reset một Core để lấy các món còn lại.
5. **EMPTY:** hết vật phẩm mới chuyển EMPTY và bắt đầu đồng hồ hồi theo nguồn, kể cả khi offline. Khi đủ giờ, một lần refill; không chạy vô hạn catch-up cycle nếu không ai mở. Nguồn đã hồi không được nhân từ reload.
6. **Drop/pickup:** người chơi chủ động thả đồ thì đồ đứng trên đất và không tự bị hút lại 0,4 giây; nhấn F nhặt lại nếu muốn. Các vật phẩm thu hoạch tự nhặt vẫn theo luật khác.
7. **Thị giác:** dùng **đúng 15 sprite pixel 48×48** trên branch (5 họ×3 state), mặt nạ material sheen; grade qua silhouette scale/vật liệu pixel-snap. Hiệu ứng là **đổi màu phản quang trong mặt rương**, không glow/bloom. Giá trị scale/tốc độ do artist studio cung cấp chỉ là candidate.

### Tốc độ phản quang và scale đề xuất ĐỂ BẠN XEM TRONG SOH

| Grade | Scale tương đối | Nhịp sheen |
|---|---:|---|
| Damaged | 0.8× | Tắt |
| Low | 0.9× | 20–28 giây/lần |
| Mid | 1.0× | 12–18 giây/lần |
| High | 1.14× | 8–15 giây/lần |

Scale trên không tự quyết collision. Khác biệt 0,96–1,04× của studio gần như khó nhận ra ở 640×360, nên tôi đề xuất thử rộng hơn và bắt buộc human visual acceptance, không khóa ngay.

## I. Kiểm toán economy: trước khi ai gọi tỷ lệ này “đủ hay”

- Nếu mở **mỗi một trong 111 source đúng một lần**, kỳ vọng lý thuyết là **8.8 Creator Core**. Trong đó chưa có 19 rương gated candidates. Nếu ba phòng 6/6/7 cùng được đặt, một lượt mở tất cả thêm kỳ vọng **2.3 Core**. Đây là phép tính, KHÔNG phải dự báo lượng Core mỗi người chơi nhận.
- Kiểu người chơi “có mặt khắp nơi, mở hết và vét mọi rương ngay khi hồi suốt 336h” có giới hạn lý thuyết khoảng **100.5 Core** kỳ vọng từ 111 nguồn; kịch bản đó không khả thi với travel/survival nên không phải game-play test, nhưng nó cảnh báo tác động của rương hồi và **không được chữa bằng Core cap trái quyết định Creator**.

| Vật phẩm | Kỳ vọng từ **một lần** mở cả 111 rương | Ý nghĩa với mạng nguồn |
|---|---:|---|
| `spares` | 237.5 | G1A là nguồn lớn chính; rương chỉ bù một phần |
| `tin_can` | 6.7 | Nguồn WORLD_ONLY vẫn phải theo dõi G1A |
| `needle_tube` | 8.3 | Nguồn WORLD_ONLY; Syringe dùng thật |
| `mechanical_gear` | 20.6 | Tương đương nguyên liệu Workbench Lv2 |
| `electronic_parts` | 13.4 | Mjolnir + điện tử, không tạo từ không khí |
| `electric_resistor` | 21.4 | Linh kiện WORLD_ONLY |
| `metal_pipe` | 14.5 | Craftable BOTH từ Refined Iron+Parts |
| `iron_plate` | 17 | Craftable BOTH từ Refined Iron+Parts |
| `fuel_can` | 3.5 | Fuel Rack/Refinery chính, rương bổ sung |
| `canned_meat` | 4.6 | Hỗ trợ Food, không độc chiếm Food High |
| `syringe` | 2.5 | Medical premium có giá trị |
| `medkit` | 9 | Đồ chữa bệnh dùng ngay |
| `energy_basic` | 70.5 | Rẻ từ Stone+Fiber, không biến Military thành ammo-only |
| `energy_refined` | 13 | Workbench Lv2 còn là nền chính |

- SOH G1A-R1 toàn-map expected Parts còn −14,5%, Tin Can −55,5%, Needle Tube −68,9% so với baseline cũ. Bảng rương này **không khôi phục** Tin/Needle về sản lượng cũ: lần vét toàn bộ 111 rương chỉ thêm ~6.7 Tin Can và ~8.3 Needle Tube. Đó là **thiết kế nguồn hiếm có chủ đích cần Creator cân nhắc**, không được nói “rương đã bù xong” khi chưa đúng.
- Dữ liệu actual 3 archetype G1A R1: Salvage Bale/Relay Wreck/Fuel Rack không respawn ở nhánh này; **rương thường hồi**, các nguồn không bị đồng nhất. Sản lượng chỉ là số học full-world, không thay thế người chơi thử hành trình và rủi ro.

## J. Self-audit: các lỗi tôi đã bắt và sửa trước bản gửi

1. **Loại rương không có vị trí:** lượt draft đầu bị thiếu Military High và Medical High; đã thêm vào Falls/Archive/Meridian với trạng thái DEEP/PENDING access. Cả 16 biến thể nay có ít nhất một nguồn cơ bản.
2. **Sai phép tính Core:** draft đầu nhân xác suất Lv1 và Lv2 của cùng một Core như hai phép trúng độc lập, khiến Core Military High bị tính thấp. Đã sửa thành cộng các outcome loại trừ nhau; tổng Core Military High đúng 53,5%.
3. **Dễ trộn những thứ không tương thích:** năm họ không đồng nghĩa có Toolbox Mid; Harpoon và Airdrop không có trong 16; rương player-built, G1A salvage, rương tiền Ragnarok không dùng timer này.
4. **Vi phạm acquisition policy:** 7 Creator phải có revision có chủ ý; 4 Field và Essence còn `CRAFT_ONLY`, không được rơi thầm. Không tạo vũ khí mới ngoài 157 ID.
5. **Lỗi địa lý có khả năng nghiêm trọng:** GOLD POI `at` là 2000×1400 maplab proposal, không phải cell runtime hay proof cổng; 111 là QUOTA DESIGN, không phải 111 điểm đã spawn được. 4 source High đòi kiểm chứng cổng/đường thoát. 3 phòng 6/6/7 chưa được cộng vào quota vì phải qua geometry/access.
6. **Ảo giác sẵn asset:** trên HEAD PR #61 hiện xác nhận có hai atlas rương G1B, nhưng **chưa thấy file `soh_items_157_atlas.png` trong tree `web/public`**. Gói 157 PNG/atlas nằm trong ZIP do conversation giữ; trước khi UI dùng đúng art 157, phải đưa atlas item + registry vào nhánh và kiểm tra 157/157 icon render; nếu runtime đã có art equivalent theo mã nguồn thì vẫn phải đối chiếu pixel thực, không gán đã hoàn tất.
7. **Thiếu thông số do user phê duyệt:** 16 odds, bonus, refresh timer, quota, 14 BOM, Core wear/cooldown, nguồn thẻ, thematic biases **đều là đề xuất có số cụ thể, không phải canon**. Thiết kế không được tự triển khai như thể Creator đã đồng ý.
8. **Trải nghiệm rương:** loot có giá trị phải xuất hiện ở các rương thấp ngay, Medical khác Food, Military vẫn có trang bị khi hụt Core; phải **cho chính Creator chơi** thử chứ không cho bot quyết định thú vị.

## K. Gate apply nguyên bộ — khác với “có code rồi chưa tính DONE”

**Không ra lệnh Agent chạy loot distribution final trước khi được duyệt ở đây.** Sau khi duyệt, giao MỘT hợp đồng đầy đủ: schema+source authority+16 pool+UI+map quotas+card rooms+clock+Core actions+save migration. Agent phải thực thi tuần tự và bàn giao từng playable slice, nhưng tổng scope này là toàn bộ feature; không phải làm xong sprite rồi quay lại hỏi mới thấy thiếu rate.

Hệ rương chỉ đạt khi: (a) cả 16 variant có source thật và đường vào hợp lệ; (b) đúng 219 nonzero chest-item defaults và theo-POI Core overrides; (c) lấy từng item/partial giữ nguyên; (d) timer hồi hợp lệ không reroll/dupe, kể cả offline; (e) ra Creator Lv2–3 đúng UID/full durability, Core cast bằng ammo inventory, sửa/nâng đúng bill; (f) 6/6/7 chỉ ở phòng có đủ geometry/access, không softlock, nguồn thẻ thật; (g) 157 icon và rương pixel đọc được ở 640×360; (h) người dùng tự đi tìm, mở, nhận diện giá trị và duyệt chất lượng.

### Đề nghị Creator phê duyệt theo 4 khối (có thể sửa từng khối)

1. **Gameplay rương:** pool/qty/rates, cơ chế 1 anchor+N regular+bonus+1 exclusive Core, 16 loại; đặc biệt Military Low/Mid/High Core 26%/44%/53,5%.
2. **World economy:** 111 nguồn cơ bản / 34 POI +11 đường; 3 phòng card 6/6/7 chỉ khi geo pass; chu kỳ 12–72h tùy nguồn, không pity/cap.
3. **Core liên kết:** 14 BOM và quyền loot nâng cấp, sửa, Wear/Cooldown 21 chiêu, mapping Essence hiện hành.
4. **UI/UX/art:** 5 sprite×3 states, scale/sheen pixel, 157 icon thật, các tương tác inventory/handoff cho player nghiệm thu.

**RÀNG BUỘC TỪ NGUỒN:** những điều đã chốt trước đó (NPC độc lập, offline chạy liên tục, không quest, không 30% chest→NPC, không Core cap, không nạp R) không phải những điều yêu cầu duyệt lại. Tất cả thông số mới ở trên đang chờ Creator xét.**

## L. Xác nhận hiệu lực triển khai sau phê duyệt

- Creator phê duyệt **toàn bộ 4 khối G1B** trong hội thoại ngày 2026-11-15: loot odds/quantity/slots, 111+19 nguồn dự kiến, chu kỳ 12–72h, 14 BOM, 21 cooldown/wear, bảo trì Core, và UX/art. Những nhãn `PROPOSAL` còn lại là dấu vết đề xuất trước khi duyệt, **không phải yêu cầu Agent chọn lại số**.
- **Đính chính dữ liệu đã kiểm tra:** CSV được đặt tên `POSITIVE_ITEM_ODDS` chứa 247 dòng nhưng 28 dòng Core có xác suất 0%. Dữ liệu dương chính xác là **219 dòng, 50 item ID**. Đã loại 28 dòng bằng 0 khỏi bảng dương, **không sửa bất kỳ xác suất, lượng drop hay Core outcome nào**.
- `runtime_tile: UNRESOLVED` của 130 source có nghĩa là **quy mô/POI/đường được duyệt, vị trí vật lý chưa xác minh**. Agent bắt buộc chứng minh vị trí/tuyến đi/cửa thẻ/điện/PPE/đường thoát khi tích hợp. Không được tính 19 phòng thẻ là đã triển khai nếu geometry chưa có; phải xây/cấp nguồn đúng thiết kế và kiểm tra người chơi sử dụng thực.
- Sau triển khai vẫn phải có **bản SOH chơi thật** để Creator nghiệm thu cảm giác. Bot chỉ kiểm thử lỗi/invariant, không quyết định gameplay hấp dẫn.
