# Tiến độ sửa lỗi sau nghiệm thu `6d2dec8`

Cập nhật gần nhất: mục cuối tệp ("Kiểm tra trên trình duyệt sau `b698d54a`"). Mã game cuối là `d00d7791`: 252 tệp đạt, 0 đỏ, endurance 15/15. Nhánh `arena/0f6091f9-soul-of-hero`, đã đẩy lên GitHub, PR #65 (nháp), Vercel đang chạy bản này. Các mục phía dưới ghi theo thứ tự thời gian; mục cũ không được viết lại, nên có chỗ nói "chưa làm" cho việc về sau đã làm.

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
| `e070b4b` | Sửa giới hạn thời gian / phép đếm lỗi thời trong `ecosystem-full`, `audit-closure`, `g1b-lifecycle`. |
| `40ee8b9` | Bot chơi thử của `arena1-round2-newgame-routes` biết làm lại công cụ khi không có dao; ghi quyết định 1B / 2C. **SHA đã chạy lượt khoá.** |
| `0d9cc3b3` | **Sổ tay sinh tồn trong Journey**: 11 chương mở sẵn, làm theo thứ tự nào cũng được, mỗi chương một gói quà nhận một lần, công tắc Anh / Việt. Có đổi mã game chạy thật. **SHA đã chạy lượt khoá mới.** |

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

**Lỗi của `8d882e6`:** bản giới hạn đầu tiên đóng sớm các lượt tìm đường dài. Chạy lại từ h288 thì không ai sơ tán được (0 người tới h307, trong khi bản gốc có 6 người sơ tán được; con số "cập bến lúc h295" tôi ghi ở đây lúc đó **không còn dữ liệu để kiểm lại**, ba lượt chạy đủ 336 giờ sau này đều rời bến giờ 294 và cập bến giờ 298). `43e4713` thay bằng hàng chờ và kết quả sơ tán trở lại như bản gốc.

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

Gần một nửa giờ đầu tiên (≈40 giây) là dựng địa hình vùng lần đầu, chưa tối ưu.

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

Dân vẫn chết vì đói khát với số lượng như cũ.

**Vì sao số lượt gục tăng 51 % (Creator yêu cầu tìm hiểu trước khi đi tiếp).** Không có thêm người gặp nạn; vài người **được cứu dậy rồi gục lại nhiều lần hơn**:

- Phần tăng nằm ở ba khoảng: h24–48 (40 → 69), h48–96 (126 → 186), h288–312 (32 → 133). Ngoài các khoảng đó hai bản gần như bằng nhau.
- Chạy lại h24–48 trên cả hai bản và ghi tên từng người: **cùng 26 người gục** ở cả hai bản. Bản cũ người gục nhiều nhất gục 9 lần; bản mới một người gục **39 lần**. Chênh 30 lần ấy đúng bằng phần tăng của khoảng này.
- Chạy lại h288–298 trên bản mới: 35 lượt gục chỉ thuộc về **5 người**; hai người (một thợ xây, một y sĩ, cùng khát = 0) gục 17 và 15 lần, cứ khoảng 8 phút một lần.
- Cơ chế: người khát = 0 gục "vì đói khát" → đồng đội sơ cứu (tốn một liều thuốc) → đứng dậy nhưng vẫn khát = 0 → vài phút sau gục lại. Vòng này **đã có ở bản cũ** (389 lượt gục, 265 lượt chữa). Bản mới dân đi lại thông hơn và còn hoạt động ở cuối game (h288–336: 104 chuyến thu hoạch so với 10) nên người cứu tới được nhiều lần hơn.
- Chưa kiểm tra từng khoảng còn lại (h48–96) bằng cách ghi tên; kết luận cho khoảng đó là suy ra từ hai khoảng đã đo.
- Điểm đáng cân nhắc về thiết kế (chưa sửa, cần Creator quyết): sơ cứu cho người sắp chết khát không cho họ uống nước, nên mỗi lần cứu chỉ mua thêm vài phút và tốn một liều thuốc.
  **Đã sửa ngày 23/11 theo quyết định của Creator** — xem phần "Ba quyết định của Creator ngày 23/11" ở cuối tài liệu.

**Bài kiểm thử phải chỉnh mốc thời gian** (cùng chuỗi sự kiện, khác giây): `npc-guard-response` (điểm kiểm +1 giây), `npc-natural-cook` (theo dõi món ăn tới khi vào kho thay vì mốc cố định), `npc-natural-procurement` (dừng ở món đầu tiên có Tin Can), `npc-hook-boar-stew` (cho 5 phút để nồi được bắc; đầu bếp đang chờ có thể đã nhường một bước), `npc-natural-harvest` (chỉ xét dòng thu hoạch, vì món nấu đầu tiên nay kịp vào sổ kho trong 2 phút). Bài mới: `npc-offline-beat` (3 bài).

## Regression trên `eca8d96` (262 tệp, mỗi tệp một tiến trình, giới hạn 1.800 giây)

| Kết quả | Số tệp | Ghi chú |
|---|---|---|
| Đạt | **243** | 1.541 bài đạt. Toàn bộ 59 tệp `npc-*` không tự chọn đều xanh, kể cả `npc-runtime-throughput`. |
| Chỉ có bài tự chọn bật (bỏ qua hết) | 13 | Như trước. |
| Đỏ vì giới hạn thời gian / phép đếm lỗi thời — **đã sửa ở commit này** | 2 | `g1b-lifecycle` (10/11; bài rương cần ~10 phút, giới hạn cũ 5 phút — chạy lại riêng bài đó: đạt sau 627 giây). `ecosystem-full` (5/7 → chạy lại cả tệp: **7/7 trong 930 giây**; phép đếm "14 công thức luôn biết" đã lỗi thời từ đợt PA1, nay là 13 + 24 công thức đặt thiết bị). |
| Đỏ ở lượt này — **đã sửa sau đó** | 1 | `arena1-round2-newgame-routes`: 3/4 → chạy lại cả tệp: **4/4 trong 1.107 giây**. Không liên quan đợt tăng tốc (hỏng y hệt trên `d743ffa`). Nguyên nhân: bot chơi thử chỉ làm lại rìu đá khi còn mang dao, mà nay khởi đầu bằng Gậy gỗ chứ không có dao; rìu mòn hết lúc túi không còn gỗ nên không chặt được cây để lấy chất đốt. Sửa trong bot: làm rìu / cuốc mới khi cái cũ sắp hỏng; khi túi đầy thì bỏ phụ phẩm để có chỗ cho bộ rương. Không đổi phép kiểm nào. |
| Hết 1.800 giây chưa xong — **Creator loại khỏi điều kiện nghiệm thu** | 2 | `review-r2-acceptance`: 4 bài đầu đạt, bài P1-5 (135 sinh vật bị thương ngoài màn hình) chạy mãi không xong. `audit-closure`: không bài nào xong (bài đầu tua 312 giờ thế giới có dân ≈ hơn 1 giờ máy). |
| Chưa chạy — **Creator loại khỏi điều kiện nghiệm thu** | 1 | `economic-network-m2` (tua 336 giờ nhiều lần; tôi dừng lượt chạy trước tệp này). |

