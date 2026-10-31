# ARCANA · So sánh ba ứng viên VFX pixel-art

**Nguồn:** ba ZIP người dùng cung cấp, nhãn A/B/C trùng với HTML so sánh. Nhận xét dựa trên mã triển khai, 20 frame cao trào và các frame ở 35%/70% vòng đời kỹ năng. Không phải kết quả blind test và không phải benchmark FPS chuẩn hóa.

**A** — `pixel-art-magic-laboratory (1).zip`: HDR CPU software renderer 416×234; layer thế giới, enemy physics, statuses, hitstop, knockback, pixel deaths.  
**B** — `pixel-magic-vfx-laboratory (1).zip`: procedural CPU raster 384×216 với Presenter WebGL làm post-processing; skill tính theo local timeline.  
**C** — `pixel-magic-vfx-laboratory.zip`: CPU frame layers 384×216 + WebGL2 compositor, fixed-step simulation.

**Quan trọng:** trình duyệt nghiệm thu khóa WebGL, nên hình B sử dụng đường 2D dự phòng của code gốc, hình C dùng compositor CPU **gần đúng** được thêm vào bản so sánh. Hình học và animation source của ba bản được thực thi từ mã thực, không phải ảnh concept. Nhận xét về độ chói, bloom, chromatic dispersion của B/C cần kiểm tra lại trên WebGL2 thật trước khi chốt.

## Đánh giá theo khía cạnh

| Khía cạnh | Ứng viên nổi bật | Lý do | Hạn chế |
|---|---|---|---|
| Impact / combat | **A** | Enemy physics thực, hitstop, 7 nhịp phản ứng, trạng thái nguyên tố, tử vong và damage feedback | Dễ che hình VFX bằng text, flash và overlap |
| Đường nét / silhouette minh bạch | **B, C** (tùy chiêu) | B có các mảng hình và hoa văn lớn, C có cạnh raster dễ đọc | Đôi khi thành hình sao/vòng tròn quen thuộc |
| Nước và thực vật | **B**, ngoại lệ A ở Riptide và C ở Rootwake | B dẫn đầu ở Abyssal Bloom, Spore Nebula, Worldseed | Chuyển động organic nhiều lúc vẫn đối xứng / thiên hình thức |
| Điện / lực đánh | **A/C**, B ở ký tự điện | A tạo lực va chạm; C sắc, nhiều nhánh; B làm glyph dễ đọc | A đôi lúc cháy trắng, C bỏ mất concept glyph |
| Hư không / không gian | **B** ở Event Horizon, **A** ở Chronoshard, **C** ở Constellation Engine | Cả ba mạnh ở một nhánh khác nhau | Không có bản nào thống trị cả trường phái |
| Dựng vật chất / pixel discipline | Không chốt trên máy kiểm thử hiện tại | A raster HDR 416×234; B CPU raster; C có layer ink/light/warp | Không thể so bloom chuẩn khi C không chạy được WebGL2 |
| Sự đa dạng từng effect | **B và A** có những điểm mạnh khác nhau | B nghiêng art direction, A nghiêng hit reaction và thao tác vật lý | Một số bộ chiêu vẫn lạm dụng đồ hình tròn/sao |

## Ma trận 20 kỹ năng

Dấu **A+B** nghĩa hai bản có lợi thế khác nhau, không phải ngang điểm tuyệt đối.

