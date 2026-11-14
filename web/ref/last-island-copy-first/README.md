# Last Island item COPY-FIRST — duy nhất một baseline

**Chính sách (Creator 2026-11-14):** lấy Last Island làm bản gốc cho item, recipes, loot, research, tools, guns, ammo, electronics, armor, foods, defences, machines và transport. Không giữ/chế thêm item SOH vì code cũ đã có. **Chỉ** chỉnh những hành vi mâu thuẫn luật đã [CHỐT] của SOH Gameplay Bible. Không tự rút gọn item Last Island theo sở thích. Đây là nguồn để triển khai, **chưa phải các item đã chơi được trong game**.

## Tài liệu nguồn đã nhập

- `LI_SOURCE_ITEMS_AND_RECIPES.json`: **139 source IDs** = **137 historical + 2 atlas-only**; có **82** source rows ghi nguyên liệu công thức không rỗng (KHÔNG đồng nghĩa 82 công thức của cùng một version). Mỗi hàng giữ `li_id`, `category`, `source_url`, `source_support`, `edition`, `event_only`, công thức, bench và loot khi có chứng cứ.
- Giữ `HISTORICAL_FORMULA_VARIANT` cho 7 biến thể lịch sử, không cho chúng tạo vật phẩm trùng loại chỉ vì khác năm.
- Giữ 2 món mùa sự kiện theo `KEEP_EDITION_SCOPED`, không giả chúng nằm trong bản thường 2019.
- Có **15** `UNSUPPORTED_CITATION`: giữ tên trong dữ liệu nghiên cứu, không phát hành công thức, tỉ lệ drop hay thông số không xác thực.
- Các giá trị `ATLAS POSSIBLE` là khả năng có loot, **không phải drop rate**. Năm/edition của nguồn chưa tách được chính xác phải để UNKNOWN.

## Sáu sai khác được quyền thay theo Bible, không phải cải tổ tùy ý

1. **Thời gian và reset:** LI standard PvE 2019 15 ngày; SOH **336 giờ (14 ngày) online+offline**, hai năm hư cấu/tám mùa, **72 giờ cuối Ragnarok**. Vật phẩm, công thức và đồ ở nhà mất khi hết run; tiền đã ký gửi là ngoại lệ duy nhất có giá trị kinh tế xuyên run.
2. **PvP/loot từ người chơi:** LI có nhiều hành vi PvP; SOH **solo PvE**, không có raid bởi người chơi khác. Giữ súng, đạn, bẫy, tháp, giáp nếu có vai trò chống quái/khám phá/kiểm soát POI; không loại chúng chỉ vì PvP absent.
3. **Core/Ragnarok:** giữ thêm **7 Creator Core + 4 Field Core**, sáu loại năng lượng Creator, sáu Elder Stone canonical, Ragnarok Cash và Escrow theo Bible. Đây là **SOH-additions**, tuyệt đối không giả có trong LI.
4. **Nhà, lãnh địa, POI:** `territory_cabinet` LI ↔ `claim` SOH; công trình đặt thật, upkeep run-local, quái chỉ lần theo nhà khi phát hiện dấu chân hợp lệ. Thẻ và cửa điện giữ công năng LI nơi có POI vật lý; không ép mọi POI phải ba cấp thẻ.
5. **Nghiên cứu:** bảng LI/SOH phải giữ quyền công thức theo run; mẫu vật, blueprints, Parts và random/directed R&D đi qua **một** quyền kiến thức K4. Blueprint LI học rồi có thể không mất khi chết *trong run*, nhưng SOH không giữ sang run mới.
6. **Thế giới và chuyển đổi tài nguyên:** chuyển các địa điểm/nguồn LI sang sinh thái Veyra **theo chức năng thực**, không đặt bừa nguồn ở map; dầu phải có oil source, điện tử ở thiết bị/caches có điện tử. Các nguyên liệu Core/khí hậu của SOH là ngoại lệ do Bible, không cho phép đổi công thức LI chỉ để sử dụng item SOH dư thừa.

## Các ví dụ giữ NGUYÊN từ LI thay vì V2 tùy ý sửa

