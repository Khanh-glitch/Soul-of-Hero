# Tiến độ sửa lỗi sau nghiệm thu `6d2dec8`

Cập nhật: 2026-11-21 (lần 4 — tăng tốc mô phỏng dân cư). Nhánh `arena/0f6091f9-soul-of-hero`. Chưa đẩy lên GitHub, chưa có PR, chưa phát hành.

## Các commit

| Commit | Nội dung |
|---|---|
| `6f6b534` | Elder hành quân trên bộ tới khu dân cư (trước đây cả 36 đợt đều bị chặn). |
| `8d882e6` | Giới hạn bộ nhớ tìm đường lưu trong save (bản đầu, có lỗi — xem dưới). |
| `43e4713` | Thay giới hạn cứng bằng hàng chờ: tìm đường dài phải đợi lượt, không bị cắt ngang. |
| `ba9894a` | Bốn lỗi người chơi nhìn thấy: gỗ không cộng dồn, tên dân sai nghề, túi đồ khi chết, cửa QA trên màn hình chính. |
| `01021db` | Sửa bộ dựng cảnh của các bài kiểm thử theo luật PA1 (thiết bị phải đóng gói trước khi đặt). |
| `0ae1ab6` | Elder vượt biển — quyết định của Creator 2026-11-21 ("cho vượt biển luôn"). |
| `fc63741` | Elder bơi 80 ô/giờ (gấp đôi đi bộ) — quyết định của Creator, phương án 3. |
| `d743ffa` | Đưa 21 tệp kiểm thử đỏ về xanh theo luật hiện hành của game; sinh lại tài liệu ontology. Không đổi mã game chạy thật. |
| `c7e01dc` | **Tăng tốc mô phỏng dân cư** (phương án 1 Creator chọn): khi tua ngoại tuyến, dân cư xét kế hoạch / cấp cứu / tới ô theo nhịp 1 giây; thêm bộ nhớ đệm tra cứu địa hình. |
| `0fa58e2` | Gỡ nút thắt người đứng quanh kho (bản đầu, **có lỗi** — xem mục "Tăng tốc" bên dưới). |
| `eca8d96` | Sửa lỗi của `0fa58e2` và hiện tượng "đẩy qua đẩy lại" khi nhường đường. |
| (commit này) | Sửa giới hạn thời gian / phép đếm lỗi thời trong `ecosystem-full`, `audit-closure`, `g1b-lifecycle`; cập nhật tài liệu này. |

## Đã đo được

**Chạy lại h288 → h336 (seed 7606, không có người chơi) trên `43e4713`:**

| | `6d2dec8` | `43e4713` |
|---|---|---|
| Save lớn nhất | 18,53 MB | 4,11 MB |
| Phần tìm đường lớn nhất | 16 MB | 2,17 MB |
| Sơ tán | 6 | 6 (tàu `po_evac_west` chở 6/6, cập bến h296) |
| Sống sót trên đảo | 38 | 34 |
| Chết | 242 | 246 |
| Elder chạm khu dân cư | 0 | Aion, Anubis, Typhon, Argus (Surtur và Atlas bị biển chặn) |
| Dân bị đe doạ / được lính che và sống | 0 / 0 | 11 / 3 |

Đây là chạy lại từ save h288 bằng bài kiểm thử tạm, **không phải** bài endurance 336 giờ chính thức và chưa qua `npc-campaign-gate`.

**Lỗi của `8d882e6`:** bản giới hạn đầu tiên đóng sớm các lượt tìm đường dài. Chạy lại từ h288 thì không ai sơ tán được (0 người tới h307, trong khi bản gốc có 6 người cập bến lúc h295). `43e4713` thay bằng hàng chờ và kết quả sơ tán trở lại như bản gốc.

**Trình duyệt (Chromium 131, 640×360, bản build `01021db`, không lỗi trang):**

- Màn hình chính chỉ còn `New run` và `Profile & history`; chọn thế giới chỉ còn VEYRA; F9 không mở gì.
- Ván mới: 286 dân, 0 người có tên lệch nghề.
- Mở save h264 của bản cũ (người chơi đã chết, biên nhận tử vong đã bị đẩy khỏi sổ): bảng tử vong báo túi ở (37, 121), 3 chồng đồ; tên dân được sửa khi tải; save ghi lại còn 1,97 MB.
- Mở save h335 mới (2,26 MB): lưu được vào localStorage, chạy tiếp qua h336 và hiện màn kết "Consumed by Ragnarok — Reached safe water 6 · Survived on the island 34 · Died 246". Trước đây save h335 (17,7 MB) không lưu nổi.