| # | Skill | Nhóm có ưu thế theo tiêu chí thẩm mỹ/ý tưởng | Ghi chú ngắn |
|---:|---|---|---|
| 01 | Cinder Crown | **A+B** | A impact · B silhouette |
| 02 | Furnace Wyrm | **A+C** | Chưa ai dựng rõ sinh vật |
| 03 | Meteor Loom | **A+C** | Cả ba thiếu “meteor” |
| 04 | Ashen Guillotine | **B+C** | B/C thắng cấu trúc lưỡi |
| 05 | Abyssal Bloom | **B** | B vượt trội về hoa nước |
| 06 | Riptide Calligraphy | **A+C** | A nước dày · C nét thanh |
| 07 | Mirrorfrost Basilica | **A+B** | Cả ba chưa ra basilica |
| 08 | Undertow Maw | **A+B** | A nước xoáy · B hố sâu |
| 09 | Chain Verdict | **A+B+C** | Cả 3 đều có điểm mạnh |
| 10 | Thunderloom | **A+C** | A lực đánh · C độ gọn |
| 11 | Volt Carousel | **A+B** | A impact · B orbital |
| 12 | Skybreaker Script | **A+B** | B đúng concept hơn |
| 13 | Rootwake | **A+C** | C thân gỗ · A mạng rễ |
| 14 | Spore Nebula | **B** | B vượt trội về colony |
| 15 | Thorn Opera | **A+C** | A tendril · C flower impact |
| 16 | Worldseed | **B** | B thắng mỹ thuật hoa |
| 17 | Event Horizon | **A+B** | B hình hố đen rõ nhất |
| 18 | Chronoshard | **A** | Cả ba chưa ra time fracture |
| 19 | Constellation Engine | **C** | C thắng hình học thiên thể |
| 20 | Reality Ripper | **A+B+C** | Cả ba đều có ý tưởng |

## Đánh giá chi tiết từng skill

### 01 · Cinder Crown

Cả ba tạo được cao trào lửa, nhưng cách tổ chức hình khối khác nhau: A thiên về đòn đánh, B thiên về hoa văn mặt trời, C thiên về điểm nổ.

**A:** Vòng lửa mở thành các cánh xoáy đỏ-hồng rất lớn, có nhiều lớp và phản ứng mục tiêu. Nhược: damage number cùng chói sáng làm lõi hơi rối; dáng “crown” biến thành quạt lửa khá sớm.

**B:** Các cánh lửa nhọn bung từ tâm có silhouette sáng sủa, rõ hình, dùng tương phản cam–trắng tốt. Tuy nhiên nhìn gần như một motif 8 cánh; sự chuyển đổi sang vụ nổ thiếu cảm giác vật chất.

**C:** Vòng lửa, các đốm cháy và điểm nổ có pixel rõ nhưng vùng cao trào khá nhỏ và đông hạt. Năng lượng bị gom thành pháo hoa, chưa thể hiện được một vương miện đồ sộ.

**Kết luận:** A thắng cảm giác impact; B thắng hình khối. C cần nâng tỷ lệ cấu trúc chính.

### 02 · Furnace Wyrm

Ý tưởng đòi sinh vật hỏa diệm, không chỉ một đường sáng: cả ba còn thiếu đầu, thân và khớp sống được nhận biết nhất quán.

**A:** Ở 35% tạo thân lửa cong liên tục từ caster, chạy rộng khắp sân; cú thu thân và phản ứng địch mạnh. Nhưng lúc nổ chỉ còn luồng sáng, chưa đủ “wyrm” có gương mặt.

**B:** Đường uốn mảnh và các đốt tách tạo cảm giác lửa đang trườn, song thân nhỏ, thiếu khối lượng và va chạm. Cao trào chuyển thành một cụm điện/lửa thông thường.

**C:** Thân lửa dày, đầu nóng sáng và đuôi có đốt khá rõ trong pha di chuyển. Tuy thế chuyển động có phần giống roi lửa hơn sinh vật săn mồi.

**Kết luận:** A nhỉnh về quỹ đạo và đòn kết liễu; C nhỉnh về thân có cấu trúc. Cả ba nên cải thiện đầu và biểu cảm cơ thể.

### 03 · Meteor Loom

Meteor Loom là một trong các đề bài chưa đạt trọn brief: nhiều vết nổ đẹp nhưng thiếu cảm giác các thiên thạch có thân vật chất và tốc độ rơi riêng.

**A:** Mạng nứt dung nham lan từ nhiều tâm va chạm, để lại dư chấn tương đối thuyết phục. Các nguồn nổ tách bạch, nhưng ít thấy thân thiên thạch trước chạm đất.

