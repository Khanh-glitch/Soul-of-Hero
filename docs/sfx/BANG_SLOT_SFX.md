# Bảng slot SFX — Soul of Hero (bản web)

Bảng này do `node scripts/sfx.mjs table` sinh ra từ `web/src/game/sfx/slots.ts`. Sửa slot thì sửa ở file đó rồi chạy lại lệnh.

- Tổng: **360 slot**, đủ bản thì cần **793 file**.
- P1 cần trước: 128 slot, 292 file.
- P2 nên có: 148 slot, 295 file.
- P3 thêm cho đẹp: 84 slot, 206 file.
- Tên file: `<nhóm>/<tên slot>__NN.<đuôi>`, NN bắt đầu từ 01, đuôi ogg / mp3 / wav / m4a. Ví dụ `ui/ui.click__01.ogg`.
- Cột "Hiện nay": **file** = đã có file; **mượn X** = đang dùng file của slot X; **tiếng tổng hợp** = máy tự phát tiếng tạm; **im lặng** = chưa có gì.

## Giao diện (`ui`) — 16 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `ui.click` | P1 | một lần | 2 | 30–80 ms | Bấm nút, chọn mục, mọi thao tác thành công không có tiếng riêng. | Tiếng tách khô, ngắn, không ngân. Nghe hàng trăm lần mà không mệt. | tiếng tổng hợp |
| `ui.back` | P1 | một lần | 1 | 40–100 ms | Đóng bảng, hủy đặt công trình, hủy niệm Core. | Giống ui.click nhưng trầm hơn và đi xuống. | tiếng tổng hợp |
| `ui.tab` | P2 | một lần | 1 | 30–80 ms | Đổi thẻ trong bảng, đổi trang thanh xây. | Tách nhẹ, hơi cao hơn ui.click. | tiếng tổng hợp |
| `ui.panel.open` | P1 | một lần | 2 | 120–250 ms | Mở ba lô, chế tạo, kỹ năng, bảng người, menu. | Tiếng mở túi vải hoặc khóa da; mềm, có chất liệu. | tiếng tổng hợp |
| `ui.panel.close` | P1 | một lần | 2 | 100–200 ms | Đóng các bảng trên. | Ngược của ui.panel.open, ngắn hơn. | tiếng tổng hợp |
| `ui.map.open` | P2 | một lần | 2 | 200–400 ms | Mở bản đồ (M). | Giấy da mở ra, sột soạt. | tiếng tổng hợp |
| `ui.map.close` | P3 | một lần | 1 | 150–300 ms | Đóng bản đồ. | Giấy gấp lại. | tiếng tổng hợp |
| `ui.book.open` | P2 | một lần | 2 | 200–400 ms | Mở Hành trình (J), Ghi chép (N), sổ tay, bảng nghiên cứu. | Mở sổ, lật trang. | tiếng tổng hợp |
| `ui.build.enter` | P2 | một lần | 1 | 150–300 ms | Vào chế độ xây (B). | Rút búa hoặc trải bản vẽ. | tiếng tổng hợp |
| `ui.build.exit` | P3 | một lần | 1 | 100–200 ms | Thoát chế độ xây. | Cất dụng cụ. | tiếng tổng hợp |
| `ui.hotbar` | P1 | một lần | 2 | 60–150 ms | Đổi món đang cầm (phím 1–8, lăn chuột). | Tiếng rút hoặc đổi tay cầm, rất ngắn. | tiếng tổng hợp |
| `ui.deny` | P1 | một lần | 1 | 120–250 ms | Hành động bị từ chối: thiếu nguyên liệu, quá xa, sai công cụ. | Hai nốt trầm đi xuống, không chói. | tiếng tổng hợp |
| `ui.coin` | P1 | một lần | 3 | 150–350 ms | Cất tiền Ragnarok vào két, mở túi tiền, nhận tiền. | Xu kim loại chạm nhau, sáng. | tiếng tổng hợp |
| `ui.buy` | P2 | một lần | 2 | 200–400 ms | Mua ở thương nhân, trả phí vận chuyển. | Xu rơi vào tay người bán, kèm một tiếng chốt. | tiếng tổng hợp |
| `ui.pin` | P3 | một lần | 1 | 60–150 ms | Cắm hoặc gỡ ghim trên bản đồ, theo dõi một mục tiêu. | Ghim cắm vào giấy. | tiếng tổng hợp |
| `ui.title.start` | P2 | một lần | 1 | 0.6–1.5 s | Xác nhận Ván mới hoặc Chơi tiếp ở màn hình chính. | Một tiếng trống trầm hoặc tù và ngắn, báo bắt đầu. | tiếng tổng hợp |

## Cầm, nhặt, xếp đồ (`item`) — 13 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `item.pickup` | P1 | một lần | 3 | 80–200 ms | Nhặt đồ dưới đất (E) hoặc khi khai thác rơi ra. | Tiếng chộp nhanh, hơi sáng; không phải chuông. | tiếng tổng hợp |
| `item.move` | P1 | một lần | 3 | 60–160 ms | Chuyển đồ giữa các ô và các thùng, khi không có tiếng theo chất liệu. | Đặt một vật xuống mặt gỗ. | tiếng tổng hợp |
| `item.metal` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm kim loại (thỏi, linh kiện, vũ khí sắt). | Kim loại chạm nhau, ngắn. | tiếng tổng hợp |
| `item.wood` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm gỗ (gỗ, ván, cán). | Khúc gỗ gõ vào nhau. | tiếng tổng hợp |
| `item.stone` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm đá, quặng, tinh thể. | Đá lạo xạo. | tiếng tổng hợp |
| `item.cloth` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm vải, da, sợi, giáp mềm. | Vải sột soạt. | tiếng tổng hợp |
| `item.food` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm đồ ăn, thảo mộc. | Túi mềm, giấy gói. | tiếng tổng hợp |
| `item.liquid` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm bình nước, can nhiên liệu, lọ. | Chất lỏng óc ách trong bình. | tiếng tổng hợp |
| `item.core` | P3 | một lần | 2 | 60–200 ms | Nhặt hoặc chuyển món thuộc nhóm Core, năng lượng, tinh chất. | Tinh thể ngân nhẹ, có hơi phép. | tiếng tổng hợp |
| `item.drop` | P2 | một lần | 2 | 100–250 ms | Vứt đồ ra đất. | Vật rơi xuống đất mềm. | tiếng tổng hợp |
| `item.equip` | P2 | một lần | 2 | 200–400 ms | Mặc giáp, đội mũ, đeo ba lô. | Kéo dây da, cài khóa. | tiếng tổng hợp |
| `item.sort` | P3 | một lần | 1 | 200–400 ms | Sắp xếp thùng, tách chồng đồ. | Lục và xếp lại nhiều món. | tiếng tổng hợp |
| `item.repair` | P2 | một lần | 2 | 0.4–0.9 s | Sửa dụng cụ, vũ khí, Core tại trạm. | Vài nhát búa nhỏ lên kim loại. | tiếng tổng hợp |

## Tiến trình, phần thưởng, biểu ngữ (`prog`) — 17 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `prog.tick` | P2 | một lần | 1 | 20–60 ms | Một mục tiêu nhỏ nhích tiến độ. | Một tiếng tíc nhỏ, gần như không để ý. | tiếng tổng hợp |
| `prog.stamp` | P1 | một lần | 1 | 0.3–0.6 s | Hoàn thành một mục trong Hành trình. | Con dấu đóng xuống giấy, rồi hai nốt sáng. | tiếng tổng hợp |
| `prog.milestone` | P1 | một lần | 1 | 0.8–1.5 s | Cột mốc hoặc phần thưởng; nhận thưởng sổ tay. | Hợp âm chuông ấm, ngân khoảng một giây. | tiếng tổng hợp |
| `prog.capability` | P1 | một lần | 1 | 0.5–1 s | Mở được một khả năng mới (công trình, trạm đầu tiên). | Ba nốt đi lên dứt khoát, có nền trầm. | tiếng tổng hợp |
| `prog.relic` | P1 | một lần | 1 | 1.2–2 s | Lần đầu cầm một Creator Core. | Ngân dài, huyền bí, có ánh lấp lánh ở cuối. | tiếng tổng hợp |
| `prog.epic` | P1 | một lần | 1 | 2–3 s | Cảnh lớn: hạ Elder, Ragnarok bắt đầu, các Elder thức giấc. | Trống trầm rồi kèn mở dần; tiếng lớn nhất của game. | tiếng tổng hợp |
| `prog.rare` | P2 | một lần | 1 | 0.8–1.2 s | Mở rương ra Core hoặc đồ hiếm. | Ba nốt sáng và một vệt lấp lánh. | tiếng tổng hợp |
| `prog.recipe` | P2 | một lần | 1 | 0.5–1 s | Học một bản thiết kế, nghiên cứu xong một nhánh. | Lật trang rồi hai nốt mở. | tiếng tổng hợp |
| `prog.research` | P2 | một lần | 2 | 0.4–0.8 s | Bắt đầu nghiên cứu, mổ mẫu vật. | Bút viết trên giấy, dụng cụ gõ nhẹ. | tiếng tổng hợp |
| `prog.achievement` | P2 | một lần | 1 | 0.8–1.5 s | Đạt một thành tích. | Chuông ngắn có độ vang. | tiếng tổng hợp |
| `prog.discover` | P1 | một lần | 1 | 1–1.6 s | Khám phá một địa điểm mới (hiện biểu ngữ "Discovered"). | Bốn nốt đi lên, cảm giác mở ra. | tiếng tổng hợp |
| `prog.region` | P2 | một lần | 1 | 0.8–1.5 s | Bước sang một vùng khác (hiện tên vùng). | Một tiếng đệm nhẹ, gần như hơi thở; không được lấn át. | im lặng |
| `prog.banner` | P1 | một lần | 1 | 1–1.6 s | Biểu ngữ lớn không có tiếng riêng (tên Elder lần đầu chạm trán). | Hai nốt trầm như cồng. | tiếng tổng hợp |
| `prog.day14` | P1 | một lần | 1 | 2–3 s | Ngày 14: sáu Elder thức giấc. | Tù và xa, trầm, kéo dài. | tiếng tổng hợp |
| `prog.ragnarok` | P1 | một lần | 1 | 2–4 s | 72 giờ cuối bắt đầu. | Mặt đất gầm, một hợp âm tối. | tiếng tổng hợp |
| `prog.runend` | P2 | một lần | 1 | 2–4 s | Ván kết thúc vì Ragnarok. | Một tiếng sập xuống rồi im. | tiếng tổng hợp |
| `prog.season` | P3 | một lần | 1 | 1–2 s | Sang mùa mới. | Chuông gió nhẹ. | im lặng |

