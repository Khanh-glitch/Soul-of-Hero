# ARCANA — BỘ HANDOFF FUSION 20 SKILL (A+B+C+D)

**ĐÂY LÀ BỘ NGUỒN + QUYẾT ĐỊNH + PROMPT GIAO VIỆC, KHÔNG PHẢI BẢN VFX FINAL ĐÃ FUSION.**

Bộ này giữ nguyên ba mã nguồn, vote thật của người dùng và HTML tham chiếu thứ tư cho chiêu 19. Nó được tổ chức để một coding agent có thể tạo **một lab hoàn chỉnh với đúng 20 phiên bản đã fusion**, đồng thời bảo tồn toàn bộ **impact và elemental status hiển thị TRỰC TIẾP trên kẻ địch** từ A. Không được báo hoàn thành chỉ vì chèn enemy sprites vào khung hình.

## Chạy việc với AI coding agent

1. Giải nén vào thư mục làm việc có quyền đọc/ghi.
2. Dán nguyên văn file `FUSION_MASTER_PROMPT.md` vào agent, kèm file ZIP; đừng chỉ gửi các ảnh so sánh.
3. Yêu cầu agent đọc `FUSION_DECISIONS.md`, `fusion_manifest.json` và **20 vote thực** trong `votes/` trước khi viết code.
4. Mỗi commit kiểm tra kĩ VFX gốc có giữ đúng motif được vote, các đòn có chạm enemy thực tế và status có xuất hiện trên enemy; hiệu ứng lên nền theo B/C khi nguồn đã chọn có bản tốt.
5. Chiêu 19 có HTML thứ tư làm nguồn visual, A lo combat; bắt buộc có pha out mới.

## Nội dung

- `sources_original/` — ba ZIP nguyên bản, giữ nguyên byte.
- `sources/` — ba dự án A/B/C đã giải nén đầy đủ để agent đối chiếu và tích hợp.
- `votes/ARCANA_Votes_20-of-20.json` — vote nguyên bản, 20/20.
- `reference/Elemental_VFX_Lab_FIXED_Standalone.html` — HTML thứ tư, dùng visual cho chiêu 19.
- `reference/ARCANA_19_Reference_With_Exit.html` — **bản thử riêng** được bổ sung thao tác co/fade lúc kết thúc chiêu 19; *chưa được người dùng duyệt và chưa được nghiệm thu hình ảnh bằng GPU*.
- `reference/ARCANA_Three_Way_VFX_Comparison.html` — phiên bản so sánh có vote để đối chiếu.
- `review/` — ảnh contact sheet và báo cáo đánh giá ban đầu, **không ưu tiên cao hơn vote người dùng**.
- `FUSION_MASTER_PROMPT.md` — prompt tiếng Anh giao việc.
- `FUSION_DECISIONS.md` — hướng fusion và enemy/environment/out cụ thể cho từng skill.
- `ARCHITECTURE_AND_INTEGRATION.md` — cảnh báo xung đột renderer và hợp đồng tích hợp.
- `fusion_manifest.json` — mapping machine-readable + trạng thái nghiệm thu ban đầu.
- `ACCEPTANCE_MATRIX.csv` — form test 20 chiêu, ban đầu tất cả chưa đạt.
- `SHA256SUMS.txt`, `scripts/verify_bundle.py` — kiểm tra tính toàn vẹn các nguồn.

## A/B/C/D không thể trộn cơ học

- **A** — `pixel-art-magic-laboratory (1).zip`: nguồn impact / enemy / world và các winner A.
- **B** — `pixel-magic-vfx-laboratory (1).zip`: winner B, một số hình dạng/động học.
- **C** — `pixel-magic-vfx-laboratory.zip`: winner C, shader/hình học/ánh sáng.
- **D** — `Elemental_VFX_Lab_FIXED_Standalone.html`: visual ưu tiên cho #19.

Các renderer khác kích thước và kiến trúc. Agent phải xây compositor/timeline/event bridge thống nhất, không chỉ đặt 3 canvas bên cạnh hoặc đè hình nền không trong suốt. `CHOREO` của A còn tham chiếu tới state riêng của skill A nên không thể gắn thẳng vào skill B/C/D.

## Quyết định đặc biệt không được bỏ sót

- #11 dùng cấu trúc A nhưng nên học **thiết kế tia sét của C tại chiêu #9**, không phải lấy tia sét C tại #11.
- #9 kết hợp A chaining/on-body electrocution + B tia sét hai màu + C density/impact.
- #5 A opening/peak + C burst nước rơi, bỏ những tail dư thừa của A.
- #16 A animation mượt + C palette.
- #20 C vết xé + A tác động ngoại cảnh.
- #4, #6, #12, #13, #14, #18 được vote `NONE`; bắt buộc *redesign*.
- #19 tuy được vote A khi chỉ có ba ứng viên, **đã được user ghi đè trực tiếp bằng visual D**. OUT phải hoàn chỉnh.

## Trạng thái kiểm chứng

Ba ZIP nguồn, phiếu vote và tham chiếu HTML có SHA256 để kiểm chứng chính xác. Bản thử OUT của #19 đã kiểm tra cú pháp JavaScript. Trình duyệt sandbox không khởi tạo WebGL2 ở lượt thử này, nên chưa xác nhận bằng render. **Không có bất kỳ công việc fusion production nào được đánh dấu PASS** trong `fusion_manifest.json` hoặc bảng acceptance.
