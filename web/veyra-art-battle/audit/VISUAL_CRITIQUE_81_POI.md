# VEYRA — PHẢN BIỆN 81/81 POI TRƯỚC NGHIỆM THU MỸ THUẬT CUỐI

**Trạng thái:** Technical design review / independent visual audit / revised acceptance contract; **KHÔNG PHẢI** chứng nhận 81 POI đã đạt chuẩn. **Ngày:** 09/11/2026. **Chủ đích:** giao đủ cụ thể cho agent art, architecture, QA và người nghiệm thu.

## 0. Phạm vi, nguồn và giới hạn của kết luận

- **Nguồn được đọc trực tiếp:** `VEYRA_ALL_81_POI_ARCHITECTURES_CUMULATIVE_INTEGRATION.zip` (manifest, roster 48, source `rest48.ts`, 8 ảnh, audit 48); `VEYRA_F03_REMAKE_SOURCE_ADDON.zip` (`f03.ts`, 15 source plans); các addon C01/C02/C04; `veyra-world-map-reconstruction (11).zip` (DSL/gốc); các bộ ảnh chụp F02/F03 và F03 remake; screenshot phản hồi của chủ sản phẩm.
- **Thực nghiệm mới:** dùng compiler DSL từ ZIP (11) chạy lại 15 F03 R2 + 48 REST48 để đếm tầng/phòng/đạo cụ và lỗi hình học; xem ảnh thực người chơi ở tỷ lệ 1280×720 và montage. Đây không phải playtest lại cả 81 và không chứng nhận bản C03 thật đã ghép thành công.
- **Không tìm được:** canonical 26-triad/11-family master và byte bản C03 Breakthrough trong nguồn hiện có. Bởi vậy các nhóm `REST48/ARCHIVE...SERVICE` chỉ là nhóm *làm việc* trong mã, **không phải phân loại canon mới**.
- **Dữ liệu nhân sự/Gameplay:** vendor đề xuất, evacuation, caches chỉ là vỏ cảnh quan. Không được biến mỹ thuật thành lời hứa giả về giao dịch, thoát hiểm, loot, thiết bị hoạt động hay nguy hiểm chưa được nối hệ thống.

### Các sự thật kỹ thuật có thể kiểm tra lại

| Hạng mục | Đo trực tiếp | Ý nghĩa |
|---|---:|---|
| Source F03 R2 | 15 POI / 160 khu-phòng / 147 props khai báo | F03 hiện phân thành **7** sơ đồ `[-1,0,1]`, **7** `[0,1]`, **1** `[0,1,2]` — các báo cáo “15 POI đều 4 cao độ” cũ không còn đúng với source R2 |
| Source REST48 | 48 POI / 213 khu-phòng / 158 props khai báo | **27** chỉ có `[0]`; **9** có `[-1,0]`; **7** có `[0,1]`; **5** có `[0,1,2]` |
| Source REST48 | 9 hàm grammar, 48 cấu hình `RestSite` | Có biến thể concept/props, nhưng hình học cơ bản vẫn lặp theo grammar; không thể chấm 48 công trình “độc bản” |
| Browser evidence REST48 | 8/48 ảnh đầu vào đại diện | 40 địa điểm không có ảnh độc lập trong gói; không nâng trạng thái visual vì compiler green |
| Cumulative integration | synthetic C03 test pass | Khả năng ghép từ byte C03 thật và toàn bộ lỗi triển khai sau ghép **chưa chứng nhận** |

## 1. Mười hai quy tắc bất khả nhượng — từ ý tưởng đến pixel

**G01 · Không trùng **ý tưởng trải nghiệm**.** Mỗi POI có một câu hứa bằng 1 câu (người chơi sẽ nhận ra / lựa chọn / khám phá điều gì), tối đa 3 từ khóa silhouette và một đặc trưng không thể chuyển sang POI khác. **Gate:** so ảnh không chữ với hai POI cùng nhóm; nếu tráo nhãn không ai nhận ra => FAIL.

**G02 · Địa hình GOLD là căn nguyên kiến trúc.** Bất kỳ cầu, bờ, đá, hồ, đèo, cồn cát, vách, đập phải nằm đúng nguồn địa hình. Vẽ sàn trên nước phải thể hiện trụ và độ cao nhưng không đổi semantic GOLD. **Gate:** đối chiếu bản đồ nguồn + ảnh 1x + collision; nguồn không đổi.

**G03 · Kiến trúc có *nguyên nhân công năng*.** Trả lời cho mỗi phòng/sàn/giếng/thang: ai xây, để làm gì, tại sao ở đây, dùng ra sao, điều gì đã xảy ra. Không dựng hầm, cầu treo, bậc cao chỉ để tăng số tầng. **Gate:** bản đồ luồng vật liệu/người/nước hoặc nghi lễ ghi rõ trên mặt bằng.

**G04 · Một silhouette độc lập ở 1 màn hình.** Cấm POI lớn chỉ hiện đại sân chữ T hoặc 2–3 roof rectangles. Có các khối lớn–vừa–nhỏ, đường chân trời (top-down silhouette), khối không đối xứng và landmark. **Gate:** ảnh sau 3 giây không tên/HUD, người xem phân biệt đúng loại POI.

**G05 · Mạch khám phá có nhịp.** Lối vào→gợi tò mò→phân nhánh/biến cố→reveal→đường trở lại. Site nhỏ chỉ cần 1 mini-loop; site lớn cần 2 hướng khác nhau. **Gate:** playtest 1x không teleport, dùng đúng E qua tầng; người chơi tự tìm được ít nhất một khám phá hình ảnh.

**G06 · Độ cao là vật lý, không phải UI overlay.** Hầm khô có lớp đất/đá phủ thật; tầng trên có support, lan can, bóng đổ, khoảng không nhìn xuống; mọi cầu nối có trụ/neo. **Gate:** chụp tầng 0/-1/1/2, thử return, occlusion, roof fade và các negative cases.

**G07 · Pixel grammar thống nhất SOH.** Giữ grid 16px của engine, pixel-edge cứng, scale/pivot nhất quán, không vẽ sprite pseudo-vector/hình tròn mờ và không tăng chi tiết vượt sprite nền. Tất cả asset F03 R2 mới bị creator bác: phải thay/điều chỉnh, không dùng làm chuẩn. **Gate:** sprite sheet kiểm pixel grid + ảnh game 1x, night/weather và so với asset được duyệt.

**G08 · Màu và chất liệu kể chuyện.** Mỗi POI có 1 dominant vật liệu, 1 phụ, 1 accent có chức năng; bụi/lạnh/nóng/mặn/ẩm ảnh hưởng chất liệu. Cấm lấy một texture gỗ/đá phủ cả sân; cấm màu chỉ làm nhiệm vụ “đổi biome”. **Gate:** material map và highlight shadow cục bộ hợp hướng.

**G09 · Chi tiết theo mật độ có chọn lọc.** Đường trống để thở phải là lối đi có ý nghĩa; props tập trung theo điểm làm việc/quan sát/va chạm, không rải đều. Cùng một sprite không được lặp ấn tượng copy/paste giữa 3 điểm cùng họ. **Gate:** ảnh 1x nhìn được điểm tiêu điểm và lộ ít nhất 3 lớp nhịp chi tiết macro/meso/micro.

**G10 · Môi trường có lịch sử.** Phân nơi còn hoạt động/bỏ hoang/thiêng/nguy hiểm bằng vết sử dụng, đổ vỡ, sửa chữa và cây xâm lấn; không chỉ thêm chữ “old” vào label. **Gate:** người chưa biết tên đoán được trạng thái nơi chốn.

**G11 · Nghĩa Gameplay phải trung thực.** Không tự tạo cửa có khóa chức năng, thuyền cứu hộ, trade, quest, loot, hazard, nghiên cứu có tác dụng khi game chưa có. Nếu chỉ scenery, tín hiệu phải rõ không click được. **Gate:** cross-A0/A3/A8 ownership review và tất cả game interactions có thật được test.

