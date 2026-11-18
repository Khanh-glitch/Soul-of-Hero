# Nghiệm thu hiện tại — SOLO/shared runtime

## Kết luận
**Hồi quy tự động đã đạt. Chưa đủ điều kiện tuyên bố hoàn thành/phát hành.**

Mã nguồn kiểm tra toàn bộ mới nhất: working tree trên base `53c168808e4264c39625ad3bd409211de005dfa7`, thêm bản sửa cache khi nhặt loot, bỏ PNG encoding đồng bộ trong React UI, và **dựng lại đường lưới va chạm 40.000 ô** (chỉ mục cửa + phân loại phần không phụ thuộc run với tra cứu đã nâng ra khỏi vòng lặp mỗi ô), trên nhánh `arena/e506bfd6-soul-of-hero`. Hash engine và phạm vi phép đo: [LOOT_LAG_OPTIMIZATION.md](LOOT_LAG_OPTIMIZATION.md), lượt mới nhất [frame-work/RESULT.md](frame-work/RESULT.md) (engine `857c89fa…`, render `284c8395…`). Mốc294fb68 bên dưới được giữ làm bằng chứng lịch sử, không phải lượt full mới nhất.

| Cổng | Kết quả thực tế |
|---|---|
| Toàn bộ Vitest, chạy từ `web/`, trên byte shipped cuối | **205/205 tệp PASS; 1.361 PASS, 0 FAIL, 19 skip** (559 suite, 808,5s) |
| Lưới va chạm so ô-theo-ô với engine HEAD, browser thật | **9 layout × 7–12 trạng thái: 0 ô lệch / 40.000 ô, 0 lỗi trang**; `startRun` HEAD và bản vá giống hệt nhau 24/24 lần thử |
| TypeScript ứng dụng và test | PASS |
| Production build | PASS; single-file ~84,8 MB |
| Production 640×360, hồ sơ mới → Inventory → lưu → tiến trình Chromium mới → tiếp tục | PASS kỹ thuật; không cấp vật phẩm/đổi vị trí; `qaUsed=false` |
| Production 640×360, **nhập liệu thường**: menu → giữ D/S → giữ LMB → lưu → tiến trình mới → tiếp tục | PASS kỹ thuật; di chuyển 151px, **2 receipt harvest thật**, berries + seed_wildberry vào túi, vị trí/seed/digest giữ nguyên; 1 longtask 72ms trong ~40s; `qaUsed=false`, errors[] |
| Plank: chọn nâng cấp → trả đúng 3 Plank → giữ tường và tỉ lệ HP → lưu/mở lại | PASS cơ chế và UI fixture; không phải bằng chứng tự thu thập nguyên liệu |
| Hook Garden Cottage | Hai gốc cửa sổ biên dịch PASS; đối chứng vách cũ hai ca FAIL đúng lối vào; giữ nguyên 738 nguồn |
| Native/Godot cùng luật Veyra | Chưa xác minh; dự án native gốc là đường chơi Chapter1 cũ, không thể lấy ảnh Web thay thế |
| FPS GPU thật / cảm giác chơi | Chưa nghiệm thu; số đo SwiftShader chỉ phục vụ chẩn đoán |
| Chơi dài hạn 336 giờ, nhiều phiên, người thật | Chưa nghiệm thu; mô phỏng đồng hồ không thay thế được |
| Shared fix cabinet trên NPC `79ac5f0` | AppTS và 5 tệp/34 ca PASS trong bản archive riêng; không phải full merge certificate |

Cổng opt-in ecology chạy riêng sau full suite cũng đạt, sau khi phân biệt đường đi bộ có thể lội nước với quy tắc đặt nguồn trên đất khô. Không cộng kết quả opt-in chạy riêng vào tổng 1.356; 19 skip của lượt full vẫn giữ nguyên.

