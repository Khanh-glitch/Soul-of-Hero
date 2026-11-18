# Dựng lại lưới va chạm mỗi frame — kết quả kỹ thuật

Phạm vi: **chỉ kỹ thuật** (đúng luật + CPU). Không đo trải nghiệm, không đo FPS trên GPU thật, không tuyên bố sẵn sàng phát hành. Mọi số liệu dưới đây chạy trên Chromium headless + SwiftShader (GPU phần mềm) trong sandbox, dev build trừ khi ghi rõ là bundle production.

## 1. Vấn đề người dùng báo và nguyên nhân đo được

Báo cáo: **farm/nhặt loot và di chuyển bị khựng khung hình**, nghi do icon ảnh. Nghi vấn icon đã được xử lý ở lượt trước (`../ui-canvas/RESULT.md`: bỏ mã hóa PNG đồng bộ khi mở túi). Lượt này đo tiếp phần còn lại bằng profiler CPU thật trong game đang chơi, không đoán.

Fixture cố định: layout Veyra thật `veyra05-at-1920-512`, seed 901, chạy từ save thật, nhập liệu thật (giữ LMB trên nguồn cây thật đã chọn bằng luật với tới được; giữ D/S/A/W). Hai biến thể đo **cùng 8 seam đếm**, cùng `variant`, `sim.ts`/`persist.ts`/`Game.tsx` giống hệt nhau theo SHA-256.

Số đo nền (`cpu-profile-counters.json`, code trước lượt vá này):

| Pha | Tổng `tick` | `tick` p95 | longtask | `blockGrid` rebuild | ms rebuild | `cellClass` | `windowForLayout` |
|---|---:|---:|---:|---:|---:|---:|---:|
| idle 8s (harvest run) | 3.362ms | 142,8ms | 22 | 16 | 2.326ms | 640.000 | 2,07 triệu |
| harvest 24s (run harvest) | 3.949ms | 56,5ms | 62 | 81 | 3.741ms | 3,24 triệu | 11,1 triệu |
| settle 8s (harvest run) | 5.646ms | 348,9ms | 51 | 41 | 2.186ms | 1,64 triệu | 5,10 triệu |
| idle 8s (movement run) | 8.405ms | 62,8ms | 35 | 22 | 3.116ms | 880.000 | 3,48 triệu |
| movement 24s (run movement) | 14.989ms | 116,1ms | 98 | 71 | 7.575ms | 2,84 triệu | 9,93 triệu |
| settle 8s (movement run) | 7.178ms | 723,1ms | 48 | 19 | 2.763ms | 760.000 | 2,33 triệu |

CDP quy nguyên nhân: cạnh `loop → tick` 3.763ms trong pha harvest, `tickPlayer → blockGrid` 3.007ms, `blockGrid → cellClass` 3.477ms. Đọc mã nguồn xác nhận cơ chế: **mỗi lần lưới va chạm bị vô hiệu hóa, engine phân loại lại toàn bộ 40.000 ô**, và mỗi ô trả giá một chuỗi tra cứu — `getWorld()`, `effTile()`, `sourceAt()`, `getWindowWorld()` + `activeFloor()` + `layers.get()`, cộng thêm **quét tuyến tính `w.statics.some(...)` cho mọi ô không đi được** (tới 40.000 lượt quét/lần rebuild), và `renderChunk` quét lại `statics` 5 lần cho mỗi tile để tìm cửa.

Kết luận: icon ảnh **không phải** nguyên nhân của khựng khi farm/di chuyển. Nguyên nhân đo được là chuỗi tra cứu lặp lại trong lúc dựng lại lưới va chạm.

## 2. Đã giữ lại thay đổi nào?

**Lượt này** chỉ chạm **hai file shipped**: `src/game/engine.ts` và `src/game/render.ts` (93 + 24 dòng diff). Không đổi luật chơi, không đổi bảng cân bằng, không đổi hình ảnh, không đổi hành vi giữ chuột, không thêm dependency, không cắt chất lượng.

