# Tra ô nước ngọt: giữ nguyên kết quả, bớt dựng lại địa hình

Ở giờ 41 của lượt đối chứng `62c9dae`, việc biên dịch các vùng địa hình chiếm khoảng 15,5 giây trong bước mô phỏng một giờ (đo dưới tải dùng chung). Nhiều làng thiếu nước phải thăm lại các vùng đã rời bộ nhớ đệm 32 vùng nặng. Không cần dựng lại lớp kinh tế và POI chỉ để hỏi một ô đã từng là nước ngọt hay không.

Bản sửa giữ bản sao nén **đúng mặt nạ tĩnh sau lớp phủ POI**. Tối đa 512 mặt nạ × 5.000 byte = 2,56 MB dữ liệu bit; không lưu đường đi, độ đầy thùng, băng tạm thời hay nước của một lượt chơi. Kiểm tra băng còn hạn, tầng và tiếp xúc vẫn dùng trạng thái thật.

Lấy 68 địa điểm có cư dân trong save h24, đọc tất cả ô trong bán kính 24 bước Manhattan quanh từng kho, hai lượt cùng thứ tự. **81.668 câu hỏi mỗi lượt; 1.884 câu trả lời có nước.** Cả bốn chuỗi kết quả trước/sau có cùng SHA256 `11b4366823c66769566a3223deee11e83c39a459dc8e105b0a4a2e55be463082`. Lượt thứ hai: **172 → 0 lần** biên dịch lại địa hình. Đây là phép đo riêng cho truy vấn tĩnh; không phải FPS, chứng minh đường đi đến nước hay tỷ lệ sống của làng. Xem `before.json` và `after.json` để đối chiếu hash mã nguồn, save, số lần biên dịch và thời gian dưới tải dùng chung.

Từ `web/`, dùng cùng `h24.save.gz` cho cả hai checkout:

```sh
node scripts/npc-fresh-mask-survey.mjs /path/to/measured/web evidence/npc-integration/coast-62c9dae/h24.save.gz /tmp/water-mask.json
```
