# SOH GAMEPLAY — OPERATIONS / THỰC THI DUY NHẤT
**Mốc chuẩn hóa:** 2026-11-10 · **Baseline bất biến:** `830cb3e7c96ad8057e02d664ce02c52ca3046082` (MEC-01 R12) · **Trạng thái:** CODE BASELINE / FINAL CHƯA ĐẠT.

Đây là **sổ vận hành hiện hành**, không phải một Bible thứ hai. Đọc cùng [bible.md](bible.md). Nguồn đối chiếu LI nằm tại [atlas/README.md](atlas/README.md). Không có các lệnh triển khai song song ở tài liệu/bình luận lịch sử. Trong các cuộc hội thoại Arena, phải truyền đường dẫn chính xác tới file này; việc đăng GitHub comment KHÔNG tự khởi động phiên Agent.

## 1. Chỉ một trục chỉ đạo đang có hiệu lực
1. **Product:** quyết định mới nhất của Creator > các điều [CHỐT] trong Bible > nguồn Gold/asset đã xác thực > Atlas đúng phiên bản/mode > source code/trạng thái thực nghiệm. Atlas là research, không phải danh sách 214 tính năng tự động được duyệt. Khi mã hiện hữu trái luật: sửa mã hoặc ghi conflict có lý do, KHÔNG sửa Bible chỉ để phù hợp.
2. **Execution:** một Gameplay Agent hiện hành chịu trách nhiệm hoàn thành đầu-cuối chức năng có thể chơi: gameplay law, source/economy, save/clock, state/custody, physical POI/collision, terrain action, HUD feedback, browser và native integration có liên quan. Không lấy owner/agent/PR cũ làm điều kiện chặn. Nguồn địa lý Veyra/Gold nguyên gốc vẫn phải có provenance; không bịa tile hoặc thay raster Gold.
3. **Evidence:** SPEC ≠ CODE ≠ FIXTURE ≠ NATURAL_INPUT ≠ COMPOSED_WEB ≠ COMPOSED_GODOT ≠ HUMAN_S4 ≠ LONG_S5. Mọi lời nghiệm thu có SHA + input + before/after state/receipt + negative + các điểm chưa đạt. Gameplay chạy ≠ gameplay có chiều sâu.
4. **Change:** sau khi xác định lỗi/thiếu được Bible cho phép, sửa code và test thực sự, commit/push đúng branch; không dừng ở audit, không xin phép lại cho lỗi trong scope. PR draft không tự merge.
5. **Release:** chỉ promote sau test tương thích save cũ, item UID/atomicity, offline, physical access, anti-duplication, play route natural, visual native 640×360 cùng SHA và kiểm thử người thật theo giai đoạn.

## 2. R12 rollback: cái gì đã GIỮ, cái gì đã KHÔNG MANG SANG
**Giữ:** 16 commit trước WEC-01 của PR #47: Motorbike Kit chain/hauling và UID; run ID không trùng; speed/wear mô hình có cost SOH_PROVISIONAL; plank/wall và upkeep; rich iron ore có source contract; wild regrowth chịu season/soil/terrain với offline chronology; weather outlook không leak tương lai; J10 departure read model. Đây là CODE EXISTS với test/evidence lịch sử, không mặc định S3/native/human.
**Không mang:** WEC-01 `03a7033` và `c872402` (lot-source-v3 toàn 14 Shipping, deferred reward, finite-v2; bao gồm cả lỗi digest và Lighthouse classifier). Bản đó được bảo toàn nguyên tại nhánh backup `archive/pr47-wec-v3-c872402-20261110` chỉ để so diff/khôi phục chọn lọc, **không được tự coi là input hiện hành**.
**Thực tế tại R12:** `web/src/game/loot-ecology.ts` dùng W06 bốn class và `b05-v1`; số authored Shipping Fresh tĩnh là 14, nhưng B05 explicit source specs chỉ 3. Hai lỗi ở R12 còn MỞ: `lootGrammarRoll()` bỏ qua B05 advanced sau cửa và `renewableStock()` không tự bảo vệ nguồn advanced hữu hạn. Không nói đã sửa.
**Test baseline:** agent báo cáo R12: `tsc --noEmit` PASS, Vitest 122 file/887 tests pass + 1 skipped, `vite build` PASS; screenshot 640×360 của Esc Menu tại `web/evidence/mec01-r12/`. Chưa kiểm độc lập CI hoặc S3 human. Mỗi thay đổi phải chạy lại.
**Save:** Không được mở/ghi đè snapshot run đã sinh với `loot-source-v3` bằng binary R12 mà không có migration. Bản V3 phải được sao lưu; snapshots B01/B04/B05/W06 cần test riêng, cả process restart. Sửa world `mapDigest` hoặc source contract phải có versioned migration và anti-duplicate tests, không bỏ validator.