## Bước chân (`step`) — 12 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `step.grass` | P1 | một lần | 5 | 80–180 ms | Nhân vật đi trên cỏ, đồng cỏ, đất thường. | Cỏ khô và đất mềm. | tiếng tổng hợp |
| `step.forest` | P2 | một lần | 5 | 80–180 ms | Nhân vật đi trên nền rừng. | Lá khô, cành nhỏ gãy. | tiếng tổng hợp |
| `step.sand` | P1 | một lần | 5 | 80–180 ms | Nhân vật đi trên cát. | Cát lún, sột soạt. | tiếng tổng hợp |
| `step.snow` | P1 | một lần | 5 | 80–180 ms | Nhân vật đi trên tuyết. | Tuyết nén kêu rộp. | tiếng tổng hợp |
| `step.ice` | P3 | một lần | 5 | 80–180 ms | Nhân vật đi trên băng. | Giày gõ lên băng cứng. | tiếng tổng hợp |
| `step.mud` | P2 | một lần | 5 | 80–180 ms | Nhân vật đi trên đầm lầy. | Bùn nhão, nhóp nhép. | tiếng tổng hợp |
| `step.water` | P1 | một lần | 5 | 80–180 ms | Nhân vật đi trên nước nông, sông. | Lội nước tới mắt cá. | tiếng tổng hợp |
| `step.road` | P2 | một lần | 5 | 80–180 ms | Nhân vật đi trên đường mòn. | Sỏi và đất nện. | tiếng tổng hợp |
| `step.wood` | P1 | một lần | 5 | 80–180 ms | Nhân vật đi trên cầu, sàn gỗ tự xây. | Ván gỗ rỗng bên dưới. | tiếng tổng hợp |
| `step.stone` | P1 | một lần | 5 | 80–180 ms | Nhân vật đi trên sàn nhà phế tích, sàn đá, đồi đá. | Đế giày trên đá hoặc bê tông. | tiếng tổng hợp |
| `step.ash` | P2 | một lần | 5 | 80–180 ms | Nhân vật đi trên tro, đất cháy, đất độc. | Tro mịn, khô, hơi lạo xạo. | tiếng tổng hợp |
| `step.metal` | P3 | một lần | 5 | 80–180 ms | Nhân vật đi trên thang thép. | Đế giày trên lưới thép. | tiếng tổng hợp |

## Cơ thể nhân vật (`player`) — 11 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `player.roll` | P1 | một lần | 3 | 200–350 ms | Lăn né (Space). | Thân người lăn trên đất, vải quệt. | tiếng tổng hợp |
| `player.dodge` | P2 | một lần | 2 | 100–200 ms | Né trúng lúc: đòn đi xuyên qua khi đang lăn. | Một vệt gió sắc, cho biết đã né kịp. | tiếng tổng hợp |
| `player.hurt` | P1 | một lần | 4 | 150–300 ms | Nhân vật trúng đòn. | Cú đập đục vào người, có chút trầm; phải nghe rõ giữa lúc hỗn chiến. | tiếng tổng hợp |
| `player.grunt.m` | P3 | một lần | 4 | 150–400 ms | Nhân vật nam trúng đòn (một nửa số lần). | Tiếng hự ngắn của nam. | im lặng |
| `player.grunt.f` | P3 | một lần | 4 | 150–400 ms | Nhân vật nữ trúng đòn (một nửa số lần). | Tiếng hự ngắn của nữ. | im lặng |
| `player.fall` | P1 | một lần | 1 | 0.5–1 s | Nhân vật gục xuống. | Thân người đổ xuống đất. | im lặng |
| `player.death` | P1 | một lần | 1 | 1.5–2.5 s | Màn tử trận hiện ra. | Một nốt trầm rơi xuống rồi tắt dần. | tiếng tổng hợp |
| `player.respawn` | P2 | một lần | 1 | 0.8–1.5 s | Hồi sinh. | Hít một hơi sâu, nền sáng dần. | im lặng |
| `player.eat` | P1 | một lần | 3 | 300–600 ms | Ăn một món. | Cắn và nhai, hai ba nhịp. | tiếng tổng hợp |
| `player.drink` | P1 | một lần | 3 | 300–700 ms | Uống ở sông, từ bình, từ thùng nước. | Hai ngụm nước. | tiếng tổng hợp |
| `player.heal` | P1 | một lần | 2 | 400–800 ms | Dùng băng, thuốc, bộ sơ cứu. | Xé và quấn băng vải. | tiếng tổng hợp |

## Cảnh báo sinh tồn (`warn`) — 7 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `warn.hp` | P1 | một lần | 1 | 0.4–0.8 s | Máu tụt xuống dưới 28. | Một tiếng thở gấp. | im lặng |
| `warn.hunger` | P2 | một lần | 2 | 0.6–1.2 s | Đói xuống dưới 18; nhắc lại mỗi phút khi còn đói. | Bụng sôi. | im lặng |
| `warn.thirst` | P2 | một lần | 2 | 0.5–1 s | Khát xuống dưới 18; nhắc lại mỗi phút. | Ho khan, nuốt khô. | im lặng |
| `warn.cold` | P2 | một lần | 2 | 0.6–1.2 s | Thân nhiệt xuống dưới 20; nhắc lại mỗi 45 giây. | Run cầm cập, hà hơi. | im lặng |
| `warn.stamina` | P2 | một lần | 2 | 0.5–1 s | Thể lực cạn (dưới 8). | Thở dốc. | im lặng |
| `warn.rad` | P2 | một lần | 1 | 0.5–1 s | Phóng xạ lên tới 25. | Máy đo kêu lách tách dồn dập. | im lặng |
| `warn.lowfuel` | P2 | một lần | 1 | 0.3–0.6 s | Bình xăng xe máy còn dưới 15 %. | Hai tiếng bíp đi xuống, hoặc máy khục khặc. | tiếng tổng hợp |

## Vung vũ khí, cung tên (`swing`) — 8 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `swing.start` | P3 | một lần | 2 | 80–150 ms | Bắt đầu vung (trước khi lưỡi tới). | Vải áo và hơi lấy đà, rất khẽ. | tiếng tổng hợp |
| `swing.heavy` | P1 | một lần | 4 | 150–300 ms | Vung rìu, cuốc, gậy. | Vệt gió dày, trầm. | im lặng |
| `swing.blade` | P1 | một lần | 4 | 120–250 ms | Vung dao, rựa, kiếm. | Vệt gió mảnh, sắc, có ánh kim. | im lặng |
| `swing.spear` | P2 | một lần | 3 | 120–250 ms | Đâm giáo, đinh ba. | Một cú xỉa nhanh, gọn. | im lặng |
| `swing.fist` | P2 | một lần | 3 | 80–180 ms | Đấm tay không. | Vệt gió ngắn, nhẹ. | im lặng |
| `swing.torch` | P3 | một lần | 3 | 150–300 ms | Vung đuốc, đèn. | Lửa phần phật theo đà vung. | im lặng |
| `swing.bow.draw` | P2 | một lần | 2 | 250–450 ms | Kéo dây cung. | Dây và gỗ căng ra. | im lặng |
| `swing.bow.shot` | P1 | một lần | 3 | 120–250 ms | Buông tên. | Dây bật, tên xé gió. | tiếng tổng hợp |

## Va chạm khi đánh (`hit`) — 6 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `hit.flesh` | P1 | một lần | 5 | 100–220 ms | Đòn trúng sinh vật. | Cú chém vào thịt: đục, ướt, dứt khoát. Tiếng quan trọng nhất của chiến đấu. | tiếng tổng hợp |
| `hit.big` | P1 | một lần | 3 | 200–400 ms | Đòn trúng Elder hoặc trùm phụ. | Như hit.flesh nhưng nặng hơn, có tiếng trầm của khối lớn. | tiếng tổng hợp |
| `hit.kill` | P2 | một lần | 2 | 200–400 ms | Đòn kết liễu một sinh vật. | Một cú chốt gãy gọn, nặng hơn đòn thường. | tiếng tổng hợp |
| `hit.arrow` | P2 | một lần | 3 | 80–180 ms | Tên hoặc đạn bị tường, cây chặn lại. | Mũi tên cắm vào gỗ. | im lặng |
| `hit.rock` | P3 | một lần | 2 | 100–250 ms | Đá ném vỡ khi chạm vật cản. | Đá vỡ vụn. | tiếng tổng hợp |
| `hit.stun` | P2 | một lần | 2 | 250–500 ms | Sinh vật lao hụt, đâm vào vật cản và choáng. | Va rầm một cái rồi tiếng choáng váng. | im lặng |

