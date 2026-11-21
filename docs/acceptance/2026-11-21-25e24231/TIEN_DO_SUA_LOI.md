# Tiến độ sửa lỗi sau nghiệm thu `6d2dec8`

Cập nhật: 2026-11-21 (lần 3). Nhánh `arena/0f6091f9-soul-of-hero`. Chưa đẩy lên GitHub, chưa có PR, chưa phát hành.

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
| (commit này) | Đưa 21 tệp kiểm thử đỏ về xanh theo luật hiện hành của game; sinh lại tài liệu ontology. Không đổi mã game chạy thật. |

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

## Vấn đề tốc độ mô phỏng dân cư (mới xác định)

- `npc-runtime-throughput` yêu cầu giải quyết 1 giờ thế giới với đủ 286 dân trong 90 giây; máy này cần **181 giây** (bản `6d2dec8` cũng 182 giây). Đỏ từ trước, chưa sửa.
- Đo trực tiếp: 1 giờ thế giới Veyra **không có dân mất 0,11 giây, có dân mất 50–180 giây**.
- Đây chính là lý do 6 tệp "treo" (`economic-network-m2`, `g1b-lifecycle`, `audit-closure`, `ecosystem-full`, `review-r2-acceptance`, `arena1-round2-newgame-routes`): chúng không treo, chúng tua hàng chục đến hàng trăm giờ thế giới trên bản đồ có dân. Riêng `economic-network-m2` tua 336 giờ nhiều lần.
- Người chơi cũng chịu: mở lại save sau 1 giờ vắng mặt, màn "While you were away" chạy **91 giây** trong trình duyệt (save h8 → h9, Chromium 131).

## Chưa làm

- Tăng tốc mô phỏng dân cư (hoặc quyết định khác cho 7 tệp trên).
- Chạy lại đủ 261 tệp trên SHA cuối cùng (lượt trên là để dò lỗi sớm, chưa phải lượt khoá SHA).
- Kiểm tra trên trình duyệt: cộng dồn gỗ (mới có bài kiểm thử đơn vị), cảnh A–I, xây dựng, chiến đấu, giao dịch, sơ tán thủ công; Elder bơi qua biển chưa từng được nhìn thấy trên màn hình.
- ZIP phát hành, Vercel, tài liệu hướng dẫn, PR vào `main`.
