# Kiểm tra UI / UX / HUD, 2026-11-24

Phạm vi: toàn bộ giao diện của bản web (`web/`). Kiểm trên bản dựng của `2e0bb245` (mã game `384b35ad`), sau đó sửa trên nhánh `arena/416ce826-soul-of-hero`.

## Cách kiểm

- Trình duyệt Chromium không màn hình, cửa sổ 1280 × 720, cộng các cỡ nhỏ hơn: 1024 × 768, 800 × 600, 390 × 844.
- Mỗi màn hình được chụp ảnh và đo: chữ ra ngoài khung, chữ bị cắt, cỡ chữ, nút không có tên, phần tử đè nhau, độ tương phản.
- Bản người chơi: màn tiêu đề, hồ sơ, chọn nhân vật, HUD, túi đồ, bản đồ, ghi chú, sổ Hành trình, kỹ năng, xây dựng, menu Esc; tiếng Anh rồi tiếng Việt.
- Bản QA nội bộ (`VITE_SOH_QA=1`): các bảng không tới nhanh được bằng cách chơi (lò, bàn chế tạo, bàn nghiên cứu, tủ lãnh thổ, rương ký gửi, thương nhân, xe, boss, tử trận). Nhân vật được đặt thẳng cạnh vật thể, nên phần này chỉ nói về hình thức.
- Các lượt chạy sau khi sửa không có lỗi console, request hỏng hay mã trạng thái ≥ 400.
- Ảnh chụp của lượt kiểm ban đầu (trước khi sửa) đã mất cùng thư mục tạm của máy kiểm; các ảnh trong `shots/` đều là ảnh sau khi sửa.

## Kết quả kiểm và việc đã làm

