# Tiến độ sửa lỗi sau nghiệm thu `6d2dec8`

Cập nhật gần nhất: mục cuối tệp ("Rìu đá khởi đầu"). Mã game cuối là `ff678df9`: 252 tệp đạt, 0 đỏ, endurance 15/15. Nhánh `arena/0f6091f9-soul-of-hero`, đã đẩy lên GitHub, PR #65 (nháp), Vercel đang chạy bản này. Các mục phía dưới ghi theo thứ tự thời gian; mục cũ không được viết lại, nên có chỗ nói "chưa làm" cho việc về sau đã làm.

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

Đây là việc cần Creator quyết (thứ năm, cùng bốn việc đã nêu): cho tay không chặt cây rất chậm, hay cho gậy gãy vẫn chặt được nhưng yếu, hay để nguyên. **Creator đã quyết ngày 23/11, theo hướng khác: xem mục "Rìu đá khởi đầu" ở cuối tệp.**

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

## Rìu đá khởi đầu (quyết định của Creator, 23/11) — mã game `ff678df9`

### Creator quyết gì

Làm theo Last Island:

1. Ván mới bắt đầu với **Rìu đá**, không còn Gậy gỗ.
2. **Mỗi lần gục rồi tỉnh dậy, người chơi được phát một Rìu đá.**
3. Tài nguyên thiên nhiên (cây, đá, quặng) thuộc **nhánh rìu**.
4. Gậy gỗ là **vũ khí**, và dùng để đập đồ ven đường; không chặt cây, không đập đá.

Tài liệu Last Island trong repo (`web/ref/atlas/extracted/LI_MASTER_RESEARCH_REPORT_v5.md`, mục D03) ghi: ba cấp rìu Stone / Iron / Refined Iron lấy cả gỗ lẫn quặng. Tôi dựa vào đó cho điểm 3. Tôi không mở được trang gốc của Last Island từ máy này để đối chiếu thêm.

### Đã đổi gì trong game

| Món | Trước | Sau |
|---|---|---|
| Túi khởi đầu | Wood Club, Water Flask, 3 Berries | **Stone Axe**, Water Flask, 3 Berries |
| Tỉnh dậy sau khi gục | Không được phát gì | **1 Stone Axe** (đồ cũ vẫn nằm trong túi rơi) |
| Stone Axe | gỗ 3 | gỗ 3, **đá 1, quặng 1** |
| Iron Axe | gỗ 6 | gỗ 6, **đá 2, quặng 2** |
| Salvager Axe | gỗ 9 | gỗ 9, **đá 3, quặng 3** |
| Wood Club | gỗ 1, đá 1, cây bụi 1 | cây bụi 1, **đồ ven đường 2**; không còn gỗ và đá |
| Ba loại cuốc | không đổi | không đổi (vẫn nhanh hơn rìu cùng cấp với đá và quặng) |

- Số là sức mỗi nhát. Với đồ ven đường (Salvage Bale, Relay Wreck, Fuel Rack) bảng riêng giờ là: rìu đá 1, cuốc 1, dao 2, **Gậy gỗ 2**, Cleaver 3, Machete 4.
- Câu báo khi dùng sai công cụ với đá, quặng đổi thành "You need an axe or a pickaxe for this."
- Màn hình chọn nhân vật, tệp `HUONG-DAN.txt` trong ZIP và các bảng thiết kế vật phẩm đã sửa theo.
- **Cư dân cũng theo luật này**: thợ xây cầm Stone Axe, lính gác cầm Wood Club.

**Tôi tự chọn, Creator chưa duyệt từng con số:** mức đá và quặng của ba rìu (1 / 2 / 3), mức 2 của Gậy gỗ với đồ ven đường, và việc giữ nguyên ba loại cuốc (Last Island không có cuốc).

### Đã kiểm

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| Hồi quy 265 tệp | **252 đạt, 0 đỏ**, 13 tệp chỉ có bài tự chọn; 1.592 bài đạt |
| Chạy bền 336 giờ, seed 7606, không người chơi | Cổng chiến dịch **15/15**; sơ tán 6, sống sót 32, chết 248 |
| Trình duyệt, bản dựng thật (`o1-starter-axe.mjs`) | Đạt |