Lưu ý về working tree (chưa commit, dồn từ các lượt trước): `engine.ts` còn mang ngoại lệ `removeEntity` cho drop đã nghiệm thu ở lượt loot-lag, và `src/ui/*` + `src/index.css` còn mang bản sửa canvas UI đã nghiệm thu ở lượt trước. Chúng không thuộc lượt này nhưng vẫn nằm trong mọi phép đo dưới đây, và suite đầy đủ chạy trên đúng nguyên trạng đó.

1. **`doorTiles(w)` — chỉ mục cửa thay cho quét tuyến tính.** Một `Set` chỉ số ô cửa, cache theo `(danh tính w.statics, w.statics.length, thế hệ vô hiệu hóa)`. VEYRA luôn thay **cả mảng** `statics` khi reset tầng trệt/đổi tầng/trượt cửa sổ, và lúc dựng map chỉ `push`, nên bộ ba đó là token nội dung chính xác. `cellClass`, nhánh cửa trong `blockGrid`, `renderChunk.tt` và `draw` đều dùng chung chỉ mục này.
2. **`fillStaticClasses(...)` — phân loại phần không phụ thuộc run, tra cứu đã được nâng ra khỏi vòng lặp.** Với layout nguồn v3, các ô mà run **chưa** sửa có lớp chỉ phụ thuộc nội dung world: `tiles`, mask đi được, cửa, nguồn tĩnh, `solidProps`. Vòng lặp 40.000 ô giờ đọc thẳng typed array, dùng một `getWorld()`, một `getWindowWorld()`, một `activeFloor`, một `Set` cửa, và luật nguồn tĩnh giống hệt `sourceAt()` khi không có `now`.
3. **`blockGrid` v3 = lớp tĩnh + phân loại lại đúng các ô run đã sửa** (`r.terrain`, `r.sources`) bằng `cellClass` **không đổi**, rồi giữ nguyên toàn bộ vòng `natureTrees`/entity/cửa/thang/loot/airdrop. Đường v1/v2 (`baseGrid` cũ) không đổi.
4. **`renderChunk`** (lượt vá trước, giữ nguyên): điều kiện blend tính theo tile thay vì theo pixel — giữ đúng thứ tự duyệt và tie-break; và dùng `doorTiles(w)` thay vì dựng `Set` mới mỗi frame.

**Vì sao tương đương, không chỉ "đo thấy giống":** `sourceAt()` chỉ phụ thuộc run qua `r.sources[i]` và nhánh regrowth — nhánh này đòi `now !== undefined`, mà `cellClass` **không bao giờ** truyền `now`. Vậy với mọi ô không nằm trong `r.terrain`/`r.sources`, lớp ô là hàm thuần của nội dung world; các ô đó được tính bằng luật tĩnh, còn ô run đã sửa thì vẫn đi qua `cellClass` nguyên văn. Phần kiểm chứng ô-theo-ô ở mục 3 là xác nhận thực nghiệm cho lập luận đó.

### Thiết kế đã bị loại bỏ (ghi lại để không lặp lại)

Bản nháp đầu tiên **cache lưới tĩnh xuyên qua các lần rebuild**, khóa theo danh tính + một bộ đếm "world revision", và thêm `world-revision.ts` cùng các lệnh bump trong `window.ts`/`floors.ts`/`scenes.ts`. Nó nhanh hơn nữa (rebuild ~0ms) nhưng **sai**: hai test luật có sẵn — `review-r2-acceptance` P0-2 (độ rắn prop nhiều ô, va chạm xe) và R2-CLOSURE-2 (tường `T.PWALL` phải chặn 100% sát thương kỹ năng Primordial) — ghi nội dung world **tại chỗ** (`w.tiles[i] = T.PWALL`, `tiles.set(...)`, `layer.solidProps[i] = 1`) rồi chỉ gọi `markDirty()`. Cache khóa theo nội dung/danh tính không thấy được các ghi đó: **tường không chặn sát thương (14,996 ≠ 0)** và **ô prop không rắn (0 ≠ 2)**. Đó là lỗi gameplay thật, không phải lỗi test.