## Các sửa đổi giữ lại
- **Dựng lại lưới va chạm không còn trả giá chuỗi tra cứu cho từng ô trong 40.000 ô.** Chỉ mục cửa `doorTiles(w)` thay cho quét tuyến tính `statics.some(...)` (engine, `renderChunk`, `draw` dùng chung); phần lớp ô không phụ thuộc run được tính bằng vòng lặp đọc thẳng typed array với một lần resolve world/window/floor; `blockGrid` v3 sau đó phân loại lại đúng các ô run đã sửa bằng `cellClass` **nguyên văn**, và giữ nguyên vòng entity/thang/cửa/loot/airdrop; đường v1/v2 không đổi. Tương đương có lập luận (chỉ `r.sources[i]` và nhánh regrowth cần `now` là phụ thuộc run) **và** kiểm chứng ô-theo-ô. Đo cùng seam trên fixture Veyra thật: tổng `tick` pha harvest 24s **3.949ms → 129ms**, p95 56,5 → 1,5ms, longtask **62 → 0**; pha movement 24s **14.989 → 149ms**, longtask **98 → 2**; ms rebuild lưới 7.575 → 10,2ms; `cellClass` 2,84 triệu → 0 lượt. Trạng thái cuối pha harvest giống hệt nhau (vị trí, stock 0, 3 receipt). **Không tuyên bố hết đuôi frame hay FPS thật**: p95 frame vẫn 0,6–1,6s dưới SwiftShader ở cả hai biến thể, và ablation trước đó cho thấy đuôi xuất hiện cả khi chỉ clear canvas. [Bằng chứng, giới hạn và bản nháp bị loại](frame-work/RESULT.md).
- **Một thiết kế nhanh hơn đã bị loại vì sai luật**: cache lưới tĩnh xuyên qua các lần rebuild, khóa theo danh tính + bộ đếm revision. Hai test luật có sẵn đỏ thật (tường `T.PWALL` không chặn 100% sát thương Primordial: 14,996≠0; ô prop đa ô không rắn: 0≠2) vì chúng ghi nội dung world **tại chỗ** rồi chỉ `markDirty()`. Đã xóa cache đó, trả `scenes.ts`/`window.ts`/`floors.ts` về HEAD, và bản shipped **không lưu gì giữa hai lần vô hiệu hóa** — lớp lỗi "phục vụ dữ liệu cũ" không thể xảy ra về cấu trúc. Bằng chứng đỏ của suite (1.359 PASS/2 FAIL) được giữ nguyên, không ghi đè; test mới `collision-grid-cache.test.ts` khóa luôn tính chất này (so toàn bộ 40.000 ô với bản sao nguyên văn thuật toán cũ).
- UI icon thủ tục copy canvas→canvas thay cho PNG đồng bộ; atlas157/art thế giới không đổi. 286RGBAkhớp,93icon giữ geometry; mởInventory production244ms trong một smoke. [Bằng chứng và giới hạn](ui-canvas/RESULT.md): đuôiframe phầnmềm còn dài/mixed, không tuyên bốFPS toàngame tốt hơn.
- Nhặt đồ rơi không còn xóa cache va chạm 40.000 ô sau từng món; không thay ảnh/renderer. Đối chứng tick thật32 món: trung vị921–1.068ms →1–1,1ms trên lượt Veyra đã assert map thật; số78–86ms cũ bị rút nhãn Veyra do lỗi harnessHMR; không phải FPS/GPU thật. [Chi tiết, giới hạn và raw](LOOT_LAG_OPTIMIZATION.md).
- Sửa cabinet trả vật liệu/hồi HP nhầm tầng: hành động repair và liên kết lãnh thổ dùng cùng phân quyền từng công trình như upkeep/decay.
- Giữ nâng cấp phần cứng đã trả phí trên đúng chassis UID khi thu hồi/triển khai máy phát và khung vườn; từ chối metadata sai, không mang nhiên liệu/cây/job/điện sang vị trí mới.
- Cho phép **tùy chọn** tường gỗ → tường Plank bằng hóa đơn sẵn có 3 Plank. Đường mặc định gỗ → đá vẫn nguyên; Plank → đá trả đủ hóa đơn đá. Không dựng thẳng tường cấp cao, không ép người chơi theo một lộ trình.
- Đồng bộ UI, đồ thị kinh tế, ontology và kiểm tra upkeep/repair với đường nâng cấp thật.
- Không nhận tối ưu PNG thử nghiệm vào production: giảm giật lần mở đầu nhưng chưa chứng minh không làm xấu các khung hình kéo dài.

## Bản chơi và cách kiểm tra tự do
Artifact chính: `web/dist/index.html` (được tạo bởi `npm --prefix web run build`, không đưa file build lớn vào Git).

SHA-256 của HTML đã chạy kiểm tra production mới nhất:
`51e1d7b22935363fa0aeeb091406b16b8a7ae9735659d8396ac10f5f2b4afd1a`.

Lượt smoke mới (nhập liệu thường, không tiêm trạng thái): `frame-work/production-movement/manifest.json` + 3 ảnh chụp, seed1956155901 do game tự chọn, layoutveyra05-at-2048-1280, digest277590c5, qaUsedfalse, errors[], 2 receipt harvest, lưu/tiếp tục ở tiến trình browser khác giữ nguyên từng trường. Lượt smoke UI-canvas trước đó (HTML `f3016b94…`, seed2009464091, layoutveyra05-at-1984-768) giữ tại `ui-canvas/production-final/`; mốc trước khi sửaUI tại production-loot-cache/; mốc HTML83b5… trong production-294fb68 để đối chiếu lịch sử.

