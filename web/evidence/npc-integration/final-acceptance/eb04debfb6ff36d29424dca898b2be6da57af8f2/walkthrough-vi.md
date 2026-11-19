# Đi thử bằng điều khiển thường (không dùng QA để dời người hoặc tạo đồ)

Mở build production → **New run → Begin the 14 days**. WASD/phím mũi tên để đi, F tương tác đúng mặt/tầng, I túi, C công thức, B xây, M bản đồ, Escape đóng panel/menu. Không cần nhận quest. [7 ảnh gốc](native/) ghi tại 640×360 DPR1; ví dụ nhân vật đáp ở AU 944,421 F0, seed 1802937419. Đây là ảnh game vẽ trực tiếp bằng asset trong build, không ghép/upscale. `observations.json` ghi kích thước và page errors; không có trace network đầy đủ để khẳng định mọi request đều sạch.

**Một run khác có thể tiếp tục**: `field/continue-snapshot.json.gz` là đầu ra save thật, không phải save tạo tay. Seed 1802831566, `veyra05-at-832-704`, F0 tile (917,875). Ảnh 01 sau khi giữ D, M → Mark my spot; Escape → Save & quit, đóng Chromium, mở lại cùng profile → Continue → M (ảnh 02). `field/run.json`: cùng ID, 286 người, +20131 ms. Seed thay đổi theo lượt mới: tọa độ/ID sau đây chỉ áp dụng cho log đó.

|Chiến dịch|Các bước tiếp và điều phải ghi (chưa được coi là hoàn thành)|
|---|---|
|A|Đi tới kho Greywater (1587,1161) F0 `c15m`, theo h1/hj2t4 → `0:4821665`; chụp pack `c16d`, stock, UID và receipt lúc giao. Không suy diễn giao từ select.|
|B|Quan sát h1 builder, h2 guard, h3 gardener, h5 medic, h6 cook, h8 salvager, h9 mechanic. Tìm engineer bằng panel thực tế. Tách vật liệu đi làm khỏi sản phẩm/việc chữa thực; ghi thời điểm, UID, kho và lý do khi thiếu.|
|C|Người gần điểm xuất phát khi lưu: h4d, salvager Typhon (1101,724), pack c23m. Đi tới rồi F; xem nhu cầu, đề nghị trợ giúp có chi phí. Ghi consent/refusal, thử Follow/Hold/Return Home qua cửa/tầng. Không đặt trust.|
|D|Đưa hai dòng hàng; kiểm trước/sau cả hai túi. Thử bill không thể đáp ứng. Khi đối đầu, ghi người nhìn thấy, incident và phản ứng; tường/tầng khác không được thành nhân chứng tự động.|
|E|Theo h2 ngoài hiện trường có mối đe dọa; chụp vũ khí/đạn, impact, DOWNED rồi xử lý thuốc. Reload đối chiếu không trúng hai lần.|
|F|Trong khi h1 đi job trên, rời cửa sổ/tầng, lưu và quay lại; tra đúng job/pack. Smoke đã chứng minh relaunch, chưa chứng minh cùng job đã giao trong browser.|
|G|Đến mốc h312 (nếu dùng tăng tốc phải công bố). Ghi từng lair, launch/arrival, target và người thực sự bị trúng/chặn; không tự đặt awakenedAt.|
|H|Từ h288 đến một bến thật: west (684,1150) hold c2qw, south (2356,2170) c2rn, hook (2784,738) c2se. Theo một nhóm đến đúng bến, chụp chi phí/manifest và arrival; ở lại cùng nhóm khác tới h336 trước khi đọc kết quả. Mở run 2, kiểm profile và run-local wipe. Có nhánh solo riêng; không ghép hai run thành dual rescue.|
|I|Đi tự do, dùng map/marker đã thấy. Còn thử bỏ cargo, từ chối join, qua cửa ở chỗ đông và xem có bị HUD che mục tiêu. Ghi ảnh native thật và nhận xét riêng của Creator.|

Khi gặp blocage, lưu hai ảnh, seed, tile/tầng, thời gian, actor/job/source/container/UID và receipt có liên quan. Nếu không có receipt đừng thay bằng dự đoán. Không dùng test với vị trí dàn sẵn làm bằng chứng walkthrough.
