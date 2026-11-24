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

| # | Mức | Lỗi | Trạng thái |
|---|---|---|---|
| 1 | Nặng | Thanh máu và thanh thể lực không hiện phần màu. `hud.tsx` ghép `var(--hp)` với `99` thành một chuỗi không phải màu, trình duyệt bỏ cả nền. | **Đã sửa** |
| 2 | Nặng | Tiếng Việt chỉ có trong sổ Hành trình. Sau khi đổi ngôn ngữ: túi đồ, bản đồ, ghi chú, kỹ năng, menu Esc 100% tiếng Anh; HUD 6 khối chữ Việt trên 13 khối Anh. | Chưa làm, chờ quyết định |
| 3 | Nặng | Cửa sổ nhỏ chỉ thu nhỏ khung 640 × 360, không sắp xếp lại. Chữ thường gặp: 16 px ở 1280 × 720, 12,8 px ở 1024 × 768, 10 px ở 800 × 600, 4,9 px ở 390 × 844. | Chưa làm, chờ quyết định |
| 4 | Nặng | Điện thoại không chơi được: thế giới game chỉ nhận chuột và bàn phím (đọc mã nguồn; chưa thử máy cảm ứng thật). | Chưa làm, chờ quyết định |
| 5 | Vừa | Bảng Presentation dài hơn khung chứa nó; phần lớn cài đặt nằm dưới mép và phải cuộn mới thấy. | **Đã sửa**: chia ba thẻ Display / Sound / Look, không thẻ nào phải cuộn |
| 6 | Vừa | Chữ số trong phông nhãn: 5 giống S, 7 giống 1 ("8S" thay cho 85). | **Đã sửa**: chữ số lấy từ VT323 |
| 7 | Vừa | "find…" đọc thành "And…", "filter…" thành "Alter…" (chữ ghép `fi` của Pixelify Sans). | **Đã sửa**: tắt chữ ghép |
| 8 | Vừa | 52 ký hiệu (→ ★ ◆ ▶ ♀ ♂ ⚙ ✕ ☰ …) không có trong hai phông đi kèm, phụ thuộc phông hệ thống của người chơi. | **Đã sửa**: kèm phông ký hiệu 5 KB; nút đóng và nút menu vẽ bằng điểm ảnh |
| 9 | Vừa | Trong túi đồ, phím Tab mở bảng Kỹ năng thay vì chuyển tiêu điểm, dù tiêu đề ghi "Enter pick/place". | **Đã sửa**: trong túi đồ Tab chuyển ô; ngoài túi đồ Tab vẫn mở Kỹ năng |
| 10 | Vừa | Hai hộp xác nhận "Give up" và "Abandon" mở được cùng lúc. | **Đã sửa** |
| 11 | Vừa | Chú thích khi rê chuột: "fd 82/100", "h2o 81/100", "wr 100/100". | **Đã sửa**: Food, Water, Warmth, Health, Stamina |
| 12 | Vừa | Lời nhắc ở rương ký gửi là "Rương ký gửi" giữa giao diện tiếng Anh (trái quyết định tên hiển thị tiếng Anh ở vòng 2). | **Đã sửa**: "Open Escrow Chest" |
| 13 | Vừa | Thời gian không dừng khi mở bảng nào. | Chưa làm, chờ quyết định |
| 14 | Vừa | Bảng đè nhau: bảng thương nhân che ô chỉ số; thẻ sổ Hành trình bị cắt ở mép trên; hàng túi đồ ở đáy bàn chế tạo bị cắt. | Chưa làm |
| 15 | Vừa | Chữ của người làm game trên màn hình: "VEYRA · U=0.5", "AU 812,649 · F0", "LOCAL/UNVERIFIED". | Chưa làm, chờ quyết định ("SHIPPED" và "same frame, three readings" đã bỏ) |
| 16 | Nhỏ | Danh sách công thức trong Kỹ năng lặp tên vì không ghi số lượng. | **Đã sửa**: "Refined Energy ×12", "Refined Energy ×4" |
| 17 | Nhỏ | Màn Hồ sơ: tên thành tựu chưa mở và nút "Back" quá mờ. | **Đã sửa** |
| 18 | Nhỏ | Chỉ số giáp ghi "-0%" khi không mặc gì; ô đánh dấu "mute" là ô trắng mặc định của trình duyệt. | **Đã sửa** |
| 19 | Nhỏ | Bản đồ ván mới hiện khoảng 66 chấm đỏ; chưa xác định là gì. Chế độ xây ghi "Too far away" khi chưa đặt gì. | Chưa làm |

