# Kiểm kê mỹ thuật VEYRA do assistant tự tạo khi xây POI

**Phạm vi:** C03, C04, C01, C02, F03 và 48 POI cuối. Không nhận vơ asset đã có sẵn trong `veyra-world-map-reconstruction (11).zip` hoặc 3 POI chủ lực/H01 trước khi tôi triển khai C03.

**88 sprite declarations**, **86 key khác nhau** (trùng fish_drying_rack, rope_coil), **5 tile painters**. F03 đời đầu: 16 sprite cũ và một tile painter khác, đã bị bản remake thay thế.

## I. Sprite tự vẽ bằng code (Canvas / mk)

Đây là mã vẽ 1px (`fillRect`, một số `stroke`/`ellipse`), không phải PNG sprite atlas. "Có trong source" không có nghĩa mọi sprite đã được nhìn thấy trong bản tích hợp thực.

### C03 — 22 sprite

| Key trong mã | Mô tả | Kích thước px |
|---|---|---:|
| `rope_coil` | Cuộn dây thừng | 19×13 |
| `cargo_hoist` | Palăng / khung nâng hàng | 28×35 |
| `cargo_crane` | Cần cẩu hàng | 34×35 |
| `tide_marker` | Cọc thước đo thủy triều | 14×26 |
| `signal_flag` | Cờ tín hiệu | 13×28 |
| `ticket_board` | Bảng thông tin / vé | 17×18 |
| `gear_rack` | Giá treo dụng cụ | 22×20 |
| `wicker_trap` | Bẫy/giỏ đan | 18×13 |
| `fish_drying_rack` | Giàn phơi cá | 26×21 |
| `oar_stack` | Bó mái chèo | 22×17 |
| `boat_ribs` | Sườn thuyền dang dở | 28×19 |
| `reed_bundle` | Bó lau sậy | 15×23 |
| `windbreak` | Tấm chắn gió | 22×16 |
| `quay_sign` | Bảng hướng dẫn bến | 27×29 |
| `bridge_post` | Trụ gỗ đỡ cầu | 17×30 |
| `load_pulley` | Ròng rọc nâng hàng | 35×46 |
| `lift_chain` | Xích nâng hàng | 18×35 |
| `wind_vane` | Cánh gió báo hướng | 27×37 |
| `pier_lantern` | Đèn bến | 23×34 |
| `reed_screen` | Vách chắn lau sậy | 35×28 |
| `net_canopy` | Giàn mái lưới | 46×30 |
| `storm_shutter` | Cửa/tấm chắn bão | 28×25 |

Nguồn: `Mã phát triển C03 trong hội thoại trước; ZIP gốc không nằm trong bộ source hiện có`.

### C04 — 17 sprite

| Key trong mã | Mô tả | Kích thước px |
|---|---|---:|
| `c04_quay_sign` | Biển chỉ dẫn cầu tàu | 26×29 |
| `c04_rope_pulley` | Palăng dây | 35×43 |
| `c04_bollard` | Trụ neo tàu | 17×26 |
| `c04_lamp` | Đèn bến | 22×37 |
| `c04_signal` | Cờ/cột tín hiệu | 30×39 |
| `c04_tide_gate` | Cửa cống thủy triều | 26×28 |
| `c04_torn_notice` | Bảng thông báo rách | 23×27 |
| `c04_splinter_pile` | Đống gỗ gãy | 35×20 |
| `c04_broken_post` | Cọc cầu gãy | 24×33 |
| `c04_warning` | Biển cảnh báo | 23×29 |
| `c04_crow` | Chim quạ | 27×16 |
| `c04_algae_sluice` | Rãnh cống rong rêu | 24×18 |
| `c04_tern` | Chim nhàn biển | 25×18 |
| `c04_feather_basket` | Giỏ lông vũ | 21×17 |
| `c04_reed_screen` | Vách lau sậy | 35×28 |
| `fish_drying_rack` | Giàn phơi cá (vẽ lại trùng tên C03) | 29×24 |
| `rope_coil` | Cuộn dây (vẽ lại trùng tên C03) | 18×14 |

Nguồn: `VEYRA_C04_SOURCE_ADDON.zip > c04-source/src/veyra05/c04-art.ts`.

### C01 — 10 sprite

| Key trong mã | Mô tả | Kích thước px |
|---|---|---:|
| `c01_city_banner` | Cờ hiệu thành phố | 25×55 |
| `c01_arched_gate` | Cổng vòm | 57×49 |
| `c01_canopy_market` | Quầy chợ mái bạt | 64×38 |
| `c01_cargo_hook` | Cần móc/nâng hàng | 41×58 |
| `c01_quay_lamp` | Đèn bến đô thị | 26×42 |
| `c01_mooring` | Trụ buộc tàu | 23×30 |
| `c01_rope_cart` | Xe chở dây thừng | 44×29 |
| `c01_white_salt_pan` | Bồn/sân muối trắng | 50×31 |
| `c01_brine_pipe` | Ống dẫn nước muối | 37×39 |
| `c01_roof_dormer` | Cửa sổ nhô trên mái | 52×34 |