Cách xử lý: **bỏ hẳn cache xuyên-lần-vô-hiệu-hóa**. Bản shipped không lưu gì giữa hai lần rebuild — mỗi lần rebuild đọc lại nội dung world đang sống — nên cả lớp lỗi "phục vụ dữ liệu cũ" không thể xảy ra về mặt cấu trúc, mà vẫn giữ được gần như toàn bộ lợi ích vì chi phí nằm ở chuỗi tra cứu mỗi ô, không ở bản thân vòng lặp. Đã `git checkout` trả `scenes.ts`, `window.ts`, `floors.ts` về đúng HEAD và xóa `world-revision.ts`; bề mặt vá shipped thu lại còn 2 file.

## 3. Kiểm chứng

### 3.1 Tương đương ô-theo-ô với engine HEAD, trong browser thật

`e2e/block-grid-equivalence.mjs` nạp **hai instance module** `engine.ts` trong cùng một trang: bản HEAD lấy từ `git show HEAD:web/src/game/engine.ts` và bản working tree. Cả hai dùng chung một world/run nên đầu vào giống hệt nhau; so sánh toàn bộ 40.000 ô của `blockGrid` sau mỗi bước chuyển trạng thái. Server dev được **khởi động mới** cho lượt này, và harness có hai chốt chống bằng chứng giả:

- **Canary danh tính module**: một ô ghi qua world module của harness phải nhìn thấy được bởi **cả hai** engine (`canary.seenByBothEngines`), và một layout `veyra05-*` mà run lại ra layout không-veyra thì harness **ném lỗi** thay vì ghi kết quả xanh. (Chốt này được thêm sau khi một lượt chạy trên server dev cũ bị HMR làm nhân đôi instance `world.ts`: 11 layout đều "compared, 0 mismatch" nhưng thực chất đều là run `shipping_fresh` và các bước kiểm tra Veyra bị bỏ qua — bằng chứng rỗng. Lượt đó đã bị loại và chạy lại.)
- Kết quả (`block-grid-equivalence-wide.json`, `headRef 53c16880`):

| Layout yêu cầu → layout thực tế của run | statics | Số trạng thái so | Lệch ô | rebuild HEAD (trung vị) | rebuild bản vá |
|---|---:|---:|---:|---:|---:|
| shipping → shipping_fresh | 26 | 7 | **0** | 2,2ms | 0,4ms |
| dev_delta → dev_delta_fresh | 32 | 7 | **0** | 2,3ms | 0,5ms |
| shipping_fresh | 26 | 7 | **0** | 2,5ms | 0,4ms |
| dev_delta_fresh | 32 | 7 | **0** | 2,0ms | 0,4ms |
| veyra05-greywater | 10 | 12 | **0** | 13,2ms | 0,3ms |
| veyra05-elderwood | 4 | 12 | **0** | 15,9ms | 0,4ms |
| veyra05-hook | 12 | 12 | **0** | 9,7ms | 0,3ms |
| veyra05-argus | 9 | 12 | **0** | 10,1ms | 0,4ms |
| veyra05-at-1920-512 | 0 | 11 | **0** | 32,3ms | 0,5ms |

**Chốt baseline sau khi commit (thêm sau lượt đo, không làm thay đổi kết quả đã ghi):** vì ba lượt sửa đã được commit thành `ffc85f8`, `HEAD` **không còn là baseline trước-vá** nữa. Bốn harness đối chứng (`block-grid-equivalence`, `spawn-start-parity`, `terrain-chunk-profile`, `frame-cpu-profile` biến thể `before`) giờ **ghim ref baseline** qua `SOH_BASE_REF` (mặc định `53c16880…`, đúng ref mà mọi số liệu ở đây đã đo) và **ném lỗi, exit 1** nếu file baseline giống hệt working tree theo byte — tức từ chối chạy một phép so sánh rỗng thay vì ghi ra "0 mismatch" xanh giả. Đã kiểm chứng chốt này: `SOH_BASE_REF=HEAD` → cả bốn harness dừng với thông báo nêu rõ ref `ffc85f8…` byte-identical; và chạy lại mặc định trên 3 layout sau commit vẫn cho **0 ô lệch** với `baseRef 53c16880` (engine `525d3ff3…`) so `headRef ffc85f86` (engine `857c89fa…` đúng byte đã commit), canary đạt, rebuild at-1920-512 tái hiện 32,1ms → 0,7ms. Lượt tái kiểm đó ghi ra scratch `web/.cache/` (đã gitignore), **không ghi đè** artifact được trích dẫn ở trên. Artifact của các lượt chạy sau này sẽ có hai trường tách bạch `baseRef`/`headRef` (artifact cũ dùng `headRef`/`sourceSHA256.head` để chỉ **baseline**).