Vòng 1 là commit `196d27b`. Vòng 2 là các commit sau đó trên cùng nhánh (PR #66).

| # | Mức | Lỗi | Trạng thái |
|---|---|---|---|
| 1 | Nặng | Thanh máu và thanh thể lực không hiện phần màu. | **Đã sửa** (vòng 1) |
| 2 | Nặng | Tiếng Việt chỉ có trong sổ Hành trình; các màn hình khác 100% tiếng Anh. | **Đã sửa** (vòng 2): toàn bộ giao diện có tiếng Việt, xem mục "Tiếng Việt" |
| 3 | Nặng | Cửa sổ nhỏ chỉ thu nhỏ khung 640 × 360; chữ còn 10 px ở 800 × 600. | **Đã sửa** (vòng 2): HUD tự phóng to khi khung bị thu nhỏ; người chơi chọn được 100 / 125 / 150% |
| 4 | Nặng | Điện thoại không chơi được: game chỉ nhận chuột và bàn phím. | **Đã sửa** (vòng 2): cần điều khiển và nút bấm trên màn hình. Mới thử bằng trình duyệt giả lập cảm ứng, chưa thử máy thật |
| 5 | Vừa | Bảng Presentation dài hơn khung chứa nó. | **Đã sửa** (vòng 1); vòng 2 thêm thẻ Controls |
| 6 | Vừa | Chữ số 5 giống S, 7 giống 1. | **Đã sửa** (vòng 1) |
| 7 | Vừa | "find…" đọc thành "And…". | **Đã sửa** (vòng 1) |
| 8 | Vừa | 52 ký hiệu phụ thuộc phông hệ thống của người chơi. | **Đã sửa** (vòng 1) |
| 9 | Vừa | Trong túi đồ, phím Tab mở bảng Kỹ năng. | **Đã sửa** (vòng 1) |
| 10 | Vừa | Hai hộp xác nhận mở được cùng lúc. | **Đã sửa** (vòng 1) |
| 11 | Vừa | Chú thích "fd 82/100", "h2o 81/100". | **Đã sửa** (vòng 1) |
| 12 | Vừa | Lời nhắc "Rương ký gửi" giữa giao diện tiếng Anh. | **Đã sửa** (vòng 1) |
| 13 | Vừa | Thời gian không dừng khi mở bảng. | **Giữ nguyên luật, thêm cảnh báo** (vòng 2): mất từ 0,5 máu khi đang mở bảng thì viền đỏ nháy 2,4 giây và hiện dòng "Bạn đang mất máu. Thế giới không dừng khi bảng này mở: bấm Esc." |
| 14 | Vừa | Bảng đè lên HUD; hàng túi đồ ở đáy trạm bị cắt. | **Đã sửa** (vòng 2): mở bảng thì ô chỉ số chỉ còn máu và thể lực, ô đồng hồ chỉ còn giờ; bảng toàn màn hình thì ẩn HUD; nền bảng đặc |
| 15 | Vừa | Chữ của người làm game: "VEYRA · U=0.5", "AU 812,649 · F0", "LOCAL/UNVERIFIED". | **Đã sửa** (vòng 2): HUD, bản đồ và dòng mở đầu ghi "Veyra"; bỏ "F1" ở tầng trệt; ô toạ độ AU có chú thích khi rê chuột; "LOCAL/UNVERIFIED" chỉ có trong bản QA |
| 16 | Nhỏ | Danh sách công thức lặp tên. | **Đã sửa** (vòng 1) |
| 17 | Nhỏ | Màn Hồ sơ quá mờ. | **Đã sửa** (vòng 1) |
| 18 | Nhỏ | "-0%" giáp; ô "mute" mặc định của trình duyệt. | **Đã sửa** (vòng 1) |
| 19 | Nhỏ | Bản đồ ván mới có khoảng 66 chấm đỏ; chế độ xây ghi "Too far away". | **Đã sửa** (vòng 2): chấm đỏ là túi của cửa hàng và xác trong thế giới (68 cái ở ván kiểm), nay chỉ đánh dấu túi của chính người chơi; dòng chữ đổi thành "aim closer: you build within 4 tiles of yourself" |

## Vòng 2: chi tiết

### Tiếng Việt

- Dịch ở tầng hiển thị: `src/ui/i18n-dom.ts` thay chữ ngay trước khi ra màn hình, tra trong sổ câu `i18n/vi/*.txt` (1.444 câu, dựng thành `src/game/i18n-vi-book.ts` bằng `scripts/make-vi-book.py`). Luật chơi, bản lưu và nhật ký không đổi.
- Câu nào chưa có trong sổ thì giữ tiếng Anh, không hiện chữ sai.
- Giữ tiếng Anh theo quyết định trước: tên vật phẩm, công trình, sinh vật, boss, và các từ "Parts", "Core", "Ragnarok", "Elder". Có bài kiểm thử chặn việc dịch nhầm tên.
- Lần đầu vào game: trình duyệt tiếng Việt thì mở bằng tiếng Việt. Người chơi đổi ở màn tiêu đề hoặc menu Esc; lựa chọn được nhớ.
- Lượt quét cuối (1280 × 720, 11 màn hình và 8 thẻ chế tạo): 37 chuỗi chưa dịch, gồm tên phím, tên riêng, chữ của bản QA và các dòng chỉ có tên vật phẩm. Các câu thật trong số đó đã được bổ sung sau lượt quét.
- Sửa cách gọi cho thống nhất: máu của người là "Máu", của công trình là "Độ bền"; "Survivor [C]" trong sổ Hành trình thành "bảng Nhân vật [C]"; "Quickbar" thành "thanh nhanh".

### Cửa sổ nhỏ và điện thoại

- Cỡ HUD: khung co dưới 1,7 lần thì HUD phóng bù, tối đa 150% (125% trên máy cảm ứng). Đo chữ nhỏ nhất: 12 px ở 1280 × 720, 10,1 px ở 1024 × 768 và 800 × 600, 9 px ở 640 × 360. Không phần tử nào ra ngoài khung.
- Điện thoại cầm dọc: hiện màn nhắc xoay ngang, có nút "Toàn màn hình, xoay ngang" và "Vẫn chơi dọc".
- Điện thoại cầm ngang (844 × 390): nửa trái là cần điều khiển nổi; góc phải dưới có Đánh 56 px, Dùng 48 px, Lăn 48 px; dưới ô chỉ số có Túi / Bản đồ / Xây 51 × 35 px. Nút đóng bảng cao 26 px.
- Đã đo: cần gạt trái đi 68 px trong 1,5 giây, nhả tay thì dừng; Lăn trừ thể lực; sau khi bấm Đánh rồi chạm vào thế giới, rìu mòn 1%; Túi, Bản đồ, Xây mở và đóng được bằng ngón tay; không nút nào đè lên nhau.
- Bật tắt ở menu Esc, thẻ Controls: Tự động / Bật / Tắt.

### Các chỗ khác

- Ô chỉ số: cảnh báo "LẠNH · nhóm lửa / mặc đồ ấm" khi hơi ấm thấp; tên vùng dài tự xuống dòng; chết thì ẩn thanh nhanh.
- Thẻ tình trạng nhà: phí bảo trì ghi theo ngày ("1 Wood a day", "1 Wood every 3 days") thay cho số lẻ.
- Bàn nghiên cứu: tên bản vẽ dài xuống dòng thay vì bị cắt.
- Bản đồ: nút "Cont" đổi thành "World"; dòng "Offscreen markers" chỉ đếm đồ của người chơi; chú thích không còn bị ngắt dòng.
- Dòng nhật ký góc trái dưới có nền tối và nằm trên thanh nhanh ở mọi cỡ HUD.

### Ảnh (đều chụp sau khi sửa, bản tiếng Việt)

`shots/r2-hud-vi.png`, `r2-xay-dung.png`, `r2-ban-do-the-gioi.png`, `r2-canh-bao-khi-mo-bang.png`, `r2-lanh.png`, `r2-tram-loc-dau.png`, `r2-so-hanh-trinh.png`, `r2-ruong-ky-gui.png`, `r2-dien-thoai-doc.png`, `r2-dien-thoai-hud.png`, `r2-dien-thoai-tui.png`.

## Vòng 1: chi tiết các chỗ đã sửa

- **Thanh máu (1).** `Gauge` và `Bar` tô một màu đặc rồi phủ một dải tối lên trên, không còn nối chữ số alpha vào tên màu. Đo lại: phần màu rộng 72 px khi máu 100 và 31 px khi máu 22. Ảnh: `shots/hud-hp22.png`.
- **Chữ số (6).** `index.css` khai báo thêm chữ số 0–9 của họ `Pixelify Sans` lấy từ tệp VT323 đã có sẵn, phóng 125% cho khớp chiều cao. Phải khai báo riêng cho hai độ đậm 400 và 700: khai một dải `400 700` làm trình duyệt đẩy toàn bộ chữ cái thường sang phông hệ thống (đã gặp và đã sửa trong lúc làm).
- **Ký hiệu (8).** `src/fonts/soh-symbols.woff2` là tập con 52 ký tự của Noto Sans Symbols, Symbols 2 và Math (OFL 1.1, văn bản giấy phép ở `src/fonts/OFL-Noto.txt`). Dựng lại bằng `scripts/make-symbol-font.py`. Đo lại trên 11 màn hình: không còn ký tự nào vẽ bằng phông hệ thống.
- **Presentation (5).** Thẻ Display: bố cục túi đồ, tỉ lệ màn hình, giảm chớp, HUD đặc. Thẻ Sound: năm thanh âm lượng và nút tắt tiếng. Thẻ Look: phong cách hình ảnh, độ màu, rung màn hình. Kéo thanh trượt bằng chuột chạy liền mạch (0,5 lên 0,95). Ảnh: `shots/menu-display.png`, `shots/menu-sound.png`.

## Đã kiểm sau khi sửa (vòng 2)

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| Toàn bộ bộ hồi quy, 272 tệp, chạy trên `c13dc66` | 269 tệp chạy xong: **1.635 bài đạt, 0 trượt, 28 bài bỏ qua**. 3 tệp không xong trong 45 phút mỗi tệp |
| 10 tệp kiểm thử đọc mã giao diện, chạy lại sau các chỉnh sửa cuối | 71 bài đạt, 0 trượt |
| `tests/i18n-vi.test.ts` (mới, 7 bài), `tests/ui-round2.test.tsx` (mới, 12 bài) | Đạt |
| Trình duyệt, ván thật trên VEYRA, tiếng Anh và tiếng Việt: HUD, bản đồ, chế độ xây, cảnh báo lạnh, cảnh báo khi mở bảng, tử trận | Đạt, không lỗi console |
| Trình duyệt, cảnh "industry", tiếng Việt: 6 bảng chung và 5 trạm, đo phần đè lên HUD | Không bảng nào đè lên HUD |
| Trình duyệt, điện thoại 390 × 844 và 844 × 390 | Đạt, không lỗi console |
| Các bài kiểm của vòng 1 (`v1`, `v2`, `v3`) chạy lại trên bản mới | Đạt |

**Ba tệp không chạy xong** là `src/veyra05/audit-closure`, `src/veyra05/review-r2-acceptance`, `tests/economic-network-m2`. Đây đúng là ba tệp tua hàng trăm giờ game đã được loại khỏi điều kiện nghiệm thu ở vòng trước (`docs/acceptance/2026-11-21-25e24231/BAO_CAO_NGHIEM_THU.md`). Hai tệp đầu được chạy riêng thêm 58 phút vẫn chưa xong. Vòng này không đổi luật chơi: phần mã game chỉ đổi một dòng nhật ký mở đầu, một nhãn chữ và các bản dịch.

**Sau lượt hồi quy còn ba chỉnh sửa nhỏ** (cỡ nút đóng trên máy cảm ứng, chú thích bản đồ, phép đếm "Offscreen markers") và thêm câu dịch. Chúng được kiểm bằng 10 tệp giao diện và các lượt trình duyệt ở trên, không chạy lại cả bộ.

## Vòng 3 (nhánh `arena/04c31cb9-soul-of-hero`, mã `ddca5c5`)

Vòng này làm nốt danh sách "Chưa làm, chưa kiểm" của vòng 2: mở từng bảng chưa từng mở, sửa những gì lộ ra, dịch phần còn tiếng Anh, đóng lại ZIP.

### Lỗi tìm thấy khi mở các bảng chưa từng mở

| # | Mức | Lỗi | Trạng thái |
|---|---|---|---|
| 20 | Nặng | **Bảng nghỉ ném lỗi khi mở.** Bấm E vào giường khi trong nhà không có rương hợp lệ thì bảng nghỉ gọi `countItem` với mã vật chứa không tồn tại (`Cannot read properties of undefined (reading 'slots')`). Lúc đó mã nguồn chưa có lớp chặn lỗi nào, nên lỗi khi vẽ một bảng kéo theo cả giao diện. Người chơi thật gặp được (có giường, chưa có rương). | **Đã sửa**: bảng mở bình thường và nói rõ còn thiếu rương (`r3-nghi-ngoi.png`) |
| 21 | Nặng | Không có lớp chặn lỗi quanh các bảng. | **Đã sửa**: `PanelGuard` bọc mọi bảng; bảng lỗi tự đóng, hiện thông báo, ván chơi chạy tiếp |
| 22 | Vừa | Túi đồ mở cạnh rương / thương nhân dài hơn khung: hàng nút Dùng / Tách / Thả / Xếp nằm dưới mép màn hình, và bảng đè lên ô đồng hồ. | **Đã sửa**: bảng cao hết khung, hàng nút ghim ở chân bảng, ô đồng hồ ẩn trong lúc túi mở cạnh rương (`r3-ruong-va-tui.png`, `r3-thuong-nhan.png`) |
| 23 | Vừa | Nhật ký trở về ghi mã công thức thay cho tên món, chữ "NOW" lặp hai lần trên một dòng, trạm dừng ghi "idle.", máu người chơi dịch thành "Độ bền". | **Đã sửa** (`r3-nhat-ky-tro-ve.png`) |
| 24 | Vừa | Bảng cư dân ghi mã nơi ở và mã trạng thái thay cho tên và từ thường dùng. | **Đã sửa**: tên nơi, từ chỉ trạng thái, "Tin cậy 50 · Máu 95/95" (`r3-cu-dan.png`) |
| 25 | Vừa | Câu ghép từ nhiều mảnh: chữ "s" số nhiều đứng rời, có chỗ thiếu dấu cách giữa số và chữ, và lớp tiếng Việt không dịch được vì mỗi mảnh là một nút chữ riêng. | **Đã sửa**: mỗi câu là một chuỗi, ở bảng nghỉ, nhật ký trở về, sơ tán, hải trình, cư dân, thương nhân, tử trận, bản đồ |
| 26 | Vừa | Cột phải của bảng trạm: khối nhiên liệu và thành phẩm nằm dưới mép cuộn, không có dấu hiệu nào cho biết. | **Đã sửa một phần**: thêm thanh "Còn nữa ở dưới", bấm là cuộn tới cuối (`r3-lo-luyen.png`). Kích thước bảng giữ nguyên vì bị cổng kiểm `pa1-research-visible-gate` khóa |
| 27 | Nhẹ | Lời nhắc cạnh nhân vật còn tiếng Anh ở 29 / 43 mẫu thử (giao dịch, cửa, thùng tiếp tế, máy phát, bẫy, giường…). | **Đã sửa** |
| 28 | Nhẹ | Cảnh báo khẩn "FREEZING", "DEHYDRATED", "STARVING" còn tiếng Anh. | **Đã sửa** (`r3-lanh-doi-khat.png`) |
| 29 | Nhẹ | Chế độ xây: chú thích ô đồ và lý do không đặt được còn tiếng Anh. | **Đã sửa** (`r3-xay-dung.png`, chụp sau khi dịch; `r2-xay-dung.png` là ảnh cũ, dòng trạng thái còn tiếng Anh) |
| 30 | Nhẹ | Trên máy cảm ứng, dòng hướng dẫn của bước đang theo dõi vẫn bảo "nhấn chuột trái", "Space". | **Đã sửa** cho dòng bước đang theo dõi: đổi thành "nút Đánh", "nút Lăn", "cần điều khiển" |
| 31 | Nội bộ | Cảnh QA "ragnarok_economy": thương nhân, trạm di tản, rương tiền hiện lời nhắc nhưng bấm E không mở (mã lưu lệch một đơn vị). Không ảnh hưởng người chơi. | **Đã sửa** |
| 32 | Vừa | **Thanh xây trông như hai bảng xây riêng** (góp ý khi chơi thử): hàng thẻ Nền / Tường / Mái nằm trong một khung riêng, dòng trạng thái chen giữa nó và hàng ô mà nó điều khiển. Tên mảnh xuống dòng ("Wood / Wall"), và khi mảnh có hai loại vật liệu thì số lượng dính vào câu báo. | **Đã sửa**: thẻ và ô nằm chung một khung, dòng trạng thái nằm trên cùng và rộng bằng khung, câu dài tự xuống dòng bên trong (`r3-xay-dung.png`) |
| 33 | Vừa | Khi đang xây, thẻ chỉ đường mở rộng đè lên góc thanh xây. | **Đã sửa ở 1280 × 720**: trong chế độ xây thẻ chỉ giữ tên bước, cách làm và nút, bỏ hai dòng giải thích và phần thưởng nên kết thúc phía trên thanh xây. Chưa kiểm ở các cỡ cửa sổ khác |

### Các bảng đã mở và xem trong vòng 3

Tiếng Việt, 1280 × 720, không lỗi console: nghỉ (giường), nhật ký trở về (sau 6,5 giờ vắng mặt thật của máy game, cả hai khối "Xem"), thương nhân, trạm di tản (cả bước xác nhận), rương tiền Ragnarok, rương ký gửi, tủ lãnh thổ, lò, bàn chế tạo, bàn nghiên cứu, rương lớn, cư dân, hải trình (đang đi và mắc kẹt), chế độ xây (cả ba trang và chế độ nâng cấp, sau khi dịch), HUD khi lạnh / khát / máu thấp (08:45 trong game). Thương nhân, di tản, rương tiền, rương ký gửi, tủ lãnh thổ được xem thêm bằng tiếng Anh.

Game không có bảng "di vật"; mục đó trong danh sách cũ là ghi nhầm.

### Tiếng Việt

Thêm sổ câu `web/i18n/vi/07-panels.txt`; tổng 1.959 câu (vòng 2: 1.444). Tên vật phẩm, công trình, sinh vật, địa danh và tên vùng ("Lighthouse Spit", "Greywater Hamlet") giữ tiếng Anh theo quy ước cũ.

### Kiểm thử vòng 3

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` trên `ddca5c5` | Sạch |
| Bộ hồi quy trên `ddca5c5` | 273 tệp, bỏ 3 tệp đã được loại từ trước, chạy 270 tệp (mỗi tệp một tiến trình, hai tiến trình cùng lúc): **267 tệp đạt ngay, 1.647 bài đạt, 28 bài bỏ qua, không có phép kiểm nào sai**. 3 tệp có một bài vượt giới hạn 5 giây mặc định; xem ghi chú bên dưới |
| `tests/ui-round3.test.tsx` (mới, 21 bài) | Đạt |
| ZIP `web/releases/Soul-of-Hero-Web.zip` | Đóng lại từ bản dựng của `ddca5c5`: 64.429.794 byte, 221 tệp, SHA256 `c7fc4807d94288734f4e2dc4295603965094769f4ae8465cd402787bd3cc45f0` |

**Ba tệp vượt giới hạn 5 giây** trong lượt hồi quy: `tests/d1-d5-corrective`, `tests/wp2-power-global-obstacles`, `tests/wp3-veyra-recycler-integration`. Chạy lại riêng từng tệp: hai tệp đầu đạt (5 / 5 và 3 / 3 bài); chúng chỉ chậm khi hai tiến trình chia nhau 2 CPU. Tệp thứ ba có một bài chạy khoảng 25 giây và không khai báo giới hạn thời gian riêng, nên luôn bị tính là quá giờ ở giới hạn mặc định. Nó hành xử y hệt trên `main` (`cb39d1f`, chưa có thay đổi nào của vòng 3), và khi cho giới hạn 120 giây thì đạt mọi phép kiểm trên cả `main` lẫn nhánh này. Tệp kiểm thử này không bị sửa. Tính cả ba lượt chạy lại: 1.656 bài đạt.

Ba tệp bị loại từ trước (`src/veyra05/audit-closure`, `src/veyra05/review-r2-acceptance`, `tests/economic-network-m2`) không được chạy.

### Sau khi chơi thử (nhánh `arena/3fc28afa-soul-of-hero`)

Sửa dòng 32 và 33 ở bảng trên. Kiểm: `typecheck`, `typecheck:tests`, `build` sạch; 15 tệp kiểm giao diện chạy 136 bài, 135 đạt. Bài còn lại (`tests/b03-return.test.ts`, "the legacy string route…") chạy khoảng 5 giây so với giới hạn 5 giây mặc định nên quá giờ trên máy kiểm này; trên mã trước thay đổi nó cũng vậy, và với giới hạn 60 giây thì đạt. Chưa chạy lại toàn bộ bộ hồi quy cho thay đổi này. Xem bằng trình duyệt ở 1280 × 720, tiếng Việt, cả ba trang và chế độ nâng cấp, không lỗi trang.

ZIP đóng lại từ bản dựng này: 64.429.971 byte, 221 tệp, SHA256 `a38fb20b7aac5ab09d1368aff48632c0611af078dd29445745a0d7e89833d43b` (thay cho số liệu ở bảng kiểm thử vòng 3).

Bản kiểm thử (có danh sách cảnh dựng sẵn, phím F9): https://soul-of-hero-qa.vercel.app, project Vercel `soul-of-hero-qa`, dựng với `VITE_SOH_QA=1`.

## Vòng 4: cảnh QA trên Veyra và khung hình lấp kín cửa sổ (nhánh `arena/3fc28afa-soul-of-hero`)

### Cảnh QA (F9) dùng bản đồ Veyra

Cả 11 cảnh dựng sẵn giờ dựng trên Veyra, cạnh bãi đổ bộ, thay cho đảo cũ. Trạm, rương, giường và sinh vật thử được đặt trên đất xây được và người chơi đi bộ tới được; bài `tests/qa-sandbox-veyra.test.ts` (49 bài) kiểm điều đó cho từng cảnh.

- Cảnh có sân trạm (`industry`, `full_gear`, `offline_return`): game dọn cỏ, bụi, đá trong ô sân trước khi dựng.
- Cảnh Trưởng lão: danh sách là sáu Nguyên Thủy của Veyra, mặc định Typhon. "Awaken" thêm con được chọn, "Defeat" hạ đúng con đó.
- Veyra không có thùng tiếp tế thả dù, nên các nút xem trước thùng thả đã bị gỡ khỏi bảng F9 khi đang ở Veyra.

Xem bằng trình duyệt (bản QA, 1280 × 720): cả 11 cảnh khởi động, không lỗi trang, không lỗi console. Ảnh: `shots/r4-qa-veyra-typhon.png`.

### Khung hình

Trước đây game luôn vẽ 640 × 360 (16:9) rồi phóng to; cửa sổ nào không đúng 16:9 thì có viền đen. Cửa sổ trình duyệt trên màn 16:9 gần như không bao giờ đúng 16:9 vì thanh địa chỉ và thẻ chiếm chiều cao. Đo trên bản QA trước khi sửa: cửa sổ 1366 × 651 có 104 px viền mỗi bên, 1920 × 953 có 112 px mỗi bên.

Giờ vùng nhìn lấy theo hình dạng cửa sổ, từ 640 × 360 tới tối đa 768 × 400:

| Cửa sổ | Vùng nhìn | Viền còn lại |
|---|---|---|
| 1280 × 720, 1920 × 1080 (đúng 16:9) | 640 × 360, như cũ | không |
| 1366 × 651 | 754 × 360 | 1 px mỗi bên |
| 1920 × 953 | 724 × 360 | 1 px mỗi bên (tính, chưa chụp) |
| 1440 × 900 (16:10) | 640 × 400 | không |
| 844 × 390 (điện thoại nằm ngang) | 768 × 360 | 6 px mỗi bên |
| 2560 × 1080 (21:9) | 768 × 360 | 128 px mỗi bên (tính, chưa chụp) |

Những gì giữ nguyên:

- **Luật chơi.** Các kỹ năng "phủ cả màn hình" (mưa thiên thạch, đóng băng, gom mục tiêu trong tầm nhìn) vẫn tính trên vùng 640 × 360 ở giữa. Khi giữ phím nhắm kỹ năng đó, khung vàng vẽ đúng vùng này. Đo trong trình duyệt: vùng luật ở cùng một toạ độ (1544, 1262) tại mọi cỡ cửa sổ đã thử.
- **Các bảng.** Túi đồ, bản đồ, sổ hành trình, trạm, menu vẫn bố trí 640 × 360 và nằm giữa vùng nhìn; bảng toàn màn hình có nền tối bao quanh.
- **Cửa sổ 16:9.** Vùng nhìn, tỉ lệ phóng và vị trí như trước (đo ở 1280 × 720: canvas 640 × 360, phóng 2 lần, không lệch). Chưa so từng điểm ảnh với bản cũ.

Giới hạn rộng là 768 (48 ô) chứ không tới 21:9: Veyra trượt vùng bản đồ đang nạp khi người chơi cách mép 24 ô, rộng hơn thế thì thấy được mép vùng nạp. Màn 21:9 vì vậy còn viền hai bên.

Cài đặt mới ở Menu → Display → "Screen shape" / "Khung hình": "Lấp kín cửa sổ" (mặc định) và "16:9 cố định" (hành vi cũ).

Kèm theo, sửa một lỗi cũ: ở vài cỡ cửa sổ, sai số dấu phẩy động đặt khung game lệch lên 1 px.

Đã kiểm:

- `typecheck`, `typecheck:tests` sạch. 15 tệp kiểm thử liên quan, gồm `tests/viewport.test.ts` (12 bài mới): 166 bài, đạt hết. Hồi quy toàn bộ chưa chạy lại.
- Trình duyệt, bản QA, cảnh `industry`, không lỗi trang hay console ở: 1280 × 720, 1366 × 651, 1440 × 900, 844 × 390 (cảm ứng); đổi cỡ cửa sổ khi đang chơi (1366 × 651 → 1280 × 720 → 1440 × 900); chế độ "16:9 cố định"; chế độ "Điểm ảnh nguyên" ở 1920 × 953.
- Chuột nhắm đúng chỗ ở mọi góc vùng nhìn, kể cả dải mới thêm: sai lệch góc lớn nhất 0,002 rad.
- Đã mở và xem ở 1366 × 651: túi đồ, bản đồ, sổ hành trình, menu, thanh xây, trạm lọc dầu, trận Typhon. Ở 1440 × 900: túi đồ. Ở 844 × 390: HUD cảm ứng, túi đồ.

Ảnh: `shots/r4-ti-le-truoc-1366x651.png` (trước), `shots/r4-ti-le-sau-1366x651.png`, `shots/r4-ti-le-sau-1440x900.png`, `shots/r4-ti-le-dien-thoai-844x390.png`, `shots/r4-ti-le-tui-do-1366x651.png`.

ZIP đóng lại từ bản dựng này: 64.432.602 byte, SHA256 `89668395aa77115eaf26fde0422d558a450b82308f1b67db51099b8dc56cfbc1`.

Chưa kiểm ở vòng này: màn 21:9 và 1920 × 953 bằng ảnh chụp (mới tính bằng bài kiểm thử); mưa, bão, tuyết, đêm ở vùng nhìn rộng (mới xem sương mù); các kịch bản `e2e/*.mjs` (hầu hết chạy ở 640 × 360 hoặc 1280 × 720, là cỡ không đổi); màn hình tiêu đề vẫn đặt nút ngôn ngữ theo khung 640 × 360 chứ chưa sát mép.

## Vòng 5: bản đồ mở sẵn và điểm đến (nhánh `arena/3fc28afa-soul-of-hero`)

Yêu cầu: bản đồ nên mở toàn bộ ngay từ đầu, để người chơi biết mình có thể đi đâu rồi tự đi tới đó.

Đã làm:

- **Cả lục địa hiện ngay từ lúc đặt chân.** Ở chế độ "Thế giới", địa hình, sông, đường và tên vùng được vẽ đủ; vùng chưa đi qua vẽ tối hơn, vùng đã đi qua vẽ đủ màu. Ở các mức phóng 1×, 2×, 4×, phần chưa đi qua hiện màu địa hình mờ thay cho ô đen.
- **Mọi địa điểm có tên đều có dấu trên bản đồ**: 75 trên 81 nơi ở một ván mới. Sáu rương Ragnarok không hiện cho tới khi người chơi tự tìm ra. Dấu rỗng là chưa tới, dấu đặc là đã tới; hình và màu của dấu theo loại nơi.
- **Bấm vào một nơi** (trên bản đồ hoặc trong danh sách) để xem tên, loại, khoảng cách, hướng, đã tới hay chưa và một dòng nói nơi đó là gì. Bên trong có gì thì bản đồ không ghi.
- **Danh sách "Nơi gần nhất"** (5 dòng) và thẻ "Nơi N/75" liệt kê tất cả theo khoảng cách.
- **Đặt điểm đến.** Sau khi đặt, màn hình chơi có mũi tên kèm tên nơi và khoảng cách; khi nơi đó nằm trong khung nhìn thì mũi tên đổi thành dấu ghim đứng trên nó. Tới trong vòng 12 ô thì điểm đến tự xóa và hiện thông báo "Đã tới". Mũi tên ẩn khi đang giao chiến hoặc đang chạy đoạn cắt cảnh.
- Phím: các phím mũi tên chuyển sang nơi gần nhất theo hướng đó, Enter đặt hoặc bỏ điểm đến.

Giữ nguyên: dịch chuyển bằng lõi Linh hồn và ghim ghi chú vẫn cần vùng đã đi qua; "% đã vẽ" vẫn tính theo vùng đã đi qua; điểm đến chỉ là phần hiển thị, không đổi luật chơi và không ghi vào tệp lưu ván (lưu riêng theo ván trong trình duyệt; phiên QA chỉ giữ trong bộ nhớ).

Lỗi lộ ra khi xem ảnh và đã sửa: phông nhãn thiếu các ký hiệu vòng tròn rỗng, mũi tên chéo và đầu mũi tên nên chúng hiện thành ô trống (nay vẽ bằng CSS và SVG); chữ "fi", "fl" bị dính thành một ký tự lạ ở vài bảng ("find" đọc như "And"), nay đã tắt chữ ghép trên toàn giao diện; tên vùng trên bản đồ quá mờ; mũi tên điểm đến trượt vào thẻ hành trình ở góc phải (nay chạy trên một đường elip nằm trong vùng trống).

| Kiểm | Kết quả |
|---|---|
| `tests/map-atlas.test.tsx` (mới) | 22 bài đạt |
| 9 tệp có liên quan (`map-atlas`, `i18n-vi`, `viewport`, `ui-round2`, `ui-round3`, `gold-intake-integration`, `control-tower-audit-regressions`, `visual-readmodels`, `qa-sandbox-veyra`) | 153 bài đạt |
| `tsc` cho mã và cho bài kiểm thử | Đạt |
| Trình duyệt, 1280 × 720, tiếng Anh và tiếng Việt | Bản đồ, thẻ địa điểm, đặt và bỏ điểm đến, mức phóng 2×, mũi tên gần (207 m) và xa (1,3 km), bấm trực tiếp lên bản đồ, phím mũi tên và Enter; không lỗi console |
| Trình duyệt, 1366 × 651, tiếng Việt | Bản đồ và mũi tên; không lỗi console |
| Trình duyệt, 844 × 390, cảm ứng | Chạm vào dòng, chạm lên bản đồ, đặt điểm đến, mũi tên trên màn hình chơi; không lỗi console |
| Tới nơi | Đặt người chơi cách Crushed Viaduct 9 ô: mũi tên biến mất, hiện "Arrived: Crushed Viaduct", thẻ đổi thành "Places 1/75" |

Ảnh: `shots/r5-map-fresh-vi.png`, `shots/r5-map-place-card-vi.png`, `shots/r5-map-sector-2x-vi.png`, `shots/r5-hud-arrow-vi.png`, `shots/r5-arrived-en.png`, `shots/r5-map-after-arrival-en.png`.

ZIP đóng lại từ bản dựng này: 64.440.484 byte, SHA256 `bc025c735338ca7df14b5b21483dc9f0cf3ce88a53df5945f12e0ceefdd88b9f`.

Chưa kiểm ở vòng này:

- Chưa đi bộ thật tới một điểm đến. Lượt thử đi về phía nam bị địa hình chặn sau 17 m, nên bước "tới nơi" được kiểm bằng cách đặt thẳng vị trí người chơi.
- Dấu ghim khi điểm đến nằm trong khung nhìn chỉ có bài kiểm thử tự động, chưa có ảnh.
- Mũi tên điểm đến mới được xem ở ba hướng (bắc, đông, đông nam) và chỉ ở ván mới; chưa xem cùng lúc với thanh xây, lúc trời tối, hay khi thẻ hành trình cũng đang chỉ đường.
- Thông báo "Đã tới" bằng tiếng Việt chưa có ảnh (câu dịch có trong sổ dịch).
- Lần đầu mở chế độ "Thế giới", nền lục địa được vẽ dần trong chưa đầy 3 giây; trong lúc đó phần dưới còn trống.
- Bộ kiểm thử đầy đủ và ba tệp chậm không chạy lại ở vòng này.

## Vòng 6: thao tác bản đồ (nhánh `arena/21d47176-soul-of-hero`)

Yêu cầu: thao tác với bản đồ chưa mượt; tham khảo cách các game cùng loại làm rồi áp dụng.

### Các game cùng loại làm thế nào

| Game | Cách thao tác bản đồ |
|---|---|
| Rust | Kéo để di chuyển, lăn chuột để phóng to. Bấm chuột phải lên chỗ trống để cắm điểm đánh dấu, bấm chuột phải lên điểm đó để xoá. Điểm đánh dấu hiện trên la bàn lúc chơi. |
| Valheim | Bấm đúp để cắm ghim, chuột phải để xoá. Người chơi hay bỏ sót thứ cần tìm khi không thu nhỏ được đủ xa. |
| Game sinh tồn trên điện thoại | Chạm đúp vào chỗ muốn đánh dấu; có nút "về vị trí của tôi" ở góc. Không tìm được tài liệu riêng về Last Island of Survival. |
| Nguyên tắc chung | Phóng to quanh điểm đang trỏ, từng nấc nhỏ. Con trỏ đổi thành bàn tay nắm khi kéo. Có nút + / − nhìn thấy được. Phản hồi trong vòng 0,1 giây thì người chơi thấy "nhạy". |

### Trước và sau

| | Trước | Sau |
|---|---|---|
| Phóng to | 4 nấc cứng (Thế giới, 1×, 2×, 4×), nhảy vào giữa | Liền mạch từ cả lục địa tới 10 m, quanh đúng điểm con trỏ đang chỉ, có chuyển động mềm |
| Di chuyển | Thế giới và 1× không kéo được | Kéo được ở mọi mức; buông tay lúc đang kéo nhanh thì bản đồ trôi thêm một đoạn |
| Cảm ứng | Chưa có chụm hai ngón | Chụm hai ngón để phóng to, một ngón để kéo |
| Đặt điểm đến | Chỉ chọn được nơi có tên, qua nút trên thẻ | Thêm: bấm đúp, chuột phải, hoặc nhấn giữ (cảm ứng) lên một nơi hay một điểm bất kỳ. Làm lại lần nữa để bỏ |
| Vẽ lại | Mỗi lần rê chuột vẽ lại cả bảng (danh sách 75 nơi) | Kéo và phóng to chỉ vẽ lại tấm bản đồ |
| Mở lại bản đồ | Luôn về mức Thế giới | Giữ nguyên chỗ và mức phóng đã xem (trong phiên chơi) |
| Bàn phím | + / − đổi nấc | + / − phóng to mềm, Home về chỗ mình, mũi tên nhảy tới nơi gần nhất theo hướng, Enter đặt điểm đến |

Điểm tự đánh dấu ("Điểm đã đánh dấu") dùng chung mũi tên chỉ đường trên màn hình chơi; tới trong vòng 4 ô thì tính là đã tới. Mỗi lúc chỉ có một điểm đến. Nó không được lưu vào ván chơi, chỉ lưu trong trình duyệt như điểm đến có tên.

Nút "1×, 2×, 4×, Fit" trên Veyra được thay bằng "Thế giới, Khu vực, −, +, Bạn". Bản đồ cũ (không phải Veyra) giữ nguyên.

### Đã kiểm

| Kiểm | Kết quả |
|---|---|
| Kiểm thử tự động, 10 tệp liên quan tới bản đồ | 175 đạt (thêm `tests/map-feel.test.tsx`, 22 bài; bản báo cáo trước ghi nhầm 23) |
| `npx tsc -p .` và `npm run typecheck:tests` | Không lỗi |
| Trình duyệt 1280 × 720, chuột | Lăn 6 nấc tại Hook Village: nơi đó vẫn nằm dưới con trỏ. Kéo: con trỏ thành bàn tay nắm. Bấm đúp chỗ trống: có "Marked spot", chuột phải lần nữa: mất. Nút Thế giới, Bạn, chọn dòng trong danh sách đều đưa bản đồ tới nơi. Không lỗi console |
| Thời gian mỗi khung hình khi kéo và phóng to | Mức giữa 16,7 ms (60 khung hình / giây) ở mức xa, vừa và gần nhất. Mốc 95% là 16,7–16,8 ms ở 14 trong 15 phép đo, 33 ms ở một phép đo. Mỗi lượt kéo ở mức vừa có một lần khựng 200–280 ms, xem mục dưới |
| Trình duyệt 844 × 390, cảm ứng | Chụm hai ngón, kéo một ngón, nhấn giữ, chạm đúp đều chạy; không lỗi console |
| Tiếng Việt 1280 × 720 và 1366 × 651 | Thẻ, nút, dòng hướng dẫn, mũi tên trên màn hình chơi đều ra tiếng Việt; không lỗi console |
| Đóng rồi mở lại bản đồ | Vẫn ở chỗ và mức phóng cũ |

Ảnh: `shots/r6-map-open-vi.png`, `shots/r6-map-marked-spot-vi.png`, `shots/r6-map-marked-spot-vi-1366.png`, `shots/r6-hud-arrow-marked-spot-vi.png`, `shots/r6-map-touch-double-tap.png`, `shots/r6-map-closest-en.png`.

ZIP đóng lại từ bản dựng này: 64.447.961 byte, SHA256 `87de5ad9fa8577a40f69c7e7d1b0bdd2e293756d604a5b52d56d730cf8c0529c`.

### Tìm thấy khi đo: game khựng 0,1–0,3 giây vài lần mỗi phút (đã xử lý ở vòng 7)

Đứng yên 45 giây ở ván QA mới, không mở bảng nào, máy đo ghi 8 lần xử lý kéo dài quá 30 ms; bốn lần dài nhất là 296, 167, 147 và 80 ms. Cả bốn đều nằm trong bước xử lý cư dân (`stepHumans`), ở phần tìm đường. Lần dài nhất đi theo chuỗi `route` → `globalCellTileAndClass` → `globalBaseGeometry` → `compileGeometryRegionPack`: cư dân hỏi về một vùng đất chưa được dựng, và game dựng vùng đó ngay trên luồng chính. Lần khựng 200–280 ms lúc kéo bản đồ cũng là việc này, không phải do bản đồ.

Game đã có sẵn một luồng nền dựng trước các vùng (`region-prebuild.ts`). Máy kiểm chỉ có 2 nhân và vẽ bằng phần mềm, nên luồng nền có thể bị chậm hơn máy thật. Chưa đo được trên máy thật, nên chưa biết người chơi gặp mức nào.

Đính chính sau khi đo ở vòng 7: luồng nền không chậm. Các vùng gây khựng chưa bao giờ được đưa vào danh sách cho luồng nền dựng.

### Chưa kiểm ở vòng này

- Cử chỉ (kéo, chụm, chạm đúp, nhấn giữ, trôi) chỉ được kiểm bằng trình duyệt tự động; kiểm thử tự động chỉ phủ phần tính toán của khung nhìn và điểm tự đánh dấu.
- Chưa thử trên điện thoại thật, bàn rê (trackpad) thật, Firefox, Safari. Chụm hai ngón trên bàn rê chỉ có bài kiểm thử phần tính toán.
- Chế độ chọn chỗ cho "core blink" trên bản đồ mới chỉ có bài kiểm thử dựng giao diện, chưa bấm thử trong trình duyệt.
- Chưa đi bộ thật tới một điểm tự đánh dấu; phần "đã tới" chỉ có kiểm thử tự động.
- Điểm tự đánh dấu đặt được cả trên mặt nước hoặc chỗ không tới được; game không cảnh báo.
- Ở mức gần nhất, vùng chưa đi qua chỉ là mảng màu thô (4 ô một điểm ảnh) kèm lưới ô; chi tiết chỉ có ở vùng đã đi qua.
- Bộ kiểm thử đầy đủ và các tệp chậm không chạy lại.

## Vòng 7: game khựng khi đứng yên (nhánh `arena/21d47176-soul-of-hero`)

Yêu cầu: sửa việc game khựng 0,1–0,3 giây vài lần mỗi phút, tìm thấy ở vòng 6.

### Nguyên nhân

Cư dân hỏi game về mặt đất quanh họ theo từng vùng 64 × 64 ô. Vùng nào chưa dựng thì game dựng ngay trên luồng chính, mất 0,1–0,3 giây, và màn hình đứng lại trong lúc đó. Game có một luồng nền dựng trước các vùng, nhưng danh sách gửi cho luồng nền thiếu ba nhóm:

1. Vùng bên cạnh mà cư dân đứng cách 9 ô trở lên. Danh sách cũ chỉ lấy vùng bên cạnh khi cư dân đứng cách không quá 8 ô. Trong 16 lần khựng ghi được, cư dân gần nhất đứng cách vùng đó 9–21 ô, và 15 lần người đó đang đứng không. Cư dân tìm việc và tìm đường vòng xa hơn mép vùng của mình, kể cả khi đang đứng không.
2. Ba vùng game đọc ngay lúc tạo ván mới (lúc bấm "Begin the 14 days"). Luồng nền không biết tới ba vùng này.
3. Vùng bên cạnh cư dân của ván mới. Lúc còn ở màn hình tiêu đề, luồng nền chỉ dựng vùng ngay dưới chân cư dân của một ván thử. Vị trí cư dân mỗi ván một khác: đo trên ba ván, 24–31 trong khoảng 120 vùng dưới chân cư dân không trùng với ván thử.

Luồng nền không chậm: trong mọi lượt đo trước khi sửa, chỉ có 1 vùng bị hỏi lúc luồng nền chưa dựng xong.

### Đã sửa

- Vùng bên cạnh được dựng trước khi có cư dân đứng cách không quá 24 ô (trước là 8). Đo trên ba ván mới, mỗi ván 4 phút: cư dân hỏi khoảng 50 vùng bên cạnh; mức 8 ô phủ 25–37 vùng, mức 16 ô thêm 12–13, mức 24 ô thêm 3–4, còn lại 0–3 vùng nằm xa hơn.
- Ở màn hình tiêu đề, luồng nền dựng theo thứ tự: các vùng game đọc lúc tạo ván, vùng dưới chân cư dân, rồi vùng bên cạnh. Tổng cộng 288 vùng (trước là 121). Tệp mới: `web/src/veyra05/region-warmup.ts`.
- Chỗ chứa các vùng dựng sẵn tăng từ 768 lên 960 tầng. Khi chỗ chứa đầy, vùng nào không còn cư dân ở gần sẽ nhường chỗ, vùng xa cư dân nhất nhường trước. Trước đây chỗ chứa đầy thì game ngừng gửi yêu cầu mới, kể cả cho vùng cư dân đang đứng.
- Cách game trả lời về mặt đất không đổi. Vùng dựng ở luồng nền là đúng kết quả của bộ dựng trên luồng chính; bài kiểm thử so sánh hai bên từng ô vẫn đạt. Không sửa tệp nào thuộc luật chơi.

### Trước và sau

Cùng một máy kiểm (2 nhân, Chromium không màn hình), cùng bản dựng QA không nén, nhân vật đứng yên, không mở bảng nào. "Lần khựng" là một lần luồng chính bận liền quá 50 ms. Mỗi dòng là một lượt chạy; các lượt chênh nhau khá nhiều vì cư dân mỗi ván làm việc khác nhau.

| Tình huống | Trước | Sau |
|---|---|---|
| Ván mới, bấm chơi 8 giây sau khi mở trang, đứng 180 giây | 9 lần khựng (8 lần quá 80 ms), dài nhất 277 ms, tổng 1222 ms; 13 vùng dựng trên luồng chính | 9 lần (4 lần quá 80 ms), dài nhất 233 ms, tổng 1058 ms; 4 vùng |
| Ván mới, bấm chơi 8 giây sau khi mở trang, đứng 150 giây | 9 lần (6 lần quá 80 ms), dài nhất 316 ms, tổng 1378 ms; 12 vùng | 7 lần (3 lần quá 80 ms), dài nhất 228 ms, tổng 756 ms; 3 vùng |
| Ván QA `fresh`, vào chơi 2 giây sau khi mở trang, đứng 60 giây | 5 lần (cả 5 quá 80 ms), dài nhất 280 ms, tổng 916 ms; 9 vùng | 3 lần (2 lần quá 80 ms), dài nhất 284 ms, tổng 524 ms; 5 vùng |
| Ván mới, bấm chơi khoảng nửa phút sau khi mở trang (trước: 32 giây, sau: 27 giây) | Đứng 30 giây: 1 lần 168 ms; 6 vùng | Đứng 240 giây: không lần nào quá 50 ms, khoảng cách dài nhất giữa hai khung hình là 33 ms; 1 vùng, dựng lúc tạo ván |

Thời gian mỗi khung hình ở mức giữa là 16,7 ms cả trước và sau.

Đọc bảng:

- Ở lượt bấm chơi 27 giây sau khi mở trang, luồng nền đã dựng xong cả 288 vùng. Lượt này không có lần khựng nào trong 4 phút.
- Bấm chơi 8 giây sau khi mở trang thì 6 giây đầu vẫn khựng 2 lần, mỗi lần 0,15–0,23 giây, như trước: lúc bấm, luồng nền mới dựng được 95–106 vùng. Sau 30 giây đầu còn 1–2 lần khựng quá 80 ms mỗi lượt; ở lượt 150 giây trước khi sửa là 3 lần.
- Còn lại ba nguồn chưa xử lý: vùng mà cư dân hỏi khi đứng cách hơn 24 ô (0–2 lần trong 3–4 phút); vùng quanh chỗ người chơi xuất hiện, vì chỗ đó chỉ biết sau khi ván đã tạo; và vùng đã nhường chỗ rồi lại bị hỏi (1 lần ở lượt 150 giây).

### Cái giá

- Bộ nhớ: lúc mới vào ván có khoảng 820–870 tầng dựng sẵn nằm chờ, trước là 470–540. Mỗi tầng khoảng 0,1 MB (đo trên 8 vùng: 0,099 MB), tức nhiều hơn khoảng 30–35 MB lúc cao nhất. Mức trần của chỗ chứa cộng bộ nhớ đệm tăng từ khoảng 77 MB lên khoảng 96 MB.
- Ở màn hình tiêu đề, luồng nền chạy lâu hơn trên một nhân vì phải dựng 288 vùng thay cho 121. Trên máy kiểm, nó xong trước giây thứ 27 sau khi mở trang; chưa đo chính xác hơn.

### Đã kiểm

| Kiểm | Kết quả |
|---|---|
| `tests/region-prebuild.test.ts` | 11 đạt (5 bài mới: mức 24 ô, danh sách ở màn hình tiêu đề, ba bài về nhường chỗ) |
| `npx tsc -p .` và `npm run typecheck:tests` | Không lỗi |
| Trình duyệt, bản dựng QA không nén | 8 lượt đo ở bảng trên, không lỗi console |
| Trình duyệt, bản dựng QA nén như bản phát hành | Bấm chơi 27 giây sau khi mở trang, đứng 60 giây: không lần nào quá 50 ms, không vùng nào dựng trên luồng chính, không lỗi console |

ZIP đóng lại từ bản dựng này: 64.448.524 byte, SHA256 `4c25cd5adc8101e654a4cb483a7fce71808cef2dffa788fbc3a33229c3181a64`.

### Chưa kiểm ở vòng này

- Mọi lượt đo đều đứng yên, dài nhất 4 phút. Chưa đo lúc đi bộ, lúc đánh nhau, hay chơi lâu hàng giờ.
- Chưa đo ván chơi tiếp từ bản lưu (Continue). Phần này dùng chung danh sách với ván đang chạy nên cũng được mức 24 ô, nhưng chưa có số đo.
- Chưa thử trên máy thật hay điện thoại. Phần bộ nhớ tăng thêm chưa được thử trên máy ít bộ nhớ. Bộ nhớ riêng của luồng nền chưa đo.
- Mỗi tình huống chỉ đo một lượt trước và một lượt sau, nên con số ở các dòng "8 giây" chỉ cho biết chiều hướng.
- Bộ kiểm thử đầy đủ và các tệp chậm không chạy lại; vòng này chỉ sửa bốn tệp `web/src/veyra05/region-*.ts`.

## Vòng 8: màn chờ "Khi bạn vắng mặt" lúc bấm Chơi tiếp (nhánh `arena/d6096eae-soul-of-hero`)

Người chơi báo: bấm Chơi tiếp thì màn "KHI BẠN VẮNG MẶT" đứng ở 0% rất lâu, chữ lẫn tiếng Anh với tiếng Việt. Luồng Chơi tiếp chưa từng được đo ở vòng 6 và vòng 7 (khi đó chỉ ghi ở mục "chưa kiểm").

### Nguyên nhân (đã đo)

1. Phần tính thời gian vắng mặt chạy ở một luồng riêng. Luồng này bắt đầu mà chưa dựng vùng đất nào, nên phải tự dựng khoảng 180–200 vùng trước khi qua được 1–2%. Trong lúc đó màn hình chỉ có số 0%.
2. Phần còn lại là mô phỏng 286 cư dân theo từng phút vắng mặt. Phần này dài theo số giờ vắng (khoảng 8–10 giây cho mỗi giờ vắng trên máy kiểm).
3. Ở vòng 7, lúc mở trang game dựng sẵn 288 vùng (trước là 121), xong trước giây 27. Trên máy 2 nhân, nếu bấm Chơi tiếp trong khoảng đó thì hai việc tranh nhau bộ xử lý: bản cũ chờ 57–60 giây khi bấm sau 5 giây, 42 giây khi bấm sau 30 giây. Chưa đo lại bản trước vòng 7 nên chưa khẳng định được vòng 7 làm chậm bao nhiêu.
4. Bốn chuỗi trên màn chờ chưa có trong sổ dịch. Số phần trăm và nút nằm dính nhau ("0%Back to title").

### Đã sửa

- Những vùng màn hình chính đã dựng sẵn được chép sang cho luồng tính thời gian vắng mặt. Vùng nào chưa có thì luồng đó tự dựng như cũ.
- Trên máy 2 nhân, việc dựng sẵn tạm dừng trong lúc chờ và chạy tiếp đúng chỗ cũ khi chờ xong.
- Màn chờ ghi rõ: đã vắng bao lâu, đang làm gì, đã tính bao nhiêu phần trăm, đã dựng bao nhiêu vùng đất, đã chạy bao lâu. Số vùng và đồng hồ nhích ngay từ giây đầu.
- Toàn bộ chữ trên màn chờ có tiếng Việt, kể cả câu báo lỗi "Chưa chơi tiếp được…". Nút nằm riêng một dòng.
- Thêm tiếng Việt cho 4 chuỗi gặp trong nhật ký trở về và màn tỉnh lại: "exposure while offline", "your bag", "Recovering breath…", "Safe Landing Site".

### Số đo (Chromium không màn hình, máy kiểm 2 nhân, tiếng Việt; mỗi dòng là một lượt chạy)

| Vắng | Bấm Chơi tiếp sau khi mở trang | Trước: vào được game sau | Sau: vào được game sau | Trước: số % đầu tiên | Sau: số % đầu tiên |
|---|---|---|---|---|---|
| 3 giờ | 5 giây | 56,7 s; 59,5 s | 47,7 s; 54,1 s | 14,2 s; 16,3 s | 9,3 s; 8,2 s |
| 3 giờ | 30 giây | 42,0 s | 39,1 s | 10,2 s | 3,8 s |
| 8 giờ | 5 giây | chưa đo trên trình duyệt | 80,8 s | chưa đo | 15,3 s |

Ở bản sau, số vùng đất trên màn chờ đã là 68–106 ở giây thứ 8 trong mọi lượt.

**Kết luận thẳng:** thời gian chờ chỉ ngắn đi khoảng 3–10 giây. Phần lớn thời gian chờ (mô phỏng cư dân) chưa được làm nhanh hơn. Cái đổi rõ là màn chờ không còn im ở 0% và không còn tiếng Anh.

### Kết quả tính có đổi không

Không. Bài kiểm `tests/continue-wait.test.ts` chạy cùng một bản lưu hai lần, một lần tự dựng mọi vùng, một lần nhận 60 vùng dựng sẵn: bản lưu trả về giống nhau từng byte, số vùng yêu cầu bằng nhau.

### Kiểm thử

- `tests/continue-wait.test.ts`: 3 bài (kết quả giống nhau từng byte và có báo tiến độ trước 1%; bản lưu hỏng thì báo lỗi; mọi dòng trên màn chờ có tiếng Việt).
- `tests/region-prebuild.test.ts`: 15 bài (thêm 4: tạm dừng trên máy 2 nhân, không tạm dừng khi nhiều nhân hơn, vùng cho mượn vẫn còn trong kho, luồng dựng sẵn dừng và chạy tiếp đúng danh sách).
- `tests/i18n-vi.test.ts`: 7 bài. `tsc` và `typecheck:tests`: không lỗi.

### Ảnh

- `shots/r8-continue-before.png`: bản cũ, 1%, hai dòng tiếng Anh, nút dính vào số phần trăm.
- `shots/r8-continue-after.png`: bản mới, vắng 8 giờ, giây thứ 8: "Đã tính 0% thời gian vắng mặt · đã dựng 106 vùng đất · đã chạy 0:08", nút ở dòng riêng.

### Chưa làm, chưa kiểm ở vòng này

- Chưa làm nhanh phần mô phỏng cư dân, là phần chiếm nhiều thời gian chờ nhất. Vắng 8 giờ vẫn chờ khoảng 80 giây trên máy kiểm; vắng lâu hơn chưa đo. (Vòng 9 làm tiếp phần này.)
- Chưa đo trên máy thật, điện thoại, máy nhiều nhân. Chưa đo bản lưu của ván đã chơi lâu (chỉ đo ván mới chơi 15 giây).
- Chưa đo game có khựng trong mấy giây đầu sau khi Chơi tiếp hay không.
- Trong lượt thử, nhân vật của ván mới chết sau 1 giờ 21 phút vắng mặt vì không có chỗ trú. Đây là luật game sẵn có, không đụng tới.
- Không chạy lại `tests/b03-return.test.ts` và toàn bộ bộ kiểm thử; `sim.ts` và `return-report.ts` không đổi.
- Thanh tiến độ vẫn là thanh mặc định của trình duyệt (xám, xanh lá), chưa vẽ theo kiểu của game.

## Vòng 9: làm nhanh phần mô phỏng cư dân lúc vắng mặt (nhánh `arena/d6096eae-soul-of-hero`)

Mục tiêu: rút ngắn phần chiếm nhiều thời gian nhất của màn chờ, với điều kiện kết quả tính không đổi một byte nào.

### Đã sửa (`web/src/game/humanworld.ts`)

1. Bỏ một phép tính không ai dùng. Mỗi lượt cư dân lập kế hoạch, game dựng một danh sách ô "được bảo vệ" từ mọi vật trong ván (bản lưu thử có 17 vật gần và 734 vật ở xa) rồi truyền cho hàm lập kế hoạch, nhưng hàm đó không đọc danh sách này ở đâu cả. Phép tính này chiếm khoảng 7% thời gian mô phỏng.
2. Câu hỏi "cư dân này còn hàng chưa giao không" được hỏi cho mọi cư dân ở mọi bước; trước đây mỗi lần hỏi phải tạo một mảng tạm, nay duyệt thẳng. Câu trả lời giống hệt.

### Kết quả tính có đổi không

Không. Bốn bản lưu được tính lại bằng mã trước và mã sau, rồi so dấu vân tay (SHA-256, 16 ký tự đầu) của bản lưu trả về và của nhật ký trở về:

| Bản lưu (hạt giống) | Vắng | Bản lưu trước = sau | Nhật ký trước = sau |
|---|---|---|---|
| 5 | 3 giờ | `259149f1cd94aad1` | `6064377c292bb6fe` |
| 11 | 1 giờ | `7eaf253ca1f2d63e` | `ff6782b68c09260c` |
| 23 | 2 giờ | `fea89333fa4471c7` | `d32bfe7ecc8fac70` |
| 5 | 8 giờ | `ac0fe1f3a5c57408` | `c5c63ff36fff16fb` |

Cả bốn đều là ván mới chơi 20 giây. Chưa có bản lưu của ván chơi lâu để so.

### Số đo

Riêng phần mô phỏng (chạy bằng Node trên máy kiểm, vùng đất đã dựng sẵn; mỗi số là một lượt chạy):

| Bản lưu | Vắng | Trước | Sau |
|---|---|---|---|
| hạt giống 5 | 3 giờ | 37,5 s; 38,1 s | 32,1 s; 32,4 s |
| hạt giống 5 | 8 giờ | 86,2 s | 73,6 s |
| hạt giống 23 | 2 giờ | 31,4 s | 28,7 s |
| hạt giống 11 | 1 giờ | 22,7 s | 20,8 s |

Tức là nhanh hơn khoảng 8–15%, không phải gấp đôi.

Cả màn chờ trên trình duyệt (Chromium không màn hình, 2 nhân, cùng bản lưu hạt giống 5, bấm Chơi tiếp 30 giây sau khi mở trang; "trước" là bản vòng 8):

| Vắng | Trước: vào game sau | Sau: vào game sau |
|---|---|---|
| 3 giờ | 52,6 s; 54,4 s | 48,8 s; 45,7 s |
| 8 giờ | 95,3 s | 86,2 s |

Các số này không so được với bảng vòng 8: bản lưu khác và máy kiểm đã được khởi động lại.

Vắng 24 giờ: riêng phần mô phỏng mất 231 giây (đo trong lúc máy còn chạy kiểm thử song song, nên số thật thấp hơn một ít). Tức là vắng một ngày thì vẫn chờ vài phút.

### Vì sao không nhanh hơn được nhiều mà vẫn giữ nguyên kết quả

- Ba giờ vắng mặt là khoảng 15.000 bước tính. Mỗi bước, game đi qua cả 286 cư dân: trừ đói, khát, ấm, xét chỗ trú, xét việc đang làm.
- Sau khi bỏ phép tính thừa ở trên, không còn chỗ nào chiếm riêng một phần lớn: dòng mã tốn nhất chỉ chiếm 2,6% thời gian. Phần còn lại rải ra nhiều vòng duyệt 286 cư dân, lặp lại ở mỗi bước. Sửa tiếp từng chỗ như vậy ước chừng được thêm 1–2% mỗi chỗ; vòng này chưa làm.
- Muốn nhanh hơn hẳn thì phải giảm số bước hoặc bỏ qua cư dân đang đứng yên. Cả hai cách đều làm kết quả tính khác đi, nên không làm khi chưa có quyết định của chủ game.
- Đã thử để biết, không giữ lại: khi người chơi vắng, nhịp tính của cư dân là 5 giây thay vì 1 giây. Mô phỏng 3 giờ còn 17,8 giây (trước 37,5), số bước giảm từ 15.137 xuống 6.459, nhưng bản lưu trả về khác bản hiện nay. Chưa xem khác ở những điểm nào. Nhịp 1 giây là quyết định của chủ game ngày 21/11/2026, nên đây là việc chủ game quyết.

### Kiểm thử

- 13 tệp `tests/npc-*.test.ts` có liên quan (thu hoạch, giao hàng, nhịp vắng mặt, nhu cầu): 12 tệp qua, 64 bài qua; 1 tệp và 2 bài vốn được đánh dấu bỏ qua từ trước.
- `tests/continue-wait.test.ts`, `tests/b03-return.test.ts`, `tests/region-prebuild.test.ts`: 27 bài qua.
- `tsc` và `typecheck:tests`: không lỗi.

### Chưa làm, chưa kiểm ở vòng này

- Không chạy lại toàn bộ bộ kiểm thử (269 tệp trong `tests/`); chỉ chạy 16 tệp nêu trên.
- Phép so dấu vân tay ở trên làm bằng công cụ tạm, không nằm trong kho mã và chưa thành bài kiểm thử cố định.
- Chưa so kết quả trên bản lưu của ván đã chơi lâu, có công trình của người chơi.
- Chưa đo trên máy thật hay điện thoại. Chưa mở trang QA sau khi triển khai.

## Vòng 10: làm nhanh tiếp phần mô phỏng cư dân, kết quả tính vẫn không đổi (nhánh `arena/d6096eae-soul-of-hero`)

Vòng 9 viết rằng không còn chỗ nào chiếm riêng một phần lớn và sửa tiếp chỉ được 1–2% mỗi chỗ. Nhận định đó sai. Đo kỹ hơn thì thấy hai chỗ tốn lớn không nằm ở một dòng mã nào mà ở cách trình duyệt đọc dữ liệu cư dân.

### Đã sửa (`web/src/game/humanworld.ts`, `web/src/game/sim.ts`)

1. **Dùng chung một danh sách cư dân trong mỗi lượt tính.** Mỗi bước, ba nơi (trừ nhu cầu, tìm mốc thời gian kế tiếp, bước hành động) đều hỏi lại "danh sách toàn bộ cư dân", và mỗi lần hỏi trình duyệt phải dựng lại rồi sắp xếp lại 286 tên. Nay một lượt tính dựng danh sách một lần và dùng chung. Danh sách luôn đúng: cư dân chỉ được thêm ở một nơi duy nhất (nơi đó báo cho danh sách dựng lại), và không nơi nào xoá cư dân.
2. **Chuẩn bị hồ sơ cư dân một lần trước khi tính bù.** Cư dân đọc từ bản lưu có hàng chục kiểu sắp xếp trường khác nhau (26 kiểu lúc nạp, 75–87 kiểu sau khi tính); với nhiều kiểu như vậy, mỗi lần đọc một trường của cư dân, trình duyệt phải đi đường chậm. Trước khi tính bù, game đưa mọi hồ sơ về cùng một cách lưu trong bộ nhớ. Không trường nào bị thêm, bớt, đổi giá trị hay đổi thứ tự; bản lưu ghi ra giống hệt.
3. Trong hai vòng duyệt cư dân nóng nhất, các trường dùng nhiều lần được đọc một lần; cư dân đang đứng yên, không có việc và chưa đói khát được bỏ qua sớm, đúng như các điều kiện phía sau vốn đã bỏ qua họ. Mức lợi của mục này nhỏ (khoảng 1 giây trên 25 giây trong một đợt đo, chưa đo lặp lại xen kẽ).

Đã thử và bỏ, vì không nhanh hơn ngoài mức dao động của máy kiểm: bảng nhớ chỗ trú dùng khoá số (thử hai lần); tách hàm đo thời gian. Đã thử và bỏ vì làm bản lưu khác đi: đưa mọi hồ sơ về cùng một thứ tự trường.

### Kết quả tính có đổi không

Không. Bốn bản lưu của vòng 9 được tính lại bằng mã mới; dấu vân tay của bản lưu trả về và của nhật ký trở về trùng với mã gốc ở cả bốn:

| Bản lưu (hạt giống) | Vắng | Bản lưu | Nhật ký |
|---|---|---|---|
| 5 | 3 giờ | `259149f1cd94aad1` | `6064377c292bb6fe` |
| 11 | 1 giờ | `7eaf253ca1f2d63e` | `ff6782b68c09260c` |
| 23 | 2 giờ | `fea89333fa4471c7` | `d32bfe7ecc8fac70` |
| 5 | 8 giờ | `ac0fe1f3a5c57408` | `c5c63ff36fff16fb` |

Cả bốn vẫn là ván mới chơi 20 giây.

Thêm một tệp kiểm thử cố định, `web/tests/resident-catchup-speed.test.ts` (3 bài): chuẩn bị hồ sơ không đổi trường, giá trị hay thứ tự trường; cùng một thế giới chạy 60 bước có và không có từng thay đổi cho ra cùng một bản lưu; danh sách dùng chung không bao giờ thiếu cư dân vừa được thêm. Đã thử gỡ dòng báo "có cư dân mới" khỏi mã: bài thứ ba báo hỏng, tức là bài này bắt được lỗi đó.

### Số đo

Riêng phần mô phỏng (Node trên máy kiểm, vùng đất đã dựng sẵn; mỗi số là một lượt chạy):

| Bản lưu | Vắng | Trước vòng 9 | Sau vòng 9 | Sau vòng 10 |
|---|---|---|---|---|
| hạt giống 5 | 3 giờ | 37,5 s; 38,1 s | 32,1 s; 32,4 s | 24,4 s; 25,4 s |
| hạt giống 5 | 8 giờ | 86,2 s | 73,6 s | 57,2 s |
| hạt giống 23 | 2 giờ | 31,4 s | 28,7 s | 22,7 s |
| hạt giống 11 | 1 giờ | 22,7 s | 20,8 s | 16,0 s |

So với vòng 9: ngắn hơn 21–24%. So với trước vòng 9: ngắn hơn 28–35%. Vẫn chưa phải một nửa.

Cả màn chờ trên trình duyệt (Chromium không màn hình, 2 nhân, bản lưu hạt giống 5, bấm Chơi tiếp 30 giây sau khi mở trang; "trước" là bản vòng 9, đo lại trong cùng buổi):

| Vắng | Trước: vào game sau | Sau: vào game sau |
|---|---|---|
| 3 giờ | 48,9 s; 47,7 s; 43,3 s; 48,6 s | 44,3 s; 42,7 s; 42,7 s; 42,8 s; 42,8 s |
| 3 giờ, bấm sau 60 giây | 45,8 s | 40,3 s |
| 8 giờ | 83,9 s | 67,6 s |

Ở mức 3 giờ, màn chờ chỉ ngắn hơn khoảng 5 giây dù phần tính ngắn hơn khoảng 8 giây (thanh tiến độ tới 99% sau 38,7–44,0 giây ở bản trước, 34,8–36,0 giây ở bản sau). Đoạn từ 99% đến lúc vào game dài hơn ở bản sau: 6,8–8 giây so với 4,6–5,7 giây. Chưa tìm ra nguyên nhân. Điều đã biết về đoạn này:

- Trong đoạn này luồng chính vẽ hình cây, đá, công trình lần đầu và đọc điểm ảnh ngược lại từ bộ phận vẽ. Trên máy kiểm, bộ phận vẽ là phần mềm (không có card đồ hoạ) và chiếm trọn một nhân trong suốt màn chờ; việc đọc ngược phải đợi nó.
- Với lần vắng ngắn (12 phút, bấm sau 20 giây), cả hai bản đều mất 37–45 giây mới vào game, trong đó luồng chính đứng đợi việc đọc ngược này 14–19 giây. Đây không phải thời gian tính cư dân.
- Đã thử bắt các hình này vẽ bằng bộ nhớ thường: lần vắng 12 phút còn 21–24 giây. **Không giữ lại**, vì trên máy kiểm 23 trong 829 hình ra điểm ảnh khác (10 hình khác rõ ở viền, 13 hình lệch một đến ba mức màu), và chưa biết trên máy có card đồ hoạ thì lợi bao nhiêu. Đã thử giữ luồng dựng đất nghỉ thêm cho tới khi vẽ xong khung hình đầu: không ngắn hơn, không giữ lại.
- Vì vậy các số trình duyệt ở trên chịu ảnh hưởng của việc máy kiểm vẽ bằng phần mềm. Trên máy thật con số có thể khác, theo cả hai chiều; chưa đo.

### Kiểm thử

- `tsc` và `typecheck:tests`: không lỗi.
- 13 tệp `tests/npc-*.test.ts` có liên quan, 3 tệp của màn Chơi tiếp và tệp mới: 16 tệp qua, 94 bài qua; 1 tệp và 2 bài vốn được đánh dấu bỏ qua từ trước.

### Chưa làm, chưa kiểm ở vòng này

- Không chạy lại toàn bộ bộ kiểm thử; chỉ chạy 17 tệp nêu trên.
- Bốn phép so dấu vân tay vẫn làm bằng công cụ tạm ngoài kho mã. Bài kiểm thử cố định mới chỉ so 60 bước trên một ván mới.
- Chưa so trên bản lưu của ván đã chơi lâu, có công trình của người chơi. Chưa đo lần vắng trên 24 giờ.
- Mục 2 dựa vào cách V8 (Chrome, Edge, Node) lưu đối tượng. Trên Firefox và Safari kết quả tính vẫn y nguyên, nhưng chưa đo ở đó và có thể không nhanh hơn nhờ mục này.
- Chưa đo trên máy thật hay điện thoại. Chưa mở trang QA sau khi triển khai.
- Chưa xử lý đoạn 5–8 giây sau khi tính xong và đoạn dựng đất ở đầu màn chờ (khoảng 18 giây cho 20% đầu ở mức vắng 3 giờ).

## Vòng 11: giữ lại phần đất đã dựng giữa các lần mở game; so cách tính thưa với cách tính hiện nay (nhánh `arena/1fe1361c-soul-of-hero`)

Sau khi gộp vòng 10, người làm game thử trên máy tính thật: vắng hơn một giờ, bấm Chơi tiếp, sau 30 giây thanh mới ở 6%. Mức trần đặt ra là 30 giây cho cả đoạn từ lúc bấm đến lúc vào game. Vòng này làm một việc không đổi luật và đo một việc cần người làm game quyết định.

### Đã sửa: phần đất đã dựng được giữ lại cho lần mở game sau

Mỗi lần Chơi tiếp, cư dân hỏi về khoảng 180 vùng đất ngay trong những phút đầu được tính, và mỗi vùng phải dựng lại từ đầu (0,1–0,3 giây một vùng). Trên máy kiểm đoạn này chiếm khoảng 18–25 giây, bất kể vắng bao lâu. Một vùng đất chỉ phụ thuộc vào bản đồ và mã của game, không phụ thuộc vào ván chơi, nên dựng một lần là đủ.

- `web/src/veyra05/region-store.ts` (mới): kho giữ các vùng đã dựng trong bộ nhớ lưu trữ của trình duyệt (IndexedDB, kho `soh.regions.v1`).
- `web/src/veyra05/region-prebuild.worker.ts`: luồng dựng đất chạy nền hỏi kho trước; có thì lấy ra, chưa có thì dựng rồi cất vào kho.
- `web/src/game/offline-return-worker.ts`, `web/src/App.tsx`, `web/src/veyra05/region-prebuild.ts`: luồng tính bù lúc Chơi tiếp đọc từ kho những vùng nó cần mà màn hình chính chưa kịp đưa sang. Luồng này chỉ đọc kho, không ghi.

Kho chỉ dùng được cho đúng bản mã đã tạo ra nó. Tên của kho lấy từ tên tệp của luồng dựng đất trong bản dựng (`region-prebuild.worker-<mã>.js`); tên tệp này đổi khi và chỉ khi phần mã dựng đất đổi. Bản cập nhật chỉ sửa giao diện hay phần mô phỏng cư dân thì kho vẫn dùng được (đã thử: sửa luồng tính bù, tên tệp luồng dựng đất giữ nguyên). Bản cập nhật có sửa phần dựng đất thì kho tự xoá và lần Chơi tiếp đầu tiên sau đó chậm như trước. Mỗi vùng trong kho còn được ghi kèm tên bản mã, để hai thẻ trình duyệt chạy hai bản khác nhau không lấy nhầm đất của nhau.

Mọi trục trặc của bộ nhớ lưu trữ (trình duyệt không cho dùng, hết chỗ, đọc lỗi, bản ghi hỏng) chỉ dẫn đến "không có sẵn": vùng đó được dựng lại như trước.

**Kết quả tính không đổi.** Trong trình duyệt, cùng một bản lưu và cùng một thời điểm, bản lưu sau khi tính bù có cùng dấu vân tay (`e5d7124cd89c5e3e`) ở cả ba trường hợp: dựng toàn bộ tại chỗ (0 vùng có sẵn), 173 vùng do màn hình chính đưa sang, và 118 vùng đọc từ kho.

### Đo trong trình duyệt

Máy kiểm: 2 nhân, Chromium không màn hình, vẽ bằng phần mềm. Bản lưu: ván mới, hạt giống 5, 286 cư dân, đã chơi 20 giây. Bấm Chơi tiếp 3 giây sau khi màn hình chính hiện. Số đo là từ lúc bấm đến lúc vào game.

| Vắng | Trước (bản `cb28d27`) | Sau, lần đầu (kho rỗng) | Sau, các lần kế (kho đã có đất) |
|---|---|---|---|
| 0,3 giờ | 38,0 và 39,6 giây | chưa đo | 18,2 và 18,3 giây |
| 1,5 giờ | 49,6 – 50,1 giây (3 lượt) | 45,2 – 55,3 giây (5 lượt, 4 lượt trong khoảng 45–48) | 25,6 – 32,1 giây (8 lượt) |
| 3 giờ | 51,3 và 58,5 giây | chưa đo | 41,7 và 43,3 giây |

- Lần đầu không nhanh hơn: kho rỗng, đất vẫn phải dựng.
- Kho đầy dần: luồng dựng đất chạy trong lúc màn hình chính đang hiện và trong lúc chơi. Trên máy 2 nhân nó dừng trong lúc tính bù, nên sau một lần Chơi tiếp bấm sớm kho mới có khoảng 50 vùng, sau hai lần khoảng 90, sau ba lần khoảng 130. Để màn hình chính hiện 45–60 giây thì kho có đủ khoảng 275 vùng.
- Ở lượt mà kho đang được làm đầy (đợi 45–60 giây ở màn hình chính rồi mới bấm): 37,6 – 39,6 giây (4 lượt).
- Đọc 115 vùng từ kho mất 0,14 giây.
- Với kho đầy, ở mức vắng 1,5 giờ: khoảng 4–6 giây đến 1%, khoảng 19–25 giây tính phần còn lại, 2–5 giây từ 99% đến lúc vào game. Phần còn lại gần như toàn bộ là mô phỏng cư dân, khoảng 11–13 giây cho mỗi giờ vắng trên máy kiểm.

Kho chiếm chỗ: mỗi vùng khoảng 0,34 MB, một ván cần khoảng 280 vùng, tức gần 100 MB bộ nhớ lưu trữ của trình duyệt trên máy người chơi. Kho tự xoá khi vượt 600 vùng. Nén thử bằng gzip thì còn khoảng 1/12 (0,029 MB một vùng); chưa làm.

### So cách tính thưa với cách tính hiện nay (chỉ đo, chưa đưa vào game)

Hiện nay trong lúc vắng mặt, cứ mỗi giây được tính game cho một cư dân ở xa nghĩ xem nên làm gì. 15 giờ vắng là 54.000 lượt như vậy và 62.136 bước tính. Thử nghiệm: giãn khoảng cách giữa hai lượt nghĩ, và mỗi lượt cho nhiều cư dân nghĩ hơn để tổng số lần nghĩ không đổi. Đo bằng công cụ `web/scripts/absence-bench/` (Node, cùng bản lưu, kho đất có sẵn, mỗi dòng một hoặc hai lượt).

Vắng 15 giờ:

| Cách tính | Thời gian | Chết | Gục | Cư dân ở chỗ khác so với cách hiện nay | Tổng hàng trong kho | `berries` trong kho | `crop` trong kho |
|---|---|---|---|---|---|---|---|
| Hiện nay (1 giây, 1 người mỗi lượt) | 148,5 – 152,2 giây | 36 | 10 | – | 3.770 | 185 | 0 |
| Phép thử độ nhạy: 1,001 giây | 172,0 giây | 33 | 12 | 102 | 3.808 | 195 | 0 |
| 15 giây, 15 người mỗi lượt | 42,5 – 46,9 giây | 27 | 8 | 134 | 3.727 | 122 | 33 |
| 60 giây, 60 người mỗi lượt | 37,0 – 38,9 giây | 34 | 8 | 135 | 3.767 | 116 | 46 |
| 60 giây, 8 người mỗi lượt | 25,3 giây | 28 | 12 | 168 | chưa đo | chưa đo | chưa đo |
| 60 giây, 1 người mỗi lượt | 21,4 giây | 43 | 5 | 209 | chưa đo | chưa đo | chưa đo |

Vắng 1,5 giờ: hiện nay 22,2 – 23,8 giây; 5 giây và 5 người mỗi lượt 16,6 – 17,5 giây (83 cư dân ở chỗ khác, tổng hàng 3.230 → 3.213, `crop` 0 → 9); phép thử độ nhạy 25,3 giây (49 cư dân ở chỗ khác, tổng hàng 3.230 → 3.179).

Đọc bảng:

1. **Số phận từng cư dân vốn đã không ổn định.** Chỉ đổi bước tính từ 1 giây thành 1,001 giây, sau 15 giờ đã có 102 cư dân đứng ở chỗ khác, số chết 33 thay vì 36. Vậy không thể đòi cách tính thưa cho đúng từng người; chỉ so được các con số tổng.
2. Với cách "giãn khoảng nghĩ, giữ nguyên số lần nghĩ" (15 hoặc 60 giây), số chết (27, 34), số gục và tổng hàng nằm cùng cỡ với mức dao động ở dòng độ nhạy. Có hai chỗ lệch rõ, lặp lại ở cả hai mức thử 15 giờ: `berries` trong kho ít hơn (185 → 116–122) và có `crop` trong kho (0 → 33–46; ở mức 1,5 giờ cũng đã thấy 0 → 9). Dòng độ nhạy không có hai chỗ lệch này. Chưa tìm nguyên nhân.
3. Cách "nghĩ ít lần hơn" (60 giây, 1 người mỗi lượt) nhanh nhất nhưng làm cư dân sống tệ hơn rõ: 43 chết thay vì 36, chỉ số no trung bình 33 thay vì 44 (cao là no). Không nên dùng.
4. Cách tính thưa giúp nhiều cho lần vắng dài (15 giờ: nhanh gấp 3–4 lần) và ít cho lần vắng ngắn (1,5 giờ: nhanh hơn khoảng 25%).
5. Ngoài lề: ở mọi cách tính, 27–43 trong 286 cư dân chết sau 15 giờ vắng và 20–25 người gục sau 1,5 giờ. Đây là kết quả của luật hiện có, không phải của vòng này.

Chưa đổi gì trong luật: nhịp tính lúc vắng mặt vẫn là 1 giây (`OFFLINE_HUMAN_BEAT_MS`), theo quyết định ngày 21/11/2026. Mã thử nghiệm đã gỡ khỏi kho mã.

### Công cụ đo đưa vào kho mã

`web/scripts/absence-bench/`: `scn.ts` (tính bù một lần vắng đúng như luồng Chơi tiếp, in thời gian, số bước và dấu vân tay; có chế độ ghi bảng thống kê cư dân và kho hàng), `build.sh` (dựng công cụ từ mã hiện tại), `census-diff.mjs` (so hai bảng thống kê). Vòng 9 và 10 dùng công cụ tạm ngoài kho mã và đã mất; từ nay phép so dấu vân tay làm lại được.

### Kiểm thử

- Mới: `web/tests/region-store.test.ts`, 11 bài. Vùng lấy từ kho giống hệt vùng đã cất, kể cả sau khi bản gốc đã chuyển sang luồng khác; bản mã khác không dùng được kho cũ; hai thẻ chạy hai bản mã không lấy nhầm của nhau; không có tên bản mã thì không giữ gì; mọi kiểu lỗi lưu trữ đều thành "không có sẵn"; bản ghi hỏng hay sai vùng không bao giờ được trả ra; luồng dựng đất trả lời từ kho mà không dựng lại; luồng tính bù nhận thêm vùng từ kho. IndexedDB trong bài kiểm thử do gói `fake-indexeddb` (mới thêm, chỉ dùng khi kiểm thử) đóng vai.
- Chạy lại 5 tệp: `region-store`, `region-prebuild`, `continue-wait`, `resident-catchup-speed`, `npc-offline-beat`: 34 bài đạt. (Lượt chạy này có trước khi thêm bài "hai thẻ" và việc ghi tên bản mã vào từng bản ghi; sau thay đổi đó chạy lại `region-store` và `region-prebuild`: 26 bài đạt.)
- `tsc` và `typecheck:tests`: không lỗi.

### Chưa làm, chưa kiểm ở vòng này

- **Chưa biết vì sao máy của người làm game mới được 6% sau 30 giây.** Trên máy kiểm, bản cũ ở cùng mức vắng đạt khoảng 20–25% sau 30 giây. Chưa có bản lưu thật hay số đo từ máy đó, nên chưa biết kho đất giúp được bao nhiêu ở đó.
- Trần 30 giây chưa đạt cho lần vắng dài: trên máy kiểm 3 giờ vẫn mất khoảng 42 giây, lần đầu sau khi kho bị xoá mất 45–55 giây ở mức 1,5 giờ.
- Chưa đo trên máy thật, điện thoại, Firefox, Safari. Chưa thử trình duyệt ở chế độ riêng tư hay khi bộ nhớ lưu trữ đầy (chỉ có bài kiểm thử tự động cho các trường hợp đó).
- Chưa nén kho (gần 100 MB mỗi người chơi).
- Luồng tính bù không ghi vào kho; vùng nào chỉ nó dựng thì phải đợi luồng dựng đất dựng lại trong lúc chơi mới vào kho.
- Bảng so cách tính thưa chỉ làm trên một bản lưu (ván mới, hạt giống 5), mỗi dòng một hoặc hai lượt; chưa thử bản lưu của ván đã chơi lâu.
- Không chạy lại toàn bộ bộ kiểm thử; chỉ chạy 5 tệp nêu trên.
- Chưa xử lý đoạn 2–8 giây từ 99% đến lúc vào game.

## Chưa làm, chưa kiểm

- Chưa thử trên điện thoại thật, Firefox, Safari. Máy kiểm chỉ có Chromium không màn hình và không truy cập được địa chỉ chơi thật.
- Trên máy cảm ứng, các thẻ gợi ý và sổ tay vẫn nhắc tên phím (E, B, I, Q…). Mới đổi được chuột trái, Space, WASD ở dòng bước đang theo dõi.
- Cột phải của bảng trạm vẫn phải cuộn mới thấy khối thành phẩm; đã có thanh báo nhưng chưa bố trí lại.
- Nút chọn số giờ nghỉ ghi "1 h / 8 h / 24 h" ở cả hai ngôn ngữ.
- Tên vùng và địa danh giữ tiếng Anh.
- Chú thích khi rê chuột (`title`) không hiện trong ảnh chụp nên chỉ được kiểm bằng cách đọc chữ.
- **HUD ban đêm và màn tử trận chưa được xem trong vòng 3.** Mọi lượt chạy trình duyệt đều nằm trong khoảng 07:30–09:11 giờ game. (Bản báo cáo gộp ở PR #67 ghi nhầm là đã xem; dòng này sửa lại.)
- Ở cửa sổ rất nhỏ (640 × 360, 844 × 390) thông báo "Cửa sổ nhỏ" của game nằm đè lên thanh xây; chưa xử lý.
- Khi chọn Nâng cấp / Sửa / Tháo, thẻ "Nền" vẫn sáng vì hàng ô đang hiện trang Nền.
- Còn tiếng Anh, đã biết: ở thương nhân "Parts: {n}", "{n} Parts", "Put in pack", tiêu đề Parcel; "Ragnarok chest"; trạng thái tháp canh ("No generator", "Connection blocked", "No power", "No arrows", "Capacity allocated elsewhere"); "Open relevant action for Hunger & Thirst"; lời nhắc "Chop", "Mine"; chú thích loại lò sưởi. Danh sách câu thiếu do công cụ ghi lại ở bảng nghỉ (16 câu) và nhật ký trở về (22 câu) chưa được rà.
- Bảng nghỉ mới xem ở trạng thái thiếu rương; luồng chọn đồ rồi nằm ngủ chỉ được kiểm bằng các bài kiểm thử tự động có sẵn, chưa xem bằng mắt.
