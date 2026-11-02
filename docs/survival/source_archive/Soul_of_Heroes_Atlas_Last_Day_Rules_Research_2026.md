# @Soul of heroes — ATLAS CƠ CHẾ LAST DAY RULES / LAST ISLAND OF SURVIVAL

**Bản ghi nghiên cứu độc lập dành cho hệ thống gameplay Soul of Heroes**  
**Mốc kiểm chứng:** 29/10/2026 · **Phạm vi:** bản quốc tế Last Island of Survival và hệ phiên bản Trung Quốc 王牌战争：文明重启 (đối chiếu với cảnh báo khác biệt phiên bản).  
**Tình trạng:** Nghiên cứu và mô hình hóa; KHÔNG phải mô tả một bản build nội bộ được tự tay chạy kiểm thử. File “Soul of heroes.docx” của người dùng là ngữ cảnh dự án, không phải nguồn xác thực cơ chế game.

**Quy ước chứng cứ:** `[A]` nguồn phát hành/cập nhật chính thức có mốc ngày; `[B]` trang giới thiệu ứng dụng chính thức; `[C]` hướng dẫn người chơi có mốc ngày và giới hạn phạm vi; `[I]` suy luận phân tích hoặc ví dụ thiết kế, không được coi là đặc tả trò chơi; `[?]` chưa đủ bằng chứng xác minh trong bản 2026. Mọi tỷ lệ, chi phí, khoảng cách, thời gian cần đọc kèm phiên bản và chế độ.

**Cách dùng:** Mỗi mục có *dữ kiện → điều kiện/động từ thao tác → hậu quả → mối liên hệ → bài học chuyển dịch sang SOH → giới hạn chứng cứ*. Bản ghi này không có mục tiêu ép người dùng chốt tính năng, không phải yêu cầu lấy asset/mã nguồn trò chơi thương mại, và không coi ví dụ cân bằng được đề xuất là số liệu gốc.

## 00. Executive findings — 12 nhận định có khả năng chi phối toàn bộ thiết kế

1. **Gameplay cốt lõi không phải chỉ bắn và sống sót.** Nó là chu trình chuyển nguồn lực: khám phá → vật phẩm → phế liệu/Spares → kiến thức công thức → sản xuất → căn cứ → đi sâu vào các cứ điểm. Mỗi bước mở lại khả năng bước tiếp theo. [S01][S05][S07]
2. **Map là đồ thị chức năng, không phải nền trang trí.** Đường giao thông phát sinh loot phổ thông; POI có tầng phòng khóa; biome thay đổi nguồn nguyên liệu và hiểm họa. Vị trí nhà có giá trị vì chi phí và rủi ro mỗi lần quay về. [S02][S07][S21]
3. **Thẻ màu là chuỗi vật phẩm mở cổng liên tiếp.** Hướng dẫn chính thức 2019 ghi xanh lá → xanh dương → tím, kèm nguồn điện và một số Boss. Đừng giảm thành chỉ số dungeon difficulty. [S07]
4. **Có hai hình thức căn cứ rất khác nhau.** Nhà dã chiến nằm trong trận có thể bị tấn công và mất khi reset; Operation Base 2020 là khu cá nhân không reset, có xây công trình, kho, nghiên cứu, nhà máy và vận chuyển hạn chế. [S04][S09]
5. **Công thức là trạng thái tri thức, không phải nguyên liệu.** Có công thức rơi từ môi trường, học từ mẫu vật, nghiên cứu bằng linh kiện, nhận theo tiến trình Civilization, hoặc sở hữu dạng hiếm ở cấp căn cứ/tài khoản. [S04][S10][S11][S18]
6. **Xây dựng là một bài toán topology và an ninh.** Nền, tường, cửa, mái, mật mã, tủ lãnh thổ, bẫy, đường vòng, tầng lõi và lò là một hệ vật lý/kinh tế; không phải thanh HP gắn lên một prefab. [S13][S14][S15]
7. **Năm 2023 có trần quy mô định lượng.** Có giới hạn 10 nền nối theo một hướng tương ứng 40 m, bán kính xây 28 m, 30 vật chứa, 80 thiết bị điện, 20 lò và 20 tháp tự động trong chế độ được thông báo. Không nên dùng các số này làm giới hạn toàn game. [S14]
8. **Điện và thẻ khóa có quan hệ nhân quả.** Có thẻ đúng màu mà chưa kích hoạt mạch vẫn có thể thất bại khi mở phòng. Các bài hướng dẫn mô tả máy phát, công tắc, cảm biến và cửa điện. [S07][S16]
9. **Mọi lượt đi loot có economics.** Kết quả ròng phải xét sức chứa, độ bền, đạn, thuốc, đường đi, khả năng chết và mất hàng, không chỉ rarity vật phẩm. Đây là diễn giải thiết kế dựa trên cơ chế rơi đồ đã ghi nhận. [S04][S05]
10. **POI là nguồn đối kháng chứ không chỉ chiếc rương to.** Quân đồn trú, zombie, Boss, phòng có điều kiện truy cập, thùng có cấp và thời gian hồi tạo nên những lộ trình khai thác. [S07][S08][S21]
11. **Bản 2026 không phải bản 2019.** Có chế độ hoài cổ song song, Zombies Tide Trial mở công thức qua tủ lãnh thổ, chế độ phân tranh 49 ô đất và cơ chế khai thác, vật nuôi, chiến đấu khác nhau. [S19][S20][S22]
12. **Tính tương đương đáng sao chép là tính tương đương hành vi.** Với SOH, súng → Skill Core; blueprint → bí kíp chế tác; máy phát + thẻ → mạch phong ấn; raid PvP → hiểm họa hoặc PvE có luật. Giữ động từ hành động, điều kiện, tiêu hao, rủi ro và quyền sở hữu; không mượn code/asset hoặc khẳng định SOH đã triển khai. [I]

## 01. Khung phân biệt: tên game, chế độ, phiên bản và dữ kiện

**Danh tính:** Trang Google Play phát hành dưới tên *Last Island of Survival*, package `com.herogame.gplay.lastdayrulessurvival`; game gắn với tên cũ *Last Day Rules: Survival*. Nguồn Trung Quốc chính thức mang tên 王牌战争：文明重启; có tương đồng đáng kể về cơ chế và hệ thống cập nhật, nhưng không cho phép đồng nhất lịch phát hành, mọi chế độ, loot table hay cấu hình server giữa các khu vực. Tên “Unknown 15 Days” nhấn mạnh nhịp reset ở những chế độ liên quan, không có nghĩa mọi server luôn chạy đúng 15 ngày. [S01][S02]

**Bốn khung thời gian phải phân biệt:** 2019 giới thiệu sandbox restart, blueprint và keycard; 2020 mở Operation Base không restart cùng giao thương vận chuyển; 2021 có Dawn Land 7×7 km và Civilization mode, lưu blueprint công trình; 2023 bổ sung cấu kiện cong, giới hạn xây dựng và R&D chọn công thức trong một số mode; 2024 thêm Workshop và những mode PvE mới; 2025 cải tiến giao diện map/POI, mở rộng khu tài nguyên; 2026 xuất hiện Zombies Tide Trial, chế độ hoài cổ song song và chế độ tranh quyền 49 ô đất. [S04][S09][S10][S12][S13][S14][S18][S19][S20][S21]

**Ba cấp chứng cứ:** (i) mô tả tính năng có ngày, chế độ xác định → được ghi như mốc lịch sử; (ii) bài người chơi mô tả bản đồ, hồi vật tư, công thức → cung cấp chiến thuật nhưng có thể thay đổi; (iii) phép nội suy về logic AI, spawn/kinh tế, hoặc chuyển sang SOH → minh họa thiết kế. Nếu một thông số được sửa qua patch, ghi cả hai mốc, không chọn tùy tiện mốc cũ. Điển hình giới hạn khoảng cách tủ lãnh thổ trong Zombies Tide Trial đã thay đổi nhiều lần từ tháng 4 đến tháng 7/2026. [S20][S23]

**Không đủ bằng chứng công khai:** số lượng recipe thật trong toàn bộ bản 2026; seed / thuật toán map hiện hành; tỷ lệ rơi cụ thể của từng thùng, hòm, Boss; mọi timer hồi loot; chỉ số HP của mọi mảng tường; bảng lượng tiêu hao upkeep; giá thực tế sau mọi bản vá; dữ liệu code nguồn game thương mại. Các khoảng trống này được giữ là chưa biết, không điền bằng công thức của Rust. [?]

# PHẦN I — KIỂM KÊ TỪNG PHÂN HỆ (MÔ TẢ CHI TIẾT VÀ QUAN HỆ)

### 02. Bản đồ thế giới và tính liên tục

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Trang giới thiệu chính thức mô tả một đảo sinh tồn nhiều dạng địa hình; Dawn Land được giới thiệu năm 2021 là bản đồ thứ ba với kích thước 7.000×7.000 m, tăng thêm 8 POI mới. Không thể suy ra mọi bản đồ cùng kích thước. [S02][S10]

**Định lượng/biên dữ liệu:** 7.000 m mỗi cạnh; diện tích danh nghĩa 49 km² ở bản đồ Dawn Land, chưa trừ mặt nước và vùng không đi được.

**Động từ gameplay thực:** Đi đường, định hướng theo địa hình, đánh dấu cứ điểm, trở về căn cứ, mở rộng tầm đi khám phá.

**Quan hệ nhân quả:** Địa hình quyết định tuyến đường, time-to-return, mật độ nguy hiểm và nơi thuận tiện đặt nhà.

**Rủi ro và giới hạn diễn giải:** Map có thể đẹp mà chơi vô nghĩa nếu POI không liên hệ tới vật liệu; tránh ép mọi hoạt động về dungeon.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH cần mỗi ô/biome có supply–demand và đường di chuyển thực, không chỉ phân màu cảnh quan.

### 03. Biome và nguyên liệu không đồng đều

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Nguồn chính thức liệt kê bãi biển, hoang mạc, rừng nhiệt đới, đồi núi, tuyết và đảo. Ghi chép người chơi giai đoạn 2019 nói sa mạc thuận lợi sulfur, tuyết thuận lợi iron, rừng thuận lợi quả và nấm; đây là kinh nghiệm cũ. [S02][S24]

**Định lượng/biên dữ liệu:** 6 nhóm địa hình theo giới thiệu gốc; phân bổ tỷ lệ quặng chưa có bản xác nhận 2026.

**Động từ gameplay thực:** Di chuyển tới biome, thu thập, chống nóng/lạnh hoặc phóng xạ tại POI, tối ưu hành trình.

**Quan hệ nhân quả:** Quặng lệch vùng tạo nhu cầu vận chuyển, làm giá trị tiền đồn và phương tiện tăng lên.

**Rủi ro và giới hạn diễn giải:** Nếu mọi vùng sinh mọi thứ ngang nhau thì bản đồ chỉ đổi texture; nếu lệch tuyệt đối thì có thể gây softlock.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: gỗ/xơ sợi phổ biến, dược độc ở đầm lầy, khoáng lạnh ở tuyết, linh thạch biến dị ở vùng cấm; mọi item phải gắn ít nhất một nguồn hợp lý.

### 04. Đường đi và thùng phế liệu

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** FAQ chính thức 2019 nêu blueprint xuất hiện ở thùng dầu ven đường; các hướng dẫn mô tả cụm hòm/thùng có linh kiện, vật liệu và đôi khi vũ khí. [S04][S05]

**Định lượng/biên dữ liệu:** Không xác nhận số thùng/km, loot rate hay thời gian hồi thùng hiện hành.

**Động từ gameplay thực:** Tìm tuyến đường, phá/thám hòm, nhặt linh kiện, cất vào túi, cân nhắc về kho.

**Quan hệ nhân quả:** Thùng cấp thấp vẫn có chức năng tiến triển tri thức vì Spares có thể dùng cho nghiên cứu.

**Rủi ro và giới hạn diễn giải:** Nếu chỉ rơi rác không có nghĩa thì farm không hấp dẫn; nếu luôn rơi đồ tốt thì POI cao cấp mất giá.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH nên có phế tích dọc đường cho mảnh tri thức và vật liệu lõi, đồng thời giữ hộp/rương cấp cao ở địa điểm nguy hiểm.

### 05. POI là đồ thị mục tiêu nhiều tầng

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Nguồn chính thức 2019 xác định phòng xanh lá, xanh dương, tím tại các POI và chuỗi thu thập thẻ; 2025 cải tiến giao diện map khi chọn POI để thấy quái, thiết bị, thùng và phòng thẻ. [S07][S21]

**Định lượng/biên dữ liệu:** 3 màu thẻ truyền thống; 2025 UI POI mô tả 4 loại thông tin: quái, thiết bị, container, phòng khóa.

**Động từ gameplay thực:** Đến POI, phân tích lối vào, kiểm tra thẻ, bật điện, xử lý địch, mở phòng, rút lui.

**Quan hệ nhân quả:** POI có thể ghé lại nhiều lần khi kiến thức hoặc cấp bảo hộ đổi, không cần một dấu tick hoàn thành.

**Rủi ro và giới hạn diễn giải:** Không đồng nhất các POI vì phân bố phòng thẻ đã từng được xáo ngẫu nhiên sau phiên bản 2020.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: di tích nhiều lớp, cửa phù, điện cổ, thùng cổ vật, boss, đường bí mật, hệ thống cảnh báo.

### 06. Khu nguy hiểm và phân tầng điều kiện

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Patch 2019 từng thêm phòng tím có phóng xạ cấp 2 mà mặt nạ thường không chống được; patch 2020 sau đó gỡ phóng xạ cao cấp khỏi phòng thẻ của trận. Điều này chứng minh hazard không phải quy tắc bất biến. [S08][S09]

**Định lượng/biên dữ liệu:** Đã từng có ít nhất 2 cấp hazard phóng xạ tại phòng thẻ; không có bảng ngưỡng chịu đựng đầy đủ.

**Động từ gameplay thực:** Vào vùng nguy hiểm, quan sát debuff, chuẩn bị mặt nạ/giáp, kiểm soát thời gian ở lại.

**Quan hệ nhân quả:** Hazard tạo lối tiến triển phi chiến đấu: cần hiểu bảo hộ trước khi tận dụng chìa khóa.

**Rủi ro và giới hạn diễn giải:** Không biến hazard thành chốt level tuyệt đối, nhưng cũng tránh vật phẩm chống độc vô tác dụng.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: độc khí, rét sâu, lời nguyền, ăn mòn; kháng có chỉ số và nguồn vật liệu rõ ràng, có đường rút an toàn.

### 07. Thay đổi thiết kế map theo mùa và bản vá

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Năm 2019 sân bay được thiết kế lại tăng diện tích 4–5 lần, nhà máy điện thêm bốn cửa đường ống ngầm với năm khu vực; các bản vá sau thêm POI, khu vực nước và trải nghiệm phụ. [S08]

**Định lượng/biên dữ liệu:** 4–5× diện tích sân bay lịch sử; 4 lối vào ống ngầm; 5 phân khu bên dưới nhà máy điện.

**Động từ gameplay thực:** Khám phá lại địa điểm quen sau cập nhật, tận dụng tầng thẳng đứng và không gian kín.

