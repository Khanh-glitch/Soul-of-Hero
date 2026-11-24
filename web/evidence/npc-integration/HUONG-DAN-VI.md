# Hướng dẫn chơi thử (tiếng Việt)

## Chạy bản Web

Tại thư mục `web`, chạy `npm run dev -- --host 0.0.0.0`, rồi mở URL xem trước của phiên làm việc (hiện Vite đang chạy trên cổng 5174). Có thể tạo bản phân phối bằng `npm run build`; file đầu ra là `web/dist/index.html` (file này được tạo lại khi build, không nằm trong commit NPC).

## Bắt đầu và lưu run

1. Ở màn hình tiêu đề, chọn New Run, nhân vật và vùng bắt đầu; xác nhận để vào thế giới. Có thể dùng Continue để tiếp tục save có sẵn.
2. Khám phá, để ý HP, đói/khát và ngày còn lại. Chạm `Esc` để mở menu/đóng panel; dùng các phím di chuyển và phím tương tác như trò chơi hiển thị trên giao diện.
3. Save được lưu trong trình duyệt. Ảnh `save-reload-640x360.png` ghi lại kiểm tra Continue sau khi tải lại trang: cùng run ID, số dân NPC và vị trí toàn cục của người chơi.

## NPC (tính năng đã tích hợp trong mã, nhưng UX chưa được xác nhận bằng phiên tương tác trình duyệt)

Khi panel của người sống hiện ra, các hành động có thể gồm Talk, Trade, Threaten và Recruit; nếu đã theo bạn, Recruit đổi thành Dismiss. Hành động chỉ hợp lệ trong khoảng cách, cùng tầng và có đường nhìn phù hợp. Trade chuyển vật phẩm giữa hai phía; túi không đủ chỗ phải bị từ chối thay vì làm mất/nhân đôi đồ. Thử nghiệm tự động tập trung hiện có kiểm tra trao đổi/custody, provenance, loot trái phép, đòn đánh và theo/đuổi đồng hành.

**Giới hạn quan trọng:** ảnh `npc-near-door-640x360.png` chỉ chứng minh nhân vật tới gần khu cửa; prompt tương tác ở đó là đóng cửa, không phải panel NPC. Vì vậy chưa có hướng dẫn bấm thực tế nào được xác nhận để mở HumanPanel trong trình duyệt, và chưa thể xác nhận toàn bộ chuỗi từ sinh hoạt NPC đến Ragnarok/kết thúc run. README cùng thư mục ghi rõ phạm vi của từng ảnh.