- `parts`: chính là `spares` cũ trong SOH, **vẫn gọi là Parts**; vẫn từ loot/recycler và dùng trong R&D lẫn công nghệ, không craft từ Scrap/Iron vô hạn.
- `electronic_parts`: **phải có**. Không nhập vai của nó vào Parts; dùng cho đúng thiết bị có điện tử.
- `mechanical_gear`: công thức tham chiếu LI **50 Iron Ingot + 65 Parts**, Workbench II, cần học. Không thay bằng Machine Parts + Fasteners để bảo vệ công thức cũ.
- `metal_blade`: tham chiếu **30 Iron Ingot + 15 Parts**, không bắt Machine Parts.
- `metal_pipe`: tham chiếu **5 Refined Iron Ingot + 30 Parts**, không bắt Machine Parts.
- `iron_plate`: tham chiếu **5 Refined Iron Ingot + 30 Parts**, không bắt Fasteners.
- `electric_door`: tham chiếu **50 Iron Ingot + 5 Electronic Parts + 1 Mechanical Gear + 10 Iron Plate**, cần điện. SOH `door_powered` hiện là MODULE_PENDING; không được gọi live.
- `fuel_generator`: tham chiếu **20 Refined Iron Ingot + 100 Iron Ingot + 30 Electronic Parts + 100 Parts**; đầu vào nhiên liệu/điện phải có thật.
- Súng, đạn, vũ khí và thiết bị phòng thủ trong LI **không còn trạng thái NOT_ADDED chỉ bởi SOH thiếu gun runtime**; trạng thái đúng là **MISSING_IMPLEMENTATION** và không được giả đã hoạt động.

Các số trên là **historical secondary/Atlas baselines gắn phiên bản, không phải số đã được nghiệm thu cân bằng tại Veyra**. Học nguyên chuỗi source→cost→action→consumer trước; không lặng lẽ chia nhỏ số để cho giống bản cũ của SOH.

## Xử lý những item SOH không thuộc LI

- `mechanical_parts`, `fasteners`, `damaged_drive` là **SOH-only hiện tại**, không được làm “mặc định phải giữ” trong item set mới. Không dùng chúng làm phụ phí trong công thức Last Island. Nếu item có đặc điểm riêng phục vụ luật Bible, chứng minh chính xác mối nối; nếu không, retire khỏi new runs với save migration.
- **Không xóa ngay** existing IDs, queues, deployed instances, equipment, chest/cart/bag hoặc save cũ. Bảo lưu dữ liệu cũ, không cho chúng sinh ra nguồn Parts vô hạn.
- Các packed device `deploy_*` trong SOH là hình thức lưu trạng thái của công trình, không nhất thiết là một item LI tương ứng riêng; giữ UID/lifecycle K1.
- Sự kiện/skin/variante của các năm khác vẫn nằm trong hồ sơ nguồn nhưng **không bị trộn vào baseline 2019** nếu chưa xác định year/mode tương ứng.

## Điều kiện để được nói “đã copy vào gameplay”

Một ID chỉ `PLAYABLE` khi tồn tại trọn: source vật lý hoặc recipe + learned right -> inventory/trang bị/deploy -> hành động có tác dụng -> tiêu hao/độ bền/maintenance -> save/reload -> player route thực. Một hàng JSON chỉ là `SOURCE_COPIED`, không phải `PLAYABLE`.

**Trạng thái của PR này:** đã nhập nguồn dữ liệu; chưa bổ sung vũ khí/đạn/thiết bị/đồ ăn vào runtime, chưa đổi các recipe production, chưa làm migration và chưa nghiệm thu native. Không merge chỉ vì bản nguồn đủ 139 dòng.

Source authority:
- SOH: `web/ref/bible.md`, especially §0.1b, §0.2, K1, K3, K4, K6, K7, K8.
- LI: `web/ref/atlas/extracted/ATLAS_v2.json` + `web/ref/item-ontology-v2/li-historical-crosswalk.csv`, provenance row-wise.
- Official LI 2019 mode FAQ: https://hero.yingxiong.com/info/2019/0730/6973.html
- 2019 secondary mechanical gear: https://www.9game.cn/daihaoyingxiong/3279007.html
- 2019 electrical guide: https://www.aspxhome.com/youxi/2022/398618.htm
