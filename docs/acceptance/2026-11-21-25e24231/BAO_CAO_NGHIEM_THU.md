# Nghiệm thu runtime — `arena/25e24231-soul-of-hero` @ `6d2dec8`

Ngày đo: 2026-11-21 (UTC). SHA đo: `6d2dec8b142270d34e666815df9358f962e40402` (401 commit trước `main`, 0 sau).
Máy đo: sandbox 2 vCPU / ~3,9 GB RAM, Node 22.22.3, Chromium 131 headless (software GL), viewport 640×360.

**Kết luận: CHƯA đạt final.** Bản build chơi được ở vòng đầu (vào game, hái, chế, ăn uống, lưu/tải, chết/hồi sinh, bỏ lượt, Continue cuối game), nhưng regression còn đỏ, cuộc tấn công Elder toàn đảo không chạm tới ai, hai đường cứu chưa cùng chứng minh trong một lượt, gói ZIP phát hành đã cũ, và chưa có lượt chơi A–I bằng tay người.

Báo cáo này không sửa mã nguồn của nhánh được đo. Mọi số liệu dưới đây do phiên này tự chạy, trừ khi ghi rõ "theo tài liệu".

## 1. Phạm vi đã chạy

| Hạng mục | Kết quả |
|---|---|
| `npm run typecheck` | Đạt, 0 lỗi |
| `npm run typecheck:tests` | Đạt, 0 lỗi |
| `npm run build` | Đạt. JS chính 5,80 MB (gzip 1,18 MB), worker 4,63 MB, không tách chunk |
| Regression đầy đủ, 260 tệp, chạy tuần tự từng tệp | 203 đạt · 38 đỏ · 6 quá 15 phút · 13 chỉ có test bị skip |
| Tổng số test | 1.330 đạt · 143 đỏ · 59 skip, cộng 1 tệp sập ở cấp suite (31 test không chạy) |
| Mô phỏng 336 giờ (`scripts/npc-endurance.mjs`, seed 7606, người chơi không thao tác) | Chạy đủ 336/336 giờ, K8 wipe một lần |
| Cổng chiến dịch của chính repo (`scripts/npc-campaign-gate.mjs`) | 14 đạt · 1 trượt |
| Trình duyệt thật, bản production `dist/` | Xem mục 3 |
| Khôi phục Atlas từ `web/ref/atlas/source` | SHA256 và CRC khớp manifest, 26 thành phần |

Không đo được trong sandbox này: FPS thật (software GL chỉ ~1,8 khung/giây), chơi tay người, Godot.

## 2. Regression (260 tệp)

Tài liệu trong repo ghi 197 / 225 / 251 / 256 tệp; số thật trên SHA này là 260.

Nhóm lỗi chính của 143 test đỏ:

| Nhóm | Số test / tệp | Nhận định |
|---|---|---|
| `Need an intact packed device.` | ≥40 / 10 | Fixture đặt thiết bị trực tiếp; luật PA1 (commit `99ed3c4`, 13/11) buộc phải có thiết bị đóng gói. Fixture cũ từ 8 ngày trước. |
| Hàm dựng `build(...)` trả `ok:false` | ~70 / ~19 | Cùng gốc: fixture dựng nhà/trạm theo luật cũ (B03 return/thermal, B04 bẫy, home-production, rest-supply, S06 mạch điện, MEC01 departure/score-once, W08). |
| Công thức đã đổi | 2–3 | Ví dụ cảm biến IR chờ `mechanical_gear`, thực tế `iron_ingot`; test còn nhắc `fasteners` đã bỏ. |
| Lẻ | ~15 | `cannot hold knife`, layout id `veyra05-at-…` thay cho `veyra05-world`, thiếu tệp `../tmp/verification/…`, `stimulus` thay cho `trace`, thiếu dòng creature-death trong báo cáo vắng mặt, `npc-runtime-throughput`. |

Hệ quả: vì fixture không dựng được, các luật sau **không còn được kiểm thử** trên SHA này: mạch điện S06, bẫy, sản xuất tại nhà, giường/nghỉ, offline return B03, ký gửi tiền một lần (score-once), dự báo rời đảo, nhà máy lọc dầu trên nền hợp lệ.

Sáu tệp vượt 15 phút: `economic-network-m2`, `g1b-lifecycle`, `veyra05/audit-closure`, `veyra05/ecosystem-full`, `veyra05/review-r2-acceptance`, `arena1-round2-newgame-routes`. Chạy riêng, không tải song song: `economic-network-m2` chưa xong sau ~26 phút và `g1b-lifecycle` chưa xong sau ~15 phút (timeout 120 giây mỗi test của Vitest không ngắt được, nghi vòng lặp đồng bộ). Bốn tệp còn lại chưa được chạy riêng.