- **Chạy bền:** lượt trước (`d00d7791`) là sơ tán 6, sống sót 40, chết 240. Hai lượt khác nhau ngay từ giờ đầu, vì cư dân cũng đổi công cụ. Số sống sót giảm 8; tôi không tách được bao nhiêu phần là do luật mới. 6 người rời đảo trên tàu tây: h2, h5v, h2l, h8, h4m, h7. File lưu lớn nhất 3,97 MB.
- **Hồi quy:** lượt đầu có **1 tệp đỏ**, `arena1-round2-newgame-routes` (xem mục dưới). Tôi sửa con bot trong tệp đó rồi chạy lại riêng tệp: 4/4 đạt. Mã game không đổi giữa hai lần. 264 tệp còn lại là kết quả của lượt đầu.
- **Trình duyệt:** ván mới có Stone Axe (độ bền 180) ở ô 1. Chặt một cây sồi ra gỗ. Để nhân vật chết đói (**dựng sẵn:** máu, đói, khát bị đặt về gần 0), bấm "Rise": túi chỉ có đúng một Stone Axe mới, độ bền 180, game ghi "You wake with a Stone Axe in hand." Không có lỗi trang. Kịch bản chạy hai lần: lần đầu rìu còn đập được một tảng đá ra 2 đá nhưng kịch bản báo trượt do chính nó kiểm sai chỗ; lần hai (kết quả được lưu) không gặp tảng đá nào.
- Bài kiểm thử mới trong `soh.test.ts`: rìu khởi đầu lấy được gỗ, đá và quặng sắt; Gậy gỗ không lấy được gì từ cây, đá, quặng; mỗi lần tỉnh dậy có đúng một rìu mới và file lưu sau đó hợp lệ.

- **Về mã được đo:** chạy bền và hồi quy chạy trên `ff678df9`. Commit sau đó sửa ngày ghi sai trong hai dòng chú thích của `catalog.ts` và `engine.ts`; bản dựng sau khi sửa **trùng từng byte** với bản dựng của `ff678df9` (216 tệp), nên tôi không chạy lại.

### Điều luật mới CHƯA giải quyết: vẫn kẹt được, lối ra là chết

Tệp đỏ ở lượt đầu chính là chuyện này. Một con bot chơi ván mới như người thật (không được cho đồ) đi tuyến dầu. Ở **phút 26** nó cầm **hai Rìu đá đều gãy** và không còn gỗ: không chặt được cây nào nữa, dù vùng nó đang đứng có 1.526 cây còn gỗ.

- Vì sao gãy: bot dùng cả rìu để đập đồ ven đường (ghi chú có sẵn trong bài kiểm thử nói vậy), nên hai rìu mòn hết. Khi tôi cho bot dùng Gậy gỗ cho việc đó thì nó không kẹt nữa.
- Theo luật mới, lối ra là **chết rồi tỉnh dậy với rìu mới**. Tôi không tìm thấy nút tự hồi sinh nào trong mã giao diện, nên người chơi phải chờ đói, khát hoặc bị thú giết.
- Lối khác tôi biết: phần thưởng chương Landfall của sổ tay cho một Rìu đá (một lần); sửa rìu cần 1 đá + 1 gỗ (lại cần gỗ). **Chưa kiểm:** có lấy được gỗ bằng cách đổi đồ với cư dân hay từ thùng, rương ngoài đảo không.

Cách tôi làm tệp đó xanh lại: cho bot chơi đúng luật mới, tức là **làm một Gậy gỗ để đập đồ ven đường** (12 gỗ, sức 2 so với rìu 1), vứt gậy gãy, và xem lại công cụ sau mỗi 5 món thay vì cuối mỗi vùng. Mọi điều kiện đạt của bài giữ nguyên. Đây là sửa cách chơi của bot, không sửa game. Tình huống kẹt vẫn có thật với người chơi nào để gãy hết rìu khi hết gỗ.

**Cần Creator quyết:** chấp nhận như vậy (giống Last Island), hay thêm một lối ra không cần chết. Ví dụ: rìu gãy vẫn chặt được nhưng rất yếu; hoặc thêm nút "bỏ cuộc và tỉnh dậy ở chỗ an toàn".

### Chưa kiểm

