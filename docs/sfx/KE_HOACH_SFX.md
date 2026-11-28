# Kế hoạch âm thanh (SFX) — Soul of Hero bản web

Ngày lập: 28/11/2026. Nhánh `arena/1fe1361c-soul-of-hero`.

Tài liệu này trả lời bốn câu hỏi: game cần những tiếng gì, mỗi tiếng hoạt động ra sao, slot nào đã có file, và làm thế nào để thêm hoặc đổi file.

Cập nhật 28/11/2026: đã xếp đợt file đầu tiên, lấy từ thư viện Sonniss trên Google Drive của bạn. Xem mục 1 và mục 10.

Bảng đầy đủ từng slot nằm ở `docs/sfx/BANG_SLOT_SFX.md` (đọc trên GitHub) và `docs/sfx/slots.csv` (mở bằng Excel hoặc Google Sheets).

## 1. Tình trạng hiện nay

- Có **360 slot**. Mỗi slot là một chỗ có tên cho một tiếng. Đủ số bản thì cần **793 file**.
- **252 slot đã có file riêng: 489 file, 8,9 MB.** Tất cả cắt từ thư viện Sonniss #GameAudioGDC của bạn.
- 45 slot mượn file của slot gần nghĩa. 21 slot vẫn dùng tiếng tổng hợp cũ. 42 slot im lặng.
- **Tôi không nghe được âm thanh.** Tôi chọn theo tên file và theo số đo: độ dài, độ to, đường bao, phổ tần. Vì vậy bạn cần nghe lại trên bảng `#sfx` (mục 8). Mục 10 nêu những nhóm tôi kém chắc nhất.

| Mức ưu tiên | Số slot | Có file riêng | Mượn | Tổng hợp | Im lặng |
|---|---|---|---|---|---|
| P1: nghe liên tục khi chơi | 128 | 115 | 3 | 9 | 1 |
| P2: làm thế giới dày hơn | 148 | 99 | 30 | 7 | 12 |
| P3: thêm cho đẹp | 84 | 38 | 12 | 5 | 29 |

Slot P1 còn thiếu file:

- Im lặng: `npc.talk`. Thư viện không có tiếng người nói lầm rầm trung tính.
- Tổng hợp: `cr.tell`, `cr.die`, `haz.hit`, `fire.ignite` và năm slot `core.windup.*`. Các slot này giữ tiếng tổng hợp cũ, nghe vẫn đúng lúc.

## 2. Các nhóm slot

| Nhóm (tên folder) | Nội dung | Slot | File |
|---|---|---|---|
| `ui` | Bấm nút, mở và đóng bảng, bản đồ, từ chối, tiền | 16 | 25 |
| `item` | Nhặt, xếp, thả đồ theo chất liệu | 13 | 27 |
| `prog` | Mốc hành trình, phần thưởng, biểu ngữ lớn, Ragnarok | 17 | 18 |
| `step` | Bước chân trên 12 loại mặt đất | 12 | 60 |
| `player` | Lăn, né, trúng đòn, ăn, uống, chết, hồi sinh | 11 | 28 |
| `warn` | Máu thấp, đói, khát, lạnh, hết sức, phóng xạ, hết xăng | 7 | 11 |
| `swing` | Vung vũ khí theo loại, cung tên | 8 | 24 |
| `hit` | Trúng thịt, trúng mạnh, kết liễu, tên cắm, choáng | 6 | 17 |
| `gather` | Chặt gỗ, đập đá, quặng, phế liệu, hái cây, cây đổ | 10 | 35 |
| `cr` | 17 họ sinh vật, mỗi họ bốn tiếng: báo đòn, đau, chết, kêu vu vơ | 71 | 175 |
| `elder` | 12 Elder và trùm phụ | 21 | 39 |
| `haz` | Vùng nguy hiểm trùm tạo ra: lửa, động đất, băng, nước, rễ, tia | 8 | 24 |
| `core` | Niệm và phóng Core theo nguyên tố và theo từng Core | 37 | 80 |
| `fire` | Bắt lửa, hơi nước, nổ, sét | 5 | 14 |
| `build` | Đặt công trình theo chất liệu, nâng cấp, sửa, tháo, sập | 11 | 29 |
| `door` | Cửa gỗ, cửa sắt, cửa điện, cửa khóa | 7 | 13 |
| `box` | Rương, thùng đồ, túi, hàng thả dù | 11 | 17 |
| `station` | Chế tạo, xong việc, bật tắt máy, bẫy, tháp tên | 19 | 36 |
| `farm` | Trồng, tưới, hái, thú nuôi, đi ngủ, thức dậy | 10 | 17 |
| `ride` | Xe kéo, xe máy, tàu sơ tán | 9 | 11 |
| `npc` | Nói chuyện, trao đổi, ra lệnh, người gục | 7 | 15 |
| `amb` | Tiếng điểm của môi trường: chim, cú, ếch, sấm, gió giật | 17 | 51 |
| `bed` | Nền kéo dài: đồng cỏ, rừng, đêm, mưa, gió, sóng | 15 | 15 |
| `loop` | Vòng lặp: lửa trại, lò, máy, xe máy, nhịp tim | 12 | 12 |

