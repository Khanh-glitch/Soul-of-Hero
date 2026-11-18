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

## Cập nhật lượt sau (đi bộ toàn frame): trả lời câu hỏi #4 bằng số đo, kèm HAI red flag mới

Câu hỏi để mở của lượt trước — "người chơi từ một legal start có **đi bộ** tới được Slag Flats / Cinder Isle không?" (`NOT_RUN`) — nay đã đo read-only bằng `src/veyra05/global-foot-reachability.audit.test.ts` (opt-in `SOH_FOOT_REACHABILITY=1`, raw `../../../veyra-foot-reachability/manifest.json`, 476 s). Không đổi map, không đổi luật, không đổi spawn contract; thay đổi dữ liệu duy nhất là dòng `purple_card` trong `final-item-ledger.ts` theo đúng quyết định của Creator ("update the ledger note to match runtime").

### Cách đo (để số liệu không bị đọc quá tay)

- **Start là đường chơi thật**: `startRun(gs,'female',EPOCH,null,seed)` trên layout mặc định của Title `veyra05-world` → `chooseGlobalVeyraStart`. Seed 901 vào cửa sổ `veyra05-at-2560-704`, ô toàn cục `(2568,716)`, `qaUsed: false`. Ba seed 901/902/903 đều **cùng một thành phần liên thông** (cách nhau 0 / 1240 / 61 ô), nên kết luận không phải của riêng một seed.
- **Lattice là lattice thật của game**: `continuity.ts` trượt cửa sổ 200×200 theo bước `SLIDE_STEP = 64` khi người chơi vào within `EDGE_MARGIN = 24` ô của mép, origin clamp trong frame. Audit đọc hai hằng số đó ra từ chính source text (đổi là audit đỏ), và **gọi thật** `maybeSlideVeyraWindow`: origin `(2560,704) → (2496,640)` (−64,−64), `playerGlobalTile` delta `(0,0)`, `layoutId` thành `veyra05-at-2496-640`.
- **Mosaic 2460 cửa sổ** phủ 100% frame 4000×2800 (11.200.000 ô), stride 64 = đúng bước trượt. Mỗi ô đọc qua `blockGrid` của một run thật trong cửa sổ phủ nó; ô nào nhiều cửa sổ phủ thì giữ **đọc từ cửa sổ mà ô nằm sâu nhất** (xa mép nhất). 1055 cửa sổ **không compile được** (`No walkable terrain in this Veyra U=0.5 window` — lát toàn nước, đúng lý do `chooseGlobalVeyraStart` cũng try/catch) → 4.076.416 ô bị đánh dấu **không đi được** (bảo thủ, không bao giờ tự cho là đi được).
- **Predicate đi bộ = chính luật di chuyển của engine**: `blockedAt(r,x,y) === (class ∈ {1,2,3,5,6})`, đối chiếu runtime trên 37.636 ô → **0 lệch**; `class 4` (shallow/river) **không** bị chặn, tức lội nước là di chuyển hợp lệ. Ba biến thể: `foot` (class 0 hoặc 4 — đúng predicate `spawnWindowExitReachMask` của engine), `dry` (class 0 và tile không phải DEEP/SHALLOW/RIVER), `footDoors` (foot cộng ô class 3 là cửa POI thật — người chơi mở được cửa).
- **Mọi tuyến đều tính hai cận**: `optimistic` (ô đi được nếu **bất kỳ** cửa sổ nào phủ nó nói vậy) và `conservative` (chỉ khi **mọi** cửa sổ phủ nó đều nói vậy). Lý do có hai cận nằm ở red flag mới ngay bên dưới.

### Red flag MỚI #1 — cùng một ô toàn cục compile ra nội dung KHÁC nhau tuỳ cửa sổ (chưa từng đo được trước đây)

Đây chính là câu hỏi "chưa so sánh được ô-theo-ô" treo từ các lượt trước. Đã so sánh: **49.076.416 cặp đọc chồng lấn → 59.320 lệch class = 0,1209%**. Kiểm chứng độc lập trên 6 cặp cửa sổ neighbour thật theo stride 64 (163.200 ô, overlap đầy đủ 136 ô): 240 lệch = 0,1471%.

| lệch theo khoảng cách tới mép cửa sổ | 0–2 | 3–7 | 8–23 | 24–63 | 64+ |
|---|---:|---:|---:|---:|---:|
| số ô | 7.698 | 11.160 | 21.980 | 17.446 | 1.036 |

→ **Không phải artefact mép cửa sổ**: ô nằm sâu 64+ ô trong hai cửa sổ vẫn compile khác nhau. Thành phần lệch: `class 2 ↔ 0` = **56.922 (96%)** — một **source chắn đường** có trong compile này, không có trong compile kia; `class 1 ↔ 0` = 2.212 — **tường POI** chỉ có ở một compile; `class 3 ↔ 0/2` = 110, và ~110 đó là **entity G1B của chính harness** (mỗi run chỉ deploy fixture trong cửa sổ của nó) — hiệu ứng tự gây, đã định lượng, không phải worldgen. Terrain hai bên hầu như **giống nhau** (`floor↔floor` 21.093, `forest↔forest` 13.819, `snow↔snow` 6.734, `hill↔hill` 4.001): nghĩa là **nội dung được đặt** (source, prop, tường) khác nhau, không phải địa hình.

Hệ quả thực tế cho người chơi: đi lại đúng một ô đó theo hai hướng khác nhau có thể gặp/không gặp một cây, một tảng đá hoặc một bức tường. Audit **không tự sửa** (đây là worldgen law); nó **chặn hệ quả** bằng hai cận optimistic/conservative ở trên, và chốt bằng assertion rằng các tuyến kết luận không phụ thuộc ô contested.

### Red flag MỚI #2 — test obtainability không nhìn thấy loot fixture G1B

`tests/final-item-set.test.ts` dựng tập "lấy được" (`have`) từ `SOURCES.yields/bonus` + `CREATURES.drops` + `GARDEN_CROPS.output` + bao đóng `RECIPES`. Loot fixture G1B (`g1bEnsureSources`) **không thuộc bất kỳ nguồn nào trong đó**, nên assertion "`purple_card` must not be issued while blocked" vẫn **xanh** trong khi engine **có** phát thẻ này trong world; và vì `purple_card ∈ NEW_IDS`, dòng "nếu status ≠ BLOCKED thì `have.has(id)` phải đúng" **khoá cứng** status của cả ba thẻ ở `BLOCKED`. Muốn nâng status thẻ thì phải dạy test đó biết về fixture deployment trước — đây là thay đổi phạm vi tuyên bố, **chưa làm**, chỉ ghi lại.

### Kết quả đi bộ (từ legal start seed 901; optimistic, và conservative khớp về kết luận)

| Đích | foot | dry | ô gần nhất tới đích | tuyến (ô) | AU | slide cửa sổ | ô lội | ô hazard trên tuyến |
|---|---|---|---|---:|---:|---:|---:|---:|
| `veyra.g1b:card:purple` (2402,1843) | **tới được** | **KHÔNG** | cách 1 ô (2403,1844) | 1.317 | 658,5 | 19 | **19** | 0 |
| `po_slag` (2380,1872) | tới được | KHÔNG | cách 1 ô | 1.342 | 671 | 19 | 19 | 20 |
| focus `veyra05-slag` (2350,1990) | tới được (đúng ô focus) | KHÔNG | 0 ô | 1.492 | 746 | 21 | 19 | **163 toxic** |
| `veyra.g1b:gate:po_archive:room_purple` (2047,443) | tới được | **tới được** | cách 1 ô | 792 (dry 802) | 396 | 11 | 92 (dry 0) | 0 |
| `veyra.g1b:gate:po_archive:deep` (2035,443) | tới được | **tới được** | cách 1 ô | 804 (dry 814) | 402 | 11 | 92 (dry 0) | 0 |
| `po_archive` (2036,452) | tới được | tới được | 0 ô | 796 | 398 | 11 | 92 | 0 |
| `veyra.g1b:card:green` (1390,613) | tới được | tới được | cách 1 ô | 1.279 (dry 1.475) | 640 | 19 | 98 (dry 0) | 0 |
| `veyra.g1b:card:blue` (1408,989) | tới được | tới được | 0 ô | 1.433 (dry 2.269) | 717 | 20 | 198 (dry 0) | 0 |
| focus `veyra05-cinder` (3400,1730) | **KHÔNG** | KHÔNG | — | — | — | — | — | — |
| `po_surtur` (3388,1652) | **KHÔNG** | KHÔNG | — | — | — | — | — | — |
| `po_obsq` (3300,1552) | **KHÔNG** | KHÔNG | — | — | — | — | — | — |
| focus `veyra05-greywater` (control) | tới được | tới được | 0 ô | 1.372 | 686 | 20 | 61 | 0 |

