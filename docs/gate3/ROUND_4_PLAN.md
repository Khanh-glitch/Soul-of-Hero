# Vòng 4 — Kế hoạch xử lý 4 điểm góp ý (sau khi Gate 3 kỹ thuật đã PASS)

Ngày: 2026-10-24 · Nhánh: `arena/6e89e68d-soul-of-hero` · HEAD khi viết: `688c017`

Trạng thái Gate 3 **không bị làm lại**: bằng chứng cũ giữ nguyên. Tài liệu này chỉ mở một
vòng việc mới, nhắm đúng bốn điểm trong bản duyệt: độ ổn định chiến đấu, kịch bản chết /
hồi sinh, camera tầng 2–3, và chất lượng thị giác.

Trước khi viết kế hoạch, tôi đã đọc lại bằng chứng đã đóng băng (ảnh native, log
`docs/gate3/evidence/logs/deep.txt`, dữ liệu level và các script production) để tìm nguyên
nhân thật thay vì trang trí thêm. Kết quả điều tra ở §1 là phần quan trọng nhất của tài
liệu này.

---

## 1. Điều tra: nguyên nhân gốc (có số liệu)

### 1.1 Vì sao khung hình vẫn "giống prototype" — **lớp vật liệu Gate 3 gần như không được vẽ**

Đây là phát hiện lớn nhất của vòng này, và nó giải thích gần như toàn bộ phê bình thị giác.

* `game/levels/crypt_entrance.tscn` dựng level bằng hai `TileMapLayer` production:
  * `Backdrop` — **z_index = -10** (dòng 3261–3262), chứa toàn bộ ô sàn.
  * `Geometry` — **không đặt z_index**, tức z = 0 (dòng 3267), chứa toàn bộ ô tường.
* `prototypes/gate3/gate3_redesign.gd::_build_material()` (dòng 217–258) lại thêm các lớp
  vật liệu Gate 3 vào **cùng node level**, với `z_as_relative = false` và z âm:
  `rock -30, floor -20, coping -19, water -18, water_edge -17, shadow -16, weather -15,
  mass -13, wall_face -12, niche -11, decor -10` (`prototypes/gate3/visual_placement.json`).
* `_hide_level_layers()` (dòng 341–356) chỉ ẩn **`Decor`**; `Backdrop` và `Geometry`
  vẫn hiển thị, và cả hai đều nằm **trên** mọi lớp vật liệu Gate 3.
* Kiểm chứng bằng ảnh native, không suy đoán: so `before_spawn.png` với `after_spawn.png`
  ở vùng sàn và vùng tường cho **cùng một giá trị điểm ảnh**
  (`(300,400) … (75,68,82)`, `(600,500) … (66,60,71)`, `(900,430) … (131,115,111)`).
  Nghĩa là ô sàn/ô tường của Gate 3 bị che hoàn toàn; ảnh 3×
  `inspection_crop_bay_rhythm_3x.png` cho thấy đúng art tileset gốc (gạch xanh xám, viền
  "chóp" kem/hồng) chứ không phải `face_a / face_dado / face_niche_*` của archive.
* Hệ quả kéo theo: `wall_shadow` (508 ô), `weather` (moss/wear/damp, 326 ô), `coping`,
  `niche` (241 ô tủ sách/khay ấn) và cả **trường sáng tối `Gate3_Shade` (z = -14)** đều
  không bao giờ nhìn thấy. Thứ duy nhất thực sự hiện ra ngoài props/đèn/hazard là
  `rock` — đúng phần đang bị chê là "băng chéo nhân tạo".

≈ 5 800 ô vật liệu đã dựng (floor 3 413, wall_face 979, mass 707, niche 241, weather 326,
shadow 508, coping 34) hiện đang nằm sau hai lớp production. Đây không phải vấn đề thẩm mỹ
mà là lỗi thứ tự vẽ.

### 1.2 "Băng chéo nhân tạo" ngoài bản đồ

* 5 872 ô `rock` chỉ dùng **2 frame** (`floor_quarry_0/1`, tỉ lệ 2 920 / 2 952) sinh bằng
  hash 2 chiều trong `tools/gate3/author_gate3.py` (dòng 726–737). Hai frame đó là 2 biến
  thể của cùng một hoạ tiết gạch chéo 16 px, nên ở tỉ lệ 2× mắt thấy nhịp chéo lặp đều.
