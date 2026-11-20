# Nghiệm thu ứng viên — PARTIAL, chưa phát hành

Ngày 2026-11-19 · `arena/25e24231-soul-of-hero` · SHA nguồn và test: `eb04debfb6ff36d29424dca898b2be6da57af8f2`.

**Không phải giấy chứng nhận phát hành.** Các commit chứng cứ sau SHA này không thay đổi đối tượng đo. Hợp đồng: [control tower 01–09](../../20261117-final-production-control-tower/README.md); [nhật ký triển khai](../../20261117-final-production-control-tower/07_EXECUTION_LEDGER_AND_HANDOFF.md).

| Hạng mục | CODE | ENGINEERING | BROWSER | CREATOR |
|---|---|---|---|---|
| Hái nấm ngoài cửa sổ, nấu | DONE | DONE: tuyến/stock/UID/kho/reload, món thật trong pack | Chưa thấy trọn chuỗi | Chưa duyệt |
| Medic/cấp cứu | DONE | DONE: tiếp xúc, trừ một liều, thiếu thuốc/khác tầng không chữa | Chưa kiểm | Chưa duyệt |
| 8 nghề | DONE về hợp đồng nghề | DONE trong hợp các run seed 7606; không phải trong một làng | Chưa kiểm đủ | Chưa duyệt |
| Guard giết thú để lấy thịt | DONE | DONE trong fixture: đòn đầu chưa chết, đòn cuối và giao đúng UID | Chưa kiểm | Chưa duyệt |
| Chuyến tàu/thiệt hại | DONE cho chuyến có người lái và lương | 11/11 phép kiểm gồm thiếu hàng, chi phí sửa, hỏng giữa biển và reload | Chưa chứng kiến đủ 3 tuyến | Chưa duyệt |
| Kho sập | DONE: chống lại kho bằng gỗ ở hiện trường | DONE cho việc sửa và mất gỗ; chưa chứng minh tái dựng bếp | Chưa kiểm | Chưa duyệt |
| Save và offline | DONE cho các trường hợp đã kiểm | 8/8 mẫu lịch sử, harvest giữa đường, deadline tàu/Elder | Quit/Continue hai process tại build tích hợp, +20131ms | Chưa duyệt |
| Dual rescue và K8 | Có đường luật | DONE trong fixture: 3/279/2/2, sáu nguồn, K8 reset | Chưa kiểm | Chưa duyệt |
| UI 640×360 | PARTIAL | build + map/UI kiểm riêng | PARTIAL: [7 ảnh native](native/), không phải A–I | Chưa duyệt |
| Chiến dịch A–I | — | Test máy không thay được chơi | PARTIAL: [field log](field/run.json), seed 1802831566, đánh dấu bản đồ và relaunch thật | Chưa duyệt |
| Full regression, endurance, FPS | — | BLOCKED/PARTIAL, không có kết luận xanh | Không có benchmark đối chứng hợp lệ | Chưa duyệt |

**T9:** `node scripts/regression-shards.mjs` đã lập manifest 225 file tại SHA nguồn (không phải 197). Khi chạy chồng full shard, bộ tích hợp và phép so parent, máy 2 vCPU/~3.8 GiB chỉ còn khoảng 34 MiB MemAvailable; sau đó lệnh shell và điều khiển process trả deadline exceeded. Không coi log dở là file PASS, cũng không coi lỗi tài nguyên là bằng chứng mã đúng. Baseline `79ac5f0` thực chạy 10 assertion chọn lọc: 3 pass, 7 fail (4 CAL-01 E, B7, Journey RED-2, G1A cleaver/bale 4 thay vì 3). Cùng selector trên ứng viên: 7 lỗi khớp assertion và thông báo (INHERITED, vẫn mở); JSON hai phía nằm trong `engineering/`. Không miễn trừ audit-closure, review-r2, natural-procurement hay throughput.

**Tiếp tục trước khi phát hành:** giữ riêng tiến trình regression và đối chứng, không chạy đồng thời trên máy này. Thu đủ báo cáo JSON hoặc ghi timeout từng shard, chạy phần chưa có kết quả, so từng fail rồi mới cấp nhãn. Quay hai đường cứu trong cùng run bằng điều khiển thường, A–I trực tiếp, endurance h336, FPS cùng cảnh và 11 mục chứng cứ tại cùng SHA. Tài liệu/ảnh kiểm được ở SHA trước chỉ là dữ liệu tham khảo, không tự động nâng cấp gate hiện tại.

