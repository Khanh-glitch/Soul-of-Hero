# Tidecamp — thiếu nước, người bị thương và một thùng hứng mưa

Ca hồi quy bước 1, **không phải** lượt chơi 336 giờ đạt. Checkpoint h61 của seed 7606, nối từ save h24 đã có, mô phỏng `dad5317`, không thêm người, thuốc, nguyên liệu, vị trí hoặc mưa. Lượt đối chứng chưa có thay đổi này tới h80 còn 34/286 người không chết. Ở h61 đã khảo sát tám cộng đồng thiếu nước: sáu điểm lấy mẫu không có ô nước ngọt nào trong vòng 128 bước Manhattan. Hai điểm còn lại có nước ở 94 và 104 bước, chưa xác nhận đường đi. Không sửa bằng cách cho uống nước biển.

Ở Tidecamp, `h6f` đã được cầm máu nhưng chỉ còn 25 HP, dưới ngưỡng làm việc 30. Trong lần chạy không có chăm sóc tiếp, sau 45 phút vẫn chưa có thùng. Ở ca đã sửa, thầy thuốc `h6e` đem một thảo dược thật đến bên `h6f`, đưa HP lên 55. `h6f` trả 8 gỗ + 3 sợi (xe một dây thừng theo công thức có sẵn), lắp thùng **rỗng** ngoài trời. Sau khi nạp lại save, thời tiết của lượt chơi cho nước; `h6b` đến tận nơi, uống một đơn vị. UID, thời điểm và số dư trong `paid-catchment.json`. Nếu thiếu vật liệu, mặt bằng hoặc mưa thì không có nước. Không suy rộng một cộng đồng thành toàn đảo.

Chạy lại từ thư mục `web/`:

```sh
gzip -dc evidence/npc-integration/tidecamp-water/hour-61.save.gz > /tmp/soh-tidecamp.save
SOH_DRY_TIDECAMP=/tmp/soh-tidecamp.save npm test -- --maxWorkers=1 tests/npc-rain-catchment.test.ts
```
