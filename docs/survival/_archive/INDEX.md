# SOH — KHO TƯ LIỆU / ARCHIVE (KHÔNG PHẢI LUẬT GAMEPLAY)

**SOURCE OF TRUTH DUY NHẤT:** [Gameplay Bible](../CURRENT_PRODUCT_CONTRACT.md). Gameplay Tower, Map Tower, VFX Tower và mọi owner đọc Bible trước; tài liệu cũ chỉ mở khi cần tìm lịch sử, chứng cứ hay source.

## Các khu tham khảo

- [Snapshot bản Product Contract trước lần hợp nhất](snapshots/CURRENT_PRODUCT_CONTRACT_BEFORE_UNIFIED_BIBLE_20261101.md) — giữ nguyên bản trước khi viết Bible duy nhất.
- [Atlas nguyên bản 1.355 dòng](../source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md) — nguồn nghiên cứu gốc, KHÔNG phải luật gameplay.
- [Source Coverage Trace 108 mục](../SOURCE_COVERAGE_TRACE.json) / [Historical Mechanic Gate Matrix](../HISTORICAL_MECHANIC_GATE_MATRIX.json) — trace/era, không chứng nhận runtime.
- [Research folder](../research/) — nghiên cứu map/POI/Last Island, nhiều phương án chưa duyệt.
- [Reviews folder](../reviews/) — báo cáo nghiệm thu từng owner/SHA, không được tự thay Product Bible.
- [Tasks folder](../tasks/) — work order và prompt Agent, giữ đường dẫn vì còn có PR đang dùng.
- [CONTROL_TOWER_CURRENT](../CONTROL_TOWER_CURRENT.md) / [CHAT_REENTRY_HANDOFF_CURRENT](../CHAT_REENTRY_HANDOFF_CURRENT.md) — log vận hành, cần đọc khi thực thi, KHÔNG phải luật gameplay.

## Hồ sơ thiết kế cũ — đang được gom vào khu lưu trữ

- [Legacy Decisions](../DECISIONS.md) — lịch sử D001–D076, một số điểm đã bị thế chỗ; luật hiện tại ở Bible §0–VIII.
- [Legacy integration contracts](../CONTRACTS.md)
- [Legacy fusion architecture](../SYSTEM_FUSION_BLUEPRINT.md)
- [Legacy economy balance](../ECONOMY_AND_14DAY_REPLAY_BALANCE.md)
- [Legacy Atlas reconciliation](../ATLAS_RECONCILIATION_AND_DECISIONS.md)
- [Legacy Last Island research](../LAST_DAY_RULES_2019_2020_RESEARCH_ATLAS.md)
- [Legacy START_HERE](../START_HERE.md)
- [Legacy agent design brief](../AGENT_CURRENT_DESIGN_BRIEF.md)
- [Legacy New Chat Bootstrap](../NEW_CHAT_BOOTSTRAP.md)

## Khi nào mới cần tìm lại?

| Mục đích | Tài liệu mở | Không làm |
| --- | --- | --- |
| Hiểu cơ chế và trải nghiệm để thiết kế | **Chỉ Bible hiện hành** | Chọn luật theo báo cáo cũ |
| Xác minh lịch sử Last Island 2019–2020 | Atlas gốc + nguồn chính thức đúng thời kỳ | Ghép mode 2021–2026 vào 2019 |
| Biết tại sao một quyết định đổi | Decisions lịch sử/snapshot | Phục hồi máy bank cố định/Core xuyên mùa/PvP |
| Nghiệm thu code/CI/chạy thật | PR SHA, native logs, reviews, acceptance | Coi source PASS là trải nghiệm PASS |
| Thiết kế địa lý | Bible §V rồi mới mở research và đề xuất map | Dựa vào % buildable để chốt game |
| Điều chỉnh game | Sửa trực tiếp Bible + nhật ký §VIII | Tạo Gameplay Bible song song |

**LƯU Ý:** Bộ hồ sơ review/task đang được nhiều Agent trích dẫn nên chưa di chuyển gây 404. Archive là một vùng quản lý *chứng cứ và lịch sử*, không được công nhận là nguồn luật thứ hai. Các bản thiết kế lỗi thời sẽ được chuyển vào `legacy_design/` từng file có readback, đường dẫn cũ được giữ làm redirect để các Agent có thể tìm tới toàn văn.
