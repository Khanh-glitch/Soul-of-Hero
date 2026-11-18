# Tối ưu khựng khi nhặt loot — 17/11/2026

## Kết luận thực hiện

**Đã sửa một nguyên nhân có thể tái hiện: nhặt đồ rơi làm vô hiệu cache va chạm toàn bản đồ sau từng món.** Không đổi ảnh để che vấn đề, không giảm chất lượng hình. Chưa chứng nhận hết mọi dạng lag khi farm trên thiết bị thật.

- Production chỉ đổi logic vô hiệu cache trong `game/engine.ts:removeEntity`: đồ `kind === 'drop'` không đóng góp vào `blockGrid`, `entsAt` hay `roofRoom`, nên việc xóa nó không cần xóa ba cache này.
- Giữ nguyên xóa entity/container, chuyển UID, dung lượng túi, nhặt từng phần, chống phát lại intent, sàn hoạt động, đồ đặt thủ công, dọn liên kết bảo trì/điện và mọi luật loot.
- Các loại entity khác vẫn vô hiệu cache như trước. Kiểm thử thu hồi tường trả phí xác nhận va chạm, chỉ mục entity và quan sát mái được làm mới.
- **Atlas PNG, cả 157 icon, metadata, loader, renderer, scale 12px của loot và nearest-neighbor đều giữ nguyên byte so với base53c1688.** Không thêm định dạng ảnh, package hay chi phí giải mã mới.

## Vì sao không chuyển đổi bộ ảnh?

Ảnh đã là một atlas 512×320, không phải mỗi vật phẩm rơi lại tải một PNG. Loader cắt 157 ô một lần; UI mã hóa URL lười theo loại icon. Trong các pha đo đống loot, số `toDataURL` mới là **0**.

Đã thử đường vẽ trực tiếp từ atlas gốc thay cho canvas từng ô, cùng cảnh/seed, thứ tự **cells / sheet / sheet / cells**. Mỗi pha 12 giây: vẽ riêng 40/160 món và toàn cảnh 0/40/160 món. Chi phí CPU trung vị khi chỉ vẽ 160 món đều khoảng **0,5 ms**; p95 khoảng **0,9 ms**, không có lợi ích ổn định từ đổi nguồn ảnh. Đuôi frame toàn cảnh trên SwiftShader rất lớn và dao động ở cả hai bản. **Thử nghiệm bị loại khỏi production.** Không dùng số này để công bố FPS máy thật.

Lần vẽ đầu còn bao gồm `getArt()` dựng art thủ tục chung (~1,9–2,2 giây trong phép đo cô lập); nó xuất hiện ở cả hai biến thể, không chứng minh icon pack mới gây ra. Không hứa sửa cold-start bằng bản vá này.

Dữ liệu: `loot-render-profile.json`; tái hiện bằng `web/e2e/loot-render-profile.mjs`. Harness tái dựng thử nghiệm qua route chỉ trong trình duyệt test; không bật cờ hoặc sửa renderer giao hàng. Kiểm tra harness sau khi hoàn nguyên renderer: cả hai biến thể chạy được; lượt 150ms chỉ kiểm tra công cụ, không được tính vào kết quả hiệu năng 12 giây.

## Đối chứng đường nhặt vật phẩm thật

**Đính chính sau audit:** lượt đo cũ chưa assert map thật; Vite HMR làm world import có/không query thành hai instance, nên nhãn Veyra trong raw cũ không đáng tin. Đã rút nhãn này, thêm guard và chạy lại server sạch. Bảng dưới là **lượt Veyra đã xác nhận layout thực tế**, không phải số78–86ms cũ. Xem [audit kỹ thuật](technical-audit/TECHNICAL_RED_FLAGS.md).

`loot-pickup-profile.mjs` chạy serial **old / current / current / old**, Chromium, cùng `veyra05-at-1920-512`, seed901. Mỗi mức 1/8/32 món thực hiện **12 lượt tick thật**, đồ ở vị trí người chơi, đã đủ tuổi hút; vật liệu là fixture, không tuyên bố farm/tìm loot tự nhiên. Bản old chỉ tái dựng `removeEntity → markDirty()` vô điều kiện. Đo tick + truy vấn va chạm kế tiếp, không gồm UI/render/GPU.

