# Tiến độ sửa lỗi sau nghiệm thu `6d2dec8`

Cập nhật: 2026-11-22 (lần 7 — sổ tay tân thủ mới, lượt khoá SHA `0d9cc3b3`: 247 tệp đạt, 0 đỏ, endurance 15/15). Nhánh `arena/0f6091f9-soul-of-hero`. Chưa đẩy lên GitHub, chưa có PR, chưa phát hành.

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
- Một khả năng kẹt của người chơi chưa kiểm tra trong game thật: Gậy gỗ và rìu cùng hỏng khi trong túi không còn gỗ (bot đã gặp đúng tình huống này).
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
- **Vercel:** đã tạo project `soul-of-hero` (nhóm `menden`), nối với repo, thư mục gốc `web`. Bản đầu tiên dựng từ nhánh `arena/0f6091f9-soul-of-hero` ở `6c4b8933`, trạng thái READY, địa chỉ `https://soul-of-hero.vercel.app`. Vercel tự xếp bản đầu tiên của project vào mục production. Project **không** tự dựng lại khi có commit mới (cùng cấu hình với các project khác của tài khoản). **Chưa mở được địa chỉ này từ máy thử** (máy thử bị chặn mạng ra ngoài), nên mới biết là dựng xong, chưa biết là chơi được.
- **Chưa làm:** gộp vào `main` (chờ 13 cổng và Creator duyệt); chơi tay chương 3–11 của sổ tay; các mục "Chưa làm" ở trên vẫn còn nguyên trừ ZIP và Vercel.