## 3. Mỗi slot hoạt động thế nào

Mỗi slot có các thông số sau. Tất cả ghi trong `web/src/game/sfx/slots.ts`.

- **Số bản.** Một slot nhận nhiều file. Mỗi lần phát, game chọn ngẫu nhiên một bản và không lặp lại bản vừa phát. Bước chân có 5 bản mỗi mặt đất, đòn trúng thịt có 5 bản, vung kiếm có 4 bản.
- **Lệch cao độ.** Mỗi lần phát, cao độ lệch ngẫu nhiên một chút (thường 5 %). Cùng một file nghe không bị máy móc.
- **Âm lượng riêng.** Mỗi slot có mức riêng. Ngoài ra từng file có thể chỉnh riêng trong `index.json`.
- **Thời gian chờ.** Khoảng tối thiểu giữa hai lần phát của cùng một slot. Tránh dồn tiếng.
- **Số tiếng cùng lúc.** Giới hạn số bản phát chồng nhau của một slot.
- **Vị trí.** Tiếng trong thế giới nhỏ dần theo khoảng cách và lệch trái phải theo vị trí trên màn hình. Xa quá tầm thì không phát. Tiếng giao diện luôn phát ở giữa.
- **Kênh.** Mỗi slot thuộc một trong bốn thanh trượt sẵn có ở thẻ Âm thanh: Giao diện, Thế giới, Chiến đấu, Môi trường.

Có ba kiểu slot:

| Kiểu | Số slot | Cách chạy |
|---|---|---|
| Một lần | 333 | Phát một lần khi có sự kiện. |
| Nền | 15 | Chạy liên tục, tự to nhỏ theo nơi đứng, giờ trong ngày, thời tiết. Chuyển êm, không cắt cụt. |
| Vòng lặp | 12 | Chạy khi một trạng thái còn đúng: lò đang cháy, đang ngồi trên xe, máu đang thấp. |

Thứ tự dự phòng của mỗi slot:

1. Có file của chính slot thì phát file đó.
2. Chưa có thì mượn file của một slot gần nghĩa (ví dụ đóng bản đồ mượn đóng bảng).
3. Vẫn chưa có thì phát tiếng tổng hợp cũ.
4. Không có gì thì im lặng.

Nhờ vậy bạn giao bao nhiêu file game chạy bấy nhiêu. Không cần đủ 793 file mới chơi được.

## 4. Cái gì kích hoạt tiếng

Bốn nguồn. Không nguồn nào thay đổi diễn biến của ván chơi. Chơi bật tiếng và tắt tiếng cho kết quả như nhau.

| Nguồn | Số slot | Ví dụ |
|---|---|---|
| Hiệu ứng trong thế giới | 182 | Bước chân, vung, trúng đòn, sinh vật báo đòn, Core phóng, sét, nổ |
| Hành động đã được ghi nhận | 86 | Xây, mở cửa, ăn, uống, máy xong việc, hết nhiên liệu, hàng thả dù |
| Màn hình | 29 | Bấm nút, đổi thẻ, mở và đóng bảng, vào chế độ xây |
| Quan sát mỗi giây | 51 + 12 vòng lặp | Nền môi trường, chim và cú, cảnh báo cơ thể, bình minh, hoàng hôn, máy ở gần |

Vài quy tắc đáng biết:

- **Bước chân** theo mặt đất thật: cỏ, rừng, cát, tuyết, băng, bùn, nước, đường, gỗ, đá, tro, kim loại. Sàn bạn xây được ưu tiên hơn đất bên dưới.
- **Sinh vật** có tiếng riêng theo họ. Con nào chưa có file thì dùng tiếng chung.
- **Chim chỉ hót ban ngày, ngoài trời, khi không mưa.** Cú kêu ban đêm. Ếch ở đầm lầy. Trong nhà chỉ còn tiếng nhà. Khi đang đánh nhau thì không có tiếng điểm nào chen vào.
- **Nền môi trường** nhỏ đi khi vào nhà. Mưa ngoài trời và mưa trên mái là hai slot khác nhau.
- **Máy xong việc** ở gần thì nghe tại chỗ máy. Ở xa thì nghe một tiếng báo nhỏ.
- **Cảnh báo cơ thể** phát khi một chỉ số vừa vượt ngưỡng. Đói, khát, lạnh nhắc lại sau 45 đến 60 giây nếu vẫn còn.
- **Nhịp tim** to và nhanh dần khi máu tụt dưới 28.
- **Xe máy** đổi cao độ theo tốc độ.
- **Trở lại sau khi vắng mặt** không phát dồn hàng loạt tiếng cũ.

Có một bài kiểm tra tự động bảo đảm: slot nào cũng có thứ kích hoạt, và hiệu ứng nào của game cũng có slot hoặc được cố ý để im.

## 5. Những gì đã thay đổi ngay, khi chưa có file

- **Sửa lỗi bước chân.** Trước đây game so nhầm mã mặt đất: đi trên đồng cỏ nghe như tuyết, còn tuyết, cát, đầm lầy và nước đều nghe như đất thường. Nay đúng theo mặt đất.
- **Dùng lại các tiếng tổng hợp có sẵn nhưng chưa từng được gọi:** mở cửa, cửa khóa, bật và tắt máy, lên và xuống xe máy, học công thức, đạt thành tựu, sắp hết xăng.
- **Nút nào bấm cũng có tiếng.** Mở và đóng bảng có tiếng riêng. Trước đây nhiều nút im.
- **Rời ván về màn hình chính thì tiếng mưa, gió, máy tắt hẳn.** Trước đây chúng vẫn kêu tiếp.
- **Máy ở xa tắt tiếng hẳn** khi bạn đi khỏi tầm nghe.

Trước đợt file đầu tiên, 30 slot mức P1 im lặng vì chưa từng có tiếng tổng hợp. Nay 29 slot trong số đó đã có file; chỉ còn `npc.talk`.

## 6. Cách giao folder SFX

Bạn giao folder theo cách nào cũng được. Không bắt buộc đặt tên theo slot.

- **Định dạng nhận:** ogg, mp3, wav, m4a. Nên dùng ogg.
- **Nền và vòng lặp phải là ogg hoặc wav.** File mp3 và m4a để lại một khoảng lặng ở điểm nối vòng.
- **Tiếng một lần:** nên mono, đã cắt sát đầu, không có khoảng lặng trước tiếng.
- **Nền:** stereo, dài 20 đến 40 giây, nối vòng được. **Vòng lặp** (lửa, máy, xe): 4 đến 12 giây, nối vòng được.
- **Giấy phép:** cho tôi biết nguồn và giấy phép của từng gói. Tôi sẽ ghi vào `web/THIRD_PARTY.md`.
- **Nếu muốn đặt tên sẵn:** `<nhóm>/<tên slot>__NN.<đuôi>`, NN bắt đầu từ 01. Ví dụ `step/step.grass__01.ogg`. File đặt tên như vậy vào thẳng slot, không cần xét.

Tôi cắt, đổi định dạng và cân độ to được (mục 10). Điều tôi không làm được là **nghe**: file nào hợp tai hay không thì bạn quyết định trên bảng `#sfx`.

## 7. Cách thêm hoặc đổi một tiếng

Có hai đường. Cả hai đều kết thúc bằng `node scripts/sfx.mjs index`.

**Đường A: bạn đã có file cắt sẵn.** Đặt tên `<nhóm>/<tên slot>__NN.ogg` rồi chép vào `web/public/sfx/`. Hoặc giao cả folder, tôi chạy `sort` để đề xuất slot, xem lại, rồi `apply`.

**Đường B: cắt từ thư viện (cách tôi đã làm đợt đầu).**

