# Kế hoạch âm thanh (SFX) — Soul of Hero bản web

Ngày lập: 28/11/2026. Nhánh `arena/1fe1361c-soul-of-hero`.

Tài liệu này trả lời ba câu hỏi: game cần những tiếng gì, mỗi tiếng hoạt động ra sao, và bạn giao folder SFX thế nào để tôi xếp vào.

Bảng đầy đủ từng slot nằm ở `docs/sfx/BANG_SLOT_SFX.md` (đọc trên GitHub) và `docs/sfx/slots.csv` (mở bằng Excel hoặc Google Sheets).

## 1. Tình trạng hiện nay

- Game chưa dùng file âm thanh nào. Mọi tiếng đang do máy tự tổng hợp.
- Tôi đã vạch **360 slot**. Mỗi slot là một chỗ trống có tên, chờ file. Đủ số bản thì cần **793 file**.
- Chưa có file nào trong slot. Trong lúc chờ: 239 slot phát tiếng tổng hợp tạm, 121 slot im lặng.
- Hệ thống phát file đã chạy được. Tôi đã thử bằng 13 file tạm trong trình duyệt thật: game tải danh sách, tải file, phát đúng lúc, không lỗi. Sau đó tôi đã xóa 13 file tạm.

| Mức ưu tiên | Số slot | Số file | Ý nghĩa |
|---|---|---|---|
| P1 | 128 | 292 | Nghe thấy liên tục khi chơi. Nên có trước. |
| P2 | 148 | 295 | Làm thế giới dày hơn. Nên có. |
| P3 | 84 | 206 | Thêm cho đẹp. Thiếu thì game vẫn ổn. |

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

30 slot mức P1 hiện im lặng vì chưa từng có tiếng tổng hợp. Đây là nhóm nên có file sớm nhất:

`player.fall`, `warn.hp`, `swing.heavy`, `swing.blade`, `elder.emerge`, `elder.defeat`, `elder.phase`, `core.spirit.depart`, `core.spirit.arrive`, `build.collapse`, `box.airdrop.signal`, `station.trap.snap`, `farm.rest.start`, `farm.rest.end`, `ride.evac.open`, `ride.evac.depart`, `ride.evac.board`, `npc.talk`, `amb.bird`, `amb.thunder`, `amb.rag`, `amb.storm.start`, `bed.meadow`, `bed.forest`, `bed.night`, `bed.rain.roof`, `loop.campfire`, `loop.bike.idle`, `loop.bike.run`, `loop.heartbeat`.

## 6. Cách giao folder SFX

Bạn giao folder theo cách nào cũng được. Không bắt buộc đặt tên theo slot.

- **Định dạng nhận:** ogg, mp3, wav, m4a. Nên dùng ogg.
- **Nền và vòng lặp phải là ogg hoặc wav.** File mp3 và m4a để lại một khoảng lặng ở điểm nối vòng.
- **Tiếng một lần:** nên mono, đã cắt sát đầu, không có khoảng lặng trước tiếng.
- **Nền:** stereo, dài 20 đến 40 giây, nối vòng được. **Vòng lặp** (lửa, máy, xe): 4 đến 12 giây, nối vòng được.
- **Giấy phép:** cho tôi biết nguồn và giấy phép của từng gói. Tôi sẽ ghi vào `web/THIRD_PARTY.md`.
- **Nếu muốn đặt tên sẵn:** `<nhóm>/<tên slot>__NN.<đuôi>`, NN bắt đầu từ 01. Ví dụ `step/step.grass__01.ogg`. File đặt tên như vậy vào thẳng slot, không cần xét.

Giới hạn của tôi ở máy làm việc này: không có công cụ cắt, đổi định dạng hay đo độ to của file âm thanh. Tôi xếp file, đặt mức âm lượng theo slot và theo file, nhưng không sửa được nội dung file. File nào cần cắt hoặc đổi định dạng thì tôi sẽ liệt kê lại cho bạn.

## 7. Việc tôi làm khi nhận folder

1. `node scripts/sfx.mjs sort <folder>`: đọc tên file và tên folder con, đề xuất slot cho từng file. Lệnh này không chép gì, chỉ ghi ra một bảng đề xuất.
2. Tôi xem lại bảng. Tên file hiếm khi đủ rõ, nên phần lớn dòng cần người quyết định. Chạy thử trên thư viện 116 file có sẵn ở phía Godot: 17 dòng chắc chắn, 96 dòng cần xem lại, 3 dòng không tìm được slot.
3. `node scripts/sfx.mjs apply <bảng>`: chép file vào `web/public/sfx/<nhóm>/` với tên đúng. Không ghi đè file đã có.
4. `node scripts/sfx.mjs index`: lập danh sách file cho game, báo slot nào còn trống, file nào quá nặng hoặc sai kiểu.
5. Nghe thử trên bảng slot, chỉnh âm lượng.
6. Báo lại cho bạn: slot nào đã đầy, slot nào còn trống theo P1, P2, P3.

## 8. Bảng nghe thử

Mở địa chỉ game và thêm `#sfx` vào cuối. Bảng liệt kê cả 360 slot, cho biết mỗi slot đang có file, mượn file, dùng tiếng tổng hợp hay im lặng, và có nút **Nghe** cho từng slot. Lọc được theo tình trạng, theo mức ưu tiên, theo tên.

## 9. Các file liên quan

| File | Nội dung |
|---|---|
| `web/src/game/sfx/slots.ts` | Danh mục 360 slot. Muốn thêm, bớt, đổi thông số thì sửa ở đây. |
| `web/src/game/sfx/route.ts` | Sự kiện nào phát slot nào. |
| `web/src/game/sfx/director.ts` | Phần quan sát mỗi giây: nền, vòng lặp, cảnh báo, tiếng điểm. |
| `web/src/game/sfx/bank.ts` | Tải file, chọn bản, thứ tự dự phòng. |
| `web/src/game/audio.ts` | Phát âm thanh; tiếng tổng hợp cũ vẫn nằm ở đây. |
| `web/src/ui/SfxBoard.tsx` | Bảng nghe thử. |
| `web/scripts/sfx.mjs` | Công cụ: `table`, `folders`, `sort`, `apply`, `index`, `status`. |
| `web/public/sfx/` | 24 folder nhóm đang trống và `index.json`. |
| `web/tests/sfx-slots.test.ts` | 20 bài kiểm tra cho danh mục và đường đi của tiếng. |
