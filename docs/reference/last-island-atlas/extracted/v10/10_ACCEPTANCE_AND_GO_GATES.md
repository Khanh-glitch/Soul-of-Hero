# SOH — NGHIỆM THU TRƯỚC KHI PHÁT LỆNH VÀ KHI THỰC THI

## Nguyên tắc quyền kết luận

- **CODE PASS** là điều kiện cần, không đồng nghĩa chạy trong scene có player/input.
- **DATA/ECONOMY PASS** cần nguồn item thật, tính bảo toàn UID, stock, crafting, loaded energy và anti-arbitrage.
- **WORLD ACCESS PASS** cần geometry Map sở hữu/POI, không có hardcode tọa độ tùy tiện.
- **VISUAL PASS** cần cảnh game hiện tại ở 640×360 và 1280×720, pixel đúng, đủ 13 layer áp dụng, không bê môi trường lab.
- **PLAYABLE PASS** cần New Game→đi→loot→nạp→Q/E→về nhà bằng input người chơi, không inject đồ.
- **EXPERIENCE PASS** cần thể hiện quyết định thật, tài nguyên đáng đi loot, Core khác nhau; cùng một nhiệm vụ có nhiều phương án hợp lệ.
- **LONG-RUN PASS** cần offline, save/relaunch, death bag, 336h, 72h Ragnarok, wipe, profile cash.
- **CROSS-OWNER PASS** cần cả Gameplay, AVFX, Map, Economy, native (nếu tuyên bố native) cùng ở một tree source và có handoff.

## Sổ test gắn sẵn (không có PASS giả)

- `04_CORE_ACTIONS_21_ENGINEERING.csv`: 21 hợp đồng hành vi Creator + V8 nghiên cứu.
- `05_21_ACTION_ACCEPTANCE.csv`: **273 hành vi kiểm thử** (21 × 13 tiêu chí gameplay/balance) — toàn bộ `NOT_RUN`.
- `data/V8_FX_273_LAYER_QA_UNMODIFIED.csv`: **273 kênh FX gốc v8** (21 × 13 visual layers) — toàn bộ `NOT_RUN`. Hai số 273 là **hai tập kiểm khác nhau**; không gộp thành số VFX.
- `data/CROSS_SYSTEM_GO_GATES_32.csv`: 32 điều kiện liên hệ thống **mới tạo ở v10**, không giả là 104 gate gốc từ v6.
- v5/v6 **chưa khôi phục**, các số 405/104 vẫn là *reported prior deliverables*, không được tính “đã chứng minh lại”.

## Trạng thái GO chính xác

| Cổng | Yêu cầu | Trạng thái từ audit v10 |
|---|---|---|
| `G0 History` | Quyết định lịch sử mới nhất, không mất 7 Core/21 actions/v7/v8/v9 | PASS for currently visible history; v5/v6 exact missing |
| `G1 Artifact Source` | Toàn bộ v5/v6 raw ZIP có source sha hoặc bản tái khảo có provenance và duyệt | **HOLD** |
| `G2 Branch & Rights` | HEAD Web/VFX/Map xác minh, native pins + quyền file cho từng owner | PARTIAL: Web/VFX/Map yes, native not checked |
| `G3 Product` | D01–D06 và 6 SKU, ngôn ngữ từng Core, anti-raid, 336h | PASS for principles; several tuning/product interpretations open |
| `G4 Controls & old saves` | Mốc F/E/R và migration old4 được tested and approved | **HOLD IMPLEMENTATION** |
| `G5 Provenance & visual` | 244 asset ID + ARCANA Gold mapping/scale/time per action in actual scene | PARTIAL: source verified, new scenes not audited |
| `G6 Player economics` | 10 scenario, supplied source, recipe, upkeep/recharge, anti-farm | **NOT_RUN** |
| `G7 Acceptance` | Natural input, day/night, off/on, 14-day and native composition | **NOT_RUN** |

### Quyết định của Control Tower theo v10

**GO:** gửi Agent **preflight/source-recovery/contract work** và dùng v10 làm căn cứ nghiên cứu, chuẩn bị các owner interfaces và lập test harness; không cần chờ thêm thảo luận chung.

**CONDITIONAL GO:** chỉnh code một vertical slice nhỏ trên branch đúng owner sau khi đã có hash v5/v6 (hoặc bản thay thế được phê duyệt), kiểm tra old-save, ownership và lộ trình resource.

**HOLD:** công bố đợt siêu nâng cấp 100% hoàn tất, merge PR, native production acceptance, thay dứt bốn Core cũ, thay đường đi bản đồ, gán VFX chỉ bằng tên, cho dân làng tự sản xuất vật tư.

## Hệ lỗi phải dừng ngay trước merge

1. Source vật tư không tới được hoặc Core không nạp được từ đường chơi bình thường.
2. Cast fail/cancel vẫn trừ vật tư trước điểm commit; cùng UID ở hai kho; reload ra đạn miễn phí.
3. 10 cây xuất hiện như VFX nhưng không có collider/wood, hoặc gỗ có thể lấy lặp.
4. Dragon tổng HP sai, meteor không đủ mười hoặc băng/teleport chỉ là hình.
5. Loot container cho gửi đồ, còn hàng đã biến mất, reload làm roll loot mới, cash hiếm hồi bằng timer.
6. Quái đến nhà không có trace; offline không có cause; bảo trì tự xóa nhà ngay mà không rõ cảnh báo/độ xuống cấp.
7. Chạy trên game cũ hoặc chỉ dùng scene FX Lab; so sánh Gold và world trong build không cùng SHA.
8. Code pass nhưng không có capture thực, nguồn PixelFX sai scale/opaque black, item thiếu sprite/UX.
9. Chế độ PvE bị buộc vào boss/Elder để có năng lượng đánh thường.
10. Dùng v5/v6 '405/104' trong handoff như đã thực sự chạy dù chưa có đúng bản ghi gốc.