Các trạng thái: pristine; sửa `terrain` 202 ô (kèm timer `until` hết hạn, `untilAt` còn sống, `untilAt` hết hạn); sửa `sources` 60 ô (kiệt stock, cháy `burnt`, hư hp, kể cả `wreck`); thêm entity (tường, cửa mở/đóng trên ô cửa thật, thang trên vách, loot, airdrop); với Veyra thêm `resetWindowToGround`, đổi tầng, `syncFloor`; **ghi nội dung world tại chỗ** 200 ô `tiles`+`walkable` rồi khôi phục bằng `tiles.set(...)`; **ghi `solidProps` tại chỗ** 300 ô rồi khôi phục; và trạng thái restored. **Tổng: 0 ô lệch, 0 lỗi trang.**

`veyra05-slag` và `veyra05-cinder`: `startRun` trả về `"No safe, resource-accessible spawn in this region."` với cả 6 seed harness thử → **không so sánh ô-theo-ô được**, ghi rõ trong artifact. Vì cổng spawn đó có đọc lưới va chạm, đã kiểm tra riêng bằng `e2e/spawn-start-parity.mjs` (kết quả `spawn-start-parity.json`): với 4 layout × 6 seed = **24 lần thử, kết quả `startRun` của engine HEAD và engine đã vá giống hệt nhau từng trường** (ok, lý do, `layoutId` thực tế, tọa độ người chơi, `sourceLayoutVersion`) — 12/12 start thành công ở cả hai, và slag/cinder thất bại **cùng một lý do ở cả hai**. Vậy hai dòng `start-failed` là tính chất có sẵn của fixture harness với hai layout đó, không phải hồi quy của lượt vá.

### 3.2 CPU khi chơi thật: trước và sau

`cpu-profile-optimised.json` (bản vá) so với `cpu-profile-counters.json` (nền) — cùng fixture, cùng seam, cùng hash `sim.ts`/`persist.ts`/`Game.tsx`. Bản nền đã gồm vá `renderChunk` lượt trước, nên chênh lệch dưới đây là **của riêng đường lưới va chạm**.

| Pha | Tổng `tick` nền → vá | `tick` p95 nền → vá | longtask nền → vá | ms rebuild nền → vá | `cellClass` nền → vá | `windowForLayout` nền → vá |
|---|---|---|---|---|---|---|
| idle 8s | 3.362 → **102ms** | 142,8 → **1,2ms** | 22 → **0** | 2.326 → **3,1ms** | 640.000 → **0** | 2,07tr → **1,05tr** |
| harvest 24s | 3.949 → **129ms** | 56,5 → **1,5ms** | 62 → **0** | 3.741 → **21,5ms** | 3,24tr → **20** | 11,1tr → **1,01tr** |
| settle 8s | 5.646 → **26ms** | 348,9 → **1,2ms** | 51 → **0** | 2.186 → **4,1ms** | 1,64tr → **6** | 5,10tr → **0,31tr** |
| idle 8s (movement) | 8.405 → **85ms** | 62,8 → **1,0ms** | 35 → **0** | 3.116 → **3,2ms** | 880.000 → **0** | 3,48tr → **0,98tr** |
| movement 24s | 14.989 → **149ms** | 116,1 → **1,4ms** | 98 → **2** | 7.575 → **10,2ms** | 2,84tr → **0** | 9,93tr → **1,07tr** |
| settle 8s (movement) | 7.178 → **30ms** | 723,1 → **0,8ms** | 48 → **0** | 2.763 → **2,7ms** | 760.000 → **0** | 2,33tr → **0,35tr** |

CDP sau khi vá: **`tick` không còn xuất hiện trong top edges của bất kỳ pha nào** (nền: `loop → tick` 3.763ms ở pha harvest, `tickPlayer → blockGrid` 3.007ms, `blockGrid → cellClass` 3.477ms). Cạnh lớn nhất còn lại là `(idle)` 19,7s — chờ raster/compositor, không phải JS của game — rồi `(program)` 1.539ms, React `performWorkUntilDeadline` 1.329ms, `loop` 1.297ms; ở pha idle là `loop → draw` 1.173ms. Self-time theo file (harvest): `veyra05` 3.425ms → 358ms, `game/engine` 557ms → ra khỏi top 6, `game/render` 246 → 153ms.

