# AVFX takeover — Unified VFX/compositor cho Soul of Hero Web (2026-11-03)

Owner mới: VFX/compositor thống nhất, tiếp quản từ PixelFX PR #39 và AVFX handoff.
Branch làm việc: `arena/3337c864-soul-of-hero` (PR #39 là draft PR nghiệm thu).
Gameplay chính giữ ở PR #38 (`arena/4795760e-soul-of-hero`, HEAD `3b37ae9`) — không merge vào `main`, không đổi `engine.ts`/`sim.ts`/kinh tế/bản đồ/save.

Nguồn đọc: Issue #37 comment `6595373012` (stop condition + binding decisions), AVFX branch `arena/c7b0c4e8-soul-of-hero` tại handoff `d8d62ec` (implementation `112c873e`), PR #39 HEAD `f6c2559`, ARCANA20 source tại `prototypes/arcana20_web_review/` (P0 baseline Godot `b9b8cfa`).

## 1. Kiểm kê những gì đã thực sự làm được

### PixelFX PR #39 (HEAD `f6c2559`, branch hiện tại) — ĐÃ TÍCH HỢP THẬT vào game chính
- 244/244 hiệu ứng PixelFX (upstream `a84159688af3`, PARITY_PASS) load + render + spawn được trong game thật (sweep xác minh: 244 spawn, 244 có frame, 0 lỗi trang, 0 page lỗi).
- Pipeline Canvas2D hiện tại trong `web/src/game/render.ts`: terrain → ground FX (y-sort) → actors/roofs (y-sort) → auras (screen-space, trên cả mái, không bao giờ bị cắt) → warp → screen FX → weather/light → post-night duy nhất (radiance ngày-only + emission night-off + art vẽ lại sắc nét) → flash/HUD.
- FX Lab (F9) với pause/scrub/timeline, QA harness (`scripts/qa-pixelfx.mjs`, cả pilot và `WITH_ASSETS=1` full pack ALL PASS), 30/30 vitest, artifact offline đã commit (`web/releases/soh-pixelfx-pilot-offline.html`, 11 hiệu ứng pilot nhúng sẵn cho bản standalone).
- Các bài học đã giải quyết: crop ring (y-sort occlusion → pass `drawAuras`), mờ (upscale nguyên + pixelated, không phải blur), lệch trắng (tint kênh sáng theo màu effect), shape ban đêm (radiance/emission night-off).

### AVFX handoff `d8d62ec` — prototype review RIÊNG, chưa vào game chính
- `prototypes/arcana20_web_review/` là một derivative React/Canvas độc lập (không phải primary web). 20 chiêu có runtime diagnostic opt-in trong lab, nhưng KHÔNG phải thư viện gọi được từ game chính; combat là web adaptation, không phải P0 combat canon.
- Source A/B/C/D (P0 Godot `b9b8cfa`) có buffer/renderer/clock/pass riêng; `arcana20_cast` được phát tới 9 diagnostic layer trong render của bản review — không có ordering/depth/post統 nhất.
- #19: đã cô lập được nguyên nhân gốc (xem §3). Các nỗ lực vá shader lặp đi lặp lại đã FAIL theo Control Tower; dừng đúng điểm.

## 2. Quyết định kiến trúc (binding theo comment 6595373012)

**Một game web chính, một compositor owner, một presenter context cuối cùng.**
- Giữ Canvas2D cho world/actor/roof (gameplay đang chạy ổn định, 640×360 pixel-art, integer upscale).
- Giai đoạn 1 (đã làm trong commit này): chuẩn hóa seam — `web/src/game/compositor.ts` là owner DUY NHẤT của các pass effect lên khung hình cuối (depthItems → auras → warp → screen → post-night). PixelFX đăng ký làm client đầu tiên (`id: 'pixelfx'`). ARCANA20 sẽ đăng ký cùng interface này — không hệ thống thứ hai, không pass trùng.
- Giai đoạn 2 (khi cần HDR/WebGL2 thật cho ARCANA): một WebGL2 presenter duy nhất nhận đúng MỘT upload/frame từ Canvas2D world, giữ FBO thường trú cho source VFX, một stage post duy nhất trước HUD, không readback/`toDataURL`/ thêm context. Chỉ triển khai khi có số đo chứng minh Canvas2D không đủ — không đổi công nghệ vì sở thích.
- Pass order contract giữ nguyên thứ tự world hiện tại (đã kiểm chứng bằng QA: ground FX y-sort có occlusion, auras trên mái không cắt).

## 3. Lỗi AVFX #19 — nguyên nhân gốc và chính sách vật liệu

Theo comment 6595373012 + `measurements.json` của AVFX: shader Gold áp dụng nguyên floor/shimmer của lab tối lên địa hình sáng của SOH → dải sáng/tối cứng (mean abs luminance delta 16.26/255 ở nền tối vs 42.48/255 ở terrain thật, bán kính 70px đo được). Warp RGBA16F và shimmer `1+0.1*w.w*sin(...)` là thật, nhưng đáp ứng floor của nó không tương thích vật liệu sáng.

**Chính sách (interim decision của Control Tower, giữ nguyên khi port):**
- Giữ nguyên dao động shimmer/warp trên **vùng field của chính source effect**.
- Địa hình thật phản ứng qua **biến dạng khúc xạ/UV/chromatic có giới hạn không gian + đáp ứng luminance tương đối vật liệu trong không gian màu đúng (linear)**, không nhân độ sáng terrain tùy ý bằng hệ số shimmer của lab tối. Không bê nền tối của Gold vào game, không che lỗi bằng giảm sáng/tắt shimmer/chỉnh bloom tùy tiện.
- Phải chứng minh trên cỏ sáng, đất tối, mái/actor thật; mọi sai khác thẩm mỹ so với source phải ghi thành policy rõ ràng cho creator duyệt.

## 4. Kế hoạch milestone

1. **M0 (commit này)**: seam compositor thống nhất + tài liệu này. QA + 30/30 test xanh, hành vi hình ảnh không đổi.
2. **M1 — Architecture proof #19 trên map thật của game hiện tại**: một frame thật 640×360, source #19 đúng tick 498 seed 97, ngày/đêm, occlusion actor/roof, capture before/after từng stage khớp tham chiếu source; frame không cast phải y hệt baseline (HUD không đổi). So sánh trực tiếp frame tương ứng source Gold vs bản tích hợp — không cảnh lab giả.
3. **M2**: sau khi #19 đủ bằng chứng, kiểm tra #02 (họ B) và #16 (nhóm A+C) trên CÙNG compositor đó.
4. **M3**: port đồng loạt 17 chiêu còn lại bằng primitive/interface chung — không 20 bản port độc lập. 6 redesign candidate (#04, #06, #12, #13, #14, #18 — lead NEW/STUDY) chỉ ở dạng ứng viên cho creator duyệt, không tự tuyên bố Gold-approved.
5. **Event interface**: VFX chỉ nhận event cast/hit/cancel hợp lệ từ Gameplay (PR #38); quyền HP/damage/charge/cast thuộc Gameplay. Nếu thiếu event field thì phối hợp với owner PR #38, không tự tạo combat thứ hai.

## 5. Bảng 20 kỹ năng ARCANA20 — tình trạng thực tế (tính đến 2026-11-03)

Nguồn: `p0-catalog.json` @ `d8d62ec` (P0 `b9b8cfa`). `web_visual_implemented=false` toàn bộ — trong primary web chưa có chiêu nào; bản review mới chỉ có diagnostic opt-in.

| # | Key | Tên | Lead | Parts | Dur (s) | Climax (s) | Trạng thái trong game chính |
|---|-----|-----|------|-------|---------|-----------|------------------------------|
| 01 | fusion20_01 | Cinder Crown | A+C | A:01,C:01 | 7.8 | 4.82 | chưa port |
| 02 | fusion20_02 | Furnace Wyrm | B | B:02 | 7.6 | 5.12 | chưa port — kiểm chứng sau #19 (họ B) |
| 03 | fusion20_03 | Meteor Loom | B | B:03 | 10.0 | 7.25 | chưa port |
| 04 | fusion20_04 | Ashen Guillotine | NEW | C:04_STUDY,A:04_STUDY | 8.0 | 4.25 | redesign candidate (creator duyệt) |
| 05 | fusion20_05 | Abyssal Bloom | A+C | A:05,C:05 | 8.6 | 5.4 | chưa port |
| 06 | fusion20_06 | Riptide Calligraphy | NEW | C:06_STUDY,A:06_STUDY | 8.8 | 6.15 | redesign candidate |
| 07 | fusion20_07 | Mirrorfrost Basilica | C | C:07 | 9.2 | 6.62 | chưa port |
| 08 | fusion20_08 | Undertow Maw | B | B:08 | 8.5 | 5.30 | chưa port |
| 09 | fusion20_09 | Chain Verdict | A+B+C | A:09,B:09,C:09 | 7.8 | 6.08 | chưa port |
| 10 | fusion20_10 | Thunderloom | C | C:10 | 7.4 | 4.84 | chưa port |
| 11 | fusion20_11 | Volt Carousel | A+C09 | A:11,C:09_ARCS | 8.2 | 6.12 | chưa port |
| 12 | fusion20_12 | Skybreaker Script | NEW | A:12_STUDY,C:09_ARCS_STUDY | 8.8 | 7.14 | redesign candidate |
| 13 | fusion20_13 | Rootwake | NEW | B:13_STUDY,C:13_STUDY | 9.4 | 6.72 | redesign candidate |
| 14 | fusion20_14 | Spore Nebula | NEW | A:14_STUDY,B:14_STUDY,C:14_STUDY | 9.4 | 7.12 | redesign candidate |
| 15 | fusion20_15 | Thorn Opera | C | C:15 | 8.4 | 6.00 | chưa port |
| 16 | fusion20_16 | Worldseed | A+C | A:16,C:16 | 10.2 | 7.72 | chưa port — kiểm chứng sau #19 (A+C) |
| 17 | fusion20_17 | Event Horizon | C | C:17 | 8.8 | 6.45 | chưa port |
| 18 | fusion20_18 | Chronoshard | NEW | B:18_STUDY | 10.0 | 5.20 | redesign candidate |
| 19 | fusion20_19 | Constellation Engine | D | D:19,A:19_COMBAT | 9.8 | 8.15 | **phép kiểm chứng compositor đầu tiên** |
| 20 | fusion20_20 | Reality Ripper | A+C | A:20,C:20 | 10.4 | 6.30 | chưa port |

6 redesign candidates: #04, #06, #12, #13, #14, #18 (lead NEW, parts `*_STUDY`).

## 6. Giới hạn chưa giải quyết (trung thực)

- Chưa có bằng chứng hình ảnh #19 trên map thật của game chính (mục tiêu M1).
- Chưa có renderer WebGL2 presenter; chưa đo được chi phí thực trên GPU phần cứng (mọi số AVFX trước là SwiftShader software).
- Hiệu năng đa hiệu ứng đồng thời, context loss, frame pacing thật: chưa đo trên phần cứng.
- 244 PixelFX đã sẵn sàng runtime; ARCANA20 mới ở mức source/diagnostic trong prototype review — cần port qua client interface của compositor.
- Chưa có event cast interface chính thức từ PR #38 — cần thỏa thuận với gameplay owner.