Chạy test còn ghi đè 5 tệp evidence đang được Git theo dõi (`web/evidence/item-network/*`, `web/reports/economic-network/*`, `web/reports/mec01-five-chain-benchmark.json`).

Chi tiết: `regression-260-files.log`, `regression-failure-families.txt`.

## 3. Trình duyệt thật (production build, 640×360)

Đạt, không có lỗi trang, request hỏng hay HTTP ≥400:

- Title tải 0,56 giây. New run → chọn nhân vật / thế giới / vùng xuất phát → vào game (~15 giây).
- WASD di chuyển; LMB chặt cây ra gỗ, sợi, nấm; Journey "Gather by hand" 3/3.
- Ăn berries (+8 đói), uống bình (+25 khát); chế Torch từ gỗ + sợi.
- Các bảng I / C / B / M / Tab / J / N và menu Esc mở được.
- Save & quit → tải lại trang → Continue: cùng run id, seed, túi đồ, vị trí; localStorage và IndexedDB đều `ok`.
- Abandon run → màn tổng kết → title → Profile & history có dòng lượt đã bỏ.
- Continue từ save giờ 264 (lấy từ mô phỏng 336 giờ, đồng hồ trình duyệt đặt +2 giờ): worker giải quyết 2 giờ vắng mặt trong 32 giây, hiện Return Chronicle, biển "RAGNAROK · FINAL 72H", lưu `ok`.
- Chết → "Rise & Recover Gear" → sống lại HP 60, đi lại được.
- QA Sandbox, Classic Island (R12), Creator Inspector đều mở được.

Chưa làm trong phiên này: xây dựng, chiến đấu với quái, tiếp xúc/giao dịch NPC, Core, phương tiện, sơ tán bằng tay, toàn bộ cảnh A–I.

Khiếm khuyết thấy được:

1. Title production có nút vàng "Full-Gear QA Sandbox [F9]" (nổi bật nhất, cấp 11 Core + đồ đầy đủ) và "Creator Inspector · 81 POIs".
2. Gỗ nhặt được không tự gộp chồng: mỗi khúc chiếm một ô (`wood` có `max: 60`), túi 24 ô đầy rất nhanh.
3. Return Chronicle tự mâu thuẫn: "7798 timed events recorded" cạnh "No timed events or stock deltas occurred during your absence".
4. Return Chronicle nói "A bag (bpgp) is on the ground where you fell", màn chết lại nói "No recoverable bag is currently confirmed".
5. Tên NPC bắt đầu bằng một nghề nhưng 260/286 người có `occupation` khác (ví dụ "Guard Highland" là cook, "Medic Delta" là mechanic).
6. Classic Island (R12) không có NPC nào (0 người).
7. Creator Inspector tự ghi 12 cầu "Unresolved Bridge MGP-D01" và 25 POI "Open-Air / No Door MGP-D04".

## 4. Mô phỏng 336 giờ (seed 7606, người chơi đứng yên)

| Giờ | Chết | Ghi chú |
|---|---|---|
| 1 | 0 | 20 người gục vì tai nạn khi khai thác (`human.harvest.crush`) |
| 13 | 21 | bắt đầu chết đói/khát |
| 24 | 111 | 67 người đói = 0, 44 người khát = 0; 21/68 cộng đồng chết sạch |
| 48 | 140 | |
| 120 | 224 | |
| 168–288 | 239–240 | ổn định, còn ~46 người |
| 290–295 | 240 | 6 người lên tàu ở `po_evac_west`, tới nơi an toàn |
| 312 | 242 | sáu Elder thức dậy |
| 336 | 242 | kết cục: 6 sơ tán · 38 sống · 242 chết · 0 chưa rõ |

Phát hiện:

- **Elder không tấn công được ai.** Cả 36 đợt (6 Elder × 6 đợt) đều `BLOCKED`, lý do ghi trong save: "no inhabited settlement within 64 tiles of its current position". Elder đứng nguyên ở hang (`routeTargets` rỗng); người sống gần nhất cách 152–1.056 ô. Không có `elder.assault.launch` hay `elder.contact` nào. 38 người được ghi SURVIVED mà chưa hề bị tấn công.
- **Cổng chiến dịch trượt 1/15:** "Same run: a passenger arrived AND a defended resident survived" — danh sách `guarded` rỗng.
- **Chỉ 1/3 bến có chuyến.** `po_evac_south` và `po_evac_hook` mở BOARDING rồi kết thúc, không có hành khách.
- **Save phình ở 48 giờ cuối.** 3,57 MB tới giờ 288, rồi 7,3 → 14,0 → 18,5 → 17,7 MB ở giờ 290 → 298 → 312 → 335. Phần phình là khối `navigation` (1,6 MB → hơn 10 MB). Chuỗi 17,7 triệu ký tự vượt hạn mức localStorage của Chromium (đã thử: `QuotaExceededError`), khi đó chỉ còn IndexedDB giữ save.
- **Hiệu năng settle:** tổng 6.345 giây cho 336 giờ trên máy này; test `npc-runtime-throughput` đỏ.
- Worker Vitest sập một lần ở giờ 299 khi regression chạy song song; chạy tiếp từ checkpoint thì qua. Nguyên nhân chưa xác định (nghi thiếu RAM).

