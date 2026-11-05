# SOH SUPER-UPGRADE — PRE-AGENT CANON & EXECUTION PACK v10

**Ngày đóng gói:** 2026-11-04. **Trạng thái:** `GO_FOR_PHASE0 / FULL_IMPLEMENTATION_NOT_YET_AUTHORIZED`.

Đây là **bản điều hành hiện hành** cho đợt chuẩn bị siêu nâng cấp. Không phải chứng nhận triển khai hoặc nghiệm thu SOH. Chưa thay code, chưa merge, chưa gửi bất kỳ Agent nào thực thi. Mọi quyết định mới của Creator trong cuộc trò chuyện được ưu tiên so với gợi ý assistant và bảng cũ. `v7/v8/v9` đính kèm **nguyên bản**, không xóa khả năng truy xuất.

## Đọc đúng thứ tự

1. `01_CANONICAL_PRODUCT_CONTRACT_v10.md` — quy tắc/những việc không được phép suy diễn.
2. `02_CONVERSATION_DECISION_HISTORY.csv` — quyết định, mức quyền, dấu vết lịch sử.
3. `03_SOURCE_CUSTODY_MANIFEST.json` — nguồn chính xác; **v5/v6 vẫn thiếu bản gốc byte-exact**.
4. `04_CORE_ACTIONS_21_ENGINEERING.csv` + `05_21_ACTION_ACCEPTANCE.csv` — 21 hành động và kiểm thử hành vi.
5. `06_CORE_ECONOMY_AND_WORLD_SOURCE_CONTRACT.md` + `07_BALANCE_AND_STRESS_PROTOCOL.md`.
6. `08_INPUT_MIGRATION_CONTRACT.md`, `09_OWNER_AND_INTEGRATION_PLAN.md`, `10_ACCEPTANCE_AND_GO_GATES.md`.
7. `11_AGENT_PHASE0_AND_EXECUTION_PROMPT.md` — **một prompt**, chặn pha thực thi chưa đủ nguồn/approval, cho phép tiến hành preflight hữu ích.
8. `data/` gồm JSON/CSV máy đọc được; `source_archives/` chứa nguyên ZIP v7/v8/v9.

## Phân biệt chứng cứ

- `CREATOR_LOCKED`: ý định/hành vi đã được người dùng xác nhận.
- `CREATOR_APPROVED_PRINCIPLE`: hướng được duyệt, số vẫn cần đo.
- `BIBLE_LOCKED`: hợp đồng hiện đang có hiệu lực trong `web/ref/bible.md`, chưa được sửa trên GitHub.
- `SOURCE_VERIFIED`: code GitHub hoặc file zip tồn tại tại SHA được chỉ định.
- `ENGINEERING_RECOMMENDATION`: cách triển khai đề xuất; Agent có thể làm PoC nhưng không được tự biến thành thay đổi thiết kế mâu thuẫn Creator.
- `OPEN_PRODUCT_DECISION`: cần chủ sở hữu sản phẩm chốt trước thay đổi gameplay tạo khác biệt.
- `NOT_RETRIEVED`: chưa có tài liệu gốc; không thổi phồng kết quả.

## Điều bắt buộc công khai trong handoff

Cả bộ nghiên cứu Atlas v5 và audit v6 từng được tạo ở lượt trước nhưng không còn truy cập được trong runtime hiện tại. **Không có ma trận 405 dòng, 104 gate, 51 recipe, 84 material nguyên bản ở đây**; thay bằng mục kiểm kê/sơ đồ và lệnh thu hồi bản gốc, không làm giả tái lập chính xác. Đây là blocker cho việc tuyên bố full coverage, nhưng không chặn đọc Bible/source và xây prototype an toàn trên nhánh chuyên trách nếu được phép.

**Cửa cuối:** trước khi đặt cờ `FULL_GO`, phải mở được source v5/v6 hoặc có một bản re-derivation có provenance được Creator/Control Tower chấp thuận, và đồng bộ hợp đồng v10 vào đúng thẩm quyền. Không hứa '100% DONE' từ một lệnh.
