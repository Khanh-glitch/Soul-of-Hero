# VEYRA F03 FLOW R4 — tiếp nối R3 trong game thật

**Ngày:** 2026-11-09  
**Phạm vi sửa thêm:** `po_mill` (Mossbrook Mill), `po_timberyard` (Verdant Timberyard), `po_slag` (Slagworks Foundry).  
**Phạm vi đã sửa cộng dồn R3+R4:** sáu F03 POI gồm `po_falls`, `po_sawaion`, `po_fracquarry` và ba POI trên.  
**Bản chơi thử:** `PLAY_VEYRA_F03_FLOW_REWORK_R4.html` (standalone, dùng engine VEYRA thật và art Arena pilot).  
**Không sửa:** source GOLD, IDs/tọa độ 81 POI, art Arena, các hệ survival, 12 F03 POI khác (so sánh R4 với R3, có 12 POI không đổi).

## Lý do sửa và cách sửa

**Mossbrook Mill** — COMPACT: thay sân gỗ và đường vận chuyển ngẫu nhiên bằng tuyến bánh xe nước → nhà nghiền → kho bột khô. Trong thử runtime đầu tiên, đường tới cửa kho không đi được vì vị trí kho gần bờ nước; đã chuyển kho về bãi đất có thể đi, giữ nhánh cầu bánh xe và gác truyền động ngắn.

**Verdant Timberyard** — COMPACT / WORKING YARD: lượt đầu nguồn xây dựng trải các công trình sang bờ bên kia vùng nước, dù đồ thị nguồn báo liên thông. Thử runtime bắt được 3/4 đích không tới được; đã sửa bằng cách chuyển văn phòng nhận gỗ, xưởng xử lý, kho phơi và tuyến phân loại sang bờ đông có đất, bố trí riêng luồng gỗ và người đi. Đường tới 4/4 đích qua `window.__veyra05.findWalkWaypoints` sau sửa đều đạt. Không bắc cầu tưởng tượng qua GOLD.

**Slagworks Foundry** — DEEPER INDUSTRIAL: tách nhiên liệu phía tây, lò đúc phía đông, khu phân loại sau tôi phía nam, làm đường vòng vận chuyển xỉ; gác thông gió trên chính nhà lò và một nhánh bảo trì cống thoát nước ở tầng -1. Các nhánh phục vụ quy trình luyện và thoát nước, không phải hầm/bridge cảng tái sử dụng.

## Kiểm chứng — phân biệt bằng chứng và chưa nghiệm thu

- Số ô đường/sân đè vào footprint nhà ngoài ngưỡng cửa: Mossbrook `294 → 0`, Verdant `398 → 0`, Slagworks `444 → 0`. `evidence/geometry_audit.json`.
- Cả ba sơ đồ không có đầu thang ngoài sàn, mỗi cao độ khai báo tạo đúng một cụm sàn liên thông.
- 12 F03 POI còn lại **không đổi sơ đồ** khi so source R3 → R4, bao gồm chính ba POI R3 đã sửa.
- Chromium Creator Inspection đã thực sự mở cả ba cảnh từ HTML R4, không có pageerror trong các lượt có screenshot. `evidence/r4_po_*.png`.
- `window.__veyra05.findWalkWaypoints` trên game đang chạy: **12/12 đích chính xác**, không chỉ gần đích. Cụ thể 4 đích/POI. `evidence/qa_engine_paths_all12.json`.
- Đã phát hiện và sửa lỗi **đi không tới đích do nước/địa hình GOLD** ở Mill và Timberyard, chứ không coi `overlap=0` là đủ.
- **Chưa** chạy người chơi bằng tay/bàn phím qua toàn tuyến hoặc bấm E ở tất cả thang R4; pathfinding 12/12 không thay thế thử nghiệm tương tác. Không có chứng minh loot, save/reload hay cơ chế phần thưởng.
- Thẩm mỹ còn nợ: mặt sàn, một số silhouette và tương phản sprite Arena chưa FINAL. Đây là lượt level design/placement, không làm lại artwork.
- **C03 Breakthrough gốc vẫn chưa có**, preview là **78/81**, không được gọi 81/81 tích hợp hoàn chỉnh.

## Cách kiểm nhanh

Mở `PLAY_VEYRA_F03_FLOW_REWORK_R4.html` → New run → Creator Inspect → World Map → chọn `Mossbrook Mill`, `Verdant Timberyard` hoặc `Slagworks Foundry` → Inspect & Play. Có thể dùng `Walk 10x` để chạy nhanh. `VEYRA_R4_3_POI_REAL_GAMEPLAY.jpg` là ảnh Chromium trong game. `VEYRA_R4_3_POI_SOURCE_FLOW_BEFORE_AFTER.jpg` là sơ đồ phòng/sàn trích trực tiếp source, **không phải ảnh gameplay**.

## Source / regression

- `source/f03.ts`: R4 toàn bộ F03, giữ 3 override R3 và thêm 3 override R4.
- `source/f03_r3.ts`: nguồn R3 trước lượt thay đổi, để audit và rollback.
- `tests/audit_flow.cjs`: geometry/connected/stair checks và so giữ nguyên 12 POI.
- `tests/build_pilot.cjs`: thay đúng module `__F03` của game standalone R3, giữ art Arena/engine khác.
- `tests/qa_new_one.py` và `tests/qa_engine_paths.py`: browser visual boot và pathfinding QA trên game thật, cần Chromium và Playwright.

**Trạng thái:** R4 LEVEL-DESIGN PILOT — ba POI này đạt cấu trúc + path targets; chưa đạt FINAL gameplay/art acceptance.