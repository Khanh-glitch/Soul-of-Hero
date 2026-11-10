# SOH — ĐỊNH LƯỢNG BẢN ĐẦU & QUY TRÌNH CHỌN SỐ v10

**Tính chất:** Hướng dẫn phương pháp kỹ thuật **chưa phải mức cân bằng đã duyệt**. Các con số hiện tại bên dưới là bằng chứng code tại Web PR44 `d73aa63f...`, không phải số mục tiêu mới.

## 1. Các mốc code thật để không bắt đầu từ số ảo

- Normal creatures `catalog.ts` (Web): Shore Crab HP24; Wolf/Toad HP30; Boar HP40; Scrap Crawler HP44; Cinder Beetle HP52. Elder latent HP300–400, awakened HP560–720 (tùy Elder). Không đồng nhất HP khi Map/native khác Web.
- Legacy Core `sim.ts`: Ember projectile 45 damage, projectile speed190, life .95s; Quake 8 hazards damage32 (không phải '8×32 lên cùng một con' nếu hit budget giới hạn); Storm chain max4 targets 30 dry /45 wet per target; Rime ring damage20, slow, đóng băng nước 90s. Cả bốn dùng cast windup .52s, commit .46s. Đây là baseline **chưa đáp ứng** 3 hành động/Core.
- Legacy Core initial charges: Fire/Earth/Frost=3; Storm=4. Preserve on old-stack migration.
- Global fixed: run336h; Ragnarok last72h; no forced Core/Elder, cash only via physical verified escrow. Những thông số khác cần đo.

## 2. Bảng thông số Agent phải xuất cho mỗi hành động và loại Core

`core_id, action, aim_mode, min/max_range, base_damage_per_valid_hit, target_cap, tick_period, overlap_hit_policy, projectile_speed/life, cast_windup, commit_frame, startup/recovery, movement_lock, stagger, coverage_angle, wall_occlusion, armor_resistance, element_status_chance, effect_duration, terrain_mutation_duration, source_stock_effect, VFX_onset/impact/aftermath, base/refined/essence cost, loaded_capacity, reload_time, repair_cost, rarity_source, research_source, counterplay, sound_radius, on_save/offline rule`.

Mỗi trường có: `LI_SOURCE_SCOPED` (nếu nguồn xác nhận), `SOH_EXISTING` (đọc code), `SOH_PROPOSED` (dự kiến), `SOH_TESTED` (số đã thử với seed, SHA và test), và `CREATOR_FIXED` (không chỉnh). Không cho Agent điền số giả vào 'LI_SOURCE_SCOPED'.

## 3. Đo theo tỷ lệ và đánh đổi thay vì cố gắng ghép số súng LI

- `TTK_normal = targetHP / achievedDPS` với khả năng tránh đòn, cadence, accuracy, reload, LOS, armor và rủi ro tiếp cận.
- `EffectiveDPS = sum(validHitDamage × hitProbability × targetCount) / totalActionCycle`; shot burst và delayed hit tính riêng, không cộng các hit ngoài cap.
- `Sustain_window = available_loaded_charges / charge_rate` và `refill_time = material_acquisition + station_queue + return_travel + reload`.
- `Net_expedition = usable_items + blueprint/route utility − material_consume − fuel − repairs − travel opportunity − death risk`. Không ép tất cả về một số tiền; ghi cả các quyền công nghệ mở được.
- `Base_buffer_hours = stock_supply / measured_upkeep_rate` theo vật liệu, diện tích, điều kiện môi trường và cấu trúc, cộng nguồn xuống cấp vật lý. Kiểm thử 8h/24h/48h/72h offline.
- `Core_E_per_journey = refined_flux_used + essence_used` so với sản lượng có thể kiếm từ ít nhất hai lộ trình không boss; vùng nguy hiểm phải tăng hiệu suất ròng chứ không độc quyền.
- `wood_net_gain = legal_summoned_wood_after_3s − all_basic/refined/essence/other resource opportunity cost` xét chu trình vòng kín; **số cây 10 không thay đổi**.

## 4. Các điểm chống sai thiết kế quan trọng

