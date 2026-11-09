# VEYRA F03 FLOW R3 — 3 POI Level Design Pilot

**Ngày:** 2026-11-09  
**Phạm vi đã sửa:** `po_fracquarry`, `po_sawaion`, `po_falls`.  
**Art:** Giữ nguyên art mới của Arena, không nhận nhiệm vụ vẽ lại texture ở lượt này.

## Mở trực tiếp

Mở `PLAY_VEYRA_F03_FLOW_REWORK_R3.html` trong trình duyệt desktop. Chọn `New run → Creator Inspect → World Map`, chọn lần lượt `Fracture Quarry`, `Aion Edge Sawmill`, `Falls Powerhouse`, rồi `Inspect & Play`. Ảnh trước/sau tại `EVIDENCE/VEYRA_R3_3_POI_BEFORE_AFTER.jpg` dùng **cùng POI, cùng camera bắt đầu và cùng art Arena**, chỉ thay đổi sơ đồ F03. Thời tiết là biến ngẫu nhiên nên không dùng làm phép so màu pixel-perfect.

## Đã thay đổi thật

- **Fracture Quarry (DEEP):** tách lối vào, tuyến khảo sát và vành mỏ khỏi lane chuyển quặng; hầm khảo sát có nhánh rẽ và hốc cuối; tầng trên là ledge ngắn gắn với hoist, không phải quảng trường trên cao. Đặt crusher gần đầu tuyến xử lý; mạch quặng, đống thải và thiết bị ở đúng công năng.
- **Aion Edge Sawmill (COMPACT):** đặt lại hướng nguyên liệu đi từ tây sang đông, đường công nhân đi riêng khỏi feed carriage, lối vào kho gỗ thô và kho thành phẩm theo hai nhánh, gác dây đai nằm trên nhà cưa. Đây là POI công nghiệp gọn, có vòng trả về, không cố tạo hầm sâu.
- **Falls Powerhouse (MEDIUM):** tách lối kiểm tra nước, nhà turbine, kho ống; có đường vòng hạ lưu và một cửa tiếp cận từ intake; tầng -1 là bearing chamber / tailrace maintenance, tầng +1 là mezzanine của nhà turbine. Sửa thêm đoạn route tại điểm xuất hiện của Creator Inspection sau khi ảnh thật cho thấy người chơi đứng trên nền tuyết.

Không thay đổi 12 F03 còn lại, 48 POI sau F03, H01/F02, GOLD IDs/tọa độ, game loop hoặc renderer pixel art.

## Bằng chứng thực thi (không đánh tráo mức nghiệm thu)

- `EVIDENCE/geometry_audit.json`: **overlap ở các đường/sân không phải ngưỡng cửa với footprint nhà** (số ô): Fracture Quarry `111 → 0`, Aion Sawmill `336 → 0`, Falls Powerhouse `174 → 0`. Đây là kiểm toán hình học source, không tự thân chứng minh thẩm mỹ.
- Ba POI có **1 cụm sàn liên thông ở mỗi cao độ khai báo**, không có đầu cầu thang ngoài sơ đồ sàn; TypeScript transpile diagnostics = 0.
- **12 F03 POI khác khớp nguyên dữ liệu source trước/sau** (không âm thầm sửa các nơi khác).
- `EVIDENCE/qa_engine_paths.json`: trong game Creator Inspection thật, `window.__veyra05.findWalkWaypoints` đi đến chính xác **6/6 đích** (hatch + ledge tại Quarry; cửa xưởng + loft tại Sawmill; cửa turbine + hatch tại Falls). Đây là kiểm tra đường đi bằng engine, không phải kiểm thử bấm `E` hoặc đi trọn đường bằng người chơi.
- `EVIDENCE/r3_po_*.png`: Chromium mở được 3 POI, render art Arena thật, không có JS `pageerror`.
- `EVIDENCE/VEYRA_R3_3_POI_BEFORE_AFTER.jpg` đối chiếu thực từ HUD/camera hiện hành.

## Giới hạn và nợ còn tồn tại

1. Bản preview là **78 POI có kiến trúc, không chứa nguồn C03 Breakthrough chính chủ**; không gọi là 81 POI đã tích hợp thực tế.
2. Chưa có kiểm thử liên tục điều khiển nhân vật tới mọi điểm, mở mọi cửa, bấm E lên xuống ở cả ba POI, save/reload hay loot/gameplay reward. Không claim final exploration acceptance.
3. Bề mặt Arena tại Sawmill vẫn quá nhiều hoa văn nâu/gỗ, nhiều vật thể còn hòa màu với nền. Chưa làm lại art trong lượt này; cần vòng visual readability riêng.
4. Thang kiểm tra tiếp theo cho 12 F03 khác: các **ô open yard chồng lên roof footprint không tính threshold** ở một số site vẫn nhiều. Đây là *cờ kiểm tra*, không phải kết luận tất cả đều lỗi: `po_slag 444`, `po_timberyard 398`, `po_mill 294`, `po_kilns 285`, `po_sulfur 285`, `po_siloc 262`, `po_pumphouse 254`, `po_geo 231`, `po_oldpump 176`, `po_greyquarry 111`, `po_obsq 111`, `po_filter 60`. Cần so ảnh thật và xử lý theo từng công năng trước khi sửa.
5. Nhiều note/micro-discovery hiện chỉ là metadata của sơ đồ, **chưa chứng minh thành tương tác người chơi có ý nghĩa**. Không được coi thêm note là hoàn thiện gameplay. Phải test vòng chơi và hệ phần thưởng sau.

## Source / Build

- `SOURCE/f03.ts`: bản R3 sau sửa; `SOURCE/f03_before.ts`: nguồn cũ để rollback.
- `TESTS/audit_flow.cjs`: kiểm tra cấu trúc, overlap, connectivity và 12 site không bị thay.
- `TESTS/build_pilot.cjs`: thay **duy nhất** closure `__F03` trong standalone HTML pilot có art Arena, giữ lại các module engine khác; không dựng demo giả.
- `TESTS/qa_new_one.py`: mở scene thật riêng từng POI trong Chromium; dùng một site mỗi lần để giảm rủi ro browser quá tải.
- `TESTS/qa_engine_paths.py`: thử game-native path query (nên chạy từng `po_...` để tránh Chromium memory leak).

Để build lại từ gói này, chạy: `node TESTS/build_pilot.cjs PLAY_VEYRA_ARENA_ART_PILOT.html PLAY_VEYRA_F03_FLOW_REWORK_R3.html` nếu có HTML art Arena pilot gốc (gói này kèm). Bản build đã phát hành là standalone và không yêu cầu người chơi cài node.

## Trạng thái

**R3 — STRUCTURAL PILOT / NATIVE VISUAL TRIAGE, NOT FINAL.**
Chỉ triển khai 3 POI; chưa đưa các chỉnh sửa này vào production Godot hoặc game SOH chính.