* `rock` chỉ tồn tại trong bán kính 14 ô quanh công trình (`near_building(..., 14)`), xa hơn
  là `Background/Color` Polygon2D phẳng, đổi màu trong `game/main.gd` (~dòng 168–170).
* Đo phần khung nhìn (viewport logic 640×360 px ở zoom 1 ⇒ 40 × 22.5 ô) theo đúng các
  station chụp ảnh, phân loại ô theo `visual_placement.json`:

  | station | kiến trúc | rock | void |
  |---|---|---|---|
  | landmark (tầng 1) | 70.5 % | 29.5 % | 0 % |
  | cloister | 74.8 % | 25.2 % | 0 % |
  | combat_space | 62.7 % | 37.3 % | 0 % |
  | **floor2_arrival** | **25.8 %** | **49.2 %** | **25.0 %** |
  | floor2_stacks | 62.3 % | 37.7 % | 0 % |
  | floor3_camp | 58.5 % | 41.5 % | 0 % |

  Điểm đáp tầng 2 là điểm tệ nhất: ba phần tư khung là đá lặp và khoảng trống.

### 1.3 Chết / hồi sinh: cơ chế có, nhưng **không có gì gọi nó**

* `game/characters/knight/knight.gd:2763` có `respawn()` đầy đủ (hồi HP/mana/stamina, đặt
  lại vị trí về `GameSession.checkpoint`, bật bất tử 1 s, phát `GameEvents.player_respawned`).
* `game/ui/hud.gd:698` đã nghe `player_respawned`: ẩn overlay chết, bỏ pause, hiện toast
  "Đã hồi sinh tại điểm lưu". Tức là **HUD production đã sẵn sàng** cho luồng hồi sinh.
* Nhưng: `%RespawnButton` bị `hide()` ngay trong `_ready` (`hud.gd:108`) và **không nối tín
  hiệu nào**; toàn repo không có chỗ nào gọi `respawn()` ngoài định nghĩa. Người chơi chết
  → overlay + `get_tree().paused = true` → chỉ còn "chơi lại".
* Level có 2 checkpoint thật: `l3_checkpoint_floor_2` (264, 680) và
  `l3_checkpoint_floor_3` (264, 1160), được spawn qua `game/main.gd:24`, và
  `game/world/interactables/checkpoint.gd` ghi `GameSession.checkpoint` khi chạm.

⇒ Vòng này chỉ cần một "respawn director" phía prototype gọi đúng API có sẵn; không phải
viết lại HUD, không thêm HUD thứ hai.

### 1.4 Camera tầng 2–3

* `game/characters/knight/knight.tscn:60`: `Camera2D` duy nhất, `position (0, -8)`,
  smoothing 7, `limit_smoothed = true`.
* `game/main.gd:245–255` đặt limit theo `metadata.camera_bounds` của level =
  `[0, 0, 1856, 1344]`, tức **toàn bộ bản đồ 116 × 84 ô**. Không có giới hạn theo tầng,
  không dead-zone, không look-ahead, không zoom.
* Vì bản đồ là 3 tầng xếp dọc trong cùng một mặt phẳng, camera hoàn toàn có thể canh vào
  dải trống giữa hai tầng; cộng với việc `rock` chỉ phủ 14 ô quanh công trình, khung hình
  ở tầng 2–3 dễ rơi vào vùng đá lặp/phẳng (bảng §1.2).

### 1.5 Độ ổn định chiến đấu

Năm lần descent ba tầng đã xanh, HP mất: **662, 656, 274, 1098, 1004** (trên 1 100).
Biên độ ~4×. Log `deep.txt` của lần mới nhất cho thấy:

* 9 trận; thiệt hại đến từ hai nguồn: đòn cận chiến của skeleton (~154/đòn, có lúc mất 308
  trong một cụm) và spike (~196/lần chạm).
* Không có hồi máu, không có checkpoint respawn hoạt động ⇒ sai số tích luỹ suốt 3 tầng.
* Một phần chênh lệch là do **bot chụp ảnh** đi xuyên bãi spike không chủ ý (HP 598 → 458
  khi xuống tầng 2), không phải do người chơi.
* Không có sổ ghi thiệt hại theo nguồn, nên chưa thể nói "mất bao nhiêu vì cái gì".