- **F03:E dragon:** định nghĩa group `G` là target hợp lệ tại snapshot commit. Có `H = Σ_{i∈G} currentHP_i`. Hit thứ hai có tổng damage raw bằng `0.20 × H`, không tính lại H mỗi frame (tránh recursion). Phân bổ *đề xuất kỹ thuật*: `D_i=0.20×HP_i` cho từng target hợp lệ, tổng bằng 0.20H. Đây mới là cách giải thích bảo toàn tổng, **chưa có phê duyệt của Creator cho target-allocation**, không tự đổi sang '20% HP boss' hoặc '20% mỗi người sau mitigation'; resist/immue cap cần trình diff rõ.
- **N01:Q wood:** số cây và thời gian là Creator FIXED: 10, 3s. Output wood stack lượng/mỗi cây, vị trí dropout và khả năng gỗ được bẻ sớm chưa chốt. Source custody phải đảm bảo không duplicate bất kể chết/cancel/save.
- **W01:Q:** 1 giây miễn nhiễm phải tác động damage pipeline thật; không áp đại trà lên cả nhóm/hậu cast.
- **W01:E:** toàn màn = viewport tại commit được chuyển thành hình chữ nhật **tọa độ world fixed**, không dịch theo camera; water, NPC, collision/nav phải đổi thật và hồi đúng.
- **F02:E:** đúng 10 thiên thạch, vị trí và lệch đợt random nhưng seeded per-cast; không cho 10 hit bất hợp lệ lên một target trong cùng frame.
- **S01:E:** teleport không vượt qua ranh giới POI/địa hình khóa, target phải có chỗ đứng hợp pháp; invulnerability/stealth không tự cộng thêm ngoài chiêu.
- **Q/E hold:** preview target, release commit after legality check, RMB/Escape/window blur cancel without debit. Sau commit hazard và nguồn gỗ/terrain do server-like authoritative receipts quản lý, không được do FX emit grant.
- **Tác động nhiều trạng thái:** Fire×rain, Frost×water, Storm×wet/conductor, Roots×terrain, summon×collision, Fire×wood cần order deterministic và source ownership. Không tạo combinatorial 'all effects react to everything'.

## 5. Bắt buộc chạy các mẫu người chơi thay vì một con số trung bình

1. **Knife-first novice**: không Core, không Elder, sống/loot/nhà vài giờ; lấy được nguồn chế Basic energy khi hợp pháp.
2. **Early-Common-Core**: F01 hoặc N01, Gold preloaded, basic lặp lại, có thể mất/sửa/nạp; so với dao và cung.
3. **Rare-Core Lucky Find**: nhặt Core hiếm trước recipe để trải nghiệm Gold hữu hạn; nguồn tiếp tế không dễ vô hạn nhưng không bế tắc.
4. **Furnace-first / Home-first**: vật liệu dùng bảo trì, công cụ, đầu tư Workbench LvIII, năng lượng cạnh tranh.
5. **POI Raider & Loot Skip**: nhặt rare intermediate, crate tương ứng, item có quyền chế/loot, ra khỏi POI an toàn.
6. **Energy Expedition**: tự đi nhiều tuyến tìm Refined và từng essence, so net/time/risk và khả năng dùng xe.
7. **Optimiser**: thử mua/looting/salvage/recharge/cast lấy wood; tìm vòng lợi nhuận, exploit, regen vô hạn.
8. **Underprepared 48h Offline**: căn cứ nhỏ và lớn, upkeep có cảnh báo/thiệt hại hữu lý, không 'quái hiện ở nhà'.
9. **Prepared 72h Offline**: trước khi off nạp vật tư, lò/vườn/trạm có state, trở lại có thành quả và phí tổn.
10. **Full 336h/Final72h**: thời gian run, cash từ finite POI, escrow hợp pháp, xóa đúng toàn bộ vật phẩm mới, giữ đúng meta.

## 6. Quy trình tuning ra quyết định

- P0: đọc Last Island có mode/date/source, lưu nguyên số. Chưa có số thì `UNKNOWN`.
- P1: khai báo bounds/giả thuyết SOH bằng config; không hardcode vào nhiều nơi.
- P2: chạy replay seeded 10 profile, các bản đồ Map hợp lệ, so KPI/histogram (chi phí, TTK, damage received, wait times, broken tool, cache rate).
- P3: kiểm thử bằng input người chơi thực, HUD, cảm giác, âm thanh, pixel visual/Gold layer; ghi sự khác biệt giữa các lần.
- P4: điều chỉnh đúng biến và chạy lại regression/anti-dupe/save/offline. Chỉ trạng thái SOH_TESTED cùng SHA và hình ảnh được dùng làm baseline mới.

**Tuyệt đối không đặt “tăng 20%”/“tỷ lệ hiếm 0.5%” tùy ý thành số Last Island đã xác minh.** Hệ số ở những nguồn LI năm khác nhau không được trộn.