| Món nhặt mỗi lượt | Trung vị tick cũ, hai lần (ms) | Trung vị tick mới, hai lần (ms) | p95 cũ → mới (ms) |
|---|---:|---:|---:|
| 1 | 0,4 / 0,4 | 0,4 / 0,3 | 4,2 / 3,9 → 3,9 / 3,7 |
| 8 | 223 / 222,9 | 0,3 / 0,3 | 270,2 / 247,8 → 0,6 / 0,5 |
| 32 | 921 / 1.068,1 | 1,1 / 1,0 | 997,8 / 1.249,2 → 1,4 / 1,8 |

- Trong 12 lượt ×32 món, bản cũ xây lại grid **384 lần**, bản mới **0 lần**. Phần lớn rebuild xảy ra bên trong tick, bản cũ còn có một rebuild sau mỗi tick: kiểm tra tầm nhặt/line-of-sight của món tiếp theo gọi lại `blockGrid`.
- Mỗi grid source-v3 duyệt **40.000 ô**. Chi phí này trước đây tăng theo số món nhặt, dù những món đó không hề là vật cản.
- Với từng mức, **SHA256 của toàn bộ trạng thái game cuối giống hệt ở cả bốn lượt đối chứng**. Số lượng, xóa drop/container và custody sau serialize/reload đều được assert thật; `errors=[]`.
- Mức1món cần đọc cả truy vấn grid kế tiếp: bản cũ trung vị27/29ms, bản mới0ms ở độ phân giải đồng hồ. Với32món là29,4/33,9ms→0ms. Không biến số tick stress thành lời hứa mọi frame đều nhanh hơn, tăngFPS theo cùng tỉ lệ hay chứng nhận endurance.

Dữ liệu hiện hành: `technical-audit/loot-pickup-verified-layout.json`; `loot-pickup-profile.json` giữ raw cũ và auditCorrection, không còn là bằng chứng Veyra. Các báo cáo ghi baseHEAD53c1688; đó là **working tree có bản vá**, không phải tuyên bố baseHEAD đã chứa bản sửa. Hash chính xác engine đã đo/test: `b1cc97c8b56a6b4b31306887b08555b7ebadccee2773ca84a77f95461011edb4`.

## Kiểm thử sau sửa

- Regression mới: baseline **2 lỗi cache / 1 đạt guard tường** → bản sửa đạt; thêm test tick thật16 món, giữ nguyên đồ manual và đồ tầng khác. Bộ mới **4/4 đạt**.
- Nhóm atlas/runtime, UID custody, public loot lifecycle, cabinet/floor, shelter, wild regrowth và paid hardware: **10 file, 60 đạt, 0 lỗi**. App TypeScript, test TypeScript và production build đều đạt.
- **Toàn bộ bộ kiểm thử mặc định: 202 file, 1.350 đạt, 0 lỗi, 19 bỏ qua**, khoảng18 phút. So với mốc200 file/1344 trước đây: thêm2 bridgehead test đã nằm trong53c1688 và4 test cache mới. Không tính lại opt-in ecology cũ thành lượt chạy mới; các test opt-in mặc định bỏ qua vẫn giữ nguyên.
- Build production SHA256 HTML `8c28204f56bb505f7b8d8f76fd3f6d601a3efcd674f1cdc5b1edc08e305de5d2`. Vào game bình thường → túi → lưu/thoát → tiến trình Chromium mới → Continue **PASS_TECHNICAL_SMOKE_ONLY**, không QA/grant/đặt vị trí, `errors=[]`. Seed2008790575, layout`veyra05-at-2048-1024`, tọa độ1720/2024 được giữ qua save/continue.
- Raw: `loot-cache-red.json.gz`, `loot-cache-focused.json.gz`, `full-regression-loot-cache.json.gz`, `production-loot-cache/manifest.json` và ảnh chụp.

## Giới hạn còn lại

Đã xác nhận giảm chi phí nhặt loot lặp lại mà không cần động vào ảnh. Chưa có phép đo farm tự nhiên kéo dài trên GPU/điện thoại người dùng, chưa tách đầy đủ chi phí thu hoạch/VFX/autosave/UI của một phiên thực. Nếu vẫn khựng trước lúc đồ được hút vào túi, cần lấy tiếp cảnh/thiết bị đó; bản vá này không tự chứng nhận các khâu ấy, native, vòng đời336h hay full release.