**Kiểm thử:** `typecheck` và `typecheck:tests` sạch; build chạy được. Trong 38 tệp đỏ ở `6d2dec8`: 16 tệp đã xanh, còn 22 tệp đỏ (143 → 33 bài hỏng).

## Elder vượt biển (quyết định Creator 2026-11-21)

Elder đi thẳng tới khu dân cư còn người gần nhất, băng qua biển nếu cần, vẫn 40 ô/giờ; chỉ dừng khi đã đứng trên đất, cách dân 24 ô. Đợt đánh cuối (≤ 64 ô) cũng không còn bị nước sâu chặn; vách đá, tường và vật cản vẫn chặn.

Chạy lại h288 → h336 (seed 7606, không có người chơi):

| | Chưa vượt biển (`43e4713`) | Vượt biển |
|---|---|---|
| Sơ tán / sống sót / chết | 6 / 34 / 246 | 6 / 34 / 246 |
| Elder chạm khu dân cư | 4 | 5 (thêm Atlas: bơi 490 ô biển, lên bờ, đánh `po_netcamp` 2 đợt) |
| Dân bị đe doạ / bị trúng / được lính che và sống | 11 / 8 / 3 | 16 / 12 / 5 |
| Save lớn nhất | 4,11 MB | 4,11 MB |

Ở 40 ô/giờ Surtur không kịp: khu dân cư gần nhất (`po_saltpans`) cách 1.063 ô, cần khoảng 26,6 giờ trong khi chỉ có 24 giờ.

### Bơi nhanh gấp đôi đi bộ (quyết định Creator 2026-11-21, phương án 3)

Trên đất vẫn 40 ô/giờ; trong biển 80 ô/giờ. Chạy lại h312 → h336 từ save h312 của lần chạy trên:

| | Vượt biển, 40 ô/giờ | Bơi 80 ô/giờ |
|---|---|---|
| Sơ tán / sống sót / chết | 6 / 34 / 246 | 6 / 34 / 246 |
| Elder chạm khu dân cư | 5 | 6 (cả sáu) |
| Surtur | còn cách dân 145 ô lúc h335 | đánh `po_saltpans` 2 đợt |
| Atlas | đánh `po_netcamp` 2 đợt | đánh `po_netcamp` 4 đợt |
| Dân bị đe doạ / bị trúng / được lính che và sống | 16 / 12 / 5 | 18 / 15 / 5 |

Bốn Elder trên đất liền (Aion, Typhon, Argus, Anubis) đánh đúng số đợt như trước.

## Endurance 336 giờ chính thức trên `fc63741` (seed 7606, không có người chơi)

Chạy một mạch 336 giờ, thoát mã 0, không sập lần nào (bản `6d2dec8` sập ở h299 và phải chạy tiếp). `npc-campaign-gate`: **15/15 đạt** (bản `6d2dec8`: 14 đạt, 1 hỏng ở điều kiện "cùng một ván có người sơ tán tới nơi VÀ có dân được lính che sống sót").

| | `6d2dec8` | `fc63741` |
|---|---|---|
| Sơ tán / sống sót / chết | 6 / 38 / 242 | 6 / 34 / 246 |
| Save lớn nhất | 20,17 MB | 3,97 MB (h297) |
| Elder chạm khu dân cư | 0 / 6 | 6 / 6 — 18 đợt CONTACT tính tới h335 |
| Dân bị đe doạ / bị trúng đòn / được lính che và sống | 0 / 0 / 0 | 14 / 11 / 3 |
| Tổng thời gian máy | 6.345 giây (có một lần sập) | 6.521 giây |

Từng Elder: Surtur → `po_saltpans` (2 đợt, sau khi bơi qua biển), Typhon → `po_falls` (3), Aion → `po_ranger` (5), Atlas → `po_fishcamp` (3), Argus → `po_rapids` (3), Anubis → `po_fishcamp` (2). Tàu `po_evac_west` chở 6 người cập bến. Kết quả ở `/home/user/acc/endurance2` (không nằm trong repo).

