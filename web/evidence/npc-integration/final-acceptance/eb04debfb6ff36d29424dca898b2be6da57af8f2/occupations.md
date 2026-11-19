# Tám nghề — cách đọc bằng chứng

`engineering/integration.txt`: ba mô phỏng seed 7606, cùng luật khởi tạo; Greywater/Saltwick/Cinder 6h, nối riêng Cinder đến 12h để nhìn thấy cấp cứu. Không đặt việc vào tay NPC. Số dưới là số receipt **ở Greywater trong 6h**, trừ nơi ghi rõ. Không suy diễn một lần thu nguyên liệu thành mọi loại công việc của nghề.

|Nghề|Tự chọn quan sát được|Phép kiểm chặn/gián đoạn riêng|Chưa chứng minh|
|---|---|---|---|
|Builder|14 harvest, 10 complete|đi sửa kho nguyên ID, trừ 2 gỗ; thiếu gỗ không sửa|tự tái thiết sau Elder ngay trước mắt người chơi|
|Cook|1 work.start, 1 pickup; bộ test thấy món có workerId trong pack|mất bếp giải phóng intent; hai người một bill; lửa hết khi reload|xem trọn chuỗi bằng browser|
|Engineer|17 harvest/17 output|global source không mint khi depleted; ledger chỉ ghi khi đến nơi|offline + lineage từng sản phẩm nghề|
|Gardener|16 harvest/16 output|có giới hạn stock/capacity chung|gieo/trồng/thu hoạch riêng qua cả reload và offline|
|Guard|60 duty|đạn trừ khi bắn, chỉ gây hại lúc trúng; thịt chỉ từ con đã chết|cuộc săn tự nhiên trong browser|
|Mechanic|53 harvest/64 output|custody có giới hạn, không chứng minh đây là sửa đồ|UID trước/sau một lần sửa tự nhiên, reload riêng|
|Medic|Cinder: 1 `human.treat`, không tính hái nguyên liệu|người cùng cộng đồng, tốn một liều; khác tầng/không có thuốc không chữa|treatment ngay trong chuyến offline thật|
|Salvager|41 harvest/48 output|có delivery riêng biệt với output; không nhặt G1B/caches|video salvage tới chỗ trả hàng|

Mẫu cargo có tên: `hm/hj2tt`, UID `s2uv` lúc dỡ (xem routes.md). Snapshot browser khác seed: `hb` mang `s180` từ pack `c17y` lên weapon; `hj2tb:hb:0:2125834:road_relay_wreck` là **lựa chọn**, không phải giao thành công. Các UID/clip không được log riêng cho từng nghề ghi là thiếu, không điền bằng số từ run khác.