Nguồn: `VEYRA_C01_SOURCE_ADDON.zip > c01-source/src/veyra05/c01-art.ts`.

### C02 — 10 sprite

| Key trong mã | Mô tả | Kích thước px |
|---|---|---:|
| `c02_ore_tipple` | Tháp đổ quặng | 70×67 |
| `c02_rail_wagon` | Toa xe quặng | 58×37 |
| `c02_chain_gantry` | Giàn cẩu xích | 78×79 |
| `c02_industrial_chimney` | Ống khói công nghiệp | 42×90 |
| `c02_steel_truss` | Khung giàn thép | 77×37 |
| `c02_ore_bins` | Phễu chứa quặng | 59×41 |
| `c02_warning_lamp` | Đèn cảnh báo | 29×42 |
| `c02_heat_grate` | Vỉ sàn nhiệt | 45×29 |
| `c02_tide_gate` | Cửa điều tiết triều | 69×58 |
| `c02_counterweight` | Khối đối trọng | 50×63 |

Nguồn: `VEYRA_C02_SOURCE_ADDON_FOR_CURRENT.zip > c02-source/src/veyra05/c02-art.ts`.

### F03 Remake — 29 sprite

| Key trong mã | Mô tả | Kích thước px |
|---|---|---:|
| `f03_turbine` | Tuabin | 41×37 |
| `f03_waterwheel` | Bánh xe nước | 43×45 |
| `f03_steel_gate` | Cửa chặn thép | 31×31 |
| `f03_pipe_bundle` | Cụm ống dẫn | 48×26 |
| `f03_rust_pipe` | Ống gỉ | 38×19 |
| `f03_valve` | Van điều khiển | 25×32 |
| `f03_gauge_panel` | Bảng đồng hồ | 26×30 |
| `f03_log_cradle` | Giá gỗ tròn | 55×30 |
| `f03_timber_pile` | Đống gỗ xếp | 49×33 |
| `f03_sawframe` | Khung máy cưa | 57×43 |
| `f03_sawdust` | Đống mùn cưa | 35×20 |
| `f03_chain_rail` | Ray/xích tải | 58×27 |
| `f03_ore_ramp` | Máng/quai nạp quặng | 50×31 |
| `f03_spoil_heap` | Đống đất đá thải | 48×29 |
| `f03_ore_seam` | Mạch quặng lộ | 38×25 |
| `f03_glass_spoil` | Đống xỉ/thủy tinh quặng | 39×28 |
| `f03_crusher` | Máy nghiền | 52×50 |
| `f03_screen` | Sàng lọc quặng | 43×32 |
| `f03_crane` | Cẩu công nghiệp | 58×70 |
| `f03_kiln_vat` | Bể/lò nung | 50×53 |
| `f03_charcoal_rick` | Ụ than gỗ | 40×28 |
| `f03_condenser` | Bình ngưng | 55×48 |
| `f03_chimney` | Ống khói | 34×80 |
| `f03_vent_pipe` | Ống thông khí | 30×52 |
| `f03_slag_pool` | Bể xỉ nóng | 44×28 |
| `f03_silo` | Tháp silo | 50×78 |
| `f03_filter_tank` | Bồn lọc | 56×41 |
| `f03_geo_manifold` | Cụm ống địa nhiệt | 61×39 |
| `f03_signal_lamp` | Đèn chỉ báo | 21×37 |

Nguồn: `VEYRA_F03_REMAKE_SOURCE_ADDON.zip > src/veyra05/f03-art.ts`.

### REST48 — 0 sprite

Không phát sinh sprite mới. Vẫn tự bố trí phòng, đường, sân, mái và vật thể tham chiếu bằng code, dùng renderer/asset nền đã có.

## II. Bề mặt sàn/nền do code tự vẽ chồng lên world