Thành phần liên thông của legal start: foot **2.997.383 ô = 26,76%** frame (conservative 2.967.698 = 26,50%), trong đó **35.096 ô hazard** và **118.538 ô lội**; dry 2.280.771 ô = 20,36%. Không ô `class 9` (cửa sổ không compile được) nào lọt vào thành phần → cận bảo thủ thật sự bảo thủ.

### Trả lời câu hỏi #4 (đã đo, không còn là giả định)

1. **"Không start được" ≠ "không tới được" — với Slag Flats thì đúng là tới được.** Focus Slag Flats đi bộ tới được từ legal start (1.492 ô, 21 lần trượt cửa sổ), và purple card case cũng vậy (cách 1 ô). Nhưng **chỉ bằng đường lội**: mọi tuyến tới thẻ tím và tới po_slag đều đi qua **19 ô shallow**, và **không có** tuyến dry nào (cả hai cận). Tuyến ngắn nhất tìm được đi qua **0 ô hazard**, nhưng tuyến vào đúng focus bãi độc thì ăn **163 ô toxic** — tức hazard exposure là thật, chỉ là tuỳ đường.
2. **Cinder Isle thì KHÔNG tới được bằng đường bộ**, ở cả ba predicate × hai cận: `po_surtur`, `po_obsq` và focus cinder đều ngoài thành phần liên thông. Khớp đúng veto offshore trong `chooseGlobalVeyraStart` ("Until a real vehicle/ferry/evac and return route passes, no offshore landmass may become a random starting destination"). Vậy luật test mount Surtur bằng QA landing vẫn **không** phải bằng chứng người chơi tới được — và lần này là **đã chứng minh không tới được bằng chân**, chứ không chỉ "chưa biết".
3. **Thẻ tím là thẻ duy nhất cần lội.** Green và blue đều dry-reachable; purple thì không. Nếu đây không phải chủ ý (một lối vào ướt cho vùng bãi độc), nó là một điểm cần Creator xác nhận.
4. **Chuỗi purple khép lại về mặt hình học ở cả hai đầu**: thẻ tới được (1.317 ô, lội) và **hai cửa khoá tím ở po_archive cũng tới được** (792–814 ô, có cả tuyến dry, 11 lần trượt cửa sổ). Kiểm tra runtime trong run QA-entered: cả ba case là entity `loot` floor 0, `g1bState: opened`, slot 0 đúng thẻ ×1, và `findInteract` thật trả về `kind 'g1b:card'`, label **"Open access-card case"**, `clearInteraction: true` từ ô đứng kề; cả hai gate tím resolve qua `g1bGateOf` trên door entity thật (card `purple`, power `veyra.g1b:gen:po_archive`, `ppe: true`).
5. **Vì vậy `final-item-ledger.ts` đã được sửa đúng một dòng** (`purple_card`) theo quyết định của Creator: text cũ "no source and no door on any map" mâu thuẫn với engine đang ship. `grade` **giữ `INDIRECT`** vì đó là field provenance của Last Island, không có fact LI nào thay đổi; status **vẫn `BLOCKED`** vì lý do cơ học ở red flag #2. Hai dòng `green_card`/`blue_card` mang cùng tuyên bố cũ nhưng **không được sửa** vì ngoài phạm vi cho phép — chỉ ghi chú cạnh đó và nêu ở đây.

### Không tuyên bố

- **Chỉ là hình học.** Tuyến tới được chứng minh đồ thị va chạm nối hai ô; **không** chứng minh sống sót: không mô hình hunger/thirst/warmth/radiation, không sát thương TOXIC/ASH/LAVA, không creature, không stamina, không đồng hồ 14 ngày, không vehicle/ferry, không nhiên liệu. Ước lượng ~270–293 s đi bộ là **số học** từ `BAL.player.speed = 72 px/s` trên tuyến ngắn nhất (không slowdown khi lội, không rẽ, không nghỉ).
- Đồ thị vô hướng nên về mặt hình học **đường về là cùng đường đó**, nhưng "về được" ≠ "sống sót về được".
- Mosaic đọc cửa sổ **pristine** (không delta của run). Đi bộ thật sẽ ghi delta (cạn nguồn, sửa terrain, mở cửa, fog) — chưa đánh giá.
- Các cửa sổ trong mosaic vào bằng **QA landing** chỉ để có `blockGrid` thật; `qaUsed: true` không bao giờ là bằng chứng chơi được. Fact đường chơi duy nhất là legal start.
- Một phiên, một seed chính (901) cho BFS, ba seed cho start; môi trường test software-rendered, không phải release readiness.

### Câu hỏi cần Creator quyết (bổ sung)

5. **Cinder Isle / Surtur không có đường bộ.** Giữ nguyên (đảo chờ sea transport/vehicle thật được chứng nhận, và elder site ở đó chưa phải nội dung người chơi với tới) hay cần một tuyến đất/cầu/evac trước khi nghiệm thu POI/elder vùng này? `po_obsq` (Obsidian Quarry — một điểm tài nguyên) cũng cùng tình trạng.
6. **Nội dung phụ thuộc cửa sổ (0,1209% ô chồng lấn, 96% là source chắn đường, phần còn lại là tường POI).** Chấp nhận như đặc tính của streaming (và các tuyên bố reachability phải luôn kèm hai cận optimistic/conservative như audit này), hay yêu cầu một ô toàn cục phải compile ra **một** kết quả duy nhất bất kể cửa sổ nào phủ nó? Nếu chọn hướng sau, đây là việc worldgen cần giao riêng, không phải tối ưu hiệu năng.
7. **Thẻ tím bắt buộc lội** (19 ô shallow, không có tuyến dry) trong khi green/blue đều có tuyến khô. Đó là chủ ý thiết kế cho vùng bãi độc, hay cần một lối khô?

## Cập nhật lượt sau (chẩn đoán worldgen READ-ONLY): red flag #1 quy về 5 pass window-relative, kèm phương án và chi phí/rủi ro

Creator đã quyết (`diagnose-worldgen`): cho phép **chẩn đoán read-only** — chỉ ra đúng pass placement nào phụ thuộc cửa sổ, định lượng theo vùng, và **viết phương án kèm chi phí/rủi ro để duyệt TRƯỚC khi sửa**. Lượt này làm đúng phạm vi đó: **không đổi một dòng worldgen/engine/map/luật nào**. File mới duy nhất là harness opt-in `src/veyra05/window-content-origin-dependence.audit.test.ts` (`SOH_WINDOW_ORIGIN_DEPENDENCE=1`), raw `../../../veyra-window-origin-dependence/manifest.json`, schema `veyra-window-content-origin-dependence-v1`.

Repro (header file có ghi cùng lệnh):

