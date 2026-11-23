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

---

# Sau khi sửa (2026-11-22)

Mã đã sửa: các commit `9ecbc85f`, `fe37734b`, `4ab22fac` trên nhánh `arena/0f6091f9-soul-of-hero`. Creator đã chọn nhịp tự lưu **B**.
Cách đo: bản trước khi sửa (`416809d3`) và bản đã sửa chạy **liền nhau** trong cùng một phiên, cùng cảnh, mỗi cửa sổ 30 giây game (1.800 khung hình). Số liệu gốc: `fps-tools/result-ab-*.jsonl`.
Năm phiên đo: phiên 1 đo `9ecbc85f`; phiên 2 và 3 đo `fe37734b`; phiên 4 và 5 đo `4ab22fac` (bản cuối). Ba commit chỉ khác nhau ở nhịp làm việc của luồng phụ.

**Về máy thử:** trong ngày, máy thử có một quãng chạy chậm gấp khoảng 1,8 lần mà tôi không tìm ra lý do (cùng một bài kiểm tra, cùng mã: lúc 149 giây, lúc 79 giây). Phiên 1–4 rơi vào quãng chậm đó, nên số FPS trung bình của bốn phiên này nhảy lung tung. Phiên 5 đo lúc máy đã ổn định, và là phiên duy nhất cho số FPS trung bình đáng tin. Số lần giật thì cả năm phiên đều cùng chiều.

## Kết luận ngắn

| Việc | Kết quả | Mức chắc chắn |
|---|---|---|
| Giật do dựng vùng | **Giảm rõ.** Số khung hình bị chen ngang giảm từ 5–20 xuống 1–5 mỗi 30 giây | Đo 5 phiên, cùng chiều |
| Giật do tự lưu | **Giảm khoảng một nửa đến 9/10**, tuỳ lúc đứng yên hay đang đi | Đo 5 phiên, cùng chiều |
| FPS trung bình | **Tăng ở phiên 5** (máy ổn định): file lưu giờ 8 từ khoảng 36 lên 41 FPS, thời gian mỗi khung hình giảm khoảng 23 %. Phiên 1–4 (máy chậm thất thường) không kết luận được | Một phiên sạch, cảnh giờ 8 đo 2 lượt theo hai thứ tự. Cần Creator xác nhận trên máy thật |
| Sương mù | **Giảm khoảng 1/4 thời gian vẽ** ở phiên 5 (7,0 → 5,3 ms); ở phiên 1 thì không thấy giảm | Đo 4 hồ sơ CPU, 2 phiên |
| Cư dân mỗi khung hình | **Chưa sửa** | Xem mục "Điều chưa đạt" |
| Bộ nhớ | **Tăng** khoảng 130–150 MB trong vài phút đầu sau khi vào game, sau đó còn khoảng 50 MB | Đo 1 phiên |

## Đã sửa gì

1. **Tự lưu (nhịp B).** Vẫn không lưu dày hơn 5 giây một lần. Đang mở bảng, đang nghỉ hoặc đã chết: lưu đầy đủ như cũ. Đứng yên từ 0,6 giây và không có mối nguy trong 190 px: lưu nhẹ. Đang đi hoặc đang đánh: chờ, nhưng không quá 20 giây. Lưu nhẹ chỉ ghi vào IndexedDB; phần đóng gói, mã kiểm và ghi đĩa chạy ở luồng phụ. Lúc chết, lúc ẩn hoặc đóng tab, và lưu từ menu vẫn là lưu đầy đủ. Kiểm tra hợp lệ còn một lần; bộ gói tìm đường viết lại, kết quả giống từng byte (có bài kiểm tra).
2. **Dựng vùng.** Một luồng phụ dựng sẵn các vùng nơi cư dân đang đứng và vùng sát bên, bắt đầu ngay từ màn hình tiêu đề. Vùng nào chưa kịp thì luồng chính vẫn dựng như cũ. Kết quả dựng giống hệt: đã so 925.565 ô và 9.792 điểm nguyên liệu với mã cũ. Vùng đã dựng được giữ ở dạng gọn (khoảng 0,1 MB thay vì 0,5 MB mỗi tầng). Luồng phụ tự tắt sau 30 giây không có việc để trả lại bộ nhớ, và tự bật lại khi cần.
3. **Sương mù vẫn là phần vẽ nặng nhất.** Phần tính nhiễu đã hết (2,7 ms ở phiên 1, 1,6 ms ở phiên 5). Tổng thời gian vẽ khi có sương: phiên 1 không giảm (14,8 → 14,9 ms), phiên 5 giảm 7,0 → 5,3 ms. Phần còn lại là các lệnh tô từng chấm nhỏ. Hai cách vẽ gộp đã thử đều cho hình lệch tới 2/255 mỗi kênh màu nên đã bỏ.

