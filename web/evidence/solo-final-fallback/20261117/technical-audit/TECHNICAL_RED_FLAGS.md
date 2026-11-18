# Kiểm tra kỹ thuật & red flag — 17/11/2026

**Phạm vi theo yêu cầu:** tìm lỗi và rủi ro kỹ thuật, không kiểm tra/chấm experience, độ vui, lộ trình hay lựa chọn của người chơi. Không thay đổi luật điều khiển hoặc production trong lượt audit này. Bản sửa cache loot từ lượt trước được giữ nguyên.

## Cập nhật sau khi được phép xử lý

Đã bỏ đường PNG đồng bộ bằng canvasUI (không đổi luậtinput), pixel286/286khớp, fullcuối204file/1356PASS/0FAIL/19skip. [Kết quả và số đo cả thuận lẫn bất lợi](../ui-canvas/RESULT.md). Redflag treoPNG được xử lý hẹp; frame-tail GPUphầnmềm và chính sách giữchuột vẫn mở. Nội dung audit bên dưới là phát hiện **trước bản sửaUI**, không phải toàn bộ trạng thái hiện tại.

## Tóm tắt

Không phát hiện mất/nhân vật liệu hoặc hỏng bản lưu trong các ca mới đã chạy. **Có hai red flag runtime cần xử lý/thảo luận và một sai sót công cụ đo đã sửa.** Không phải chứng nhận toàn game không còn lỗi.

| Mức | Phát hiện | Đề xuất |
|---|---|---|
| Cao — hiệu năng, đã tái hiện trong môi trường đo | Mở Inventory lần đầu chặn luồng chính **22,05–23,93 giây** trong `canvas.toDataURL`; mỗi cảnh có một long task tương ứng22,16–24,04 giây. | Ưu tiên loại bỏ PNG encoding đồng bộ khỏi đường mở UI cho icon dự phòng/thủ tục; phải giữ pixel và đối chứng cold + sustained. Không tự nhận lại phương án bake đã bị loại trước đây. |
| Cần xác nhận quy tắc input, không tự sửa | Giữ LMB thu hoạch bằng tay dừng khi fiber vừa nhặt lấp ô đang chọn: grass còn1stock/1HP sau5,5s giữ chuột; nhấp mới thì thu hoạch tiếp bình thường. | Xác nhận liệu **giữ chuột phải tiếp tục đánh tay khi ô đang chọn chứa vật liệu**, hay cố ý yêu cầu nhấp mới. Đây là khác biệt hợp đồng input theo trạng thái ô, không phải đánh giá experience. |
| Công cụ/bằng chứng — đã khắc phục | Harness dev cũ gắn nhãn map theo cấu hình, không assert `RunState.layoutId`; Vite HMR tạo hai instance module world khác URL. | Không dùng số cũ làm bằng chứng Veyra. Server sạch + assert map thật + ABBA mới đã chạy đạt. Sửa/đính chính tài liệu thay vì giữ nhãn sai. |

### 1. Chặn luồng khi mở túi: xác nhận đến đâu?

Hai fixture nguồn thật ở `veyra05-at-1920-512` seed901 và `veyra05-at-1840-1526` seed902. Sau phần mouse thu hoạch thật, mở Inventory bằng phímI bình thường:

- Scene1: một encode **22.052,2ms**, longtask **22.162ms**.
- Scene2: một encode **23.932,1ms**, longtask **24.041ms**.
- Các encode khi harvest chỉ tối đa0,3–0,4ms; serialize snapshot đo được tối đa13,9ms trong các pha này. Không có cơ sở đổ lần treo22giây cho autosave.
- `ui/common.tsx` vẫn có nhánh `drawnIconUrl → canvas.toDataURL()` cho art thủ tục/công trình, trong khi atlas đã dùng cell đọcCPU. Timing hiện tại xác định được API chặn, **chưa gắn nhãn chính xác từng icon gây flush**.
- Đây là Chromium headless, dev build có wrapper đo thời gian, GPU phần mềm SwiftShader. Không được nói mọi máy thật sẽ treo24giây hay công bố FPS production từ đây.
- Còn đuôi frame khi harvest: p95≈633/833ms trong hai cảnh; tick p95≈51/54ms, draw p95≈9,9/9,6ms. Không thể cộng những phân vị khác nhau để giải thích toàn bộ frame; chưa tách hết raster/GPU/VFX/scheduling. Đây là tín hiệu điều tra tiếp, không phải chứng minh tất cả do icon.

