# Kiểm tra nguyên nhân gốc: đăng ký chiêu ≠ runtime trong game web

Ngày 2026-11-03. Phạm vi: bản web review độc lập, không sửa Godot/production.
Đây là chẩn đoán kỹ thuật và kế hoạch có giới hạn, **không phải xác nhận P0
hay tuyên bố đã sẵn sàng chơi**.

## Kết luận

20 chiêu **đã được chọn/đăng ký trước**, và P0 có runtime Godot với các source
port/candidate thật. Không nên hiểu chúng chỉ là 20 cái tên hay nói rằng các
chiêu chưa từng được làm. Nhưng chúng không phải một thư viện gameplay web
hoàn chỉnh có thể gọi trực tiếp từ game React/Canvas. Handoff A/B/C/D chứa các
runtime, framebuffer và giả định khác nhau; P0 là một runtime Godot **visual
only**, với những world-pass vẫn được ghi rõ là chưa hoàn chỉnh. Bản web hiện
nay phải vừa đưa các visual source vào Canvas/WebGL vừa tự bổ sung combat.
Việc đăng ký item/ID không tự chuyển renderer, các pass, ánh sáng, camera,
clock và combat sang game.

### Chuỗi thực tế trong code

1. `integration/p0-catalog.json` có ID, tên, lựa chọn source và thời gian;
   `integration/check-catalog.mjs` kiểm tra metadata, **không** xác nhận visual.
   `src/game/catalog.ts` tạo 20 Core, inventory và `sim.ts:commitCore` thực sự
   trừ charge. Các test combat có kiểm tra quái thật và HP thật.
2. Trong web, `planArcana()` tạo geometry/damage do bản web đề xuất; P0 không
   cung cấp combat canon. `arcana20_cast` sau đó được phát tới **chín diagnostic
   layer** trong `src/game/render.ts`, mỗi layer tự lọc ID và quản lý runtime.
   Đây là tích hợp từng phần, không phải gọi nguyên P0 renderer. Các fusion
   và redesign có mức độ hoàn thiện khác nhau; xem `STATUS.md` và P0
   `renderer/WORLD_COMPOSITOR_CONTRACT.md`.
3. Source A/B/C/D có buffer, trình vẽ, clock và các pass khác nhau. Handoff
   `original_source/package/handoff/ARCHITECTURE_AND_INTEGRATION.md` đã yêu cầu
   common timebase/event queue và pass ground/behind/on-actor/front/light/
   distortion. Hiện web vẽ nhiều diagnostic lên terrain trước danh sách actor,
   rồi vẽ actor/roof và weather/light, sau đó một số post. Điều này **không**
   thể hiện đầy đủ ordering source cho mọi hiệu ứng. Đặc biệt, cần depth/alpha
   thật, nguồn world thực và post trước HUD; không thể sửa bằng một lớp VFX
   phủ lên ảnh hoặc bằng cách nhìn RGB để đo coverage.
4. Mỗi skill hiện có xử lý thời gian, nguồn/đích và lifetime riêng; combat
   được lập lịch riêng với visual. Các thử nghiệm cadence chỉ giảm số mẫu hình,
   chưa chứng minh giữ được chuyển động, các event một tick hay hiệu năng.
   Khoảng cách được clamp ở các phép biến đổi source-to-world cũng là policy
   ảnh hưởng vị trí: ví dụ #19 với caster (0,0) và đích cách 35px, scale tối
   thiểu 0.6 ánh xạ source center cách caster khoảng 62.4px; damage #19 hiện
   theo center đã biến đổi, không phải điểm aim 35px. Chưa kết luận nên đổi
   policy hay thông số nào trước khi xác định chủ đích chơi và kiểm tra đồng bộ.
5. Test 20 Core qua UI chứng minh route được gọi và charge bị trừ; các test
   combat độc lập kiểm tra va chạm/quái thật. Chúng **không** so sánh toàn bộ
   frame và thời gian với P0 trong game, depth, OUT, overlap hay FPS GPU thật.
   Số bài test không thể được dùng làm bằng chứng rằng visual đã chuyển đúng.