---

## 2. Gói việc

Mọi thay đổi nằm trong `prototypes/gate3/**` và `tools/gate3/**`. Không sửa `data/**`,
`game/**`, `tests/**`, `assets/**`, `project.godot` (ràng buộc đã đặt từ đầu Gate 3; CI
kiểm tra `git diff` trên các đường dẫn này phải bằng 0).

### Gói A — Làm cho vật liệu archive thực sự hiện ra (ưu tiên 1, tác động lớn nhất)

1. Thêm `Backdrop`, `Geometry` vào `hidden_level_layers` của placement document.
2. **Không ẩn mù**: trước khi ẩn, `gate3_redesign.gd` phải assert phủ kín 100 % —
   mỗi ô `Backdrop` của level production phải có ô `Gate3_floor` (hoặc water) tương ứng;
   mỗi ô `Geometry` phải có `wall_face` hoặc `mass`; sai một ô → `_fail()` và dừng, in toạ
   độ ô thiếu. Ẩn lớp chỉ đổi `visible`, **không** tắt collision của TileSet production.
3. Giữ nguyên ngăn xếp z hiện tại (−30 … −10), vì sau khi ẩn hai lớp production thì toàn bộ
   dải này nằm dưới `Entities` (z = 3) và trên `Background` — đúng ý đồ thiết kế ban đầu.
4. Kiểm chứng: ảnh native before/after tại 4 station (spawn, landmark, floor2_arrival,
   floor3_camp) + crop 3× để thấy mạch gạch, trụ, hốc tủ, rêu/ướt, bóng tường và vignette
   `Gate3_Shade`; kèm một dòng log `GATE3 COVERAGE: Backdrop n/n, Geometry m/m`.

Tiêu chí đạt: không còn điểm ảnh nào của `Geometry`/`Backdrop` production trong khung hình;
điểm ảnh vùng sàn/tường **khác** ảnh before (đây chính là phép thử đã phát hiện lỗi).

### Gói B — Nền đá ngoài công trình: hết "băng chéo"

1. Sinh biến thể bằng **alternative tile** (flip H/V, transpose) trên cùng một atlas —
   không thêm TileSet source mới, không thêm asset: 2 frame × 8 biến đổi = 16 hình thái.
2. Chọn theo hash 2 chiều + **chia dải theo khoảng cách tới công trình** (sát tường: khối
   lớn, sáng hơn; xa: tối dần, ít chi tiết), thay vì rải đều một hoạ tiết.
3. Mở rộng bán kính rock từ 14 → 22 ô để mọi khung hình ở tầng 2–3 (sau khi clamp camera)
   không bao giờ thấy vùng phẳng của `Background/Color`; phần xa vẫn tối dần vào vignette.
4. Kiểm chứng: cùng bảng "kiến trúc/rock/void" ở §1.2, đo lại; ảnh 3× ở rìa bản đồ và
   ảnh toàn khung tầng 2; đếm số frame khác nhau thực dùng (kỳ vọng ≥ 12).

Tiêu chí đạt: không còn dải chéo đều nhìn thấy được ở 3× trong khung chơi; `void` = 0 %
tại mọi station; không giảm khả năng thấy hazard (18 spike vẫn nằm trên nền tương phản).

### Gói C — Điểm neo kiến trúc cho tầng 2 và tầng 3

Hiện 36 prop/21 sprite cho cả ba tầng; tầng 2 có 8 prop, tầng 3 có 6 prop, mỗi tầng chỉ 1
đèn riêng (tổng 6 đèn). Kế hoạch:

1. Mỗi tầng 2–3 thêm **≥ 3 điểm neo** có ngữ nghĩa, không phải đồ trang trí rời:
   * tầng 2: chân cầu thang gãy + giếng trời/vòm dẫn xuống, cột đôi đỡ vòm, dãy tủ mở
     (armarium) bị lục, đèn treo thấp.
   * tầng 3: bệ thờ đặt ấn, lan can quanh hố, cột đôi của doanh trại, đèn nến ở bàn.