**Dân chết vì đói và khát, không phải vì Elder.** Phân tích save h24: cả 286 người khởi đầu với đói 70 / khát 70; khát về 0 sau khoảng 11 giờ, đói sau khoảng 17 giờ. Tới h24 đã chết 110 người (44 người khát = 0, 66 người đói = 0, không ai chết vì lý do khác); 21 trong 68 cộng đồng không còn ai. Tới h235 đã chết 235 người — trước khi Elder thức dậy ở h312. Khoảng 20 người khởi đầu ở trạng thái gục, 1 HP, một vết thương chưa chữa. Đường cong tử vong giống hệt bản `6d2dec8`: đây là lỗ hổng thiết kế có sẵn, cần Creator quyết định, không phải lỗi mới.

## Kiểm thử (sau commit này)

Trong 22 tệp còn đỏ ở `01021db`: **21 tệp đã xanh**, còn 1 tệp đỏ thật (`npc-runtime-throughput`, xem dưới). `typecheck` và `typecheck:tests` sạch.

**Regression trên `d743ffa`** (mỗi tệp một tiến trình, giới hạn 900 giây; 255 trong 261 tệp — 6 tệp chậm chạy riêng):

| | `6d2dec8` (260 tệp) | `d743ffa` (255 tệp) |
|---|---|---|
| Tệp đạt | 203 | 241 |
| Tệp đỏ thật | 38 | 1 (`npc-runtime-throughput`, quá 90 giây) |
| Tệp chỉ có bài tự chọn bật (toàn bộ bỏ qua) | 13 | 13 |
| Tệp quá 900 giây | 6 | (6 tệp này không nằm trong lượt chạy) |
| Bài đạt / hỏng | 1.330 / 143 | 1.519 / 1 |

Không tệp nào từng xanh ở `6d2dec8` mà nay đỏ. Kết quả ở `/home/user/acc/reg2` (ngoài repo).

`g1b-lifecycle` chạy riêng tới hết (55 phút): 9/11 đạt; 2 bài còn lại chạy xong không lỗi kiểm chứng nhưng vượt giới hạn 300 giây ghi trong tệp (mất 18 và 36 phút). Bốn tệp chậm còn lại đang chạy riêng; `economic-network-m2` chưa chạy lại (ước tính nhiều giờ).

Sáu tệp bằng chứng được Git theo dõi vẫn bị bài kiểm thử ghi đè mỗi lần chạy (`evidence/g1a/tool-matrix.json`, `evidence/item-network/*`, `reports/economic-network/SOH_ECONOMIC_GRAPH.json`, `SOH_ITEM_FUNCTION_AUDIT.csv`, `reports/mec01-five-chain-benchmark.json`) — chưa xử lý.

Nguyên nhân chung: bài kiểm thử viết cho luật cũ, game đã đổi luật. Các thay đổi đáng chú ý:

- `mec01-c1-motorbike-chain` — viết lại theo chuỗi xe máy của Sổ cái rev 6; giá đọc từ catalog; tệp bằng chứng `evidence/mec01-c1/motorbike-chain.json` có dạng mới.
- `wp3-veyra-recycler-integration` — viết lại: Damaged Drive, Scrap và Machine Parts đã bị rút, Veyra không còn nguồn `wreck`. Bài mới: nhặt gỗ, đá, sợi bằng Gậy gỗ → tự tay làm Cuốc đá → cạy Relay Wreck / Salvage Bale ven đường lấy Parts và một linh kiện máy → tái chế linh kiện đó ở `po_slag` → xuống Tầng −1, lưu, tải lại. **Bỏ** phần "tiêu Parts để dựng máy phát và khung xe" (đã có `mec01-c1` che).
- `item-ontology-v2` — 7 bài cập nhật theo item set v3; sinh lại 9 tệp trong `web/ref/item-ontology-v2/`. Phần P2 (Fasteners) giờ ghi "SUPERSEDED": không còn công thức nào dùng Fasteners.
- `mec01-r8b-plank` — bài mới khẳng định **Tường ván không thể đặt được** (chỉ có qua nâng cấp, nhưng không có đường nâng cấp nào dẫn tới nó). Tường gạch cũng vậy. Đây là lỗ hổng của game.
- `mec01-r6-homecoming` — heo rừng được đặt sẵn trong tầm bắn và đánh dấu đã bị khiêu khích; kịch bản gốc (heo theo người chơi về tận cửa) không còn xảy ra trong game.
- `control-tower-corrective-wp1-wp2` — so sánh vườn trong / ngoài màn hình nới thành sai số 1e-9 và ±1 ms; giới hạn thời gian 30 giây → 900 giây.
- `ITEM_CRAFTING_MASTER.json/.md` sinh lại: dao là đồ chỉ có trong thế giới, Gậy gỗ là đồ khởi đầu.

