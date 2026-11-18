# Bỏ treo PNG khi mở UI — kết quả kỹ thuật

## Đã giữ lại thay đổi nào?

**Icon thủ tục trong React UI được copy trực tiếp canvas→canvas, không còn mã hóa PNG đồng bộ khi mở túi.** Không dùng lại PNG bake/CPU encoder từng bị loại; không đổi ảnh, gameplay hay luật giữ chuột.

- `ArtImage` giữ ưu tiên `<img>` của atlas157. Chỉ nhánh icon thủ tục/công trình chuyển sang canvas UI.
- Canvas UI giữ nguyên backing resolution của sprite; kích thước CSS, nearest filtering, ghost/filter/drag styling và nhãn accessibility được duy trì.
- Copy bằng layout effect khi mount hoặc nguồn thay đổi, **không có RAF riêng**. Re-render với nguồn không đổi không copy lại. Thay nguồn/kích thước trên cùng component được vẽ lại; unmount bỏ DOM canvas.
- Chuyển các chỗ `img src={iconUrl(...)}` ở Survivor, panels, BuildBar và VehicleConsole cùng lúc, tránh còn một nhánh làm flush PNG. API URL cũ vẫn giữ tương thích cho caller cần URL, nhưng không còn consumer React UI nào gọi nó.
- `art.ts`, renderer thế giới, atlas loader/PNG/metadata **không đổi byte**. Không thêm dependency hay file ảnh mới. Bản sửa cache nhặt loot trước đó vẫn giữ nguyên.

## Pixel và hiển thị

Browser test thật `e2e/ui-canvas-pixels.mjs`:

- **286/286 sprite thủ tục khớp từng byte RGBA**, đúng kích thước gốc; không chỉ kiểm tra có file hay thẻcanvas.
- 286 lần copy đầu cho286sprite; **20 re-render cùng nguồn sinh0copy mới**.
- Thay nguồn có kích thước khác trên cùng instance: pixel khớp; chuyển sang ID không tồn tại xóa sạch hình cũ; unmount không để lại DOM con.
- **0 lần PNG encode** trong phép thử fallback; sau khi load atlas, wood vẫn dùng ảnh atlas157.
- Nhóm Inventory có93icon: vị trí/kích thước DOM khớp chính xác giữa4session trong lượt đối chứng đã làm nóng. Không suy ra từ đó mọi màn hình/mọi thiết bị đã được human-review.

Raw: `pixels.json`, `settled-profile.json`. Các test React/SSR còn giữ unknown/prototype guard, kích thước native tách biệt kích thước CSS, và kiểm tra không còn consumer URL đồng bộ.

## Đối chứng hiệu năng

**Không test experience.** Cùng snapshot Veyra thực `veyra05-at-1920-512`, seed901, assert map thật. Serial **PNG / canvas / canvas / PNG**, Chromium headless, SwiftShader, dev build. Baseline là5fileUI chính xác từ53c1688; engine hiện tại giống nhau ở cả hai biến thể. Wall clock đóng băng cho cùng trạng thái game.

### Lần mở đầu

| Lượt | PNG cũ (ms đến DOM) | Canvas mới (ms đến DOM) |
|---|---:|---:|
| ABBA với pha30s bao gồm thời gian input | 19.371 /19.310 | 205 /109 |
| ABBA có làm nóng theo số frame trước khi đo steady | 20.704 /19.883 | 93 /90 |

- Bản cũ:75encode32×32 của atlas +2encode16×16 thủ tục; một encode16×16 chặn khoảng19–20,5giây.
- Bản mới: vẫn75encode32×32 lười của atlas, nhưng **không còn encode16×16 thủ tục**; encode lớn nhất0,3–0,9ms trong các lượt này.
- Chỉ có2fallbackcanvas đang hiện ở cảnhInventory này. Số copy4 là do React dev StrictMode chạy lại effect lúcmount, không phải vẽ lại mỗi frame.

### Đã kiểm tra các khung hình sau đó, không chỉ input đầu

Giữ nguyên raw của cả hai lượt, kể cả kết quả không thuận lợi:

1. Lượt pha30s theo đồng hồ: Inventory-first tailp95 bảnPNG≈33ms nhưng canvas≈833ms; lúc mở lại cảhai≈817–900ms. **Không công bố lượt này là toàn diện tốt hơn.** FlushPNG20giây dừng nộp công việcGPU, vì vậy cùng thời gian tường không đồng nghĩa cùng tải/tuổi hàng đợi đồ họa.
2. Chạy thêm ABBA: sau khi mở, đợi cùng360frameInventory rồi đo30s; lầnmởlại đợi120frame. Đuôi10giâycuối:
   - Inventory-first p95: PNG816,6/816,7ms; canvas883,2/833,3ms.
   - Inventory-repeat p95: PNG766,6/833,3ms; canvas766,7/899,9ms.
   - Idle cũng có tailp95≈1,1–1,2giây ở cảhai.