2. Mỗi điểm neo có **đèn riêng ≥ 3 đèn/tầng**, để mắt có mốc sáng–tối khi di chuyển.
3. Chỉ dùng sprite đã có trong `props.json` (34 frame, không vẽ asset mới) — nhưng **phải
   đa dạng hoá vật liệu theo tầng**: tầng 2 đổi chu kỳ trụ (`PIER_PHASE`) và dùng
   `face_dado` dày hơn; tầng 3 dùng `face_broken_*` + `niche` nhiều hơn. Đây là chỗ trả lời
   trực tiếp "bề mặt đá lặp lại".
4. Ràng buộc: giữ 79 entity byte-identical và đúng thứ tự; không thêm khối solid chặn
   đường bắt buộc; không che hazard; collider khớp footprint như hiện tại.

Tiêu chí đạt: mỗi tầng 2–3 có ≥ 3 điểm neo và ≥ 3 đèn; ảnh chứng minh; manifest vẫn báo
79/79 entity, 0 diff trên đường dẫn đóng băng; connectivity check vẫn xanh.

### Gói D — Camera tầng 2–3

1. Suy ra **dải camera theo tầng** từ `metadata.rooms[].rect` (floor 1/2/3) + đệm an toàn,
   rồi gán `limit_top/limit_bottom` theo tầng đang đứng; `limit_left/right` giữ theo bề
   ngang của cụm phòng đang ở, không phải toàn bản đồ.
2. Thêm dead-zone nhỏ + look-ahead 16–24 px theo hướng đi (bằng cách chỉnh `position` của
   Camera, không sửa scene) để khung hình "dẫn" người chơi.
3. Cập nhật limit khi đổi tầng (nghe sự kiện door/teleport bằng cách so vị trí người chơi
   mỗi frame; không sửa production code), kèm `reset_smoothing()` để không bị trượt qua
   tường.
4. Kiểm chứng: bảng kiến trúc/rock/void ở 4 station tầng 2–3 **trước/sau**; ảnh native
   từng station; đảm bảo 18 spike vẫn trong khung khi ở gần (đo khoảng cách hazard–rìa).

Tiêu chí đạt: `kiến trúc` ≥ 60 % khung ở mọi station tầng 2–3 (mốc hiện tại thấp nhất
25.8 %), `void` = 0 %, Knight lệch tâm ≤ 80 px, không có hazard nào bị cắt khỏi khung khi
người chơi đứng trong bán kính 2 ô.

### Gói E — Chết & hồi sinh (làm cho câu chuyện chạy thật)

1. `prototypes/gate3/respawn_director.gd` (overlay, ~40 dòng): nghe
   `GameEvents.player_died` → chờ hết animation chết (~1.2 s) → gọi
   `player.respawn()`. HUD production tự ẩn overlay, bỏ pause, hiện toast.
2. Chống gọi đúp (cờ `_pending`), chịu được chết khi checkpoint chưa kích hoạt (rơi về
   spawn), và không can thiệp gì khác vào HUD.
3. Bằng chứng phải là ảnh native + log, không phải mô tả:
   * ảnh 1: khoảnh khắc chết, overlay + `paused = true`;
   * ảnh 2: sau hồi sinh tại checkpoint tầng 2, HP đầy, `paused = false`;
   * log: `RESPAWN: died at (x,y) -> respawned at checkpoint (x,y), dist < 2 px,
     HP 0 -> 1100, paused=false`, và HP/mana/stamina đã hồi.
4. Nếu vì lý do nào đó overlay prototype không thể gọi `respawn()` mà không sửa
   production, tôi sẽ dừng và xin phép riêng (xem §5, quyết định D1) — không tự sửa `game/`.

Tiêu chí đạt: một lần chết và hồi sinh thật, có ảnh, có log, không reset màn, không mất ấn
kỷ đã thu, không kẹt pause, và chơi tiếp được ngay.

### Gói F — Độ ổn định & cân bằng chiến đấu

Vì HP/đòn đánh/roster nằm trong `data/**` và `game/**` (đóng băng), vòng này **đo trước,
chỉnh sau, và chỉ chỉnh khi được phép**:

1. Thêm "damage ledger" phía prototype: nối `health_changed`/`damaged` của hazard + enemy,
   ghi mỗi lần mất máu kèm nguồn, toạ độ, thời điểm; in tổng theo nguồn cuối mỗi descent.
2. Chạy **N = 10 descent** trong CI (ma trận 2 shard × 5, hoặc tuần tự trong 2 job), mỗi
   lần xuất `HP delta`, `% theo nguồn`, số trận, số dash, số lần chết.