## Tăng tốc mô phỏng dân cư — phương án 1 (đã làm)

**Thay đổi luật (chỉ khi tua ngoại tuyến: vắng mặt, "While you were away", kiểm thử tua giờ).** Ba loại thời điểm dày đặc của dân cư — xét lại kế hoạch, xét cấp cứu, bước tới ô kế tiếp — được làm tròn lên nhịp 1 giây chung. Các mốc có nhân quả (xong việc, ngưỡng đói khát, chảy máu, đợt Elder, tàu cập bến) giữ nguyên thời điểm chính xác. Khi người chơi đang chơi trực tiếp, không có gì thay đổi.

**Tốc độ đo được (seed 7606, 286 dân, không có người chơi):**

| | Trước (`6cb4846`) | Sau (`eca8d96`) |
|---|---|---|
| Giờ thế giới thứ 1 | 177 giây, 60.254 lát cắt | **~80–84 giây**, 6.317 lát cắt |
| Giờ thứ 2 | 81 giây | ~30 giây |
| Giờ thứ 3 | 63 giây | ~17 giây |
| Giờ thứ 24 (trong lượt 336 giờ) | 33 giây | 16 giây |
| Cả 336 giờ | 6.521 giây | **4.019 giây** (chạy chung máy với regression) |
| `npc-runtime-throughput` (giới hạn 90 giây) | 186 giây — đỏ | **80 giây — xanh** (chạy riêng; dư 10 giây) |

Gần một nửa giờ đầu tiên (≈40 giây) là dựng địa hình vùng lần đầu, chưa tối ưu. Thời gian "While you were away" trên trình duyệt **chưa đo lại**.

**Tác dụng phụ đã thấy và đã sửa — người đứng kẹt quanh kho.** Sau khi đổi nhịp, ở Hook (và nơi khác) dân rảnh đứng thành cụm quanh kho; người có việc không lách qua được: ruộng chín hơn 40 phút không ai gặt. Hai sửa đổi trong luật đi lại (áp dụng cả khi chơi trực tiếp):

1. Người rảnh bị kẹt giữa các đồng đội rảnh khác: vòng ngoài nhường trước một bước. Người nhường ưu tiên ô **không** nằm trên lối người kia sắp đi, **không** nằm sát quầy kho, và không quay lại ô vừa rời. (Trước đó hai người có việc ngược hướng đẩy một người rảnh qua lại giữa hai ô mãi mãi.)
2. Người đang đi bị chặn bởi người đang bận: thử một lối khác tới đúng ô đích, chỉ nhận nếu bước đầu đang trống.

**Lỗi do chính tôi gây ra ở `0fa58e2` và đã sửa ở `eca8d96`:** lối đi thay thế có thể dừng **cách đích một ô**. Hậu quả: người sơ cứu đứng cách nạn nhân 2 ô nên bị từ chối chữa; thợ xây đi lấy vật liệu 3 lần. Lượt regression và endurance chạy trên `0fa58e2` đã bị huỷ, không dùng số liệu nào từ đó.

**Kết quả mô phỏng thay đổi nhẹ, không giống hệt bản cũ** (336 giờ, cùng seed):

| | `fc63741` (trước) | `eca8d96` (sau) |
|---|---|---|
| Cổng chiến dịch | 15/15 | **15/15** |
| Sơ tán / sống sót / chết | 6 / 34 / 246 | 6 / 33 / 247 |
| Chết tới h24 / h96 / h235 | 110 / 192 / 235 | 106 / 186 / 234 |
| Lượt gục (`human.down`) | 389 | **588 (+51 %)** |
| Lượt được chữa | 265 | 402 |
| Chuyến giao hàng về kho | 2.732 | 3.267 (+20 %) |
| Vụ gặt ruộng / món nấu có trả công | 14 / 5 | 24 / 15 |
| Lượt nhường đường | 50.864 | 33.594 |
| Biên nhận `elder.contact` | 20 | 22 |
| Save lớn nhất | 3,97 MB | 4,14 MB |