## Số đo trước / sau

Đơn vị: số khung hình bị chen ngang và tổng ms trên luồng game trong một cửa sổ 30 giây. Mỗi ô ghi lần lượt các phiên đo.

**Dựng vùng trên luồng game**

| Cảnh | Trước | Sau |
|---|---|---|
| Ván mới, 30 giây đầu | 10 khung / 2.286 ms; 11 / 5.004 | 5 / 2.147; 3 / 2.005 |
| Ván mới, phút 1,6 | 20 / 4.062; 20 / 4.257 | 1 / 411; 3 / 3.061 |
| File lưu giờ 8, 30 giây đầu | 8 / 3.051; 8 / 2.809; 8 / 5.468 | 1 / 576; 1 / 351; 1 / 253 |
| File lưu giờ 8, giây 30–60 | 5 / 1.338; 5 / 1.713 | 1 / 202; 1 / 305 |
| File lưu giờ 8, giây 60–90 | 5 / 1.152 | 2 / 561 |
| File lưu giờ 8, đang đi | 8 / 3.221; 8 / 4.905 | 1 / 203; 1 / 361 |

Lưu ý: thời gian của một lần dựng thay đổi theo tải của máy thử (150–1.300 ms). Hãy tin **số khung hình** hơn số ms. Ô "3 / 3.061" là ba lần dựng rơi đúng lúc máy thử chậm.

**Tự lưu trên luồng game**

| Cảnh | Trước | Sau |
|---|---|---|
| File lưu giờ 8, đứng yên (6 lần lưu / 30 giây) | 1.217; 1.136; 1.166; 2.040; 1.006; 1.153 ms | 614; 459; 555; 474; 437; 480 ms |
| File lưu giờ 8, đang đi | 1.466 ms (7 lần); 1.642 ms (6 lần) | 230 ms (2 lần); 118 ms (1 lần) |
| Một lần lưu ở giờ 8 | 182 ms + 72–82 ms ghi IndexedDB | lưu nhẹ 81 ms; lưu đầy đủ khoảng 116 ms |

**Khung hình dài nhất, file lưu giờ 8, 30 giây đầu:** trước 822 / 723 / 1.656 ms; sau 685 / 455 / 365 ms.

**Kiểm tra trên bản dựng thật trong trình duyệt** (`fps-tools/e1-save.mjs`): đi bộ thì lưu nhẹ, IndexedDB tăng số bản, localStorage giữ nguyên; mở túi đồ thì lưu đầy đủ, hai nơi giống nhau, mã kiểm đúng; tải lại trang thấy nút Continue; Continue vào được với 286 cư dân; không có lỗi trang.

## Phiên 5 — máy thử ổn định, bản cuối `4ab22fac`

Số liệu gốc: `fps-tools/result-ab-5-quiet-machine.jsonl` (lệnh chạy: `fps-tools/ab5.sh`). Thời tiết hai bản giống nhau trong từng cặp (giờ 8: sương mù; ván mới: mưa). Cảnh giờ 8 đứng yên chạy 2 lượt theo thứ tự trước – sau – sau – trước.