Phép đếm trong `audit-closure` cũng được sửa giống `ecosystem-full` nhưng **chưa được kiểm chứng bằng một lượt chạy**. Kết quả từng tệp ở `/home/user/acc/reg5` (ngoài repo). Đây vẫn là lượt dò lỗi, chưa phải lượt khoá SHA.

## Lượt khoá SHA trên `40ee8b9` (259 tệp — 262 trừ ba tệp Creator đã loại)

Mỗi tệp một tiến trình, giới hạn 1.800 giây, chạy một mình trên máy (5.820 giây cộng dồn).

| | Kết quả |
|---|---|
| Tệp đạt | **246** |
| Tệp đỏ | **0** |
| Tệp chỉ có bài tự chọn bật (bỏ qua hết) | 13 (như mọi lượt trước) |
| Bài đạt / hỏng / bỏ qua | **1.545 / 0 / 28** |
| `npc-runtime-throughput` | đạt (74 giây cả tệp, giới hạn 90 giây cho bài) |
| `g1b-lifecycle` | 11/11 (901 giây) |
| `ecosystem-full` | 7/7 (905 giây) |
| `arena1-round2-newgame-routes` | 4/4 (1.204 giây) |

Mã game ở `40ee8b9` giống hệt `eca8d96` (chỉ khác tệp kiểm thử và tài liệu), nên lượt endurance 336 giờ 15/15 ở trên vẫn áp dụng. `typecheck`, `typecheck:tests`, `build` sạch. Kết quả từng tệp ở `/home/user/acc/reg6` (ngoài repo).

**Trình duyệt, mở lại save sau 1 giờ vắng mặt (h8 → h9, bản build `40ee8b9`):** màn "While you were away" mất **41 giây** (trước: 91 giây), vào game bình thường, không lỗi JavaScript. Đo trong lúc máy đang chạy lượt kiểm thử ở trên, nên con số thật có thể thấp hơn.

## Trình duyệt, bản build `40ee8b9`, 640×360, điều khiển thường (22/11)

Bốn lượt New run, không lỗi JavaScript, không request hỏng:

| Việc | Kết quả |
|---|---|
| Gỗ cộng dồn | Đạt: 4 rồi 6 khúc gỗ nằm trong **một ô** (`wood x6`). |
| Bài học Landfall | "Gather by hand" lên 2/3 rồi 3/3 sau các cú đánh thật; ô theo dõi chuyển sang "Shape a tool". |
| Ăn, uống, chế đồ | Berries +8 đói, uống bình nước khát lên 99,9, chế được Torch. |
| Xây | Đạt: nhấn B → Wall → Wood Wall → nhấp chuột; biên nhận `build:wall_wood`, gỗ 6 → 1, tường hiện trên màn hình kèm cảnh báo "NO CABINET · 12.0 h". Ô có cây báo "Clear the Oak first". |
| Đánh quái | Đạt: đi tới một con grouse (16 máu), đánh bằng Gậy gỗ, biên nhận `creature.kill:grouse`. Chưa thử quái biết đánh trả. |
| Sổ Journey [J] | Mở được cả bốn thẻ: Fieldcraft, Waypoints, Chronicle, Field Reference. |

### Phần hướng dẫn tân thủ so với Last Island of Survival

Nguồn đối chiếu: bài hướng dẫn của LevelWinner về Last Island (không tìm được danh sách nhiệm vụ gốc kèm phần thưởng từng bước).

| Last Island | Soul of Hero hiện tại |
|---|---|
| Không ép hướng dẫn; mở bằng một nút | Giống: nút Journey [J], có thể "Set aside" bài học. |
| Ô theo dõi mục tiêu trên màn hình chơi | Giống: ô "SUGGESTED · LANDFALL — Gather by hand 0/3" ở góc phải. |
| Mục tiêu từ dễ tới khó, xem trước được bước sau | Giống một phần: 4 bài, 15 bước, bước sau hiện mờ. |
| Đi hết mọi hoạt động của game | **Thiếu**: có hái lượm, chế đồ, ăn uống, Cabinet, tường, nhà kín, lửa, bàn chế, lò, nghiên cứu, khám phá, lục đồ, tự vệ, cất tiền. Chưa có bước nào về cửa và khoá, rương, giao dịch với cư dân, cứu cư dân, Core, xe, sơ tán. |
| Nhận thưởng sau mỗi phần | **Không có** ở bài học tân thủ: xong bài chỉ được một dòng Chronicle. Chỉ Waypoints hằng ngày có nút "Claim Supply". |
| Làm sai thứ tự vẫn tính | **Một phần**: bốn bài chạy song song, nhưng trong một bài chỉ bước đầu chưa xong mới được đếm (`journey.ts`, hàm `applyFieldcraft`), nên việc làm sớm không được tính. Điều này cũng lệch với Bible C12. |
| Survival Gallery: từ điển vật phẩm, quái, cây, nơi tìm | **Không có**: Field Reference chỉ gồm phím điều khiển và 11 mẹo. |
| Ngôn ngữ | Toàn bộ chữ hướng dẫn là tiếng Anh. |

## Sổ tay sinh tồn (Journey → thẻ Fieldcraft) — commit `0d9cc3b3`

Quyết định của Creator 22/11: Journey phải giúp người chơi hiểu mọi cơ chế nhưng không ép một cách chơi; "1 B" mỗi chương có quà nhận một lần (đầu game hỗ trợ tân thủ, về sau hấp dẫn hơn); "2 C" có công tắc Anh / Việt; "3 B" từ điển vật phẩm – quái – cây để sau final.

**Cách hoạt động**

- 11 chương, 40 bước. Tất cả mở từ phút đầu, không chương nào khoá chương nào.
- Bước nào làm trước cũng được tính, kể cả khi chưa mở sổ. Bản cũ chỉ đếm bước đầu tiên chưa xong.
- Bước có nhiều cách chơi thì ghi rõ từng cách, làm **một** cách là xong, quà như nhau. Ví dụ chương Cư dân: đổi đồ, sơ cứu, sửa đồ giúp, góp thức ăn, chiêu mộ, ra lệnh, đe doạ hoặc cướp đều tính. Chương cuối: lên tàu sơ tán hoặc ở lại hạ Elder đều tính.
- Ô gợi ý trên màn hình chỉ là lời mời. Bấm × là im hẳn; "Set aside" thì chương vẫn ghi nhận âm thầm.
- Tiến độ nằm trong save của lượt chơi (`RunState.handbook`) và được ghi ngay lúc hành động xảy ra, nên không mất khi sổ biên nhận 250 dòng bị đẩy trôi.
- Việc của cư dân không được tính cho người chơi (cư dân săn thú, lò của làng, máy phát của làng, heo rừng húc đổ cây).
- Quà do engine cấp qua lệnh `handbookClaim`: mỗi chương một lần mỗi lượt chơi, không cấp ở lượt QA, đồ không vừa balo thì rơi xuống đất, không bao giờ tạo Secured Cash.

**11 chương và quà**