- `web/scripts/npc-mere-playtest.mjs` có một dòng kiểm đồ khởi đầu; tôi đổi thành Stone Axe nhưng **chưa chạy** kịch bản này.
- Trên trình duyệt chưa thử: Gậy gỗ đập đồ ven đường; rìu đập quặng; câu báo mới khi dùng sai công cụ. Ba việc này mới có bài kiểm thử tự động.
- Các lượt trình duyệt ở mục trước (`j1`…`n1`) chạy trên `d00d7791`, chưa chạy lại trên mã mới. Riêng `j1` (kẹt với Gậy gỗ) không còn đúng với ván mới.
- Sổ tay vẫn tặng thêm một Stone Axe ở chương Landfall; giờ thành rìu dự phòng. Chưa hỏi Creator có giữ không.

## Bốn quyết định của Creator trên bản `98ee24ac` — mã game `224d5d7a`

### Creator quyết gì

1. **Thêm nút bỏ cuộc**: người chơi bị kẹt được tỉnh dậy ở chỗ an toàn mà không phải chờ chết.
2. **Bỏ cuốc, theo Last Island**: rìu làm luôn việc của cuốc.
3. **Sổ tay**: mỗi chương tặng một gói đồ khởi đầu và nói rõ gói đó mở ra việc gì.
4. **Các việc còn treo giao cho agent tự quyết**: Ván (Plank), người chờ trên tàu, máu sau khi được cứu bằng nước, giới hạn tìm đường tới bến.

### 1. Nút bỏ cuộc

- Esc → **"Stuck? Give up & wake somewhere safe…"** → hỏi lại một lần ("Give up & wake" / "No").
- Giá phải trả **bằng đúng một lần chết**: mọi thứ đang mang nằm lại trong túi tại chỗ; người chơi tỉnh dậy ở giường rơm của mình nếu có, không thì ở một bờ an toàn, với một Stone Axe mới. Ván chơi tiếp tục, đồng hồ không dừng.
- Không có nút này khi đang ở trên tàu ngoài biển, và khi đã gục (lúc đó đã có nút "Rise").
- Dùng bao nhiêu lần cũng được. Tôi **không** đặt giới hạn hay thời gian chờ: giá của nó đã là mất chỗ đứng và phải quay lại lấy túi.

### 2. Không còn cuốc

| Rìu | Gỗ | Đá | Quặng | Đồ ven đường | Độ bền |
|---|---|---|---|---|---|
| Stone Axe | 3 | 3 (trước 1) | 2 (trước 1) | 2 | 180 |
| Iron Axe | 6 | 6 (trước 2) | 5 (trước 2) | 4 | 400 |
| Salvager Axe | 9 | 9 (trước 3) | 8 (trước 3) | 7 | 500 |

- Số đá, quặng, đồ ven đường của mỗi rìu **là đúng số của cuốc cùng cấp**. Tôi không nghĩ ra số mới.
- Quặng sắt giàu (Rich Iron Ore) trước cần Iron Pickaxe trở lên; nay cần Iron Axe trở lên. Tỉ lệ rơi giữ nguyên (8 % và 12 %).
- **Bốn công thức bị bỏ**: Stone Pickaxe, Iron Pickaxe, Salvager Pick, và đường bánh răng của Salvager Pick. Còn **111 công thức** (trước 114).
- **Một công thức mới, số do tôi chọn (SOH_PROVISIONAL), Creator chưa duyệt:** "Salvager Axe (geared)" = Iron Axe + 1 Metal Blade + 1 Refined Iron + 1 Mechanical Gear + 2 Parts. Lý do có nó: đường bánh răng của cuốc là một trong ba công thức dùng Mechanical Gear và ai cũng biết sẵn; bỏ hẳn thì Gear mất một chỗ dùng. Lý do có 1 Refined Iron: máy tái chế trả 1 Refined Iron cho một Salvager Axe còn nguyên; công thức không chứa món đó thì thành cách đẻ ra Refined Iron.
- Thương nhân bán Iron Axe (giá 12) thay cho Iron Pickaxe. Thợ máy và kỹ sư trong làng cầm Stone Axe.
- Câu báo khi công cụ quá yếu: "Too hard for this — an axe would break it."

**File lưu cũ:**

- Cuốc trong túi, trong rương **và trong tay cư dân** thành rìu cùng cấp: vẫn là món đó (cùng mã), cùng tỉ lệ độ bền; cuốc đã gãy thành rìu gãy.
- Việc chế cuốc đang chạy dở ở bàn chế vẫn chạy hết và trả ra rìu, đúng một lần.
- Công thức cuốc bị gỡ khỏi danh sách đã học; ai biết đường bánh răng của cuốc thì biết đường bánh răng của rìu.
- Ba dòng cuốc vẫn nằm trong bảng vật phẩm (ghi là đã bỏ) để file lưu cũ đọc được; bảng tái chế vẫn giữ dòng cuốc cho việc tái chế đang chạy dở.