**B:** Sáu điểm sáng hội vào một đồ hình và các kết nối gọn ở peak. Tuy nhiên ở nhiều frame vùng sàn bị trắng hóa rộng, làm mất độ sâu, mất chất đá nóng và mất độ đọc được.

**C:** Nhiều chớp tác động bố trí trên vòng với các tia liên kết, nhịp va chạm khá rõ. Mặt khác trông giống ma trận điện hơn cơn mưa thiên thạch.

**Kết luận:** A tốt về hậu quả địa hình, C tốt về dàn cảnh đa điểm; cả ba cần dựng projectile đủ nhận diện.

### 04 · Ashen Guillotine

Ba cách thể hiện đường chém: A mảnh và nhanh, B dựng một bản chém có thân, C có lưỡi đỏ đen trước cú cắt.

**A:** Đường chém cực mảnh chia sàn và khiến mục tiêu chịu damage; mạnh về sự chính xác, hình ảnh gọn. Phần “guillotine” treo lơ lửng bị lược bớt trong một số khoảnh khắc.

**B:** Lưỡi thẳng đứng có dải vân lửa như một phiến kim loại nung, rất đúng brief. Đường chém cuối dài và sáng nhưng hơi thiếu mảnh vỡ/sát thương lan sau chém.

**C:** Ở pha đầu là một phiến lưỡi đỏ đen được thiết kế rõ; hậu kỳ vết cắt có đốm bùng theo từng đoạn, mang chất pixel khá tốt (màu có thể đổi trong shader thật).

**Kết luận:** B thắng giai đoạn treo lưỡi; C có pha fracture sạch; A thắng tương tác địch.

### 05 · Abyssal Bloom

Một trường hợp có người vượt trội rất rõ: hình tượng hoa nước của B gần ý tưởng nhất.

**A:** Khối nước rực sáng tập trung thành một bông kết đặc có hình học pha lê. Bị bệt sáng ở lõi và chưa thể hiện được lớp màng nước trong suốt.

**B:** Những cánh nước xanh nhạt mở thành bông hoa lớn, mép có hạt lấp lánh, sáng/tối rõ và tính đối xứng đẹp. Phân lớp nước tương đối thuyết phục dù động lực nước còn cứng.

**C:** Khối xanh trắng nổ thành các tia sắc, có nhịp phun tốt; hình thái nghiêng về băng/tinh thể hơn một đóa hoa nước.

**Kết luận:** B là điểm sáng rõ rệt; A/C cần nhiều cấu trúc chất lỏng lớn, ít phụ thuộc vào đốm sáng.

### 06 · Riptide Calligraphy

Cả ba đều có nét vẽ nước khá riêng, không rơi vào một dạng particle spray đổi màu.

**A:** Ribbon rộng, dày, có nhiều tầng bán trong suốt và quán tính; các đường nước xoắn đan như chữ viết. Hình lớn đọc tốt nhưng có lúc rối do các đường cắt xuyên nhau.

**B:** Nét nước hẹp hơn, xoắn thành vòng và tia rẽ; phông sàn tạo độ tương phản tốt. Bù lại, một số đoạn chuyển thành những quỹ đạo tròn đều, hơi cơ giới.

**C:** Các nét nước sáng sạch như thư pháp, có chỗ thon–dày và điểm nhấn rõ; hình cuối giống một ký tự vẽ tay. Ít foam và tầng nước so với A.

**Kết luận:** A đáng học về material và chuyển động; C đáng học về calligraphy/silhouette; B cân bằng nhưng chưa độc đáo bằng.

### 07 · Mirrorfrost Basilica

Mô tả đòi kiến trúc băng; cả ba đang nghiêng về biểu tượng/tinh thể nổ, thiếu cảm giác dựng một “thánh đường” với khối lượng và tầng sâu.