Chi tiết: `endurance-hourly-census.csv`, `endurance-campaign-gate.json`.

## 5. Gói phát hành và tích hợp

- `web/releases/Soul-of-Hero-Web.zip` có SHA256 `dfea43a0…5eb1`, đóng ở commit `373d999`, **cũ hơn tip 7 commit mã nguồn**. JS chính khác bản build tip và ZIP không có tệp `offline-return-worker` (đường Continue dài chạy ngoài luồng UI được thêm sau đó). 211/213 tệp còn lại trùng.
- Không có PR nào từ `arena/25e24231-soul-of-hero` vào `main`.
- Không workflow CI nào kích hoạt trên nhánh này hay `main`; lần CI gần nhất là 14/11 trên nhánh PA1.
- 15 driver trình duyệt trong `web/e2e/QUARANTINE.json` vẫn bị cách ly.
- Tip đã chứa đầu nhánh của PR #64, #61, #56, #55. Chưa chứa: #39, #49, #50, #52, #54, #57, #58, #59, #60.

## 6. Đối chiếu tài liệu

- **Bible** (`web/ref/bible.md`): bậc chứng cứ S0–S5; §8.4a tự ghi BUILD-0, S3 cùng build, S4, E2 đầy đủ và E3 chưa được chứng minh. Điều đó vẫn đúng sau lượt đo này.
- **Atlas v1–v11**: là hợp đồng kế hoạch/kiểm thử, không phải luật. v11 có 214 năng lực, 144 gate, 20 hành trình, 32 cross-gate, tất cả `NOT_RUN`; repo chưa có bảng phân loại năng lực ↔ mã nguồn.
- **Control-tower 20261117** (`01`–`10`): 13 gate nền đều mở theo sổ `07`. Lượt đo này xác nhận các gate FULL regression, END, EVAC, PERF, BROWSER A–I còn mở.
- **Survivor Contract §35**: SURVIVED_ON_ISLAND chỉ hợp lệ sau khi sống qua đợt tấn công cuối. Kết quả mục 4 chưa thỏa điều này.

## 7. Quyết định của Creator (21/11, trong phiên này)

1. Final là **bản Web**; Godot không thuộc cổng final.
2. Cổng final là **13 gate của control-tower**; Atlas v11 không phải điều kiện chặn.
3. NPC **chết nhiều khi người chơi không can thiệp là đúng thiết kế**; người chơi phải cứu.
4. **Gỡ QA Sandbox và Creator Inspector khỏi production ngay.**
5. **Sửa toàn bộ fixture** theo luật mới, không loại test.
6. Final = nhánh 25e24231 hiện tại; **không nhập thêm PR nào** đang mở.

**Quyết định bổ sung trong giai đoạn sửa lỗi (cùng ngày, ghi lại những mục làm thay đổi danh sách ở mục 8):**

- Elder **được vượt biển** để tới khu dân cư ("cho vượt biển luôn"); khi bơi đi **80 ô/giờ**, gấp đôi đi bộ (phương án 3).
- Mục A2 **bỏ**: người sống sót chưa bị Elder chạm tới vẫn ghi "Sống sót trên đảo".
- Mục A3 **bỏ**: bến `po_evac_south` và `po_evac_hook` được phép không có chuyến trong lượt không người chơi; chứng minh bằng lượt người chơi hộ tống.
- Mục A6: **ẩn Classic Island** khỏi màn chọn thế giới (đã làm ở `ba9894a`).
- Mục A9: **để nguyên 9 PR cũ đang mở**, chỉ ghi chú là không thuộc final.
- Tốc độ mô phỏng dân cư: chọn **phương án 1** — khi tua ngoại tuyến, dân cư xét kế hoạch / cấp cứu / bước đi theo nhịp 1 giây.
- **Giữ cách nhường đường mới của dân** (sửa kèm đợt tăng tốc, có hiệu lực cả khi chơi trực tiếp), với điều kiện tìm hiểu vì sao số lượt gục tăng — đã tìm hiểu, kết quả ở `TIEN_DO_SUA_LOI.md`.
- **Ba tệp kiểm thử tua hàng trăm giờ bị loại khỏi điều kiện nghiệm thu**: `src/veyra05/audit-closure`, `src/veyra05/review-r2-acceptance`, `tests/economic-network-m2`. Chúng vẫn nằm trong repo nhưng **chưa được kiểm chứng** trên mã cuối; đây là ngoại lệ so với quyết định 5.