1. Mỗi tiếng là một dòng trong `web/scripts/sfx-build/recipe.txt`: `tên slot | đầu tên file gốc | cách cắt`. Ví dụ `ui.back | MECHLtch_Click Deep Mechanism Latch | max=0.1`.
2. `make.py` đọc công thức, cắt, cân độ to, xuất OGG. `place.py` chép vào `web/public/sfx/` và ghi nguồn. `credits.py` lập lại `docs/sfx/NGUON_AM_THANH.md`.
3. `node scripts/sfx.mjs index` lập danh sách cho game và báo slot nào còn trống.

Muốn đổi một tiếng bạn không ưng: cho tôi tên slot và số bản (bảng `#sfx` ghi rõ), kèm tên file gốc bạn muốn thay nếu có. Tôi sửa một dòng công thức và chạy lại.

File WAV gốc không nằm trong kho mã. Chúng ở thư viện của bạn; công cụ đọc từ thư mục làm việc ngoài kho (`SFX_WORK`, mặc định `~/sfxwork/src`).

## 8. Bảng nghe thử

Mở địa chỉ game và thêm `#sfx` vào cuối.

- Bảng liệt kê cả 360 slot: đang có file, mượn file, dùng tiếng tổng hợp hay im lặng. Lọc được theo tình trạng, mức ưu tiên, tên.
- Nút **Nghe** phát một bản ngẫu nhiên. Nút **bản 01**, **bản 02**… phát đúng bản đó.
- Dưới mỗi bản ghi **tên file gốc trong thư viện** và cách cắt. Nhờ vậy bạn biết ngay tiếng đó lấy từ đâu.
- Dòng đầu bảng cho biết đã tải bao nhiêu file ở mỗi đợt và bộ nhớ đang dùng.

## 9. Các file liên quan

| File | Nội dung |
|---|---|
| `web/src/game/sfx/slots.ts` | Danh mục 360 slot. Muốn thêm, bớt, đổi thông số thì sửa ở đây. |
| `web/src/game/sfx/route.ts` | Sự kiện nào phát slot nào. |
| `web/src/game/sfx/director.ts` | Phần quan sát mỗi giây: nền, vòng lặp, cảnh báo, tiếng điểm. |
| `web/src/game/sfx/bank.ts` | Tải file theo đợt, giữ bộ nhớ trong hạn mức, chọn bản, thứ tự dự phòng. |
| `web/src/game/audio.ts` | Phát âm thanh; tiếng tổng hợp cũ vẫn nằm ở đây. |
| `web/src/ui/SfxBoard.tsx` | Bảng nghe thử. |
| `web/scripts/sfx.mjs` | Công cụ: `table`, `folders`, `sort`, `apply`, `index`, `status`, `dump`. |
| `web/scripts/sfx-build/` | Công thức cắt (`recipe.txt`) và công cụ Python: `make.py`, `place.py`, `credits.py`. |
| `web/public/sfx/` | 24 folder nhóm với 489 file OGG, `index.json` (danh sách, mức chỉnh độ to, dung lượng), `sources.json` (nguồn từng file). |
| `docs/sfx/NGUON_AM_THANH.md` | Từng file lấy từ bản thu nào, thư viện nào, của ai. |
| `web/THIRD_PARTY.md` | Giấy phép Sonniss. |
| `web/tests/sfx-slots.test.ts` | 20 bài kiểm tra cho danh mục và đường đi của tiếng. |
| `web/tests/sfx-bank.test.ts` | 21 bài kiểm tra cho việc tải theo đợt, bộ nhớ, dung lượng file, nguồn. |

## 10. Đợt file đầu tiên (28/11/2026)

### Nguồn và giấy phép

- 489 file cắt từ 235 bản thu của 26 nhà làm âm thanh, trong các gói Sonniss #GameAudioGDC trên Drive của bạn.
- Giấy phép Sonniss cho dùng miễn phí bản quyền trong dự án cá nhân và thương mại, được chỉnh sửa, không bắt buộc ghi công.
- Giấy phép cấm: bán lại tiếng ở dạng nguyên gốc, và dùng tiếng để huấn luyện AI. Tôi chỉ cắt và xử lý tín hiệu thông thường.
- File WAV gốc không đưa vào kho mã.

### Xử lý

- Tiếng một lần: mono, 44,1 kHz, cắt sát đầu, có đoạn tắt dần ở cuối.
- Nền: stereo, 48 kHz, nối vòng bằng đoạn chuyển 2 giây. Vòng lặp: mono, đoạn chuyển 0,5 giây.
- Độ to: mỗi nhóm có một mức đích (bước chân nhỏ nhất, Elder và lửa to nhất). Mức chỉnh của từng file nằm trong `index.json`, nên đổi độ to không cần xuất lại file.