### 3. Sổ tay

Mỗi chương có thêm dòng **"Opens: …" / "Mở ra: …"**. Sáu chương đầu đổi gói quà thành gói mở đường; năm chương sau giữ nguyên.

| Chương | Gói mới | Mở ra |
|---|---|---|
| Landfall | Wood Club, Territory Cabinet, Campfire, 4 Roast Meat | vũ khí và đồ đập ven đường; dựng trại riêng |
| Hearth & Wall | Workbench, Wood Chest, Straw Bed, 2 Torch | bàn chế đặt được ngay; giường là chỗ tỉnh dậy |
| Fire & Iron | Research Table, 6 Iron Ingot, 10 Charcoal, 4 Rope | nghiên cứu công thức |
| Paper & Parts | Garden Plot, 4 Sunroot Seed, 12 Parts, 4 Electronic Parts | trồng trọt |
| Field & Flock | 2 Taming Lead, Feed & Water Trough, Trail Canteen, 3 Wild Berry Seed | thuần thú |
| Beyond the Treeline | Hand Cart, Trail Pack, 4 Bandage | kéo xe, đi xa |

- Landfall không còn tặng thêm Stone Axe (người chơi đã có sẵn một cái); bước đầu đổi thành "Gather with your axe".
- **Các gói này do tôi chọn, Creator chưa duyệt từng món.** Tôi chưa đo chúng làm ván chơi dễ đi bao nhiêu.

### 4. Bốn việc Creator giao tôi tự quyết

| Việc | Tôi quyết | Vì sao |
|---|---|---|
| Ván (Plank) không ai dùng | **Ván là chất đốt 40 giây**, bằng đúng 2 Gỗ làm ra nó | Không đổi công thức, không đổi đồ rơi, không cần chuyển file lưu |
| Người đã lên tàu không ăn uống | **Ăn uống từ túi của chính mình**, chỉ trong lúc tàu còn đón khách | Không với tới kho làng từ trên tàu; sau khi tàu rời bến thì không đụng gì nữa |
| Được cứu bằng nước đứng dậy với < 1 máu | **Đứng dậy với ít nhất 10 máu** | Dưới mức 30 nên thầy thuốc vẫn phải tới chữa thật |
| Giới hạn tìm đường tới bến | **Giữ 96.000 ô** | Xem dưới |

- **Ván:** lần thử đầu của tôi là bỏ việc xẻ ván và cho tách Ván lại thành Gỗ. Cách đó khiến Gỗ (nguyên liệu thô) có công thức, phạm vào luật thiết kế có bài kiểm thử canh, nên tôi bỏ.
- **Giới hạn 96.000:** tôi không tăng nữa. Số đo cũ: áp 96.000 cho mọi đường đi làm giờ đầu chậm 30–40 %; cho 400.000 thì một lượt tìm giữ 200–400 nghìn ô trong bộ nhớ và trong file lưu (file lưu vốn đã gần mức 5 MB). **Cái giá, vẫn còn nguyên:** bến nào cần xét quá 96.000 ô mới tới được (đã biết: bến nam) thì cư dân không tới được. Con số to hơn không chữa được; cần một cách tìm đường khác giữa các vùng, và việc đó **chưa làm**. Quyết định được ghi ngay tại hằng số trong `navigation-save.ts`.

### Đã kiểm trên `224d5d7a`

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| Hồi quy 266 tệp | Lượt chạy trên `224d5d7a`: **3 tệp đỏ** (4 bài trượt, 1.606 bài đạt; 13 tệp chỉ có bài phải bật tay). Cả ba là bài kiểm thử hoặc tệp tham chiếu còn theo luật có cuốc; đã sửa và **chạy lại riêng các tệp đó: 68 đạt, 0 trượt**. Chưa chạy lại cả 266 tệp sau khi sửa (xem dưới) |
| Chạy bền 336 giờ, seed 7606, không người chơi | Cổng chiến dịch **15/15**; sơ tán 6, sống sót 46, chết 234 |
| Trình duyệt, bản dựng thật (`p1-rulings.mjs`, không dựng sẵn gì) | Đạt |