| Nhóm | Hàm vẽ | Loại bề mặt |
|---|---|---|
| C03 | `drawC03DeckTile` | Sàn ván gỗ, bóng sàn cầu tàu và giàn cao; biến thể Strait/Southfoot/Mere |
| C04 | `drawWaterfrontDeckTile` | Sàn gỗ/bến hư, dấu nứt/bóng ván; Westbank/Drowned/Tern, edgeMask, tầng cao |
| C01 | `drawUrbanHarborDeckTile` | Đá/đường bến đô thị, sàn gỗ và muối; Gulfhead/Westmouth/Saltwick, tầng cao |
| C02 | `drawIndustrialHarborTile` | Sàn công nghiệp/kim loại/đường quặng, mảng bóng và viền; Ironholm/Emberport/Sandgate |
| F03 Remake | `drawF03DeckTile` | Sàn mỏ đá, xưởng gỗ, thủy lực, lò nóng và kỹ thuật; vệt mòn và viền ô 16x16 |

**Phân biệt:** Những bộ tô mặt sàn này không phải thay toàn bộ địa hình GOLD. Các lối đi/sàn/cầu được các hàm kiến trúc khai báo thành ô `FLOOR`/`ROAD` hoặc phòng `open, carve`; renderer vẽ gạch/ván hoặc bề mặt tùy nhóm trên ô hợp lệ. Hình sân rộng đồng màu, tường/mái vuông, vùng trống cũng có thể xuất phát từ *geometry bố trí* chứ không phải sprite mới.

### 48 POI cuối: không tạo sprite độc lập nhưng vẫn tạo nhiều mảng nền bằng layout

Source: `VEYRA_ALL_81_POI_ARCHITECTURES_CUMULATIVE_INTEGRATION.zip > SOURCE_ADDON/rest48.ts`. Bộ source khai báo 48 plan qua 9 hàm gia đình `archive`, `signal`, `rupture`, `way`, `wild`, `crypt`, `coast`, `utility`, `service`, dùng `open`, `mass`, `hut`, `climb`, `props`. Đây là thủ phạm tiềm năng của những mảng sàn/đường kích thước lớn, lặp, dù không phải ảnh PNG hay sprite mới. Các `p.prop()` chủ yếu **tham chiếu tên object có sẵn**, không chứng minh đã có sprite riêng mới.

## III. Asset F03 đời đầu cần tránh phục hồi

| Key (phiên bản cũ) | Kích thước px |
|---|---:|
| `f03_turbine` | 48×43 |
| `f03_pipe_bundle` | 48×27 |
| `f03_valve` | 26×37 |
| `f03_log_cradle` | 57×30 |
| `f03_sawframe` | 55×44 |
| `f03_chain_rail` | 61×29 |
| `f03_ore_ramp` | 48×28 |
| `f03_crusher` | 56×55 |
| `f03_crane` | 62×69 |
| `f03_kiln_vat` | 49×49 |
| `f03_condenser` | 54×48 |
| `f03_chimney` | 37×82 |
| `f03_silo` | 49×75 |
| `f03_filter_tank` | 57×41 |
| `f03_geo_manifold` | 64×39 |
| `f03_signal_lamp` | 21×39 |

Bộ cũ cũng dùng `drawF03DeckTile` nhưng code tô mặt sàn khác. Chúng không được cộng như "sprite mới đang hoạt động" vì F03 remake đã thay thế hàm cùng tên và các key chồng lấn.

## IV. Quy tắc sửa cho agent mỹ thuật

- **Không vẽ lại GOLD:** giữ tọa độ, biome, nước, va chạm và các POI IDs; thay art biểu diễn, không sửa source geography.
- **Thay riêng asset xấu F03 trước:** 29 sprite remake + `drawF03DeckTile` phải xem là nợ mỹ thuật bị người dùng từ chối.
- **Kiểm tra bản đồ thực ở 1×:** xem cả sprite/ground/cầu thang, không đánh giá mỗi icon riêng.
- **Tránh sửa nhầm những asset có sẵn:** các bộ nhân vật, cây, đá, nước, sinh vật của `src/game/art.ts` và atlas nền trong ZIP (11) không thuộc phần mới do tôi tạo.
- **Không mặc định `p.prop` = có hình riêng:** tra registry sprite ở bản hợp nhất; tên object có thể dùng asset sẵn có hoặc fallback.
- **Nhiều bản asset trùng key:** `rope_coil` và `fish_drying_rack` bị C04 định nghĩa lại; thứ tự spread trong registry có thể khiến bản C04 ghi đè C03.
- **C03 cần xác minh lại trên bundle thật:** source C03 gốc không có ở môi trường này; bảng C03 là kiểm kê từ code đã viết trước đó, không được coi là xác nhận binary provenance.

## V. Trạng thái nguồn

C04/C01/C02/F03 remake/REST48: đã mở ZIP và đọc source thực. C03: tái lập tên/dim từ mã đã viết trong hội thoại trước, cần xác minh với file C03 Breakthrough thật. Kiểm kê này là danh sách tài nguyên được **định nghĩa**, không phải chứng nhận tất cả đang sử dụng ở bản game tích hợp cuối cùng.