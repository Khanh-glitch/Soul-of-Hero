# Vì sao FPS giảm — kết quả đo (2026-11-22)

Bản đo: nhánh `arena/0f6091f9-soul-of-hero`, HEAD `416809d3` (mã game `0d9cc3b3`), so với 20 mốc commit từ `main` (`82089fea`) trở đi.
Chưa sửa dòng mã game nào trong bước này. Công cụ và số liệu gốc: thư mục `fps-tools/`.

## Kết luận ngắn

**Không phải do ảnh.** Ảnh vật phẩm (229 KB) và ảnh NPC (mỗi tấm 4–5 KB) vẽ rất rẻ: số lệnh vẽ mỗi khung hình gần như không đổi (474 → 485), số điểm ảnh vẽ không đổi, thời gian vẽ không tăng.

**Do dữ liệu và phần mô phỏng đi kèm trong chính các commit đó.** Có 3 nguyên nhân mới, cộng 1 nguyên nhân cũ:

| # | Nguyên nhân | Người chơi thấy gì | Bắt đầu từ |
|---|---|---|---|
| 1 | **Tự lưu mỗi 5 giây làm đứng hình.** File lưu phình từ 73 KB lên 0,8–17 MB và cả gói được xử lý trong một khung hình | Cứ 5 giây khựng một nhịp, chơi càng lâu khựng càng dài | `e35863e8` (#208, ảnh vật phẩm + 557 rương), nặng thêm ở `3150563d` / `7e3a0cfb` (#250–#251, NPC) |
| 2 | **Dựng bản đồ vùng xa ngay giữa khung hình** khi cư dân tính đường và tìm nguyên liệu | Vài phút đầu mỗi lần vào game: giật mạnh 0,15–0,4 giây, 10–20 lần mỗi 30 giây | khoảng `957ee218` (#285) |
| 3 | **286 cư dân được tính lại ở mọi khung hình** (đói khát, kế hoạch, hạn chót) | FPS trung bình thấp hơn trên máy yếu | `7e3a0cfb` (#251); tệ nhất ở #270–#280; đã giảm một phần |
| 4 | *(cũ, `main` cũng có)* Vẽ sương mù tính 28.800 phép nhiễu mỗi khung hình | Trời sương mù là tụt còn một nửa FPS | có từ trước `main` |

Nhận xét của Creator đúng về **thời điểm** (đúng các commit đưa ảnh vật phẩm và NPC vào), nhưng thủ phạm là rương, cư dân và file lưu đi cùng, không phải bản thân ảnh.

## Cách đo

- Chromium không giao diện, khung vẽ 640×360 phóng lên 1280×720, máy thử 2 nhân, vẽ bằng phần mềm (không có card đồ hoạ).
- Đồng hồ game cố định 16,67 ms mỗi bước, mỗi bước chờ đúng một lần làm tươi màn hình thật. Ghi lại: thời gian JS của từng khung hình, hồ sơ CPU (tách phần mô phỏng / phần vẽ / tự lưu), số lệnh vẽ.
- Cảnh: ván mới, đứng yên tại điểm xuất phát; thêm cảnh đi bộ, cảnh đứng cạnh cư dân, và file lưu ở giờ thứ 8.
- **Con số tuyệt đối trên máy thử lớn hơn máy thật khoảng 2–4 lần. Hãy nhìn tỉ lệ giữa các mốc.** FPS của máy thử dao động ±6 giữa các lần chạy; thời gian JS và số khung hình dài thì ổn định hơn.

## Số đo theo từng mốc commit (20 giây, 1.200 khung hình, đứng yên)

| Mốc | Nội dung | JS mỗi khung (ms) | Phần mô phỏng (ms) | Khung dài nhất (ms) | Số khung > 33 ms | Mỗi lần tự lưu (ms) | File lưu |
|---|---|---|---|---|---|---|---|
| #207 `784cf427` | trước ảnh vật phẩm | 6,0 | 0,9 | 24 | 0 | 10 | 73 KB |
| #208 `e35863e8` | ảnh vật phẩm + 557 rương | 8,2 | 1,4 | 32 | 0 | **53** | 229 KB |
| #209 `d6558ce4` | 729 rương | 6,5 | 1,2 | 63 | 4 | 31 | — |
| #250 `3150563d` | sổ cái cư dân | 9,2 | 2,0 | 64 | 4 | 54 | 461 KB |
| #251 `7e3a0cfb` | NPC vào game (271 người) | 8,0 | 1,9 | 70 | 5 | 55 | 705 KB |
| #262 `f876a4c8` | | 8,3 | 3,0 | 58 | 5 | 73 | 775 KB |
| #270 `e4d45814` | tính nhu cầu theo hạn chót | **19,4** | **12,9** | 98 | 57 | 68 | — |
| #275 `a7001e4c` | | **31,9** | **22,1** | **2.744** | 170 | 79 | — |
| #280 `747fd55d` | | 20,8 | 16,1 | 1.337 | 37 | 61 | — |
| #285 `957ee218` | bắt đầu dựng vùng giữa khung hình | 11,7 | 3,7 | 1.337 | 10 | 70 | — |
| #300 `d7992702` | | 10,7 | 7,0 | 307 | 16 | 66 | 780 KB |
| #380 `e9d6a168` | | 13,4 | 7,8 | 353 | 22 | 75 | — |
| #421 HEAD | bản hiện tại | 9,3 | 7,0 | 507 | 14 | 73 (+80 ghi IndexedDB) | 802 KB |

Lệnh vẽ ảnh mỗi khung hình: 474 (#207) → 484 (#208) → 485 (HEAD). Thời gian vẽ: 5,2 → 3,8 ms.
Cảnh đứng cạnh cư dân: cả cửa sổ bản đồ chỉ có 3 cư dân, nhiều nhất 2 người cùng trên màn hình.

`main` (`82089fea`) trên máy thử: phần mô phỏng chỉ 0,07 ms, nhưng ván thử xuất phát trên cầu cảng, nơi mã cũ tô lại sàn từng điểm ảnh ở mọi khung hình (48.680 lệnh tô, 98 ms mỗi khung). Lỗi này đã hết từ khoảng #130, nên không so trực tiếp `main` với HEAD ở cảnh đó được; mốc so sánh sạch là #207.

## HEAD: cái gì làm khung hình dài (mỗi cửa sổ 30 giây)

| Thời điểm | Khung ≥ 25 ms | Dài nhất | Dựng vùng | Tự lưu | Ghi chú |
|---|---|---|---|---|---|
| 0–30 giây đầu | 82 | 362 ms | 2.082 ms (11 khung, 150–360 ms mỗi khung) | 510 ms (6 lần) | |
| phút 1,6 | 38 | 316 ms | 2.730 ms (20 khung) | 496 ms | |
| phút 5 | 21 | 165 ms | 135 ms (1 khung) | 538 ms (6 lần, ~90 ms) | bộ nhớ vùng đã ấm |
| file lưu giờ 8 | 104–213 | 423 ms | 982–2.025 ms | 731–1.084 ms (**180–216 ms mỗi lần**) | vào lại game là bộ nhớ vùng nguội lại; cảnh này đang sương mù nên có thêm nhiều khung dài do vẽ |

Chi phí đều mỗi khung hình ở HEAD (phút 5): nhu cầu cư dân 1,15 + kế hoạch 1,22 + hạn chót 0,43 + phần thế giới còn lại 1,48 = **4,3 ms**, so với 0,7 ms ở #207.

So với #207 trong cùng 11 phút: khung dài nhất của #207 là 21–64 ms; của HEAD là 160–390 ms.

## File lưu phình ra

73 KB (#207) → 229 KB (#208) → 705 KB (#251) → 802 KB (ván mới ở HEAD) → 1,19 MB sau 5 phút → 1,65 MB ở giờ 8 → 3,5 MB ở giờ 264 → **17,7 MB ở giờ 335**, trong đó 15,4 MB là các phép tìm đường còn dang dở của cư dân.

Một lần tự lưu ở giờ 8 (179 ms + 77 ms ghi IndexedDB): đổi thành chữ 47 ms, kiểm tra hợp lệ 44 ms (**chạy hai lần**), gói phần tìm đường 35 ms, ghi localStorage 33 ms, đọc lại so sánh khoảng 10 ms, mã kiểm 8 ms.

Lưu ý an toàn dữ liệu (không phải FPS): localStorage chỉ chứa được khoảng 5 MB. Khi file lưu lớn hơn, lần lưu tức thời lúc đóng tab không ghi được, chỉ còn bản tự lưu trong IndexedDB.

## Hướng sửa — không bỏ hình ảnh hay tính năng nào

1. **Tự lưu.** Kiểm tra hợp lệ một lần thay vì hai; chuyển phần tính mã kiểm và ghi IndexedDB sang luồng phụ; viết lại bộ gói tìm đường cho nhanh mà giữ nguyên định dạng. Phần còn lại cần Creator quyết định nhịp lưu (xem câu hỏi trong báo cáo).
2. **Dựng vùng.** Một luồng phụ dựng sẵn các vùng cư dân sẽ hỏi tới ngay khi vào game; kết quả giống hệt vì phép dựng không phụ thuộc trạng thái ván. Vùng nào chưa kịp thì luồng chính vẫn dựng như hiện nay.
3. **Cư dân mỗi khung hình.** Giữ nguyên kết quả, chỉ bỏ việc tính lặp: nhớ lại ngữ cảnh chỗ ở / giường khi chưa có gì đổi, không dựng lại danh sách vật thể ở mỗi lần gọi.
4. **Sương mù (lỗi cũ).** Nhớ lại lưới nhiễu thay vì tính lại mỗi khung hình; hình ảnh giữ nguyên.

Nghiệm thu sau khi sửa: đo lại bằng đúng bộ công cụ này (cùng cảnh, cùng máy), chạy các bài kiểm tra cư dân và lượt 336 giờ để chắc kết quả mô phỏng không đổi.
