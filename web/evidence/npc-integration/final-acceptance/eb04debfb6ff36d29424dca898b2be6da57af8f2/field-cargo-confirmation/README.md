# F — công việc thật khi đóng Chromium: đã chứng minh một phần

Nguồn game `eb04deb`, profile mới chạy build production, **không QA**. Vào New run bằng click, giữ D, chụp trạng thái, Save & quit; hai process Chromium dùng cùng profile. Không sửa save hoặc đồng hồ. Sau **90058 ms** đóng trình duyệt, nhấn Continue, đọc Return Chronicle rồi Enter the Island. Hai save do game ghi ở `01-departure.json.gz` và `02-return.json.gz`; `observations.json` được tính từ đó.

Run `run_t14xsy_mwob2r2z`, seed 1755429154, layout `veyra05-at-1664-1024`, local (49,112), F0, 286 người; chênh lệch hai `lastSimAt` **135523 ms**. Theo 6 job đã tồn tại *trước khi thoát*, không tính job mới. Ví dụ:

|Worker / job / source|Chuyển thực trong ledger|UID đích vẫn trong kho khi quay lại|
|---|---|---|
|h4 / hj2td / 0:4837602|1 wood s2u6 → s2u6|c15t|
|h9 / hj2tl / 0:4885634|1 herb s2ts → s2ts|c15t|
|hb / hj2to / 0:2217871|2 spares s2ty → **s17p** (merge vật lý)|c17o|
|hc / hj2tp / 0:1981867|2 spares s2tz → s2tz|c17o|

Không ghép hai lượt, không nhận screenshot thông báo thay cho UID. Không chứng minh người chơi đã đi qua tầng/cửa sổ và trở lại hay tận mắt thấy cả hành trình của worker; chưa đạt toàn bộ A–I. Không có `pageerror`; **2 HTTP 404** cho `pixelfx-assets/index.json` (mỗi process một lần), ghi nguyên trong observations, không đổi thành “browser sạch”. Thử đầu ở `../field-cargo` là một lượt khác thiếu snapshot sau; không tính vào bảng.