**Trạng thái gameplay phải giống nhau, và nó giống nhau ở pha harvest:** cả hai biến thể kết thúc ở `player [600,1848]`, `sourceStock 0`, **3 receipt harvest**, 0 drop rơi vãi, `qaUsed false`, không lỗi trang, không resource ≥400. Pha movement kết thúc ở vị trí khác nhau (`[455,1828]` nền vs `[559,1809]` bản vá) — **đúng như dự kiến và không phải tín hiệu đúng/sai**: di chuyển phụ thuộc số tick thực thi (nền 459 tick với nhiều frame bị trễ, bản vá 322 tick), nên quỹ đạo giữ phím tất yếu khác. Không dùng pha này để khẳng định tương đương trạng thái.

**Không tuyên bố:** khung hình p50 là 16,7ms ở cả hai biến thể, nhưng **đuôi frame vẫn còn** ở bản vá (harvest p95 1.017ms, max 1.683ms; settle p95 1.633ms) và cũng còn ở bản nền (harvest p95 100ms, max 2.250ms; movement max 7.716ms). Hai phân phối này không so sánh p95 với nhau một cách có nghĩa được: bản nền chậm đều vì tick, bản vá nhanh ở trung vị nhưng vẫn chịu khựng raster của SwiftShader. Đã đối chiếu riêng bằng ablation render (`diagnosis.json`, `clear-diagnostic.json`, `living-diagnostic.json`): đuôi 1,6–1,8s xuất hiện cả khi chỉ clear canvas → **đuôi là của môi trường GPU phần mềm, không phải của lượt vá này**. Vì vậy không công bố "hết khựng", không công bố FPS vật lý.

Việc còn tồn, nhỏ hơn nhiều và **không còn nằm trên đường tick**: `windowForLayout`/`getWindowWorld`/`getWorld` vẫn được gọi ~1,0 triệu lần trong 24s harvest (giảm 11–14 lần so với nền). Nếu cần thêm nữa thì đây là mục tiêu của lượt sau; hiện tổng `tick` cả pha chỉ còn 129ms nên chưa phải nút thắt.

### 3.3 Vẽ địa hình không đổi pixel

`terrain-chunks.json` chạy lại trên code cuối: 10 vòng xen kẽ before/after, trung vị **192,4ms → 128,4ms** (nhanh hơn ~33%); **7/7 phép kiểm tra khớp từng byte** (108 chunk, 28,3MB đọc lại: spawn 12 chunk + 6 hướng camera 16 chunk mỗi hướng); `stateUnchanged true`; 0 lỗi. Hash `render.ts` trong artifact khớp đúng file đang shipped.

### 3.4 Test hồi quy mới (vitest)

`tests/collision-grid-cache.test.ts` — 5 test, **chỉ kiểm tra tính chất cơ học**:

1. Lưới dựng lại **bằng đúng bản sao nguyên văn thuật toán trước tối ưu** (`referenceCellClass` + `referenceBlockGrid`: một `getWorld()` mỗi ô, quét cửa tuyến tính, `sourceAt()` mỗi ô, resolve window/floor mỗi ô) trên **toàn bộ 40.000 ô**, với 3 run Veyra thật × 4 trạng thái (fresh, đổi tầng, đã sửa terrain/nguồn, khôi phục). Test in ra số ô lệch và ô lệch đầu tiên nếu có.
2. Chỉ mục cửa bằng đúng phép quét `statics` theo nghĩa đen; được **dùng lại** khi chưa có gì bị vô hiệu hóa; **dựng lại** khi mảng `statics` bị thay, khi có phần tử được `push`/`pop`, và khi `markDirty()` được gọi.
3. **Nội dung world ghi tại chỗ được tôn trọng chỉ với `markDirty()`** — đúng lớp lỗi đã làm hỏng bản nháp cache: ghi một ô `T.PWALL`, khôi phục bằng `tiles.set(...)`, ghi `solidProps[i] = 1` rồi xóa; mỗi bước kiểm cả `blockGrid` lẫn `blockedAt`, và cuối cùng so lại toàn lưới với bản sao thuật toán cũ.
4. Sửa `terrain`/`sources` của run vẫn được phân loại lại trên lớp tĩnh (nguồn chặn → 2; kiệt stock → không chặn; `wreck` vẫn chặn; tường `until` còn sống → chặn, hết hạn theo đồng hồ sim của run → không chặn).
5. Sửa của run này **không rò** sang run khác qua lưới cache, và run đầu vẫn thấy sửa của chính nó sau khi run thứ hai rebuild.