**A:** Mạng lưới tinh thể hình vòm khá rộng, có nhiều ô/tầng, một chút cảm giác mạng mái vòm. Nhưng đường nét bị lặp và quá vụn, giống hình đăng ten hơn công trình lớn.

**B:** Tinh thể trung tâm có mặt phẳng tam giác rõ, phối các đường fracture và mảnh vỡ đẹp. Cụm khá chật, chưa thành kiến trúc có trật tự và tầng cao.

**C:** Sắc cạnh băng và các mảnh nổ thể hiện rõ. Tuy nhiên cấu trúc chính thiên về bông tuyết/pha lê và chưa gợi một công trình kiến trúc.

**Kết luận:** A có hình thái “dome” gần ý tưởng nhất; B có facet tốt. Đây vẫn là ứng viên cần redesign ở cả ba.

### 08 · Undertow Maw

Ở giai đoạn giữa, A/B/C đều thể hiện lực xoáy; phần khó là sự sụp và cú đảo áp lực.

**A:** Vòng xoáy nước nhiều dải lớn, xoay sâu với tâm rõ ở 35%, rất có thể tích. Đến gần 70% chuyển thành một khối trắng nhỏ, mất sự hoành tráng của cú phản lực.

**B:** Vòng xoáy tối xanh có các đường đồng tâm méo dạng, vừa có độ sâu vừa đủ tương phản. Pha sau mở thành những vòng nước lớn song chưa có “reverse surge” mạnh.

**C:** Phễu trong rõ nét ở khoảng 35%, ba vòng áp suất bao quanh và tâm sâu. Ở 70% biến mất khá sạch, khiến cao trào sau hụt nếu chỉ xem frame.

**Kết luận:** A thắng nước xoáy chuyển động; B tốt nhất về hình thái hố sâu; C cần kéo dài hậu quả.

### 09 · Chain Verdict

Một trong các chiêu thành công nhất ở cả ba: cùng tạo được tia nhánh và mạng liên kết rõ, nhưng A khác ở chỗ đánh vào địch thật.

**A:** Các tia nối những kẻ địch trên sàn, có đích cụ thể, số damage và hit reaction. Silhouette của lưới tia hơi mảnh hơn hai bản còn lại.

**B:** Tia rẽ nhánh dày, nhiều tuyến tìm đường và reconnect; trông giống mạng điện đang suy nghĩ. Nhược là có vài đường tụ dày dễ che mắt người xem.

**C:** Bolt nhảy giữa các nút sáng tròn, đường dẫn có trọng lượng và bước ngoặt rõ; mạnh về readability, mặc dù nút hình cầu hơi gamey.

**Kết luận:** A tốt nhất về combat logic, B về số lượng nhánh, C về đường điện dễ đọc. Cả ba đều đáng giữ.

### 10 · Thunderloom

Các bản có thiết kế “đánh xuống từ trời” nhưng peak còn thiên về cột sét hơn một cơn bão có kiến trúc hình thành trước đó.

**A:** Ở pha trước có vòng điện quay, sau đó phát nổ thành cột sáng rất mạnh, có shock cảm giác trực tiếp. Vùng trung tâm bị cháy trắng mạnh khi lên peak.

**B:** Cột sét trắng gọn và các nhánh ngắn ở chân, sạch nét nhưng ngắn và hơi nhỏ so với cảm giác “bão nén”. Phần chuẩn bị có hệ chuyển động riêng.

**C:** Một cột sét dọc rất gọn chạm sàn, chân có vầng điện xanh tím phân tầng; thể hiện lực đánh cô đọng tốt. GPU shader thật có thể làm khác cường độ sáng.

**Kết luận:** A mạnh nhất ở impact, C mạnh về biểu tượng cột sét; cả ba cần làm phần mây điện trước cú đánh độc đáo hơn.

### 11 · Volt Carousel

Ý tưởng điện từ có cấu trúc orbital và alignment; ba bản có điện đẹp nhưng không phải bản nào cũng giữ được dáng máy móc khi lên đỉnh.