## #19: phân biệt phần source với phần chuyển vào world

`src/arcana_d/raster.ts` vẽ các lệnh source vào raster riêng; `worldGpu.ts`
lấy raster và world Canvas, rồi áp dụng phép chuyển LDR dạng
`original + tone(warped + light) - tone(original)` trong vùng ảnh hưởng. Đây
là bản chuyển từ `renderer/world_pass/d_world_composite.gdshader`, mà chính
header P0 ghi **thiếu bloom, viewport post và actor depth**; không phải một
bản full-source post có sẵn nhưng chưa đăng ký.

Có thể chạy `scripts/arcana_d_transfer_probe.mjs` trên dev server: ở tick 8.3s,
transform identity, world xám RGB 64 và warp bằng 0, raster #19 của web có
center RGB **255**, nhưng world compositor hiện tại cho RGB **192**; một pixel
ngoài ảnh hưởng vẫn RGB 64. Đây là **thí nghiệm cô lập trên nền tổng hợp**,
không phải ảnh game, so sánh P0 hay benchmark. Nó xác nhận phép chuyển hiện
thời có thể nén vùng sáng ở ngay ranh giới source→world. Nó không chứng minh
một mình phép tone gây sọc hay xác định đáp án thẩm mỹ cuối cùng.

Thử nghiệm bloom bổ sung sau phép chuyển nói trên đã thất bại và bị loại; flash
LDR opt-in/carry một tick chỉ là phép thử, không sửa được cấu trúc source/world.
Việc tiếp tục chỉnh glow, threshold hoặc thêm pass sau ảnh LDR mà không kiểm
chứng đúng đầu vào/ordering chỉ tiếp tục xử lý triệu chứng.

## Hướng sửa có điểm dừng

1. **Đóng băng baseline** P0 (kể cả #05 A/B và D19 A), bản web hiện tại và bộ
   capture; không đổi lại source hay thay các candidate đã chọn. Chọn #19 làm
   lát cắt chẩn đoán đầu tiên, không sửa dàn trải cả 20.
2. Đối chiếu ở cùng seed/tick: **source output → dữ liệu pass → world trước
   actor → world/actor trước HUD → output cuối**, có và không hiệu ứng. So
   sánh với source/P0 phù hợp và world game thật; kiểm tra pixel, anchors,
   thời gian event và OUT riêng. Nền tổng hợp chỉ dùng cô lập toán học, không
   làm bằng chứng visual game. Cần lưu cả trường hợp bình thường/tối và camera
   di chuyển. Nếu P0 không cung cấp reference cùng scene thì ghi rõ giới hạn,
   không tự gọi xấp xỉ là parity.
3. Thiết kế một **contract chung cho cast**: ID/cast ID, source, clock/event,
   caster/target và transform, semantic pass/coverage, signed/HDR khi cần,
   camera/depth, post trước HUD, cleanup/overlap. Cắm adapter D trước; khảo sát
   tận dụng runtime/source WebGL D gốc thay vì mặc định viết lại. Chỉ triển
   khai nếu chứng minh ranh giới, ordering, output và restore; không giả định
   có thể nhúng nguyên standalone mà bỏ qua sàn/actor giả của nó. Không trộn
   quyền quyết định combat vào visual.
4. Chỉ mở rộng adapter khi #19 qua các kiểm tra source, world thật, sync/OUT và
   performance; sau đó chọn ít nhất một source B và một fusion A+C để kiểm tra
   contract có thực sự tổng quát. Chưa qua thì dừng tại lỗi chung, không chỉnh
   20 chiêu bằng 20 bộ shader riêng. D19 A mặc định phải có đường khôi phục.
5. Sau khi visual High có cơ sở, đo trên thiết bị đích và so sánh các tier với
   High. Máy sandbox không có GPU thật, nên không suy ra 60 FPS hoặc thiết kế
   quality chỉ từ SwiftShader. Không công bố link là bản hoàn chỉnh trước khi
   các cửa kiểm tra gameplay, hình ảnh, save và performance thực sự đạt.
