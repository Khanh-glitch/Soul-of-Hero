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

## Chưa làm, chưa kiểm

- Chưa thử trên điện thoại thật, Firefox, Safari.
- Chưa mở các bảng: báo cáo khi quay lại, nghỉ, sơ tán, di vật, cư dân, hải trình. HUD ban đêm chưa xem.
- Chú thích khi rê chuột (`title`) không hiện trong ảnh chụp nên chỉ được kiểm bằng cách đọc chữ.
- Bảng chọn đồ xây vẫn ghi dòng tiếng Anh dạng "1: Wood Wall — Wood ×5" (toàn tên vật phẩm).
- Cột phải của bảng trạm phải cuộn mới thấy khối cuối khi nội dung dài.
- ZIP phát hành `web/releases/Soul-of-Hero-Web.zip` chưa đóng lại, vẫn là bản của `384b35ad`.