```
cd web && SOH_WINDOW_ORIGIN_DEPENDENCE=1 SOH_WOD_SEEDS=901,902,903 SOH_WOD_PAIRS=150 SOH_WOD_EXAMPLES=10 \
  npx vitest run --fileParallelism=false --testTimeout=1400000 src/veyra05/window-content-origin-dependence.audit.test.ts
```

150 cặp cửa sổ neighbour theo **đúng stride trượt thật** (`SLIDE_STEP = 64`) × 3 seed, phân tầng: mọi scene focus trong `VEYRA05_SCENES` (cả trục x và y), purple card (2402,1843), cửa tím `po_archive` (2047,443), `po_surtur` (3388,1652), cộng dải ngẫu nhiên có chủ đích (LCG) phủ khắp frame. Đọc được **113 cặp**; **37 cặp bị loại** vì **cả hai** cửa sổ không compile được (`No walkable terrain in this Veyra U=0.5 window` — lát toàn nước, đúng lý do đã ghi ở lượt trước, không phải lỗi harness). So sánh **3.073.600 ô chồng lấn** → **8.931 ô lệch = 0,2906%**, trong đó **5.504 ô (61,63%) đổi cả khả năng đi qua**. 56,96 s. Cả hai `tsc -p tsconfig.json` và `tsc -p tsconfig.test.json` exit 0.

### Cách quy nguyên nhân, và hai cái bẫy đã tránh

- **Mỗi ô lệch phải rơi vào đúng MỘT nguyên nhân có tên**; `UNCLASSIFIED` bị assert = 0. Kết quả: 0.
- **Bẫy 1 — `floors.ground` KHÔNG phải một tầng độc lập.** `buildFloorStack` level 0 copy `base.tiles` (`floors.ts:453`) và `base.sourceV3` (`floors.ts:458`), rồi `resetWindowToGround` copy ngược lại thế giới (`window.ts:497`, `:501`). Nên so "world vs ground" là **so một giá trị với chính nó** — bản nháp đầu tiên của audit này đã suy diễn sai rằng "tầng ground cũng lệch ⇒ `floors.ts` window-relative". Audit nay **assert** đẳng thức snapshot đó (`groundIsWorldSnapshot`) và không dùng nó làm bằng chứng nữa.
- **Bẫy 2 — `class 2` không chỉ là "source chắn đường".** `engine.cellClass` gán `c = 2` cho **cả** source có `def.block` **và** ô có `FloorLayer.solidProps` (`engine.ts:579`). Vậy đọc kết quả mosaic lượt trước rằng "`class 2↔0` = 96% ⇒ source" là **thiếu**: lượt này đo trực tiếp từng mảng và thấy **toàn bộ 96 ô lệch nằm sâu 64+ ô trong cả hai cửa sổ là do `solidProps`, không phải source** (`staticsKindFlicker` = `none<->none` ở 100% ô H3 — không một static object nào khác nhau, chỉ có cờ `solidProps`).
- **Nội dung cửa sổ không phụ thuộc seed run.** 27 cặp origin được đọc dưới cả 3 seed: **0 cặp** có hỗn hợp nguyên nhân khác nhau (assert = 0). Seed chỉ đổi (a) cặp ngẫu nhiên nào được lấy mẫu và (b) entity G1B của chính harness. Hệ quả thực dụng: một bản vá worldgen chỉ cần verify trên một seed, không cần seed sweep.
- Mỗi cửa sổ được vào bằng **QA landing** (`qaUsed: true`) chỉ để có `blockGrid` thật; **không** có tuyên bố chơi được nào ở đây. `setVeyraPlacementRules(4)` vì đó là default engine cho mọi run Veyra mới.

### Năm pass window-relative đã định danh (mọi quote đều đọc từ source đang ship; code đổi là audit đỏ)

| # | Pass | Ô lệch | % | Quote chốt |
|---|---|---:|---:|---|
| **P1** | **Filter reachability của source**: source được rải bằng compile padded neo trên **global** chunk (`gx % 32 === 16`, `window.ts:306/:353` — ý đồ "100% window-invariant"), rồi bị lọc bằng `if (sk && wReached[i]) sourceV3[i] = sk;` (`window.ts:369`) với `wReached` là flood từ **anchor window-LOCAL** `compiler_${x}_${y}` (`window.ts:328/:344`). Flood dừng ở biên 200×200 ⇒ nguồn mà đường nối rời khỏi hộp thì cửa sổ này giữ, cửa sổ kia bỏ. | **3.962** | **44,36%** | `window.ts:369`, `:344`, `:328` |
| **P3** | **Prop thủ tục keyed theo toạ độ LOCAL**: `interior.ts` hash **x,y cục bộ của cửa sổ** (`interior.ts:19`, dùng tại `:106/:108/:117/:127`) để chọn pier/partition/đồ đạc; lưới pier 6 ô neo theo gốc local (trượt 64 ⇒ lưới dịch 4 ô); landmark bị `slicePoisForWindow` clip theo rect cửa sổ (`poi-kit.ts:806`) rồi bị **từ chối nếu cách biên < 2 ô** (`floors.ts:297`); mọi guard (`protectedThreshold`, `wouldSeverFootprint`, `g1bReserved`) tính trên hình học local. Kết quả rơi vào `FloorLayer.solidProps`, và `cellClass` đọc thẳng nó. | **2.765** | **30,96%** | `interior.ts:19`, `floors.ts:297`, `:564` |
| **P2** | **POI bị stamp với BA clip khác nhau**: `slicePoisForWindow` gate theo anchor ±55 và bbox overlap (`poi-kit.ts:771/:773`) rồi bỏ tile ngoài rect (`:780`); compile padded bỏ tile ngoài rect 216×216 (`window.ts:199`); `buildFloorStack` clip **chặt hơn** ở viền 1 ô (`floors.ts:483`) và **null source** dưới tile vừa stamp (`:488`). POI vắt qua mép cửa sổ vì vậy có **hình dạng khác nhau** trong mỗi cửa sổ. | **2.031** | **22,74%** | `floors.ts:483`, `poi-kit.ts:771` |
| **P6** | **POI slice đổi INPUT của compile**: compile padded chỉ bất biến ở **lưới anchor**, không bất biến ở input — `paddedPoiTiles` stamp đúng những POI mà **cửa sổ này** slice vào trường biome/tile/freshness mà compile rải nguồn lên (`window.ts:199/:215`). Hai cửa sổ kề nhau slice hai tập POI khác nhau ⇒ tập nguồn rải ra khác nhau, **dù flood của cả hai đều với tới ô đó**. | **104** | **1,16%** | `window.ts:215`, `:199` |
| **P5** | **Salvage đặt SAU filter**: với rules 4, `placePoiSalvage`/`unplugSalvage` chạy sau filter reachability (`window.ts:486`) ⇒ salvage công nghiệp không chịu filter, chỉ theo POI slice. | **62** | **0,69%** | `window.ts:486` |
| — | **H4 — hiệu ứng tự gây của chính harness**: entity G1B chỉ deploy trong cửa sổ run của nó. Đã tách riêng, **không** tính là worldgen. | 7 | 0,08% | — |

Hai nguyên nhân "đáng ngờ" được assert = 0 và đã giữ 0: **không** source nào tồn tại ở phía mà flood của chính cửa sổ đó loại (`H5b`), và **không** có ô nào hai cửa sổ cùng đặt source nhưng khác key (`H1c`). Nghĩa là filter được quote đúng là cơ chế đang vận hành cho mọi lệch source kiểu P1.

### Phân bố theo khoảng cách tới mép — cái nào là artefact viền, cái nào KHÔNG