| Cảnh | FPS trước → sau | ms mỗi khung hình trước → sau | Số khung dài hơn 33 ms | Khung dài nhất (ms) |
|---|---|---|---|---|
| Giờ 8 đứng yên, 30 giây đầu (2 lượt) | 34,8 và 37,6 → 41,1 và 40,9 | 14,41 và 13,13 → 10,56 và 10,63 | 28 và 24 → 15 và 16 | 309 và 332 → 235 và 176 |
| Giờ 8 đứng yên, giây 30–60 (2 lượt) | 37,4 và 35,2 → 42,0 và 40,9 | 12,65 và 13,41 → 9,93 và 10,32 | 16 và 22 → 10 và 10 | 199 và 182 → 168 và 171 |
| Giờ 8 đang đi | 36,4 → 40,5 | 13,95 → 10,72 | 33 → 4 | 383 → 182 |
| Ván mới, 30 giây đầu | 49,0 → 48,4 | 9,35 → 9,10 | 27 → 14 | 360 → 309 |
| Ván mới, phút 1,6 | 51,8 → 55,4 | 8,64 → 7,39 | 28 → 6 | 299 → 189 |

Trong cùng phiên này, trên luồng game mỗi 30 giây:

| Cảnh | Dựng vùng trước → sau (khung / ms) | Tự lưu trước → sau (ms) |
|---|---|---|
| Giờ 8 đứng yên, 30 giây đầu | 8 / 1.543 và 8 / 1.559 → 1 / 162 và 1 / 137 | 519 và 550 → 195 và 216 |
| Giờ 8 đứng yên, giây 30–60 | 5 / 643 và 5 / 578 → 1 / 119 và 1 / 110 | 557 và 584 → 254 và 143 |
| Giờ 8 đang đi | 8 / 1.792 → 1 / 137 | 548 (6 lần) → 36 (1 lần) |
| Ván mới, 30 giây đầu | 11 / 1.727 → 2 / 491 | 337 → 152 |
| Ván mới, phút 1,6 | 20 / 2.275 → 2 / 312 | 429 → 156 |

Vẽ khi có sương mù (hồ sơ CPU, giờ 8, giây 30–60): 7,0 → 5,3 ms mỗi khung hình. Phần tính nhiễu (1,6 ms) không còn.

**Cách đọc:** ở file lưu giờ 8, trung bình bốn cửa sổ là 13,4 → 10,4 ms mỗi khung hình (bớt khoảng 23 %), FPS 36,3 → 41,2. Ván mới 30 giây đầu thì FPS trung bình gần như không đổi; cái được ở đó là ít giật hơn. Đây là một phiên trên máy thử không có card đồ hoạ; con số trên máy của Creator sẽ khác, nên vẫn cần Creator chơi thử để xác nhận.

## Điều chưa đạt