**A:** Hiệu ứng điện lan rộng rất dữ dội, nhiều vòng/nhánh đan khiến trận đánh như mất kiểm soát. Đổi lại, chi tiết cơ cấu quay bị che trong lõi sáng.

**B:** Các vòng điện lồng nhau và luồng tia xuyên qua tâm có khả năng kể câu chuyện máy điện rõ hơn. Đến peak bộ máy tan thành mạng điện phân bố, thiếu cảm giác khóa khớp cuối.

**C:** Cục điện trung tâm và các nhánh dày, răng cưa đẹp; hình tròn kỹ thuật trước đó nhỏ và nhiều khoảng trống. Đọc tốt như một đòn sét, kém như “carousel”.

**Kết luận:** A đáng giữ độ hung bạo, B đáng giữ orbital scaffolding; C cần xây dựng bộ phận quay dễ nhận diện.

### 12 · Skybreaker Script

Điểm khác biệt concept nổi bật: A/B có phù văn đọc được, C chủ yếu bùng tia sét.

**A:** Ngôi sao nhiều lớp đường giao hình học xuất hiện rõ và chuyển thành chớp sáng mạnh. Hơi giống một ngôi sao ma thuật phổ thông, ít nét chữ.

**B:** Đồ hình ký tự cong/vòng và các điểm sáng như dòng mã arcane, nhiều bộ phận nhỏ. Thích hợp để phát triển “chữ viết bằng điện”, dù còn hơi thiên về vòng nghi lễ.

**C:** Một tâm sét với các nhánh lao xa rất ngoạn mục. Tinh thần năng lượng điện mạnh hơn việc glyph đang được vẽ/giải mã.

**Kết luận:** B dẫn đầu độ đúng concept; A có rune dễ nhận; C thắng quy mô chớp nhưng cần phục hồi phần chữ viết.

### 13 · Rootwake

Tăng trưởng hữu cơ có ba hướng: A lan rộng như mao mạch, B phát triển thân rễ, C giống nhánh cây mọc thật.

**A:** Mạng rễ xanh chạy dài, phân nhánh với quỹ đạo tự nhiên và phản ứng lên kẻ địch; tuy nhiên phần thân gốc mảnh, chưa thấy lớp vỏ, trọng lượng và bề dày rõ.

**B:** Thân rễ nâu sẫm có nụ phát sáng, nhiều hướng phát triển và trật tự thân–cành. Mặt đất tối khiến một phần nhánh thiếu tương phản.

**C:** Những cành nâu rõ chất gỗ, hoa hồng lấm tấm và phần mọc vươn nhiều hướng; có cả cụm gai/nhánh xanh đứng lên. Thấy rõ hình thái sinh học.

**Kết luận:** C tốt nhất về nhận dạng vật chất; A tốt về quy mô và cảm giác địch bị trói.

### 14 · Spore Nebula

Cụm nấm/tinh vân là một chiến thắng khá rõ của B về tính độc đáo của màu sắc và phân bố.

**A:** Một đám cyan nhỏ tác động địch, nhưng hình thái phát triển cụm bào tử chưa rõ. Số damage xung quanh tạo cảm giác combat nhưng không giúp kể chuyện colony.

**B:** Nhiều đảo tế bào phát sáng xanh–vàng, có nhịp thở, quỹ đạo truyền tín hiệu và khoảng tối hợp lý. Trông thực sự như hệ sinh vật nhỏ ngoài hành tinh.

**C:** Một vài cụm xanh vàng hình cầu có nối kết, nền tối tương phản khá đẹp. Mật độ ít hơn B, chiều sâu mạng liên kết chưa nhiều.

**Kết luận:** B thắng rõ rệt cả visual identity lẫn cảm giác colony đang sống; A nên dựng thêm bào tử tự nhân bản.

### 15 · Thorn Opera

Tendril/vines ở A có chuyển động sống, nhưng B và C chuyển phần cao trào thành hoa sắc hồng, khá xa ý tưởng “opera của gai”.