### 2. Input thay đổi khi tự nhặt vào ô đang chọn

Scene grass dùng ô trống đã chọn trong snapshot fixture, không cấp tool/vật liệu. Sau5,5s giữ chuột:

- Stock2→1, HP3→1, đã nhặt1fiber vào ô đang chọn.
- Không có crash, hết stamina hay kẻ thù làm gián đoạn.
- Nhấp LMB lại hoàn thành nguồn; tổng2fiber bảo toàn, nguồn không sinh thêm yield khi bấm tiếp sau cạn.
- Nguồn bush ở cảnh kia hoàn thành3stock khi giữ chuột, cho thấy không phải mọi loại pickup có hành vi giống nhau.
- `sim.ts` hiện cố ý có nhánh vật liệu/kit/misc không damage chỉ tạo swing khi `attackPressed`, trong khi tay không ô trống chấp nhận cả `attack` giữ. Vì thế chưa tự coi đó là lỗi cần đổi luật; cần chủ dự án xác nhận ý định.
- Test characterization mới ghi đúng hành vi hiện tại, **không coi xanh là đã sửa**: `held-harvest-input-characterization.test.ts`2PASS, ô trống giữchuột→swing, ôfiber giữchuột→khôngaction, nhấpmới→swing.

### 3. Đính chính phép đo loot trước đây

Phép đo trước ghi `layout:veyra05-at-1920-512` bằng hằng cấu hình, nhưng chưa kiểm tra trạng thái thực. Audit tái hiện receipt `shipping_fresh`. Trên server cũ5173, engine import `/src/game/world.ts?t=1794912088621`; fixture import `/src/game/world.ts` không query. Hai URL tạo hai instance world, nên đổi layout của fixture không đổi world mà engine đang dùng.

- Số cũ78–86ms→0,9–1ms được giữ nguyên dữ liệu trong `../loot-pickup-profile.json` kèm `auditCorrection`, nhưng **rút nhãn bằng chứng Veyra**. Chẩn đoán cache vẫn được unit test chứng minh; không lấy sự đúng đó để bỏ qua lỗi provenance.
- Khởi động Vite sạch5180, kiểm tra `setActiveLayout` trảtrue, assert `run.layoutId` ngay saustart, ghi `actualLayout` trong từng pha. Không chỉnh production để phục vụ harness.
- Rerun serial **old/current/current/old**, cùng mapVeyra thật, seed901, mỗi mức12lượt:

| Món/lượt | Tick median cũ / hai lượt (ms) | Tick median mới / hai lượt (ms) | Truy vấn grid kế tiếp median cũ → mới (ms) |
|---|---:|---:|---:|
| 1 | 0,4 / 0,4 | 0,4 / 0,3 | 27 / 29 →0 /0 |
| 8 | 223 / 222,9 | 0,3 / 0,3 | 32,1 /31,6 →0 /0 |
| 32 | 921 /1.068,1 | 1,1 /1,0 | 29,4 /33,9 →0 /0 |

Với32món×12lượt: **384 grid rebuild cũ →0 mới**. Bản cũ rebuild ngay trong các kiểm tra nhặt tiếp và còn phải rebuild sautick; bản mới không. Trạng thái cuối **khớp SHA256 cả4biến thể cho từng mức**, số vật liệu và custody sau serialize/reload đúng. Đây là stress fixture, không phải lời hứa tăngFPS1000lần hay benchmark farm tự nhiên.

Raw: `loot-pickup-verified-layout.json`; thay thế nhãn Veyra của báo cáo cũ. Harness đã thêm precondition để từ chối kết quả sai map thay vì âm thầm xuấtPASS.