**Quan hệ nhân quả:** Một POI có thể là lộ trình ngắn nhiều rủi ro hoặc lộ trình dài nhiều loot.

**Rủi ro và giới hạn diễn giải:** Các thông số là ảnh chụp ở năm 2019; không áp đặt lên map Dawn Land hoặc bản 2026.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: lưu world version và POI schema để cập nhật map mà không làm hỏng căn cứ người chơi.

### 08. Cứ điểm có thẻ: thứ tự nguồn–khóa–phòng

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Hướng dẫn chính thức 2019: xanh lá thường từ quán xăng/siêu thị/địa điểm có tên; xanh dương trong phòng xanh lá; tím trong phòng xanh dương. Chỉ một số POI chứa phòng mỗi loại. [S07]

**Định lượng/biên dữ liệu:** Thời kỳ 2019 ghi phòng xanh dương có thẻ tím hồi khoảng 3 giờ; giờ hồi 2026 chưa xác minh.

**Động từ gameplay thực:** Tìm thẻ, mang thẻ, khôi phục điện, mở phòng, nhặt thẻ cấp kế tiếp và đạn/thiết bị.

**Quan hệ nhân quả:** Đây là chuỗi tự mở rộng mục tiêu: loot một thẻ có thể tạo lý do đi tới một POI khác cách xa.

**Rủi ro và giới hạn diễn giải:** Phải tính số lượt thẻ; thao tác mất phí nên người chơi cần cảnh báo nếu điện chưa cấp.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: chìa khóa hạng I/II/III, ấn phù, mạch dẫn năng lượng; một di tích sớm có thể gợi mở vùng muộn.

### 09. POI quân sự, sinh hóa, sân bay, cảng

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** Các nguồn 2019–2023 ghi quân sự có phòng các cấp và lính bất tử; lab có EG Mutant; sân bay có tank/Avenger tùy patch; cảng có thùng trên container và địch đặc biệt. [S07][S08][S17]

**Định lượng/biên dữ liệu:** EG Mutant từng có chu kỳ 3 giờ ở lab; Avenger được patch 2019 ghi 6 giờ tại sân bay trước khi vị trí thay đổi.

**Động từ gameplay thực:** Chọn vũ khí/đạn, nhìn vị trí bắn, đánh boss hoặc lẩn tránh, ưu tiên phòng loot phù hợp năng lực.

**Quan hệ nhân quả:** Boss không chỉ chặn đường mà đôi khi là nguồn vật phẩm/linh kiện độc quyền.

**Rủi ro và giới hạn diễn giải:** Vị trí Boss và timer cực kỳ nhạy bản vá; cần kiểm chứng theo server.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: tiền đồn quân địch, phòng nghiên cứu cổ, cảng sông, pháo đài bị chiếm, mỏ cổ bị phong ấn.

### 10. Khu vực đặc biệt có thời hạn riêng

**Phân hệ:** HỆ THỐNG WORLD. **Dữ kiện và phiên bản:** 2025 bổ sung vùng tài nguyên cao cấp trên Uninhabited Island; lượt khám phá khu mới kéo dài 24 phút, tối đa 3 người, quái thường có cơ hội 1/3 nâng thành elite. [S21]

**Định lượng/biên dữ liệu:** 24 phút; tối đa 3 người; xác suất elite 1/3 trong khu đó (theo thông báo 2025).

**Động từ gameplay thực:** Vào qua cơ chế riêng, chia vai, xử lý Boss, quyết định ở lại loot hay rút.

**Quan hệ nhân quả:** Đặt trần thời gian làm túi đồ, đạn, chữa trị và năng lực di chuyển trở thành biến chiến thuật.

**Rủi ro và giới hạn diễn giải:** Một vùng timed-instance khác với map mở liên tục, không thể coi 24 phút là giới hạn của mọi chuyến đi.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: hầm ngầm sụp đổ định kỳ hoặc cuộc thám hiểm có thời hạn; nên là nhánh phụ, không áp cho mọi biome.

### 11. Cơ chế vật phẩm–công thức–vật liệu

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** FAQ chính thức mô tả blueprint dùng để mở chế tạo; học xong, chỉ khi đủ vật liệu mới sản xuất. Bản vẽ chưa học trong túi có thể rơi khi chết; kiến thức đã học không mất do chết trong trận. [S04]

**Định lượng/biên dữ liệu:** Ba trạng thái tối thiểu: chưa sở hữu công thức / sở hữu bản vẽ chưa học / đã học công thức.

**Động từ gameplay thực:** Nhặt vật phẩm, nhặt blueprint, nghiên cứu, học, kiểm tra station tier, chế tạo.

**Quan hệ nhân quả:** Trạng thái biết cách làm và đang cầm vật phẩm tách biệt; đó là nền của kinh tế nghiên cứu.

**Rủi ro và giới hạn diễn giải:** Không đánh đồng trang bị được nhặt với quyền sản xuất không giới hạn.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: Skill Core dùng giới hạn; bí kíp riêng; lần đầu nhặt Core tạo ba lựa chọn dùng, cất, giải mã.

### 12. Spares: đơn vị tiền tri thức và linh kiện

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Spares/零件 được nhận qua loot và xử lý phế liệu, tiêu cho nghiên cứu, nâng bàn và một số hoạt động kinh tế khác. Bản 2023 một số mode hỗ trợ chọn Plan mong muốn bằng Spares. [S04][S18]

**Định lượng/biên dữ liệu:** Giá 150/300/600 và 500/1.500 được nêu trong hướng dẫn cũ, không dùng làm giá 2026.

**Động từ gameplay thực:** Thu gom, phân giải, dự trữ, tiêu vào công thức hoặc cải tạo năng lực sản xuất.

**Quan hệ nhân quả:** Cùng một currency kéo nghiên cứu và phát triển cơ sở vật chất vào một bài toán opportunity cost.

**Rủi ro và giới hạn diễn giải:** Nếu các nguồn Spares chỉ ở Boss khó, người chơi solo dễ mắc kẹt; nếu vô hạn không rủi ro, nghiên cứu mất ý nghĩa.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: Mảnh Tri Thức lấy từ phế tích, không đồng nhất với quặng; có chỗ dùng để học Core và cải thiện xưởng.

### 13. R&D Bench qua ba đời cơ chế

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Cơ chế cũ có nghiên cứu ngẫu nhiên theo cấp bàn; Civilization 2021 có giai đoạn nhận Plan chỉ định khi nâng workbench, loại bỏ random kiểu cũ; năm 2023 một số mode có nghiên cứu mục tiêu chọn trực tiếp. [S10][S18]

**Định lượng/biên dữ liệu:** Không có bảng chi phí hoàn chỉnh cho từng Plan hiện hành; chỉ biết những lần thay đổi thiết kế.

**Động từ gameplay thực:** Chọn bàn/công thức, trả tài nguyên, hoàn thành unlock; khác reverse engineering.

**Quan hệ nhân quả:** Kiểm soát ngẫu nhiên quyết định người chơi có cảm thấy bị chặn không công bằng hay không.

**Rủi ro và giới hạn diễn giải:** Không mô tả đây là một cơ chế duy nhất hoạt động giống nhau trong mọi mode.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: có đường học định hướng; random làm phần thưởng phụ, không là cánh cửa độc quyền tiến trình chính.

### 14. Drawing Table: phân tích vật phẩm mẫu

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Hệ thống này chuyển vật phẩm hiện hữu thành tri thức chế tạo: người chơi phải cầm được item mẫu, tiêu hao vật phẩm và Spares, sau đó thu công thức nếu được hỗ trợ. [S04][S17]

**Định lượng/biên dữ liệu:** Không có bằng chứng mọi item đều có thể copy; đã có công thức đặc biệt không hỗ trợ.

**Động từ gameplay thực:** Nhặt súng/giáp, quyết định giữ lại hay hy sinh mẫu, tới bàn vẽ, nhận Blueprint.

**Quan hệ nhân quả:** Vật phẩm tốt có hai giá trị xung đột: sức mạnh hiện tại và quyền sản xuất về sau.

**Rủi ro và giới hạn diễn giải:** Rủi ro máy: không thể vừa tiêu item vừa trả item do lỗi mạng/save.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: lõi kỹ năng sắp cạn có thể dùng ngay hoặc giải mã để có công thức, giữ tính có giá của quyết định.

### 15. Dây chuyền vật tư nhiều tầng

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Trong bảng lịch sử, Gunpowder cần Charcoal+Sulfur Powder; Explosive lại sử dụng Gunpowder+Fuel+Iron; Rocket Ammo có thể tiêu Explosive+Pipes. Đây là dạng recipe graph có tầng. [S25]

**Định lượng/biên dữ liệu:** Ví dụ lịch sử: 30 Charcoal +20 Sulfur Powder → Gunpowder, không thể dùng như xác nhận hiện hành.

**Động từ gameplay thực:** Thu thập, đốt nhiên liệu, tinh luyện, tổng hợp thành phần trung gian, chế tạo thành phẩm.

**Quan hệ nhân quả:** Giá của một viên rocket phụ thuộc tổng các cạnh trước nó và thời gian chế biến.

**Rủi ro và giới hạn diễn giải:** Ghi chi phí nguyên liệu theo trạng thái thô hay tinh luyện, không đếm trùng cùng vật liệu hai lần.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: quặng thô → thỏi → phôi Core → Core; dược liệu → tinh chất → bảo hộ; mảnh cổ → bí kíp.

### 16. Vật phẩm trùng công thức và cạnh tranh đầu vào

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Bảng đạn cũ ghi 5.56 và 7.62 dùng lượng Iron Bars và Gunpowder giống nhau nhưng hai blueprint khác; các súng trường dùng chung Pipes/Springs/Refined Iron. [S25]

**Định lượng/biên dữ liệu:** Dữ kiện số lượng thuộc tài liệu 2019, không dùng tính DPS/efficiency hiện hành.

**Động từ gameplay thực:** Dành nguyên liệu cho nhiều nhánh, chọn chiến thuật sử dụng loại đạn hoặc trang bị.

**Quan hệ nhân quả:** Cùng một tồn kho linh kiện có nhiều đầu ra cạnh tranh giúp quyết định craft có trọng lượng.

**Rủi ro và giới hạn diễn giải:** Nếu mọi thứ dùng nguyên liệu hoàn toàn độc lập, kho mất bài toán phân bổ.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: nhiều Core hệ lửa/nước/độc cần chung phôi, tinh thể nạp năng lượng nhưng có vật liệu chủng riêng.

### 17. Recipe Scope, rare recipe, quyền sở hữu

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Các mode khác nhau phân biệt công thức chiến đấu tạm thời, công thức quý giữ qua reset, công thức riêng Operation Base và công thức mở theo đội. [S04][S09][S20]

**Định lượng/biên dữ liệu:** Trong Zombies Tide Trial 2026, rời đội khóa lại công thức đội đã mở.

**Động từ gameplay thực:** Học, kiểm tra quyền trên cá nhân/đội, vào server mới, dùng recipes trong mode cho phép.

**Quan hệ nhân quả:** Hợp đồng sở hữu recipe ảnh hưởng kinh tế, hợp tác, khan hiếm và tự do chơi solo.

**Rủi ro và giới hạn diễn giải:** Không được mô tả công thức hiếm là vĩnh viễn trong mọi mode nếu không có nguồn.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: kiến thức vĩnh viễn của tài khoản/hero, giấy phép xây theo công trình hoặc buff tạm phải tách namespace.

### 18. Workshop và meta-progress khác R&D

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Bản 2024 có Workshop Chest + Key, nhận Patterns và Workshop Credits, tổng hợp Blueprint ở sảnh. Một phần là công thức; phần khác là skin/vật sưu tập. [S19]

**Định lượng/biên dữ liệu:** Một khóa Workshop được ghi bán 1.000 coins; hạn mức shop 10 lượt/tuần khi ra mắt, không chắc còn ở 2026.

**Động từ gameplay thực:** Mở hòm, có pattern, đổi/ghép blueprint, sử dụng trong ngữ cảnh cho phép.

**Quan hệ nhân quả:** Meta collection tạo mục tiêu dài hạn bên ngoài mỗi chu kỳ survival.

**Rủi ro và giới hạn diễn giải:** Không gọi skin vũ khí là recipe vũ khí mới; phải phân biệt aesthetic và capability.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: thư viện bí kíp, bản thảo tri thức hiếm và thành tựu sưu tầm; tách khỏi RNG tiến triển bắt buộc.

### 19. Crafting cấp bàn, thời gian và độ bền

**Phân hệ:** HỆ THỐNG CHẾ TẠO. **Dữ kiện và phiên bản:** Giới hạn công thức có thể nằm ở cấp bàn và trạng thái học; đồ sử dụng có durability, repair bằng tài nguyên tại công cụ phù hợp. FAQ 2019 xác nhận vật phẩm đã cạn độ bền có thể sửa. [S04][S25]

**Định lượng/biên dữ liệu:** Lịch sử có các cấp Basic/Intermediate/Advanced; cấu trúc 2026 theo mode có thể khác.

**Động từ gameplay thực:** Lắp bàn, nâng cấp, làm item, sử dụng, đánh rơi, sửa chữa, tái sử dụng linh kiện.

**Quan hệ nhân quả:** Sửa chữa giảm áp lực thay hoàn toàn item nhưng vẫn là resource sink; một đồ nhặt hỏng có thể là mẫu nghiên cứu.

**Rủi ro và giới hạn diễn giải:** Không nhầm repairing thành crafting lại; cần xác định vật liệu sửa có ngang giá vật liệu chế tạo không.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: Core có số lần dùng/độ ổn định; sửa Core hiếm khác tạo Core mới, không tự cấp bí kíp.

### 20. Xây tự do: foundation, wall, door, floor, roof

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Trang chính thức nêu tự do xây căn cứ; thông báo bổ sung nền cong, tường cong, mái cong, ban công và cửa; nhiều cấu kiện có các cấp vật liệu khác nhau. [S01][S13]

**Định lượng/biên dữ liệu:** Bộ nền cong 2023 gồm tám loại cấu kiện được liệt kê, nhiều loại có 5 cấp.

**Động từ gameplay thực:** Đặt nền, nối module, dựng tường, tạo cửa sổ, đặt mái, nâng chất liệu, sửa hoặc tháo.

**Quan hệ nhân quả:** Hình học nhà tạo đường đi, điểm núp, góc bắn, kho kín và khoảng xây được phép.

**Rủi ro và giới hạn diễn giải:** Ảnh building chưa đủ để xác nhận cách tính stable/beam nội bộ; một số hướng dẫn cho biết thiếu nâng đỡ có thể sập.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH top-down phải có collision, auto-roof, kiểm tra hợp lệ của tường/door và chuyển phòng thực.

### 21. Territory Cabinet: quyền, giới hạn, upkeep, badge

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Territory Cabinet quản trị xây dựng, quyền/guest, một số giới hạn thiết bị, bảo dưỡng; cuối trận có chế độ tính điểm huy hiệu đặt trong tủ. Các mode đặc biệt thay luật này. [S04][S09][S14][S20]