## Mục lục gói 06 §G
1. SHA, luật và giới hạn: tài liệu này.
2. [Census 81 POI](81-poi.csv), [phép đo tái lập](capture-census.mjs); không chứng nhận đủ lương 336h.
3. [Ma trận 8 nghề](occupations.md).
4. [Route, cargo, đồng hồ và ca âm](routes.md).
5. [Xã hội, giao dịch, chiến đấu](social-combat.md).
6. [Sáu Elder, ba bến, dual rescue/K8](elder-evac-k8.md).
7. [Ảnh 640×360](native/) và [field log hai process](field/).
8. [Manifest, TypeScript, build, regression, fail từng assertion](engineering/). Mẫu lịch sử không được cấp humanWorld hay đồ mới khi load. Full-suite PARTIAL, không nhầm với bộ tích hợp 12 file.
9. [Endurance/benchmark và giới hạn so sánh](endurance-performance.md).
10. [Walkthrough và hướng dẫn A–I](walkthrough-vi.md).
11. Bảng gate CODE/ENGINEERING/BROWSER/CREATOR ở đầu trang. **REVIEW REQUIRED; không merge.**

**Cập nhật T9 lúc 19:32 UTC:** shard đầu tiên hoàn tất (index 1): 47 file qua, 9 lỗi; 360 assertion qua, 28 lỗi, 32 pending. Shard 0 hết watchdog 1800s. Tính cả phép đối chứng chọn lọc, **37 dấu lỗi** (gồm một lỗi cấp suite) khớp baseline; một assertion freight mới quan sát chưa phân loại. Không phải verdict cho 225 file. Xem [checkpoint có stack và từng file](engineering/regression-review.json).

**Bổ sung trình duyệt:** [F: công việc khi đóng game](field-cargo-confirmation/README.md) có hai save gốc cùng run. Theo 6 job đã tồn tại, đối chiếu chuyển UID và merge vào kho sau hơn 90 giây đóng Chromium. Còn thiếu đi khỏi/đi lại làng trên tầng khác. Hai HTTP 404 của manifest VFX đã được ghi, không được coi là nghiệm thu sạch lỗi request.

**Cập nhật kế tiếp:** shard 1 và 3 đã trả JSON cho **112/225 file** (608 assertion qua, 86 lỗi, 40 pending). 43 dấu lỗi khớp baseline trong checkpoint; chưa phải tổng cuối. Vận chuyển C2 đã sửa setup và điều khiển hợp luật, 6/6 ở [báo cáo mới](../../t9-freight-closure/README.md). Phép kiểm cook tại 180 giây xác nhận nguyên liệu đi từ nguồn qua kho vào pack chứ không phải nguồn cung tự sinh. Hai thay đổi test này không sửa kết quả lịch sử tại SHA `eb04deb`.

**Mốc sau phục hồi shard 0:** [reconciliation theo từng file](engineering/checkpoint-after-shard0-recovery.json) gồm 123 PASS, 36 FAIL, 9 chỉ SKIP, 1 PARTIAL-WATCHDOG, 56 chưa có report (225 file, runtime đóng băng). Không phải 225 PASS. Trong các failure có JSON: 40 khớp baseline cùng file/title/thông báo/site, 117 chưa đối soát; inventory mở rộng cũ gồm cả focused report ở mốc khác. Shard 4 hoàn tất: route FOOD seed 7/11 qua; oil thất bại, seed 23 pending. Bản sửa **sau SHA này** và bằng chứng riêng: [giao dịch hai phía](../../post-t9-hardening/barter/README.md), [manifest HTTP](../../post-t9-hardening/pixelfx/README.md). [Endurance](../../post-t9-hardening/endurance/README.md) mới kiểm quy trình hai process/2 phút, chưa đạt 336h.

**So cảnh sau T9:** [Greywater, ba SHA, ảnh/biểu đồ/raw intervals](../../post-t9-hardening/greywater-benchmark/README.md). Cùng seed/cửa sổ/tọa độ/renderer/23 creature, nhưng số người 0/0/286, entity 9/32/41. Mean steady main/G1B/current = 41.7/104.6/121.9 ms. Current P99 300.0 ms; không đạt căn cứ ≤10%, không phải matched-density sign-off. Current đo tại `cf58b0e` sau thay đổi giao dịch, không gán cho eb04deb.