**A:** Nhiều dây roi dài quất, quấn quanh caster và mục tiêu, phương hướng mạnh. Cao trào hơi rối, không nhìn thấy các mấu gai/tendril riêng nếu chỉ lấy một frame.

**B:** Các nhánh dây có gốc chung, cuối biến thành một cánh hoa đỏ hình quạt đẹp nhưng thiếu khả năng tấn công riêng của từng tua.

**C:** Một thân gai hướng ngang thành hoa hồng lớn, hình khối rõ và lạ. Tuy nhiên hiệu ứng gần giống projectile hoa ma thuật hơn một dàn dây leo nhảy múa.

**Kết luận:** A tốt về ngôn ngữ chuyển động; C tốt về biểu tượng kết thúc. Cả ba còn thiếu choreography nhiều tendril đọc được.

### 16 · Worldseed

Ba bản đều hoàn thành một hình ảnh “đóa hoa phi thường”, nhưng giá trị nằm ở diễn biến biến hình, không chỉ final pose.

**A:** Tăng trưởng từ nụ đến bông nhiều lớp xanh trắng rất lớn, lấp gần hết khu vực cast. Điểm yếu: lõi trắng cháy sáng làm mất lớp cấu trúc lá.

**B:** Cánh xanh đậm, nhân hồng, hạt phấn nhỏ được tổ chức đẹp. Đóa hoa có lớp trong–ngoài và tỷ lệ cánh tốt nhất; diễn biến giai đoạn 35→70% rõ ràng.

**C:** Hoa hồng giữa các cánh lá xanh với cạnh pixel sáng, tâm nở to dần. Hình sạch nhưng độ phức tạp và số tầng ít hơn hai bản kia.

**Kết luận:** B thắng nghệ thuật hình thái; A thắng quy mô nhưng phải giảm bloom; C là nền tốt để gia tăng lớp thực vật.

### 17 · Event Horizon

Black hole cần negative space và kéo nền; A tạo cảm giác lực lớn, B tạo hố đen rõ, C chơi mảnh nền vuông.

**A:** Nhiều vòng xoắn tím kéo sâu vào tâm, môi trường/phản ứng mục tiêu bị thay đổi và đầy chuyển động. Ở peak hậu kỳ hơi bị chớp/damage làm mất điểm đen.

**B:** Lõi tối hoàn toàn và vòng đĩa tím có chiều sâu, cảm giác “black hole” nhất cả ba. Nhỏ hơn A nhưng silhouette cực kỳ thuyết phục.

**C:** Các mảnh nền vuông tách khỏi sân và chuyển thành vòng hạt xung quanh tâm, có chất kỹ thuật thú vị. Tuy nhiên cấu trúc tâm lỗ đen chưa đặc trưng bằng B.

**Kết luận:** B dẫn đầu nhận diện singularity; A mạnh về cảm giác lực; C đáng giữ ý tưởng tách ô sàn.

### 18 · Chronoshard

Đây là đề khó còn yếu ở cả ba: freeze/time-slice chưa đủ rõ với người không đọc mô tả. Cần xem nhiều frame liên tiếp và thêm biểu tượng thời gian bị lưu trữ.

**A:** Các mảnh tinh thể tím xuất hiện nhiều vị trí quanh địch; mã có lấy mẫu nhiều mốc thời gian của cùng action. Khả năng truyền ý niệm “đòn đánh tồn tại nhiều thời điểm” tương đối tốt.

**B:** Một số khối đa giác rỗng chứa fragment chuyển động, nhìn được tinh thể nhưng rỗng và thưa. Về sau ảnh cao trào gần như trống, thiếu cảm giác chuỗi giải phóng thời gian.

**C:** Các tinh thể nhỏ được phác nhẹ trong pha đầu, sau chuyển thành chuỗi bụi sáng dài. Tốc độ đẹp nhưng khái niệm time-echo yếu.