**Định lượng/biên dữ liệu:** Năm 2023 có mức khách 6; năm 2026 Zombies Tide Trial một đội một tủ ở chế độ đó.

**Động từ gameplay thực:** Đặt tủ trên nền, cấp quyền, nạp vật tư, mở chức năng nâng cấp, bảo vệ trước raid.

**Quan hệ nhân quả:** Tủ là single point of failure: bị phá có thể mất kiểm soát và tiền sửa; bảo vệ vị trí tủ quan trọng hơn trang trí.

**Rủi ro và giới hạn diễn giải:** Không lấy thông số hạn mức tủ của Zombies Tide Trial áp sang mode sinh tồn thường.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: “trái tim lãnh địa” quản quyền đặt công trình, mở rộng footprint, giường, kho; bản offline không cần clone raid tàn bạo.

### 22. Kết cấu bảo vệ: lớp, phòng rỗng và lõi nhà

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Hướng dẫn chiến thuật 2019 đề nghị chia kho thành nhiều phòng, dựng shell/anti-raid layer và giữ tủ sâu trong lõi; vật liệu tường và số cửa tăng chi phí raid. [S15][S16]

**Định lượng/biên dữ liệu:** Số lượng lớp bảo vệ không có tiêu chuẩn thắng tuyệt đối; công trình có trần kích cỡ theo patch.

**Động từ gameplay thực:** Đi cửa nhiều lớp, giấu kho, bố trí hộp ở phòng khác nhau, xây bẫy và tuyến fallback.

**Quan hệ nhân quả:** An ninh là bài toán tuyến ít phí nhất từ kẻ đột nhập tới kho; không chỉ tổng HP tất cả tường.

**Rủi ro và giới hạn diễn giải:** Nếu không có PvP, tránh buộc người chơi tối ưu honeycomb vô nghĩa.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: đường tiến quân quái, vùng kho dễ bị loot, cửa khóa, tháp bảo vệ; ra quyết định “kho phân tán hay tập trung”.

### 23. Giới hạn footprint và thiết bị

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Patch tháng 7/2023 liệt kê độ dài nối nền, bán kính công trình và quota cho storage/electricity/smelting/defense; nguyên nhân chính thức là chống giật/đơ/crash. [S14]

**Định lượng/biên dữ liệu:** 40 m/10 nền trên một hướng; bán kính 28 m/7 nền; kho 30; điện 80; lò 20; tháp tự động 20; tháp vận hành 10.

**Động từ gameplay thực:** Thiết kế theo phạm vi được phép, tối ưu layout, thêm tầng hoặc thiết bị thay thế khi chạm quota.

**Quan hệ nhân quả:** Giới hạn không chỉ cân bằng chống nhà vô hạn mà còn là quyết định kỹ thuật về hiệu năng.

**Rủi ro và giới hạn diễn giải:** Không lấy những quota này làm thông số mặc định của mọi server hoặc thời đại.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: dùng ngân sách collision/nav/animation per chunk; quota nên phản ánh giới hạn hiệu năng đo được.

### 24. Điện, mạch và bẫy

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Hướng dẫn người chơi 2019 nêu generator chạy fuel, switch, pressure switch, infrared switch, electric door và đèn; hệ thống nối nguồn→công tắc→thiết bị. [S16]

**Định lượng/biên dữ liệu:** Có nhiều loại trigger; chưa có chứng cứ điện năng/giây ở bản 2026 cho từng thiết bị.

**Động từ gameplay thực:** Đặt máy phát, nạp nhiên liệu, nối mạch, thử công tắc, sửa đường dây, đặt cửa điện.

**Quan hệ nhân quả:** Điện tạo nhiều chế độ dùng khác nhau trên cùng công trình: đèn, ra vào, phòng thủ, đánh lừa kẻ xâm nhập.

**Rủi ro và giới hạn diễn giải:** Mạch cần trạng thái persistent; phải tránh việc cửa vẫn chạy khi nguồn trống.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: nguyên thạch nạp năng lượng→ấn phù điều khiển→cổng/đèn/bẫy; UI phải cho biết mạch nào thiếu nguồn.

### 25. Công trình sản xuất tại nhà

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Lò nung, lò lớn, lọc dầu, workbench, drawing/research station, kho và khu nấu ăn kết thành workflow tại nhà; không phải nội thất thuần túy. [S04][S09][S14]

**Định lượng/biên dữ liệu:** Operation Base 2020 Workstation/warehouse/workshop có mức quota khác trận; ban đầu ghi 4 kho, 4 lò, 4 tháp trước khi nâng cấp.

**Động từ gameplay thực:** Sắp đặt theo công đoạn, dự trữ, cấp nhiên liệu, chờ sản xuất, chuyển thành phẩm sang kho.

**Quan hệ nhân quả:** Một ngôi nhà nhỏ có thể trở thành dây chuyền công nghiệp khi người chơi giảm quãng thao tác giữa các bàn.

**Rủi ro và giới hạn diễn giải:** Không tự suy luận có transport belt tự động nếu không nguồn.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: lò luyện → xưởng cơ khí → phòng giải mã Core; hòm liên thông có thể là tiện ích mới riêng SOH.

### 26. Blueprint căn cứ khác blueprint chế tạo

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** 2021 công bố hệ lưu bản vẽ nhà thông qua tủ lãnh thổ, chọn lưu cấp gỗ hoặc giữ vật liệu, rồi đặt lại trong trận/căn cứ; có share mật mã. [S12]

**Định lượng/biên dữ liệu:** Tại lúc ra mắt: 30 phút CD lưu dùng chung; 30 phút CD đặt riêng mỗi trận; 1 Trade Coupon cho một lượt đặt; mật khẩu 6 chữ số.

**Động từ gameplay thực:** Lưu, chọn phạm vi vật liệu, chia sẻ, nhập mật mã, đặt ghost blueprint với chi phí.

**Quan hệ nhân quả:** Tái sử dụng kiến trúc rút ngắn thao tác nhưng vẫn yêu cầu kiểm tra terrain, vật tư và quota.

**Rủi ro và giới hạn diễn giải:** Không trộn hai nghĩa blueprint làm người dùng hiểu rằng nhà được “học công thức”.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: bản thiết kế nhà là spatial layout; bí kíp Core là Recipe Knowledge; dùng hai loại dữ liệu riêng.

### 27. Heat / comfort tại căn cứ

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Patch 2020 nêu lửa trại, lò, giường, thảm, lọc dầu, máy phát tạo heat; mức tích lũy tối đa 40, có hồi HP/hunger nhẹ và yêu cầu tủ lãnh thổ. [S11]

**Định lượng/biên dữ liệu:** Giá trị heat tối đa 40 tại thời điểm thông báo tháng 1/2020.

**Động từ gameplay thực:** Đặt nguồn nhiệt và vật dụng gần không gian dùng; chọn điểm hồi phục thuận tiện.

**Quan hệ nhân quả:** Trang bị sinh tồn có thể đồng thời phục vụ sản xuất và hồi phục, làm căn cứ đáng sống hơn.

**Rủi ro và giới hạn diễn giải:** Không thể suy ra khoảng cách heat hoặc công thức stacking nếu chưa có nguồn.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: giữ hệ “ấm áp và an toàn” khi trú nhà; có thể giảm tiêu hao thuốc và tăng hồi phục, nhưng cần playtest.

### 28. Operation Base: căn cứ cá nhân không reset

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Cập nhật 27/8/2020 thêm Operation Base cá nhân riêng, tối đa 10 người xây khi được ủy quyền, không raid, không reset; công trình về 0 durability chỉ ngưng hoạt động chứ không làm mất đồ trong kho. [S09]

**Định lượng/biên dữ liệu:** 10 người cộng tác tối đa; không reset; cơ chế bảo vệ kho khi công trình hết độ bền.

**Động từ gameplay thực:** Về căn cứ, xây, nâng công trình có timer, trao đổi, đưa vật tư qua trạm vận chuyển.

**Quan hệ nhân quả:** Giải quyết mong muốn sở hữu nhà lâu dài trái với nhịp đấu PvP wipe.

**Rủi ro và giới hạn diễn giải:** Cơ sở này là hệ riêng, không được nhầm với người chơi đặt nhà tự do trong thế giới chiến đấu.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH offline nên chọn persistence căn cứ dài hạn và lấy các mạo hiểm làm nguồn nguy hiểm thay cho wipe.

### 29. Liên thông Base–Battle giới hạn

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Hệ vận chuyển 2020 cho phép gửi đồ hai chiều có điều kiện: Base→battle giới hạn lần/ngày; ngày đầu battle chỉ loại thấp, từ ngày hai rộng hơn; battle→Base chỉ một số vật tư được whitelist. [S09]

**Định lượng/biên dữ liệu:** Base→mỗi battle 1 lần/ngày; battle→Base toàn server dùng chung 1 lần/ngày; reset 0h; có thể hiển thị 10 trận gần nhất.

**Động từ gameplay thực:** Chọn trận, chọn hàng hợp lệ, trả chi phí/nếu có, nhận tại hệ thống hộp thư hoặc trạm chuyển.

**Quan hệ nhân quả:** Whitelist và quota chặn việc căn cứ vĩnh viễn phá hỏng nhịp khởi đầu server mới.

**Rủi ro và giới hạn diễn giải:** Không tự suy luận đồ boss hay mọi Core đều chuyển tự do.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: mạng tiền đồn và nhà chính vận chuyển theo tuyến; giới hạn bằng phạm vi đường, năng lực vận tải và nguy hiểm đường đi.

### 30. Farming & food ở Operation Base

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Cập nhật 2020 ghi thêm hàng chục loại cây có thời gian chín khác nhau, hàng chục món ăn, bảng thưởng và kho; farming phục vụ cả kinh tế vật chất lẫn nhiệm vụ dài hạn. [S09]

**Định lượng/biên dữ liệu:** Hàng chục (không có bảng số lượng chuẩn xác) giống và món; nhiệm vụ thưởng tối đa 20 lần/ngày trong cơ chế 2020.

**Động từ gameplay thực:** Trồng, chờ tăng trưởng, thu hoạch, nấu, giao thưởng, tích trữ đồ hồi phục.

**Quan hệ nhân quả:** Sản xuất tái tạo giảm grind cơ bản nhưng không thay hết vật liệu hiếm lấy từ POI.

**Rủi ro và giới hạn diễn giải:** Không khẳng định hệ tưới tự động hoặc cấp farm nếu nguồn không xác nhận.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: vườn thảo dược và ruộng lương thực làm nguồn ổn định; essence từ elite vẫn phải đi thám hiểm.

### 31. Bounty Board, chợ, exchange và currency

**Phân hệ:** CĂN CỨ VÀ XÂY DỰNG. **Dữ kiện và phiên bản:** Operation Base có nhiệm vụ săn/thu thập/giải trí, giao dịch với Trade Coupons, có điều kiện giới hạn shop và phí giao dịch. [S09]

**Định lượng/biên dữ liệu:** Theo 2020: 3 slot bán bình thường, 6 slot khi nâng; thu 10% phí; lệnh lớn có 24h chờ; định giá tối thiểu đơn vị 0,02.

**Động từ gameplay thực:** Làm nhiệm vụ, lấy tài nguyên, đăng bán, nhận doanh thu, mua vật liệu thiếu.

**Quan hệ nhân quả:** Chợ là cơ chế chuyển tài nguyên thừa của người này thành nguyên liệu khan của người khác.

**Rủi ro và giới hạn diễn giải:** Không đưa giao dịch tiền thật hoặc monetization gốc làm feature mặc định cho game offline.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: NPC thương nhân có nhu cầu/xả kho, mua bán vật tư thiết yếu, phí vận chuyển làm sink tiền.

### 32. HP, hunger, dehydration, death và trạng thái đang nằm

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** FAQ và app chính thức ghi HP/hunger, uống nước, nhiễm bệnh/quái; người chơi ở trạng thái nguy kịch trước chết và mất đồ mang theo. Có vật phẩm hỗ trợ tự cứu trong một số phiên bản. [S01][S04]

**Định lượng/biên dữ liệu:** Không có hệ số mất HP mỗi giây đói hoặc nước mất/giờ đáng tin cho 2026.

**Động từ gameplay thực:** Ăn, uống, chữa trị, chạy trốn, mang đồ, chọn nơi logout, tìm lại túi khi chết.

**Quan hệ nhân quả:** Survival pressure ảnh hưởng tần suất quay về nhà và vật tư bắt buộc cho chuyến đi dài.

**Rủi ro và giới hạn diễn giải:** Nếu mất toàn bộ đồ do một lỗi AI/collision, rủi ro thiếu công bằng.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: giữ đói/khát nhẹ hoặc provisions, túi rơi có khả năng thu hồi; áp Hardcore nếu muốn full loot.

### 33. Hồi sinh, giường, túi ngủ và bản đồ chết

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** Hướng dẫn lịch sử có hồi sinh ngẫu nhiên hoặc ở điểm đã thiết lập, đồng thời death marker hỗ trợ quay lại nhặt đồ. [S04][S24]

**Định lượng/biên dữ liệu:** Không có dữ liệu 2026 thống nhất về số túi ngủ, khoảng cách đặt hoặc CD.

**Động từ gameplay thực:** Đặt túi ngủ ở khu nguy hiểm hay giường trong nhà, chết, chọn hồi sinh, di chuyển nhận lại túi.

**Quan hệ nhân quả:** Giường kết nối gameplay căn cứ với phạm vi khám phá; nơi xa không còn là lượt đi một chiều.

**Rủi ro và giới hạn diễn giải:** Không tự động cứu đồ mà không có nguồn/reward; rủi ro phải cảm nhận nhưng có hướng phục hồi.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: Soul Anchor ở nhà, beacon dã chiến, death bag theo phiên và vị trí; cứu đồ là side objective.

### 34. Durability, repair, chế độ cầm đồ đã dùng

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** FAQ 2019 xác nhận vật phẩm hỏng có thể sửa tại bàn bằng vật liệu; nhiều món nhặt có độ bền không còn nguyên. [S04]

**Định lượng/biên dữ liệu:** Không có bảng sửa 2026 đầy đủ; tránh giả định hao 1 durability/lần.

**Động từ gameplay thực:** Nhặt đồ, quan sát độ bền, dùng, đưa về bàn sửa hoặc thay bằng craft mới.

**Quan hệ nhân quả:** Durability tạo kinh tế tái sản xuất mà không cần giới hạn tuyệt đối số lượng item trong map.

**Rủi ro và giới hạn diễn giải:** Nếu người chơi đã học recipe mà vật liệu repair rẻ vô hạn, vòng lặp loot mới có thể giảm sức hút.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: Skill Core giới hạn charges; repair không nên miễn phí; đồ mẫu có tính xung đột dùng vs nghiên cứu.

### 35. PvP, raid và hợp tác

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** Ứng dụng chính thức nhấn mạnh PvP, cướp nhà, lựa chọn solo/đồng đội, clan. Server theo vòng khiến việc xây và raid có trọng lượng chiến lược. [S01][S05]

**Định lượng/biên dữ liệu:** Không xác nhận người chơi tối đa thực trong mọi mode hiện hành; các mode có chu kỳ 7/15 ngày.