Tiến độ thực hiện từng mục: xem `TIEN_DO_SUA_LOI.md` cùng thư mục.

## 8. Việc còn thiếu để tới final

### A. Tích hợp

1. Elder phải thật sự tới được khu có người: bỏ giới hạn "64 ô quanh hang" hoặc cho Elder di chuyển theo tuyến; có tiếp xúc, thiệt hại, phòng thủ thật ở h312–h336.
2. SURVIVED_ON_ISLAND chỉ cấp cho người đã qua một đợt tấn công có thật; người chưa bị chạm tới phải có nhãn khác hoặc bằng chứng "không trong tầm".
3. Bến `po_evac_south` và `po_evac_hook` phải có chuyến thật trong lượt thường.
4. Chặn phình khối `navigation` trong save ở 48 giờ cuối; giữ save dưới hạn mức localStorage hoặc chứng minh đường chỉ-IndexedDB an toàn.
5. Gỡ nút QA Sandbox và Creator Inspector khỏi build production (chỉ còn khi `VITE_SOH_QA=1`).
6. Sửa sáu khiếm khuyết UI ở mục 3 (gộp chồng gỗ, hai mâu thuẫn Return Chronicle, tên NPC lệch nghề, và quyết định số phận Classic Island không NPC).
7. Sửa `10_KE_HOACH_FINAL.md` mục (1) "xã hội sống tới cuối game" theo quyết định 3: mục tiêu mới là người chơi **cứu được** người, không phải xã hội tự sống.
8. Đóng lại ZIP từ SHA cuối, có `offline-return-worker`, cập nhật SHA256 trong sổ `07`.
9. Mở một PR duy nhất `arena/25e24231-soul-of-hero` → `main`; đóng hoặc ghi "để sau" cho 9 PR không thuộc final.
10. Cập nhật số tệp test trong tài liệu (260) và dừng việc test ghi đè evidence được Git theo dõi.

### B. Kiểm chứng

1. Sửa fixture cho 38 tệp đỏ (ưu tiên gốc chung "packed device" và hàm `build`), tới 0 đỏ.
2. Xử lý sáu tệp quá giờ: tìm chỗ treo trong `economic-network-m2` và `g1b-lifecycle`, chạy riêng bốn tệp còn lại tới kết thúc.
3. Sửa tệp `item-ontology-v2.test.ts` sập cấp suite (31 test không chạy).
4. Khóa một SHA, chạy lại đủ: 2 typecheck, build, regression 260 tệp, endurance 336 giờ, campaign gate 15/15.
5. Bài chứng minh "người chơi cứu được": cùng seed, một lượt có can thiệp cho kết cục khác rõ so với 6/38/242, bằng thao tác thường.
6. Hai đường cứu trong cùng một lượt: có người sơ tán tới nơi **và** có người được phòng thủ sống qua đợt Elder thật.
7. Lượt trình duyệt A–I theo `06_VERIFICATION_RELEASE_AND_EVIDENCE.md` bằng điều khiển thường ở 640×360: xây, chiến đấu, NPC (nói, trao đổi, cướp, cứu, chiêu mộ), 8 nghề, Core, phương tiện, Ragnarok, sơ tán, K8 và lượt 2.
8. Continue từ save cũ (các mẫu lịch sử) trên bản build cuối trong trình duyệt thật, kể cả save giờ 335 cỡ lớn.
9. Đo hiệu năng trên máy có GPU thật (FPS, thời gian settle sau vắng mặt 8/24/72 giờ).
10. Creator chơi thử và duyệt (S4); ghi hướng dẫn tiếng Việt kèm bản build và ZIP cùng SHA.
11. Gỡ cách ly hoặc viết lại 15 driver trong `QUARANTINE.json`; bật một workflow CI cho nhánh final.

## 9. Tệp kèm

- `regression-260-files.log` — trạng thái từng tệp (`NNN STATUS giây tệp đạt/đỏ/skip`).
- `regression-failure-families.txt` — danh sách tệp đỏ và nhóm thông báo lỗi.
- `endurance-hourly-census.csv` — trạng thái 286 NPC và cỡ save theo từng giờ.
- `endurance-campaign-gate.json` — 15 phép kiểm của cổng chiến dịch.