1. **FPS trung bình: bốn phiên đầu không kết luận được.** Các cặp đo liền nhau ở phiên 1–4 (trước → sau): file lưu giờ 8 đứng yên 20,3 → 15,5; 18,8 → 19,0; 18,6 → 16,3; 9,4 → 19,3; 16,2 → 21,3; 19,1 → 21,2. Đang đi 17,8 → 15,9; 12,0 → 21,0. Ván mới 27,4 → 24,9; 31,0 → 30,9; 17,7 → 14,8; 29,6 → 17,9. Máy thử lúc đó chạy chậm thất thường (xem "Về máy thử" ở trên), cùng một bản chạy hai lần đã lệch nhau ±5 FPS. Chỉ phiên 5 cho thấy bản sửa nhanh hơn. Phần nặng đều đặn của mỗi khung hình vẫn là tính 286 cư dân và vẽ sương mù; bản sửa không đụng tới phần cư dân.
2. **Đã kiểm tra hai nghi ngờ, cả hai đều sai.** (a) "Luồng phụ giành nhân xử lý với game": tắt luồng phụ thì chậm hơn (14,8–15,1 FPS, khung dài nhất 1.262 ms), không nhanh hơn. (b) "Mã mới làm bước mô phỏng chậm đi": chạy riêng bước mô phỏng trong Node, mã cũ và mã mới xen kẽ, 5.400 khung hình mỗi lượt: trung vị 4,8 và 4,3 ms (cũ) so với 4,5 và 3,9 ms (mới). Không chậm hơn.
3. **Sương mù.** Phần tính nhiễu (2,7 ms) đã hết, nhưng tổng thời gian vẽ khi có sương vẫn khoảng 14,8 ms. Phần còn lại là các lệnh tô từng chấm nhỏ. Hai cách vẽ gộp đã thử đều cho hình lệch tới 2/255 mỗi kênh màu nên đã bỏ.
4. **Cư dân mỗi khung hình: chưa sửa.** Đo theo từng dòng mã, phần "tính lặp" có thể bỏ mà không đụng thiết kế chỉ khoảng 0,5–1 ms trong khung hình 15–25 ms của máy thử. Các chỗ đó (lập lại danh sách vật thể, lập lại bảng giường mỗi lần gọi) lại là chốt an toàn có chủ ý trong mã. Lợi ít, rủi ro có, nên chưa làm. **Cập nhật:** sau khi Creator đồng ý, phần này đã làm ở bản `6c4b8933`; xem phần "Cư dân chờ tới việc kế tiếp" ở cuối tệp.
5. **Vẫn còn giật trong 30 giây đầu của ván mới** (3–5 lần dựng vùng trên luồng game): luồng phụ chưa kịp dựng xong khi người chơi bấm bắt đầu.
6. **Lưu nhẹ vẫn chiếm 81 ms trên máy thử ở giờ 8** (kiểm tra hợp lệ 28, đổi thành chữ 28, gói tìm đường 20). Ba bước này phải chạy trên luồng game để bản lưu nhất quán. File lưu càng lớn thì càng lâu.
7. **Bộ nhớ tăng.** Trình duyệt dùng 756–860 MB (sau) so với 600–725 MB (trước) trong 5 phút đầu sau khi vào file lưu giờ 8; sau khi luồng phụ tắt và trình duyệt dọn bộ nhớ: 570–585 MB so với 510–540 MB.
8. **Luật "luồng phụ nghỉ khi game đang trễ khung hình"** không đo được trên máy thử (máy thử dùng đồng hồ giả). Phần này chỉ có bài kiểm tra đơn vị và lượt chạy trình duyệt thật ở trên.
9. Giới hạn 5 MB của localStorage khi đóng tab: chưa giải quyết.

## Nghiệm thu

Tất cả chạy trên bản cuối `4ab22fac`.

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| Hồi quy 263 tệp (260 cũ + 3 bài mới: lưu, dựng vùng, sương mù) | **250 đạt, 0 đỏ**, 13 tệp chỉ có bài tự chọn (không chạy bài nào, như các lượt trước). 1.573 bài đạt, 0 bài trượt |
| Chạy bền 336 giờ, seed 7606, không người chơi | Cổng chiến dịch **15/15**. Sơ tán 6, sống sót 33, chết 247: **trùng khít** với lượt trên `0d9cc3b3`, tức bản sửa FPS không làm đổi mô phỏng cư dân |
| Kết quả dựng vùng so với mã cũ | Giống hệt: 925.565 ô và 9.792 điểm nguyên liệu (so trên `9ecbc85f`; hai commit sau không đụng tới mã dựng vùng) |
| Tự lưu trên bản dựng thật trong trình duyệt (`fps-tools/e1-save.mjs`, chạy lại trên bản cuối) | Đạt: đi bộ 15 giây thì lưu nhẹ; đứng yên thì lưu nhẹ; mở túi đồ thì lưu đầy đủ, hai nơi giống nhau; tải lại trang rồi Continue vào được với 286 cư dân; không có lỗi trang |

Ghi rõ: ở lượt hồi quy đầu, ba tệp không đạt vì quá giờ: `npc-runtime-throughput` (149 giây, hạn 90 giây), `ecosystem-full` và `arena1-round2-newgame-routes` (bị ngắt ở 1.800 giây). Lúc đó máy thử đang chậm và còn chạy chung với lượt 336 giờ. Chạy lại riêng từng tệp, không đổi mã: cả ba đạt (87 giây, 1.585 giây, 1.228 giây). Để chắc không phải do mã mới chậm đi, tôi chạy `npc-runtime-throughput` xen kẽ mã cũ – mã mới – mã cũ: 82,7 – 78,9 – 82,7 giây. Kết quả từng tệp ở `/home/user/acc/reg8` (ngoài repo), bản ghi lượt đầu giữ ở các tệp `*.first-pass.*`.