**Động từ gameplay thực:** Tập hợp đội, phân chia vai, xây nhà, farm, đánh cướp, bảo vệ kho, tranh POI.

**Quan hệ nhân quả:** Mỗi người khác là nguồn bất định: thay đổi rủi ro trên đường, giá hàng, xung đột vị trí xây.

**Rủi ro và giới hạn diễn giải:** SOH offline không có người thật không thể bảo tồn nguyên xi kinh tế cướp bóc PvP.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: thay chức năng bằng phe NPC, quân tuần, raid có điều kiện, chứ không sinh vô hạn kẻ thù giả người.

### 36. Boss, AI địch và áp lực căn cứ

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** Patch lịch sử liệt kê EG Mutant, Avenger, lính bất tử, tank; 2020 Operation Base hỗ trợ triệu hồi zombie siege; 2026 Zombies Tide Trial chuyển cấp tủ thành mục tiêu chính. [S08][S09][S20]

**Định lượng/biên dữ liệu:** Operation Base 2020: 5 độ khó, thời gian 30 phút và CD kích hoạt 24 giờ.

**Động từ gameplay thực:** Chuẩn bị giáp, vũ khí, đạn, turret, chọn độ khó, bảo vệ mục tiêu công trình.

**Quan hệ nhân quả:** Một cuộc thủ thành biến “xây nhà” thành combat: lối đi và loại tường phải được kiểm chứng bằng trận.

**Rủi ro và giới hạn diễn giải:** Không gán chỉ số giáp/HP của boss từ các hướng dẫn không rõ phiên bản.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: thủ thành theo sự kiện chủ động với 5 tier có điều kiện, cân nhắc cảnh báo trước khi xảy ra.

### 37. Quy tắc target và phòng thủ trong Zombies Tide Trial 2026

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** Thông báo tháng 7/2026 ghi quái siege ưu tiên công trình của tủ chủ thể triệu hồi; quái có kiểm tra xuyên tường; công trình có trạng thái hư để sửa. [S23]

**Định lượng/biên dữ liệu:** Tháng 4 giới hạn khoảng cách vùng đặt tủ 100 m, tháng 5 nâng 200 m, tháng 7 giảm về 100 m. Đây là lịch sử theo mode.

**Động từ gameplay thực:** Kích hoạt siege, target thuộc căn cứ, phòng thủ, sửa chữa, đổi Core dư thành mảnh.

**Quan hệ nhân quả:** AI cần hiểu chủ sở hữu công trình, collision thực và đường tiếp cận, không đi xuyên tường hoặc nhầm căn cứ.

**Rủi ro và giới hạn diễn giải:** Không áp luật này cho mọi NPC trong mọi mode.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: đội quái đánh vào Gate/Heart/ kho với target score rõ, có đường phá tường khi bị chặn.

### 38. Vũ khí, đạn, chống giáp, status

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** Game có gun classes, ammunition families và armor; bản 2026 thêm Molotov, Flamethrower và slow bullet 3 giây có kháng khoảng 5 giây; armor energy/titanium miễn tác động slow tại bộ phận trúng. [S19][S22]

**Định lượng/biên dữ liệu:** Ví dụ 2025 Bizon 64 viên 9mm, AUG 5.56 mặc định 2× scope; slow 3s + resistance ~5s bản 1/2026.

**Động từ gameplay thực:** Chọn caliber, lấy supply, bắn/đổi đạn, đối phó giáp, chọn mục tiêu và khoảng cách.

**Quan hệ nhân quả:** Đạn là sink tài nguyên liên tục; lớp status tạo lựa chọn khác raw damage.

**Rủi ro và giới hạn diễn giải:** Các con số chỉ áp theo patch; không suy luận DPS trực tiếp từ 64 viên/băng.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: Skill Core có năng lượng/nhiệm vụ và yếu tố kháng hiệu ứng; không biến mọi skill thành projectile giống súng.

### 39. Vật nuôi, thú cưỡi, nuôi dưỡng và biến dị

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** 2023 hệ thú có capture, whistle, trưởng thành nhiều giai đoạn, fusion/evolution gene; 2026 bổ sung thú zombie cưỡi và chức năng có buff khai thác. [S13][S23]

**Định lượng/biên dữ liệu:** 2023 một người có thể sở hữu nhiều pet nhưng chỉ 1 pet ra trận; fusion một pet tối đa 5 lần; bản thân pet có 1–3 skill thường ngẫu nhiên.

**Động từ gameplay thực:** Thuần hóa, nuôi, tiến hóa, cưỡi, truyền pet tới một số battle, sử dụng đặc tính chiến đấu/khai thác.

**Quan hệ nhân quả:** Pet không đơn thuần cosmetic: giảm thời gian di chuyển, tăng yield, bổ sung công cụ combat.

**Rủi ro và giới hạn diễn giải:** Không lẫn pet cosmetic (2026 nói skin là thuần thẩm mỹ) với pet capability.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: linh thú vận chuyển và đào mỏ/kiếm tài nguyên, skill phụ trợ; giữ separate progression khỏi Hero.

### 40. Phương tiện mặt đất, biển, không

**Phân hệ:** NHÂN VẬT VÀ SINH TỒN. **Dữ kiện và phiên bản:** Các bản vá đưa ô tô lắp ráp, tàu ven bờ, trực thăng, glider, drone và nhiều loại khác; có cơ chế nhiên liệu, hỏng, bị tấn công; một số không thể copy công thức. [S09][S13][S14]

**Định lượng/biên dữ liệu:** 2023 ô tô lắp ráp tối đa 8 bánh và tối đa 8 hộp kho trên xe (theo patch); trực thăng có thể rơi dần khi hết nhiên liệu.

**Động từ gameplay thực:** Tìm hoặc lắp phương tiện, đổ nhiên liệu, chở hàng, đi đường mới, bảo vệ phương tiện khi loot.

**Quan hệ nhân quả:** Phương tiện là nâng cấp kinh tế hậu cần: thay đổi quan hệ giữa nhà, tiền đồn và POI xa.

**Rủi ro và giới hạn diễn giải:** Một số mode hoài cổ 2023 loại trực thăng/tank và glider; không thể khẳng định luôn dùng mọi vehicle.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: thú cưỡi, xe hàng, thuyền, cổng dịch chuyển hạn chế; tính chi phí tải/độ an toàn.

### 41. Mode theo chu kỳ và endgame reset

**Phân hệ:** META VÀ TIẾN TRÌNH. **Dữ kiện và phiên bản:** Mô tả chính thức gốc nêu chiến đấu 15 ngày và tranh Restart Badge; hướng dẫn 2019 ghi Standard 15 ngày, Intense 7 ngày và nhiều luật khác. [S02][S06]

**Định lượng/biên dữ liệu:** Từng có 7-day/15-day battle; huy hiệu xuất hiện trong giai đoạn cuối và thuộc tính cất tủ ảnh hưởng kết quả.

**Động từ gameplay thực:** Chọn trận, phát triển, cướp/tìm huy hiệu, bảo vệ tủ, chịu đợt endgame, nhận kết toán.

**Quan hệ nhân quả:** Thời gian hữu hạn làm opportunity cost tăng: xây nhà tối ưu tốc độ vs xây nhà thẩm mỹ.

**Rủi ro và giới hạn diễn giải:** Không gọi game là “đều reset 15 ngày”; 2026 có chu kỳ riêng và căn cứ không reset.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: đích dài hạn là khám phá/chiếm cứ điểm, không nhất thiết copy wipe; có thể có mùa/phân đoạn đảo.

### 42. Civilization mode: giai đoạn công nghệ toàn server

**Phân hệ:** META VÀ TIẾN TRÌNH. **Dữ kiện và phiên bản:** 2021 Civilization mode tăng Civilization Value khi nâng workbench, học recipe và thời gian; qua giai đoạn mới xuất hiện loại tài nguyên và công thức mới; tường bị giới hạn theo giai đoạn. [S10]

**Định lượng/biên dữ liệu:** Chia Primitive / Industrial / Modern trong thông báo; Primitive cao nhất stone, các giai đoạn sau có refined iron.

**Động từ gameplay thực:** Thu vật tư, nâng bàn, học recipe, đạt milestone cộng đồng, mở mỏ và vật liệu mới.

**Quan hệ nhân quả:** Tạo cảm giác tiến hóa xã hội thay vì cá nhân cày điểm level, đồng bộ nền kinh tế trận.

**Rủi ro và giới hạn diễn giải:** Một server có nhiều faction vẫn chia mốc mở công nghệ; không suy luận mọi công thức bắt buộc ở giai đoạn.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: thời đại di tích khai mở khi world progression đạt ngưỡng; song giữ quyền khám phá sớm nếu chuẩn bị tốt.

### 43. Chế độ 2026 tranh 49 mảnh đất

**Phân hệ:** META VÀ TIẾN TRÌNH. **Dữ kiện và phiên bản:** 2026 “Ace Overlord” chạy 7 ngày, 2× khai thác và 2× linh kiện; team khởi điểm 16, có 4 đất; chiếm qua điều khiển và tiến trình đếm ngược, chiến thắng khi có nhiều đất nhất hoặc lấy đủ 49. [S22]

**Định lượng/biên dữ liệu:** 49 ô; giữ controller 5 giây để kích hoạt và 10 phút chờ; khung thao tác 18:00–22:00; buff damage từ +1% tại 4 đất đến +10% tại 40 đất.

**Động từ gameplay thực:** Cướp huy hiệu khu, vận hành capture node, giữ đất, mở rộng đội, phối hợp bảo vệ.

**Quan hệ nhân quả:** Land control là một hệ logic quyền sở hữu hoàn toàn khác “đặt nhà ở đâu cũng được”.

**Rủi ro và giới hạn diễn giải:** Không nhầm chinh phục lãnh thổ với POI nhiều tầng hay outpost khai thác cá nhân.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: tiền đồn chiếm đóng và tuyến hỗ trợ có thể lấy cảm hứng nhưng cần chiến lược PvE cụ thể.

### 44. Đồ hiếm và game economy ngoài trận

**Phân hệ:** META VÀ TIẾN TRÌNH. **Dữ kiện và phiên bản:** Đồ skin, rare recipe, Workshop, trade coupon, cosmetics và vật phẩm vĩnh viễn tạo vòng tồn tại sau wipe; tiền tệ thật và shop gắn mô hình kinh doanh. [S09][S19]

**Định lượng/biên dữ liệu:** Workshop 2024 có 4 hòm sơ cấp/tuần từ login và phí key lịch sử 1.000 gold; khác Spares.

**Động từ gameplay thực:** Làm daily, mở hòm, chọn pattern, trao đổi, sưu tầm ngoại hình hoặc công thức hiếm.

**Quan hệ nhân quả:** Một người chơi có thể thua trận nhưng vẫn tích lũy thứ dài hạn; đó là trục giữ người chơi.

**Rủi ro và giới hạn diễn giải:** Cẩn trọng: loot box monetization không phải hệ thức gameplay cần clone.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: codex, achievement, rare Core recipes, trang trí nhà có thưởng khám phá; không cần random monetization.

### 45. Thông tin map/UX trong bản 2025–2026

**Phân hệ:** META VÀ TIẾN TRÌNH. **Dữ kiện và phiên bản:** Bản vá 2025 thêm POI selection với thông tin quái, thiết bị, rương và phòng thẻ; 2026 thêm tìm kiếm công thức ở chế tạo và hồ sơ. [S21][S19]

**Định lượng/biên dữ liệu:** 4 loại nội dung được mô tả cho map POI; công cụ search được ghi chính thức trong tháng 7/2026.

**Động từ gameplay thực:** Mở map, đánh dấu địa điểm, kiểm tra danh sách vật phẩm, tìm recipe theo tên.

**Quan hệ nhân quả:** Bản đồ không chỉ điều hướng; là planning tool để định tuyến cuộc expedition.

**Rủi ro và giới hạn diễn giải:** Cần thể hiện nguồn chưa biết khác nguồn đã biết, tránh spoiler toàn bộ map từ đầu.

**Chuyển dịch có kiểm soát cho Soul of Heroes [I]:** SOH: bản đồ nhật ký khám phá hiển thị nhu cầu loại nguyên liệu, track những nơi đã mở và gợi ý nguồn.

# PHẦN II — ATLAS MAP / ĐỊA ĐIỂM / TIỀN ĐỒN / TUYẾN KHAI THÁC

**Tách bốn danh từ thường bị lẫn:** (1) **POI hệ thống** là địa điểm cố định/trạng thái theo seed có quái, thùng, cửa, máy và Boss; (2) **căn cứ do người chơi xây** có vật chứa, bàn, chủ quyền; (3) **tiền đồn người chơi xây** là căn cứ nhỏ đặt trên mạng hành trình, thường dùng để hồi sinh/cất đồ/tiếp tế, không phải một “outpost capture” mặc định của game; (4) **territory/plot capture** là hoạt động chiếm đất đặc biệt của mode 2026. Chúng kết nối qua bản đồ nhưng có vòng đời, chủ sở hữu và ý nghĩa kinh tế khác nhau. [S01][S07][S22]

Thông tin loại thẻ và các điểm xuất hiện dưới đây là **lộ trình lịch sử 2019–2023**, có thay đổi trong một số bản do cơ chế random room. Cột “đề xuất cho SOH” chỉ là ứng dụng nguyên lý. Không có tọa độ tuyệt đối nào được xác thực cho mọi map 2026.

### POI 01 — Gas Station / Trạm xăng

**Bằng chứng / mô tả:** Đồ ven đường, thẻ xanh lá từng ở bàn theo hướng dẫn 2019 [S07][S17].

**Kiểm tra điều kiện và giới hạn:** Chủ yếu là điểm gần đường, dễ tiếp cận nhưng dễ bị phục kích bởi người khác. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Cầu nối giữa farm thùng đơn giản và tiếp cận phòng xanh lá. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Đặt trạm tiếp tế bên lộ để khám phá di tích sớm; nguồn nhiên liệu/điện khác gỗ đá. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 02 — Supermarket / Siêu thị

**Bằng chứng / mô tả:** Thẻ xanh lá lịch sử có thể nằm trên bàn; hòm thức ăn/đồ dùng tùy seed [S07].

**Kiểm tra điều kiện và giới hạn:** Đường vào thuận tiện nhưng dễ thành điểm lặp của người mới. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Đưa thực phẩm và công cụ gần với chu trình đói/khát, mở lộ trình chìa khóa. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Kho hàng bỏ hoang cung cấp vật liệu vải/đồ ăn/điều hướng, không nhất thiết có boss. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 03 — Warehouse / Nhà kho

**Bằng chứng / mô tả:** Hướng dẫn cộng đồng xem là điểm dựng nhà solo gần đó [S17].

**Kiểm tra điều kiện và giới hạn:** Mức độ giá trị/phòng thẻ thay đổi theo map; không có bảng drop cố định 2026. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Nhà kho là POI nguồn tiêu dùng, còn hòm của người chơi là storage có chủ quyền. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Kho phế tích với linh kiện chế tác và manh mối tuyến vận tải. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 04 — Abandoned Factory / Nhà máy bỏ hoang