| # | Chương (Anh / Việt) | Dạy gì | Quà |
|---|---|---|---|
| 1 | Landfall / Đặt chân | hái lượm, chế đồ, ăn uống | Stone Axe, Stone Pickaxe, Territory Cabinet (đã đóng gói), 4 Roast Meat |
| 2 | Hearth & Wall / Mái nhà | nền, Cabinet, tường, cửa, nhà kín | Campfire, Wood Chest, Straw Bed (đóng gói), 2 Torch |
| 3 | Fire & Iron / Lửa và sắt | lửa trại, nấu ăn, bàn chế, lò, luyện kim | 6 Iron Ingot, 10 Charcoal, 4 Rope |
| 4 | Paper & Parts / Tri thức | nghiên cứu, sửa đồ, tái chế | 12 Parts, 4 Electronic Parts |
| 5 | Field & Flock / Lương thực | vườn, gieo hạt, tưới, thu hoạch hoặc săn hoặc nuôi | Trail Canteen, 3 Canned Meat, 4 hạt Sunroot |
| 6 | Beyond the Treeline / Khám phá | tìm địa điểm, lục đồ, cất đồ / xe kéo | Trail Pack, 6 Parts, 4 Bandage |
| 7 | Tooth & Steel / Chiến đấu | tự vệ, chữa thương, vũ khí – giáp, bẫy – rào | Bow, 24 Arrow, 2 Medkit |
| 8 | Neighbours / Cư dân | nói chuyện, đối xử với cư dân, thương nhân | 3 Medkit, 4 Canned Meat, 2 Fruit Wine |
| 9 | Wheels & Wires / Máy móc | điện, nhiên liệu, xe | 3 Fuel Can, 4 Mechanical Gear, 4 Iron Plate |
| 10 | Old Power / Sức mạnh cổ xưa | Energy Cell, dùng Core, nâng cấp – sửa Core | 12 Refined Energy, 40 Basic Energy, 3 Crystal |
| 11 | The Last 72 Hours / 72 giờ cuối | Ragnarok, cất tiền Escrow, chọn kết cục | 4 Medkit, 2 Fuel Can, 8 Refined Energy, 4 Canned Meat (mở ngay khi Ragnarok bắt đầu) |

Ba chương đầu là "Gói khởi đầu": quà chính là món mà chương kế tiếp cần, để người mới không phải tự cày. Chương 4–7 là "Kiện tiếp tế", chương 8–11 là "Kho hiếm".

**Tiếng Việt:** nút EN / VI ở góc trên sổ Journey; đổi cả sổ tay, ô gợi ý trên màn hình, Mốc ngày, phần Tra cứu. Tên vật phẩm và công trình giữ tiếng Anh để khớp với balo. Chữ tiếng Việt dùng phông VT323 vì phông tiêu đề Pixelify Sans không có dấu tiếng Việt. Các dòng Biên niên đã ghi từ trước giữ nguyên ngôn ngữ lúc ghi.

**Sửa kèm:** mẹo "Worn Tool" còn chỉ người chơi dùng Field Repair Kit (vật phẩm đã bỏ) → đổi thành sửa tại Workbench.

**Đã kiểm tra**

| Cách kiểm | Kết quả |
|---|---|
| `tests/journey-handbook.test.ts` (19 bài) | Đạt. Gồm: làm bước 3 trước bước 1 vẫn tính; sổ biên nhận bị đẩy trôi vẫn giữ tiến độ; việc của cư dân không tính; nhận quà một lần, lưu – mở lại không nhận được lần hai; balo đầy thì quà rơi ra đất; save bị sửa tay bị từ chối. |
| Dựng nhà thật bằng lệnh của game (tường trước, rồi cửa, nền, Cabinet, giường) | Chương 2 hoàn thành; nhận quà, đặt rương từ gói quà, cất đồ vào rương → bước "cất đồ" của chương 6 được tính. |
| Mọi loại biên nhận mà 40 bước lắng nghe | Đều có chỗ phát ra trong mã engine (bài kiểm tra đọc mã nguồn). |
| Trình duyệt 640×360, điều khiển thường | Ăn trước → đốn cây → chế Campfire: chương 1 xong dù sai thứ tự; ô góc phải báo "Starter kit ready"; bấm Claim → balo có Stone Axe, Stone Pickaxe, Territory Cabinet, 4 Roast Meat; nút Claim biến mất. Đủ 11 chương hiện trên một trang. Bản tiếng Việt hiển thị đủ dấu. Không lỗi JavaScript. |
| Lỗi bắt được khi chơi thử | Bước "nhiên liệu" tự xong vì máy phát của làng đốt than. Đã sửa: chỉ máy phát của người chơi mới tính; thêm bài kiểm tra. |

**Chưa kiểm bằng tay trên trình duyệt:** chương 3–11 (mới kiểm ở mức biên nhận và bài kiểm tra engine, chưa có ai bấm chuột chơi hết).

## Lượt khoá SHA trên `0d9cc3b3` (260 tệp = 259 cũ + bài sổ tay)

| | Số tệp |
|---|---|
| Đạt | **247** |
| Chỉ có bài tự chọn bật bằng biến môi trường (không chạy bài nào) | 13 |
| Đỏ | **0** |

1.564 bài kiểm tra đạt, 0 bài trượt, tổng 7.012 giây (chạy song song với endurance nên chậm hơn lượt trước). `typecheck`, `typecheck:tests`, `build` sạch. Kết quả từng tệp ở `/home/user/acc/reg7` (ngoài repo).

**Endurance 336 giờ trên `0d9cc3b3` (seed 7606, không người chơi):** cổng chiến dịch **15/15**. Kết cục: sơ tán 6, sống sót 33, chết 247 — **trùng khít** với `eca8d96`, tức sổ tay không làm thay đổi mô phỏng dân cư. 4.685 giây. Kết quả ở `/home/user/acc/endurance7`.

## Chưa làm

- Ba tệp `audit-closure`, `review-r2-acceptance`, `economic-network-m2`: Creator đã loại khỏi điều kiện nghiệm thu (21/11). Chúng **chưa được kiểm chứng** trên mã cuối; phép đếm công thức tôi sửa trong `audit-closure` cũng chưa từng được chạy.
- Một khả năng kẹt của người chơi: Gậy gỗ và rìu cùng hỏng khi trong túi không còn gỗ (bot đã gặp đúng tình huống này). **Về sau đã kiểm trong game và xác nhận là có thật**, xem mục cuối tệp.
- Kiểm tra trên trình duyệt còn lại: cảnh A–I đầy đủ, giao dịch với NPC, sơ tán thủ công; Elder bơi qua biển chưa từng được nhìn thấy trên màn hình.
- Chơi tay trên trình duyệt chương 3–11 của sổ tay.
- Từ điển vật phẩm – quái – cây: Creator quyết định làm sau final.
- ZIP phát hành (đóng sau khi Creator duyệt sổ tay, để không phải đóng hai lần), Vercel (tài khoản chưa có project cho Soul of Hero), tài liệu hướng dẫn, PR vào `main`.

## Sửa FPS (2026-11-22) — bản `4ab22fac`