Dân vẫn chết vì đói khát với số lượng như cũ. Số lượt gục tăng một nửa (gục rồi được chữa rồi gục lại) — chưa phân tích nguyên nhân.

**Bài kiểm thử phải chỉnh mốc thời gian** (cùng chuỗi sự kiện, khác giây): `npc-guard-response` (điểm kiểm +1 giây), `npc-natural-cook` (theo dõi món ăn tới khi vào kho thay vì mốc cố định), `npc-natural-procurement` (dừng ở món đầu tiên có Tin Can), `npc-hook-boar-stew` (cho 5 phút để nồi được bắc; đầu bếp đang chờ có thể đã nhường một bước), `npc-natural-harvest` (chỉ xét dòng thu hoạch, vì món nấu đầu tiên nay kịp vào sổ kho trong 2 phút). Bài mới: `npc-offline-beat` (3 bài).

## Regression trên `eca8d96` (262 tệp, mỗi tệp một tiến trình, giới hạn 1.800 giây)

| Kết quả | Số tệp | Ghi chú |
|---|---|---|
| Đạt | **243** | 1.541 bài đạt. Toàn bộ 59 tệp `npc-*` không tự chọn đều xanh, kể cả `npc-runtime-throughput`. |
| Chỉ có bài tự chọn bật (bỏ qua hết) | 13 | Như trước. |
| Đỏ vì giới hạn thời gian / phép đếm lỗi thời — **đã sửa ở commit này** | 2 | `g1b-lifecycle` (10/11; bài rương cần ~10 phút, giới hạn cũ 5 phút — chạy lại riêng bài đó: đạt sau 627 giây). `ecosystem-full` (5/7 → chạy lại cả tệp: **7/7 trong 930 giây**; phép đếm "14 công thức luôn biết" đã lỗi thời từ đợt PA1, nay là 13 + 24 công thức đặt thiết bị). |
| **Đỏ thật, chưa sửa** | 1 | `arena1-round2-newgame-routes`: 3/4. Tuyến DẦU dừng ở bước "bơm dầu thô" với lý do "no wood for fuel" (bot không tìm được gỗ làm chất đốt). Chưa điều tra; chưa biết có phải do đợt tăng tốc hay không vì tệp này chưa từng có kết quả trên mã mới. |
| Hết 1.800 giây chưa xong | 2 | `review-r2-acceptance`: 4 bài đầu đạt, bài P1-5 (135 sinh vật bị thương ngoài màn hình) chạy mãi không xong. `audit-closure`: không bài nào xong (bài đầu tua 312 giờ thế giới có dân ≈ hơn 1 giờ máy). |
| Chưa chạy | 1 | `economic-network-m2` (tua 336 giờ nhiều lần; tôi dừng lượt chạy trước tệp này). |

Phép đếm trong `audit-closure` cũng được sửa giống `ecosystem-full` nhưng **chưa được kiểm chứng bằng một lượt chạy**. Kết quả từng tệp ở `/home/user/acc/reg5` (ngoài repo). Đây vẫn là lượt dò lỗi, chưa phải lượt khoá SHA.

## Chưa làm

- Điều tra tuyến DẦU của `arena1-round2-newgame-routes` ("no wood for fuel").
- Ba tệp tua hàng trăm giờ (`audit-closure`, `review-r2-acceptance`, `economic-network-m2`) vẫn chưa có kết quả đầy đủ; cần tăng tốc thêm hoặc Creator quyết định cách nghiệm thu khác.
- Phân tích vì sao số lượt gục tăng 51 % sau khi đổi nhịp.
- Đo lại thời gian "While you were away" trên trình duyệt với mã mới.
- Chạy lại đủ 261 tệp trên SHA cuối cùng (lượt trên là để dò lỗi sớm, chưa phải lượt khoá SHA).
- Kiểm tra trên trình duyệt: cộng dồn gỗ (mới có bài kiểm thử đơn vị), cảnh A–I, xây dựng, chiến đấu, giao dịch, sơ tán thủ công; Elder bơi qua biển chưa từng được nhìn thấy trên màn hình.
- ZIP phát hành, Vercel, tài liệu hướng dẫn, PR vào `main`.