Chưa kiểm: chơi tay trên máy thật có card đồ hoạ; bộ nhớ trên máy 4 GB RAM trở xuống.

## Muốn FPS tăng thêm nữa thì cần Creator quyết định

- **Cư dân không tính ở mọi khung hình: Creator đã đồng ý, đã làm.** Kết quả thật thấp hơn ước lượng ghi ở đây trước kia (bớt 0,7 ms chứ không phải "khoảng một nửa của 3–5 ms"). Chi tiết ở phần ngay dưới.
- **Sương mù vẽ gộp thành một lớp.** Hình lệch tối đa 2/255 mỗi kênh màu (mắt không thấy), đổi lại bớt phần lớn thời gian vẽ sương. Chưa đo được mức bớt chính xác.

# Cư dân chờ tới việc kế tiếp (2026-11-22, bản `6c4b8933`)

Creator đã đồng ý cho cư dân được tính thưa hơn. Phần này ghi lại cái đã làm, số đo, và chỗ nó khác với lời mô tả lúc xin ý kiến.

## Đã làm gì

Trước đây, mỗi khung hình game đều chạy trọn "bước cư dân" cho 286 người: trừ đói khát, xét kế hoạch, bước đi. Bây giờ, khi đang chơi trực tiếp, bước này **được bỏ qua ở những khung hình mà không cư dân nào có việc đến hạn**, tối đa 50 mili giây (3 khung hình) rồi phải chạy lại.

- **Mọi mốc có hẹn giờ vẫn được tính đúng thời điểm của nó, không trễ:** mốc đói khát, lúc đặt chân tới ô kế tiếp, lúc làm xong việc, lúc tới lượt suy nghĩ, giờ tàu rời bến, đợt tấn công của Elder. Game hỏi trước "việc kế tiếp của cư dân là lúc nào" rồi dừng đúng ở đó.
- **Cái có thể trễ tối đa 0,05 giây** là phản ứng với việc không hẹn trước: một con thú vừa lọt vào tầm nhìn, kho vừa đổi hàng, cú đánh đầu tiên trúng một cư dân.
- **Không bao giờ chờ** khi: có cư dân đang đánh nhau hoặc đang nhắm đánh, có người đi theo người chơi, đang sơ cứu, Elder đã thức, có người đang dịch chuyển bằng lõi, hoặc có người vừa tới một ô và sắp bước tiếp.
- Tua ngoại tuyến (khi vắng mặt, khi Continue) **không đổi một dòng nào**.

**Khác với lời mô tả lúc xin ý kiến.** Lúc đó tôi viết "ví dụ tính 10 lần mỗi giây, các mốc đói khát có thể trễ 0,1 giây". Bản đã làm chặt hơn: mốc đói khát không trễ, chỉ phản ứng với việc bất ngờ mới trễ, và tối đa 0,05 giây.

## Số đo (phiên 7, `4ab22fac` → `6c4b8933`, thứ tự cũ, mới, mới, cũ)

| Cảnh | Thời tiết | FPS cũ → mới | ms mỗi khung hình | Bước mô phỏng (ms) | Khung dài hơn 33 ms |
|---|---|---|---|---|---|
| Giờ 8 đứng yên, 30 giây đầu | Sương mù | 38,7 và 39,4 → 39,2 và 43,3 | 11,50 và 11,09 → 10,50 và 9,65 | 2,99 và 2,89 → 2,32 và 2,18 | 18 và 11 → 17 và 15 |
| Giờ 8 đứng yên, giây 30–60 | Sương mù | 39,4 và 40,9 → 43,2 và 42,5 | 10,98 và 10,34 → 9,16 và 9,43 | 3,08 và 3,02 → 2,25 và 2,29 | 13 và 12 → 13 và 12 |
| Ván mới, 30 giây đầu | Mưa | 48,1 và 42,6 → 44,9 và 47,8 | 9,16 và 10,58 → 9,80 và 8,88 | 4,47 và 5,27 → 4,53 và 4,16 | 19 và 25 → 20 và 17 |
| Ván mới, phút 1,6 | Mưa | 54,5 và 55,3 → 52,9 và 52,0 | 7,68 và 7,28 → 7,92 và 7,84 | 4,21 và 4,03 → 4,21 và 4,12 | 7 và 6 → 7 và 18 |

