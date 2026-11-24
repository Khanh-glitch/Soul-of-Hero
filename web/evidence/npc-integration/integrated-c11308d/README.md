# Đợt tích hợp The Last Humanity — c11308d

**Bản nguồn đang nghiệm thu:** `c11308d23f7bcb2bedb5239d44b104250b1ad521`. Trạng thái phát hành: **PARTIAL**, không merge. Các bước dưới đây không đòi hỏi bật QA trong game.

## Chơi và kiểm lại

1. Chọn **New run → VEYRA → Begin the 14 days**. Dùng WASD, xem bản đồ bằng M. Người đang đi, làm việc, chiến đấu, ngã hoặc lên tàu vẫn là cùng một người. Một bãi đáp ngẫu nhiên không đảm bảo có làng trong cửa sổ đầu.
2. Đến gần một người và nhấn F. **Talk → Work? / Need? / Place?** hỏi tình hình người đó biết. **Help** dùng đồ thật trong pack, cần ở cạnh đến hết thời gian. **Recruit** có thể bị từ chối. Một lần thật sự bảo vệ nạn nhân khỏi con thú vừa gây thương tích, khi họ nhìn thấy người chơi hạ nó bằng cận chiến/cung, có thể cộng 3 Trust; giết ở xa, hạ bằng tháp hoặc lặp lại không cộng.
3. **Barter**: chọn số lượng ở hai phía, yêu cầu counter nếu cần, xem lại rồi mới chấp nhận. Không có quyền lấy đồ từ kho làng qua bảng barter. Khi đồng hành, **Companion** có Follow, Hold, Guard me, Engage, Retreat, Return home và Carry; không phải lệnh nào cũng được chấp thuận.
4. NPC có Core **không** đồng nghĩa tự động có đạn hay sẽ dùng Signature. Cần Core trong pack, đủ cấp, năng lượng, nguyên tố phù hợp, độ bền, hết hồi chiêu, có mục tiêu hợp lệ và vị trí an toàn. Quan sát hướng quay, dấu sáng trước khi tung chiêu, đường bay và vùng tác động. Rào cây cần chỗ cho đủ mười cây; dịch chuyển rút lui cần một ô an toàn nhìn thấy và kiểm lại khi đáp. Không cấp Core để trình diễn trong game tự nhiên.
5. Save & quit, đóng trình duyệt, rồi Continue bằng cùng profile. Kiểm người, hành lý, việc đang làm, các biên nhận và kết quả khi vắng mặt. Không dùng đồng hồ QA để thay cho thời gian thực trong bằng chứng này.

## Bằng chứng và giới hạn

- `engineering/integration.json`: 25 suite trong quá trình tích hợp, 152/152 ca; bao gồm nghề nghiệp, K5, xã hội, tập kích Elder, cứu hộ, tiếp tục save và các ca từ chối. Đây không phải 229 file trên SHA cuối. Hai cấu hình TS và bản build sản xuất qua sau thay đổi nguồn cuối (`build.txt`).
- `browser/native.json`, `landing.png`: lượt Chromium 140 ở 640×360, New run, I/C/B/M. `browser/cargo.json`, hai file save và Return Chronicle: hai tiến trình thật, 90.058 s đóng trình duyệt; cùng run `run_t60huq_mwogtb6j`, 286 người. Theo dấu 5 job lúc rời game, 4 có dòng giao hàng mới, xác nhận output và delivery. Không suy từ đó cả 8 nghề thành công. `browser/observations.json` và `review.png`: **fixture** UI có counter, sửa giỏ, xác nhận, một biên nhận ba dòng. Các lượt này chạy ở build trong quá trình tích hợp, trước thay đổi cuối về điểm tin cậy/hiệu ứng.
- `engineering/manifest.json`: 229 file của SHA đo. Nhật ký đầy đủ cập nhật ở `tmp/verification/c11308d/{endurance,serial}`. Worker dùng bản sao cố định, không đổi branch hay dùng lại checkpoint khác SHA. Trình tự: pilot phút 1 → 60; regression từng file có watchdog; rồi tiếp tục chiến dịch đó đến 20.160 phút. Việc xếp lịch không chứng minh đạt.
- Đối chứng cũ `eb04deb` đã có hạch toán đủ 225 file: 166 PASS, 48 FAIL, 10 toàn SKIP, 1 chỉ chạy một phần sau watchdog. Không cộng các ca đó vào SHA mới. Chưa có cơ sở nói FPS đạt ≤10%, chưa đủ A–I tự nhiên, chưa có Creator duyệt hình ảnh.

### Lệnh tái lập (cwd `web/`, đúng SHA ở trên)

```sh
npm run typecheck && npm run typecheck:tests && npm run build
node scripts/regression-shards.mjs /path/to/regression --manifest-only
node scripts/regression-serial.mjs /path/to/regression/manifest.json /path/to/serial
node scripts/npc-endurance.mjs /path/to/endurance 20160
```