## Chi tiết các chỗ đã sửa

- **Thanh máu (1).** `Gauge` và `Bar` tô một màu đặc rồi phủ một dải tối lên trên, không còn nối chữ số alpha vào tên màu. Đo lại: phần màu rộng 72 px khi máu 100 và 31 px khi máu 22. Ảnh: `shots/hud-hp22.png`.
- **Chữ số (6).** `index.css` khai báo thêm chữ số 0–9 của họ `Pixelify Sans` lấy từ tệp VT323 đã có sẵn, phóng 125% cho khớp chiều cao. Phải khai báo riêng cho hai độ đậm 400 và 700: khai một dải `400 700` làm trình duyệt đẩy toàn bộ chữ cái thường sang phông hệ thống (đã gặp và đã sửa trong lúc làm).
- **Ký hiệu (8).** `src/fonts/soh-symbols.woff2` là tập con 52 ký tự của Noto Sans Symbols, Symbols 2 và Math (OFL 1.1, văn bản giấy phép ở `src/fonts/OFL-Noto.txt`). Dựng lại bằng `scripts/make-symbol-font.py`. Đo lại trên 11 màn hình: không còn ký tự nào vẽ bằng phông hệ thống.
- **Presentation (5).** Thẻ Display: bố cục túi đồ, tỉ lệ màn hình, giảm chớp, HUD đặc. Thẻ Sound: năm thanh âm lượng và nút tắt tiếng. Thẻ Look: phong cách hình ảnh, độ màu, rung màn hình. Kéo thanh trượt bằng chuột chạy liền mạch (0,5 lên 0,95). Ảnh: `shots/menu-display.png`, `shots/menu-sound.png`.

## Đã kiểm sau khi sửa

| Hạng mục | Kết quả |
|---|---|
| `typecheck`, `typecheck:tests`, `build` | Sạch |
| `tests/ui-readability.test.ts` (mới, 5 bài; đã đối chiếu: mẫu của bài 1 và bài 5 có trong mã cũ, tức hai bài này trượt trên mã cũ) | Đạt |
| Trình duyệt, bản QA, ván mới: thanh máu, chú thích, ba thẻ Presentation, kéo thanh trượt, hai hộp xác nhận, nút đóng, Tab trong và ngoài túi đồ, danh sách công thức | Đạt, không lỗi console |
| Trình duyệt: phông vẽ từng ký tự trên 11 màn hình | Chỉ VT323, Pixelify Sans, SOH Symbols |
| Trình duyệt, cảnh dựng sẵn "industry": lời nhắc rương ký gửi, bảng lò, bàn chế tạo, bàn nghiên cứu, lò nung, nút hủy việc | Đạt |

**Kiểm thử tự động đã chạy: 21 tệp, 151 bài đạt, 0 trượt, 6 bài bỏ qua (loại phải bật tay).** Gồm mọi tệp đọc mã giao diện hoặc CSS (`ui-5pillars`, `g1b-icon-audit`, `pa1-research-visible-gate`, `b06-presentation-cues`, tám tệp `.tsx`), cộng `item-ontology-v2-round2`, `g1b-lifecycle`, `pa1-building-ontology`, `npc-evac-physical-service`, `m-core-03r-economy`, `emergent-fire`, `wp3-veyra-recycler-integration`, `visual-readmodels`.

**Chưa chạy lại toàn bộ bộ hồi quy (hơn 250 tệp).** Lần sửa này chỉ đổi mã giao diện, CSS và một nhãn chữ trong `sim.ts`; luật chơi không đổi.

**ZIP phát hành `web/releases/Soul-of-Hero-Web.zip` chưa đóng lại**, vẫn là bản của `384b35ad`. Bản chạy trên Vercel cũng chưa có các chỗ sửa này.

## Chưa kiểm / còn nợ

- Chưa thử trên máy cảm ứng thật, trên Firefox và Safari. Safari cũ hơn bản 17 không hiểu `size-adjust`: chữ số sẽ nhỏ hơn chữ cái một chút nhưng vẫn đúng hình.
- Chưa xem: báo cáo trở về sau khi vắng mặt, bảng nghỉ ngơi, bảng di tản, HUD ban đêm và khi trời lạnh thật.
- Các bảng trạm, xe, thương nhân, boss, tử trận chỉ được xem ở cảnh dựng sẵn.
- Chữ tiếng Việt trong nhãn Pixelify Sans vẫn đổi phông giữa từ (Pixelify Sans thiếu 92 chữ cái tiếng Việt). Việc này đi cùng mục 2.