**Kết luận:** A dẫn đầu ở cơ chế thời gian; cả ba đều cần thêm sự đối lập freeze/rewind/release rõ nét.

### 19 · Constellation Engine

Ý tưởng đòi một máy thiên thể ghép dần bằng toán học: hình của C dễ đọc nhất nhưng hai bản kia có ý tưởng chuyển động thú vị.

**A:** Nhiều điểm sao nối thành mạng, sau thành một cụm sáng lớn; cảm giác dữ liệu thiên thể nhiều nhưng trong peak bị trắng hóa, không còn nhánh hình học.

**B:** Các đường sao xa nhau quy tụ về tâm thành starburst hình thập, khá sạch nhưng ít cấu hình trung gian đủ phức tạp.

**C:** Cấu trúc đa giác sao có chiều sâu, các mối nối đối xứng được phân lớp rõ ràng, tạo một cỗ máy thiên thể. Tuy vậy vẫn hơi quen như pentagram nhiều tầng.

**Kết luận:** C dẫn đầu dàn hình; B cần thêm mối nối động; A nên bảo toàn hình học khi bùng sáng.

### 20 · Reality Ripper

Vết rách thực tại của cả ba có khác biệt thuật toán rõ hơn nhiều chiêu khác; cần xem ở 45–60%, không chỉ ảnh peak.

**A:** Vết xé tím trắng dày có mô-típ gạch nền bị kéo lệch và mép nhấp nhô, đúng ý “thế giới bị mở toạc”. Điểm yếu: ở mốc peak khai báo khoảng 74% có lúc rift đã biến mất, lệch nhịp nghiệm thu.

**B:** Khoảng mở phơi ra từng dải ô nền lệch, luồng màu cyan–magenta chạy dọc. Hình chi tiết và cảm giác dữ liệu không gian bị bóc tách rất tốt; phần đóng rift có thể hơi đột ngột.

**C:** Một vết xé rộng dạng dải với các ô hồng tím và những ký hiệu hình học phía trong, mép răng cưa sạch. So với A/B ít độ dịch chuyển cả nền hơn trong chế độ CPU preview.

**Kết luận:** A/B mạnh về làm biến dạng cấu trúc nền; C mạnh về vùng không gian bên trong. Cả ba có ý tưởng đáng giữ, nhưng phải kiểm tra nhịp “peak” của A.

## Đề xuất phát triển thế hệ tiếp theo

**Không chọn một bản duy nhất để phủ hết 20 kỹ năng.** Nên lấy hệ thống phản ứng mục tiêu của A làm tài liệu tích hợp (không tự động sao chép module giữa dự án khác giấy phép), lấy hướng xử lý hình khối nước/hoa/bào tử của B làm chuẩn hình ảnh, và kế thừa các ý tưởng hình học điện–thiên thể của C. Khi tích hợp, yêu cầu đối chiếu từng giai đoạn cast–climax–aftermath và test trên build GPU thật.

**Các concept cần làm lại từ brief thay vì chỉ polish:** Furnace Wyrm phải có sinh vật nhận dạng được; Meteor Loom phải có meteor body/travel; Mirrorfrost Basilica cần kiến trúc băng có chiều sâu; Chronoshard cần đối lập freeze/rewind/multiple-time rõ hơn. Các chiêu này không giải quyết được chỉ bằng thêm particle hay bloom.

**Vòng nghiệm thu kế tiếp:** tắt damage number của A để so riêng VFX; chụp đủ timeline cùng với native WebGL2 của B/C; quan sát độ sáng ở khoảng sáng màn hình thực, không chỉ screenshot; chấm thêm cảm giác đòn đánh khi trúng, độ đọc được ở kích thước gameplay và hiệu năng khi spam skill.

**Không nên lấy số ứng viên được đánh dấu là người thắng làm bảng xếp hạng tổng.** Đây là lựa chọn *điểm mạnh tương đối theo skill*, nhiều hàng đồng thắng và chất lượng post-processing của C đang bị giới hạn bởi môi trường kiểm thử.