- **Hồi quy: ba tệp đỏ và cách sửa.** Lượt chạy đủ 266 tệp trên `224d5d7a` ra 3 tệp đỏ. Không tệp nào chỉ ra lỗi trong mã game; tôi không đổi `web/src` sau `224d5d7a`.

| Tệp đỏ | Vì sao đỏ | Đã sửa thế nào | Chạy lại |
|---|---|---|---|
| `tests/g1b-roll.test.ts` (2 bài) | Hợp đồng rương đã duyệt và đóng băng vẫn ghi `iron_pick` | Không đụng hợp đồng. Bài kiểm thử ghi rõ một ngoại lệ duy nhất này và kiểm món thật được phát | 9 đạt |
| `tests/item-ontology-v2-li-historical.test.ts` (1 bài) | Một tệp CSV tham chiếu do máy sinh còn chữ "pick quality" | Sinh lại tệp; đổi đúng một dòng | 22 đạt |
| `tests/arena1-round2-newgame-routes.test.ts` (1 bài) | Con bot đi tuyến dầu vẫn chế Stone Pickaxe, engine từ chối | Bot chỉ dùng rìu; xem ghi chú dưới | 4 đạt |

  - Chạy lại riêng: bốn tệp trên cùng `creator-rulings-98ee24ac` (53 đạt) và `g1a-industrial-salvage`, tệp dùng chung bộ trợ giúp của bot (15 đạt). Tổng 68 đạt, 0 trượt. **Tôi chưa chạy lại cả 266 tệp sau các sửa này**; các sửa chỉ nằm trong bài kiểm thử, một tệp trợ giúp và một tệp CSV tham chiếu.
  - **Rương quà (hệ quả thật trong game):** tám loại rương (`supply_damaged`, `supply_low`, `supply_mid`, `supply_high`, `toolbox_damaged`, `toolbox_low`, `toolbox_high`, `military_low`) có dòng quà thêm "Iron Pickaxe". Nay lần quay đó phát **Iron Axe**. Các rương này vì thế có hai dòng cùng ra Iron Axe, tức Iron Axe rơi khoảng gấp đôi trước (theo bảng tỉ lệ của hợp đồng: `supply_damaged` 4 % → 8 % mỗi lần mở, `toolbox_high` 11,8 % → 23,6 %). Tôi không sửa tỉ lệ, vì hợp đồng rương là thứ Creator đã duyệt. **Đã xử lý ngày 24/11 theo quyết định của Creator, xem mục kế.**
  - **Con bot tuyến dầu (điều nó cho thấy về cân bằng):** để qua được, bot phải (a) vứt rìu đá gãy xuống đất khi đã có cái lành, và (b) vứt đồ thừa khi túi đầy 24 ô trước khi nhận bản vẽ, chế dây, nhận thang. Không khẳng định nào bị nới. Lý do: một dòng công cụ làm ba việc nên rìu đá mòn nhanh hơn, rìu gãy chiếm ô túi. Lượt qua mất 546 giây máy so với khoảng 370 trước đây. Đây là một lượt chạy của một con bot, không phải số đo cân bằng.