| nguyên nhân | 0–2 | 3–7 | 8–23 | 24–63 | **64+** |
|---|---:|---:|---:|---:|---:|
| P1 filter source | 1.046 | 1.170 | 1.515 | 231 | **0** |
| P2 clip POI (tile) | **2.031** | 0 | 0 | 0 | **0** |
| P3 prop thủ tục | 77 | 387 | 864 | 1.341 | **96** |
| P6 POI slice → compile | 27 | 50 | 26 | 1 | **0** |
| P5 salvage sau filter | 14 | 6 | 24 | 18 | **0** |

- **P2 là artefact viền 100%**: mọi ô lệch tile đều nằm trong 2 ô của mép cửa sổ (assert = 0 cho các bucket sâu hơn). Hệ quả: cùng một ô toàn cục có **tile khác nhau** (`road↔ash` 308, `road↔snow` 231, `road↔forest` 151, `wall↔forest` 111…) tuỳ cửa sổ, nhưng chỉ ở viền — nơi cửa sổ sắp trượt qua.
- **P3 là nguyên nhân DUY NHẤT xuất hiện sâu trong nội thất**: 1.341 ô ở 24–63 và **96 ô ở 64+** trong cả hai cửa sổ. Đây chính là 1.036 ô "không phải artefact mép" mà mosaic lượt trước đếm được — nay đã quy được: **đồ đạc thủ tục, không phải source**. Ví dụ cụ thể: ô (1731,1109) trong `po_pumphouse` — `solidProps` 1 ở cửa sổ `veyra05-at-1536-1024` (margin 4) và 0 ở `veyra05-at-1600-1024` (margin 68), tile hai bên đều `floor`, source hai bên đều null, static hai bên đều null ⇒ một bức tường/đồ đạc tồn tại ở cửa sổ này và không tồn tại ở cửa sổ kia, **sâu 68 ô** trong cửa sổ thứ hai.
- **P1 chứng minh được là do flood bị cắt, không phải do hình học**: tại **100%** ô P1, mask `walkable` của hai cửa sổ **giống hệt nhau** (assert `walkableDiffersSoGeometryDiffers = 0`). Vậy khác biệt chỉ có thể đến từ chỗ flood **bắt đầu** (anchor local, đếm được 2→16 anchor/cửa sổ) và chỗ nó **dừng** (biên cửa sổ).
- **P4 — một lượng lệch lớn hơn nhưng vô hình với va chạm**: **94.609 ô (3,08% số ô so sánh)** có class/tile/source **giống hệt** nhưng `spawnEligible` khác nhau. Đo riêng từng mask: `walkable` 0, `protected` 0, `buildable` 0, `solidProps` 0, **`spawnEligible` 94.609** (assert). Cơ chế: prefilter freshwater BFS chạy trên mảng 200×200 nội bộ với cap 28 bước (`window.ts:378/:384/:400`) ⇒ trường khoảng cách bị cắt ở biên cửa sổ. Consumer duy nhất là `chooseLegalSpawn` (`engine.ts:147`), nên ảnh hưởng là **chọn điểm spawn/start**, không phải va chạm — nhưng hai test đang pin số lượng (`veyra05/global-spawn-eligibility.test.ts`, `global-start-discovery.test.ts`) sẽ là chỗ vỡ đầu tiên nếu sửa.

### Định lượng theo vùng (cặp scene focus, 6 cặp/vùng = 163.200 ô chồng lấn)

| vùng | ô lệch | tỉ lệ | thành phần |
|---|---:|---:|---|
| Greywater Hamlet | 1.701 | **1,0423%** | P1 1.065 · P3 312 · P2 291 · P5 30 |
| Hook Peninsula | 1.290 | 0,7904% | P1 948 · P3 294 · P2 48 |
| Cinder Isle | 897 | 0,5496% | P1 327 · P2 288 · P3 258 · P5 24 |
| Gulf West Bank | 765 | 0,4687% | P3 402 · P1 273 · P2 90 |
| Delta Marsh | 756 | 0,4632% | P1 543 · P3 126 · P2 87 |
| Argus Highlands | 483 | 0,2960% | P2 294 · P3 186 |
| Saltwick Isle | 282 | 0,1728% | P1 144 · P2 102 · P3 36 |
| Elderwood Forest | 231 | 0,1415% | P2 117 · P3 114 |
| Westmouth Shore | 216 | 0,1324% | P2 144 · P3 69 |
| Mirage Dunes | 216 | 0,1324% | P3 216 |
| Slag Flats | 168 | 0,1029% | P3 144 · P2 24 |
| Greyback Range | 57 | 0,0349% | P2 57 |
| dải ngẫu nhiên `open-frame` (22 cặp) | 907 | 0,1516% | P1 550 · P3 134 · P2 118 · **P6 104** |
| đích `po_surtur` (offshore) | 228 | 0,2794% | P2 141 · P3 87 |
| đích cửa tím `po_archive` | 183 | 0,2243% | P3 180 |
| đích purple card (2402,1843) | 135 | 0,1654% | P3 72 · P2 63 |

Vùng dân cư/POI dày lệch gấp ~30 lần vùng hoang (Greywater 1,04% vs Greyback 0,035%) — đúng như cơ chế: P1 và P3 đều tỷ lệ với mật độ anchor/POI/phòng. **Cả ba đích progression đang tranh luận đều nằm trong nhóm thấp** (purple card 0,17%, cửa tím 0,22%, `po_surtur` 0,28%), tức là các kết luận reachability lượt trước **không** bị red flag này lật; chúng vẫn phải kèm hai cận optimistic/conservative như đã ghi.

### Ảnh hưởng vật liệu (ô lệch theo source key, từ `SOURCES`)

`snowpine` 486 (wood, `block: true`, stock 5) · `reed` 150 (plant, fiber) · `oak` 129 (wood, block) · `crystal` 109 (ore, block) · `herb` 106 (plant) · `rock` 103 (stone, block) · `iron` 92 (ore, block) · `grass` 86 (fiber) · `sulfur` 75 (ore) · `willow` 66 (wood) · `bush` 54 (berries) · `deadtree` 49 (charcoal) · `mushroom` 45 (plant) · `coalv` 39 (ore). Đa số source lệch là loại **`block: true`** ⇒ lệch không chỉ là "có/không có tài nguyên" mà là **có/không đi qua được** — khớp với 5.504 ô đổi khả năng đi qua.

### Phần dư CHƯA quy được tới từng ô (ghi rõ, không lấp liếm)

- **4.214 ô** (P1 3.631 · P3 401 · P2 163 · P6 18) được gán đúng **tầng** (source / solidProps / tile) nhưng **không nằm trong bbox của POI nào mà cửa sổ slice**. Test bbox ở đây là **bảo thủ**: footprint của một prop hoặc chi tiết phòng có thể vươn ra ngoài bbox, và compile padded cho phép một POI ảnh hưởng ô cách cửa sổ tới 8 ô. Ghi nhận là phần dư, **không** nâng thành cơ chế thứ sáu.
- **25/104 ô P6 có tập POI slice GIỐNG HỆT nhau** ⇒ P6 không giải thích được chúng. Tất cả trừ 1 ô nằm trong 8–15 ô tính từ mép **rect padded** (PAD = 8), tức **phù hợp** với giả thuyết "trường của chính compile bị cắt ở biên padded" — nhưng **chưa chứng minh**: chứng minh cần một PAD sweep (tăng PAD trong harness thí nghiệm rồi so), là một thí nghiệm code, **không** nằm trong phạm vi read-only được duyệt nên **chưa làm**.

### Phương án (chưa chọn cái nào — cần Creator duyệt)