Hai test luật từng đỏ vì bản nháp cache (`review-r2-acceptance` P0-2 và R2-CLOSURE-2) **xanh lại** với bản shipped, chạy kèm file test mới: 12/12 PASS.

### 3.5 Toàn bộ suite, typecheck và build

- **Typecheck**: `npx tsc -p .` và `npx tsc -p tsconfig.test.json` — cả hai exit 0, không lỗi.
- **Toàn bộ suite vitest** chạy từ `web/`, `--maxWorkers=2 --testTimeout=300000`, **trên đúng hai file shipped cuối cùng** (engine `857c89fa…`, render `284c8395…`): **205 file / 559 suite / 1380 test → 1361 PASS, 0 FAIL, 19 skip**, 808,5s (`full-regression.json.gz`). Lượt trước là 204 file/1356 PASS: **+1 file và +5 test đúng bằng số test mới** của `collision-grid-cache.test.ts`, không có test nào bị bỏ hay nới để lấy màu xanh.
- Lượt xanh này là **lượt chạy lại có chủ đích**: lượt xanh đầu tiên (762,9s, cùng 205 file/1361 PASS) chạy trùng lúc một chỉnh sửa phòng thủ nhỏ trong `fillStaticClasses` được thêm rồi **được hoàn tác ngay** (đọc `economyMap.walkable` chỉ khi luật mask áp dụng — một trạng thái mà kiểu `World` vốn không cho phép). Vì byte cuối đã trở lại đúng bản đã đo ở mọi artifact, suite được chạy lại toàn bộ trên byte cuối để bằng chứng không dính khoảng chỉnh sửa đó; kết quả giống hệt.
- Trong suite xanh đó có **7 test `review-r2-acceptance`** (P0-1, P0-2, P1-3, P1-4, P1-5, R2-CLOSURE-1, R2-CLOSURE-2) — tức toàn bộ luật độ rắn prop đa ô, va chạm vật lý người chơi/sinh vật/xe, 48 kỹ năng Primordial với tường chắn sát thương, và bảo toàn art Veyra.
- **Bằng chứng đỏ được giữ nguyên**: cùng bộ suite với bản nháp cache cho **205 file / 1380 test → 1359 PASS, 2 FAIL, 19 skip**, 790,3s (`full-regression-draft-cache-RED.json.gz`), đúng hai test P0-2 và R2-CLOSURE-2 mô tả ở mục 2. Không xóa, không ghi đè.
- **Build production**: `npm run build` thành công (265 module), `dist/index.html` 84.796,94 kB, SHA-256 `51e1d7b22935363fa0aeeb091406b16b8a7ae9735659d8396ac10f5f2b4afd1a`.

### 3.6 Bundle production, nhập liệu thường, không tiêm trạng thái

`e2e/frame-production-movement.mjs` trên **bundle single-file production** (`vite preview`, viewport 640×360, tiến trình browser thật). Artifact: `production-movement/manifest.json` + 3 ảnh chụp.