## Khai thác (`gather`) — 10 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `gather.wood` | P1 | một lần | 5 | 100–220 ms | Mỗi nhát chặt vào cây. | Rìu ăn vào gỗ tươi: cộc, chắc. | tiếng tổng hợp |
| `gather.stone` | P1 | một lần | 5 | 100–220 ms | Mỗi nhát đập vào đá. | Kim loại gõ đá, có mảnh văng. | tiếng tổng hợp |
| `gather.ore` | P2 | một lần | 4 | 100–250 ms | Mỗi nhát vào quặng sắt, tinh thể, lưu huỳnh. | Như đá nhưng ngân hơn, có ánh kim. | tiếng tổng hợp |
| `gather.scrap` | P1 | một lần | 4 | 120–280 ms | Cạy phế liệu, xác xe, kiện hàng ven đường. | Tôn và sắt vụn bị bẩy, loảng xoảng. | tiếng tổng hợp |
| `gather.plant` | P1 | một lần | 4 | 80–200 ms | Cắt bụi, cỏ, sậy, thảo mộc, nấm. | Lá và cành nhỏ bị cắt, xào xạc. | tiếng tổng hợp |
| `gather.deplete` | P2 | một lần | 2 | 250–500 ms | Nhát cuối làm một nguồn cạn hẳn (đá vỡ, bụi trụi). | Vỡ rời ra thành mảnh. | im lặng |
| `gather.fell` | P1 | một lần | 3 | 0.8–1.5 s | Cây đổ. | Thân gỗ rắc dài rồi đổ ầm xuống, cành lá quật. | tiếng tổng hợp |
| `gather.clank` | P1 | một lần | 3 | 80–180 ms | Sai công cụ, hoặc nguồn đã hết. | Dụng cụ nảy ra, tiếng đanh và hụt. | tiếng tổng hợp |
| `gather.toolbreak` | P1 | một lần | 2 | 300–600 ms | Dụng cụ hoặc vũ khí hỏng hẳn. | Cán gãy, lưỡi văng ra. | tiếng tổng hợp |
| `gather.carcass` | P2 | một lần | 3 | 300–700 ms | Xẻ thịt, lột da con mồi; mổ vật nuôi. | Dao rạch da ướt. | im lặng |