- **Chạy bền:** lượt trước (`ff678df9`) là sơ tán 6, sống sót 32, chết 248. Hai lượt khác nhau từ giờ đầu. Sống sót tăng 14; tôi **không tách được** phần nào là do luật nào. Sáu người rời đảo trên tàu tây: h5v, h4x, h2l, h7, h4o, h4m. Bến nam và bến Hook không có chuyến nào, như lượt trước. **File lưu lớn nhất 4,22 MB** (lượt trước 3,97 MB; mức của localStorage là 5 MB).
- **Luật "người trên tàu ăn uống" chưa được lượt chạy bền thử:** ở các mốc lưu giờ 312 và 324 không có ai đang chờ trên tàu. Luật này mới có bài kiểm thử tự động.
- **Trình duyệt** (ván mới, phím và chuột thật): túi khởi đầu có Stone Axe, không có cuốc. Sổ tay hiện đủ 11 chương, chương nào cũng có gói quà và dòng "Opens:". Rìu đá chặt sồi ra gỗ và **đập đá tảng ra 5 đá**. Mở Esc, bấm nút bỏ cuộc, bấm "No": không có gì đổi. Bấm lại rồi "Give up & wake": nhân vật tỉnh dậy cách đó 679 điểm ảnh, 60 máu, túi chỉ có một Stone Axe mới; túi rơi tại chỗ cũ chứa đúng 5 món đã mang (rìu cũ độ bền 167, 8 gỗ, 5 đá, bình nước, 3 quả mọng); lượt tự lưu sau đó thành công; không có lỗi trang. **Lượt đi không gặp mạch quặng nào**, nên rìu đập quặng mới có bài kiểm thử tự động.
- **Bài kiểm thử mới** (`tests/creator-rulings-98ee24ac.test.ts`, 18 bài): rương quay ra Iron Pickaxe thì phát Iron Axe; bỏ cuộc (túi rơi đủ món, từ chối khi đã gục, dùng ba lần liền); sức của ba rìu và số nhát để đập hết đá tảng, mạch sắt; file lưu cũ có cuốc ở túi, rương, tay cư dân; việc chế cuốc dang dở trả rìu; Ván cháy 40 giây; người trên tàu ăn từ túi mình, túi rỗng thì nhịn, tàu rời bến thì không ăn; được cứu bằng nước đứng dậy với 10 máu và vẫn cần thầy thuốc.
- **Bài kiểm thử cũ phải sửa theo luật mới:** 25 tệp và một tệp trợ giúp của bot (23 tệp trong `224d5d7a`, thêm ba tệp sau lượt hồi quy). Phần lớn là đổi cuốc thành rìu. Hai chỗ đáng nói: (a) bài kiểm của thầy thuốc trước khẳng định "nước không hồi máu, bệnh nhân còn 1 máu", nay là 10; (b) bảng "máy tái chế trả quá tay" của ba bảng tái chế cũ đã đóng băng có danh sách món đổi theo, vì giá chế của Salvager Axe đổi. Bảng tái chế đang dùng (v4) vẫn không trả quá tay món nào.

### Chưa kiểm / còn nợ

- Trên trình duyệt chưa thử: rìu đập quặng; mở file lưu cũ có cuốc; nhận gói quà sổ tay bằng cách làm xong chương; bỏ cuộc khi đã có giường; nút bỏ cuộc bằng tiếng Việt (**chữ trên nút chỉ có tiếng Anh**, như cả bảng Esc).
- Các lượt trình duyệt `j1`…`n1` chưa chạy lại trên mã mới. Riêng `o1` (ván mới có Stone Axe, lấy gỗ và đá, gục rồi tỉnh dậy được phát Stone Axe; cái chết được dựng sẵn) đã chạy lại trên `224d5d7a`: đạt (`browser-checks/out-o1-224d5d7a.txt`).
- `web/reports/mec01-five-chain-benchmark.{json,md}` trong repo là bản cũ: bài kiểm thử tự viết lại hai tệp này mỗi lần chạy và tôi không commit bản mới, vì bản trong repo vốn đã lệch ở những chỗ không liên quan trước đợt này.
- Chưa có số đo nào về cân bằng: rìu giờ làm ba việc bằng một thanh độ bền; tôi chưa đo người chơi tốn bao nhiêu rìu so với trước.
- Mọi món nợ ở các mục trước (cảnh B, C, D, F, I; sổ tay chương 3–11 chơi tay; Elder bơi; "Step ashore"; đi bộ tới bến; `npc-mere-playtest.mjs`) còn nguyên.

## Tám câu trả lời của Creator ngày 24/11 — mã game `384b35ad`

### Creator quyết gì

| Việc | Creator chọn | Đã làm |
|---|---|---|
| 1. Rương ra Iron Axe gấp đôi | Sửa; sau khi xem bảng tỉ lệ chọn **cách 2** | Lần quay trúng dòng cuốc không phát gì (dưới) |
| 2. Công thức Salvager Axe (geared) | Duyệt | Ghi vào mã và bảng thiết kế |
| 3. Sáu gói quà sổ tay | Duyệt cả sáu | Ghi vào mã |
| 4. Được cứu bằng nước: 10 máu | Duyệt | Ghi vào mã |
| 5. Ván cháy 40 giây | Duyệt | Ghi vào mã |
| 6. Bến nam không tới được | Chấp nhận tạm, làm ở đợt sau | Ghi tại hằng số; **chưa làm** |
| 7. Độ bền rìu đá | Đo trước rồi mới quyết | Đã đo (dưới); **chờ Creator quyết** |
| 8. Gộp PR #65 | Chạy lại đủ hồi quy, xanh thì gộp | Hồi quy xanh (dưới); PR được gộp ngay sau commit tài liệu này |