| phương án | việc phải làm | chi phí | rủi ro |
|---|---|---|---|
| **A. Giữ nguyên, coi là đặc tính streaming** | Không đổi code. Mọi tuyên bố reachability/POI/deployed-vs-accessible **bắt buộc** kèm hai cận optimistic/conservative (đã có harness làm mẫu). Ghi P1–P6 vào `PORTING_MANIFEST.md` để port kế thừa. | 0 | Người chơi đi qua cùng một ô theo hai hướng có thể gặp/không gặp một cây, tảng đá hoặc bức tường (5.504 ô đổi khả năng đi qua trên 3,07 triệu ô so sánh); đồ đạc nội thất **đổi theo vị trí cửa sổ** kể cả sâu 64+ ô; `spawnEligible` lệch 3,08% ô ⇒ điểm spawn hợp lệ có thể khác nhau tuỳ cửa sổ đang xét. Không có rủi ro hồi quy. |
| **B. Chỉ sửa P3 (prop keyed local → global)** | Truyền origin vào `interior.ts` và hash theo **toạ độ toàn cục**; kẹp landmark/prop theo global thay vì theo viền local. | Nhỏ về code (2 file), **lớn** về verify: bố cục nội thất **toàn map đổi** ⇒ phải chạy lại R2 closure/stair/door, `audit-closure`, và **mọi digest đang pin** (`hook-compat.preHookPartitionDigest` pin đúng 6 ô theo fingerprint cũ, `mapDigest` provenance trong save). Cần full regression + quyết định của Creator về việc **re-pin digest**. | Cao nhất về mặt dữ liệu: save cũ có thể không khớp fingerprint; NPC port phải theo cùng thay đổi. Không đụng P1/P2 nên source vẫn lệch 44%. |
| **C. Chỉ sửa P1 (filter reachability)** | Flood trên **padded map** (hoặc trên frame toàn cục) thay vì window-local, hoặc bỏ filter và dựa vào reachability toàn cục đã đo. | Vừa: 1 chỗ trong `buildWindowWorld`, nhưng phải đo lại toàn bộ. | **Thêm source vào world** (nhiều ô `class 2` hơn, đa số `block: true`) ⇒ đổi cân bằng tài nguyên **và có thể chặn lối đang mở**; phải chạy lại mosaic foot-reachability (479 s) + spawn contract + hazard audit. Không đụng P3 nên 96 ô deep-interior vẫn còn. |
| **D. Chương trình window-invariance đầy đủ (P1+P2+P3+P4+P6) + golden test** | Sửa cả năm pass, cộng một test chốt "một ô toàn cục = MỘT kết quả" trên lattice stride 64 toàn frame (2.460 cửa sổ, ~463 s chỉ để đọc). | Lớn nhất (nhiều ngày compute + nhiều file worldgen + golden artifact mới). | Cao nhất: mọi digest/provenance đổi, save compatibility phải quyết, NPC port bắt buộc theo. Đổi lại: red flag đóng vĩnh viễn và hai cận optimistic/conservative không còn cần nữa. |
| **E. Chẩn đoán thêm TRƯỚC khi quyết (khuyến nghị bước kế tiếp nếu chưa muốn sửa)** | (1) PAD sweep trong harness thí nghiệm để chứng minh/bác 25 ô residue của P6; (2) đếm P3 deep-interior theo **từng POI** để biết sửa B ảnh hưởng bao nhiêu phòng; (3) đo ảnh hưởng người chơi của P1 bằng cách so thành phần liên thông optimistic/conservative **có và không có** các ô P1. | Nhỏ, chỉ harness, **không ship gì**. | 0 rủi ro hồi quy. Không tự nó sửa gì — red flag vẫn mở. |

Đề xuất thứ tự nếu Creator muốn đi tiếp: **E → B** (vì B là nguyên nhân duy nhất tạo lệch sâu trong nội thất, và là nguyên nhân người chơi dễ thấy nhất khi đứng trong một POI), rồi mới xét **C**; **D** chỉ nên mở như một task worldgen riêng có ngân sách riêng. Cả B, C, D đều là **thay đổi worldgen đang ship** nên cần duyệt riêng + full regression + quyết định về digest/save, và **không** được gộp vào task tối ưu hiệu năng.

### Không tuyên bố

- Đây là **chẩn đoán cơ chế trên mẫu**, không phải kiểm kê toàn frame: 3.073.600 ô chồng lấn trên 113 cặp (mẫu phân tầng + dải ngẫu nhiên), trong khi mosaic lượt trước đo 49.076.416 phép đọc. Hai con số tỉ lệ lệch **khác nhau** (0,29% ở mẫu neighbour stride-64 này, 0,1209% ở mosaic toàn frame) vì mẫu này **cố ý** đặt cửa sổ kề nhau ở vùng POI dày; **không** được đọc 0,29% như tỉ lệ toàn frame.
- Không tuyên bố nguyên nhân cho 4.214 ô phần dư và 25 ô P6 identical-slice ở mức từng ô.
- Không tuyên bố trải nghiệm: không đo người chơi có **nhận ra** đồ đạc đổi hay không, không đo tần suất trượt cửa sổ trong phiên thật, không đánh giá enjoyment/route bắt buộc.
- Không có kết luận release-readiness: môi trường test, software-rendered, cửa sổ đọc pristine (không delta của run).

### Câu hỏi cần Creator quyết (bổ sung mục "Quyết định cần bàn")

8. **Chọn phương án nào cho red flag #1: A, B, C, D hay E?** (Bảng chi phí/rủi ro ở trên.) Nếu chọn B, C hoặc D thì cần quyết **luôn** chính sách digest/save: re-pin fingerprint cũ (`hook-compat`) hay chấp nhận save cũ không tương thích ở các ô đó.
9. **`spawnEligible` lệch 3,08% ô (P4) có phải red flag riêng không?** Nó không đổi va chạm, chỉ đổi tập điểm spawn hợp lệ theo cửa sổ; hai test đang pin số lượng sẽ vỡ nếu sửa. Chọn: ghi nhận như đặc tính (kèm A), hay gộp vào phạm vi sửa (D)?

## Quyết định của Creator (2026-11-18, lượt chẩn đoán worldgen) và RED FLAG MỚI #3

Creator đã trả lời ba câu hỏi ở trên:

1. **Red flag #1 → chọn phương án `E` (chẩn đoán thêm trước, chỉ harness, không ship gì).** Chưa sửa worldgen. Ba việc của E: (a) **PAD sweep** để chứng minh hoặc bác giả thuyết "25 ô residue của P6 là do trường của compile bị cắt ở biên rect padded (PAD = 8)"; (b) **đếm P3 deep-interior theo từng POI** để biết phương án B sẽ làm đổi bao nhiêu phòng / bao nhiêu ô — tức đo blast radius trước khi định giá B; (c) **đo ảnh hưởng người chơi của P1** bằng cách tính lại thành phần liên thông optimistic/conservative **có và không có** các ô P1.
2. **Chính sách digest/save → `decide-after-E`: HOÃN.** Chỉ quyết sau khi (b) cho biết bao nhiêu phòng và bao nhiêu ô thật sự dịch chuyển. Cho tới lúc đó **không** re-pin `hook-compat.preHookPartitionDigest`, **không** regenerate `mapDigest`, và mọi phương án B/C/D vẫn **chưa được phép** triển khai.
3. **P4 → `separate-flag`: tách thành red flag riêng** (mục #3 ngay dưới đây), không gộp vào red flag #1.

Trạng thái sau quyết định: red flag #1 **vẫn MỞ** nhưng đã có cơ chế + phương án + số liệu từng vùng; red flag #2 (test obtainability không thấy loot fixture G1B) **vẫn MỞ**, chưa làm; red flag #3 **MỚI MỞ** ở dưới. Hai quyết định trước đó của Creator vẫn giữ nguyên hiệu lực và **không** bị lượt này đụng tới: `keep-offshore-veto` (Cinder Isle / `po_surtur` / `po_obsq` chỉ vào bằng QA landing cho tới khi có tuyến vehicle/ferry/evac **và chiều về** được chứng nhận) và `intended-wading` (thẻ tím nằm trong bãi độc, lối đi bộ duy nhất lội 19 ô shallow — giữ nguyên như thiết kế).

### Red flag MỚI #3 — `spawnEligible` phụ thuộc cửa sổ ở 3,08% số ô, dù class/tile/source giống hệt nhau

- **Hiện tượng, đo trực tiếp từng mask một:** trên 3.073.600 ô chồng lấn của 113 cặp cửa sổ neighbour, có **94.609 ô (3,08%)** mà `class`, `tile` và `source` **giống hệt nhau** nhưng mask khác nhau. Tách riêng từng mask: `walkable` **0**, `protectedCells` **0**, `buildable` **0**, `solidProps` **0**, **`spawnEligible` 94.609** — tức 100% hiện tượng này là `spawnEligible` (audit assert đúng đẳng thức đó, nên nếu về sau xuất hiện mask khác thì audit đỏ chứ không âm thầm đổi ý nghĩa).
- **Cơ chế (quote từ source đang ship):** prefilter khoảng cách nước ngọt chạy **trên mảng 200×200 nội bộ của cửa sổ** với cap 28 bước — `window.ts:378` (`// Fast freshwater-distance prefilter for spawnEligible (so chooseLegalSpawn runs in <5ms)`), `window.ts:384` (`if (freshDist[i] >= 28) continue;`), `window.ts:400` (`if (dFocus >= 10 && dFocus <= 42) { spawnEligible[i] = 1; ... }`). Trường khoảng cách vì thế **bị cắt ở biên cửa sổ**: một ô cách nguồn nước 30 ô nếu phải đi vòng ra ngoài cửa sổ, nhưng 20 ô nếu đường nằm trong cửa sổ, sẽ được/không được đánh dấu tuỳ vị trí cửa sổ.
- **Phạm vi ảnh hưởng — hẹp hơn red flag #1, nhưng khác loại:** consumer duy nhất của `spawnEligible` là `chooseLegalSpawn` (`engine.ts:147`, `const mask = candidateMask ?? w.spawnEligible`). Vậy nó **không** đổi va chạm, **không** đổi tuyến đi bộ, **không** đổi kết luận reachability của lượt trước; nó đổi **tập ô được coi là điểm spawn hợp lệ** theo cửa sổ đang xét. Phân bố theo khoảng cách tới mép: 0–2: 4.438 · 3–7: 8.200 · 8–23: 28.500 · 24–63: 52.669 · **64+: 802** ⇒ cũng **không** phải artefact viền (802 ô nằm sâu 64+ ô trong cả hai cửa sổ).
- **Vì sao tách thành flag riêng thay vì gộp vào #1:** (a) khác cơ chế (BFS nước ngọt, không phải filter source / prop / POI clip); (b) khác consumer (spawn selection, không phải collision); (c) khác cách sửa và khác chỗ vỡ — hai test đang **pin số lượng** là `src/veyra05/global-spawn-eligibility.test.ts` và `src/veyra05/global-start-discovery.test.ts`, nên bất kỳ thay đổi nào cũng vỡ ở đó trước, chứ không vỡ ở reachability; (d) nó có thể là **đánh đổi có chủ đích**: comment ở `window.ts:378` nói rõ prefilter tồn tại **để `chooseLegalSpawn` chạy dưới 5 ms**, và một trường khoảng cách bị cắt theo cửa sổ chính là giá của ngân sách đó. Audit **không** tự kết luận là lỗi.
- **Chưa đo, không tuyên bố:** chưa đo tần suất một start thật rơi vào ô mà hai cửa sổ bất đồng (start chỉ được chọn **một lần**, trong **một** cửa sổ, nên về mặt người chơi có thể không bao giờ lộ ra); chưa đo ảnh hưởng lên phân bố creature/spawn về sau nếu mask này được dùng lại ở chỗ khác; chưa đo chi phí thật nếu thay prefilter bằng trường khoảng cách toàn cục. Ba mục đó thuộc phạm vi E nếu Creator muốn gộp P4 vào E.

### Red flag MỚI #4 — hai test tích hợp nặng chạy sát trần `testTimeout` 5 s, nên suite ĐỎ trên máy chậm hơn dù không đổi một dòng code

Phát hiện khi chạy full regression cho lượt này (không phải do lượt này gây ra — đã chứng minh bên dưới).

- **Suite đỏ:** 208 files / 1359 pass / **2 fail** / 22 skip, `success: false`. Cả hai fail đều là `Error: Test timed out in 5000ms`, không phải assertion sai:
  - `src/veyra05/audit-closure.test.ts` → `P0-1: enforces strict Day-14 (>=312h) Primordial awakening across live tick, settle, sanctuary entry, and proportional HP form-shift` — đo được **6.467–6.539 ms**.
  - `tests/wp3-veyra-recycler-integration.test.ts` → `harvests natural Veyra wrecks/resources (zero item injection), recycles natural gears at po_slag into Parts/ingots, pays a Workbench upgrade, and survives mandatory Floor -1 reload` — đo được **6.359–6.733 ms**.
- **Không phải do lượt này:** chạy lại hai file đó **sau khi dời cả hai harness mới ra khỏi cây** (`/tmp/parked`, cây chỉ còn khác HEAD ở tài liệu và artifact) → **vẫn fail y hệt**, 6.467 ms và 6.733 ms. Vậy nguyên nhân không thể là hai file test mới.
- **Không phải lỗi hành vi:** chạy lại với `--testTimeout=30000` → **2 files / 8 tests PASS 100%** (P0-1 6.513 ms, WP3 6.359 ms). Mọi assertion vẫn đúng; chỉ có **ngân sách thời gian** là không đủ.
- **Cùng hai test đó ĐÃ pass ở lượt trước** trong run 02:39–03:00 (1361 PASS / 0 FAIL / 21 skip, `full-regression-foot-reachability.json.gz`) trên cùng cây shipped bytes. Nghĩa là **máy chậm lại giữa hai lượt**, không phải code đổi.
- **Bối cảnh máy:** `nproc = 2`, load average 0,81–1,16, hai dev server vite (5174/5194) idle. Trần timeout là **5 s mặc định** của vitest (repo không đặt `testTimeout` riêng cho hai test này), và hai test nặng này đang chạy ở **~130% trần** ⇒ chỉ cần máy chậm ~30% là suite đỏ.

Vì sao đây là red flag kỹ thuật chứ không phải chuyện vặt: **suite đỏ vì môi trường làm mất tín hiệu**. Khi suite đỏ, không phân biệt được "hồi quy thật" với "máy chậm", và quy tắc đang dùng ("một bản vá làm vỡ suite thì KHÔNG giữ lại") trở nên không áp dụng được. Đây là fragility của hạ tầng test, không phải của worldgen.

**Phương án (chưa chọn, cần Creator duyệt — đây là chính sách quality gate, không phải sửa test cho qua):**

| phương án | việc phải làm | chi phí | rủi ro |
|---|---|---|---|
| **A. Giữ nguyên 5 s** | Không đổi gì. Quy trình: khi suite đỏ vì `Test timed out`, phải (1) chạy lại hai file đó với `--testTimeout` cao và (2) dời các file mới ra khỏi cây để loại trừ nguyên nhân, rồi ghi cả hai bằng chứng vào ledger như lượt này. | 0 | Suite vẫn đỏ trên máy chậm ⇒ mỗi lượt tốn thêm ~2 phút chẩn đoán; nguy cơ một lần nào đó bỏ qua fail thật vì quen coi là môi trường. |
| **B. Nâng timeout cho ĐÚNG hai test đó** (`it(..., { timeout: 20000 })`) | Hai dòng, không đổi hành vi test, không đổi trần của 1.380 test còn lại. | Rất nhỏ | Che mất một hồi quy hiệu năng thật trong đúng hai luồng đó (Day-14 awakening và WP3 recycler) nếu không kèm ghi nhận duration. |
| **C. Nâng `testTimeout` toàn project trong vitest config** | Một dòng config. | Rất nhỏ | Làm **cả suite** kém nhạy với treo/hang — đây là lựa chọn rộng nhất và rủi ro nhất về tín hiệu. |
| **D. Giữ 5 s nhưng đo và công bố duration** | Hai test đó tự ghi duration vào artifact; fail vẫn là fail, nhưng ledger có con số để so sánh giữa các lượt. | Nhỏ | Suite vẫn đỏ trên máy chậm (không giải quyết vấn đề tín hiệu), chỉ làm nó chẩn đoán được nhanh hơn. |

Đề xuất nếu Creator muốn: **B kèm D** (nâng trần cho đúng hai test nặng, đồng thời ghi duration để một lần chậm bất thường vẫn bị phát hiện), **không** chọn C. Chưa làm gì cả — chờ quyết định.

## Kết quả phương án E (đã chạy xong): giả thuyết PAD bị BÁC, và ba con số định giá B/C

Harness mới `src/veyra05/window-invariance-followup.audit.test.ts` (opt-in `SOH_WINDOW_INVARIANCE_FOLLOWUP=1`, raw `../../../veyra-window-invariance-followup/manifest.json`, schema `veyra-window-invariance-followup-v1`). Read-only tuyệt đối: **không một dòng worldgen/engine/map/luật nào thay đổi**; file này không sửa gì và không chọn phương án nào. E1+E2 chạy 94 s, E3 (mosaic toàn frame) 588,9 s, 1 test PASS, cả hai `tsc` exit 0.

Repro:

```
cd web && SOH_WINDOW_INVARIANCE_FOLLOWUP=1 SOH_WIF_PAIRS=24 npx vitest run --fileParallelism=false \
  --testTimeout=860000 src/veyra05/window-invariance-followup.audit.test.ts            # E1 + E2 (~94 s)
cd web && SOH_WINDOW_INVARIANCE_FOLLOWUP=1 SOH_WIF_PAIRS=24 SOH_WIF_E3=1 npx vitest run --fileParallelism=false \
  --testTimeout=2900000 src/veyra05/window-invariance-followup.audit.test.ts          # + E3 (~589 s)
```

### E1 — giả thuyết "PAD = 8 cắt trường của compile" bị BÁC, và cơ chế thật là **vòng anchor bị kẹp trong rect nội**

Cách đo: **không** nhân bản `compileEconomy`. Chỉ tái dựng đúng hai input của cổng eligibility — trường `pWalk` padded và tập anchor padded — rồi flood. Làm vậy được vì hai sự kiện đã quote: draw từng ô keyed theo **toạ độ toàn cục** (`world-economy.ts`: `const gx=x+(m.origin?.x??0)` rồi `hash2(gx,gy,salt ^ stableHash(key))`) nên draw không thể khác theo cửa sổ; còn cổng eligibility là `if(!m.walkable[i]||!reached[i]||...)continue;` với `reached` là hợp các flood từ `m.starts` — tức **chỉ** phụ thuộc walkable padded và tập anchor.

**Kiểm định bản tái dựng trước khi tin nó (mọi số đều assert = 0 sai phạm):**

| kiểm định | kết quả |
|---|---|
| source không-phải-salvage quan sát được | **212.804** |
| …nằm trên ô mà flood compile-side tái dựng **không** với tới | **0** |
| …bị filter sau compile tái dựng **loại** | **0** |
| ô walkable nội bộ so sánh (pre-floor vs shipped) | **1.920.000** |
| …lệch | 11.551 — **100% rơi đúng vào ô mà plan compound authored stamp**; số lệch không giải thích được: **0** |

**PAD sweep — kết quả phủ định giả thuyết:** số ô mà flood compile-side khác nhau giữa hai cửa sổ là **239 ở PAD 8, và vẫn đúng 239 ở PAD 16, 24, 32**. Lý do cấu trúc (không phải ngẫu nhiên): vòng anchor dùng bước lưới **32** (`(gy & 31) !== 16`) nhưng bị kẹp trong rect nội (`for (let py = 8; py < PH - 8; py++)`), nên một vành 8 ô **không chứa điểm lưới nào**; nới PAD mà không nới vòng lặp thì **không thêm anchor nào**.

**Vòng anchor mới là cơ chế:** nó phủ toạ độ nội bộ **[16,176]** trên mỗi trục ⇒ chừa lại **dải 16 ô** ở đầu thấp và **dải 23 ô** ở đầu cao **không có anchor**. Trong 1.105 ô lệch source (không tính salvage) trên 24 cặp: **807 ô (73%) nằm trong dải không anchor**, 298 ô nằm trong lưới.

**Thang quy nguyên nhân (mỗi ô rơi đúng một bậc):**

| bậc | cơ chế | ô | % |
|---|---|---:|---:|
| 1 | flood **compile-side** (anchor padded) khác nhau | **239** | **21,6%** |
| 2 | flood **filter sau compile** (anchor window-local `compiler_x_y`) khác nhau — chính là **P1** của lượt trước | **861** | **77,9%** |
| 3 | cả hai flood đều giống ⇒ một pass extent-bound **bên trong** `compileEconomy` (blocker competition / isolation cleanup) | **5** | 0,5% |

→ **Phần lớn lệch source là P1 (filter sau compile), không phải compile-side.** Đây là đính chính quan trọng cho việc định giá: sửa compile-side chỉ đụng 21,6%.

**Counterfactual có định giá (chấm 2×2 so với policy đang ship, chỉ trên 239 ô mà flood shipped khác nhau):**

| policy anchor / PAD | anchor mỗi cửa sổ | diện tích compile | bỏ được bao nhiêu trong 239 ô | làm ô nào **tệ hơn**? |
|---|---:|---:|---:|---:|
| shipped: vòng lặp kẹp rect nội, PAD 8 | 32 | +0% | — (mốc) | — |
| nới vòng lặp ra toàn padded rect, PAD 8 | **32** (không đổi) | +0% | **0 (0%)** | 0 |
| nới vòng lặp ra toàn padded rect, **PAD 16** | **57** (+78%) | **+15,36%** | **239 (100%)** | **0** |
| nới vòng lặp, PAD 24 | 57 | +31,82% | 239 (100%) | 0 |
| nới vòng lặp, PAD 32 | 57 | +49,38% | 239 (100%) | 0 |

**PAD 16 là mức rẻ nhất đủ dùng**; PAD 24/32 không mua thêm gì. Caveat ghi trong artifact: counterfactual chấm **flood**, không chấm output cuối — flood giống nhau **không** buộc source giống nhau, vì blocker competition và isolation cleanup trong `compileEconomy` vẫn extent-bound (chính là bậc 3, 5 ô).

### E2 — định giá phương án B: toàn bộ 81 compound authored

Với **mọi** POI authored trong frame (đọc cửa sổ phủ nó và cửa sổ +64, đếm ô `solidProps` dịch chuyển trong chính bbox của POI):

| chỉ số | giá trị |
|---|---:|
| compound authored trong frame | **81** (đọc được 81, fail 0) |
| plan level / room / prop authored | 190 / **811** / 740 |
| ô bbox đọc được | 448.463 |
| ô `solidProps` **dịch chuyển khi cửa sổ trượt 64** | **2.165 = 0,483%** |
| POI có ít nhất một ô dịch chuyển | **79 / 81** |
| ô dịch chuyển nằm sâu nhất (trong cả hai cửa sổ) | **67 ô** |
| nặng nhất | `po_hook` 111 ô (28 room) · `po_gulfhead` 94 (33 room) · `po_westmouth` 91 (31) · `po_saltharbor` 83 (30) · `po_sandgate` 82 (27) · `po_cindercamp` 70 (26) · `po_ironharbor` 59 (28) · `po_academy` 58 (22) |

Đọc thế nào cho đúng: đây là **cận dưới** — mỗi POI chỉ đo ở **một** offset (64 ô), trong khi đồ đạc local-keyed sẽ dịch ở nhiều offset khác nhau; và 2.165 ô là số ô **prop rắn** đổi trạng thái, không phải số ô "đồ đạc đổi loại" (loại đồ đạc cũng đổi theo hash local, nhưng nó không hiện ra ở `solidProps` khi cả hai bên cùng rắn). Vậy phương án B đụng **tối thiểu 2.165 ô prop rắn trên 79 POI / 811 phòng**, và toàn bộ 811 phòng đó sẽ được dress lại nếu chuyển hash sang toạ độ toàn cục.

### E3 — P1 tốn bao nhiêu với người chơi: đo trong đúng vùng người chơi đi bộ tới được

Mosaic toàn frame stride 64, seed 901, mỗi ô ghi "cửa sổ nào nói có source" và "class có đi được không" theo **hai cận**. Start là **đường chơi thật**: `veyra05-at-2560-704`, ô toàn cục **(2568,716)**, `qaUsed: false` — **đúng start mà harness foot-reachability tìm được**, và kích thước thành phần liên thông **tái hiện chính xác tuyệt đối** (optimistic **2.997.383** ô, conservative **2.967.698** ô) từ một bản mosaic viết độc lập ⇒ hai harness khác nhau cùng cho một kết quả.

| phạm vi | số ô có source (optimistic) | ô **contested** | tỉ lệ |
|---|---:|---:|---:|
| toàn frame (7.127.680 ô đọc được; 4.072.320 ô không cửa sổ nào compile được) | 490.206 | **36.523** | **7,45%** số ô source |
| **trong thành phần người chơi đi bộ tới được** | 148.733 | **31.333** | **21,07%** số ô source (~1,05% diện tích thành phần) |

- Trong 36.523 ô contested toàn frame: **21.916 ô** "cửa sổ này có, cửa sổ kia không có gì" và **14.607 ô** "hai cửa sổ cùng có source nhưng **khác loài**".
- Trong thành phần đi bộ được: **117.400 ô source KHÔNG contested** (giống hệt nhau ở mọi cửa sổ phủ nó, và bằng nhau ở cả hai cận) — đây là phần tài nguyên **ổn định**, đáng tin cho mọi tuyên bố; **10.891 ô contested là loại `block: true`**, tức vừa là tài nguyên vừa là vật chắn.
- Theo vật liệu (ô contested trong thành phần): mixed keys 11.576 · plant 8.866 · **wood 8.116** · stone 1.644 · ore 933 · scrap 198.
- **Cảnh báo mẫu số — hai con số của hai lượt KHÔNG được trích dẫn lẫn nhau:** 0,1209% (lượt trước) là **số lần đọc lệch** trên 49.076.416 lần đọc chồng lấn (mỗi ô được đọc tới ~16 lần); 7,45% / 21,07% ở đây là **số Ô** mà ít nhất một cửa sổ phủ nó bất đồng. Cả hai đều đúng, chúng đo hai thứ khác nhau.

### E làm các phương án đổi giá thế nào

- **Phương án B (sửa P3, prop keyed local → global) nay đã có giá:** tối thiểu **2.165 ô prop rắn trên 79/81 POI, 811 phòng** sẽ dress lại; ô sâu nhất cách mép 67 ô. Vẫn cần quyết định digest/save (đang HOÃN theo quyết định của Creator), vì `solidProps` đổi ⇒ `mapDigest` đổi.
- **Phương án C (sửa P1, filter sau compile) nay rõ là **miếng lớn nhất**: 861/1.105 = 77,9% ô lệch source. Sửa nó là sửa chỗ có ảnh hưởng tài nguyên lớn nhất (E3: 21,07% ô source trong vùng đi bộ được là contested, phần lớn do filter).
- **Phương án C′ MỚI, rẻ hơn C, do E1 đẻ ra:** nới vòng anchor ra toàn padded rect **và** nâng PAD 8 → 16 (hai sửa đổi nhỏ trong `buildWindowWorld`). Giá đo được: **+15,36% diện tích compile**, anchor 32 → 57, **bỏ 100% (239 ô) lệch compile-side**, không làm ô nào tệ hơn. **Giới hạn:** nó **không** đụng 861 ô của P1 và **không** đụng P3; và vì `sourceV3` đổi nên `sourceDigest`/`mapDigest` đổi ⇒ vẫn cần chính sách digest/save.
- **Phương án A (giữ nguyên) nay đắt hơn về mặt nội dung:** E3 cho thấy trong vùng người chơi đi bộ tới được, **cứ 5 ô tài nguyên thì 1 ô (21,07%)** phụ thuộc cửa sổ đang phủ nó — lớn hơn nhiều so với cảm giác "0,12%" của lượt trước (khác mẫu số, xem cảnh báo ở trên). A vẫn là phương án **rủi ro hồi quy bằng 0**.
- **Phương án D** không đổi bản chất, nhưng nay có thể **thu hẹp phạm vi**: E chỉ ra 3 chỗ cần sửa để đạt window-invariance (anchor loop + PAD, filter sau compile, hash local trong `interior.ts`), cộng P2 (clip POI ở viền) và P4 (`freshDist`) — tức D không còn là "chương trình mở" mà là **5 hạng mục đã định danh**.

### Không tuyên bố (lượt E)

- Counterfactual chỉ chấm **flood**, không chấm output compile cuối; con số "bỏ được 239/239" là **cận trên** của hiệu quả, không phải bảo đảm.
- E2 là **cận dưới** (một offset mỗi POI). E1 dùng 24 cặp neighbour, không phải toàn frame; E3 dùng một seed (901) — đã chứng minh ở lượt trước rằng nội dung cửa sổ **không** phụ thuộc seed, nhưng thành phần liên thông thì chỉ đo một start.
- 1.141/2.562 cửa sổ trong mosaic E3 không compile được (lát toàn nước) ⇒ 4.072.320 ô bị coi là **không đi được** ở cả hai cận (bảo thủ, cùng chính sách với harness trước).
- Không có tuyên bố trải nghiệm: 21,07% là **số ô tài nguyên bất đồng theo cửa sổ**, KHÔNG phải "người chơi thấy tài nguyên nhấp nháy"; chưa đo tần suất người chơi đứng ở hai phía của một ô như vậy trong một phiên thật.
- Không có kết luận release-readiness; môi trường test, software-rendered.

### Câu hỏi cần Creator quyết (bổ sung)

10. **Sau E, chọn hạng mục nào để sửa (hay vẫn giữ A)?** Các lựa chọn đã có giá: **C′** (anchor loop + PAD 16; +15,36% diện tích compile; bỏ 100% lệch compile-side = 21,6% lệch source), **C** (filter sau compile; 77,9% lệch source; ảnh hưởng tài nguyên lớn nhất), **B** (hash local trong interior; ≥2.165 ô prop rắn / 79 POI / 811 phòng; là nguyên nhân duy nhất gây lệch sâu 64+ ô), hoặc **D thu hẹp** = C′ + C + B + clip POI + P4. Mọi hạng mục làm đổi `sourceV3`/`solidProps` đều làm đổi `mapDigest` ⇒ **cần quyết chính sách digest/save đang HOÃN trước khi triển khai**.
11. **Red flag #4 (hai test tích hợp chạm trần 5 s):** chọn A (giữ 5 s, coi fail kiểu này là môi trường và luôn chẩn đoán bằng hai bước như lượt này), B (nâng timeout cho **đúng hai test** đó), C (nâng `testTimeout` toàn project), hay D (giữ 5 s nhưng ghi duration vào artifact)? Đề xuất: **B kèm D**, không chọn C.