**G12 · Nghiệm thu ở nhiều cấp, không đánh tráo bằng compiler.** Mỗi POI cần 1 overview + entry + focal + interior/upper + return, ngày/đêm/biome, chơi bằng điều khiển thật. So BEFORE/AFTER cùng camera; lưu SHA/seed/coords. **Gate:** 81/81 source IDs, 81/81 scene smoke, full C03 integration, sau đó human visual acceptance. Không khai đạt nếu chưa làm.

**Nguồn kỹ thuật hỗ trợ pixel-perfect (không phải chuẩn canon SOH):** [Unity 2D Pixel Perfect Camera](https://docs.unity.com/en-us/engine/6000.7/manual/unity2d/2d-urp/2d-pixelperfect/prep-sprites), về thống nhất PPU, point filtering và snap-to-pixel. Cần điều chỉnh áp dụng cho engine VEYRA/Godot, không chép nguyên Unity API.

## 2. Thước đo nghiệm thu đề xuất (chưa phải điểm đã chấm)

| Trục | Trọng số | Fail ngay nếu... |
|---|---:|---|
| Bản sắc / khác biệt trong cùng họ | 20 | tráo tên giữa 2 POI không ai nhận ra |
| Vĩ mô địa hình và silhouette | 20 | sân phẳng/hộp vuông chiếm khung hình hoặc địa hình sai |
| Hình khối, lối đi và khám phá | 20 | cầu thang giả, loop vô nghĩa, vùng không tới được |
| Pixel art thống nhất và material | 20 | asset lệch SOH, alias/blur/scale sai, texture tràn lan |
| Kể chuyện công năng / lịch sử | 10 | chỉ có prop tượng trưng, không hiểu công trình hoạt động thế nào |
| Giao diện, thời tiết, tích hợp và QA | 10 | HUD che điểm nhấn, night unreadable, không ghép được C03 thật |

**Thang định tính cho các agent:** DƯỚI CHUẨN <70/100; GIỮ LÀM NỀN 70–84; ỨNG VIÊN FINAL ≥85, nhưng **mọi hard gate vẫn phải PASS**. Các ngưỡng là **đề xuất quyết định**, không phải số đo khoa học hay điểm hiện có. P0/P1/P2 ở bảng dưới là **ưu tiên sửa**, không phải chất lượng đã nghiệm thu.

## 3. 81 POI — đánh giá theo nhóm và theo từng nơi

**Chú giải bằng chứng:** `ẢNH` = có screenshot đại diện trong gói và được mở xem; `SOURCE` = kiến trúc/props có từ mã, còn lỗi mỹ thuật cụ thể là suy luận cần kiểm bằng mắt; `BENCHMARK` = đã xây ở lượt trước nhưng bản thực chưa tái nghiệm thu trên gói tích lũy.

### 01 · Ba mốc chủ lực

**Phản biện cả nhóm:** Mốc chuẩn tương đối, không tự xem là mỹ thuật cuối. Phải bảo vệ bản sắc trước khi các POI vệ tinh Argus, Ironholm lấn át.

#### Greywater Hamlet — `po_greywater` · **P2** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Mốc đối chiếu về cư dân và tầng ngầm; chưa có screenshot mới nhất trong gói 81.

- **Phải thay đổi:** Giữ cấu trúc nhà ở và liên kết nội khu; chỉnh chi tiết sinh hoạt, đường mòn, vật liệu mòn theo sử dụng.

- **Pass riêng:** Người chơi phân biệt được nhà ở, kho và kết nối ngầm mà không cần đọc nhãn.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Argus Academy — `po_academy` · **P1** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Mốc chuẩn đa tầng; nguy cơ quần thể Argus xung quanh trở nên bản sao đơn giản hơn.

- **Phải thay đổi:** Khóa bảng màu/nhịp vật liệu học thuật làm chuẩn cho Observatory, Archive và Hall of Eyes; kiểm tra quan hệ không gian giữa bốn POI.

- **Pass riêng:** Toàn khu Argus đọc thành một di sản nhất quán nhưng mỗi cơ sở có silhouette riêng.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Ironholm Mine — `po_ironmine` · **P1** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Mốc chuẩn công nghiệp–địa chất; nhiều mỏ F03/REST48 có nguy cơ trùng ký hiệu công nghiệp nhưng yếu hơn địa hình.

- **Phải thay đổi:** Tái dùng quy tắc đá cắt, chống đỡ, bụi, ánh sáng và độ nguy hiểm có căn cứ; không sao chép nguyên bố cục mine.

- **Pass riêng:** Nhìn đường địa chất và công trình mỏ liên hệ thật, không thành kho hàng.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

### 02 · H01: khu cư trú

**Phản biện cả nhóm:** Ba mô hình cư trú phải có khác biệt địa hình, lịch sử và quy tắc sinh hoạt; công trình dân sinh không biến thành nhà máy/cảng.

#### Hook Village — `po_hook` · **P2** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** H01 đã có cụm nhà và tầng ngầm; nguy cơ Hook Mere/Hook Evac trông rời rạc.

- **Phải thay đổi:** Thống nhất nếp xây nhà, bờ hồ, vật liệu gỗ, đường dân cư với POI lân cận.

- **Pass riêng:** Từ làng đi sang bến và điểm sơ tán thấy chuyển tiếp vật liệu/nhân sinh hợp lý.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Mirage Camp — `po_oasis` · **P2** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Điểm cư trú khô hạn cần tương phản rõ với Cinder và các hạ tầng công nghiệp.

- **Phải thay đổi:** Giữ công năng nước, bóng râm, chống cát; ưu tiên chất liệu vải/đá khô và không gian trú.

- **Pass riêng:** Nhìn ra nơi ở dựa vào nguồn nước, không giống trại hàng thông thường.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Cinder Camp — `po_cindercamp` · **P1** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Đã có đa tầng; khó phân biệt với các POI công nghiệp tro/lò nếu dùng cùng mái và sân.

- **Phải thay đổi:** Giữ dấu vết sinh tồn ở đất nóng: cách nhiệt, che bụi, đường thoát; đối chiếu với Ember Watch và Sulfur Works.

- **Pass riêng:** Trại sinh tồn chứ không biến thành nhà máy thứ hai.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

### 03 · F02/C03: bến chức năng

**Phản biện cả nhóm:** Cầu nước đúng nhưng không tự trở thành POI thú vị. Phân trục hành khách, hàng hóa, bờ trú gió, ngư dân hồ.

#### Strait Landing — `po_strait` · **P1** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** C03 v2 có nhiều lớp và cầu hàng nhưng silhouette mảng mái/giàn còn công nghiệp chung.

- **Phải thay đổi:** Tối ưu tuyến hành khách đối lập tuyến hàng; cầu tàu có kết cấu đỡ, kéo nâng, khung hàng; làm nhẹ nhịp sàn trên cao.

- **Pass riêng:** Người chơi tự chọn hai hướng tiếp cận bến rồi hiểu nơi chúng giao nhau.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Southfoot Landing — `po_southfoot` · **P1** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Trú bão và đê chắn sóng cần ngoại lực thời tiết; ảnh trước thiên về mái/sân khối cứng.

- **Phải thay đổi:** Phân cao độ bờ thật, cọc chắn gió, muối ăn mòn và đường ngắm biển; không dùng cầu giống cảng sông.

- **Pass riêng:** Cảm nhận rõ lối trú gió→bờ phơi lộ và đường quay về.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Hook Mere Pier — `po_mere` · **P1** · BENCHMARK / SOURCE

- **Hiện trạng/vấn đề:** Bến hồ có vòng gác–giàn gỗ; nếu quá nhiều tháp/giàn sẽ làm mất chất dân sinh.

- **Phải thay đổi:** Giữ tỷ lệ nhỏ, vật liệu địa phương, mạng lưới lau sậy; bảo toàn cảm giác nước ngọt và nghề cá.

- **Pass riêng:** Bến hồ thân mật, dễ ghi nhớ mà không trông như cảng thu nhỏ.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

### 04 · F02/C04: bến ven nước nhỏ

**Phản biện cả nhóm:** Kiểm chứng hư hại, vách chim, bờ kè dân cư là địa hình, không phải lặp skywalk.

#### Westbank Landing — `po_westbank` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Bến dân cư đang có bơm triều/hầm/giàn; nguy cơ mang nguyên vết công nghiệp của C03.

- **Phải thay đổi:** Định hình bờ dân cư, bậc kè và nhà nhỏ không đồng kích cỡ, khu công khai sát khu vận tải.

- **Pass riêng:** Có thể nhìn một góc và phân biệt tuyến người đi với tuyến hàng.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Drowned Pier — `po_dpier` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Mấu chốt là nhịp cầu mất; nếu khoảng trống chỉ như hố game thì cảnh đổ vỡ không thuyết phục.

- **Phải thay đổi:** Thể hiện thanh giằng gãy, sàn lệch, trụ sót, dấu sóng/mòn; buộc đường vòng nhận diện được từ mặt đất.

- **Pass riêng:** Đứt nhịp có nguyên nhân vật lý và người chơi hiểu đường thay thế.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Tern Hut Pier — `po_gullpier` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Bến Tern nhỏ có tuyến cao; rủi ro quá công trình hóa nơi chim biển.

- **Phải thay đổi:** Giảm mật độ cầu thép, bổ sung địa hình tổ chim/đường chân vách; chòi quan sát thấp và vải gió.

- **Pass riêng:** Cảm giác bến nghiên cứu chim biển, không là tháp cảnh giới khác.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

### 05 · F02/C01: thành phố cảng

**Phản biện cả nhóm:** Khối đô thị, đường phố, viễn cảnh, độ dày mô-đun và mặt đứng phải vượt nhà kho đơn lẻ.

#### Gulfhead — `po_gulfhead` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh cho thấy mảng mái/chợ gỗ lớn và đường phố dạng dải; chức năng đô thị có nhưng hình khối chưa đủ nhịp.

- **Phải thay đổi:** Phân phố thành bậc mặt đứng, hẻm, khối nhà nhiều kích cỡ; cho thấy ranh giới công cộng/hoạt động cảng.

- **Pass riêng:** Từ cửa phố tới bến có ba cảnh quan liên tiếp khác nhau và điểm định hướng thị giác.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Westmouth — `po_westmouth` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh street còn trống; đường sông–phố chưa có mật độ và dấu ấn cửa sông rõ.

- **Phải thay đổi:** Nén khối nhà, chợ ven lạch, cầu thuế và hẻm; thể hiện vị trí hai dòng nước gặp nhau.

- **Pass riêng:** Bến cửa sông không thể nhầm với Gulfhead hay Saltwick.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Saltwick Harbor — `po_saltharbor` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh bến và chợ có vật liệu đồng màu; chưa kể được chu trình muối từ nước mặn tới hàng hóa.

- **Phải thay đổi:** Tạo chuỗi cống triều→bể cô đặc→sân phơi→kho→thị trường, phối vật liệu muối khô/ẩm.

- **Pass riêng:** Đi dọc tuyến công năng hiểu được vì sao Saltwick tồn tại.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

### 06 · F02/C02: hậu cần công nghiệp

**Phản biện cả nhóm:** Thể hiện dòng vật liệu công nghiệp từ nguồn tới cảng và vai trò nước; tránh mọi cảng công nghiệp giống giàn gỗ C03.

#### Ironholm Harbor — `po_ironharbor` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Cảng quặng cần mật độ kết cấu công nghiệp; bộ cầu sàn dễ thành bản sao C03.

- **Phải thay đổi:** Ưu tiên silhouette cầu trục lớn, kết cấu chịu tải, băng chuyển hàng và bụi quặng; nhất quán với Ironholm Mine/Depot.

- **Pass riêng:** Cảng quặng nhìn từ 1 màn hình đã khác cảng thương mại.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Emberport — `po_ember` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Emberport dễ trùng Slagworks và Sulfur Works ở màu nóng/sàn thép.

- **Phải thay đổi:** Thể hiện đường tro xỉ và bến nước tách khỏi quá trình luyện; tạo vật liệu bị nhiệt ăn mòn, lối vận chuyển an toàn.

- **Pass riêng:** Nhìn thấy cảng hậu cần nhiệt, không phải một xưởng lò được đặt cạnh nước.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

#### Sandgate — `po_sandgate` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Cảng cửa sông dễ trùng Westmouth nếu chỉ đổi công cụ hàng hóa.

- **Phải thay đổi:** Tạo hệ cống, cửa điều tiết, kho khô, đường cát/lũ và điểm kiểm soát luồng.

- **Pass riêng:** Sandgate nhận diện bằng cơ chế thủy văn và luồng hàng, không chỉ bằng biển tên.

- *Dấu vết kỹ thuật:* Cần kiểm nghiệm thu lại trong bundle tích hợp thật.

### 07 · F03: 15 công nghiệp/hạ tầng (đã remake nhưng art bị bác)

**Phản biện cả nhóm:** Vấn đề trọng tâm: source còn 5 factory funcs lặp theo nhóm, ảnh R2 cho thấy bề mặt gạch/sàn đều. Toàn bộ sprite bổ sung của F03 R2 bị người chủ sản phẩm từ chối, không tái sử dụng làm chuẩn.

#### Falls Powerhouse — `po_falls` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh remake còn sân đá/sàn lặp lớn; logic intake→turbine chưa thành biểu tượng công trình từ mặt đất.

- **Phải thay đổi:** Đặt cửa nước, bánh tuabin, dòng chảy, rãnh tràn và cầu kiểm tra có độ cao/độ ướt thật; thay asset F03 bị loại.

- **Pass riêng:** Nhìn vào một khung hình hiểu được hướng nước đi và vì sao máy phát hoạt động.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 12 khu/phòng · 9 props source.

#### Greywater Pumphouse — `po_pumphouse` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Cùng hàm f03Water với Falls; đổi vài nhánh/prop chưa đủ để thành trạm bơm riêng.

- **Phải thay đổi:** Lấy các tuyến ống áp lực/bể hút/giàn van làm tâm; bớt hình học giống thủy điện, tăng định hướng hồ.

- **Pass riêng:** Đặt hai ảnh Falls/Pumphouse cạnh nhau không thấy cùng footprint máy.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 12 khu/phòng · 10 props source.

#### Old Pumping Plant — `po_oldpump` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Bố cục cùng f03Water; trạng thái bỏ hoang chỉ có ít props ống gỉ/rubble.

- **Phải thay đổi:** Dựng lịch sử xuống cấp: ống nứt, máy dừng, sàn mất, dấu nước cao cũ; khác tuyệt đối nhà máy đang chạy.

- **Pass riêng:** Không cần đọc tên vẫn nhận ra nhà máy bỏ hoang.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 12 khu/phòng · 10 props source.

#### Aion Edge Sawmill — `po_sawaion` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh sawmill sau remake là dải gỗ ngang lặp dài, dây chuyền chưa đọc thành xưởng cưa.

- **Phải thay đổi:** Vẽ xe nạp thân cây, ray dẫn, lưỡi cưa, đường mùn cưa, kho xếp theo chu trình, đổi mái khối lớn.

- **Pass riêng:** Từ sân vào xưởng nhìn thấy log→saw→board→stack.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 11 khu/phòng · 11 props source.

#### Mossbrook Mill — `po_mill` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng template timber, dù ý định có cối nước và xay; chức năng xay khác xưởng cưa chưa nổi.

- **Phải thay đổi:** Lấy bánh nước/cối xay và sàn bột/ngũ cốc làm trung tâm; đường ống/cống và hạt rơi thay ray gỗ.

- **Pass riêng:** Không thể nhầm Mossbrook với Aion Edge.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 11 khu/phòng · 12 props source.

#### Verdant Timberyard — `po_timberyard` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Kho gỗ không cần tầng phụ hoặc nhà máy giả; bản hiện vẫn cùng nhịp sàn ván của xưởng cưa.

- **Phải thay đổi:** Xây trục đo/xếp gỗ ngoài trời, bó gỗ các độ dài, bãi xe, dải trống phục vụ xe kéo; tránh mái liên tục.

- **Pass riêng:** Nhìn từ trên cao rõ thứ tự đo, phơi và phân loại gỗ.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 11 khu/phòng · 13 props source.

#### Fracture Quarry — `po_fracquarry` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh người chơi trước đây cho thấy quarry dễ thành sân đá/cầu sàn; bản R2 có bench nhưng vẫn lộ texture lặp.

- **Phải thay đổi:** Đổi nền thẳng thành mặt cắt vỉa đá nhiều lớp, đường khai thác xoắn theo độ cao, dấu nổ/khối vỡ và vật liệu bụi.

- **Pass riêng:** Tại 1x nhìn rõ ít nhất ba tầng địa chất, không cần overlay chữ.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 11 khu/phòng · 12 props source.

#### Greyback Quarry — `po_greyquarry` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** R2 dùng cùng f03Quarry với Fracture; riêng nhánh gravel screening còn ít.

- **Phải thay đổi:** Địa hình đá sáng/xám, sàng sỏi nhiều nhịp, bãi vụn theo cỡ hạt và đường xe vận chuyển.

- **Pass riêng:** Đặt cạnh Fracture, khác ở màu địa tầng và cách khai thác.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 12 khu/phòng · 12 props source.

#### Obsidian Quarry — `po_obsq` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Mỏ obsidian cần tạo cảm giác vật liệu núi lửa; hiện chung footprint stone quarry.

- **Phải thay đổi:** Tạo mặt cắt đá kính đen, vệt nứt sắc, đống mảnh có cạnh hướng thống nhất; làm rõ tương phản an toàn/nguy hiểm bằng hình.

- **Pass riêng:** Obsidian khác hai quarry ngay ở silhouette và hệ màu, không chỉ tô đen tile.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 12 khu/phòng · 12 props source.

#### Charcoal Kilns — `po_kilns` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh sau remake cho thấy các bệ lò vuông đều, chưa giống lò than với bộ phận dẫn khí.

- **Phải thay đổi:** Bố trí lò vòm/lò gạch có ống khói, cửa nạp, bãi phơi củi, đống than/sườn tro; vật liệu nóng→nguội khác nhau.

- **Pass riêng:** Có thể đọc chu trình củi→nung thiếu oxy→lấy than bằng hình ảnh.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 9 khu/phòng · 10 props source.

#### Slagworks Foundry — `po_slag` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Bản lò/cầu công tác có nguy cơ giống Emberport, thiếu khối nhiệt nặng và cao độ sản xuất.

- **Phải thay đổi:** Đặt lò cao, đường cấp liệu, kênh xỉ, bãi làm nguội, vật liệu rỉ/khói như một hệ thống thống nhất.

- **Pass riêng:** Nhìn là lò luyện, không phải khu nhà kho/cảng.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 11 khu/phòng · 11 props source.

#### Sulfur Works — `po_sulfur` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Khu lưu huỳnh dùng phần khung f03Process; nguy cơ chỉ đổi màu vàng.

- **Phải thay đổi:** Thể hiện retort kín, ống ngưng tụ, bồn thu và lớp cặn kết tinh; đọc rõ vùng kín/thoáng qua vật liệu.

- **Pass riêng:** Phân biệt nhà máy hóa chất với lò than và slagworks.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 10 khu/phòng · 11 props source.

#### Grain Silo Complex — `po_siloc` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Cao độ tới tầng 2 nhưng có ít đạo cụ; mái/sàn đơn giản không chứng minh silo có độ cao.

- **Phải thay đổi:** Thiết kế các trụ silo lớn/đỉnh phễu, máng đổ hạt, thang cứu hộ ngoài thân và ống xả; tầng cao nhìn thấy cơ cấu xả.

- **Pass riêng:** Ngay trên mặt đất đã thấy ống silo và dòng vật liệu lên cao.

- *Dấu vết kỹ thuật:* Tầng `0,1,2` · 9 khu/phòng · 4 props source.

#### Delta Sluice & Filter Station — `po_filter` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh F03 remake: mảng sàn đá hình chữ thập xen nước/đất, thiếu đường đi của nước và phân ô chức năng.

- **Phải thay đổi:** Xây bể lắng có lòng nước thật, cấp nước bẩn→lọc→đầu ra sạch, cầu bảo trì mảnh, van và đo mẫu; tránh sàn lát kín.

- **Pass riêng:** Người chơi nhận ra trạm lọc không cần tên, quan sát được chu trình nước.

- *Dấu vết kỹ thuật:* Tầng `-1,0,1` · 9 khu/phòng · 5 props source.

#### Geothermal Station — `po_geo` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Geothermal dùng khối công nghiệp chung, chưa thấy áp lực hơi và địa nhiệt bám địa hình.

- **Phải thay đổi:** Thiết kế giếng địa nhiệt, đường ống bọc nhiệt, manifold hơi, dàn ngưng tụ, vent có dấu địa hình nóng; bớt hành lang vô cớ.

- **Pass riêng:** Cảm nhận được trạm khai thác hơi dưới đất, không phải nhà máy nhiệt bất kỳ.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 8 khu/phòng · 5 props source.

### 08 · REST48/ARCHIVE (5 POI, nhóm làm việc)

**Phản biện cả nhóm:** Các chức năng học thuật/đài quan sát/tín hiệu bị gom trong một hàm `archive()`; phân loại hiện chưa phù hợp. Nên tách công năng và hình khối trước khi đổi art.

#### Argus Observatory — `po_observatory` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: một sân đất chữ thập rất lớn, không có công trình quan sát đọc được ở điểm xuất hiện. Source archive dùng khung hàn lâm chung.

- **Phải thay đổi:** Thiết kế lại theo đài thiên văn đặc hữu: mái vòm/khe quan sát, sân đo thiên, tháp dụng cụ, lối nhìn bầu trời, khung đá cổ.

- **Pass riêng:** Ở 1x đầu vào thấy đài thiên văn dù tắt nhãn; đường lên telescope hợp lý.

- *Dấu vết kỹ thuật:* Tầng `0,1,2` · 7 khu/phòng · 6 props source.

#### Argus Archive Vaults — `po_archive` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Source archive dùng chung hall + office và thêm 1 tầng kho; hiện dễ thành trường học nhỏ.

- **Phải thay đổi:** Hạ tầng lưu trữ đặc hữu: giá sách theo cụm, đường kiểm soát, trục xuống vault kín, các lớp niêm phong/ẩm.

- **Pass riêng:** Người chơi nhận ra kho tri thức bị giới hạn tiếp cận, không chỉ phòng học có thang.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 6 khu/phòng · 6 props source.

#### Hall of Eyes — `po_hall_eyes` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Nguồn dùng cùng hall/office với đài quan sát và Lantern; nghi lễ không có dấu thị giác đủ mạnh.

- **Phải thay đổi:** Bố cục nghi lễ bất đối xứng, vòng cột, oculus/biểu tượng ánh sáng, nhịp tối–sáng, tâm nhìn không thành sân đất ngang.

- **Pass riêng:** Một ảnh không chữ phải truyền tải sự linh thiêng/ám ảnh riêng của Hall of Eyes.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 6 khu/phòng · 5 props source.

#### Lantern Light — `po_lantern` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Bị nhóm ARCHIVE kéo vào công thức hội trường/hồ sơ; concept lại là tháp hải đăng.

- **Phải thay đổi:** Tách khỏi nhà học thuật; tháp thanh mảnh với chân chịu gió, buồng đèn và đường lên đồng nhất.

- **Pass riêng:** Silhouette tháp sáng độc lập và tín hiệu nhìn được từ đường tiếp cận.

- *Dấu vết kỹ thuật:* Tầng `0,1,2` · 7 khu/phòng · 6 props source.

#### Lantern Cove Station — `po_lanternstn` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng họ archive dù chức năng là trạm liên lạc; chỉ một tầng và vài props.

- **Phải thay đổi:** Làm đài/ăng-ten, hộp truyền, thùng pin, đường dây về cove; mái nhỏ có tính kỹ thuật.

- **Pass riêng:** Không nhầm với phòng đọc hay nhà canh.

- *Dấu vết kỹ thuật:* Tầng `0` · 5 khu/phòng · 4 props source.

### 08 · REST48/SIGNAL (4 POI, nhóm làm việc)

**Phản biện cả nhóm:** Một hàm `signal()` đang đại diện radio tower, beacon, fire watch và coast light: bốn hệ vật lý khác nhau. Không chấp nhận cùng khối tháp đổi biển.

#### Kestrel Radio Tower — `po_kestrel` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: nhà/đường ngang lớn, cột radio không chiếm silhouette; 3 tầng trong source nhưng thiếu trục thẳng đứng thuyết phục.

- **Phải thay đổi:** Cột mast có dây neo, bệ, anten, nguồn điện và cabin; tầng cao là giàn leo trụ chứ không mái phòng vuông.

- **Pass riêng:** Từ xa đọc đúng trạm phát sóng và trục leo.

- *Dấu vết kỹ thuật:* Tầng `0,1,2` · 7 khu/phòng · 3 props source.

#### Beacon Rock Light — `po_beacon` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Source signal dùng template tower chung, trong khi có reservation helicopter MGP-D07 phải giữ trống.

- **Phải thay đổi:** Đài hải đăng bám vách đá thật, cầu thang dọc vách, đèn xoay, sân hạ cánh/neo được chừa rõ; tránh chồng zone.

- **Pass riêng:** Không xâm phạm ô [541..546,1301..1306], thấy beacon và bãi reserved có quan hệ hợp lý.

- *Dấu vết kỹ thuật:* Tầng `0,1,2` · 7 khu/phòng · 3 props source.

#### Ember Watch — `po_emberwatch` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng signal template với radio và hải đăng, chưa khác bằng phương thức quan sát cháy.

- **Phải thay đổi:** Tháp kiểm soát cháy rừng với tầm nhìn theo rặng cây, bồn nước/phòng dụng cụ, dáng tháp gỗ/đá chịu nhiệt.

- **Pass riêng:** Biết đây là watch cháy/rừng chứ không phải trạm anten.

- *Dấu vết kỹ thuật:* Tầng `0,1,2` · 7 khu/phòng · 3 props source.

#### Saltwick Light — `po_saltlight` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Source signal rút bớt tầng nhưng vẫn dùng mẫu trạm phát.

- **Phải thay đổi:** Dựng hải đăng dẫn luồng nhỏ, móng bờ cát, tầng bảo trì và lối nhìn biển; gắn Saltwick Harbor.

- **Pass riêng:** Ngọn đèn là mốc dẫn luồng, không là kiosk dân cư.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 6 khu/phòng · 2 props source.

### 08 · REST48/RUPTURE (5 POI, nhóm làm việc)

**Phản biện cả nhóm:** Một hàm `rupture()` lo khe nứt địa chất, cầu cạn gãy, sân ga và hai xác tàu. Đây là nhóm dễ lộ “reskin” nhất; cần thiết kế biến cố vật lý riêng.

#### Typhon's Fracture — `po_typhon` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: người chơi đứng trên giao lộ nâu lớn; đường nứt địa chất không hiện lên là yếu tố chủ đạo.

- **Phải thay đổi:** Làm khe nứt đứt lớp đá, vách chênh độ cao, đổ nát đổ theo cùng một vector lực, lối men mép có nguy cơ rõ mà không bịa hazard.

- **Pass riêng:** Ngay khi vào thấy đất bị xé làm đôi, không phải sân khu dân cư.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 5 khu/phòng · 4 props source.

#### Crushed Viaduct — `po_viaduct` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Source rupture chung khung đường đá và chòi, không chứng minh cầu cạn bị nghiền nát.

- **Phải thay đổi:** Nhịp cầu gãy có trụ đỡ, rãnh sâu, đầu cầu lệch và đường vòng thực sự men mép.

- **Pass riêng:** Nhìn đầu cầu từ xa hiểu chỗ mất nhịp và lối qua khả thi.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 5 khu/phòng · 4 props source.

#### Shattered Freight Yard — `po_freightyard` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Cùng khuôn đường phế tích; xe hàng props ít nên không giống sân ga đổ nát.

- **Phải thay đổi:** Tạo các ray chạy song song rồi lệch/gãy, nhà ga thấp, toa xe kẹt, đường bốc dỡ và nguồn va đập.

- **Pass riêng:** Một ảnh đủ nhận ra bãi đường sắt hàng hóa hỏng.

- *Dấu vết kỹ thuật:* Tầng `0` · 5 khu/phòng · 4 props source.

#### Wreck Isle Salvage — `po_wreck` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Source rupture + boat_hull prop; bản sắc tàu mắc cạn chưa thành hình khối chính.

- **Phải thay đổi:** Vẽ cấu trúc thân tàu theo trục, gãy boong, sườn tàu, lối lách qua khoang và bãi cứu hộ theo sóng.

- **Pass riêng:** Người chơi đang khám phá con tàu bị đắm, không chỉ hai chòi cạnh cái thuyền.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 5 props source.

#### Gull Isle Wreck — `po_gullwreck` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng template với Wreck Isle, chỉ có vị trí prop khác.

- **Phải thay đổi:** Dáng tàu/độ hỏng khác Wreck Isle, va đập sóng lộ đá, xác tàu tản mảnh theo bờ.

- **Pass riêng:** Hai vụ đắm không thể hoán đổi ảnh mà không ai nhận ra.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 5 props source.

### 08 · REST48/WAY (6 POI, nhóm làm việc)

**Phản biện cả nhóm:** Hàm `way()` thiên về đường giao chữ T và hai nhà chờ. Phải biến đường đi thành hệ địa hình có nguyên nhân.

#### Confluence Waystation — `po_confluence` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Source way dùng ngã tư đá dài + hai chòi; điểm ngã ba hợp lưu chưa có dấu thủy văn.

- **Phải thay đổi:** Cho thấy đường sông hợp lưu, điểm nghỉ tránh lũ, cọc báo nước, tuyến bộ men bờ có lý do.

- **Pass riêng:** Từ ngã rẽ thấy được sông và quyết định hướng đi.

- *Dấu vết kỹ thuật:* Tầng `0` · 5 khu/phòng · 3 props source.

#### Ridge Pass Station — `po_ridgestop` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Template WAY dễ xóa đặc tính gió/núi vì dùng sân đá như trạm nghỉ đồng bằng.

- **Phải thay đổi:** Đặt đường vào theo yên ngựa/nếp đèo, đá chắn gió, nhà nửa chìm và vọng gác nhìn dốc.

- **Pass riêng:** Nhìn ảnh nhận ra đang ở một đèo cao.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 6 khu/phòng · 4 props source.

#### Rapids Portage Hut — `po_rapids` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Template WAY với nhà chờ tạo cảng khô nhưng chưa làm rõ vì sao phải kéo thuyền qua thác.

- **Phải thay đổi:** Đường portage vòng chướng ngại nước, bãi kéo thuyền, con lăn gỗ, dấu bào mòn sát nước.

- **Pass riêng:** Đọc được tuyến tránh ghềnh mà không có boat gameplay.

- *Dấu vết kỹ thuật:* Tầng `0` · 5 khu/phòng · 3 props source.

#### Westwood Hamlet — `po_westwood` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Dùng khung ngã tư WAY nên làng nhỏ dễ như trạm giao thông.

- **Phải thay đổi:** Tổ chức nhà ở quanh con đường rừng tự nhiên, vườn nhỏ, mái gỗ nhiều tuổi, lối mòn dẫn tới rìa rừng.

- **Pass riêng:** Thấy đời sống dân cư khác hẳn điểm nghỉ chân.

- *Dấu vết kỹ thuật:* Tầng `0` · 8 khu/phòng · 4 props source.

#### Bone Road Waystation — `po_bonestop` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Source WAY gần như mẫu chung, chỉ thay bone props.

- **Phải thay đổi:** Tạo hình xương hóa thạch ven đường và mái trú bé; trọng tâm là cảnh quan xương + tuyến đường nguy hiểm.

- **Pass riêng:** Ngã nghỉ đáng nhớ nhờ địa hình xương, không nhờ chữ Bone.

- *Dấu vết kỹ thuật:* Tầng `0` · 5 khu/phòng · 3 props source.

#### Threshold Gate — `po_gate` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Khung WAY với tháp gác 1 tầng chưa đủ thể hiện một cổng ranh giới.

- **Phải thay đổi:** Làm mốc ranh giới lớn có hai hướng tiếp cận, cột/trụ đối xứng hoặc đổ nát, dấu lối bị khóa/đã mở rõ.

- **Pass riêng:** Qua cổng là chuyển cảnh quan và cảm giác địa lý thật, không chỉ chòi cạnh ngã tư.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 6 khu/phòng · 4 props source.

### 08 · REST48/WILD (7 POI, nhóm làm việc)

**Phản biện cả nhóm:** Hàm `wild()` đang phục vụ rừng thiêng, glade, khu khảo sát và cả mỏ Ironvein. Đây là dấu hiệu sai grammar lớn.

#### Ranger Hut — `po_ranger` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng hàm WILD với Research/Mine; căn chòi rừng và tầng nhìn chưa đủ khác.

- **Phải thay đổi:** Chòi kiểm lâm bám cây, bệ quan sát có đường nhìn, dấu tuần tra và đường mòn thú (chỉ art nếu chưa gameplay).

- **Pass riêng:** Từ vị trí cao đọc được rìa rừng/đường tuần tra.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 4 khu/phòng · 3 props source.

#### Mosslight Glade — `po_glade` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: mảng lát gỗ cực lớn lấp gần toàn màn hình ở một địa điểm được gọi là rừng trống. Đây là lỗi loại vật liệu và tỷ lệ.

- **Phải thay đổi:** Xóa sân gỗ đại trà; tạo vùng cỏ/rêu/phủ lá, bóng tán cây, thảm đá ẩm và cây cổ thụ; đường là nền đất bị giẫm.

- **Pass riêng:** Tắt tên HUD vẫn nhận ngay một glade tự nhiên, không phải sân bến.

- *Dấu vết kỹ thuật:* Tầng `0` · 2 khu/phòng · 3 props source.

#### Sap Grove — `po_sapgrove` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Source WILD dùng đường mòn gấp khúc giống Glade/Ranger, props thể hiện lấy nhựa chưa đặc thù.

- **Phải thay đổi:** Thể hiện vết chích cây, ống hứng, xô nhựa, đường tập kết theo cây khác nhau, không lát cả đường bằng gỗ.

- **Pass riêng:** Biết đây là rừng khai thác nhựa qua cây và dấu nghề nghiệp.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 3 props source.

#### Heart of the Elderwood — `po_elderwood` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Source thánh địa chỉ dùng vòng mở + sundial; khó xứng với trung tâm rừng cổ.

- **Phải thay đổi:** Dựng một cây Elderwood khổng lồ tạo kiến trúc tự nhiên: rễ lớn, hốc thân, tán, nhánh bắc qua lối; không dựng pháo đài.

- **Pass riêng:** Cây cổ thụ là silhouette chiếm ưu thế, người chơi phải đi quanh rễ để thấy lối khác.

- *Dấu vết kỹ thuật:* Tầng `0` · 2 khu/phòng · 3 props source.

#### Meridian Research Station — `po_meridian` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Nằm trong template WILD với Ranger, ngôn ngữ nghiên cứu dễ chìm trong rừng.

- **Phải thay đổi:** Thiết bị đo/quan sát gắn GOLD, cabin nghiên cứu, dấu hiệu chọn mẫu, đường tới cache Meridian.

- **Pass riêng:** Địa điểm nghiên cứu khoa học khác chòi kiểm lâm.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 4 khu/phòng · 3 props source.

#### Ironvein Mine — `po_ironvein` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Mine được nhét vào hàm WILD (chòi rừng + đường mòn + hầm ngắn), tức sai grammar ngay từ source.

- **Phải thay đổi:** Tách thành nhánh địa chất với portal khoét vách, chống lò, tuyến quặng, điểm an toàn và cache foreman.

- **Pass riêng:** Nhìn thấy mỏ, không phải trại kiểm lâm với cửa hầm.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 5 khu/phòng · 4 props source.

#### Fish Camp — `po_fishcamp` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Dùng WILD; ven nước và hoạt động cá chưa đủ hiện hình ở trung tâm.

- **Phải thay đổi:** Làm bãi cát/đất sát nguồn nước, lưới phơi, dấu xử lý cá, lán nhỏ đúng tỷ lệ.

- **Pass riêng:** Không nhầm với chòi kiểm lâm.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 4 props source.

### 08 · REST48/CRYPT (4 POI, nhóm làm việc)

**Phản biện cả nhóm:** Hàm `crypt()` khiến Necropolis, Dune Tombs, Cairns và First Fire chia sẻ sân nghi lễ. Cần bốn thời kỳ/văn hóa/kỹ thuật xây dựng riêng.

#### Necropolis of the Hollow Sun — `po_necropolis` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: sân đất chữ T rộng, thiếu silhouette mộ, tượng, cột nghi lễ; source chỉ 4 khu.

- **Phải thay đổi:** Thiết kế nghĩa địa cổ theo trục hành lễ, các cụm tháp mộ/vòm khác thời kỳ, lối xuống ossuary, vật liệu đá phong hóa.

- **Pass riêng:** Không hiện tên vẫn nhận ra đại necropolis và có thứ tự tiến sâu.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 4 khu/phòng · 3 props source.

#### Dune Tombs — `po_tombs` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Source dùng đúng crypt() như Necropolis; hầm hai phòng không có cá tính sa mạc.

- **Phải thay đổi:** Làm lối vào chìm dưới cồn cát, hành lang bóp mở, dấu bị cát lấp và phòng mộ nhỏ rẽ nhánh.

- **Pass riêng:** Người chơi thấy áp lực cát và tính bí mật ngay trên lối xuống.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 4 khu/phòng · 3 props source.

#### Sunken Cairns — `po_cairns` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng template crypt, trong khi cấu trúc cairn cần vòng đá nhỏ thay vì nhà ngưỡng cửa lớn.

- **Phải thay đổi:** Dựng vòng đá rời, gò sụt, ụ mộ cao thấp; chỉ một hốc ngầm nếu có, không thêm hầm hàng loạt.

- **Pass riêng:** Cảm giác mộ tiền sử khác lăng mộ xây đá.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 4 khu/phòng · 3 props source.

#### Foundry of the First Fire — `po_surtur` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Foundry of First Fire đang nằm trong CRYPT: source chỉ thay than và rim, không có cổ lò/không gian lửa độc nhất.

- **Phải thay đổi:** Thiết kế di tích lò thần thoại: bệ đúc cổ, ống dẫn khí/tường xỉ hóa thạch, tượng đổ, trục nghi thức; tránh bản sao Charcoal Kilns.

- **Pass riêng:** Nhìn phải thấy một di tích lò cổ siêu quy mô, không phải xưởng nung hiện đại.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 3 props source.

### 08 · REST48/COAST (5 POI, nhóm làm việc)

**Phản biện cả nhóm:** Hàm `coast()` gần như một khuôn bờ đi + hut + drying beds. Cần tạo bờ triều, vách, sườn đảo và ruộng muối theo vật lý riêng.

#### Tidepool Fishing Camp — `po_tidecamp` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Cùng template COAST với Saltpans/Kelp, lối ra nước thường thành sân gỗ đều.

- **Phải thay đổi:** Thiết kế mực triều, vũng triều và giá cá thấp; lều chỉ chiếm một phần nhỏ.

- **Pass riêng:** Bản đồ thể hiện bờ thay đổi khi nước rút, không phải bãi gỗ cố định.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 3 props source.

#### Seabird Nesting Cliffs — `po_gullnest` · **P0** · SOURCE

- **Hiện trạng/vấn đề:** Đường biển và loft trong code không diễn đạt vách đá/nơi chim làm tổ, rủi ro chòi cao đơn giản.

- **Phải thay đổi:** Vách đá dựng tầng, gờ chim, tổ, đường đi nghiên cứu nằm men mép với bóng cao độ.

- **Pass riêng:** Hình khối vách đá chứ không nhà gỗ mới là yếu tố chính.

- *Dấu vết kỹ thuật:* Tầng `0,1` · 4 khu/phòng · 3 props source.

#### Gull Net Camp — `po_netcamp` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Source COAST lặp Tidecamp và Kelp, loft không được xây trong bản kế hoạch REST48.

- **Phải thay đổi:** Giàn phơi lưới tạo nhịp xuyên sáng, kho dụng cụ thấp, đường lên gió và đường vận chuyển cá.

- **Pass riêng:** Nhận ra Gull Net Camp nhờ lưới và gió biển.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 3 props source.

#### Salt Pans — `po_saltpans` · **P0** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: mặt sân gỗ/cát lớn ngay sát nước, chưa thấy nhiều ô bốc hơi với ranh nước–muối rõ.

- **Phải thay đổi:** Dựng dãy bể cạn hình học đúng hoạt động: nước thô→nước mặn đặc→kết tinh trắng→kho khô; mặt nước cạn, phản sáng và bờ đất.

- **Pass riêng:** Một ảnh phải nhận ra ruộng muối, không cần nhãn Salt Pans.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 3 props source.

#### Kelp Racks — `po_racks` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Source COAST dùng dry-beds gần giống Salt Pans, chỉ thay net_rack.

- **Phải thay đổi:** Giàn phơi tảo/kelp dài nằm trên trụ, bãi ẩm mặn, khoảng cách đi giữa dãy; không lát đất thành sân đóng ván.

- **Pass riêng:** Không nhầm với ruộng muối hoặc giàn lưới cá.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 3 props source.

### 08 · REST48/UTILITY (7 POI, nhóm làm việc)

**Phản biện cả nhóm:** Hàm `utility()` chủ yếu sinh annex và shelf/crate. Những cache nhỏ cần nằm trong công trình mẹ, không nhân thành 7 kho độc lập.

#### Ironholm Depot — `po_ironwh` · **P1** · SOURCE

- **Hiện trạng/vấn đề:** Depot nằm trong UTILITY generic kho hồ sơ, không tương thích tuyến quặng Ironholm.

- **Phải thay đổi:** Dựng phụ kho phân loại theo kích cỡ bao/quặng, ô cân hàng và hướng xe tới cảng/mỏ.

- **Pass riêng:** Depot là mắt xích giữa Mine và Harbor, không phòng giấy tách biệt.

- *Dấu vết kỹ thuật:* Tầng `0` · 4 khu/phòng · 3 props source.

#### Meridian Archive Cache — `po_rc_meridian` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Cache nhỏ dùng utility generic; không cần thêm tầng phụ nếu chỉ để tăng độ sâu.

- **Phải thay đổi:** Gắn hốc hồ sơ/giá lưu thực sự vào khu Meridian, dấu niêm phong/môi trường phù hợp.

- **Pass riêng:** Nhìn ra phần bí mật tự nhiên của trạm nghiên cứu; không hứa hẹn loot chưa có.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 4 khu/phòng · 3 props source.

#### Foreman's Strongbox — `po_rc_ironvein` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Strongbox hiện là annex nhỏ copy utility; thiếu mối quan hệ với Foreman của Ironvein.

- **Phải thay đổi:** Gắn vào lối mỏ/điểm kiểm kho, giữ nhỏ, rõ thẩm quyền chủ quản.

- **Pass riêng:** Có lý do đặt két tại đó, không phải một căn nhà chứa két rải bản đồ.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Kestrel Tower Safe — `po_rc_kestrel` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Safe sử dụng cùng mẫu utility, trong khi trạm sóng có ngôn ngữ máy và ống dây riêng.

- **Phải thay đổi:** Nhỏ gọn trong trạm relay, vỏ máy/ắc quy và cửa bảo trì, không thành tòa nhà thứ hai.

- **Pass riêng:** Không nhầm cache với merchant stall hoặc phòng ngủ.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Falls Dam Vault — `po_rc_dam` · **P1** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: một nhà hộp lớn trên nền trắng bên sân đất; concept dry dam vault chưa nối vật lý với đập.

- **Phải thay đổi:** Hộp khóa nằm chìm vào kết cấu đập, đường ống/van hoặc hộp cơ khí, lối bảo trì men bờ.

- **Pass riêng:** Người chơi thấy đây là một ngách của đập, không một kho nằm cạnh.

- *Dấu vết kỹ thuật:* Tầng `-1,0` · 4 khu/phòng · 3 props source.

#### Sandgate Customs Strongbox — `po_rc_sandgate` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Strongbox customs không có gameplay, rủi ro tạo dấu chức năng thương mại giả.

- **Phải thay đổi:** Tích hợp vào quầy giấy tờ Sandgate, cửa niêm phong và ký hiệu hành chính, giữ lối đi.

- **Pass riêng:** Không hứa sẽ mở khóa/trade nếu hệ Gameplay chưa kết nối.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Saltwick Harbor Safe — `po_rc_salt` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Kho safe tại Saltwick dễ trùng toàn bộ utility generic.

- **Phải thay đổi:** Mài mòn muối, sổ sách, vật liệu cửa chống ẩm và vị trí liền cảng; không tạo kho vô cớ.

- **Pass riêng:** Nhìn biết đây là cache của cảng muối.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

### 08 · REST48/SERVICE (5 POI, nhóm làm việc)

**Phản biện cả nhóm:** Hàm `service()` tạo quầy và điểm tập kết không có chức năng Gameplay. Bề mặt phải trung thực về trạng thái “chỉ kiến trúc”.

#### Gulfhead Trading House [ĐỀ XUẤT] — `po_vend_gulf` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** ID đề xuất, source chỉ tạo shell và marker, chưa có trade.

- **Phải thay đổi:** Giữ quầy như dịch vụ môi trường, tránh HUD bán hàng giả; thống nhất kiến trúc khu thương mại Gulfhead.

- **Pass riêng:** Không gây hiểu lầm rằng có thể giao dịch khi chưa được tích hợp.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Strait Landing Counter [ĐỀ XUẤT] — `po_vend_strait` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** ID đề xuất; quầy cạnh Strait có nguy cơ là một tòa nhà con bê tông lặp mẫu.

- **Phải thay đổi:** Chuyển thành quầy dân dã sát đường, mái che thấp, luồng người khỏi xung đột với hàng hóa.

- **Pass riêng:** Đọc là quầy chờ/tín hiệu, không làm người chơi tưởng có shop.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Westmouth Evac Pier — `po_evac_west` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Evac chỉ có vỏ; không được vẽ tàu cứu hộ như tính năng hoạt động.

- **Phải thay đổi:** Biển tập kết, hướng thoát tới mép nước, chỗ xếp hàng có mái, nằm trong logic Westmouth.

- **Pass riêng:** Người chơi hiểu nơi tập kết nhưng không bị hứa transport giả.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Southfoot Evac Beach — `po_evac_south` · **P2** · SOURCE

- **Hiện trạng/vấn đề:** Evac biển không nên dựng nhà đón khách giống trong thành phố.

- **Phải thay đổi:** Vệt bãi cát an toàn, cọc tín hiệu, bậc xuống bờ rõ ràng, mái tránh gió thấp.

- **Pass riêng:** Không chặn đường bờ, không có boat spawning giả.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

#### Hook Evac Point — `po_evac_hook` · **P2** · ẢNH + SOURCE

- **Hiện trạng/vấn đề:** Ảnh thật: nhà hộp và sân đường nâu, thiếu cảm giác sân tập kết của cư dân Hook.

- **Phải thay đổi:** Gắn với đường làng, dấu vết chờ/đồ cấp cứu, bảng chỉ hướng, giữ diện tích nhỏ.

- **Pass riêng:** Một điểm sơ tán dân cư, không thành chòi canh vô danh.

- *Dấu vết kỹ thuật:* Tầng `0` · 3 khu/phòng · 2 props source.

## 4. Mười hai POI khó nên remake chuyên sâu trước

**01 Argus Observatory (`po_observatory`).** Không thể tiếp cận một “đài thiên văn” qua sân chữ T. Làm từ topographic sky-view → outer instrument ring → astronomy core → stair → telescope + skyline. Đây phải là niềm tự hào thị giác vùng Argus.

**02 Mosslight Glade (`po_glade`).** Xóa toàn bộ logic sàn gỗ ngang khung hình và chuyển sang nền sinh thái. Tạo 3 tầng thực vật/tán, khoảng sáng rơi vào điểm dừng, lối mòn tránh rễ, micro life; chỉ dùng kiến trúc người nơi thật cần.

**03 Typhon’s Fracture (`po_typhon`).** Dựng lực phá hủy và địa tầng: khe chính có độ sâu/tối, lớp đá cắt lệch, đường men mép và điểm nhìn xuống. Đảm bảo người chơi không thể đi ngang qua “vực” nếu collision không cho phép.

**04 Necropolis (`po_necropolis`).** Không dùng nhà hình chữ nhật làm đền. Xây nghĩa địa bằng tượng, lăng mộ, trục nghi lễ có tiết tấu, cổng, ô sân nhỏ và lối xuống ossuary; lịch sử chôn cất phản ánh hình dáng.

**05 Crushed Viaduct (`po_viaduct`).** Bằng chứng đứt nhịp và trọng lực: trụ đá, ray/dầm gãy, rubble dưới vực, độ lệch hai đầu, tuyến tránh. Tham khảo Drowned Pier về ý tưởng hỏng, nhưng tuyệt đối không bê nguyên cầu truss F02.

**06 Heart of the Elderwood (`po_elderwood`).** Cây cổ phải thay thế phần lớn kiến trúc người, tạo hệ rễ như vách và nhánh như cầu. Khả năng khám phá bắt nguồn từ cây, không phải camera nhìn một sân đá.

**07 Foundry of First Fire (`po_surtur`).** Không ghép khuôn crypt lẫn khuôn lò công nghiệp. Đây là cổ tích địa chất–lò: khe địa nhiệt, vòng chịu lửa, bệ đúc khổng lồ và di tích công cụ, không được giống Charcoal Kilns.

**08 Salt Pans (`po_saltpans`).** Ruộng muối thật phải có chuỗi ao nước nông, bờ chia ô, phần trắng kết tinh, phần đang bay hơi và kho hứng. Chỉ thêm bình thùng sẽ không sửa được base material.

**09 Kestrel Radio Tower (`po_kestrel`).** Ưu tiên mast và dây neo vượt chiều cao mái; tầng leo ở dọc tháp, không “nhà tầng 2” chung. Tạo silhouette thấp→cao→anten rõ và cabin kỹ thuật.

**10 Obsidian Quarry (`po_obsq`).** Khai thác vật liệu thủy tinh núi lửa phải cho thấy vách tối sắc, ánh phản cạnh, bãi mảnh và các đường đi tránh cạnh đá; không tô màu quarry thông thường.

**11 Delta Filter Station (`po_filter`).** Nước phải tự giải thích công trình. Mỗi bể có trạng thái và độ cao; lối kiểm tra nhỏ hơn lòng bể; cửa cấp và cửa xả có hướng; bỏ texture nền phủ kín.

**12 Beacon Rock Light (`po_beacon`).** Vừa là bài silhouette hải đăng vừa là bài custody: giữ nguyên reservation MGP-D07; kiến trúc bám vách biển, đường lên và hiệu ứng light không xâm phạm gameplay/helicopter contract.

## 5. Lộ trình sửa không phá 81 POI

1. **Khoá nguồn và kiểm chứng bản thật.** Lấy file C03 Breakthrough thật; export cumulative và ghi HASH + runtime. Tạo manifest 81/81 ID, tọa độ, typed family, flags, art provenance. Không chạy remake song song khi chưa chắc input.
2. **Thiết lập Art Bible SOH.** Trích approved frames/atlas, quyết định resolution, palette chức năng, vật liệu, outline/shadow, mái, pixel snapping; đánh dấu reject F03 art assets và danh sách art cần thay.
3. **Thử 4 flagship chất lượng mới.** Remake Glade, Typhon, Observatory, Necropolis trước; bốn không gian khác grammar: rừng, địa chất, thiên văn, nghi lễ. Mỗi nơi đạt PASS visual thật rồi mới nhân rộng kỹ thuật.
4. **Làm lại nhóm sai grammar.** Tách `archive()` cho observatory/lantern/archive; `wild()` cho mine/elderwood/glade; `crypt()` cho first fire/necropolis/cairn; `rupture()` cho shipwreck/viaduct/rail yard.
5. **Thay art F03 trên 15 POI.** Không có việc thêm 15 bộ sprites phức tạp độc lập; dựng 5 ký pháp vật liệu đã duyệt, rồi tập trung câu chuyện ngành thực: nước, gỗ, địa chất, nhiệt, hạ tầng.
6. **Nâng 12 cảng F02 và H01 theo đối chứng.** Giữ geometry/mạch đi đã test; nâng silhouette/mái/texture/lighting, không tự thêm hầm và cầu chỉ cho đều tầng.
7. **Chỉnh các POI nhỏ và các điểm service.** Bảo toàn kích thước, giảm set dressing thừa, tăng dấu nhận diện thuộc POI mẹ; caches, vendors, evacuation không có Gameplay giả.
8. **QA 81/81 thật và phát hành.** Mỗi POI tự đi từ access → focal → tầng nếu có → quay lại, ảnh 1x/day/night, test negative, HUD/mobile; kiểm tra merge exact C03, native SOH gate, human acceptance ký từng nhóm.

## 6. Mẫu phiếu nghiệm thu bắt buộc cho từng POI

```text
POI ID / canonical name / coordinate / source SHA / actual integrated ZIP SHA:
Group/triple confirmed?    [YES / WORKING ONLY]
One-line unique fantasy:
Why here? (GOLD land/water/region):
Architecture cause (human/material/machine/spiritual):
Distinct silhouettes (3):
Entry reveal (first 3 seconds without HUD/title):
Route A / Route B / return route:
Vertical links physically tested (E, colliders, roof fade):
Material rules + approved asset refs/hash:
Existing art rejected, substituted? [YES/NO; exact IDs]
Gameplay hooks real vs scenery-only:
Screenshots: entrance / hero / upper-or-below / night / adjacent POI comparison:
Comparison with same family: why not a reskin?
Compiler / graph / browser / native / streaming / save:
Risk/Priority and accountable owner:
Result: BUILT / DISTINCT / FINAL / HOLD + precise blockers:
```

## 7. Ba quyết định không thể đánh đổi

1. **Không xóa 81 địa điểm để thay bằng “tái sinh” thế giới.** Lỗi là thiết kế và art direction; giữ GOLD, IDs, các kết nối Gameplay đã thật sự chứng minh.
2. **Không để “pixel art xấu” lọt qua vì khả năng đi lại đạt.** Asset bị creator reject có trạng thái `ART_REJECTED` cho đến khi được thay và nghiệm thu bằng mắt.
3. **Không tự động nới rộng mọi POI.** Một glade 1 tầng có thể tốt hơn nhà 4 tầng; ngược lại, một Necropolis chỉ có nền chữ T và 1 hầm là chưa xứng tầm. Mức độ phải đến từ thiết kế và tính hợp lý của nơi chốn.

---

**Nguồn kiểm tra:** ZIP newest 81 REST48 manifest/roster/arch audit, source REST48, source F03 R2, source C01/C02/C04, baseline `(11)` và các ảnh đã nêu trong scope. Những phần không có ảnh trực tiếp chỉ là chẩn đoán từ source và yêu cầu thiết kế để agent QA xác minh, không phải lỗi nhìn thấy chắc chắn.