Kết luận hẹp: **đã loại bỏ được công việc PNG đồng bộ gây treo lần mở đầu; chưa chứng minh tăngFPS toàn game hay không hồi quy tuyệt đối trên mọi thiết bị.** Các đuôiGPUphầnmềm vẫn dài và biến động, có cửa sổcanvas chậm hơn; không che số đó bằng trung vị hay gắn nhãn hardwareFPS. Cần điều tra renderer/GPU riêng, không coi redflag frame-tail đã đóng.

Lưu ý công cụ: trong raw `settled-profile`, nhãn pha được dùng trước và sau warm nên thống kê frame tổng/max có thể chứa frameinput cũ. **Chỉ dùng `tail10s`/cửa sổ sau phase-start cho steady comparison ở trên**; input được ghi riêng. Harness hiện lọc thêm timestamp cho lần tái chạy tương lai. Dữ liệu gốc không bị sửa để tạo kết quả đẹp.

## Hồi quy và production

- Nhóm trọng điểm9file: **38PASS, 0FAIL, 3skip**; AppTS/testTSPASS; buildPASS.
- Lượt full đầu:204file, **1355PASS/1FAIL/19skip**. Lỗi duy nhất là testB7 đếm riêng thẻIMG trong một fixtureNode chưa load atlas; canvas mới hiển thị đúng nhưng sốIMG=0.
- Sửa test theo hợp đồng mới, không bỏ kiểm tra icon: nhậnIMG cósrc hoặccanvas códata-item trỏ đúng sprite thật và có đúng kích thước gốc; canvas trống/IDkhông tồn tại không được qua. Đã có browserRGBA độc lập ở trên. NhómB7+icon3file/17testPASS.
- Kiểm tra bổ sung bắt được trường hợp valid16px→unknown16px giữ lại pixel cũ vì backing size không thay đổi. Đã chuyển clearRect lên trước null-source guard, tái hiệnRED→GREEN bằng browser thật (`unknown-transition-red.json` / `pixels.json`). Không thay đường copy của sprite hợp lệ đã đoABBA; benchmark hash là bản trước null-guard, manifestproduction-final ghi hash cuối.
- **Rerun toàn bộ từweb/, maxWorkers2, timeout120s:204file, 1356PASS, 0FAIL, 19skip.** Gồm2characterizationinput từ lượt audit trước và4testcanvasUI mới. Không cộng focused vào full. Raw cả lượt đỏ, lượt xanh trước null-guard và lượt full xanh cuối sau null-guard đều lưu.
- Production ordinary controls: hồ sơ mới→Inventory→Save&quit→**tiến trìnhChromium mới**→Continue đạt `PASS_TECHNICAL_SMOKE_ONLY`, `qaUsed=false`, `errors=[]`.
- Production bản cuối mởInventory đếnDOM **244ms** trong lượt này,91ảnhatlas+2canvasfallback. Đây là một smoke trên softwareGPU, không benchmark phầncứng hay cam kết mọi máy244ms.
- HTML SHA256: `f3016b94c47c0c3026af59a9f1c9349c2f00eb24acca0661e25dcb85cda6043c`. Seed2009464091, layout`veyra05-at-1984-768`, digest4cf53d3d, vịtrí1400/2152 được giữ qua save/continue.

## Bằng chứng

- `profile.json`: ABBA30s, giữ cả first-phase tails bất lợi.
- `settled-profile.json`: ABBA làm nóng theo frame, geometry và timestamp caveat.
- `pixels.json`:286RGBA+React lifecycle+atlas priority.
- `focused.json.gz`, `final-focused.json.gz`.
- `full-first-img-assumption.json.gz`, `full-final.json.gz` (trước null-guard), `full-final-null-guard.json.gz` (toàn bộ cuối cùng), `null-final-focused.json.gz`.
- `production-final/manifest.json` và ảnh640×360 (bản cuối, mở244ms). `production/` giữ smoke trung gian224ms. Hash nguồn workingtree ghi trong manifest; HEAD là base53c1688, không giả vờ base đã chứa sửa đổi.

**Luật giữ chuột khi ô đang chọn nhậnfiber chưa thay đổi.** Không đánh giá trải nghiệm, mục tiêu người chơi, độ vui hay tạo tuyến chơi bắtbuộc. Không chứng nhận native, physicalGPU,336h/endurance hay fullrelease.


### Xác minh lại bản cuối

Đã kiểm tra lại trên Vite sạch5191:286/286RGBAkhớp,0encode,20rerender0copy, thaynguồn/unknownclear/unmount/atlaspriority đều đạt (`verification-pixels.json`). Chạy lại4file22testPASS0FAIL (canvasUI, B7, inputcharacterization vàdropcache), AppTS/testTSPASS (`verification-focused.json.gz`). SHA256 của toàn bộ6fileUI/CSS vàengine hiện tại khớp manifestproduction-final; HTMLdist cũng khớpSHAf3016… nêu trên. Không thay production sau fullgate cuối, không cộng focused22 vào tổng1356; không mở rộng tuyên bố hiệu năng.