## Sinh vật (`cr`) — 71 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `cr.tell` | P1 | một lần | 2 | 100–250 ms | Một sinh vật sắp ra đòn (dấu báo trên đầu), khi loài đó chưa có tiếng riêng. | Một tiếng báo ngắn, đanh, nghe là biết phải né. | tiếng tổng hợp |
| `cr.hurt` | P2 | một lần | 3 | 150–300 ms | Sinh vật trúng đòn (một nửa số lần), khi loài đó chưa có tiếng riêng. | Tiếng kêu đau ngắn của thú. | im lặng |
| `cr.die` | P1 | một lần | 3 | 300–700 ms | Sinh vật chết, khi loài đó chưa có tiếng riêng. | Tiếng kêu tắt dần rồi thân đổ xuống. | tiếng tổng hợp |
| `cr.idle` | P3 | một lần | 3 | 300–800 ms | Sinh vật ở gần đang đi lại (5–12 giây một lần), khi loài đó chưa có tiếng riêng. | Tiếng thở, khịt, cựa mình; nhỏ và xa. | im lặng |
| `cr.boar.tell` | P2 | một lần | 2 | 200–500 ms | Bristleback Boar sắp ra đòn. | Tiếng dọa của lợn rừng: khịt mũi, rống. | tiếng tổng hợp |
| `cr.boar.hurt` | P3 | một lần | 3 | 150–350 ms | Bristleback Boar trúng đòn (một nửa số lần). | Tiếng đau của lợn rừng: khịt mũi, rống. | im lặng |
| `cr.boar.die` | P2 | một lần | 2 | 400–900 ms | Bristleback Boar chết. | Tiếng chết của lợn rừng: khịt mũi, rống. | tiếng tổng hợp |
| `cr.boar.idle` | P3 | một lần | 3 | 300–900 ms | Bristleback Boar ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của lợn rừng: khịt mũi, rống. | im lặng |
| `cr.wolf.tell` | P2 | một lần | 2 | 200–500 ms | Greyfang Wolf sắp ra đòn. | Tiếng dọa của sói: gầm gừ, sủa ngắn. | tiếng tổng hợp |
| `cr.wolf.hurt` | P3 | một lần | 3 | 150–350 ms | Greyfang Wolf trúng đòn (một nửa số lần). | Tiếng đau của sói: gầm gừ, sủa ngắn. | im lặng |
| `cr.wolf.die` | P2 | một lần | 2 | 400–900 ms | Greyfang Wolf chết. | Tiếng chết của sói: gầm gừ, sủa ngắn. | tiếng tổng hợp |
| `cr.wolf.idle` | P3 | một lần | 3 | 300–900 ms | Greyfang Wolf ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của sói: gầm gừ, sủa ngắn. | im lặng |
| `cr.toad.tell` | P2 | một lần | 2 | 200–500 ms | Mire Toad sắp ra đòn. | Tiếng dọa của cóc lớn: ộp trầm. | tiếng tổng hợp |
| `cr.toad.hurt` | P3 | một lần | 3 | 150–350 ms | Mire Toad trúng đòn (một nửa số lần). | Tiếng đau của cóc lớn: ộp trầm. | im lặng |
| `cr.toad.die` | P2 | một lần | 2 | 400–900 ms | Mire Toad chết. | Tiếng chết của cóc lớn: ộp trầm. | tiếng tổng hợp |
| `cr.toad.idle` | P3 | một lần | 3 | 300–900 ms | Mire Toad ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của cóc lớn: ộp trầm. | im lặng |
| `cr.crawler.tell` | P2 | một lần | 2 | 200–500 ms | Scrap Crawler sắp ra đòn. | Tiếng dọa của máy bò: rè điện, động cơ nhỏ. | tiếng tổng hợp |
| `cr.crawler.hurt` | P3 | một lần | 3 | 150–350 ms | Scrap Crawler trúng đòn (một nửa số lần). | Tiếng đau của máy bò: rè điện, động cơ nhỏ. | im lặng |
| `cr.crawler.die` | P2 | một lần | 2 | 400–900 ms | Scrap Crawler chết. | Tiếng chết của máy bò: rè điện, động cơ nhỏ. | tiếng tổng hợp |
| `cr.crawler.idle` | P3 | một lần | 3 | 300–900 ms | Scrap Crawler ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của máy bò: rè điện, động cơ nhỏ. | im lặng |
| `cr.beetle.tell` | P2 | một lần | 2 | 200–500 ms | Cinder Beetle sắp ra đòn. | Tiếng dọa của bọ lớn: rít, cánh rung. | tiếng tổng hợp |
| `cr.beetle.hurt` | P3 | một lần | 3 | 150–350 ms | Cinder Beetle trúng đòn (một nửa số lần). | Tiếng đau của bọ lớn: rít, cánh rung. | im lặng |
| `cr.beetle.die` | P2 | một lần | 2 | 400–900 ms | Cinder Beetle chết. | Tiếng chết của bọ lớn: rít, cánh rung. | tiếng tổng hợp |
| `cr.beetle.idle` | P3 | một lần | 3 | 300–900 ms | Cinder Beetle ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của bọ lớn: rít, cánh rung. | im lặng |
| `cr.crab.tell` | P2 | một lần | 2 | 200–500 ms | Shore Crab sắp ra đòn. | Tiếng dọa của cua: càng gõ lách cách. | tiếng tổng hợp |
| `cr.crab.hurt` | P3 | một lần | 3 | 150–350 ms | Shore Crab trúng đòn (một nửa số lần). | Tiếng đau của cua: càng gõ lách cách. | im lặng |
| `cr.crab.die` | P2 | một lần | 2 | 400–900 ms | Shore Crab chết. | Tiếng chết của cua: càng gõ lách cách. | tiếng tổng hợp |
| `cr.crab.idle` | P3 | một lần | 3 | 300–900 ms | Shore Crab ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của cua: càng gõ lách cách. | im lặng |
| `cr.vampire.tell` | P3 | một lần | 2 | 200–500 ms | Dusk Stray (3 bậc) sắp ra đòn. | Tiếng dọa của ma đêm: rít, thở khàn. | tiếng tổng hợp |
| `cr.vampire.hurt` | P3 | một lần | 3 | 150–350 ms | Dusk Stray (3 bậc) trúng đòn (một nửa số lần). | Tiếng đau của ma đêm: rít, thở khàn. | im lặng |
| `cr.vampire.die` | P3 | một lần | 2 | 400–900 ms | Dusk Stray (3 bậc) chết. | Tiếng chết của ma đêm: rít, thở khàn. | tiếng tổng hợp |
| `cr.vampire.idle` | P3 | một lần | 3 | 300–900 ms | Dusk Stray (3 bậc) ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của ma đêm: rít, thở khàn. | im lặng |
| `cr.orc.tell` | P3 | một lần | 2 | 200–500 ms | Orc (3 bậc) sắp ra đòn. | Tiếng dọa của orc: gầm, hộc. | tiếng tổng hợp |
| `cr.orc.hurt` | P3 | một lần | 3 | 150–350 ms | Orc (3 bậc) trúng đòn (một nửa số lần). | Tiếng đau của orc: gầm, hộc. | im lặng |
| `cr.orc.die` | P3 | một lần | 2 | 400–900 ms | Orc (3 bậc) chết. | Tiếng chết của orc: gầm, hộc. | tiếng tổng hợp |
| `cr.orc.idle` | P3 | một lần | 3 | 300–900 ms | Orc (3 bậc) ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của orc: gầm, hộc. | im lặng |
| `cr.slime.tell` | P3 | một lần | 2 | 200–500 ms | Slime (3 bậc) sắp ra đòn. | Tiếng dọa của slime: nhóp nhép, bong bóng. | tiếng tổng hợp |
| `cr.slime.hurt` | P3 | một lần | 3 | 150–350 ms | Slime (3 bậc) trúng đòn (một nửa số lần). | Tiếng đau của slime: nhóp nhép, bong bóng. | im lặng |
| `cr.slime.die` | P3 | một lần | 2 | 400–900 ms | Slime (3 bậc) chết. | Tiếng chết của slime: nhóp nhép, bong bóng. | tiếng tổng hợp |
| `cr.slime.idle` | P3 | một lần | 3 | 300–900 ms | Slime (3 bậc) ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của slime: nhóp nhép, bong bóng. | im lặng |
| `cr.fox.tell` | P3 | một lần | 2 | 200–500 ms | Fox sắp ra đòn. | Tiếng dọa của cáo: ăng ẳng. | tiếng tổng hợp |
| `cr.fox.hurt` | P3 | một lần | 3 | 150–350 ms | Fox trúng đòn (một nửa số lần). | Tiếng đau của cáo: ăng ẳng. | im lặng |
| `cr.fox.die` | P3 | một lần | 2 | 400–900 ms | Fox chết. | Tiếng chết của cáo: ăng ẳng. | tiếng tổng hợp |
| `cr.fox.idle` | P3 | một lần | 3 | 300–900 ms | Fox ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của cáo: ăng ẳng. | im lặng |
| `cr.deer.hurt` | P3 | một lần | 3 | 150–350 ms | Deer trúng đòn (một nửa số lần). | Tiếng đau của hươu: kêu khẽ, phì hơi. | im lặng |
| `cr.deer.die` | P3 | một lần | 2 | 400–900 ms | Deer chết. | Tiếng chết của hươu: kêu khẽ, phì hơi. | tiếng tổng hợp |
| `cr.deer.idle` | P3 | một lần | 3 | 300–900 ms | Deer ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của hươu: kêu khẽ, phì hơi. | im lặng |
| `cr.hare.hurt` | P3 | một lần | 3 | 150–350 ms | Hare trúng đòn (một nửa số lần). | Tiếng đau của thỏ: chít ngắn. | im lặng |
| `cr.hare.die` | P3 | một lần | 2 | 400–900 ms | Hare chết. | Tiếng chết của thỏ: chít ngắn. | tiếng tổng hợp |
| `cr.hare.idle` | P3 | một lần | 3 | 300–900 ms | Hare ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của thỏ: chít ngắn. | im lặng |
| `cr.grouse.hurt` | P3 | một lần | 3 | 150–350 ms | Grouse trúng đòn (một nửa số lần). | Tiếng đau của gà rừng: cục cục, vỗ cánh. | im lặng |
| `cr.grouse.die` | P3 | một lần | 2 | 400–900 ms | Grouse chết. | Tiếng chết của gà rừng: cục cục, vỗ cánh. | tiếng tổng hợp |
| `cr.grouse.idle` | P3 | một lần | 3 | 300–900 ms | Grouse ở gần, đang đi lại hoặc đứng yên. | Tiếng kêu vu vơ của gà rừng: cục cục, vỗ cánh. | im lặng |
| `cr.greyback.tell` | P2 | một lần | 2 | 200–500 ms | Greyback Shaleheart (trùm phụ) sắp ra đòn. | Tiếng dọa của khối đá sống: nghiến đá, gầm trầm. | tiếng tổng hợp |
| `cr.greyback.hurt` | P3 | một lần | 3 | 150–350 ms | Greyback Shaleheart (trùm phụ) trúng đòn (một nửa số lần). | Tiếng đau của khối đá sống: nghiến đá, gầm trầm. | im lặng |
| `cr.greyback.die` | P2 | một lần | 2 | 400–900 ms | Greyback Shaleheart (trùm phụ) chết. | Tiếng chết của khối đá sống: nghiến đá, gầm trầm. | tiếng tổng hợp |
| `cr.ronin.tell` | P2 | một lần | 2 | 200–500 ms | Oathless Ronin (trùm phụ) sắp ra đòn. | Tiếng dọa của kiếm sĩ: hét ngắn, tuốt kiếm. | tiếng tổng hợp |
| `cr.ronin.hurt` | P3 | một lần | 3 | 150–350 ms | Oathless Ronin (trùm phụ) trúng đòn (một nửa số lần). | Tiếng đau của kiếm sĩ: hét ngắn, tuốt kiếm. | im lặng |
| `cr.ronin.die` | P2 | một lần | 2 | 400–900 ms | Oathless Ronin (trùm phụ) chết. | Tiếng chết của kiếm sĩ: hét ngắn, tuốt kiếm. | tiếng tổng hợp |
| `cr.tidemarshal.tell` | P2 | một lần | 2 | 200–500 ms | Saltwick Tidemarshal (trùm phụ) sắp ra đòn. | Tiếng dọa của tướng thủy triều: gầm ướt, nước cuộn. | tiếng tổng hợp |
| `cr.tidemarshal.hurt` | P3 | một lần | 3 | 150–350 ms | Saltwick Tidemarshal (trùm phụ) trúng đòn (một nửa số lần). | Tiếng đau của tướng thủy triều: gầm ướt, nước cuộn. | im lặng |
| `cr.tidemarshal.die` | P2 | một lần | 2 | 400–900 ms | Saltwick Tidemarshal (trùm phụ) chết. | Tiếng chết của tướng thủy triều: gầm ướt, nước cuộn. | tiếng tổng hợp |
| `cr.custodian.tell` | P2 | một lần | 2 | 200–500 ms | Pale Custodian (trùm phụ) sắp ra đòn. | Tiếng dọa của người giữ đèn: thì thầm, chuông nhỏ. | tiếng tổng hợp |
| `cr.custodian.hurt` | P3 | một lần | 3 | 150–350 ms | Pale Custodian (trùm phụ) trúng đòn (một nửa số lần). | Tiếng đau của người giữ đèn: thì thầm, chuông nhỏ. | im lặng |
| `cr.custodian.die` | P2 | một lần | 2 | 400–900 ms | Pale Custodian (trùm phụ) chết. | Tiếng chết của người giữ đèn: thì thầm, chuông nhỏ. | tiếng tổng hợp |
| `cr.sniff` | P2 | một lần | 2 | 250–500 ms | Một con thú bắt được dấu chân và bắt đầu lần theo. | Hít ngửi hai ba nhịp. | tiếng tổng hợp |
| `cr.lost` | P3 | một lần | 1 | 200–400 ms | Sinh vật mất dấu và bỏ cuộc. | Một tiếng hừ thắc mắc, đi xuống. | im lặng |
| `cr.shoot` | P1 | một lần | 3 | 100–250 ms | Sinh vật bắn đạn (máy bò, slime phun, trùm phụ bắn mảnh). | Tiếng phụt hoặc tia điện ngắn. | tiếng tổng hợp |
| `cr.tongue` | P2 | một lần | 2 | 150–300 ms | Cóc phóng lưỡi. | Roi ướt quất ra. | tiếng tổng hợp |
| `cr.snip` | P2 | một lần | 2 | 80–180 ms | Cua kẹp. | Càng bập lại, đanh. | im lặng |
| `cr.emerge` | P2 | một lần | 2 | 300–600 ms | Bọ chui lên khỏi mặt đất. | Đất bật tung. | im lặng |