**Cách đọc:**

- **File lưu giờ 8:** bước mô phỏng bớt khoảng 0,7 ms mỗi khung hình (3,0 → 2,26). Trung bình bốn cửa sổ: 10,98 → 9,69 ms mỗi khung hình, FPS 39,6 → 42,1. Số khung dài hơn 33 ms không đổi.
- **Ván mới: không được gì.** Ở đầu ván luôn có 6–13 cư dân đang đi; cứ mỗi lần một người tới ô mới thì bước cư dân phải chạy, nên nó vẫn chạy ở 875 trên 900 khung hình (đếm trong bài kiểm tra, 15 giây đầu của ván mới). Các con số ở hai dòng ván mới chỉ là dao động giữa các lượt.
- **Ước lượng trước kia của tôi sai.** Tôi đã viết "bớt khoảng một nửa của 3–5 ms". Thực tế là 0,7 ms, và chỉ ở cảnh ít người đi lại.
- Phần vẽ (5–6 ms ở giờ 8 khi có sương) không đổi và vẫn là phần lớn nhất của khung hình.

## Một cách làm đã thử rồi bỏ

Phiên 6 đo một bản không có luật "người sắp bước tiếp thì không chờ". Bản đó bớt được 0,4–0,8 ms cả ở ván mới. Đổi lại, người đang đi bị vẽ đứng khựng tới 3 khung hình ở mỗi ô rồi nhảy tối đa khoảng 3,6 điểm ảnh: tắt luật này đi thì bài kiểm tra đếm được 627 lượt "đứng giữa hai ô" trong 900 khung hình, bật lên thì 0. Đây là thay đổi hình ảnh nên đã bỏ. Số đo thô của bản đó vẫn giữ ở `fps-tools/result-ab-6-resident-wait-early-variant.jsonl`.

## Nghiệm thu trên `6c4b8933`

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| Bài kiểm tra mới `tests/resident-step-wait.test.ts` | Đạt. Chạy 900 khung hình với đủ 286 cư dân: không mốc nào bị bỏ qua, không ai bị tính trễ quá 50 ms, người đang đi được vẽ đúng vị trí theo đồng hồ và đi đủ số ô theo tốc độ của mình, không ai bị vẽ đứng giữa hai ô |
| Hồi quy 264 tệp (263 cũ + bài mới) | **251 đạt, 0 đỏ**, 13 tệp chỉ có bài tự chọn. 1.575 bài đạt, 0 bài trượt. Lần này không tệp nào phải chạy lại |
| Chạy bền 336 giờ, seed 7606, không người chơi | Cổng chiến dịch **15/15**. Sơ tán 6, sống sót 33, chết 247. **Mã băm trạng thái của cả 336 giờ trùng từng giờ với lượt trên `4ab22fac`** |
| Tự lưu trên bản dựng thật trong trình duyệt (`e1-save.mjs`) | Đạt, không có lỗi trang |

Lượt 336 giờ chỉ đi qua đường tua ngoại tuyến, là đường không bị sửa, nên kết quả trùng khít là điều phải có; nó xác nhận bản sửa không rò sang đường đó. Phần chơi trực tiếp được kiểm bằng bài kiểm tra mới và các tệp hồi quy có gọi bước chơi trực tiếp.

**Chưa kiểm:** chưa có ai nhìn cư dân đi lại bằng mắt trên máy thật sau bản sửa này. Vị trí cư dân dùng để xét trúng đòn có thể cũ tối đa 0,05 giây (lệch tối đa khoảng 3,6 điểm ảnh với người đang đi) ở những khung hình bước cư dân đang chờ. Khi có cư dân đang đánh nhau thì không có khung hình nào như vậy.