### Tải theo đợt

Mục tiêu: màn hình đầu không chờ âm thanh, và tiếng dùng nhiều nhất có sẵn trước cú bấm đầu tiên.

| Đợt | Nội dung | File | Tải về | Lúc nào |
|---|---|---|---|---|
| 0 | Tiếng P1 của chính người chơi: nút bấm, đồ, bước chân, đòn đánh, thu hoạch, cảnh báo | 110 | 0,71 MB | Ngay khi màn hình chính hiện xong, trước khi bấm |
| 1 | Các tiếng P1 còn lại | 128 | 1,71 MB | Chạy nền sau cú bấm đầu tiên |
| 2 | Tiếng P2 | 161 | 1,77 MB | Chạy nền, lúc máy rảnh |
| 3 | Tiếng P3, nền và vòng lặp | 90 | 4,74 MB | Chỉ khi game cần tới |

- Ba đợt đầu cộng lại là 4,2 MB. Nền và vòng lặp nặng gần bằng chừng đó (4,15 MB cho 25 file), nên game chỉ tải nền và vòng lặp của nơi bạn đang đứng.
- Khi file đang trên đường tới, slot đó im chứ không phát tiếng tổng hợp thay. Lý do: tránh một tiếng nghe hai kiểu khác nhau.
- Mạng yếu (2G, chế độ tiết kiệm dữ liệu) hoặc máy rất ít bộ nhớ: chỉ tải đợt 0, còn lại tải khi cần.
- Bộ nhớ: âm thanh đã giải mã được giữ trong hạn mức 112 MB (80 MB trên máy 4 GB trở xuống). Vượt hạn mức thì bỏ nền và vòng lặp đã ngừng trước, rồi tới tiếng P2 và P3 lâu chưa dùng. Tiếng P1 không bao giờ bị bỏ.
- Trình duyệt không phát được Ogg Vorbis (Safari cũ) giữ nguyên tiếng tổng hợp.

### Những nhóm tôi kém chắc nhất

Bạn nên nghe các nhóm này trước:

| Slot | Vì sao kém chắc |
|---|---|
| `step.*` (bước chân) | Thư viện không có gói bước chân. Tôi cắt từ tiếng gần giống: lá cây, cành khô, cát, vật ướt, mặt nước; gỗ và đá lấy từ quân cờ nhựa hạ cao độ. |
| `ride.evac.open`, `ride.evac.depart` (còi tàu) | Không có còi tàu. Tôi dùng còi xe máy làm chậm còn 36 đến 38 phần trăm. |
| `loop.heartbeat` (nhịp tim) | Không có tiếng tim. Tôi lọc một cú đánh trầm thành nhịp đôi. |
| `warn.hp`, `warn.stamina`, `player.respawn` | Tiếng thở dốc của một giọng nam. Có thể không hợp nhân vật. |
| `player.death` | Một đoạn nhạc "thất bại" làm chậm lại; dài 1,0 giây, ngắn hơn mức mong muốn 1,5 đến 2,5 giây. |
| `swing.bow.shot`, `hit.arrow` | Lấy từ gói "Cartoon Arrow". Có thể nghe hơi hoạt hình. |
| `box.airdrop.descent` | Tiếng trực thăng Chinook, không phải máy bay thả dù. |
| `core.cast.spirit` bản 02, `ui.deny` | File gốc rất to; tôi đã hạ mức, nhưng nên nghe lại. |
| `loop.geiger`, `loop.recycler`, `bed.ash`, `bed.ragnarok` | Vòng ngắn (2,2 đến 13,5 giây). Có thể nghe ra sự lặp lại. |

### Còn thiếu

- `npc.*` (7 slot): không có giọng người phù hợp. `npc.recruit` giữ tiếng tổng hợp cũ, sáu slot kia im lặng hoặc mượn.
- `bed.room`, `loop.cart`, `swing.torch`, và các tiếng chung của sinh vật (`cr.tell`, `cr.hurt`, `cr.die`, `cr.idle`): chưa tìm được nguồn hợp.
- 36 trong 71 slot sinh vật chưa có tiếng riêng. Phần lớn mượn tiếng của loài gần giống; số còn lại dùng tiếng tổng hợp hoặc im.