## Elder và trùm phụ (`elder`) — 21 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `elder.awaken` | P1 | một lần | 1 | 2–3.5 s | Một Elder thức giấc (biểu ngữ "AWAKENS"). | Tiếng gầm lớn có vang, mặt đất rung theo. | tiếng tổng hợp |
| `elder.engage` | P1 | một lần | 2 | 1.2–2 s | Một Elder đang ngủ phát hiện bạn và lao vào đánh (biểu ngữ tên Elder). | Tiếng gầm ngắn hơn lúc thức giấc, sát và dữ. | tiếng tổng hợp |
| `elder.tell` | P1 | một lần | 2 | 0.5–0.9 s | Elder chuẩn bị ra một đòn (khoảng 0,8 giây trước khi đòn nổ). | Tiếng dồn lực đi lên, nghe là biết phải chạy. | tiếng tổng hợp |
| `elder.frost.tell` | P3 | một lần | 2 | 0.5–1 s | Elder frost chuẩn bị ra đòn. | Giọng riêng của Elder băng: gió rít, băng nứt. | tiếng tổng hợp |
| `elder.magma.tell` | P3 | một lần | 2 | 0.5–1 s | Elder magma chuẩn bị ra đòn. | Giọng riêng của Elder dung nham: gầm trầm, lửa phì. | tiếng tổng hợp |
| `elder.bog.tell` | P3 | một lần | 2 | 0.5–1 s | Elder bog chuẩn bị ra đòn. | Giọng riêng của Elder đầm lầy: ộp rất trầm, bùn sôi. | tiếng tổng hợp |
| `elder.grove.tell` | P3 | một lần | 2 | 0.5–1 s | Elder grove chuẩn bị ra đòn. | Giọng riêng của Elder rừng già: gỗ nghiến, lá quật. | tiếng tổng hợp |
| `elder.tide.tell` | P3 | một lần | 2 | 0.5–1 s | Elder tide chuẩn bị ra đòn. | Giọng riêng của Elder thủy triều: sóng cuộn, gầm ướt. | tiếng tổng hợp |
| `elder.rust.tell` | P3 | một lần | 2 | 0.5–1 s | Elder rust chuẩn bị ra đòn. | Giọng riêng của Elder gỉ sét: kim loại nghiến, điện rè. | tiếng tổng hợp |
| `elder.surtur.tell` | P3 | một lần | 2 | 0.5–1 s | Elder surtur chuẩn bị ra đòn. | Giọng riêng của Elder Surtur: lửa và sắt. | tiếng tổng hợp |
| `elder.typhon.tell` | P3 | một lần | 2 | 0.5–1 s | Elder typhon chuẩn bị ra đòn. | Giọng riêng của Elder Typhon: bão và rắn rít. | tiếng tổng hợp |
| `elder.aion.tell` | P3 | một lần | 2 | 0.5–1 s | Elder aion chuẩn bị ra đòn. | Giọng riêng của Elder Aion: chuông và thời gian méo. | tiếng tổng hợp |
| `elder.atlas.tell` | P3 | một lần | 2 | 0.5–1 s | Elder atlas chuẩn bị ra đòn. | Giọng riêng của Elder Atlas: đá khổng lồ nghiến. | tiếng tổng hợp |
| `elder.argus.tell` | P3 | một lần | 2 | 0.5–1 s | Elder argus chuẩn bị ra đòn. | Giọng riêng của Elder Argus: nhiều giọng thì thầm. | tiếng tổng hợp |
| `elder.anubis.tell` | P3 | một lần | 2 | 0.5–1 s | Elder anubis chuẩn bị ra đòn. | Giọng riêng của Elder Anubis: chó rừng tru, cát chảy. | tiếng tổng hợp |
| `elder.emerge` | P1 | một lần | 2 | 0.6–1.2 s | Elder trồi lên sau khi lặn. | Mặt đất hoặc mặt nước vỡ tung, khối lớn trồi lên. | im lặng |
| `elder.submerge` | P2 | một lần | 2 | 0.5–1 s | Elder lặn xuống. | Khối lớn chìm xuống, nước hoặc bùn khép lại. | im lặng |
| `elder.brood` | P2 | một lần | 2 | 0.5–1 s | Elder đầm lầy sinh ra ba con cóc. | Trứng nhớt vỡ, tiếng ộp con. | im lặng |
| `elder.drain` | P2 | một lần | 2 | 0.6–1.2 s | Elder hút sức sống từ cây để hồi máu. | Tiếng hút ngược, nhựa cây rút đi. | im lặng |
| `elder.defeat` | P1 | một lần | 1 | 2–3 s | Hạ được một Elder hoặc trùm phụ (lớp dưới của cảnh lớn). | Tiếng gầm cuối tắt dần, khối lớn sụp xuống. | im lặng |
| `elder.phase` | P1 | một lần | 1 | 0.8–1.5 s | Trùm phụ còn 55 % máu và đổi thế đánh. | Tiếng nứt vỡ rồi gầm lên, báo trận đánh khó hơn. | im lặng |

## Đòn diện rộng của trùm (`haz`) — 8 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `haz.hit` | P1 | một lần | 3 | 300–600 ms | Một đòn diện rộng nổ, khi loại đó chưa có tiếng riêng. | Một tiếng nổ đục vừa phải. | tiếng tổng hợp |
| `haz.fire` | P1 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại lửa, dung nham, thiên thạch nhỏ nổ. | Lửa bùng lên từ mặt đất. | tiếng tổng hợp |
| `haz.quake` | P1 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại động đất, nện, phun trào nổ. | Mặt đất nứt, đá bật lên. | tiếng tổng hợp |
| `haz.frost` | P2 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại băng: vòng băng, gai băng, mảnh băng nổ. | Băng kết lại rồi vỡ, lanh canh. | tiếng tổng hợp |
| `haz.water` | P2 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại sóng, thủy triều, vũng độc nổ. | Nước đập xuống, bọt sôi. | tiếng tổng hợp |
| `haz.root` | P2 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại rễ cây, hạt nổ nổ. | Rễ đâm lên khỏi đất, gỗ nứt. | tiếng tổng hợp |
| `haz.beam` | P2 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại tia năng lượng, vòng điện nổ. | Tia điện rít ngang. | tiếng tổng hợp |
| `haz.blade` | P3 | một lần | 3 | 300–700 ms | Đòn diện rộng thuộc loại chém gió, lao tới nổ. | Lưỡi gió xé ngang. | tiếng tổng hợp |

