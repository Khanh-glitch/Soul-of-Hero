# Nghiệm thu hiện tại — SOLO/shared runtime

## Kết luận
**Hồi quy tự động đã đạt. Chưa đủ điều kiện tuyên bố hoàn thành/phát hành.**

Mã nguồn kiểm tra toàn bộ: `294fb68a9c2563ba102d3e06935503bb8b676ae4` trên nhánh `arena/e506bfd6-soul-of-hero`.

| Cổng | Kết quả thực tế |
|---|---|
| Toàn bộ Vitest, chạy từ `web/` | **200/200 tệp PASS; 1.344 PASS, 0 FAIL, 19 skip** |
| TypeScript ứng dụng và test | PASS |
| Production build | PASS; single-file ~84,8 MB |
| Production 640×360, hồ sơ mới → Inventory → lưu → tiến trình Chromium mới → tiếp tục | PASS kỹ thuật; không cấp vật phẩm/đổi vị trí; `qaUsed=false` |
| Plank: chọn nâng cấp → trả đúng 3 Plank → giữ tường và tỉ lệ HP → lưu/mở lại | PASS cơ chế và UI fixture; không phải bằng chứng tự thu thập nguyên liệu |
| Hook Garden Cottage | Hai gốc cửa sổ biên dịch PASS; đối chứng vách cũ hai ca FAIL đúng lối vào; giữ nguyên 738 nguồn |
| Native/Godot cùng luật Veyra | Chưa xác minh; dự án native gốc là đường chơi Chapter1 cũ, không thể lấy ảnh Web thay thế |
| FPS GPU thật / cảm giác chơi | Chưa nghiệm thu; số đo SwiftShader chỉ phục vụ chẩn đoán |
| Chơi dài hạn 336 giờ, nhiều phiên, người thật | Chưa nghiệm thu; mô phỏng đồng hồ không thay thế được |
| Shared fix cabinet trên NPC `79ac5f0` | AppTS và 5 tệp/34 ca PASS trong bản archive riêng; không phải full merge certificate |

Cổng opt-in ecology chạy riêng sau full suite cũng đạt, sau khi phân biệt đường đi bộ có thể lội nước với quy tắc đặt nguồn trên đất khô. Không cộng kết quả chạy riêng vào tổng 1.344; 19 skip của lượt full vẫn giữ nguyên.

## Các sửa đổi giữ lại
- Sửa cabinet trả vật liệu/hồi HP nhầm tầng: hành động repair và liên kết lãnh thổ dùng cùng phân quyền từng công trình như upkeep/decay.
- Giữ nâng cấp phần cứng đã trả phí trên đúng chassis UID khi thu hồi/triển khai máy phát và khung vườn; từ chối metadata sai, không mang nhiên liệu/cây/job/điện sang vị trí mới.
- Cho phép **tùy chọn** tường gỗ → tường Plank bằng hóa đơn sẵn có 3 Plank. Đường mặc định gỗ → đá vẫn nguyên; Plank → đá trả đủ hóa đơn đá. Không dựng thẳng tường cấp cao, không ép người chơi theo một lộ trình.
- Đồng bộ UI, đồ thị kinh tế, ontology và kiểm tra upkeep/repair với đường nâng cấp thật.
- Không nhận tối ưu PNG thử nghiệm vào production: giảm giật lần mở đầu nhưng chưa chứng minh không làm xấu các khung hình kéo dài.

## Bản chơi và cách kiểm tra tự do
Artifact chính: `web/dist/index.html` (được tạo bởi `npm --prefix web run build`, không đưa file build lớn vào Git).

SHA-256 của HTML đã chạy kiểm tra production:
`83b5b486f9cd3ab0bee5773d7f33e2b7834f08eed49ed3c31dbf058c22e2cd0d`.

Khởi chạy từ thư mục `web/`: `npm run preview -- --host 0.0.0.0 --port 4173`.
Không dùng fixture để đánh giá trải nghiệm. Tạo hồ sơ mới, tự chọn mục tiêu và cách chơi; không có tuyến nhiệm vụ bắt buộc do bài kiểm tra này quy định. Xem hướng dẫn điều khiển trong game. Khi dừng, dùng **Save & quit to title**.

Các câu hỏi nghiệm thu mở: Bạn tự muốn làm gì? Những lựa chọn nào không nhìn thấy? Hành động nào có phản hồi/cost khó hiểu? Có muốn quay lại chơi không, vì sao? Ảnh vật phẩm/Gold có dễ đọc? Hiệu năng ở máy thật có ổn khi mở UI và di chuyển? Không suy ra câu trả lời từ bot.

## Bằng chứng và phần tiếp tục
- `full-regression-294fb68-webcwd.json.gz`: kết quả toàn bộ, giữ nguyên 19 skip, không cộng focused test vào tổng.
- `production-294fb68/`: manifest và ảnh production, lưu/tiếp tục bằng hai tiến trình trình duyệt.
- `territory-floor-red.json.gz`, `territory-floor-expanded.json.gz`: lỗi cabinet ba ca đỏ, nhóm tích hợp 55 ca xanh.
- `g1b-ecology-player-access.json.gz`: cổng geometry/reachability opt-in, không phải chứng nhận thu thập toàn bộ nguồn qua chơi tự nhiên.
- `g1b-bridgehead-wading.json.gz`, `gulfhead-wading.json.gz`: nguồn/cửa thật qua đường lội, không đổi địa hình.
- `npc-79ac5f0-territory-final.json.gz`: replay shared fix hẹp trên mã NPC hiện được quan sát.
- `plank-ui/`: fixture UI nâng cấp đã ghi rõ giới hạn.
- `g1b-hook-expanded.json.gz`, `g1b-hook-historical-reverse.json.gz`: mở rộng đường vào và đối chứng vách cũ.
- `CONTROL_TOWER/06_PROGRESS_LEDGER.md`: diễn tiến đầy đủ, ca thất bại, thí nghiệm bị loại và bước điều tra tiếp theo.
- `CONTROL_TOWER/PORTING_MANIFEST.md`: giới hạn chuyển sửa đổi sang NPC; không phải quyền merge.

Đây là bàn giao trạng thái có thể tái lập, **không phải chứng nhận RC, native, trải nghiệm con người hay phát hành toàn bộ game**.