- **Vào run bằng menu thường**: "New run" → "Begin the 14 days". Không tiêm trạng thái, không QA flag, không fixture: game tự chọn seed `1956155901`, layout `veyra05-at-2048-1280`, digest `277590c5`, `qaUsed false`.
- **Di chuyển bằng phím thật**: giữ `D` 6s rồi giữ `S` 6s → người chơi dịch chuyển **151px** (`[1272,1000]` → `[1291,1150]`), camera băng qua ranh giới chunk.
- **Farm bằng chuột thật**: quét chuột 77 vị trí để tìm mục tiêu tương tác qua hook read-only `__sohView().target`; lượt này hook trả `null` nên harness **giữ LMB ở tâm màn hình** 7,2s rồi nhả và click 6 lần. Kết quả vẫn là chơi thật: **2 receipt `harvest`**, kinds gồm `run.start`/`stimulus.emit`/`harvest`/`pickup`, túi có `berries` (3+1+1+1) và `seed_wildberry`, `drops 0`, `entities 0`, `qaUsed false`.
- **Khung hình**: idle p50 16,7ms / p95 16,8ms (321 frame trong 8s); movement p50 16,7ms / p95 599,9ms (229 frame); pha giữ LMB p50 16,7ms / p95 600ms (209 frame). **Chỉ đúng 1 longtask 72ms trong ~40 giây chơi**, không có khối JS hàng trăm ms nào. Đuôi frame ~0,6–0,8s vẫn còn và vẫn là raster của SwiftShader, nhất quán với kết luận ở dev — **không** suy ra FPS trên máy người chơi.
- **Save → quit → tiến trình browser mới → Continue**: seed, layout, digest, `qaUsed false`, tọa độ `[1291,1150]` và 2 receipt harvest **giữ nguyên từng trường**; `0` lỗi trang, `0` resource trả về ≥400.
- Hash nguồn ghi trong manifest khớp đúng hai file shipped: `engine.ts 857c89fa…`, `render.ts 284c8395…`.

Đây là **smoke kỹ thuật trên bundle thật**, không phải nghiệm thu trải nghiệm hay tiến trình tự nhiên: một phiên, một seed do game tự chọn, một layout, GPU phần mềm, 640×360.

## 4. Giới hạn của bằng chứng

- GPU phần mềm SwiftShader trong sandbox, dev build cho các phép đo CPU. **Không** suy ra FPS trên máy người chơi, không suy ra thời gian thực trên GPU thật.
- Fixture dev có seed cố định và nguồn harvest được **chọn bằng luật** (nguồn plant thật, với tới được, giàu stock nhất trong vùng quét) — không phải chuỗi farm tự nhiên của người chơi, và không phải tuyên bố về tỉ lệ thu hoạch. Lượt production thì ngược lại: không chọn gì cả, một seed/một layout duy nhất do game tự chọn, và hook target trả `null` nên pha farm là giữ LMB ở tâm màn hình chứ không nhắm một nguồn cụ thể.
- `block-grid-equivalence.json` (lượt 6 layout) là artifact của **bản nháp cache đã bị loại**, hash engine không khớp code shipped; đã ghi rõ `artifactStatus: SUPERSEDED / HISTORICAL ONLY` ngay trong file. Artifact tương đương của code shipped là `block-grid-equivalence-wide.json`. `focused-tests.json.gz` cũng thuộc bản nháp đó (8 suite trọng điểm: 26 PASS/1 FAIL, lỗi là khác biệt thẩm quyền `until` so với đồng hồ sim trong chính test mới, không phải lỗi engine). `cpu-profile.json` là lượt profile đầu tiên chưa gắn seam đếm, chỉ dùng làm bối cảnh, không dùng để so sánh trước/sau.
- `veyra05-slag`/`veyra05-cinder` chưa so sánh được ô-theo-ô trong harness (start-failed). Hai layout đó vẫn nằm trong suite vitest đầy đủ.
- Bằng chứng ở đây là đúng luật + CPU. **Không** đánh giá trải nghiệm, độ thú vị, mục tiêu người chơi hay lộ trình bắt buộc — theo đúng chỉ đạo: người dùng sẽ tạo trải nghiệm.
- Toàn bộ ba lượt sửa đã nghiệm thu (cache nhặt drop, canvas UI, lưới va chạm) được **commit gộp thành một commit** trên nhánh `arena/e506bfd6-soul-of-hero`, kèm harness `e2e/`, test mới và thư mục bằng chứng này. Scratch của harness (`web/.cache/`: bản sao module baseline lấy từ `git show HEAD:…`, probe, bản copy profile) được đưa vào `.gitignore` vì tái tạo được và không bao giờ được production import; `web/.cache/pending.txt` vẫn tracked như trước.