**Bằng chứng / mô tả:** Nguồn hướng dẫn người chơi ghi phòng xanh lá cố định ở một số mode [S17].

**Kiểm tra điều kiện và giới hạn:** Cần kiểm tra điện/khóa, kiểm soát lính canh theo map. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Chuyển Spares thu được thành tri thức chế tạo thiết bị. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Nhà máy rèn cổ có mẫu lõi, lò và hòm vật tư cấp 1. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 05 — Abandoned Institute / Viện nghiên cứu bỏ hoang

**Bằng chứng / mô tả:** Theo hướng dẫn 2019 có xanh lá trên mái và xanh lá room; một số map đổi room [S07][S17].

**Kiểm tra điều kiện và giới hạn:** Yêu cầu tiếp cận tầng mái hoặc lối vào hợp lệ. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Nằm sớm trong công thức tri thức vì liên hệ lore–R&D–blueprint. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Thư viện nghiên cứu đặt khởi đầu chuỗi bí kíp cao cấp. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 06 — Harbor / Cảng

**Bằng chứng / mô tả:** Hướng dẫn chính thức 2019 ghi xanh lá trên mái, xanh lá room và tím room; container có hòm quân sự/supply [S07][S17].

**Kiểm tra điều kiện và giới hạn:** Lối container tạo đường tiếp cận không nhất thiết bắt buộc mở mọi phòng. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Điểm giao đất–biển, cung cấp loot và đích đến phương tiện. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Cảng cổ/nước sâu làm hub tài nguyên, mạch khóa và thuyền. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 07 — Airport / Sân bay

**Bằng chứng / mô tả:** Sau rebuild 2019 tăng diện tích 4–5 lần với hangar, máy bay, tháp tín hiệu, khu quân sự [S08][S09].

**Kiểm tra điều kiện và giới hạn:** Lịch sử có xanh dương/tím, lính và Avenger, về sau tank/vehicle loot. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Vừa là POI giàu đồ, vừa là không gian combat mở và nguồn phương tiện hiếm. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Pháo đài khí cầu với chiến đấu ngoài sân và hầm khóa sâu. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 08 — Nuclear Plant / Nhà máy điện hạt nhân

**Bằng chứng / mô tả:** Patch 2019 ghi bốn lối vào ống ngầm, năm vùng, zombie nặng, phòng thẻ [S08].

**Kiểm tra điều kiện và giới hạn:** Hazard môi trường và địa hình kín tạo áp lực quản lý đồ hồi phục. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Điện gắn lore với keycard, đường đi tầng ngầm và loot cuối tuyến. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Lõi linh năng bị ô nhiễm; cần giáp kháng và khởi động mạng cổ. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 09 — Bunker / Hầm trú ẩn

**Bằng chứng / mô tả:** Theo nguồn gốc có phòng xanh dương; hướng dẫn 2023 chia snow/desert bunker với thẻ khác nhau [S07][S17].

**Kiểm tra điều kiện và giới hạn:** Độ khó còn phụ thuộc vị trí biome và loại địch; dữ liệu không đồng nhất qua patch. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Chủ đề phòng kín nhiều tầng khiến thẻ có giá trị hơn việc băng qua map thẳng. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Bunker dưới núi tuyết/đồi cát, vật liệu kháng môi trường và đồ hiếm. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 10 — Biochemical Laboratory / Phòng thí nghiệm sinh hóa

**Bằng chứng / mô tả:** EG Mutant Boss được hướng dẫn lịch sử ghi xuất hiện, phòng xanh lá/tím, nguồn đồ cao cấp [S07][S17].

**Kiểm tra điều kiện và giới hạn:** Chu kỳ khoảng 3h là mốc cũ, không phải lời hứa trong bản 2026. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Boss vừa khóa loot vừa có thể cấp thẻ giúp mở công trình khác. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Thí nghiệm Soul Core hỏng, elite độc, kho tri thức có cơ chế power. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 11 — Bandit Camp / Trại cướp

**Bằng chứng / mô tả:** Hướng dẫn gốc đánh giá nguy hiểm do lính canh và phòng tím [S07].

**Kiểm tra điều kiện và giới hạn:** Cần quyết định đánh trực diện, lẩn tránh, cắt góc hay quay lại. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Phần thưởng cao đi cùng mật độ địch cao chứ không chỉ HP boss. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Trại lính đánh thuê giữ ấn phù bậc III hoặc vật liệu quý. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 12 — Military Base / Căn cứ quân sự

**Bằng chứng / mô tả:** 2020 xuất hiện khu vực tây biển, có cả phòng xanh lá/xanh dương/tím và Avenger theo thông báo [S09].

**Kiểm tra điều kiện và giới hạn:** Căn cứ ngoài trận khác “Operation Base” cá nhân; tên dễ nhầm. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Cho thấy địa điểm quân sự được tổ chức như super-POI nhiều mức. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Thành lũy địch với phòng hạng 1/2/3 và Boss canh kho. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 13 — Trading Zone / Khu thương mại

**Bằng chứng / mô tả:** Nguồn 2019 ghi máy bán thẻ màu và chức năng giao dịch; an toàn vùng này thay đổi theo ngày cuối chu kỳ [S06][S07].

**Kiểm tra điều kiện và giới hạn:** Có giai đoạn trước endgame là khu an toàn, về sau có mode gỡ an toàn. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Một địa điểm không yêu cầu giết quái vẫn chi phối toàn bộ supply chain. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Chợ thương hội và thư viện trao đổi với quota, giá vận tải. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 14 — Roadside Crate / Thùng lộ

**Bằng chứng / mô tả:** FAQ xác nhận barrel ở đường có blueprint; hướng dẫn nói loot các linh kiện thông thường [S04][S05].

**Kiểm tra điều kiện và giới hạn:** Timer theo server/loại thùng chưa xác minh. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Giúp player nghèo lấy Spares để research mà chưa cần boss. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Thùng cổ ven đường cung cấp mảnh tri thức và phụ kiện cơ bản. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 15 — Hidden Cave / Hang thú

**Bằng chứng / mô tả:** Nguồn cộng đồng mô tả hòm hỏng, thẻ màu ở vùng ẩn hoặc hang gấu [S17].

**Kiểm tra điều kiện và giới hạn:** Không đồng nhất mọi hang có thẻ, không có tỷ lệ định lượng chắc chắn. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Điểm bất ngờ khuyến khích đi lệch tuyến tối ưu. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Hang rễ cây cho thảo dược, tinh thể, lối tắt và rương bất ngờ. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 16 — Supply Drop / Airdrop

**Bằng chứng / mô tả:** Gắn với trang bị và combat, có thể bị tranh giành vì xuất hiện có giới hạn [S01][S05].

**Kiểm tra điều kiện và giới hạn:** Không có lịch drop cố định xuyên mọi mode. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Giá trị Airdrop gồm cả địa điểm bị lộ, kẻ địch kéo tới và loot. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Mưa sao băng/đoàn vận tải rơi, là world event có tín hiệu cho phép chuẩn bị. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 17 — Boss Arena / Trạm Boss

**Bằng chứng / mô tả:** Nguồn chính thức ghi một số boss gắn với phòng, tank, xe hoặc nguyên liệu riêng [S07][S08][S09].

**Kiểm tra điều kiện và giới hạn:** Loot chính xác Boss tùy patch; chu kỳ 3h/6h đã đổi địa điểm. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Chạy Boss không chỉ để trang bị mà để mở quyền tiếp cận công thức/vehicle. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** World boss có loot vật liệu duy nhất nhưng không là đường thăng tiến bắt buộc duy nhất. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 18 — Water Outpost / Trạm nổi

**Bằng chứng / mô tả:** Patch 2023 Operation Base bổ sung cứ điểm nổi và Boss cảng [S13].

**Kiểm tra điều kiện và giới hạn:** Nội dung thuộc base mode, không khẳng định có ở mọi bản đồ battle. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Cho phép vòng khám phá đi bằng thuyền hoặc ven bờ sau khi khai thông phương tiện. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Trạm nổi cần loại thuyền phù hợp, thêm loot chuyên biệt nghề cá. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 19 — High Resource Island / Đảo tài nguyên

**Bằng chứng / mô tả:** Patch 2025 mở vùng cấp cao với giới hạn 24 phút, nhóm tối đa 3 và 1/3 nâng quái thường thành elite [S21].

**Kiểm tra điều kiện và giới hạn:** Một instance có deadline khác bản đồ chính vô hạn. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Lựa chọn vào/rút và tải đồ trở nên quan trọng ngang chỉ số sát thương. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Hầm cổ mở cổng giới hạn; mục tiêu chính là mang loot về kịp. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 20 — Dawn Land / Bình Minh

**Bằng chứng / mô tả:** Bản đồ thứ ba công bố 2021, 7×7 km với 8 POI tăng thêm, đồi, sông, thung lũng và rừng [S10].

**Kiểm tra điều kiện và giới hạn:** Không nên lấy 49 km² làm diện tích map đang xây của SOH. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Các đường sông, độ cao, thung lũng giúp chọn vị trí công trình và tuyến hành quân. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Overworld chia vùng liên tục theo chức năng: nơi xây, đường di chuyển, khu hazard, di tích. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

### POI 21 — Operation Base / Căn cứ hành động

**Bằng chứng / mô tả:** Khu cá nhân tồn tại dài hạn với kho/xưởng/điểm buôn, chủ sở hữu rõ [S09].

**Kiểm tra điều kiện và giới hạn:** Không raid và không wipe theo mô tả ra mắt năm 2020. Không tự suy diễn tọa độ, hình dạng trên map hoặc loot rate hiện tại khi nguồn chỉ nói giai đoạn cụ thể.

**Quan hệ với kinh tế thế giới:** Điểm xuất phát–hồi phục–lưu trữ, bổ sung cho trận chiến theo chu kỳ. Tại nơi này phải tách ba giá trị: vật tư tiêu hao lấy được ngay, thông tin/quyền mở khóa mang về, và vị thế địa lý để tận dụng cho chuyến đi sau.

**Ánh xạ cho SOH [I]:** Căn cứ chính Soul of Heroes lưu vĩnh viễn, sở hữu nhà có nội thất/queue thực. Cần đặt đường trở về, vùng đặt tiền đồn hoặc không đặt được, loại hiểm họa, số loại khóa, và chu kỳ tái tạo loot riêng trong asset data, không chỉ mô tả bằng lore.

# PHẦN III — MẠNG QUAN HỆ CƠ CHẾ: ĐIỀU KIỆN → HỆ QUẢ

Phần này không liệt kê tính năng rời rạc: mỗi mẫu là một chuỗi có thể kiểm chứng bằng hành vi người chơi, chỉ rõ **điều kiện phát sinh**, **tài nguyên chảy qua hệ thống**, **đối nghịch/rủi ro**, **vòng lặp phản hồi** và **thử nghiệm tối thiểu**. Những chuỗi dưới đây là phép mô hình hóa [I] dựa trên các hệ gốc, không phải những quest có tên được xác nhận trong game.

### DEP-01 — Đường phế liệu → Spares → bàn nghiên cứu → súng

**Quan hệ:** Thùng ven đường cung cấp dòng đầu vào lặp được cho nghiên cứu, trong khi đồ cao cấp vẫn cần recipe và nguyên liệu gia công. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S04][S18]

**Ca kiểm chứng gameplay:** Test: người chơi farm đường một buổi, mở được ít nhất một nhánh cải tiến nhưng vẫn cần thám hiểm để hoàn thành. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-02 — Vũ khí nhặt được → dùng ngay HOẶC reverse engineering

**Quan hệ:** Một vật phẩm có độ bền được trao hai giá trị; nếu đem nghiên cứu thì thiếu sức mạnh ngay, nếu dùng hết có thể mất mẫu vật. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S04]

**Ca kiểm chứng gameplay:** Test: cho người chơi một món hiếm còn 20% độ bền, đo tỷ lệ chọn giữ/dùng/học. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-03 — Key xanh lá → POI xanh lá → key xanh dương → POI xanh dương → key tím

**Quan hệ:** Chuỗi thẻ là tiến trình tri thức và địa lý; mỗi lần thành công mở địa điểm mới chứ không chỉ một hòm lớn hơn. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S07]

**Ca kiểm chứng gameplay:** Test: map có tối thiểu một tuyến hợp lệ, không khóa vòng tròn deadlock. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-04 — Thẻ đúng → thiếu nguồn điện → không mở phòng

**Quan hệ:** Hai lớp điều kiện độc lập: credential và power; đi nhầm thứ tự có thể lãng phí lượt thẻ ở cơ chế cũ. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S07][S16]

**Ca kiểm chứng gameplay:** Test: UI nói rõ thiếu nguồn và không làm tiêu hao thẻ vô cớ trong SOH. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-05 — Hazard → đồ chống chịu → quyền tiếp cận POI

**Quan hệ:** Không đủ bảo hộ có thể vẫn chạm được cổng nhưng phải bỏ cuộc; cơ chế này tạo mục tiêu về vật liệu kháng môi trường. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S08]

**Ca kiểm chứng gameplay:** Test: có ít nhất hai chiến lược chuẩn bị: đồ chống chịu và đường di chuyển ngắn. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-06 — Biome khoáng → phôi → vật liệu quân sự → raiding

**Quan hệ:** Mỏ quặng tạo đầu vào gián tiếp của thuốc nổ/đạn/tường; một đợt đi mỏ phục vụ nhiều nhánh sản xuất. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S24][S25]

**Ca kiểm chứng gameplay:** Test: tài nguyên hiếm có ít nhất hai sink khác biệt, không là một chìa khóa độc dụng. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-07 — Nhà → kho → chuyến thám hiểm dài hơn

**Quan hệ:** Có kho giúp giảm giá trị của vật phẩm mang theo; sau khi về nhà người chơi được giải phóng slot và sẵn sàng đi xa. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S01]

**Ca kiểm chứng gameplay:** Test: sức chứa thực và khoảng về nhà ảnh hưởng quyết định route. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-08 — Tủ lãnh thổ → quyền xây → phân lớp bảo vệ

**Quan hệ:** Vị trí tủ quyết định quyền sửa/xây và giới hạn; kẻ thù đánh tủ là đánh vào năng lực duy trì căn cứ. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S09][S20]

**Ca kiểm chứng gameplay:** Test: phá/hỏng tủ tác động đúng các công trình thuộc phạm vi, không tác động nhầm lân cận. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-09 — Nhiên liệu → điện → cửa/bẫy → chi phí phòng thủ

**Quan hệ:** Dòng nhiên liệu phải trả liên tục để vận hành thiết bị; khi cạn, công trình thay đổi khả năng chống xâm nhập. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S16]

**Ca kiểm chứng gameplay:** Test: save/load sau khi generator tắt phải khôi phục đúng trạng thái thiết bị. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-10 — Chiến thuật chọn vị trí nhà → tần suất lượt farm

**Quan hệ:** Càng gần POI càng giảm quãng di chuyển nhưng tăng rủi ro bị người khác tìm thấy hoặc cướp đường. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S17]

**Ca kiểm chứng gameplay:** Test: ít nhất hai khu đất tạo trade-off khác nhau, không tồn tại vị trí toàn lợi. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-11 — Nâng bàn → mở nhánh recipe → đổi giá trị loot cũ