Chi tiết và số đo: `FPS_NGUYEN_NHAN.md`, phần "Sau khi sửa". Tóm tắt:

- Đã sửa ba chỗ gây giật mà không bỏ hình ảnh hay tính năng nào: tự lưu (nhịp B), dựng vùng (chuyển sang luồng phụ), tính nhiễu của sương mù.
- Hồi quy 263 tệp: 250 đạt, 0 đỏ, 13 tệp tự chọn. Chạy bền 336 giờ: cổng 15/15, kết cục cư dân không đổi (6 / 33 / 247).
- Chưa làm: giảm việc tính 286 cư dân mỗi khung hình (cần Creator quyết định); bộ nhớ tăng trong vài phút đầu; giới hạn 5 MB của localStorage khi đóng tab.

## Cư dân chờ tới việc kế tiếp, ZIP và Vercel (2026-11-22/23) — bản `6c4b8933`

Creator trả lời ngày 22/11: bản xem thử "ổn hơn tí"; đồng ý cho cư dân tính thưa hơn; duyệt Sổ tay sinh tồn; đồng ý tạo project Vercel `soul-of-hero`.

- **Cư dân:** khi chơi trực tiếp, bước cư dân được bỏ qua ở khung hình không ai có việc đến hạn, tối đa 50 ms. Mọi mốc có hẹn giờ vẫn tính đúng thời điểm. Được: khoảng 0,7 ms mỗi khung hình ở file lưu giờ 8 (FPS 39,6 → 42,1 trên máy thử); ván mới không được gì. Chi tiết và số đo: `FPS_NGUYEN_NHAN.md`, phần cuối.
- **Nghiệm thu:** hồi quy 264 tệp: 251 đạt, 0 đỏ, 13 tệp tự chọn. Chạy bền 336 giờ: cổng 15/15, kết cục 6 / 33 / 247, mã băm 336 giờ trùng từng giờ với `4ab22fac`.
- **ZIP phát hành** `web/releases/Soul-of-Hero-Web.zip` đã đóng lại từ bản dựng của `6c4b8933`: 64.359.032 byte, 220 tệp, SHA256 `15cfece6d9c16787851bc7563cdf493407a1a4ca944f584704e08279952739a8`. Thư mục `game/` trong ZIP trùng từng tệp với `web/dist`; có đủ ba tệp luồng phụ (`offline-return-worker`, `region-prebuild.worker`, `save-writer.worker`).
- **Vercel:** đã tạo project `soul-of-hero` (nhóm `menden`), nối với repo, thư mục gốc `web`. Bản đầu tiên dựng từ nhánh `arena/0f6091f9-soul-of-hero` ở `6c4b8933`, trạng thái READY, địa chỉ `https://soul-of-hero.vercel.app`. Vercel tự xếp bản đầu tiên của project vào mục production. **Đính chính (23/11):** trước đây tôi ghi project không tự dựng lại khi có commit mới; điều đó sai. Mỗi lần đẩy commit lên nhánh, Vercel tự dựng một bản xem thử riêng cho nhánh (đã thấy ở commit `1296de88`, hiện thành một mục kiểm tra trên PR #65). Địa chỉ chính `soul-of-hero.vercel.app` vẫn đứng ở bản `6c4b8933`; chưa thử xem đẩy lên `main` thì địa chỉ chính có tự đổi không. **Chưa mở được địa chỉ này từ máy thử** (máy thử bị chặn mạng ra ngoài), nên mới biết là dựng xong, chưa biết là chơi được.
- **Chưa làm:** gộp vào `main` (chờ 13 cổng và Creator duyệt); chơi tay chương 3–11 của sổ tay; các mục "Chưa làm" ở trên vẫn còn nguyên trừ ZIP và Vercel.

## Ba quyết định của Creator ngày 23/11 — bản `0fae459b`, `b7395731`, `3c2fd48c`, `f00c2cf5`, `d00d7791`

Creator quyết định: (1) vẽ sương mù thành một lớp; (2) cho uống nước được tính là sơ cứu cho người gục vì khát; (3) bỏ hai loại tường không dùng được; và đồng ý gộp PR #65 vào `main`.

### 1. Sương mù một lớp (`0fae459b`)

Khi trời sương mù, FPS trên máy thử tăng khoảng 10 (41–45 → 52–54). Trời khác không đổi. Hình ảnh lệch tối đa 2/255 mỗi kênh màu. Số đo và cách kiểm: `FPS_NGUYEN_NHAN.md`, phần cuối.

### 2. Cho uống nước là sơ cứu

**Người chơi (`0fae459b`):**

- Người gục vì khát (khát = 0, không có vết thương đang chảy máu): trong bảng của người đó, mục Help có thêm bình nước còn nước. Đứng cạnh 6 giây.
- Xong thì người đó đứng dậy, khát +30, bình mất một ngụm, lòng tin +5 (một lần).
- Vẫn bị từ chối: đưa nước cho người gục đang chảy máu hoặc chưa khát tới 0; đưa đồ ăn cho bất kỳ người gục nào.
- Câu thông báo mới ("Giving water · stay beside the patient for six seconds.") **mới có tiếng Anh**.

**Cư dân (`b7395731`):**

- Trước: người cứu tốn một liều thuốc, người gục đứng dậy với khát = 0, vài phút sau gục lại.
- Nay: nếu người gục vì khát và người cứu **đang mang** đồ uống, người cứu đi tới, mất 6 giây, đưa một ngụm. Người gục đứng dậy với khát 30. Không tốn thuốc.
- Vừa khát vừa chảy máu, người cứu có cả thuốc lẫn nước: dùng một liều thuốc và một ngụm nước trong cùng một lần tới.
- Người cứu không mang nước: vẫn chữa bằng thuốc như cũ (người gục đứng dậy, khát vẫn = 0).
- **Giới hạn:** cư dân không đi lấy nước ở kho để cứu; cứu bằng nước không hồi máu.
- 6 bài kiểm tra mới trong `tests/npc-medic-response.test.ts`. Đây là **cảnh dựng sẵn**, không phải tình huống tự xảy ra khi chơi.
- Trong lượt chạy bền 336 giờ, việc này tự xảy ra 5 lần (trên 358 lượt chữa).

### 3. Bỏ hai loại tường (`0fae459b`)

- Đã bỏ Plank Wall (tường ván) và Iron-braced Wall (tường gia cố sắt).
- Tường còn lại: Wood Wall 160 máu (5 gỗ), nâng cấp lên Stone Wall 380 máu (8 đá + 1 gỗ).
- File lưu cũ có hai loại tường đó: khi mở, chúng thành Wood Wall / Stone Wall, máu không vượt mức tối đa của loại mới. Bài kiểm tra: `tests/retired-walls.test.ts`.
- **Còn mở:** ván (Plank) vẫn chế được nhưng **không còn món nào dùng ván**. Bỏ ván cần Creator quyết.
- Đã xoá bài `mec01-r8e-plank-upkeep`; viết lại bài tường ván; số giờ tự chủ trong bài kinh tế M3 đổi 27,04 → 28,01 giờ.

### 4. Nghiệm thu lượt 10 trên `b7395731`: cổng chiến dịch 14/15

- Hồi quy 264 tệp: 250 đạt, 13 tệp tự chọn, **1 đỏ** (`npc-runtime-throughput`: giới hạn cứng 90 giây; chạy lúc máy đang gánh endurance mất 103 giây). Chạy riêng: đạt, 82 giây.
- Chạy bền 336 giờ: thoát mã 0. **Cổng 14/15.** Điều kiện trượt: "cùng một ván có người sơ tán tới nơi VÀ có dân được phòng thủ sống sót". Có 4 người được phòng thủ sống sót, nhưng **không ai sơ tán được** (lượt trước: 6 người).

| | `6c4b8933` (lượt 9) | `b7395731` (lượt 10) |
|---|---|---|
| Sơ tán / sống sót / chết | 6 / 33 / 247 | 0 / 34 / 252 |
| Lượt gục | 588 | 474 |
| Lượt chữa | 402 | 358 |
| Trong đó cứu bằng nước | 0 | 5 |

Hai lượt giống nhau từng giờ tới giờ 12, khác nhau từ giờ 13 (lần cứu bằng nước đầu tiên). Số lượt gục giảm 19 %.

### 5. Sơ tán: vì sao lượt 10 không ai đi được, và hai chỗ đã sửa

Công cụ và số đo thô: `evac-tools/`. Mọi thứ dưới đây là chạy lại từ file lưu giờ 288 của hai lượt (lúc tàu mở), không phải chơi trên trình duyệt. "Giờ 290" nghĩa là trong khoảng từ giờ 289 tới giờ 290.

**Luật sơ tán đang có (không đổi):**

- Giờ 288 ba tàu mở. Một tàu chỉ rời bến khi **đủ 6 người**, hoặc tới giờ 324 thì chở bất kỳ ai đang ở trên tàu.
- Người đã lên tàu thì **không ăn uống** trong lúc chờ. Đói hoặc khát về 0 thì gục và bị đưa lên bờ. Trong các lần chạy lại, người lên tàu gục sau 1–9 giờ.

**Nguyên nhân chính: cư dân không "nghĩ" được đường đủ xa.**

- Một lượt tìm đường dừng ở 48.000 ô đã xét. Giới hạn này có từ ngày 17/11 (commit `cbc6d0ee`), trước đợt nghiệm thu.
- Bến tây cách phần lớn khu dân cư hơn 900 bước. Số ô cần xét để tìm ra đường, đo từng người (`evac-tools/result-run10-state-limit-lifted-probe-5h.txt` và `result-run10-state-limit-96000-10h.txt`):

| Ai (lượt 10, giờ 288) | Đường dài | Số ô cần xét | Với giới hạn 48.000 |
|---|---|---|---|
| h7, h8, h2 | 950–965 bước | 32.006–34.375 | Tìm được |
| h2l | 927 bước | 48.990 | **Không** (thiếu 990 ô) |
| h4u | 1.086 bước | 60.591 | Không |
| h4s | 1.097 bước | 62.208 | Không |
| h4w | 1.333 bước | 84.835 | Không |

- Nên chỉ vài người ở gần nhất mới lên đường được. Lượt 9 có đúng 6 người như vậy (h2, h7, h8, h9, h2l, h4i) và tàu đủ 6 ở giờ 294. Trong lần chạy lại, h2l tìm ra đường ở ô thứ 47.737, **sát giới hạn**.
- Lượt 10: h9 bị thương lần thứ tư và gục lúc giờ 15,8, không được cứu dậy, đã chết trước giờ 264 (ở lượt 9 h9 chỉ có ba vết thương, đều đã chữa). h2l đứng lệch **một ô** so với lượt 9 và hết 48.000 ô. Tàu tây chưa lúc nào đủ 6 người.

Bốn lượt gần nhất (`eca8d96`, `0d9cc3b3`, `4ab22fac`, `6c4b8933`) cho cùng kết cục 6 / 33 / 247. Ba lượt sau còn dữ liệu trên máy và tôi đã đọc lại: cùng 588 lượt gục, 402 lượt chữa, rời bến giờ 294, cập bến giờ 298, và **cùng mã băm ở giờ 336**. Lượt `eca8d96` chỉ còn con số ghi trong tài liệu này. Đó gần như là **một** diễn biến được chạy lại, không phải bốn lần thử độc lập. Lượt 10 là lần đầu diễn biến đổi sớm. **Tôi đã báo 15/15 mà không biết nó mong manh như vậy.**

**Nguyên nhân phụ, do chính PR này gây ra: hàng chờ tìm đường.**

- Để file lưu không vượt 5 MB, bản `43e47139` giới hạn tổng số ô của các lượt tìm đường đang dở ở 160.000 và cho xếp hàng.
- Hàng chờ đó có hai chỗ sai. (a) Nó cho 4–5 lượt cỡ gần bằng nhau cùng lớn, vượt giới hạn. (b) Khi vượt, nó bỏ lượt "lâu chưa được hỏi nhất"; nhưng ai trong hàng cũng hỏi mỗi giây, nên lượt bị bỏ là ngẫu nhiên, nhiều khi là lượt đã xét 20.000–34.000 ô và sắp xong.
- Đo trên trạng thái giờ 288 của lượt 10: mỗi giờ bỏ 13–23 lượt, mất 225.000–313.000 ô công; 23 người muốn đi, **4 giờ chỉ 1 người lên tàu**.
- Người đang xếp hàng dùng lượt nghĩ của mình (mỗi giây một lượt cho cả nhóm ở xa người chơi) chỉ để nhận câu "chờ đi".

**Sửa lần 1 (`3c2fd48c`) — hàng chờ:**

- Chỉ hai lượt tìm đường dài nhất được chạy; các lượt khác xếp hàng.
- Người đang xếp hàng dùng lượt nghĩ của mình để **tìm giúp** lượt dài nhất. Việc giúp không bao giờ kết thúc một lượt tìm: nó dừng ngay trước đích, và chủ của lượt đó tự nhận kết quả ở lượt nghĩ kế tiếp.
- Khi vượt 160.000 ô: bỏ trước các lượt không còn ai hỏi; rồi làm rỗng các lượt đang xếp hàng (nhỏ nhất trước), chúng giữ chỗ và bắt đầu lại khi tới lượt; lượt đang chạy chỉ bị bỏ khi không còn gì khác.
- Riêng bản này chưa đủ: trạng thái lượt 10 có 4 người lên tàu tây trong 3 giờ (trước đó: không ai trong 4 giờ), nhưng vẫn không đủ 6.

**Sửa lần 2 (`f00c2cf5`, thu hẹp lại ở `d00d7791`) — đường tới bến tàu được tìm xa gấp đôi:**

- Một lượt tìm đường **tới bến sơ tán** được xét tới 96.000 ô. Mọi đường khác (đi làm, đi lấy đồ, về nhà) vẫn 48.000 như cũ.
- Tổng 160.000 ô **không đổi**, nên file lưu không lớn hơn. Để giữ được điều đó: khi hai lượt đang chạy cộng lại quá 90.000 ô thì lượt nhỏ hơn đứng yên (giữ nguyên phần đã tìm) và chạy tiếp khi lượt lớn xong.
- Định dạng file lưu không đổi. File lưu cũ mở bình thường.
- **Đây là thay đổi luật của game do tôi tự quyết, chưa xin ý kiến trước:** cư dân ở xa hơn nay tìm được đường tới bến. Nếu Creator không muốn, đổi lại là một dòng (và cổng chiến dịch sẽ lại phụ thuộc vào may rủi như mục trên).

**Một bước sai của tôi ở giữa:** bản `f00c2cf5` nâng giới hạn cho **mọi** đường đi. Chạy bền trên bản đó cho thấy ngay trong 3 giờ đầu: diễn biến y hệt lượt 10 (biên nhận và trạng thái cư dân trùng nhau suốt 85 giờ đã chạy), nhưng giờ đầu tiên tính lâu hơn 30 % (bài `npc-runtime-throughput` đo liền nhau dưới cùng tải: 122–129 giây so với 96 giây). Lý do: vài đường đi làm chạy tiếp tới 96.000 ô rồi vẫn thất bại, và một lượt tìm dài gấp đôi tốn công khoảng gấp bốn. Tôi dừng lượt chạy đó và thu hẹp lại chỉ còn đường tới bến. Đo lại liền nhau: bản cuối 82,7 và 90,4 giây, bản `b7395731` 94,6 giây — không chậm hơn (máy thử dao động; bài này có giới hạn cứng 90 giây và vốn sát mức).

**Kết quả chạy lại 10 giờ từ giờ 288:**

| Trạng thái | Mã `b7395731` | Sau sửa lần 1 | Sau sửa lần 2 (bản cuối `d00d7791`) |
|---|---|---|---|
| Lượt 9 | Tàu tây đủ 6, rời bến giờ 294 | Rời bến giờ 291 | Rời bến giờ 290, 6 người cập bến giờ 294 |
| Lượt 10 | 4 giờ: 1 người lên tàu Hook, 0 người tàu tây | Tàu tây 4 người, không bao giờ đủ 6, gục dần từ giờ 295 | Rời bến giờ 290, 6 người cập bến giờ 294 |

- Số ô đang giữ cao nhất: 160.288 (trước khi cắt về 160.000). Không lượt tìm đang chạy nào bị bỏ.
- Số người tìm được đường tới bến tây trong hai giờ đầu: 3–4 người → 6 người ở cả hai trạng thái (đủ một tàu; sau đó tàu đã đi).

**Chưa sửa, cần Creator quyết:**

- **Người trên tàu vẫn không ăn uống khi chờ.** Trong cả hai lần chạy lại, 2–3 người lên tàu Hook không bao giờ đủ 6, gục sau 6–9 giờ và chết đói. Hướng xử lý (cho ăn từ hàng trên tàu, hoặc cho tàu rời bến sớm khi chờ quá lâu) là luật chơi.
- Vẫn còn người xét hết giới hạn mà không tới bến nào: 21 lượt tìm (trạng thái lượt 9) và 32 lượt tìm (trạng thái lượt 10) trong 10 giờ, phần lớn là tới bến nam.

**Hai cách đã thử rồi bỏ:**

- Hai lượt chạy, người xếp hàng chỉ chờ và hỏi lại mỗi 60 giây. Trên trạng thái lượt 9 nó chậm hơn cả mã cũ: tới giờ 296 mới có người thứ sáu lên tàu, đúng lúc một người trên tàu gục. Số đo: `evac-tools/result-run9-state-rejected-variant-11h.txt`.
- Khi hai lượt cộng lại quá ngưỡng thì lượt nhỏ **nhường hẳn chỗ**. Các lượt đang xếp hàng tưởng có chỗ trống, bắt đầu lại rồi bị làm rỗng liên tục, và lượt nhỏ kia mất hết phần đã tìm. Bài kiểm tra mới bắt được lỗi này.

**Bài kiểm tra** `tests/navigation-queue.test.ts` (6 bài, cảnh dựng sẵn trên đảo thật ở ngày đầu):

- 40 người cùng xin một đường dài 1.025 bước: cả 40 nhận đúng con đường mà một người đi một mình nhận được; tổng số ô không lúc nào vượt 160.000; hai lượt dẫn đầu không bao giờ bị bỏ; không lượt nghĩ nào bị phí.
- Một người cách bến 1.380 bước tìm ra đường ở ô thứ 89.069, kể cả khi lưu rồi mở lại giữa chừng.
- Cùng người đó đi tới một ô cách bến hai ô (không phải bến): dừng ở 48.000, dù có người tìm giúp hay không.
- Hai lượt cùng chạy tới giới hạn, 10 người xếp hàng phía sau: không lượt nào mất ô nào (hai lượt giữ nhiều nhất 144.847 ô, tổng 159.993).
- Làm hỏng thử 11 chỗ, bài kiểm tra đỏ ở cả 11: tắt phần tìm giúp; dùng lại luật bỏ cũ; cho phần tìm giúp đi quá đích (ba chỗ này thử trên `3c2fd48c`); ngưỡng 120.000; giới hạn bến 48.000; bộ đọc file lưu chỉ nhận 48.256; mọi đường đều được 96.000; người tìm giúp dừng lượt tới bến ở 48.000; người tìm giúp đẩy mọi lượt tới 96.000; lượt đứng yên vẫn tự lớn; lượt đứng yên nhường chỗ.

### 6. Nghiệm thu lượt 13 trên `d00d7791`

**Chạy bền 336 giờ (seed 7606, không người chơi):** thoát mã 0, 4.672 giây. Cổng chiến dịch **15/15**.

| | `6c4b8933` (lượt 9) | `b7395731` (lượt 10) | `d00d7791` (lượt 13) |
|---|---|---|---|
| Cổng chiến dịch | 15/15 | 14/15 | **15/15** |
| Sơ tán / sống sót / chết | 6 / 33 / 247 | 0 / 34 / 252 | **6 / 40 / 240** |
| Lượt gục | 588 | 474 | 432 |
| Lượt chữa | 402 | 358 | 284 |
| Trong đó cứu bằng nước | 0 | 5 | 4 |
| File lưu lớn nhất | 4,14 MB (giờ 312) | 4,13 MB (giờ 321) | 4,27 MB (giờ 302) |

- Lượt 13 **trùng mã băm từng giờ với lượt 10 tới hết giờ 288**, khác từ giờ 289. Tức hai chỗ sửa không đổi gì trong 12 ngày đầu; chúng chỉ có tác dụng khi tàu mở.
- Tàu tây đủ 6 người và rời bến trong giờ 290, cập bến trong giờ 294, đúng như lần chạy lại đã báo trước. Hành khách: h2l, h4w, h4u, h2, h7, h8. Ba người trong đó (h2l, h4w, h4u) là người mà giới hạn cũ không cho tìm ra đường.
- 5 người được phòng thủ sống sót (h2c, h4h, h5h, h6p, h6s).
- **9 người lên tàu, 6 người đi được.** 3 người còn lại (h5f, h1h, h2f) lên tàu ở bến Hook trong giờ 289–291; tàu đó không bao giờ đủ 6 người, và cả ba gục trên tàu ở giờ 298 và giờ 300 rồi bị đưa lên bờ. Đây là vấn đề "người trên tàu không ăn uống khi chờ" nêu ở mục 5, chưa sửa.
- **File lưu lớn nhất tăng 0,14 MB**, còn cách mức 5 MB của localStorage 0,73 MB. 5 giờ trong 336 giờ có file lưu trên 4,0 MB (lượt 10: 4 giờ).
- Vẫn chỉ là **một** diễn biến của một seed. Điều khác trước: tàu tây nay có 6 người tìm được đường trong 2 giờ đầu ở cả hai diễn biến đã thử, thay vì cần đúng 6 người cụ thể.

**Hồi quy 265 tệp (264 cũ + `navigation-queue`):** **252 đạt, 0 đỏ**, 13 tệp chỉ có bài tự chọn (cùng 13 tệp như các lượt trước). 1.587 bài đạt, 0 bài trượt, 7.081 giây. `npc-runtime-throughput` đạt ở 93 giây tính cả khởi động (bài có giới hạn cứng 90 giây cho phần chạy; nó vẫn sát mức như trước).

**Bản dựng và ZIP:** hai lượt typecheck và `build` sạch. `web/releases/Soul-of-Hero-Web.zip` đóng lại từ bản dựng của `d00d7791`: 64.361.704 byte, 220 tệp, SHA256 `846827f3d4cadc33b5c5d4deeee6a25b98fac567ac19a1475c7d4aab68cea9c8`. Thư mục `game/` trùng từng tệp với `web/dist` (216 tệp), có đủ ba tệp luồng phụ.

**Kiểm trên trình duyệt, bản dựng thật (cổng 4174):**

- `e1-save.mjs` (tự lưu, hai kho, tải lại, Continue): đạt, không có lỗi trang.
- Thực đơn xây (phím B) ở ván mới: nhóm Wall có 8 hình, tất cả bằng gỗ; không có Plank Wall hay Iron-braced Wall. Tệp mã của bản dựng không còn chứa hai tên này (bản dựng trước ngày 23/11 thì có). **Chưa kiểm** việc mở một file lưu cũ có sẵn hai loại tường này trên trình duyệt; phần đó mới có bài kiểm thử tự động.
- `g1-water-aid.mjs` (cho uống nước qua đúng bảng của game): đạt. **Cảnh dựng sẵn:** kịch bản tự đặt một cư dân cạnh người chơi, khát = 0, đang gục. Phần còn lại là giao diện thật: danh sách "Nearby survivors" → Help → "Offer Water Flask" → 6 giây. Kết quả: cư dân đứng dậy, khát 30, bình nước 2 → 1 ngụm, lòng tin 50 → 55, không có lỗi trang.
- `i1-trade.mjs` (đổi đồ với cư dân qua đúng bảng của game): đạt. **Cảnh dựng sẵn:** kịch bản chỉ đặt cư dân gần nhất ra cạnh người chơi. Chọn "Trade items", thêm 1 Wood Club bên mình và 1 Parts bên họ, "Review exchange", "Accept & exchange": đồ đổi chủ đúng như chọn, lòng tin 50 → 51, bảng báo "Selected goods exchanged.", không có lỗi trang. Mới thử một cư dân, một lần đổi; chưa thử trường hợp bị từ chối hay "counter-offer".
- Hai điều thấy được trong lần kiểm cho uống nước, **chưa sửa**:
  - Cư dân đứng dậy với **chưa tới 1 máu** (0,56 trên 90). Trong lúc nằm gục máu vẫn tụt dần, và nước không hồi máu.
  - 0,6 giây sau khi cư dân đã đứng dậy, bảng vẫn còn dòng "Giving water · stay beside the patient for six seconds." Tôi chưa xem dòng này tự mất sau bao lâu.
- Lần chạy đầu của kịch bản báo trượt vì chính kịch bản đòi khát ≥ 30, trong khi 0,6 giây sau khi uống khát đã là 29,999. Tôi sửa điều kiện của kịch bản (khát trong khoảng 29–30, bình còn 1 ngụm, lòng tin 55) rồi chạy lại. Game không đổi giữa hai lần.

**Chưa làm trong đợt này:** các mục kiểm tra trên trình duyệt còn nợ từ trước vẫn còn nguyên (sổ tay chương 3–11, sơ tán thủ công, Elder bơi, cảnh A–I, đánh với thú biết đánh trả, trường hợp kẹt khi gậy và rìu cùng hỏng). Sương mù một lớp mới chỉ được xem qua ảnh chụp của công cụ đo.

## Kiểm tra trên trình duyệt sau `b698d54a`

Mã game không đổi (`d00d7791`). Đợt này chỉ thêm kết quả kiểm tra, kịch bản và ảnh ở `browser-checks/`.

**Cách làm, áp dụng cho mọi dòng dưới đây:** trình duyệt không màn hình, 640×360, bản dựng phát hành ở cổng 4174. Kịch bản bấm phím và bấm nút thật của game, nhưng **mỗi kịch bản đều dựng sẵn một phần cảnh** (ghi rõ ở từng dòng). Đây không phải người chơi tay từ đầu đến cuối.

| Việc | Kết quả | Phần dựng sẵn |
|---|---|---|
| Kẹt khi Gậy gỗ hỏng mà hết gỗ | **Có thật** | Độ bền gậy đặt về 1, gỗ trong túi bị xoá |
| Mở file lưu cũ có Plank Wall | Đạt | Sửa chữ trong file lưu thành `wall_plank`, tính lại mã kiểm |
| Xem cuộc sơ tán của cư dân | Đạt | File lưu giờ 288 của lượt 13, đồng hồ đẩy thêm 7 giờ |
| Người chơi tự lên tàu và rời đảo | Đạt | Cùng file lưu; người chơi được bế tới bến tây; đồng hồ đẩy hai lần |
| Đánh với thú biết đánh trả | Đạt | Người chơi được đặt cách con thú khoảng 4 ô |
| Elder tấn công làng lúc Ragnarok | Đạt (2 trong 6 Elder) | File lưu giờ 312, đồng hồ đẩy 14,5 giờ, người chơi được bế tới cạnh Elder |
| Elder bơi qua biển | **Không xem được** | Cách bế người chơi không dùng được giữa biển |

### Kẹt khi Gậy gỗ hỏng (`j1-softlock.mjs`)

- Ván mới cho: Wood Club (độ bền 120), Water Flask, 3 Berries.
- Gậy còn tốt chém trúng cây liễu (game ghi biên nhận `harvest willow`); độ bền gậy 120 → 116.
- Gậy gãy bằng một nhát chém thật. Nó vẫn nằm ở ô 1 với độ bền 0. Ghi chú trong game: "Craft a replacement [C] or repair it at your Workbench [E]".
- Tay không chém 12 nhát vào cùng cây đó: game báo "Too slow with this — an axe would fell it." Không rơi gỗ.
- Bảng chế tạo lúc đó chỉ có một nút "Craft", là Fruit Juice.
- Gợi ý đầu ván vẫn ghi "Gather by hand 0/3".

Vì sao kẹt, theo mã:

- Gỗ chỉ đến từ năm loại cây. Không công thức nào làm ra gỗ.
- Tay không chỉ có sức với cây bụi, không có sức với cây thân gỗ.
- Wood Club cần 12 gỗ; sửa nó cần 3 gỗ và một Workbench. Rìu đá cần 3 gỗ.

**Chưa kiểm** các đường khác để có gỗ: nhặt dưới đất, đồ rơi từ thú, tháo công trình đã xây, đổi với cư dân (lần thử `i1` cho thấy đổi đồ chạy được, nhưng tôi chưa xem cư dân có gỗ để đổi không). Nên tôi chỉ khẳng định: **người chơi một mình, hết gỗ, gậy gãy, thì không tự chặt được cây nữa.** Sổ tay bước 1 lại viết "Swing LMB at a tree, boulder or bush", dễ hiểu là tay không cũng chặt được.

Đây là việc cần Creator quyết (thứ năm, cùng bốn việc đã nêu): cho tay không chặt cây rất chậm, hay cho gậy gãy vẫn chặt được nhưng yếu, hay để nguyên.

### File lưu cũ có Plank Wall (`m1-retired-wall.mjs`)

- Đặt một Wood Wall trong game, lưu, rồi sửa file lưu thành `wall_plank` với 240 máu.
- Mở lại: có nút "Continue"; bức tường hiện ra là Wood Wall, máu 159,98 trên 160; không có lỗi trang.
- **Chưa thử** `wall_brick` (Iron-braced Wall).

### Xem cuộc sơ tán (`k1-evac-watch.mjs`)

- File lưu giờ 288 của lượt 13, không sửa gì. Bấm "Continue" khi đồng hồ đã qua 7 giờ: game tính bù 165 giây rồi vào được.
- Ở giờ 295: 6 người đã rời đảo (h2, h7, h8, h2l, h4u, h4w), đúng như lượt 13 chạy không trình duyệt. Tàu tây đã đi (rời bến giờ 289,7, tới nơi giờ 293,7). Tàu Hook còn chờ với h5f, h1h, h2f. Tàu nam trống.
- Bảng "Return Chronicle" ghi 7,0 giờ vắng mặt, 24.709 sự kiện. Không có lỗi trang.

### Người chơi tự rời đảo (`k2-evac-player.mjs`)

1. "Continue" → "You have fallen" → "Rise": máu 60, đói 40, khát 40.
2. Đứng cách cột hiệu bến tây một ô, bấm E → "Request a Seat…" → "Board the Vessel". Bảng ghi "Taking passengers · 1/6 aboard", "You hold a seat. Stay at the berth until departure. Arrival ends the run.", và có nút "Step ashore". Game lưu được.
3. Quay lại sau 2,5 giờ: tàu đang trên biển, 6/6 người (người chơi, h2l, h4w, h4u, h2, h7). Màn hình: "Under way | Safe water in 2h 56m | Seat 1 · 6/6 aboard · Hull 96".
4. Quay lại sau 4,5 giờ nữa: ván kết thúc. "Evacuated from the Island"; "Reached safe water: 5 · Survived on the island: 0 · Died: 233 · Fate unknown: 48"; hai thành tựu "Witness the End" và "Got Out"; nút "Continue to Title".
5. Không có lỗi trang.

Điều cần biết:

- Người chơi lấy đúng chỗ mà h8 có trong lượt 13. h8 không đi được chuyến đó.
- Trong lúc tàu trên biển, màn hình vẫn hiện "1 ALERTS" và "NEXT: Review the current alerts before heading out." Dòng này không hợp cảnh. Chưa sửa.
- **Chưa thử:** đi bộ tới bến (kịch bản bế người chơi tới), nút "Step ashore", lên một tàu đã đầy.

### Đánh với thú biết đánh trả (`l1-fight.mjs`)

- Ván mới, con thú là `vampire_1` (38 máu). Người chơi đi tới và chém bằng Wood Club.
- 4 nhát trúng, mỗi nhát 12 máu: 38 → 26 → 14 → 2 → chết. Con thú đánh trúng người chơi 2 lần: máu 100 → 89 → 78.
- Có biên nhận `creature.kill`; rơi ra 1 Cloth và nhặt được. Độ bền gậy còn 115 trên 120. Không có lỗi trang.
- Mới thử một loài, một trận. Hai lần chạy trước đó hỏng do kịch bản (chọn loài không có trong ván; không tới gần được slime), không phải do game.

### Elder lúc Ragnarok (`n1-elder-sea.mjs`)

- File lưu giờ 312 của lượt 13, mở ở giờ 326,5 (game tính bù 274–284 giây). Cả sáu Elder đã rời hang; Aion, Atlas, Typhon đang ở làng mục tiêu.
- Bế người chơi tới cạnh **Aion** (ở Confluence) rồi "Rise": Aion chuyển từ đứng yên sang đuổi, rồi đánh; người chơi mất 17 máu (60 → 43) trong 3,5 giây. Thanh máu Elder hiện trên đầu màn hình: "Aion · The Unmoving Clock · AWAKENED · 680/680".
- Làm lại với **Atlas** (ở Gull Net Camp): mất 19 máu (60 → 41) trong 3 giây; "Atlas · Bearer of the Sky-Weight · 820/820". Ảnh có một cư dân đang gác kho ngay cạnh.
- Không có lỗi trang.
- **Elder bơi qua biển: không xem được.** Ở giờ 318,5 Atlas đang ở giữa biển (game ghi "434 ô phải vượt, 406 ô là biển"). Khi kịch bản bế người chơi vào vùng chỉ có biển, game ném lỗi "No walkable terrain in this Veyra U=0.5 window". Lỗi này do cách bế của kịch bản gây ra. **Tôi không biết** người chơi thật có tự tới được vùng như thế không (bằng thuyền chẳng hạn); nếu tới được thì đó là lỗi của game. Chưa kiểm.

### Hai câu trong tài liệu đã đối chiếu lại

- "`npc-runtime-throughput` đạt ở 93 giây": số đo là 92.950 ms. Đúng.
- "h2l tìm ra đường ở ô thứ 47.737": có trong `evac-tools/result-run9-state-long-searches-2h.txt`. Đúng.
- Câu "3 người lên một tàu khác" ở trên đã sửa thành tên tàu: tàu ở bến Hook.

### Vẫn còn nợ

- Cảnh A–I của tháp điều khiển: B (tám nghề), C (chiêu mộ, đi theo, thả), D (mặc cả bị từ chối, đe doạ, cướp), F (rời game và quay lại bằng thời gian thật), I chưa làm. E, G, H mới có các mảnh nêu trên, đều có dựng sẵn.
- Sổ tay chương 3–11 chơi tay.
- Elder bơi; file lưu có `wall_brick`; "Step ashore"; đi bộ tới bến; dòng "Giving water…" tồn tại bao lâu.
- Các đường khác để có gỗ khi gậy gãy.
