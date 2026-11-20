# Chiến dịch settlement có checkpoint — CHƯA đạt 336 giờ

Từ web checkout sạch tại `eb04debfb6ff36d29424dca898b2be6da57af8f2`, seed 7606 Greywater, T0 2026-11-15 08:00 UTC. Khởi tạo kho/người/nhu cầu như game, không buff HP/hunger/thirst, không cho đồ, không ép intent, không bỏ actor. Gọi `settle` thật theo giờ, lấy bộ đếm inclusive (không cộng chồng các label), snapshot strict của game, và kiểm lại cùng timestamp không đổi state. Khi t=336h phải có lịch sử đúng run và expired, không còn active run. Đây là **simulation engineering**, không phải 14 ngày thao tác thật. Chạy cuối còn phải đánh giá tồn kho/survivors/chi phí; chỉ tới mốc thời gian cũng không tự đạt release.

Đã thử bằng **hai process**: settle phút 1, lưu, đóng, mở đúng checksum + SHA, validate, rồi settle phút 2 cùng run `run_5va_mwhjny80`, giữ nguyên 286 actor. File `two-minute-check.json` là toàn bộ kết quả hiện có, **2 / 20160 phút**, không phải số liệu cả giờ. Phút 2: 3082 world slices, 71 region compilations/0 render compilations, 32765 route expansions; 16.65s trong `compileCanonicalGeometryRegion` trên máy đang chạy việc khác, không dùng làm so FPS.

Tái lập/tiếp tục từ measured `web/` (không đổi branch, không dùng checkpoint của SHA khác):

```
node /path/to/web/scripts/npc-endurance.mjs /absolute/output/directory 20160
```

`checkpoint.json.gz` chứa snapshot + SHA + digest + lịch sử; cập nhật qua rename nguyên tử sau mỗi checkpoint. `progress.json` dễ đọc. Trong workspace hiện tại: `tmp/verification/endurance-eb04deb/`. Không chạy song song với benchmark. Worker nối tiếp sau T9 đã đăng ký; một phiên interrupted chỉ được tính đến checkpoint durable cuối cùng.

**Cập nhật sau pilot — đã đến h1, chưa đến h336.** Process thứ ba nạp đúng checkpoint phút 2, tiếp tục tới phút 60; KHÔNG bắt đầu lại hoặc thay chế độ metabolism. `one-hour.json` (3 interval), `hour-1.checkpoint.json.gz` (full strict snapshot có digest). Tại h1 đủ 286 actor: 260 IDLE, 22 DOWNED, 3 WORKING, 1 MOVING. Riêng đoạn phút 2→60 ghi 996 lần harvest output, 968 delivery, 1 production pay/finish/pickup, 10 `human.treat`. Đây là số receipt, không suy ra sản lượng bền vững 14 ngày. Cùng timestamp không đổi game state. CPU-wall đoạn này 181.723 s với worker khác đang chạy, không dùng làm FPS. `worldSlices=59038`, 1,032,372 route expansions, 0 render compilations. Vẫn còn **335 giờ** chưa đo. Muốn tiếp tục sau khi mất thư mục tạm: copy `hour-1.checkpoint.json.gz` thành `checkpoint.json.gz` vào **thư mục trống**, rồi chạy lệnh trên đúng SHA eb04deb; không ghi đè checkpoint mới hơn.