**Quan hệ:** Vật phẩm từng là rác có thể trở nên hữu dụng khi mở công thức dùng nó; progression tạo revaluation kho đồ. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S10][S18]

**Ca kiểm chứng gameplay:** Test: hệ recipe graph cho thấy tối thiểu một vật liệu tái định giá ở mỗi tier. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-12 — Căn cứ dài hạn → logistics giới hạn → trận reset

**Quan hệ:** Operation Base giữ tiến triển lâu dài nhưng hạn chế gửi đồ để không xóa khó khăn của trận mới. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S09]

**Ca kiểm chứng gameplay:** Test: whitelist và quota không cho gửi trái phép đồ cao cấp vào ngày 1. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-13 — Civilization Value → era mới → tài nguyên mới

**Quan hệ:** Tốc độ tiến trình của từng cá nhân kết nối với nhịp mở công nghệ tập thể; cơ sở vật chất và world phase thay đổi cùng nhau. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S10]

**Ca kiểm chứng gameplay:** Test: world stage update không reset recipe player đã học theo luật mode. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-14 — Huy hiệu endgame → đặt vào tủ → công trình có mục tiêu bảo vệ

**Quan hệ:** Từ sống sót thuần túy chuyển thành chiến lược bảo vệ một mục tiêu tọa độ cụ thể khi gần kết thúc trận. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S06]

**Ca kiểm chứng gameplay:** Test: sự kiện công bố vị trí/mốc có thời gian hợp lý và hành vi rõ. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-15 — Vườn → giảm chi phí chuẩn bị → nhiều chuyến đi hơn

**Quan hệ:** Farm tại nhà thay phần hoạt động thu gom thường lệ; player có thời gian dành cho thám hiểm mạo hiểm hơn. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S09]

**Ca kiểm chứng gameplay:** Test: sau 5 chu kỳ trồng, thời gian prep giảm mà nhu cầu farm loot quý không về 0. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-16 — Xe/thú cưỡi → tải hàng → bán kính hoạt động tăng

**Quan hệ:** Nâng mobility cải thiện giá trị kinh tế của POI xa, không chỉ tăng tốc độ để combat. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S13][S23]

**Ca kiểm chứng gameplay:** Test: route xa được rút số lượt qua lại hoặc số item bỏ lại. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-17 — Boss → vật liệu độc quyền → công thức cao

**Quan hệ:** Một nguồn duy nhất tăng giá trị boss nhưng cũng tạo cổng nội dung; nên cung cấp đích rõ, không bắt đánh vô hạn. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S08][S09]

**Ca kiểm chứng gameplay:** Test: mỗi vật liệu độc quyền có lý do, nguồn hiển thị và phương án lấy lại khi thất bại. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-18 — Death marker → cất đồ hiếm → chạy xác

**Quan hệ:** Cái chết tạo nhiệm vụ phụ có rủi ro cao hơn vì người chơi có thể quay lại mà thiếu trang bị. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S04]

**Ca kiểm chứng gameplay:** Test: túi rơi không bị nhân đôi, vị trí tồn tại qua save/load. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-19 — Lò luyện → sản xuất theo thời gian → tối ưu layout nhà

**Quan hệ:** Nhiều bàn sản xuất có thể khiến nhiệm vụ trở thành tối ưu lịch đặt hàng, kho, nhiên liệu và khoảng di chuyển. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S09]

**Ca kiểm chứng gameplay:** Test: queue không sinh item miễn phí khi tắt game giữa thao tác. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-20 — Xây nhiều thiết bị → quota → tối ưu công trình

**Quan hệ:** Quota tách theo loại phản ánh mức tải game; người chơi phải suy nghĩ chức năng mỗi ô xây dựng. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S14]

**Ca kiểm chứng gameplay:** Test: UI từ chối đúng loại vượt giới hạn và không xóa công trình đã tạo. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-21 — Tháp tự động → điện/đạn → bảo vệ kho

**Quan hệ:** Turret cho phép base mạnh hơn mà không biến nó thành miễn nhiễm; cần đạn/nguồn và vị trí góc bắn. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S14]

**Ca kiểm chứng gameplay:** Test: tháp không bắn xuyên tường, không nhắm thành viên được cấp quyền. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-22 — Hòm phân tán → nhiều điểm đột kích → chi phí raid tăng

**Quan hệ:** Phân mảnh tài sản làm kẻ cướp thiếu chắc chắn sau khi xuyên một bức tường; nhưng tăng thao tác người xây. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S15]

**Ca kiểm chứng gameplay:** Test: số tuyến tới mỗi kho có cách biệt về chi phí và rủi ro. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-23 — Mở map POI metadata → lên kế hoạch expedition

**Quan hệ:** Khi người chơi thấy loại quái/thùng/cửa, route planning biến thành lựa chọn có thông tin thay vì mò mẫm ngẫu nhiên. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S21]

**Ca kiểm chứng gameplay:** Test: UI chỉ tiết lộ metadata đã khám phá và không phá bất ngờ nội dung. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-24 — Workshop pattern → meta recipe → vòng sống sau reset

**Quan hệ:** Một mục tiêu sưu tầm ở sảnh tồn tại bên cạnh vòng battlefield, giữ giá trị của phần thưởng khi trận kết thúc. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S19]

**Ca kiểm chứng gameplay:** Test: recipe sở hữu meta không vô tình biến thành item free trong battle. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-25 — Pet harvesting buff → năng suất mỏ → công thức cấp cao

**Quan hệ:** Tăng năng suất khai thác trực tiếp ảnh hưởng chiến lược nâng thú và lựa chọn tuyến mỏ. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S23]

**Ca kiểm chứng gameplay:** Test: buff không nhân bất thường với vật liệu quý, định nghĩa yield rõ. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-26 — Molotov → tường gỗ → lựa chọn nâng cấp nhà

**Quan hệ:** Vũ khí cháy gây thêm damage lên công trình gỗ theo patch 2026, thúc đẩy việc đầu tư vật liệu tường. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S19]

**Ca kiểm chứng gameplay:** Test: bảng hiệu quả chống cháy hiển thị và chống exploit chồng lửa. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-27 — Cầu thang/mái cong → đường đi 3D → góc nhìn top-down

**Quan hệ:** Các cấu kiện cong và mái tạo liên thông topo nhưng cũng gây vấn đề occlusion/collision trong bản chuyển 2D. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S13]

**Ca kiểm chứng gameplay:** Test: nhân vật đi vào phòng thì mái phòng đó mờ, camera không che cửa. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-28 — Đội mở recipe → quyền sử dụng tạm → thay đổi thành viên

**Quan hệ:** Trong Zombies Tide Trial thành viên mới dùng chung công thức, nhưng rời team mất quyền, không mất kiến thức cá nhân có từ trước. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S20]

**Ca kiểm chứng gameplay:** Test: khi rời team, chỉ revoke quyền group-granted, không khóa recipe cá nhân. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-29 — Thu hoạch thời vụ → thời gian hàng chờ → đi loot trong lúc chờ

**Quan hệ:** Trồng trọt và nghiên cứu làm player có việc chờ, tạo lý do luân phiên nhiệm vụ quanh căn cứ. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S09]

**Ca kiểm chứng gameplay:** Test: hành động dài không yêu cầu đứng bất động nếu không có quy định. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-30 — Chiếm đất → quyền đội → buff damage → mở rộng quyền chiếm

**Quan hệ:** Mode 2026 tạo feedback dương khi nhiều đất đem bonus, đồng thời định thắng bại theo số đất và khung giờ thao tác. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S22]

**Ca kiểm chứng gameplay:** Test: không cho capture ngoài 18–22h; buff áp theo milestone đúng mode. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

### DEP-31 — Giết Boss để lấy thẻ → mở phòng → kiếm mẫu → nghiên cứu

**Quan hệ:** Chồng tuyến combat, access, tech vào một mission nhưng vẫn cho lộ trình khác để tránh linear. **Vị trí trong mạng hệ thống:** map cung cấp điều kiện, inventory mang chi phí, base làm nơi lưu trữ/chế biến, recipe biến loot thành khả năng, và expedition tái đầu tư phần thưởng. [I] [S07]

**Ca kiểm chứng gameplay:** Test: đồ nghiên cứu và phần thưởng phòng có identity khác đồ boss. Nếu bài test không làm được bằng thao tác trong game thì đây mới chỉ là tên tính năng trên bảng, chưa phải hệ thống chơi được.

# PHẦN IV — 12 KỊCH BẢN “CHƠI THỰC” ĐỂ KIỂM TRA VÒNG LẶP

Các tình huống bên dưới là **test cases thiết kế dành cho Soul of Heroes [I]**, không phải lời tuyên bố đây là những quest đã tồn tại trong Last Island. Mỗi kịch bản buộc cùng lúc vận hành map, storage, item instance, recipe, threat và save. Chi phí/số vật phẩm minh họa phải được balance qua gameplay thực tế.

### USER-JOURNEY 01 — Buổi đầu tay trắng

**Diễn biến cụ thể:** Người chơi tỉnh dậy ở bìa rừng; từ đá/gỗ làm công cụ, tìm thức ăn, biết vị trí nước. Sau vài lượt chặt cây, họ nhìn thấy lều đổ và thùng đồ ven lộ. Có thể đi thẳng tìm đồ nhưng lúc này không có kho, không có điểm hồi sinh và vật dụng phòng thân kém. Quyết định đặt nền và 4 tường cho nhà nhỏ khiến chuyến sau có nơi gửi đồ.

**Quan hệ cơ chế:** Vật liệu thô → tool → nhà đầu tiên → kho → chuyến loot có mục tiêu.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Không khóa người chơi trong tutorial tuyến tính; sau khi tạo nhà, không bắt vào dungeon ngay.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 02 — Thùng đồ và bất ngờ về tri thức

**Diễn biến cụ thể:** Trong khi farm ven lộ, người chơi nhặt một Core lạ còn rất ít lượt dùng và một mảnh bí kíp. Core hiện tại giúp hạ một quái mạnh nhưng không đủ kéo dài trận. Nếu chọn dùng hết trước khi có cách học, họ có thể phải đi tìm món tương tự lần nữa. Nếu đem về giải mã sẽ thiếu sức mạnh trong chuyến khám phá đang dang dở.

**Quan hệ cơ chế:** Item instance giới hạn → lựa chọn dùng/cất/học → blueprint knowledge → sản xuất lặp lại.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Không gắn sở hữu item với quyền chế tạo; những lựa chọn cần được UI giải thích chính xác.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 03 — Mở phòng xanh lá đầu tiên

**Diễn biến cụ thể:** Người chơi tìm thấy một phòng khóa ở viện nghiên cứu; lúc tới thiếu chìa khóa. Ghi lại địa điểm và phát hiện nguồn thẻ ở khu bến hàng. Sau khi nhặt thẻ, họ phải kiểm tra mạch điện ở ngoài cửa; nếu mạch mất nguồn, cần sửa máy phát trước khi dùng thẻ. Vào phòng thu thêm vật tư và đầu mối hạng hai.

**Quan hệ cơ chế:** Ký ức vị trí → khám phá nguồn key → điện → loot → key cấp tiếp.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Kiểm thử softlock: luôn còn con đường tạo/kiếm nguồn phù hợp nếu người chơi tiêu hao nhầm thẻ.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 04 — Lần thử thất bại tại vùng độc

**Diễn biến cụ thể:** Một cổ tích sâu trong đầm có tinh thể cần cho Core. Người chơi đủ sát thương để hạ lính gác nhưng lượng kháng độc thấp, chỉ vào được vài phút. Họ quay về trồng dược thảo, luyện mặt nạ kháng và tìm tuyến tắt tránh trung tâm vùng nguy hiểm. Lần thứ hai họ thành công dù cấp Hero không đổi.

**Quan hệ cơ chế:** Hazard → crafting protective → đủ thời gian ở trong POI → loot vật liệu mở công thức.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Không tự động nâng level để triệt tiêu độc; kiến thức và sự chuẩn bị được thưởng.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 05 — Thiết kế lại căn nhà theo vòng sản xuất

**Diễn biến cụ thể:** Nhà ban đầu chứa tất cả đồ trong một phòng; sau khi có lò, xưởng và research bench, người chơi phải mang quặng qua nhiều cửa. Họ nới nền, thêm phòng lò, phòng kho sạch và ngõ ra vườn. Một bức tường sai chỗ chặn lối đi được tháo ra, đồ trong rương không mất.

**Quan hệ cơ chế:** Construction topology → thời gian thao tác → hiệu quả sản xuất → tiến trình vật chất.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Collision, ownership và save phải đúng; không chỉ thay texture căn nhà.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 06 — Chuyến đi xa có tiền đồn

**Diễn biến cụ thể:** Biết quặng quý ở biên rừng tuyết, người chơi cần 2 lần chạy từ nhà và mang ít đồ vì túi đầy. Họ dựng lều, hòm và điểm neo ở ngã ba an toàn. Tiền đồn trở thành nơi cất vật liệu tạm, nhưng dễ bị phá nếu đặt sát trạm quái; cất hết đồ quý tại đó là quyết định rủi ro.

**Quan hệ cơ chế:** Map distance → logistics → outpost cost → expanded action radius.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Tiền đồn phải có chức năng sử dụng thật, trạng thái riêng và mối quan hệ với căn cứ chính.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 07 — Một chuyến loot lời nhưng không hiệu quả

**Diễn biến cụ thể:** Người chơi lấy được 50 đơn vị quặng phổ thông nhưng tốn gần hết đồ hồi phục, gãy công cụ và chỉ còn ít chỗ trống để lấy mảnh Core hiếm. Nếu UI chỉ báo tổng số loot thì chuyến đi trông thành công; xét tài nguyên ròng lại là thất bại. Người chơi cần cân nhắc bỏ quặng thường để lấy tri thức hiếm.

**Quan hệ cơ chế:** Revenue loot − consumable cost − danger risk − travel time.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Thử nghiệm đo net gain, không dùng giá trị hiếm đơn thuần để chấm nhiệm vụ.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 08 — Công thức đồ mới làm thay đổi giá trị kho cũ

**Diễn biến cụ thể:** Trước đó người chơi không có cách dùng mảnh quái rừng, nên cất chúng trong rương “rác”. Khi mở công thức Core kháng độc, vật liệu này trở thành thành phần thiết yếu. Người chơi vui vì không phải farm lại từ đầu và muốn rà soát kho cũ trước chuyến đi kế tiếp.

**Quan hệ cơ chế:** Knowledge unlock → demand shock → revaluation inventory → new crafting opportunity.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Cần search recipe, ingredient reverse lookup và bộ lọc kho; không bắt nhớ mọi công thức.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 09 — Bảo vệ căn cứ khỏi một đợt tấn công có báo trước

**Diễn biến cụ thể:** Một sự kiện cho biết đàn quái có thể tới qua cổng phía tây sau khi người chơi kích hoạt relic. Người chơi gia cố cửa, lắp bẫy, đặt cung thủ, tách thùng quý khỏi tuyến đột nhập. Một tường bị phá tạo lối mới; AI phải pathfind qua chỗ thủng, không xuyên tường còn nguyên. Thất bại có thể sửa lại phòng, không tự xóa save.

