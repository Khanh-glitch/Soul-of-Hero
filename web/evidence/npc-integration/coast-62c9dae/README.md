# Kiểm kê h1 và h8 — chưa đạt điều kiện phát hành

Mã game và test: `62c9dae4d9a5f01f2ae440aef60c882849c50b69`. Mô phỏng seed 7606 gọi `startRun` tại h0 và `settle` theo giờ; không nhập bản lưu h24, không QA hay bơm vật phẩm. Không phải bằng chứng chơi bằng bàn phím. `progress.json` chỉ chứa tiền tố đến h8 của lượt đang đo. SHA256 của bản lưu h1 sau giải nén: `9f6f859922e92df4e0fa96a6307e7ec0a8762c9f5215484b7d5731f331a5387d`.

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

Lệnh cuối **phải** trả mã khác 0 với gói h1/h8 này. Dùng thư mục đầu ra đầy đủ của `npc-endurance.mjs` để xét h264/h312, h335 và lịch sử K8 h336. Kể cả khi qua cổng kỹ thuật, vẫn cần hồi quy, hai nhánh chơi thực, số liệu hiệu năng cùng điều kiện và Creator review.