## 3. Các đầu ra gameplay được yêu cầu — không thay bằng danh sách task tên hệ
| Luồng | Tiêu chuẩn input & kết quả | Bằng chứng còn thiếu ở baseline |
| --- | --- | --- |
| Spawn / road / common loot | Spawn ngẫu nhiên hợp lệ, cầm dao; đi nhiều hướng, thu nguồn cây/đá/box bằng thao tác thật, có food/supply/toolbox khác biệt; sản phẩm giúp ăn/sửa/chế tạo | Veyra final còn chưa chứng minh world-level source distribution; Shipping 14 box không là toàn đảo |
| Item→craft→industry | Thu ore/coal/parts/scrap tự nhiên hoặc POI hợp lệ → UID → paid smelt/repair/research/gear → có hai cách tiêu cạnh tranh | Nhiều test còn dùng fixture; cần natural trip, không tự phát item |
| POI physical | Ngoài POI có loot hợp lệ, nhìn thấy cửa, lấy card/fuel bằng nguồn có chứng cứ, mở điện/thẻ, vào phòng, rút lui, quay lại, lấy đồ sâu đúng 1 lần | B05 advanced loot logic chưa đúng tại R12; kiểm remote move qua tường |
| Nhà/offline | Tự chọn vị trí, xây nền–tường–mái–giường–kho/lò, có stock/upkeep/turret/trace, logout nhiều mốc, trở về thấy diễn biến nhân quả | S3 composed và long absent 8/24/48/72h chưa đóng |
| Sinh tồn/vận tải | Hunger/thirst/thermal/toxin/marsh/mùa, tool wear, foot/cart/motorbike với fuel/cargo, route mang hàng có lời/lỗ | Cần test đường thật ở nhiều địa hình/bộ tải, không dùng benchmark fixture làm nghiệm thu cuối |
| Core/Gold | Bảy Creator Core, 21 hành động LMB/Q/E và sáu SKU energy, Gold fidelity, mechanic tác động thế giới khi hợp lệ; nhặt thử dùng ngay | Old Core và Creator Core đồng tồn tại; xác nhận design trước khi sửa nguồn thưởng |
| Ragnarok hai run | 336h, hai năm/tám mùa, 72h cuối, nguồn cash POI hữu hạn không boss, mua chest bằng tiền thật từ wallet0, deposit nhiều lần, evac/reset, run2 | Production paths, anti-farm, player choice, verified leaderboard/backend chưa proven |
| Visual/runtime | Cùng một map/layout, hai avatar, camera/HUD 640×360, source FX, assets và Godot + browser | Không dùng Web PASS thay cho Godot PASS, không lấy giấy Map thay gameplay |

## 4. Hợp đồng kiểm chứng và ưu tiên
- Các luật phải quy chiếu **K1–K8**; các điểm giao nhân quả **C01–C24**, các tình huống quan sát **J01–J20**. J không là quest bắt buộc hay thứ tự tiến trình.
- Dùng [Atlas v11 capability ledger](atlas/extracted/v11/02_FULL_DEPTH_CAPABILITY_LEDGER.csv) để đánh giá 18 hệ và 214 ID, và [cross-system edges](atlas/extracted/v11/17_EXPLICIT_CROSS_SYSTEM_NETWORK.csv) để không bỏ sót tương tác. Mỗi hàng chỉ là nghiên cứu: phân `ALREADY_VERIFIED / PARTIAL / MISSING / REJECTED / OPEN_DECISION` tại SHA trước khi giao.
- **P0 bảo vệ dữ liệu:** save contract, timestamp, UID, unique cash/Core/blueprint, one-time physical source, no loot-through-wall. Chỉ một sự cố được chứng minh mới trở thành BLOCKING; không block toàn game bằng ảnh topology hoặc đường đo thiếu clear-wall.
- **P1 hoàn thiện lựa chọn thật:** nguồn ven đường có giá trị; bốn/nhiều vai trò box hợp lệ theo LI, food không bị gộp vô thức; research/craft/haul có competing sinks, POI nhiều tầng, freeform retreat.
- **P2 compose world:** phối nguồn, geography, animal/hazard, mùa, người chơi và UI vào Veyra với nguồn asset chính xác. Shipping có thể làm fixture; **không thể nhận là final Veyra chỉ vì 14/14 box**.
- **P3 final:** cùng-SHA Godot, negative/restart/migration, nhiều hành trình ngoài script, quan sát người và long horizon.

## 5. Quy trình 1 vòng thực thi
**Bước 1** xác định hiện đã có gì ở SHA hiện hành và chốt 1–3 thiếu sót có player consequence; **Bước 2** viết test sai trên source hiện có; **Bước 3** sửa engine + typed contracts + consumer; **Bước 4** chạy tsc/Vitest/build/browser và nếu cần native; **Bước 5** commit/push, ghi receipt và closed/open IDs; **Bước 6** tiếp tục thiếu sót có giá trị tiếp theo, không dừng ở báo cáo.

Handoff bắt buộc: HEAD, changed files, commands + exit codes, exact save snapshots/UID, real-input trace, cửa khóa/geo/POI, screenshot hoặc lý do chưa có, remaining blocking dependencies có chứng cứ. Không ghi "hoàn thành" nếu bằng chứng thuộc mức khác. Mọi số LI chưa có nguồn ghi `ORIGINAL_UNKNOWN`, mọi số SOH thử nghiệm ghi `SOH_PROVISIONAL`.

**Không mở các tài liệu bàn giao lịch sử để nhận việc.** Các tệp đó được bỏ khỏi cây active; Git history còn để truy cứu nhân quả. Atlas gốc cũng có những work order lịch sử nhưng chúng **không có thẩm quyền điều hành**.