**Quan hệ cơ chế:** Threat announcement → preparedness → construction HP/collision → defense battle → repair cost.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Hãy đo số lần AI stuck, exploit góc, damage hợp lệ và khả năng khôi phục sau save/load.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 10 — Hệ công thức chia sẻ không đồng nghĩa công thức cá nhân

**Diễn biến cụ thể:** Giả sử người chơi tạm tham gia một căn cứ đồng đội trong mode thích hợp, thấy công thức mới được mở theo cấp tủ. Khi rời nhóm, công thức ấy lại khóa; nhưng công thức cá nhân đã học từ trước vẫn hoạt động. Kho đồ và trang bị đang mang theo phải xử lý theo luật mode thay vì xóa tùy tiện.

**Quan hệ cơ chế:** Personal knowledge ∪ group license → craft permission; revoke only group scope.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Cơ chế này chỉ có ý nghĩa nếu SOH có team/settlement; với game solo không cần ép cho đủ danh mục.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 11 — Boss cho loot hơn một chức năng

**Diễn biến cụ thể:** Một elite ngoài tường thành đánh rơi tinh thể quý, nhưng còn có một dấu ấn để mở phòng thẻ. Người chơi chưa học công thức liên quan nên vật phẩm mang về có giá trị thông tin. Khi xem Codex biết thẻ mở một kho khác, chuyến đi kết thúc trở thành khởi đầu một chuỗi tự đặt mục tiêu.

**Quan hệ cơ chế:** Boss drop → credential + crafting ingredient → travel to new POI → deeper recipe.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Không đặt tất cả phần thưởng rare độc quyền sau boss: bảo tồn đường khám phá/puzzle/rủi ro phi chiến đấu.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

### USER-JOURNEY 12 — Giai đoạn cuối nhiều phương án chơi

**Diễn biến cụ thể:** Sau khi có nhà chính, vài tiền đồn, vườn và bộ Core đủ dùng, người chơi có thể chọn khai thác tuyến mỏ, săn bản vẽ, khôi phục trạm điện cổ, nâng cấp nhà hay vào dungeon. Trong mỗi lựa chọn phải có một kết quả về vật liệu, tri thức, tuyến di chuyển hoặc chủ quyền; không phải chỉ tăng XP.

**Quan hệ cơ chế:** Parallel loops: world ecology + recipe tech + owned base + combat challenge.

**Điều kiện nghiệm thu trong Soul of Heroes [I]:** Kiểm thử ít nhất 3 buổi chơi liên tiếp không vào dungeon mà vẫn tiến triển thật, rồi vào dungeon với sự chuẩn bị đã tích lũy.

**Nhật ký cần thu khi playtest:** thời lượng từng việc, lượt đi–về, ô kho dùng, item ID đã cấp/đã tiêu, công thức đã học, độ bền trước/sau, số lần mở/cửa thất bại, số lần đổi route, số lần chết/nhặt lại đồ, tác động của công trình tới AI và thay đổi save state. Chỉ khi dữ liệu này có thật mới được công bố cân bằng hoặc tuyên bố đạt parity với cảm giác survival.

## 46. Mô hình kinh tế lượng: biến số và cách đo thay vì số đo bịa

**Chu kỳ chuyến đi:** Đặt `V = Σ giá trị đầu ra chuyển đổi được - Σ vật tư tiêu hao - chi phí sửa - chi phí vận chuyển - kỳ vọng rủi ro mất đồ`. Đây là hàm phân tích, không phải công thức game gốc. Với người chơi solo, “giá trị” không chỉ là tiền: có thể là 1 Recipe mới, 1 đường tắt, 1 chỗ đặt căn cứ hay 1 ngày giảm phụ thuộc dược liệu. Nếu cộng điểm tất cả về vàng sẽ bỏ sót động lực khám phá. [I]

**Khoảng cách:** Đặt `T_route` là thời gian một vòng nhà→POI→nhà gồm đường đi, né quái, mở khóa, tải đồ, hồi phục. Giá trị tiền đồn không nằm ở skin lều mà ở `ΔT = T_route_base − T_route_outpost − T_setup_outpost`. Nếu ΔT âm trong mọi tình huống, tiền đồn chỉ là đồ trang trí. Kiểm thử các route dài/ngắn, ngày/đêm và khi nhân vật nặng đồ. [I]

**Giá trị công thức:** `Recipe utility = tần suất cần item × lợi ích thay tự nhặt item − chi phí research − chi phí crafting`. Công thức ra item hiếm nhưng chỉ có 1 tình huống dùng có thể kém đáng học hơn công thức thuốc hồi máu phổ thông. Vì thế game phải có nhiều nhánh hợp lệ chứ không đơn thuần “tier cao thì luôn tốt hơn”. [I]

**Độ hiếm và rarity bất định:** Không nhập tỷ lệ rơi từ nguồn cũ vào mô hình 2026. Để kiểm định, thu ít nhất 100 lượt mở hòm cho từng loại và phiên bản (nếu có build được phép test), ghi seed/server, mục nhận, điều kiện modifiers; interval 95% và nguồn dữ liệu phải có. Một mẫu nhỏ không đủ khẳng định chance rare. Không dùng đồng thời công thức buff khác mode. [I]

**Base throughput:** Tốc độ xưởng phụ thuộc số queue, thời gian craft, nhiên liệu, đầu vào, trạm nghiên cứu và khoảng thao tác. Nâng cấp lò tăng throughput chỉ có ý nghĩa khi không bị nghẽn ở quặng/fuel. Cần đo `items per active minute`, số thao tác, số slot kho chờ và queue idle; không thể kết luận một lò cao cấp luôn hiệu quả hơn nếu thiếu nhiên liệu. [I]

**Raid defense as route optimization:** Nếu mỗi cửa/tường có chi phí phá riêng, kẻ tấn công tìm đường có chi phí nhỏ nhất tới kho/tủ. Thiết kế phòng phân lớp có giá trị khi nó tăng “minimum breach cost”; một nhà có tổng HP khủng nhưng một cửa yếu vẫn dễ thủng. Trong SOH đây là sơ đồ phòng thủ PvE; thuật toán không cần clone weapon balance của Last Island. [I]

**Nguy hiểm môi trường:** Có thể biểu diễn `survival_time ≈ effective protection pool / expected environmental loss rate`, nhưng công thức thực tế cần kiểm chứng debuff, stack, refresh, thức ăn và thuốc. Ở bản 2019 có hazard cấp 2, nhưng bản 2020 từng loại bỏ nó khỏi phòng thẻ; vậy số liệu phải có nhãn bản và mode. [S08][S09][I]

**Tỷ lệ meaningful activities:** Đo phần thời gian người chơi dành cho thu thập, chuẩn bị, xây, nghiên cứu, chiến đấu, di chuyển vô nghĩa, chờ timer. Mục tiêu không phải ép tỷ trọng cố định mà giảm “thời gian không có lựa chọn”; các quá trình chuẩn bị có thể hấp dẫn nếu tạo quyết định đủ sâu. [I]

## 47. Bảng dữ kiện định lượng có thể truy nguồn (không lẫn phiên bản)

| Mốc | Con số | Phạm vi áp dụng được nguồn mô tả | Không được hiểu thành |
|---|---:|---|---|
| 2019 | 15 ngày | Standard và một số Restart mode lịch sử [S06] | Tất cả mode 2026 luôn 15 ngày |
| 2019 | 7 ngày | Intense mode lịch sử [S06] | Chu kỳ chung |
| 2019 | khoảng 3 giờ | Thẻ tím trong phòng xanh dương theo hướng dẫn, và EG Mutant tại lab [S07] | Mọi loại thẻ, quái hoặc 2026 |
| 2019 | 4–5 lần | Sân bay tăng diện tích khi rebuild [S08] | Sân bay hiện tại to hơn 4–5 lần mốc 2026 |
| 2019 | 4 cửa, 5 phân khu | Đường hầm Nuclear Plant khi rebuild [S08] | Mọi POI có 5 tầng |
| 2020 | tối đa 40 điểm | Heat stack theo patch 1/2020 [S11] | Nhiệt độ chung mọi mode |
| 2020 | 10 người | Operation Base cho phép tối đa 10 người được cấp quyền xây [S09] | Party size gameplay combat |
| 2020 | 1 lần/ngày/đích | Base→battle theo quy định ban đầu [S09] | Tất cả trao đổi |
| 2020 | 5 cấp × 30 phút | Zombie Siege Base trong bản 2020 [S09] | Zombies Tide Trial 2026 cùng thời lượng |
| 2020 | tối đa 20 lần/ngày | Lấy thưởng Base Bounty theo mốc cập nhật [S09] | Daily activity ở mọi mode |
| 2021 | 7.000×7.000 m | Dawn Land; diện tích hình vuông quy đổi 49 km² [S10] | Tất cả map cùng kích thước |
| 2021 | 8 POI | Dawn Land thêm 8 POI [S10] | Tổng số POI bản 2026 |
| 2021 | 30 phút, 30 phút, 1 phiếu | Save/place Base Blueprint cooldown và chi phí ra mắt [S12] | Cơ chế Recipe R&D |
| 2021 | 6 chữ số | Password chia sẻ Base Blueprint [S12] | Keycard phóng xạ |
| 2023 | 10 nền / 40 m | Giới hạn dài theo hướng [S14] | Mọi vùng xây được tối đa 40 m |
| 2023 | 7 nền / 28 m | Giới hạn bán kính công trình [S14] | Bán kính quyền lãnh thổ chung |
| 2023 | 30 kho; 80 điện; 20 lò | Quota nhóm công trình trong patch [S14] | Quota căn cứ cá nhân 2020 |
| 2023 | 1–3 skill pet, ≤5 fusion | Pet và fusion theo patch [S13] | Skill Hero hoặc Skill Core |
| 2024 | tối đa 4 người | PvE Zombie Chaos mode (thông báo riêng) [S19] | Tất cả PvE mode |
| 2025 | 24 phút; 3 người; 1/3 | High Resource Uninhabited Island [S21] | POI thông thường |
| 2025 | 64 viên 9mm | Bizon khi giới thiệu [S21] | Tổng DPS hoặc ammo economy |
| 2026 | 49 lô; 7 ngày | Ace Overlord mode [S22] | Map gốc chia 49 chunk |
| 2026 | 5 giây + 10 phút | Tác động lên controller rồi hoàn thành capture [S22] | Time craft/đột kích |
| 2026 | +1% tới +10% | Milestone damage bonus theo số đất [S22] | Buff tất cả server |
| 2026 | 100m → 200m → 100m | Thay đổi khoảng cách tủ trong Zombies Tide Trial các tháng 4–7 [S20][S23] | Một khoảng cách bất biến |
| 2026 | 3 giây slow; khoảng 5 giây kháng | Slow bullet trong patch 1/2026 [S22] | Tất cả kỹ năng slow |

## 48. Danh mục Recipe — cách đọc đúng những mẫu cũ và nơi còn trống

**Có thể xác nhận chắc:** Recipe/Blueprint là quyền chế tạo; Spares là tiền nghiên cứu; Drawing Table dùng mẫu vật; R&D chọn công thức có tại một số mode 2023; Civilization mode 2021 chuyển sang mở định hướng theo nâng cấp; Workshop 2024 có pattern+credit; Zombies Tide Trial 2026 được cấp quyền toàn nhóm từ nâng tủ. [S04][S10][S18][S19][S20]

**Mẫu công thức lịch sử (không gọi là dữ liệu 2026):** Gunpowder = 30 Charcoal + 20 Sulfur Powder; 9mm = 10 Iron Bars + 5 Gunpowder; 5.56mm và 7.62mm ghi cùng giá tại bàn trung cấp; explosive bullets cần thêm Sulfur Powder; Bandage = 5 Cloth; Jam = Wild Berries + Cloth + Tin Can. Hướng dẫn cộng đồng ở thời kỳ 2019–2020 có các bảng này, đôi khi xung đột số lượng/chi tiết cấp bàn. Đây là dữ liệu mô tả *recipe graph*, không phải một bảng có thể phát cho người chơi 2026. [S25]

**Khoảng trống thực tế:** Không có nguồn đáng tin đủ độ bao phủ cho danh sách tất cả đồ ăn, vật nuôi, súng, đạn, giáp, công trình, điện, phòng thủ, xe và recipe sự kiện. Để có một bản catalogue xác nhận 100%, cần quét UI in-game của đúng client/version, chụp trạng thái từng danh mục ở nhiều cấp bàn và mode, phân biệt recipe account, recipe đội, kho và công thức item đang mang. Số item mới được thêm theo mùa làm việc tuyên bố “full recipe list” mà không nêu version rất dễ sai. [?]

**Đề xuất cấu trúc Recipe Registry cho SOH [I]:** recipe_id, output_item_id, output_qty, input_items[{item_id,qty}], station_kind, station_tier, blueprint_item_id, unlock_methods, unlock_cost, research_time, crafting_time, durability_policy, ownership_scope, mode_allowlist, stack_limit, bind_rule, salvage_rule, source_pois, test_fixture_id, status, source_version. Trong runtime, kiểm điều kiện theo mode trước, rồi quyền recipe, station, input, queue; trả transaction chỉ sau khi bảo đảm spawn output. [I]

## 49. Thuật ngữ chính xác dành cho Soul of Heroes

- **POI (Point of Interest):** công trình/địa điểm được thiết kế hoặc tạo theo world seed; có loot, địch, đồ nghề, khóa, Boss. Không tự động là “đất” có chủ quyền.
- **Player Base:** công trình sở hữu của người chơi, có storage, stations, respawn, defenses; có thể nằm trong battle và chịu wipe nếu luật mode thế.
- **Operation Base:** hệ căn cứ cá nhân đặc thù được giới thiệu năm 2020, tồn tại dài hạn, không raid; không đồng nghĩa với bất kỳ căn nhà chiến đấu nào.
- **Outpost (tiền đồn):** nơi phục vụ tuyến thám hiểm hoặc kiểm soát lãnh thổ; chỉ là nhóm chức năng, không có chứng cứ mọi mode hiện hành có một loại building chính thức mang tên Outpost.
- **Territory Cabinet:** tủ điều khiển lãnh thổ; quản quyền, giới hạn, upkeep hoặc huy hiệu tùy mode. Không phải cây skill.
- **Construction Blueprint:** gói cấu kiện theo không gian có thể lưu và tái đặt trong giới hạn; khác Recipe.
- **Crafting Recipe / Plan / Blueprint:** quyền chế tạo đầu ra từ nguyên liệu; có vòng đời riêng và có thể học.
- **Drawing Table:** nghiên cứu ngược mẫu vật đã cầm trong tay để đạt kiến thức.
- **R&D Bench:** dùng Spares và luật mode để nghiên cứu Plan.
- **Spares:** tài nguyên nghiên cứu/kinh tế; không đồng nghĩa với tiền tệ shop.
- **Rare Recipe:** nhóm recipe có quy tắc cấp tài khoản/căn cứ và lưu giữ đặc thù; từng mode có hạn chế riêng.
- **Workshop Pattern:** mảnh/mẫu để tổng hợp blueprint hoặc vật phẩm sưu tầm ở giao diện Workshop.
- **Keycard:** thẻ màu để mở tầng phòng, có thể đòi mạch điện; keycard không phải chìa khóa cửa nhà người chơi.
- **Hazard:** điều kiện môi trường như radiation/corruption/cold hoặc các biến thể theo patch; phân biệt với damage vật lý.
- **Progression:** tiến trình cá nhân, trận, Civilization era, căn cứ, faction và tài khoản có life cycle khác nhau.
- **Raid:** tấn công công trình để đạt loot/quyền chủ sở hữu; khác defend wave và khác farm Boss.
- **Wipe:** reset dữ liệu nhất định theo mode; không mặc định xóa mọi thứ thuộc tài khoản.
- **Loot node:** nguồn vật phẩm hữu hạn hoặc hồi theo chu kỳ như thùng, quái, hòm, POI.
- **Meta-progression:** thứ tích lũy qua các vòng chơi, có thể là recipe hiếm, ngoại hình, thành tựu; khác đồ nhặt trong một trận.

