# Soul of Hero — kế hoạch chốt bản final

**Điểm xuất phát:** bản chơi `373d999`. **Đích:** người chơi có thể từ New Game, gây dựng cuộc sống, gặp hoặc bỏ qua cộng đồng, trải qua Ragnarok và nhận đúng kết cục. Một bản chơi cuối, không một ZIP cho mỗi lỗi. Đây là kế hoạch, không phải chứng nhận đã hoàn tất.

## 1. Làm cho xã hội có thể sống tới giai đoạn cuối

- Lấy seed 7606 làm ca điều tra đầu tiên. Trong lượt đã ghi ở bản trước, h24 còn 92 người hoạt động, 1 người gục, 193 người chết; ở lần lấy mẫu h38 cả 286 đã chết. Đồng hồ vẫn tới h336. Chưa kết luận mọi seed hay bản hiện tại đều như vậy.
- Theo một người sắp gục và chuỗi cung ứng của họ qua từng bước: nguồn có hàng không → ai có thể lấy → đường và cửa có đi được không → giao vào kho nào → người đó có thể đến ăn/uống kịp không. So một nơi còn hoạt động với một nơi mất dân; sửa mắt xích **đầu tiên** thực sự đứt. Chạy lại đoạn ngắn quanh sự cố trước khi chạy nhiều ngày.
- **Qua khi:** có cộng đồng sử dụng hàng thật, duy trì hoặc phục hồi được và bước vào h264/h312 với người còn sống có khả năng hành động; kiểm tra thêm một điểm xuất phát độc lập. Một nơi thiếu tiếp tế vẫn có thể thất bại. Không ép tỷ lệ sống, cấp thức ăn ẩn, hồi sinh hoặc giảm dân số để qua. Từ cùng một save, chơi liên tục và Continue phải cho kết quả nhất quán về người, kho và công việc.

## 2. Chốt vòng chơi đầu và giữa trên nền kinh tế đó

- Giữ ba quyết định đã chốt: gậy gỗ cơ bản lấy được gỗ và đá; thú không lần dấu chân; nói chuyện với NPC không đồng nghĩa ra lệnh, mời đi cùng hay trao đồ. Vào bằng New Game thường, kiếm vật liệu, chế công cụ tốt hơn, có nước, thức ăn và chỗ trú. Không bắt buộc phải tuyển NPC.
- Theo đầu vào → thao tác → đầu ra của cả tám nghề: thu hồi phế liệu, sửa máy, nấu ăn, làm vườn, chữa bệnh, canh gác, kỹ thuật và xây dựng. Dùng lại phần đã làm; tập trung vào khâu bàn giao giữa các nghề, thiếu nguyên liệu, gián đoạn và trở lại sau Continue.
- Chơi hai nhánh: giúp/trao đổi/tuyển bạn đồng hành và từ chối/đi một mình. Kiểm tra cả lệnh đồng hành, hàng mang hộ, đe dọa, nhân chứng, giao chiến, bị thương và cứu chữa. Ở 640×360 phải thấy mình đang chọn gì, hành động sẽ tốn gì và vì sao bị từ chối.
- **Qua khi:** các vòng chơi chạy bằng điều khiển thường và vật phẩm thật; mở menu, bị từ chối, mất liên lạc hoặc tải lại không làm mất đồ, chuyển đồ hai lần hay cho cùng một NPC vừa đi theo vừa làm ở nhà. Không dùng cảnh dàn sẵn thay cho lượt chơi này.

## 3. Nối Ragnarok với hai đường cứu người và kết thúc

- Dùng thế giới còn người từ bước 1, không tạo dân mới trước trận. Theo ba mốc riêng: nguy hiểm tăng ở h264, sáu Elder thức tỉnh ở h312, kết thúc ở h336. Đối chiếu Elder trong vùng người chơi và ngoài màn hình: cùng danh tính, máu và hậu quả; trở lại giữa trận không gây sát thương hai lần.
- Chốt ba bến **West, South, Hook**: tới bến thật, có phương tiện vận hành, còn chỗ, lên tàu, rời bến và tới nơi. Kiểm tra hết chỗ, lỡ chuyến và tải lại giữa hành trình. Lên tàu chưa phải được cứu; NPC rời đảo không được kết thúc lượt của người chơi.
- **Qua khi:** trong cùng một lượt có người được sơ tán tới nơi và người ở lại sống qua cuộc tấn công nhờ phòng thủ/tiếp tế. Có nhánh riêng cho người chơi tự sơ tán hoặc ở lại đến hạn. Mỗi người chỉ có một kết cục có căn cứ; chốt một lần trước khi xóa dữ liệu lượt theo K8. New Game kế tiếp không thừa hưởng đồ hay NPC ngoài phần hồ sơ được phép.

## 4. Khóa và bàn giao đúng một bản

- Xử lý năm kiểm tra đã đỏ cả ở bản cũ: đá muối, xây dựng, lò, nghiên cứu, ký quỹ/sơ tán. Nếu hành vi game sai thì sửa game; nếu luật đã đổi thì dẫn luật mới và sửa phép kiểm tra. Không coi “lỗi có sẵn” là đạt.
- Khóa một mã phiên bản ứng viên. Trên đúng mã đó: chạy toàn bộ bộ hồi quy hiện có, hai kiểm tra TypeScript, build production, save cũ/Continue, diễn tiến tới h336 và so hiệu năng cùng máy/cảnh. Đi đủ A–I qua trình duyệt: cộng đồng, nghề, xã hội, trao đổi/tội phạm, chiến đấu, ngoài màn hình/ngoại tuyến, Ragnarok, sơ tán, tự do chơi. Ghi rõ nếu tua thời gian; bot chỉ dùng để soi lỗi.
- **Không phát hành final** nếu còn lỗi mất/nhân đồ, hỏng save, xã hội không thể đi tới endgame, kết cục sai, hoặc luồng chính không dùng được ở 640×360. Sửa trên ứng viên thì kiểm lại đường bị ảnh hưởng và xác nhận các điều kiện phát hành trên mã giao cuối.
- **Bàn giao:** một preview và một ZIP cùng build, hướng dẫn tiếng Việt ngắn và cách giữ save. Tách rõ lỗi kỹ thuật đã kiểm với cảm nhận của người chơi. Chỉ cần người tạo chơi ứng viên hoàn chỉnh để đánh giá nhịp chơi, độ rõ và cảm giác cứu người; không cần duyệt từng bản sửa.

**Thứ tự làm:** sửa chuỗi sống còn trước; trong lúc chờ lượt dài có thể xử lý năm lỗi đã biết và rà UI. Không lấy một giờ chạy mô phỏng trên thế giới đã hết người làm bằng chứng để bỏ qua bước 1. Cập nhật kết quả tại [nhật ký tích hợp](07_EXECUTION_LEDGER_AND_HANDOFF.md); phạm vi chi tiết và các cảnh A–I theo [hợp đồng kiểm tra](06_VERIFICATION_RELEASE_AND_EVIDENCE.md).