## Creator Core (phép) (`core`) — 37 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `core.windup.fire` | P1 | một lần | 2 | 0.4–0.6 s | Bắt đầu niệm một Core hệ lửa. | Năng lượng dồn lại, đi lên: lửa phụt, gầm. | tiếng tổng hợp |
| `core.cast.fire` | P1 | một lần | 3 | 0.3–0.7 s | Phép hệ lửa được thả ra, khi Core đó chưa có tiếng riêng. | Thả lực: lửa phụt, gầm. | tiếng tổng hợp |
| `core.windup.frost` | P1 | một lần | 2 | 0.4–0.6 s | Bắt đầu niệm một Core hệ băng. | Năng lượng dồn lại, đi lên: băng kết, lanh canh. | tiếng tổng hợp |
| `core.cast.frost` | P1 | một lần | 3 | 0.3–0.7 s | Phép hệ băng được thả ra, khi Core đó chưa có tiếng riêng. | Thả lực: băng kết, lanh canh. | tiếng tổng hợp |
| `core.windup.storm` | P1 | một lần | 2 | 0.4–0.6 s | Bắt đầu niệm một Core hệ sấm sét. | Năng lượng dồn lại, đi lên: điện nổ, sấm gọn. | tiếng tổng hợp |
| `core.cast.storm` | P1 | một lần | 3 | 0.3–0.7 s | Phép hệ sấm sét được thả ra, khi Core đó chưa có tiếng riêng. | Thả lực: điện nổ, sấm gọn. | tiếng tổng hợp |
| `core.windup.earth` | P1 | một lần | 2 | 0.4–0.6 s | Bắt đầu niệm một Core hệ đất và cây. | Năng lượng dồn lại, đi lên: đất chuyển, gỗ nứt. | tiếng tổng hợp |
| `core.cast.earth` | P1 | một lần | 3 | 0.3–0.7 s | Phép hệ đất và cây được thả ra, khi Core đó chưa có tiếng riêng. | Thả lực: đất chuyển, gỗ nứt. | tiếng tổng hợp |
| `core.windup.spirit` | P1 | một lần | 2 | 0.4–0.6 s | Bắt đầu niệm một Core hệ linh hồn. | Năng lượng dồn lại, đi lên: hợp xướng mỏng, gió ma. | tiếng tổng hợp |
| `core.cast.spirit` | P1 | một lần | 3 | 0.3–0.7 s | Phép hệ linh hồn được thả ra, khi Core đó chưa có tiếng riêng. | Thả lực: hợp xướng mỏng, gió ma. | tiếng tổng hợp |
| `core.blast.basic` | P2 | một lần | 3 | 0.2–0.5 s | Big Bang: đòn thường (chuột trái) — tia lửa. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.blast.refined` | P2 | một lần | 2 | 0.5–1 s | Big Bang: kỹ thuật Q — quả nổ. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.blast.signature` | P2 | một lần | 1 | 1–2.5 s | Big Bang: tuyệt kỹ E — vụ nổ lớn. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.meteor.basic` | P2 | một lần | 3 | 0.2–0.5 s | Meteor: đòn thường (chuột trái) — cầu lửa. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.meteor.refined` | P2 | một lần | 2 | 0.5–1 s | Meteor: kỹ thuật Q — thiên thạch nhắm đích. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.meteor.signature` | P2 | một lần | 1 | 1–2.5 s | Meteor: tuyệt kỹ E — mưa mười thiên thạch. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.dragon.basic` | P2 | một lần | 3 | 0.2–0.5 s | Dragon's Breath: đòn thường (chuột trái) — phun lửa. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.dragon.refined` | P2 | một lần | 2 | 0.5–1 s | Dragon's Breath: kỹ thuật Q — lốc lửa. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.dragon.signature` | P2 | một lần | 1 | 1–2.5 s | Dragon's Breath: tuyệt kỹ E — rồng bổ nhào. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.elsa.basic` | P2 | một lần | 3 | 0.2–0.5 s | Elsa: đòn thường (chuột trái) — mảnh băng. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.elsa.refined` | P2 | một lần | 2 | 0.5–1 s | Elsa: kỹ thuật Q — đóng băng mặt đất. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.elsa.signature` | P2 | một lần | 1 | 1–2.5 s | Elsa: tuyệt kỹ E — bão băng. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.earthmother.basic` | P2 | một lần | 3 | 0.2–0.5 s | Earth Mother: đòn thường (chuột trái) — rễ trói. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.earthmother.refined` | P2 | một lần | 2 | 0.5–1 s | Earth Mother: kỹ thuật Q — mọc rừng. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.earthmother.signature` | P2 | một lần | 1 | 1–2.5 s | Earth Mother: tuyệt kỹ E — đất mẹ trỗi dậy. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.mjolnir.basic` | P2 | một lần | 3 | 0.2–0.5 s | Mjolnir: đòn thường (chuột trái) — tia sét. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.mjolnir.refined` | P2 | một lần | 2 | 0.5–1 s | Mjolnir: kỹ thuật Q — sét chuyền. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.mjolnir.signature` | P2 | một lần | 1 | 1–2.5 s | Mjolnir: tuyệt kỹ E — búa trời giáng. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.demon.basic` | P2 | một lần | 3 | 0.2–0.5 s | Demon: đòn thường (chuột trái) — đòn linh hồn. | Ngắn, gọn, nghe lặp nhiều lần vẫn dễ chịu. | tiếng tổng hợp |
| `core.demon.refined` | P2 | một lần | 2 | 0.5–1 s | Demon: kỹ thuật Q — triệu hồi. | Dày và dài hơn đòn thường. | tiếng tổng hợp |
| `core.demon.signature` | P2 | một lần | 1 | 1–2.5 s | Demon: tuyệt kỹ E — dịch chuyển linh hồn. | Tiếng lớn nhất của Core này; có mở đầu, đỉnh và đuôi. | tiếng tổng hợp |
| `core.fizzle` | P1 | một lần | 2 | 200–400 ms | Niệm hụt: hết năng lượng, bị ngắt, hoặc lăn khi không đủ thể lực. | Lực xì ra, rơi xuống. | tiếng tổng hợp |
| `core.bolt` | P1 | một lần | 3 | 150–350 ms | Một tia sét chuyền từ mục tiêu này sang mục tiêu khác. | Tia điện nổ tách, đanh. | tiếng tổng hợp |
| `core.elsa.shard` | P3 | một lần | 3 | 150–350 ms | Mảnh băng của Elsa vỡ khi chạm đích và đóng băng mặt đất. | Băng vỡ lanh canh. | tiếng tổng hợp |
| `core.spirit.depart` | P1 | một lần | 1 | 0.8–1.5 s | Dịch chuyển linh hồn: rời đi. | Hút vào một điểm rồi biến mất. | im lặng |
| `core.spirit.arrive` | P1 | một lần | 1 | 0.8–1.5 s | Dịch chuyển linh hồn: tới nơi. | Bung ra từ một điểm, có dư âm. | im lặng |
| `core.spirit.hit` | P2 | một lần | 3 | 200–400 ms | Linh thể được triệu hồi đánh trúng. | Một cú đánh có tiếng vọng lạnh. | tiếng tổng hợp |

## Lửa, nổ, sét (`fire`) — 5 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `fire.ignite` | P1 | một lần | 3 | 300–600 ms | Một ô cỏ hoặc cây bắt lửa. | Lửa bùng lên, phừng. | tiếng tổng hợp |
| `fire.steam` | P2 | một lần | 2 | 400–800 ms | Nước hoặc băng dập lửa; tưới tắt đám cháy. | Xèo dài, hơi nước. | tiếng tổng hợp |
| `fire.boom` | P1 | một lần | 3 | 0.6–1.2 s | Vụ nổ lớn: quả nổ, thiên thạch. | Nổ có đầu đanh, thân trầm, đuôi rền. | tiếng tổng hợp |
| `fire.boom.small` | P1 | một lần | 3 | 300–600 ms | Vụ nổ nhỏ: mìn, mảnh văng. | Nổ gọn, ít đuôi. | tiếng tổng hợp |
| `fire.lightning` | P1 | một lần | 3 | 0.8–1.6 s | Sét đánh xuống: trong bão, hoặc từ một đòn sét. | Tách chói rồi sấm rền; ở xa vẫn nghe. | tiếng tổng hợp |

## Xây dựng và công trình (`build`) — 11 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `build.wood` | P1 | một lần | 3 | 300–600 ms | Đặt một công trình gỗ: sàn, tường, cửa, rương, giường, thang gỗ. | Hai nhát búa đóng ván. | tiếng tổng hợp |
| `build.stone` | P1 | một lần | 3 | 300–600 ms | Đặt công trình đá: sàn đá, tường đá, lò. | Đá đặt lên đá, một tiếng cộp nặng. | tiếng tổng hợp |
| `build.metal` | P1 | một lần | 3 | 300–600 ms | Đặt công trình kim loại: cửa sắt, máy phát, máy lọc, bơm dầu, tháp tên, két. | Siết bu lông, kim loại khớp vào nhau. | tiếng tổng hợp |
| `build.soft` | P2 | một lần | 3 | 300–600 ms | Đặt mái tranh, giường rơm, vườn, lửa trại. | Buộc dây, rơm sột soạt. | tiếng tổng hợp |
| `build.wire` | P2 | một lần | 2 | 200–400 ms | Đặt dây điện, công tắc, cảm biến. | Cắm giắc, một tiếng tách điện. | tiếng tổng hợp |
| `build.upgrade` | P1 | một lần | 2 | 0.6–1.2 s | Nâng cấp công trình, trạm, lò, máy phát, xe kéo. | Loạt búa nhanh rồi một tiếng chốt vang. | tiếng tổng hợp |
| `build.repair` | P1 | một lần | 3 | 300–700 ms | Sửa công trình, gia cố bằng tấm sắt. | Vài nhát búa đều. | tiếng tổng hợp |
| `build.reclaim` | P1 | một lần | 2 | 400–800 ms | Tháo dỡ một công trình để lấy lại vật liệu. | Bẩy ván ra, gỗ rơi lộp cộp. | tiếng tổng hợp |
| `build.hit` | P1 | một lần | 4 | 100–250 ms | Công trình bị đánh trúng. | Húc vào tường gỗ, rung. | tiếng tổng hợp |
| `build.break` | P1 | một lần | 3 | 0.5–1 s | Công trình bị phá sập. | Gỗ gãy, đổ sập, mảnh văng. | tiếng tổng hợp |
| `build.collapse` | P1 | một lần | 1 | 1–2 s | Một phần căn cứ sụp vì mất nền hoặc mất trụ đỡ. | Sập dây chuyền, nhiều lớp đổ nối nhau. | im lặng |

## Cửa (`door`) — 7 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `door.wood.open` | P1 | một lần | 2 | 250–500 ms | Mở cửa gỗ. | Bản lề kẹt nhẹ, cánh gỗ mở. | tiếng tổng hợp |
| `door.wood.close` | P1 | một lần | 2 | 200–400 ms | Đóng cửa gỗ. | Cánh gỗ sập vào khung. | tiếng tổng hợp |
| `door.iron.open` | P2 | một lần | 2 | 300–600 ms | Mở cửa sắt, cửa phế tích. | Sắt nặng rít trên bản lề. | tiếng tổng hợp |
| `door.iron.close` | P2 | một lần | 2 | 300–600 ms | Đóng cửa sắt. | Sắt sập, vang. | tiếng tổng hợp |
| `door.powered` | P1 | một lần | 2 | 400–800 ms | Cửa điện mở: có nguồn, quẹt đúng thẻ, hoặc mở từ bên trong. | Mô tơ kéo, hơi xì, một tiếng bíp xác nhận. | tiếng tổng hợp |
| `door.locked` | P1 | một lần | 2 | 200–400 ms | Thử mở cửa bị khóa, thiếu thẻ, hết điện. | Tay nắm lắc, chốt không nhả. | tiếng tổng hợp |
| `door.auto.close` | P2 | một lần | 1 | 400–800 ms | Cửa điện tự đóng lại sau một lúc. | Mô tơ đẩy ngược rồi khóa sập. | tiếng tổng hợp |

## Rương, thùng, đồ tiếp tế (`box`) — 11 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `box.chest.open` | P1 | một lần | 2 | 300–600 ms | Mở rương của mình, tủ đồ, xe kéo. | Nắp gỗ nặng mở, bản lề kẹt. | tiếng tổng hợp |
| `box.chest.close` | P2 | một lần | 2 | 200–400 ms | Đóng rương hoặc thùng (đóng bảng thùng chứa). | Nắp sập xuống. | tiếng tổng hợp |
| `box.loot.open` | P1 | một lần | 3 | 300–600 ms | Lục một thùng đồ ngoài đảo, tủ sắt, xác xe. | Mở nắp, lục lọi. | tiếng tổng hợp |
| `box.bag.open` | P2 | một lần | 2 | 200–400 ms | Mở túi đồ rơi lại (kể cả túi sau khi chết). | Kéo dây túi vải. | tiếng tổng hợp |
| `box.machine.open` | P3 | một lần | 1 | 200–400 ms | Mở máy tái chế, thùng xe máy. | Chốt kim loại bật, cửa sập mở. | tiếng tổng hợp |
| `box.rag.open` | P1 | một lần | 1 | 0.8–1.5 s | Mở rương Ragnarok hoặc hộp thẻ. | Khóa nặng nhả ra, nắp mở có ánh sáng. | tiếng tổng hợp |
| `box.cash.open` | P1 | một lần | 1 | 0.5–1 s | Mở hộp tiền Ragnarok. | Khóa két bật, xu xô vào nhau. | tiếng tổng hợp |
| `box.airdrop.signal` | P1 | một lần | 1 | 1.5–3 s | Có tín hiệu thả đồ tiếp tế. | Radio rè rồi ba tiếng bíp; hoặc pháo hiệu. | im lặng |
| `box.airdrop.descent` | P2 | một lần | 1 | 2–4 s | Thùng tiếp tế bắt đầu rơi. | Máy bay ngang qua, tiếng vật rơi rít. | im lặng |
| `box.airdrop.land` | P1 | một lần | 2 | 0.5–1 s | Thùng tiếp tế chạm đất. | Thùng gỗ nặng nện xuống. | tiếng tổng hợp |
| `box.airdrop.open` | P1 | một lần | 1 | 0.5–1 s | Mở thùng tiếp tế. | Bẩy nắp thùng bằng xà beng. | tiếng tổng hợp |

## Trạm chế tạo, điện, bẫy (`station`) — 19 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `station.craft` | P1 | một lần | 3 | 300–700 ms | Chế tạo bằng tay xong một món. | Gọt, buộc, một tiếng chốt. | tiếng tổng hợp |
| `station.queue` | P2 | một lần | 2 | 150–350 ms | Xếp một việc vào trạm; bỏ nguyên liệu vào. | Đặt nguyên liệu vào khay. | tiếng tổng hợp |
| `station.done` | P1 | một lần | 2 | 300–700 ms | Một trạm làm xong một việc, khi trạm đó chưa có tiếng riêng. | Một tiếng báo xong, rõ nhưng không chói. | tiếng tổng hợp |
| `station.done.furnace` | P2 | một lần | 2 | 300–800 ms | Lò nung (cả lò lớn) ra một mẻ. | Thỏi kim loại nóng rơi ra khay, xèo. | tiếng tổng hợp |
| `station.done.campfire` | P2 | một lần | 2 | 300–800 ms | Lửa trại nấu xong. | Mỡ xèo, một tiếng gõ nồi. | tiếng tổng hợp |
| `station.done.workbench` | P2 | một lần | 2 | 300–800 ms | Bàn chế tạo làm xong. | Búa chốt nhát cuối, đặt món đồ xuống. | tiếng tổng hợp |
| `station.done.refinery` | P2 | một lần | 2 | 300–800 ms | Máy lọc ra nhiên liệu. | Van xả, chất lỏng chảy vào can. | tiếng tổng hợp |
| `station.done.oil_pump` | P2 | một lần | 2 | 300–800 ms | Bơm dầu ra dầu thô. | Bơm nhả, dầu ọc ra. | tiếng tổng hợp |
| `station.done.research` | P2 | một lần | 2 | 300–800 ms | Bàn nghiên cứu xong. | Đóng sổ, một nốt sáng. | tiếng tổng hợp |
| `station.done.recycler` | P2 | một lần | 2 | 300–800 ms | Máy tái chế xong một món. | Máy nghiền dừng, mảnh rơi ra khay. | tiếng tổng hợp |
| `station.on` | P1 | một lần | 2 | 400–800 ms | Một trạm bắt đầu chạy; bật máy phát; đổ nhiên liệu cho máy phát phế tích. | Máy khởi động, tăng dần. | tiếng tổng hợp |
| `station.off` | P1 | một lần | 2 | 400–800 ms | Hết nhiên liệu, lửa sưởi tắt, tắt máy phát. | Máy chậm dần rồi tắt. | tiếng tổng hợp |
| `station.stall` | P2 | một lần | 1 | 200–400 ms | Một trạm ở gần đứng máy: khay ra đầy, thiếu nguyên liệu, bị chặn. | Máy khựng lại, một tiếng cụp. | tiếng tổng hợp |
| `station.switch` | P1 | một lần | 2 | 80–200 ms | Gạt công tắc, đổi ưu tiên điện, cấu hình tháp tên hoặc trang trại. | Cần gạt cơ khí, tách chắc. | tiếng tổng hợp |
| `station.recycle.start` | P2 | một lần | 1 | 400–800 ms | Bỏ một món vào máy tái chế. | Máy nghiền bắt đầu quay. | tiếng tổng hợp |
| `station.trap.set` | P2 | một lần | 1 | 300–600 ms | Giương bẫy gấu. | Lò xo kéo căng, khóa chốt. | im lặng |
| `station.trap.snap` | P1 | một lần | 2 | 200–400 ms | Bẫy gấu sập vào một sinh vật. | Hàm sắt bập lại, rất đanh. | im lặng |
| `station.turret` | P1 | một lần | 3 | 100–250 ms | Tháp tên bắn. | Nỏ cơ khí bật. | tiếng tổng hợp |
| `station.poi.expire` | P2 | một lần | 1 | 0.6–1.2 s | Máy phát phế tích hết giờ chạy. | Điện sụt, đèn tắt. | tiếng tổng hợp |

## Vườn, nước, vật nuôi, nghỉ ngơi (`farm`) — 10 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `farm.plant` | P2 | một lần | 2 | 300–600 ms | Gieo hạt vào luống. | Xới đất, vùi hạt. | im lặng |
| `farm.water` | P2 | một lần | 2 | 400–900 ms | Tưới luống; đổ nước vào thùng, máng. | Nước rót xuống đất hoặc vào thùng gỗ. | im lặng |
| `farm.harvest` | P2 | một lần | 3 | 300–600 ms | Thu hoạch luống. | Nhổ, bẻ, lá xào xạc. | tiếng tổng hợp |
| `farm.fill` | P2 | một lần | 2 | 0.5–1 s | Múc nước đầy bình ở sông hoặc thùng. | Bình chìm xuống, ọc ọc đầy dần. | im lặng |
| `farm.tame` | P2 | một lần | 1 | 0.6–1.2 s | Thuần hóa xong một con vật. | Con vật kêu hiền, kèm một nốt ấm. | tiếng tổng hợp |
| `farm.feed` | P3 | một lần | 2 | 300–700 ms | Cho vật nuôi ăn; đổ thức ăn vào máng. | Thú nhai rào rạo. | tiếng tổng hợp |
| `farm.lead` | P3 | một lần | 1 | 200–400 ms | Dắt hoặc thả một con vật. | Dây thừng giật nhẹ, tặc lưỡi gọi. | im lặng |
| `farm.rest.start` | P1 | một lần | 1 | 0.8–1.5 s | Nằm xuống giường nghỉ. | Rơm lún, thở ra một hơi. | im lặng |
| `farm.rest.end` | P1 | một lần | 1 | 0.8–1.5 s | Thức dậy (hết giờ, bị đánh thức, tự dậy). | Ngáp, rơm sột soạt khi ngồi dậy. | im lặng |
| `farm.douse` | P2 | một lần | 2 | 400–800 ms | Dùng bình nước dập một cây đang cháy. | Nước hắt vào lửa, xèo. | tiếng tổng hợp |

## Xe kéo, xe máy, tàu sơ tán (`ride`) — 9 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `ride.cart.grab` | P2 | một lần | 2 | 200–400 ms | Nắm càng xe kéo (F). | Nhấc càng gỗ, bánh xe kẹt nhẹ. | im lặng |
| `ride.cart.release` | P2 | một lần | 2 | 200–400 ms | Thả xe kéo; đặt hoặc gấp xe. | Càng gỗ hạ xuống đất. | im lặng |
| `ride.bike.mount` | P1 | một lần | 1 | 0.8–1.5 s | Lên xe máy. | Đạp nổ, máy bắt lửa. | tiếng tổng hợp |
| `ride.bike.exit` | P1 | một lần | 1 | 0.6–1.2 s | Xuống xe máy. | Máy tắt, kim loại nguội lách tách. | tiếng tổng hợp |
| `ride.bike.refuel` | P2 | một lần | 1 | 0.8–1.5 s | Đổ xăng, tra dầu. | Xăng ọc vào bình. | im lặng |
| `ride.bike.repair` | P2 | một lần | 1 | 0.6–1.2 s | Sửa xe máy. | Cờ lê siết, cạch cạch. | tiếng tổng hợp |
| `ride.evac.open` | P1 | một lần | 1 | 2–4 s | Tàu sơ tán mở bến; tàu cập bến. | Còi tàu xa, một hồi dài. | im lặng |
| `ride.evac.depart` | P1 | một lần | 1 | 2–4 s | Tàu sơ tán rời bến. | Hai hồi còi ngắn. | im lặng |
| `ride.evac.board` | P1 | một lần | 1 | 0.8–1.5 s | Lên tàu, rời tàu, xếp hàng lên tàu. | Bước trên cầu ván, dây neo cọt kẹt. | im lặng |

## Người trên đảo (`npc`) — 7 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `npc.talk` | P1 | một lần | 4 | 200–500 ms | Bắt chuyện với một người. | Một câu lầm bầm không rõ lời; giọng trung tính. | im lặng |
| `npc.trade` | P1 | một lần | 2 | 300–600 ms | Đổi đồ, lấy đồ, giao hàng, góp bếp. | Đồ đặt lên bàn, hai bên trao tay. | tiếng tổng hợp |
| `npc.recruit` | P2 | một lần | 1 | 0.8–1.5 s | Thu nhận được một người. | Bắt tay, một nốt ấm. | tiếng tổng hợp |
| `npc.order` | P2 | một lần | 3 | 200–500 ms | Giao việc, bảo đi theo, cho nghỉ. | Một tiếng ừ ngắn. | im lặng |
| `npc.threaten` | P3 | một lần | 2 | 300–600 ms | Đe dọa một người. | Quát ngắn, người kia giật mình. | im lặng |
| `npc.aid` | P2 | một lần | 1 | 400–800 ms | Cứu chữa một người bị thương. | Quấn băng, người kia thở ra. | tiếng tổng hợp |
| `npc.down` | P2 | một lần | 2 | 400–800 ms | Một người ở gần gục xuống hoặc chết. | Tiếng kêu ngắn rồi thân đổ. | im lặng |

## Điểm xuyết môi trường (ngẫu nhiên) (`amb`) — 17 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `amb.bird` | P1 | một lần | 6 | 0.5–2 s | Ban ngày, ngoài trời, ở đồng cỏ hoặc rừng, không mưa. | Chim hót từng câu ngắn, nhiều loài khác nhau. | im lặng |
| `amb.owl` | P2 | một lần | 3 | 1–2.5 s | Ban đêm ở rừng hoặc đồng cỏ. | Cú kêu, xa. | im lặng |
| `amb.howl` | P2 | một lần | 2 | 2–4 s | Ban đêm, ngoài trời; hiếm. | Sói tru rất xa. | im lặng |
| `amb.frog` | P2 | một lần | 4 | 0.5–1.5 s | Ở đầm lầy, hoặc ban đêm gần nước. | Ếch nhái kêu từng chập. | im lặng |
| `amb.gull` | P2 | một lần | 4 | 0.8–2 s | Ban ngày, cách biển dưới bốn ô. | Mòng biển kêu. | im lặng |
| `amb.gust` | P2 | một lần | 4 | 1.5–3 s | Ở vùng núi tuyết, hoặc khi có bão. | Một cơn gió giật rít qua. | im lặng |
| `amb.creak` | P2 | một lần | 4 | 1–2.5 s | Ở phế tích, vùng độc, xưởng đúc. | Kim loại gỉ kêu cọt kẹt, tôn va. | im lặng |
| `amb.house` | P3 | một lần | 4 | 0.8–2 s | Trong nhà có mái. | Gỗ nhà nứt khẽ, mái tranh xào xạc. | im lặng |
| `amb.thunder` | P1 | một lần | 4 | 2–5 s | Khi có bão, 15–40 giây một lần. | Sấm rền xa, không có tiếng tách. | im lặng |
| `amb.volcano` | P2 | một lần | 3 | 2–4 s | Ở vùng tro, gần dung nham. | Núi lửa ầm ì, đá lăn xa. | im lặng |
| `amb.twig` | P3 | một lần | 4 | 0.3–1 s | Trong rừng, cả ngày lẫn đêm. | Cành gãy, lá rơi, có gì đó động trong bụi. | im lặng |
| `amb.rag` | P1 | một lần | 4 | 2–5 s | Trong Ragnarok. | Đất nứt xa, tiếng sụp đổ vọng về. | im lặng |
| `amb.rain.start` | P2 | một lần | 1 | 2–4 s | Trời chuyển mưa. | Vài hạt mưa đầu rơi lộp độp, dày dần. | im lặng |
| `amb.storm.start` | P1 | một lần | 1 | 3–5 s | Trời chuyển bão. | Một tiếng sấm lớn mở đầu cơn bão. | im lặng |
| `amb.clear` | P3 | một lần | 1 | 2–4 s | Trời quang lại sau mưa. | Nước nhỏ giọt, chim hót lại. | im lặng |
| `amb.dawn` | P2 | một lần | 1 | 2–4 s | Trời sáng (đêm sang ngày). | Chim sớm hót ran, có thể kèm gà gáy xa. | im lặng |
| `amb.dusk` | P2 | một lần | 1 | 2–4 s | Trời tối (ngày sang đêm). | Dế bắt đầu kêu, một tiếng cú. | im lặng |

## Nền môi trường (lặp) (`bed`) — 15 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `bed.meadow` | P1 | nền | 1 | 20–40 s, lặp liền | Ban ngày, ngoài trời, ở cỏ, đồng cỏ, đồi, đường. | Gió nhẹ qua cỏ, côn trùng xa. Không có chim nổi bật (chim đã có ở amb.bird). | im lặng |
| `bed.forest` | P1 | nền | 1 | 20–40 s, lặp liền | Ban ngày trong rừng. | Lá xào xạc trên cao, không khí kín. | im lặng |
| `bed.night` | P1 | nền | 1 | 20–40 s, lặp liền | Ban đêm, ngoài trời, ở cỏ, rừng, đồi, cát. | Dế và côn trùng đêm, đều. | im lặng |
| `bed.marsh` | P2 | nền | 1 | 20–40 s, lặp liền | Ở đầm lầy, cả ngày lẫn đêm. | Côn trùng dày, bong bóng bùn. | im lặng |
| `bed.snow` | P2 | nền | 1 | 20–40 s, lặp liền | Ở tuyết và băng. | Gió lạnh rỗng, không có sự sống. | im lặng |
| `bed.ash` | P2 | nền | 1 | 20–40 s, lặp liền | Ở tro, đất cháy, gần dung nham. | Gió khô, than lách tách, ầm ì rất trầm. | im lặng |
| `bed.ruins` | P2 | nền | 1 | 20–40 s, lặp liền | Ở vùng độc và xưởng đúc. | Rỗng, có tiếng ù điện xa và gió lùa qua ống. | im lặng |
| `bed.rain` | P1 | nền | 1 | 20–40 s, lặp liền | Trời mưa hoặc bão, đứng ngoài trời. | Mưa đều trên đất và lá. | tiếng tổng hợp |
| `bed.rain.roof` | P1 | nền | 1 | 20–40 s, lặp liền | Trời mưa hoặc bão, đứng dưới mái. | Mưa gõ trên mái, nghe từ bên trong. | im lặng |
| `bed.wind` | P1 | nền | 1 | 20–40 s, lặp liền | Luôn có ở mức nhẹ; mạnh ở núi tuyết và khi bão; rất nhỏ khi ở trong nhà. | Gió thổi đều, không có cơn giật. | tiếng tổng hợp |
| `bed.surf` | P1 | nền | 1 | 20–40 s, lặp liền | Cách biển dưới sáu ô; càng gần càng lớn. | Sóng vỗ bờ, đều. | tiếng tổng hợp |
| `bed.room` | P2 | nền | 1 | 20–40 s, lặp liền | Đứng trong nhà có mái. | Tiếng phòng kín, rất khẽ. | tiếng tổng hợp |
| `bed.ragnarok` | P1 | nền | 1 | 20–40 s, lặp liền | Trong Ragnarok; mức nhẹ hơn ở giai đoạn nguy hiểm. | Ầm ì rất trầm, liên tục, gây bất an. | tiếng tổng hợp |
| `bed.sea` | P2 | nền | 1 | 20–40 s, lặp liền | Khi đang ở trên tàu sơ tán ngoài biển. | Sóng lớn, thân tàu kẽo kẹt. | im lặng |
| `bed.title` | P2 | nền | 1 | 20–40 s, lặp liền | Ở màn hình chính, sau lần bấm đầu tiên. | Gió và sóng xa, một nền nhạc rất mỏng nếu có. | im lặng |

## Tiếng chạy liên tục (lặp) (`loop`) — 12 slot

| Slot | Ưu tiên | Kiểu | Số bản | Độ dài | Khi nào phát | Nghe ra sao | Hiện nay |
|---|---|---|---|---|---|---|---|
| `loop.campfire` | P1 | vòng lặp | 1 | 4–12 s, lặp liền | Lửa trại hoặc cột đuốc đang cháy ở gần. | Lửa củi lách tách. | im lặng |
| `loop.furnace` | P1 | vòng lặp | 1 | 4–12 s, lặp liền | Lò nung (cả lò lớn) đang chạy ở gần. | Lửa lò gầm, ống thổi. | tiếng tổng hợp |
| `loop.refinery` | P2 | vòng lặp | 1 | 4–12 s, lặp liền | Máy lọc đang chạy ở gần. | Chất lỏng sôi, van xì. | tiếng tổng hợp |
| `loop.pump` | P2 | vòng lặp | 1 | 4–12 s, lặp liền | Bơm dầu đang chạy ở gần. | Bơm cơ khí nhịp chậm, nặng. | tiếng tổng hợp |
| `loop.generator` | P1 | vòng lặp | 1 | 4–12 s, lặp liền | Máy phát điện đang chạy ở gần. | Động cơ nổ đều. | tiếng tổng hợp |
| `loop.recycler` | P3 | vòng lặp | 1 | 4–12 s, lặp liền | Máy tái chế đang chạy ở gần. | Máy nghiền quay. | im lặng |
| `loop.wildfire` | P2 | vòng lặp | 1 | 4–12 s, lặp liền | Có cây hoặc cỏ đang cháy trong tầm nhìn. | Đám cháy lớn, gầm và nổ lách tách. | im lặng |
| `loop.bike.idle` | P1 | vòng lặp | 1 | 4–12 s, lặp liền | Đang ngồi trên xe máy, đứng yên. | Máy nổ không tải. | im lặng |
| `loop.bike.run` | P1 | vòng lặp | 1 | 4–12 s, lặp liền | Đang chạy xe máy; cao độ tăng theo tốc độ. | Máy kéo ga đều. | im lặng |
| `loop.cart` | P2 | vòng lặp | 1 | 4–12 s, lặp liền | Đang kéo xe và di chuyển. | Bánh gỗ lăn, trục kẽo kẹt. | im lặng |
| `loop.heartbeat` | P1 | vòng lặp | 1 | 4–12 s, lặp liền | Máu dưới 28; càng thấp càng lớn. | Nhịp tim trầm, đều. | im lặng |
| `loop.geiger` | P2 | vòng lặp | 1 | 4–12 s, lặp liền | Đứng trên đất độc hoặc phóng xạ đang trên 25. | Máy đo lách tách. | im lặng |

