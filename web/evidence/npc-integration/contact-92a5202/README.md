# Tiếp xúc, sửa đồ và đồng hành — nguồn `92a5202`

**PARTIAL.** Đây là kết quả cho nhóm xã hội/điều khiển, không phải nghiệm thu chiến dịch.

- Khi nhiều người đứng cạnh cửa/kho, chọn theo tên trong **Survivors**. Chỉ những cơ thể còn ở tầng hiện tại, trong tầm và có đường tiếp xúc không bị chắn mới được liệt kê. **F** dùng mục tiêu hiện tại; nếu mục tiêu che cầu thang, **Alt+F** dùng thang. Mất tiếp xúc sẽ đóng nội dung hội thoại và hủy bản duyệt barter; quay lại phải duyệt lại.
- **Help → Repair** xuất hiện nếu có trang bị/công cụ cá nhân còn ≤½ độ bền, cả hai với tới trạm phù hợp mà người chơi có quyền dùng, và balô người chơi đủ vật tư theo catalogue. Thanh toán vật tư, sửa UID tại chỗ, ghi `human.repair`; không rút hàng kho cộng đồng. Tối đa +3 Trust cho loại giúp đỡ này. Hỏi **Join?** và nhấn **Recruit** dùng chung lý do từ chối: đủ 55 Trust không có nghĩa được lấy một người khỏi nhiệm vụ giao hàng, công việc hoặc sơ tán.
- Đồng hành: chỉ chọn được mục tiêu Engage nếu cả người chơi lẫn đồng đội có thể chỉ ra nó. Thấy được không đồng nghĩa đồng đội sẽ chấp nhận lệnh.

| Phép kiểm | Quan sát | Phạm vi |
|---|---|---|
| `tests.json` | 50/50, 5 file; TypeScript app/test và build production qua | Có ca NPC đang di chuyển rời tầm giữa chừng, cửa chắn người chỉ mục tiêu, sửa đúng UID, thiếu vật tư, sai chủ trạm, không nhân Trust, hoãn tuyển đến khi hết việc. Đây là kiểm thử có bố trí. |
| `controlled-barter.json` | Chromium 640×360: duyệt/counter, 1 lần chuyển 3 dòng UID; mất tiếp xúc không còn nút giao dịch, trở lại ở Talk; không có lỗi trang/HTTP | Fixture riêng, không tính là giao dịch ở làng trong chiến dịch. |
| `production-browser.json` | New run, 286 người, mở I/C/B/M; 7 khung 640×360, không lỗi trang | Kiểm tra UI bản build thật; không phải Creator chấm hình ảnh/cảm giác chơi. |
| `window-walk-partial.json` | Bản trung gian có bộ chọn tiếp xúc; New run seed 1768759823. 9 quan sát, từ (869,920) tới (853,920), đổi cửa sổ 832,896 → 768,896 bằng di chuyển thường. Sau mỗi save, driver kiểm tra layout và origin trước khi dò đường. | Dùng bản sao save để dẫn đường, không sửa game. Dừng trình duyệt để giải phóng bộ nhớ; chưa tới cư dân, không có hội thoại. Không tính C/D đạt. |

Chưa nghiệm thu: gặp–giúp–tuyển tự nhiên, bằng chứng nghề/UID/đường đi tại 81 POI, chiến dịch Elder–tàu–cứu hộ h336, regression đầy đủ, benchmark mật độ tương xứng, Creator playtest. Checkpoint một giờ thuộc nguồn `c11308d`, **không** chuyển sang nguồn mới để tuyên bố h336. Regression 229 file trên nguồn cũ vẫn có mục cần xem: worker `audit-closure.test.ts` thoát bất ngờ trước khi trả kết quả từng test, không suy thành pass hay lỗi assertion của game.
