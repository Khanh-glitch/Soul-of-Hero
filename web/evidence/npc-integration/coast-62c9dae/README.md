# Kiểm kê h1, h8 và h24 — chưa đạt điều kiện phát hành

Mã game và test: `62c9dae4d9a5f01f2ae440aef60c882849c50b69`. Mô phỏng seed 7606 gọi `startRun` tại h0 và `settle` theo giờ; không nhập bản lưu h24, không QA hay bơm vật phẩm. Không phải bằng chứng chơi bằng bàn phím. `progress.json` chỉ chứa tiền tố đến h24 của lượt đang đo. SHA256 của bản lưu h1 sau giải nén: `9f6f859922e92df4e0fa96a6307e7ec0a8762c9f5215484b7d5731f331a5387d`.

- 81 địa điểm, 68 nơi có cư dân; 286 người, 264 còn hoạt động và 22 gục ở h1. Có 20 giường thuộc sở hữu cộng đồng, **không** phải 286 chỗ ngủ.
- 58 địa điểm có biên nhận hàng giao gắn nguồn. Ví dụ, kho Tidecamp đã nhận 21 quả mọng và 15 sợi; đây là tổng **đã giao** trong sổ hiện có, không phải lượng còn lại. `finiteStock` ghi UID và số dư riêng. `waterSources` trong mô hình có thể trỏ tới kho: không dùng ID kho làm bằng chứng có nước ngọt. Một lần tìm được đường cũng không chứng minh mọi cư dân đều đến được nguồn.
- Ở h8 còn 260 người hoạt động; 26 người hoạt động có chỉ số khát dưới 40, không ai trong số 260 có chỉ số đói dưới 40. 60/81 điểm có hàng giao kèm nguồn. Thêm 2 điểm có giao hàng không đồng nghĩa tất cả cư dân có nước.
- Điểm số nhu cầu là ảnh chụp ở một thời điểm. Tổng sóng Elder là số lần **người** được ghi nhận trong sóng, không phải số đợt tấn công duy nhất. Không suy ra khả năng tự nuôi sống đến ngày 14 từ CSV.
- Lượt trình duyệt riêng seed 7542 đã gặp một người thu hồi phế liệu ở Mere. Chưa đọc được câu trả lời trước khi phép đo hết hạn; xem `mere-contact-attempt.json`. Không tính đây là đã nói chuyện, tuyển người hay giao dịch. Lượt dùng đồng hồ chọn seed khi bắt đầu, sau đó thời gian trôi bình thường.

Từ `web/`, tái tạo và kiểm tra:

```sh
d=evidence/npc-integration/coast-62c9dae
node --experimental-strip-types scripts/npc-hour-census.mjs "$d" 1 /tmp/coast-h1.csv
cmp "$d/h1.csv" /tmp/coast-h1.csv
node --experimental-strip-types scripts/npc-hour-census.mjs "$d" 8 /tmp/coast-h8.csv
cmp "$d/h8.csv" /tmp/coast-h8.csv
node scripts/npc-campaign-gate.mjs "$d" /tmp/campaign-check.json
```

Lệnh cuối **phải** trả mã khác 0 với gói ngày đầu này. Dùng thư mục đầu ra đầy đủ của `npc-endurance.mjs` để xét h264/h312, h335 và lịch sử K8 h336. Kể cả khi qua cổng kỹ thuật, vẫn cần hồi quy, hai nhánh chơi thực, số liệu hiệu năng cùng điều kiện và Creator review.

**Chạy lại trên checkout bất biến:** `checkpoint-replay.txt` ghi **1 đạt, 4 hết thời gian** trong 5 ca với cả hai checkpoint. Worker ưu tiên thấp (`nice -n 12`, pool threads) chạy cùng chiến dịch và hồi quy toàn bộ; không dùng thời gian này để đo FPS hay tuyên bố hồi quy hiệu năng. Trước khi timeout, biên nhận Tidecamp khớp từng byte với `../tidecamp-water/paid-catchment.json`; ở Westbank `h1m` ăn quả hái được, chỉ số lương thực từ 4,0 lên 43,4. Biên nhận không thay thế kết quả test: cần chạy riêng, giữ nguyên ngưỡng thời gian.

Lượt đi lại `mere-walk-retry.json` ghi bốn bước định hướng, không có câu trả lời hay biên nhận trao đổi; driver hết thời gian chờ “Save now”. Đã sửa driver để phân biệt đóng bảng tương tác với mở menu tạm dừng, không ghi trực tiếp vào save. Chưa có lượt thành công sau thay đổi này.

**h24, mã đối chứng `62c9dae`:** 167 người hoạt động, 7 gục, 112 chết. 62/81 địa điểm có giao hàng kèm nguồn. Trong 112 người đã chết, 25 đã gục ở h8; 47 kết thúc với chỉ số khát bằng 0, 65 với chỉ số đói bằng 0 (chỉ số cuối, không tự suy ra nguyên nhân). Ba bến còn 1/3, 0/3, 1/3 cư dân hoạt động theo thứ tự West/South/Hook. Trong toàn ngày đầu có 2 biên nhận xây thùng hứng mưa, 18 biên nhận uống nước từ thùng. Đây **không phải** người đã sơ tán hay số người sẽ sống đến h336. Tái tạo bảng h24 bằng cùng lệnh `npc-hour-census.mjs`, thay `8` bằng `24`.