## 50. Kiểm định kỹ thuật nếu chuyển hành vi vào game top-down Godot

**World representation:** Chia thành static terrain seed + POI state + dynamic player-built structures + independent furniture/inventory instances. Nơi có tường hoặc cửa phải cập nhật collision và đường đi cục bộ. Nếu một base thay đổi một mảng nhỏ, không nên rebuild toàn map; lưu tọa độ chunk, rotation, owner và revision. Tài liệu SOH người dùng đã bàn về OverworldState, SaveService và loot; đây là ngữ cảnh do người dùng đưa, không phải audit repo mới ở lượt này. [I]

**Build transaction:** Preview vị trí → kiểm đất hợp lệ → kiểm khả năng nối/sàn/vùng bảo hộ → kiểm quota vật thể → reserve inventory materials → commit building entity → cập nhật collision/navigation → save snapshot. Thất bại ở bất kỳ bước trước commit phải hoàn toàn không tiêu vật liệu; nếu crash sau commit phải có event log để khôi phục một lần duy nhất. [I]

**Research transaction:** Check quyền research, input vật phẩm mẫu, Spares và station → reserve → atomically mark learned recipe + consume sample + write journal → emit UI event. Nếu lưu thất bại không được tình trạng vừa mở bí kíp vừa còn mẫu và Spares; nếu item bị chuyển kho trong lúc chạy phải khóa transaction. [I]

**Production queues:** Lò, farm, workbench và trạm nghiên cứu có queue, fuel, item stacks, start/end ticks và trạng thái bị chặn. Nếu offline simulation được hỗ trợ, tiến trình phải dùng timestamp có giới hạn để tránh time-travel exploit, đồng thời kiểm input/output khi phục hồi. Không có queue thì nhà xưởng nhanh chóng thành hoạt cảnh chứ không phải hoạt động kinh tế. [I]

**Access graph:** Với mỗi cổng khóa định nghĩa required_items, requires_power, consumes_credential, weather_eligibility, enemy_gate, unlock_persistence, available_alternate_routes. Dữ liệu này hỗ trợ bản đồ, UI và test softlock. Dùng “đã khám phá” và “đã mở khóa” làm hai trạng thái khác nhau. [I]

**Player death:** Vật phẩm mang theo được chuyển vào death bag bằng transaction; recipe knowledge không bị sao chép vào bag; cờ respawn về Soul Anchor hợp lệ. Khi death bag bị looted/expire phải ghi event. Kiểm thử save/load vào đúng khung hình chết, offline map và đồng bộ chest. [I]

**AI combat in buildings:** Quái cần có vùng phát hiện, pathfinding, target structure, attack animation và damage hitbox; nếu không có đường qua mà target ở trong nhà, phải có trạng thái phá công trình hoặc bỏ cuộc. Không cho xuyên tường, không nhắm liên tục qua mái vô hình; phải pathfind lại sau khi cửa mở hoặc tường sập. [I]

**Performance:** Với map lớn, load các chunk quanh camera; cache resource nodes, ngủ AI xa màn hình, giới hạn active projectiles/VFX và rebuild nav cục bộ. Dữ liệu lịch sử bản gốc từng áp quota công trình để chống crash; SOH nên benchmark thực tế thay vì sao chép quota 40 m/28 m bất kể kích thước tile. [S14][I]

## 51. Những vấn đề chưa đóng: 40 câu hỏi phải dùng build thật để xác minh

1. Bản quốc tế 2.45.0 có đồng nhất đúng recipe list với bản Trung Quốc tháng 9/2026 không? 2. Mỗi mode áp những weapon/boss nào? 3. Map seed có thay POI positions theo lần mở trận không? 4. Có bao nhiêu map đang hoạt động và mỗi map diện tích ra sao? 5. Có bao nhiêu tầng phòng thẻ theo map cụ thể? 6. Mỗi thẻ có durability/charge bao nhiêu? 7. Phòng tím còn hazard ở mode nào? 8. Loại khẩu trang nào kháng hazard cụ thể? 9. Respawn của thùng ven đường theo loại là bao lâu? 10. Một người có thể cất được bao nhiêu blueprint chưa học? 11. Mỗi recipe học qua Drawing Table tiêu mẫu theo quy tắc nào? 12. Những item nào không thể copy? 13. Chi phí Spares theo từng recipe và mode? 14. Mỗi workbench unlock bao nhiêu recipe? 15. Recipe trung cấp có share trong party ngoài Operation Base không? 16. Rare Recipe có mất nếu đổi mode? 17. Workshop Pattern có thể đổi hoặc recycle không? 18. Có bao nhiêu nhóm item trong giao diện Craft 2026? 19. Lò từng loại tiêu nhiên liệu theo giây thế nào? 20. Thời gian nấu nguyên liệu có chạy khi logout không?

21. Tủ lãnh thổ tiêu upkeep theo công thức nào ở mode hiện hành? 22. Kiểu xây nào còn chịu ổn định kết cấu? 23. Cấp vật liệu tường và HP tương đối mới nhất? 24. Có thể xây nhà trong vùng quanh POI hoặc safe zone không? 25. Radius quyền tủ từng mode cụ thể? 26. Blueprint nhà đặt lại có tính vật tư đặc biệt thế nào? 27. Mỗi server cho tối đa bao nhiêu bản blueprint được lưu? 28. Các giới hạn 2023 đã được nới năm 2026 chưa? 29. Có thể đặt bao nhiêu giường và spawn selection ưu tiên gì? 30. Loot của người chết tồn tại bao lâu? 31. AI boss có leash hoặc reset encounter không? 32. Cửa phòng thẻ bị người khác mở có thể vào chung không? 33. Vending machine có tax/stock mới nhất? 34. Vùng high resource của đảo có mặt ở quốc tế không? 35. Thời gian thăm dò 24 phút áp những vùng nào? 36. Pet/buff auto-gather hoạt động khi chủ không trực tuyến không? 37. Có bao nhiêu phương tiện được craft, tìm hoặc chỉ mua? 38. Raid protection nào theo giờ/ngày? 39. Những reward gì qua wipe là item, recipe hoặc cosmetic? 40. Mối liên hệ chính xác giữa huy hiệu, tủ và quyền kết toán ở từng mode? [?]

**Nguyên tắc không bịa:** Khi một câu ở trên thiếu nguồn, giữ là `UNVERIFIED` cho đến khi có video giao diện, thông báo của nhà phát hành hoặc test trong đúng build. Không dùng ví dụ Rust, wiki chưa rõ game, clip không có ngày hay trí nhớ cộng đồng làm dữ kiện định lượng chuẩn. Đừng đánh đổi độ chính xác chỉ để điền kín bảng.

# PHẦN V — BẢNG NGUỒN CỤ THỂ VÀ KHẢ NĂNG TRUY VẾT

- **[S01] [B] Quốc tế Google Play** — Identity, survival, building, maintenance, PvP and official product description. URL: https://play.google.com/store/apps/details?id=com.herogame.gplay.lastdayrulessurvival

- **[S02] [A] Trang chủ trò chơi Trung Quốc** — Mục tiêu 15 ngày, sáu dạng địa hình, văn cảnh cốt truyện. URL: https://hero.yingxiong.com/

- **[S03] [B] Website quốc tế** — Định vị game và ba trụ gameplay cơ bản. URL: https://lios.herogame.com/

- **[S04] [A] FAQ phát hành 2019-07-30** — Blueprint, death, item drop, survival, repair, character. URL: https://hero.yingxiong.com/info/2019/0730/6973.html

- **[S05] [A] Bài giới thiệu chính thức 2019-07-31** — Free-form building, survival loop and raid. URL: https://hero.yingxiong.com/info/2019/0731/6999.html

- **[S06] [A] Hướng dẫn modes chính thức tại Xiaomi 2019-08-07** — 15/7 day, badge endgame and battle wipe. URL: https://game.xiaomi.com/viewpoint/1103968488_1565170379066_13

- **[S07] [A] Hướng dẫn thẻ/phòng/POI chính thức 2019-08-07** — Green-blue-purple, power switches, Boss and POIs. URL: https://hero.yingxiong.com/info/2019/0807/7028.html

- **[S08] [A] Bản vá tái thiết map 2019-10-31** — Airport 4–5×, nuclear tunnels, talent and radiation. URL: https://hero.yingxiong.com/info/2019/1031/8033.html

- **[S09] [A] Operation Base và Zombie Siege 2020-08-26** — Persistent base, logistics, workshop, farm, trading, siege and amounts. URL: https://hero.yingxiong.com/info/2020/0826/10634.html

- **[S10] [A] Dawn Land, Civilization mode 2021-06-29** — 7000×7000 m, eight POIs, eras, recipe unlocks, energy system. URL: https://hero.yingxiong.com/info/2021/0629/11237.html

- **[S11] [A] Card-room randomization, heat, vehicle 2020-01-08** — Random card room, heat maximum, military base, helicopter. URL: https://hero.yingxiong.com/info/2020/0108/8968.html

- **[S12] [A] Building Blueprint announcement 2021-09-28** — Building save/place cooldown, sharing and cost. URL: https://www.taptap.cn/moment/191987463328106018

- **[S13] [A] Pets, curved building and environment 2023-01-04** — Pet genes, curved geometry, corrosion mask mechanics. URL: https://hero.yingxiong.com/info/2023/0104/13178.html

- **[S14] [A] Building limits 2023-07-26** — 40m and 28m, category device quota, vehicles. URL: https://hero.yingxiong.com/info/2023/0726/13493.html

- **[S15] [C] Building strategy 2019 via Xiaomi** — Structural support, walls, anti-raid and route defense. URL: https://game.xiaomi.com/viewpoint/1103968488_1569395213751_13

- **[S16] [C] TapTap player electric circuitry/building 2019** — Switch, generator, traps, structural tactics. URL: https://www.taptap.cn/moment/15218919606324324

- **[S17] [C] TapTap 2023-05-30 starter POI guide** — POIs, card rooms, solo/multi base placements, cooldown anecdotes. URL: https://www.taptap.cn/moment/181472487316390022

- **[S18] [A] R&D selection 2023-03-01** — Selected recipe research, scoped to particular battle modes. URL: https://hero.yingxiong.com/info/2023/0301/13285.html

- **[S19] [A] Workshop + PVE 2024-07-03 and 2026 July** — Workshop Patterns, Credits, keys, PvE mode. URL: https://hero.yingxiong.com/info/2024/0703/13889.html

- **[S20] [A] Zombies Tide Trial 2026-04-28** — Territory cabinet upgrade, recipe share, PvE wave. URL: https://hero.yingxiong.com/info/2026/0428/14668.html

- **[S21] [A] Map POI UI and Uninhabited Island 2025-07-29** — Map UI, 24-minute instance, elite chance and Bizon. URL: https://hero.yingxiong.com/info/2025/0729/14292.html

- **[S22] [A] Ace Overlord mode 2026-01-28** — 49 plots, 7 days, capture timer, damage buffs, slow bullets. URL: https://hero.yingxiong.com/info/2026/0128/14574.html

- **[S23] [A] Zombie Trial update 2026-07-29** — Targeting rules, core salvage, repair, current cabinet spacing. URL: https://hero.yingxiong.com/m/info/2026/0729/14902.html

- **[S24] [C] Player ecology notes 2019-05-25** — Biome resource distribution and tactical caveats. URL: https://www.taptap.cn/moment/15218919606324324

- **[S25] [C] Historic 2019 crafting/recipe guides** — Ammo examples; compare other 2019 craft guides; NOT 2026. URL: https://www.9game.cn/daihaoyingxiong/3254982.html

- **[S26] [A] July 2026 international-aligned patch** — Classic mode coexistence; new researchable weapons; search UI. URL: https://hero.yingxiong.com/info/2026/0701/14825.html

- **[S27] [A] September 2026 recent official event info** — Current blueprint/event/store content; not core gameplay truth. URL: https://hero.yingxiong.com/info/2026/0909/15002.html

- **[S28] [B] App version release history** — Version number international 2.43 July, 2.44 July, 2.45 September 2026. URL: https://apptopia.com/ios/app/1463021419/about

## 52. Ghi chú cuối cùng để tránh làm hỏng định hướng Soul of Heroes

**Tài liệu đã có của người dùng:** “Soul of heroes.docx” (~57 trang) chứa trao đổi trước về cảm giác gameplay, Skill Core có giới hạn lượt dùng, căn cứ top-down, các hệ nghiên cứu, kho và những bản kiểm kê giả định về repository. Ở nghiên cứu này chúng được coi là **định hướng dự án/ghi chép trao đổi**. Không có code hoặc test runtime mới nào được xác nhận trong quá trình lập hồ sơ; mọi câu nói “SOH hiện đã có X” chỉ hợp lệ khi được kiểm tra nguồn repo tương ứng. [I]

**Bản gốc đáng học không phải bảng tier mà là topology giữa hệ thống:** chặt một cây có thể dẫn tới dụng cụ, gỗ làm kho, kho cho phép đi xa, đi xa nhặt Spares, Spares mở Recipe, Recipe khiến quặng ở một biome khác trở nên cần thiết, quặng khiến người chơi dựng tiền đồn, tiền đồn thay đổi tuyến đường và mục tiêu nhà. Khi mọi tác động này được lưu thực và diễn ra theo thao tác, game có cảm giác sống. Nếu chỉ vẽ map 4 biome, rải 10 dungeon, cho menu craft, thêm prefab nhà rồi gọi là “survival”, sẽ không bảo tồn vòng lặp người dùng muốn. [I]

**Kiểm soát phương pháp:** Bản ghi này vượt quy mô 60.000 ký tự để làm hồ sơ nghiên cứu, không phải cam kết xác minh mọi item/thuật toán bên trong client. Các số định lượng được nêu rõ thời kỳ và mode; những nơi chưa có nguồn được đánh dấu `?`. Tính đầy đủ theo **chiều rộng phân hệ và quan hệ** cao; tính đầy đủ theo **100% recipe database, map seed, drop table và thông số live** chưa đạt và được ghi công khai. [I]