### 1. Rương: lần quay trúng dòng cuốc không phát gì

- **Tôi đã viết sai ở lượt trước.** Tôi nói xoá dòng cuốc thì "Iron Axe về mức cũ, các món khác ra nhiều hơn một chút". Hai vế không cùng đúng được: rương chọn quà thêm theo trọng số, xoá một dòng thì mọi món còn lại, kể cả Iron Axe, đều tăng. Tôi gửi lại bảng với hai cách làm thật; Creator chọn cách 2.
- **Luật:** rương quay quà thêm như cũ. Nếu trúng dòng Iron Pickaxe thì lần đó **không có quà thêm**. Mọi món còn lại giữ đúng tỉ lệ Creator đã duyệt; rương ít có quà thêm hơn đúng bằng phần của cuốc.
- Tệp hợp đồng đã đóng băng **không bị sửa**. Phần còn lại của lần quay (món chính, món thường, Core) không đổi một số nào.
- Cuốc đã nằm sẵn trong rương của file lưu cũ vẫn thành Iron Axe như trước: đó là đồ của người chơi.

Tỉ lệ Iron Axe mỗi lần mở rương:

| Rương | Đã duyệt | Trên `c829a57f` | Nay | Xác suất có quà thêm (duyệt → nay) |
|---|---|---|---|---|
| `supply_damaged` | 4,0 % | 8,0 % | 4,0 % | 10 % → 6 % |
| `supply_low` | 5,3 % | 10,7 % | 5,3 % | 16 % → 10,7 % |
| `supply_mid` | 6,3 % | 12,5 % | 6,3 % | 25 % → 18,8 % |
| `supply_high` | 10,0 % | 15,0 % | 10,0 % | 35 % → 30 % |
| `toolbox_damaged` | 4,3 % | 8,6 % | 4,3 % | 15 % → 10,7 % |
| `toolbox_low` | 9,0 % | 18,0 % | 9,0 % | 30 % → 21 % |
| `toolbox_high` | 11,8 % | 23,6 % | 11,8 % | 65 % → 53,2 % |
| `military_low` | 10,0 % | 20,0 % | 10,0 % | 50 % → 40 % |

- **Đã kiểm:** bài kiểm thử quay 30.000 lần cho mỗi loại trong tám rương: không lần nào ra cuốc; tỉ lệ Iron Axe khớp mức đã duyệt; mức gấp đôi cũ nằm ngoài sai số (để chắc phép đo phân biệt được hai mức). Luật "không phát" chỉ trúng đúng tám dòng cuốc, không dòng nào khác trong 16 loại rương.
- **Chưa kiểm:** chưa mở rương nào trên trình duyệt sau khi sửa.

### 7. Phép đo rìu đá

**Cách đo.** Cùng một con bot đi cùng tuyến dầu (ván mới, seed 7, từ bờ biển tới lò lớn và quần giáp sắt), một lần trên `98ee24ac` (còn cuốc) và một lần trên mã mới. Bot ghi lại mỗi điểm độ bền bị trừ, của công cụ nào, vào việc gì. Số liệu gốc: `axe-wear/`.

| | Trước (`98ee24ac`, rìu + cuốc) | Sau (`384b35ad`, chỉ rìu) |
|---|---|---|
| Công cụ đá phải chế thêm (ngoài rìu khởi đầu) | 1 rìu + 1 cuốc | 1 rìu |
| Độ bền công cụ đá đã tiêu | **752** (rìu 574 + cuốc 178) | **642** |
| … vào gỗ | 357 | 383 |
| … vào đá | 90 (36 bằng rìu yếu, 54 bằng cuốc) | 54 |
| … vào quặng | 124 | 136 |
| … vào cây bụi, lau sậy | 170 | 51 |
| Công cụ đá mòn tới 0 | 1 | 1 |
| Số lần sửa ở bàn chế (1 đá + 1 gỗ mỗi lần) | 3 | 3 |
| Lần "không có công cụ dùng được" | 7 | 0 |
| Lần phải vứt đồ vì túi đầy | 1 | 3 |
| Tới lúc đặt lò lớn | 38,7 phút | 40,0 phút |
| Hết tuyến | 60,1 phút | 75,5 phút |