Khởi chạy từ thư mục `web/`: `npm run preview -- --host 0.0.0.0 --port 4173`.
Không dùng fixture để đánh giá trải nghiệm. Tạo hồ sơ mới, tự chọn mục tiêu và cách chơi; không có tuyến nhiệm vụ bắt buộc do bài kiểm tra này quy định. Xem hướng dẫn điều khiển trong game. Khi dừng, dùng **Save & quit to title**.

Các câu hỏi nghiệm thu mở: Bạn tự muốn làm gì? Những lựa chọn nào không nhìn thấy? Hành động nào có phản hồi/cost khó hiểu? Có muốn quay lại chơi không, vì sao? Ảnh vật phẩm/Gold có dễ đọc? Hiệu năng ở máy thật có ổn khi mở UI và di chuyển? Không suy ra câu trả lời từ bot.

## Bằng chứng và phần tiếp tục
- [Dựng lại lưới va chạm — farm/di chuyển](frame-work/RESULT.md): đối chứng CPU trước/sau cùng seam, tương đương ô-theo-ô với engine HEAD trong browser, parity `startRun` 24/24, 7/7 phép vẽ địa hình khớp từng byte, test hồi quy mới, full205 tệp/1.361PASS, smoke production nhập liệu thường. Kèm hồ sơ bản nháp cache bị loại và bằng chứng suite đỏ của nó.
- [Bỏ treo PNG khi mởUI](ui-canvas/RESULT.md): full mới nhất204file/1356PASS/0FAIL/19skip, đã rerun sau sửa testB7 để kiểm cả ảnh và nguồncanvas thực. Hai lượtABBA,286RGBA, geometry, productioncontinuity và raw của lượtfullđỏ giữ nguyên.
- [Audit kỹ thuật không chấm experience](technical-audit/TECHNICAL_RED_FLAGS.md): hai red flag được ghi nhận khi audit (PNG encoding đã xử lý hẹp bằng canvasUI ở lượt sau; hợp đồng giữchuột khi nhậnfiber vẫn mở), storagefault6/6 và hai vòng controls→savePASS. Đã sửa provenance của phép đo cũ; lượtfocusedmới20PASS gồm2characterization, sau đó đã có lượtfull204file/1356PASS ở mụcUIcanvas.
- `full-regression-loot-cache.json.gz`: lượt toàn bộ trướcUI202 file/1350PASS/0FAIL/19skip; thêm2 bridgehead test từ53c1688 và4 cache test, không cộng focused vào full.
- `loot-cache-focused.json.gz`, `loot-pickup-profile.json`, `loot-render-profile.json`, `production-loot-cache/`: hồi quy, đối chứng và smoke mới.
- `full-regression-294fb68-webcwd.json.gz`: kết quả toàn bộ, giữ nguyên 19 skip, không cộng focused test vào tổng.
- `production-294fb68/`: manifest và ảnh production, lưu/tiếp tục bằng hai tiến trình trình duyệt.
- `territory-floor-red.json.gz`, `territory-floor-expanded.json.gz`: lỗi cabinet ba ca đỏ, nhóm tích hợp 55 ca xanh.
- `g1b-ecology-player-access.json.gz`: cổng geometry/reachability opt-in, không phải chứng nhận thu thập toàn bộ nguồn qua chơi tự nhiên.
- `g1b-bridgehead-wading.json.gz`, `gulfhead-wading.json.gz`: nguồn/cửa thật qua đường lội, không đổi địa hình.
- `npc-79ac5f0-territory-final.json.gz`: replay shared fix hẹp trên mã NPC hiện được quan sát.
- `plank-ui/`: fixture UI nâng cấp đã ghi rõ giới hạn.
- `g1b-hook-expanded.json.gz`, `g1b-hook-historical-reverse.json.gz`: mở rộng đường vào và đối chứng vách cũ.
- `CONTROL_TOWER/06_PROGRESS_LEDGER.md`: diễn tiến đầy đủ, ca thất bại, thí nghiệm bị loại và bước điều tra tiếp theo.
- `CONTROL_TOWER/PORTING_MANIFEST.md`: giới hạn chuyển sửa đổi sang NPC; không phải quyền merge.

Đây là bàn giao trạng thái có thể tái lập, **không phải chứng nhận RC, native, trải nghiệm con người hay phát hành toàn bộ game**.