## Những ca đã qua

### Điều khiển → thu hoạch → đồ rơi → nhặt → Inventory → lưu → mở lại

Hai cửa sổ Veyra thật nêu trên. Snapshot fixture chỉ đặt người chơi cạnh một nguồn hiện hữu và chọn ô trống; không sửa địa hình/nguồn hoặc cấp tài nguyên. Sau đó dùng mouse/phím/UI thật.

- Bush3stock: bảo toàn3berries; grass2stock: bảo toàn2fiber, kể cả phần tự dừng giữchuột rồi nhấpmới.
- Sau cạn, bấm tiếp không sinh thêm harvest/yield.
- Lưu và mở bằng context trình duyệt mới với localStorage thật: source vẫn cạn, custody giống chính xác bản đã lưu; `qaUsed=false`.
- Cả hai cảnh `pageerror=[]`, HTTP lỗi tài nguyên=[] trong phiên instrumented.
- Driver từng timeout do Return Chronicle che điểm click, không phải game không nhận input: đã quan sát `elementFromPoint`, đóng panel bằng nútUI rồi chạy lại. Các lần lỗi driver không được cộngPASS. Cảnh1 giữ dữ liệu từ lượt đã hoàn tất; cảnh2 là lượt rerun đã đóng panel. Chi tiết trong raw, không giả vờ đó là một lượt liền mạch.

Raw: `harvest-ui.json`, script `e2e/solo-harvest-technical-audit.mjs`.

### Storage fault/recovery: 6/6

Browser thật, mapVeyra được assert, mỗi ca context riêng. Hook gây lỗi chỉ trong test. Mỗi ca reload trang thật và kiểm lại vật liệu + `validate`:

1. Hai save chồng nhau: khôi phục revision/vật liệu mới nhất.
2. localStorage quota: IndexedDB lưu và khôi phục bản mới.
3. IndexedDB put lỗi: localStorage lưu và khôi phục bản mới.
4. Cả hai nơi ghi lỗi: báo khôngsaveđược; bản tốt trước đó giữ nguyên, khôi phục đúng bản trước. **Không khẳng định tiến độ chưa lưu vẫn tồn tại sau reload.**
5. UIDtrùng cố ý: từ chối trước mọiwrite, giữ bản tốt, phân loại `duplicate-uid`.
6. localStorage readbackmismatch: có báo trạng thái conflict, IndexedDB vẫn giữ bản mới đúng.

Raw: `storage-faults.json`, script `e2e/solo-storage-fault-audit.mjs`. Không chứng nhận máy bị tắt nguồn giữa transaction, nhiều tab cùng chơi hay cloud sync.

### Hồi quy mã nguồn

- Lượt audit này: **5file/20testPASS, 0FAIL**, AppTS/testTSPASS, raw `focused.json.gz`. Có2testcharacterization input mới, không sửa production.
- Fullsuite gần nhất tại thời điểm audit, từ lượt sửa cache trước: **202file/1350PASS/0FAIL/19skip**. Không chạy lại toàn bộ sau khi thêm2testcharacterization; không tự nâng tổng thành1352.
- Production smoke/build trước đó vẫn là bằng chứng riêng trong `../production-loot-cache/`; các timing audit mới là dev/instrumented, không gắn nhãn production.

## Quyết định cần bàn

1. **Ưu tiên kỹ thuật đề xuất:** chặn22–24giây khi mã hóa icon dự phòng lúc mởInventory. Có thể nghiên cứu bỏ công việc đồng bộ mà không đổi ảnh/luật; chỉ nhận phương án có đối chứng không làm xấu sustained tails.
2. **Cần bạn xác nhận luật input:** ô đang chọn vừa nhận vật liệu thì giữLMB có tiếp tục thu hoạch tay không hay phải nhấp lại? Chưa thay hành vi trước quyết định.
3. Chưa có kết luận experience, mục tiêu của người chơi, vui/khó hay tuyến chơi; những việc đó nằm ngoài audit này theo yêu cầu.