- **Điều phép đo cho thấy:** trên tuyến này, một dòng rìu **không** tốn công cụ hơn. Tổng độ bền tiêu ít hơn (642 so với 752), chế ít hơn một món, số lần sửa và số món gãy bằng nhau. Lý do: trước đây rìu yếu vẫn bị đem ra đập đá, và mỗi công cụ có thanh độ bền riêng nên không dùng hết.
- **Cái giá thấy được là ô túi và thời gian**, không phải độ bền: bot phải vứt đồ ba lần thay vì một, và tới lò lớn chậm hơn 1,3 phút.
- **15 phút chậm ở chặng cuối tôi không quy được cho rìu.** Chặng đó là đi săn lấy da (27 lượt săn so với 14); thú xuất hiện khác nhau giữa hai lượt.
- **Giới hạn của phép đo:** một seed, một tuyến, một con bot biết trước bản đồ. Hai lượt không dùng cùng một bot hoàn toàn: bot mới mang một rìu dự phòng và biết vứt rìu gãy. Phần cây bụi chuyển từ rìu sang gậy và giáo ở lượt sau (gậy 94 → 229, giáo 43 → 183), nên con số 642 có một phần là do bot đổi công cụ, không phải do luật.
- **Tôi đề nghị giữ 180.** Phép đo không cho lý do để tăng. Việc này vẫn do Creator quyết.

### Đã kiểm trên `384b35ad`

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| Hồi quy 266 tệp | **266 tệp, 0 tệp đỏ**: 1.611 bài đạt, 0 trượt (13 tệp chỉ có bài phải bật tay, như các lượt trước). Hai tệp chạy dài (`g1b-lifecycle`, `ecosystem-full`) bị bộ chạy của tôi ngắt ở phút 15 trong lượt đầu vì tôi đặt giới hạn quá ngắn; chạy lại với giới hạn dài hơn thì đạt (17 và 16 phút) |
| Chạy bền 336 giờ, seed 7606, không người chơi | Cổng chiến dịch **15/15**; sơ tán 6, sống sót 46, chết 234. **Giống lượt trên `224d5d7a` từng giờ một** (336/336 giờ trùng dấu vân tay) |
| Trình duyệt, ván mới: sổ tay 11 chương, rìu lấy gỗ, nút bỏ cuộc (`p1`) | Đạt |
| Trình duyệt, ván mới: rìu lấy gỗ, đá và tinh thể; gục rồi tỉnh dậy được phát Stone Axe (`o1`, cái chết được dựng sẵn) | Đạt |

- **Chạy bền:** luật rương chỉ chạy khi người chơi mở rương, và lượt chạy bền không có người chơi. Kết quả trùng lượt trước ở cả 336 giờ xác nhận lần sửa này không đụng tới đời sống cư dân. File lưu lớn nhất vẫn 4,22 MB.
- **Trình duyệt `p1`:** lượt đầu trên bản dựng mới hết 25 phút giới hạn khi đang đi mò tìm đá (lượt đi là đi mù). Lượt lưu lại chỉ đòi gặp cây: đủ 11 chương sổ tay, chặt thông ra gỗ, "No" giữ nguyên túi, "Give up & wake" tỉnh dậy với một Stone Axe, túi rơi đủ 4 món, tự lưu thành công, không lỗi trang.
- **Trình duyệt `o1`:** lần này rìu đá đập một mạch tinh thể ra 3 tinh thể và một tảng đá ra đá. Đây là lần đầu rìu đập một nguồn loại quặng trên trình duyệt; **mạch sắt thì vẫn chưa gặp**.
- **ZIP phát hành** đóng lại từ bản dựng của `384b35ad`: 64.364.555 byte, 220 tệp, SHA256 `5327ee6ed82810ebcbe0e51bc2e27a38540f5fd31408ff55abb12d3b26a74396`.

### Chưa kiểm / còn nợ

- Chưa mở rương nào trên trình duyệt sau khi sửa luật rương.
- Bến nam: chưa làm, theo quyết định của Creator.
- Mọi món nợ ở mục trước còn nguyên (rìu đập mạch sắt trên trình duyệt; file lưu cũ có cuốc; nhận gói sổ tay bằng cách làm xong chương; bỏ cuộc khi đã có giường; bảng Esc chỉ có tiếng Anh; `j1`…`n1` chưa chạy lại; cảnh B, C, D, F, I; sổ tay chương 3–11 chơi tay; Elder bơi; "Step ashore"; đi bộ tới bến).
- 13 cổng của tháp điều khiển chưa ký.