Chạy các phép nặng nối tiếp trên máy nhỏ; checkpoint chứa SHA và digest. Với build production đang phục vụ qua HTTP, `CHROME_BIN=... node scripts/npc-community-walk.mjs URL /path/to/out` dùng **bản sao chỉ đọc** của save để tìm đường; mọi thao tác di chuyển/hội thoại trong game vẫn đi qua bàn phím/nút thật. Đây là đo có trợ giúp tìm đường, không phải người chơi tự tìm được làng.

### Mốc đo trên đúng nguồn c11308d

`engineering/endurance.json` và `engineering/checkpoint.json.gz`: phút 60 / 20.160, đã nạp lại checkpoint phút 1 trong tiến trình khác. Giữ nguyên 286 ID; 255 IDLE, 23 DOWNED, 3 MOVING, 5 WORKING. Phút 1→60 mất 365,878 ms wall dưới tải, 57.740 lát thế giới, 1.153.629 bước mở rộng đường; 1.020 lần xuất nguyên liệu, 932 lần hoàn tất giao, 9 điều trị và 1 chuỗi trả phí–nhiên liệu–xong–lấy sản phẩm. Đây là **số biên nhận trong đoạn đo**, không phải tổng sản lượng ròng hay chứng minh bền vững 14 ngày. Có thể tiếp tục trên đúng SHA bằng cách chép checkpoint vào thư mục kết quả **trống** rồi dùng lệnh endurance ở trên.

`browser/walk-first.json` và `walk-approach.json`: hai lần New run bình thường với trợ giúp tìm đường chỉ đọc. Lần đầu không có người trong vùng đi bộ được của cửa sổ đầu. Lần hai đi 45 đoạn điều khiển theo một guard đang đổi vị trí; đến lúc đo gần nhất vẫn còn 7 bước đường. **Không** dùng hai lượt này làm bằng chứng đã nói chuyện/tuyển người. Mở panel qua fixture không thay thế C/D tự nhiên.

**Đối chứng sau sửa đổi cuối:** 66/66 trong 6 suite trên checkout cố định c11308d (`engineering/final-six-suites.json`). Probe nghề dùng seed 7606 ở Greywater, Saltwick và Cinder, không ép intent hay cấp vật tư; có hoạt động được ghi nhận của cả 8 vai trò, có bữa ăn trả phí vào custody và điều trị thật ở Cinder (`occupation-coverage.txt`). Không diễn giải khai thác chung là bằng chứng riêng cho mọi ca sửa máy/xây nhà; probe này cũng không thay thế quan sát 8 nghề bằng trình duyệt.

| Cổng | Kết quả có thể dùng | Chưa chứng minh |
|---|---|---|
| A/B – cộng đồng và nghề | Ledger tự chủ, giao hàng có UID khi vắng mặt; probe 3 nơi có đủ 8 vai | Từng nghề hoàn thành đúng chuyên môn dưới quan sát trực tiếp trong game |
| C/D – quan hệ, giao dịch, tội phạm | Trust có điều kiện, barter có counter và xác nhận; kiểm thử từ chối/rollback | Tuyển, đi cùng, đối chất và trả thù trọn chuỗi bằng điều khiển thường |
| E – giao chiến | Basic/Q/E của 7 Core, nguồn sát thương, vật phóng, hủy khi không hợp lệ, lưu/tải | NPC tự kiếm đủ Core + tài nguyên và dùng từng chiêu trong chiến dịch không dựng sẵn |
| F/I – offline và tự do | Save/Continue hai tiến trình, không tạo lại actor; I/C/B/M tại 640×360 | Toàn bộ hành trình qua cửa, tầng và cửa sổ thế giới; cảm nhận/hình ảnh do Creator đánh giá |
| G/H – Elder và cứu hộ | Suite tập kích, thân tàu/vật tư, hai nhánh cứu hộ trong cùng run đều qua trong ma trận tích hợp | h312–336 trong run bền, ba bến vận hành tự nhiên và kết thúc/K8 qua giao diện |
| Release | Typecheck, build, 66/66 trên nguồn cố định; runner 229 file có watchdog và checkpoint | Toàn bộ regression sạch, 336h hoàn chỉnh, benchmark mật độ tương xứng |

Lượt đi bộ thứ ba (`walk-frontier-partial.json`) thử tiến về cộng đồng ở ngoài cửa sổ ban đầu. Đã đổi tọa độ bằng phím thường, sau đó lặp lại ở tile (1932,698); dừng phép đo đang kẹt, không ghi nhận tương tác. Driver đã có điều kiện kết thúc khi không tiến thêm qua 5 lần quan sát. Đây là giới hạn của thử nghiệm tìm đường qua ảnh save, không kết luận con đường trong game là bất khả thi.
