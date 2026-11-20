# Đồng hành, lao động và bến sơ tán — `28408d8f8d68f11b4c298d8fb71fcafab53e31a2`

**PARTIAL.** Bản web production, branch `arena/25e24231-soul-of-hero`. Không dùng các ca có sắp đặt dưới đây để chấm thay Creator.

## Hành vi có thể thử

- **Companion → Return home:** nếu đã tới giường được cấp hoặc kho thuộc cộng đồng nhà, nhân vật kết thúc chuyến đi tại chỗ. Khi đang đi, hết đường hoặc mất địa điểm thì vẫn là đồng đội; chỉ khi đến đúng nơi còn hợp lệ mới ghi `human.companion.home`, ngừng đi cùng và được trở lại làm việc. Follow xét lại đích khi người chơi đổi hướng/tầng; nếu người chơi chết/ra khơi thì chờ thay vì bước tiếp từ tile này sang tile khác theo lộ trình cũ.
- **Companion → Quantity → Carry / Take back:** để trống chuyển cả chồng; nhập số nguyên để tách một phần hàng thông thường. Có kiểm tra quyền, đơn giao đang giữ hàng, tải trọng, chỗ chứa và UID. Biên nhận có UID gốc, lượng tách và các UID thực nhận. Không mất hàng hay cấp thêm UID nếu từ chối.
- **Confront:** chọn chính xác món cá nhân trong ba lô hoặc đang mặc/cầm. Không chỉ định kho cộng đồng. Nếu người bị đòi giao đồ, UID ấy phải còn tồn tại và vừa túi người chơi; không hòa lẫn đồ bị cướp vào một UID vô can. Nhân chứng cần nhìn được cả hai cơ thể; chỉ người có thể chiến đấu và có quan hệ phù hợp mới ứng cứu.
- **Làm việc:** thợ sửa ghi UID dụng cụ trước/sau và UID vật tư thực trả. Thợ xây/gieo trồng không tiêu nhầm vật tư đã giữ cho chuyến giao; sản lượng vườn có quyền nhận riêng trước khi vào kho. Medic có thể băng vết thương của người còn tỉnh mà không xóa công việc của họ. Lệnh nạp nhiên liệu đã lỗi thời không lấy vật tư cho máy đang chạy.
- **Evacuation Service:** tại đúng bến đang nhận khách, người chơi có thể đưa quả mọng, bình nước có nước hoặc phụ tùng thật từ ba lô vào khoang tàu. Rời cầu cảng trước khi tàu chạy sẽ nhường ghế. Nhật ký rời bến lấy hàng thực mang lúc khởi hành, không phải hàng đã từng mang lúc đặt ghế. Lên tàu không phải đã được cứu.

## Đã đo

| Phép đo | Kết quả | Giới hạn |
|---|---|---|
| `integration.json` | 82/82 trong 12 file; TypeScript `tsconfig.test.json` (gồm cả `src` và `tests`) qua; Vite production build qua | Gồm lệnh về nhà bị mất kho giữa đường rồi nạp lại, đứng sẵn ở đích, tách/hoàn hàng, UID đồ đang mặc, bệnh nhân tỉnh, quyền vật tư, tàu và hai nhánh cứu hộ. Không phải toàn bộ regression. |
| `production-browser.json` | Chromium 140, New run seed **1773725284**, 7 giao diện 640×360 (gồm I/C/B/M), không lỗi trang | Đo UI shipped, không chấm cảm giác chơi. |
| `census.csv`, `production-census.json` | Đối chiếu cả **81 ID** nguồn với bản sao save New run. **68** điểm có người; **286** actorId và sourceId riêng; **20** có giường được giao, còn khỏe, đúng chủ, duy nhất. **266** chưa được giao giường như vậy. JSON ghi vị trí/tầng, vai trò, pack/trang bị, giường, trạm, kho và UID trong kho. | Đây là ảnh trạng thái. Một ID nguồn nước không chứng minh có đường đến nước; 266 không có giường được giao không đồng nghĩa 266 người sẽ chết. Không đo đủ chu kỳ tám nghề hay ngân sách 336h. |
| `controlled-panel.json`, `companion.png` | Fixture 640×360 riêng: barter counter/xác nhận, mất tiếp xúc, chọn **2/4 Berries**, chuyển vào cart, từ chối lượng vượt số đang có, nhận lại | Không chứng minh người chơi tự nhiên đã gặp hoặc tuyển người. |
| `walk-partial.json` | Chỉ dùng New run, Save now và bàn phím/UI. Chọn lượt có người gần qua bản sao save: hai lần đầu cách 94,7 và 146,8 tile; lần thứ ba cách **14,3 tile theo đường thẳng**. Bốn lần đo đường đi, còn 27 bước trong lần cuối. | Có trợ giúp tìm đường/chọn điểm xuất phát. Dừng trình duyệt khi bộ nhớ khả dụng gần cạn dưới tải regression khác. **Không ghi được câu hội thoại hay ca trợ giúp tự nhiên**. |

## Chưa nghiệm thu

Đường đi và nguồn nước/thực phẩm cho từng nơi, ma trận hoạt động chuyên môn của từng nghề, toàn chuỗi gặp–giúp–tuyển–hộ tống, Elder và ba tàu trong chiến dịch dài, kết quả h336/K8, benchmark mật độ cùng điều kiện và Creator playtest. Full regression đang chạy ở checkout cố định **c11308d**, không phải 28408d8: tại thời điểm ghi có 12/229 file trả kết quả (8 PASSED, 4 REVIEW). Checkpoint một giờ cũng của c11308d. Không gộp các số đó với ma trận 82 ca.
