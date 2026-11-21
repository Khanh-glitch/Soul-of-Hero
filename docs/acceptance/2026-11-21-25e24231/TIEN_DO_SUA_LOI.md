# Tiến độ sửa lỗi sau nghiệm thu `6d2dec8`

Cập nhật: 2026-11-21. Nhánh `arena/0f6091f9-soul-of-hero`, đầu nhánh là commit "Elders cross open sea". Chưa đẩy lên GitHub, chưa có PR, chưa phát hành.

## Các commit

| Commit | Nội dung |
|---|---|
| `6f6b534` | Elder hành quân trên bộ tới khu dân cư (trước đây cả 36 đợt đều bị chặn). |
| `8d882e6` | Giới hạn bộ nhớ tìm đường lưu trong save (bản đầu, có lỗi — xem dưới). |
| `43e4713` | Thay giới hạn cứng bằng hàng chờ: tìm đường dài phải đợi lượt, không bị cắt ngang. |
| `ba9894a` | Bốn lỗi người chơi nhìn thấy: gỗ không cộng dồn, tên dân sai nghề, túi đồ khi chết, cửa QA trên màn hình chính. |
| `01021db` | Sửa bộ dựng cảnh của các bài kiểm thử theo luật PA1 (thiết bị phải đóng gói trước khi đặt). |
| (commit kế tiếp) | Elder vượt biển — quyết định của Creator 2026-11-21 ("cho vượt biển luôn"). |

## Đã đo được

**Chạy lại h288 → h336 (seed 7606, không có người chơi) trên `43e4713`:**

| | `6d2dec8` | `43e4713` |
|---|---|---|
| Save lớn nhất | 18,53 MB | 4,11 MB |
| Phần tìm đường lớn nhất | 16 MB | 2,17 MB |
| Sơ tán | 6 | 6 (tàu `po_evac_west` chở 6/6, cập bến h296) |
| Sống sót trên đảo | 38 | 34 |
| Chết | 242 | 246 |
| Elder chạm khu dân cư | 0 | Aion, Anubis, Typhon, Argus (Surtur và Atlas bị biển chặn) |
| Dân bị đe doạ / được lính che và sống | 0 / 0 | 11 / 3 |

Đây là chạy lại từ save h288 bằng bài kiểm thử tạm, **không phải** bài endurance 336 giờ chính thức và chưa qua `npc-campaign-gate`.

**Lỗi của `8d882e6`:** bản giới hạn đầu tiên đóng sớm các lượt tìm đường dài. Chạy lại từ h288 thì không ai sơ tán được (0 người tới h307, trong khi bản gốc có 6 người cập bến lúc h295). `43e4713` thay bằng hàng chờ và kết quả sơ tán trở lại như bản gốc.

**Trình duyệt (Chromium 131, 640×360, bản build `01021db`, không lỗi trang):**

- Màn hình chính chỉ còn `New run` và `Profile & history`; chọn thế giới chỉ còn VEYRA; F9 không mở gì.
- Ván mới: 286 dân, 0 người có tên lệch nghề.
- Mở save h264 của bản cũ (người chơi đã chết, biên nhận tử vong đã bị đẩy khỏi sổ): bảng tử vong báo túi ở (37, 121), 3 chồng đồ; tên dân được sửa khi tải; save ghi lại còn 1,97 MB.
- Mở save h335 mới (2,26 MB): lưu được vào localStorage, chạy tiếp qua h336 và hiện màn kết "Consumed by Ragnarok — Reached safe water 6 · Survived on the island 34 · Died 246". Trước đây save h335 (17,7 MB) không lưu nổi.

**Kiểm thử:** `typecheck` và `typecheck:tests` sạch; build chạy được. Trong 38 tệp đỏ ở `6d2dec8`: 16 tệp đã xanh, còn 22 tệp đỏ (143 → 33 bài hỏng).

## Elder vượt biển (quyết định Creator 2026-11-21)

Elder đi thẳng tới khu dân cư còn người gần nhất, băng qua biển nếu cần, vẫn 40 ô/giờ; chỉ dừng khi đã đứng trên đất, cách dân 24 ô. Đợt đánh cuối (≤ 64 ô) cũng không còn bị nước sâu chặn; vách đá, tường và vật cản vẫn chặn.

Chạy lại h288 → h336 (seed 7606, không có người chơi):

| | Chưa vượt biển (`43e4713`) | Vượt biển |
|---|---|---|
| Sơ tán / sống sót / chết | 6 / 34 / 246 | 6 / 34 / 246 |
| Elder chạm khu dân cư | 4 | 5 (thêm Atlas: bơi 490 ô biển, lên bờ, đánh `po_netcamp` 2 đợt) |
| Dân bị đe doạ / bị trúng / được lính che và sống | 11 / 8 / 3 | 16 / 12 / 5 |
| Save lớn nhất | 4,11 MB | 4,11 MB |

**Surtur vẫn không kịp đánh:** khu dân cư gần nhất (`po_saltpans`) cách 1.063 ô, cần khoảng 26,6 giờ ở 40 ô/giờ, mà từ lúc thức (h312) tới hết ván chỉ có 24 giờ. Lúc h335 Surtur đã lên bờ bên kia nhưng còn cách dân 145 ô.

## Chưa làm

- 22 tệp kiểm thử còn đỏ (công thức đã bị Sổ cái rev 6 rút, hết giờ khi ván kết thúc, thiếu tệp bằng chứng, `item-ontology-v2` sập khi nạp) và 6 tệp treo.
- Chạy lại toàn bộ 260 tệp trên một SHA đã khoá; endurance 336 giờ chính thức và `npc-campaign-gate`.
- Kiểm tra trên trình duyệt: cộng dồn gỗ (mới có bài kiểm thử đơn vị), cảnh A–I, xây dựng, chiến đấu, giao dịch, sơ tán thủ công.
- Save lớn nhất 4,11 MB mới đo bằng mô phỏng, chưa thử lưu thật trong trình duyệt ở giờ đó.
- Surtur chưa kịp tới nơi ở tốc độ 40 ô/giờ; cần Creator quyết có tăng tốc độ hay không.
- ZIP phát hành, Vercel, tài liệu hướng dẫn, PR vào `main`.