3. Báo cáo phân bố: min / trung vị / max, độ lệch, và **giải thích được ≥ 90 % thiệt hại**
   bằng ledger. Chỉ số "ổn định" được định nghĩa trước: nếu trung vị ~40 % HP và
   max ≤ 75 % HP thì coi là ổn định cho một level tier 3 không hồi máu; nếu không, đề xuất
   thay đổi cụ thể (kèm tên file/thuộc tính) và xin phép.
4. Không dùng mẹo né tránh hazard kiểu cũ (đã thử 4 biến thể, đều thua) — chỉ đo và báo cáo
   trung thực, kể cả khi kết quả xấu.

Tiêu chí đạt: bảng 10 lần descent + ledger giải thích; kết luận rõ "đạt/không đạt" theo
định nghĩa ở (3); nếu cần chỉnh balance, có đề xuất cụ thể chờ duyệt.

---

## 3. Thứ tự thực thi & ngân sách CI

| bước | nội dung | vì sao thứ tự này |
|---|---|---|
| 1 | Gói A (z-order + coverage assert) | Sửa một lỗi làm thay đổi gần như toàn bộ hình ảnh; mọi đánh giá thị giác sau đó mới có nghĩa. |
| 2 | Gói B (rock đa dạng + bán kính) | Phụ thuộc A: sau khi ẩn lớp production, ranh giới công trình/đá lộ rõ. |
| 3 | Gói C (điểm neo tầng 2–3) | Đặt prop/đèn lên nền vật liệu đã đúng. |
| 4 | Gói D (camera) | Đo lại khung hình sau khi A–C xong, tránh tối ưu trên nền sai. |
| 5 | Gói E (respawn) | Độc lập, có thể chạy song song; cần 1 job capture riêng. |
| 6 | Gói F (10 descent + ledger) | Tốn CI nhất, chạy sau cùng khi level đã ổn định. |

Ước lượng: 6–8 lần đẩy có CI (mỗi lần ~15–20 phút), 1 lần đẩy tài liệu `[skip ci]`.
Mỗi bước phải xanh mới sang bước sau; nếu đỏ, đọc log và sửa, không bỏ qua.

## 4. Tiêu chí nghiệm thu của vòng này (đối chiếu 5 mục chấm)

1. **Kiến trúc**: vật liệu archive hiển thị đúng và phủ kín 100 % ô production (bằng chứng
   log coverage + ảnh).
2. **Bản sắc thị giác**: 16 biến thể đá, ≥ 3 điểm neo + ≥ 3 đèn mỗi tầng, khác biệt vật liệu
   theo tầng; so sánh 10 station before/after.
3. **Bố cục**: camera theo tầng, `kiến trúc` ≥ 60 % khung ở tầng 2–3, `void` = 0 %.
4. **Gameplay/độ đọc**: respawn chạy thật; 10 descent có ledger; hazard vẫn thấy rõ.
5. **Toàn vẹn kỹ thuật**: 79/79 entity byte-identical, 0 diff đường dẫn đóng băng,
   manifest `--check` xanh, workflow xanh.

## 5. Ba quyết định cần duyệt trước khi tôi bắt tay vào code

* **D1 — Respawn**: (a) chỉ làm "respawn director" prototype như §Gói E (không sửa
  production) — tôi đề xuất (a); hay (b) cho phép sửa `game/ui/hud.gd` để hiện và nối
  `%RespawnButton` (thay đổi production, phá ràng buộc "frozen paths").
* **D2 — Cân bằng chiến đấu**: (a) chỉ đo và báo cáo, không chỉnh (đúng ràng buộc hiện tại)
  — tôi đề xuất (a); hay (b) cho phép chỉnh HP/sát thương trong `data/**` nếu 10 descent cho
  thấy mất máu quá cao.
* **D3 — Phạm vi thị giác**: xác nhận việc ẩn `Backdrop`/`Geometry` (thay bằng vật liệu
  archive, có assert phủ kín) là hướng đúng, thay vì giữ art production và chỉ tô thêm.
  Đây là thay đổi lớn nhất về hình ảnh trong cả Gate 3.

Nếu cả ba theo đề xuất (a), tôi bắt đầu ngay từ Gói A và báo lại bằng một lần chạy CI xanh
kèm ảnh native mới.
