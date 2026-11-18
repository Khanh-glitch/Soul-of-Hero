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

## Cập nhật lượt sau (tối ưu lưới va chạm): red flag spawn ở hai cửa sổ hazard — đã phân loại, KHÔNG phải hồi quy

Trong harness đối chứng lưới va chạm, `veyra05-slag` và `veyra05-cinder` trả về `"No safe, resource-accessible spawn in this region."` với **mọi seed** thử, trong khi `veyra05-greywater` vào run bình thường. Hai bước đã làm:

1. **Loại trừ hồi quy**: `startRun` của engine HEAD (`53c1688`) và engine đã vá cho kết quả **giống hệt nhau 24/24 lần thử** (4 layout × 6 seed: ok, lý do, `layoutId` thực tế, tọa độ, `sourceLayoutVersion`) — `../frame-work/spawn-start-parity.json`. Hai cửa sổ này thất bại **cùng một lý do ở cả hai bản**, nên không phải do lượt tối ưu.
2. **Audit nguyên nhân, read-only**: `src/veyra05/hazard-window-spawn.audit.test.ts`, chạy opt-in `SOH_HAZARD_SPAWN_AUDIT=1`. Không đổi map, không đổi stock, không đổi spawn contract. Raw `../../../veyra-hazard-spawn-audit/manifest.json`. Predicate từng ứng viên là **bản sao có truy vết** của `chooseLegalSpawn` trong `engine.ts` (ô safe → neighbourhood 3×3 → prefilter `spawnEligible` → BFS 30 bước đòi wood + stone + food + freshwater + ≥9 build site), và bản sao đó **được kiểm chứng chống lại chính engine**: cửa sổ nào trace tìm ra ứng viên đạt trọn mà `startRun` lại thất bại (hoặc ngược lại) thì audit đỏ.

| Cửa sổ | biome authored | `firstHour` | mainland gate | ô freshwater | ô `spawnEligible` | ô safe | safe 3×3 | ứng viên đạt trọn | start thường | Gate từ chối |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| veyra05-slag | toxic flats (hazard) | false | **cho phép** | **0** | **0** | 0 | 0 | 0 | **0/8 seed** | `freshwaterPrefilter` |
| veyra05-cinder | volcanic ash (hazard) | false | **veto (offshore)** | 245 | 10 | 7 | **0** | 0 | **0/8 seed** | `safe3x3Neighbourhood` |
| veyra05-greywater (control) | temperate meadow / lakeshore | true | cho phép | 16.347 | 1.837 | 1.389 | 826 | **737**/800 traced | **8/8 seed** | không (trace khớp engine) |

Nguồn trong cửa sổ (giải thích vì sao nới gate trước cũng chưa đủ): slag có `wood 0` (chỉ 429 `deadtree`), `food 0`, `stone 963`; cinder `wood 13`, `food 6`, `stone 575`; control `wood 1.776`, `food 564`, `stone 140`.

### Phân loại

1. **Không phải lỗi người chơi đối mặt.** Title chỉ offer `veyra05-world` (mặc định) và `shipping`; cả hai scene hazard có `firstHour: false` và **không nằm trong `VEYRA_SPAWN_LAYOUTS`**, nên không tồn tại đường chơi nào yêu cầu legal spawn ở đó.
2. **Là giới hạn của đường vào QA/harness.** Cả hai cửa sổ vẫn vào được bằng QA inspection landing (`inspectAt`) — audit xác nhận `ok: true` ở cả ba cửa sổ, kèm `qaUsed: true`. Nghĩa là các test luật đang mount sanctuary/POI trong cinder (ví dụ R2-CLOSURE-2 với Surtur) vào bằng **đường QA**, và bằng chứng đó **không phải** bằng chứng người chơi tới được.
3. **Cơ chế khớp đúng nội dung authored.** Slag Flats là bãi độc **không có một ô nước ngọt nào** trong cửa sổ, mà prefilter `spawnEligible` đòi khoảng cách freshwater 10–42 → `spawnEligible.fill(0)` → không tồn tại ứng viên. Cinder Isle là **đảo** núi lửa: mainland gate veto nó khỏi random start (đúng dòng chữ Title "offshore starts await proven sea transport"), và 7 ô safe còn lại đều **cô lập** (hàng xóm là ash/cliff/toxic/nước) nên không có neighbourhood 3×3 nào.
4. **Sai sót công cụ của chính audit này, đã sửa và ghi lại.** Bản đầu ghi boolean của `unverifiedOffshoreExcluded` dưới tên `offshoreExcludedAsRandomStart` — **ngược polarity**. Đọc nguồn và caller: hàm trả `true` khi ô nằm **trong** polygon mainland và không thuộc hole nước, còn `chooseGlobalVeyraStart` viết `if(!unverifiedOffshoreExcluded(...))continue;` → `true` nghĩa là mainland gate **cho phép**. Field đã đổi tên thành `mainlandGateAllowsRandomStart` kèm ghi chú polarity, và có assertion chốt (slag `true`, cinder `false`). Bằng chứng cho việc đổi tên là cần thiết: greywater cũng `true`, nên với nhãn cũ thì cả control lẫn hazard đều "bị loại offshore" và field vô nghĩa.

### Chưa chạy / không tuyên bố

- **Chưa chứng minh** người chơi từ một legal start có thể **đi bộ** tới hai vùng này trong world liên tục (global travel reachability: `NOT_RUN` trong manifest). Cả hai cửa sổ có đất đi được (slag 39.927 ô walkable / 40.000, cinder 33.437) và focus nằm trong frame, nhưng "nội dung tồn tại" ≠ "tới được".
- Không kết luận đây là design mong muốn hay cần nới. Audit chỉ đo và phân loại; **không** tự đổi spawn contract, hazard rule hay offshore policy.
- Một phiên audit, ba cửa sổ, 8 seed, ngân sách trace 800 ứng viên (control bị `budgetExhausted: true` — tức còn nhiều ứng viên đạt trọn chưa trace hết, không ảnh hưởng kết luận vì chỉ cần >0).

### Câu hỏi cần Creator quyết (bổ sung mục "Quyết định cần bàn")

4. **Đường vào hai vùng hazard:** giữ nguyên như hiện nay (Slag Flats/Cinder Isle chỉ tới được bằng di chuyển trong world liên tục, và Cinder chờ sea transport thật được chứng nhận), hay cần một đường vào thường được kiểm soát trước khi nghiệm thu POI/elder ở đó? Nếu giữ nguyên, các bằng chứng luật ở hai vùng này phải luôn ghi rõ là **vào bằng QA landing (`qaUsed: true`)**, không phải đường chơi thường.
