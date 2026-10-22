# Keeptrack index

Trang này là điểm vào duy nhất để biết tài liệu nào mô tả runtime hiện tại và
tài liệu nào chỉ còn là lịch sử. Khi code và tài liệu cũ mâu thuẫn, ưu tiên
contract executable + audit `CURRENT` mới nhất.

## Current

- `KEEPTRACK_POWER_LEVEL_REBALANCE_2026_07_16.md` — authority hiện hành cho
  Level/HP/Mana/Power, damage của player và quái, Vessel/Boots/Jewelry, rank/đá
  nâng cấp, Field Codex 30 ô với 4 chỉ số lõi + 12 chỉ số hiệu dụng có preview
  `+/-`, rarity presentation, backpedal-facing, migration Stat/equipment economy
  và evidence sau cập nhật.
- `CONTINUOUS_RUN_LOOT_LOOP_2026_07_16.md` — contract loop loot/save realtime.
- `README.md` — khả năng sản phẩm hiện có và đường chạy project.

## Historical / chỉ dùng để so sánh

- `KEEPTRACK_CORE_BALANCE_UPDATE_2026_07_16.md` — **SUPERSEDED** đối với
  progression/damage; giữ làm bằng chứng cho đợt enemy authority, XP, Elite,
  reward và Axe trước khi Level offense được chuyển sang Power.
- `AUDIT_VAN_HANH_CON_SO_HIEN_TAI_2026_07_16.md` — snapshot **PRE-UPDATE**;
  dùng để hiểu nguyên nhân thay đổi, không dùng làm con số runtime hiện hành.
- `IMPLEMENTATION_STATUS_V0_4.md` — mốc V0.4; các con số economy trong đó có
  thể đã bị supersede.
- `AUDIT_TONG_THE_PHIEN_CHAT_2026_07_15.md` — audit phiên trước.
- `TEST_PLAN.md` — baseline legacy; gate hiện hành là
  `tools/run_full_regression.ps1`. `run_living_arsenal_tests.ps1` đã retired.

## Quy ước cho mọi cập nhật lớn tiếp theo

Mỗi cập nhật lớn phải ghi thêm một keeptrack có tối thiểu:

1. phạm vi và verdict `CURRENT`, `SUPERSEDED` hoặc `HISTORICAL`;
2. before/after ở mức outcome, không chỉ liệt kê file đã sửa;
3. authority của từng con số và thứ tự modifier;
4. migration/save compatibility nếu economy thay đổi;
5. test evidence trên runtime và giới hạn chưa được chứng minh;
6. cập nhật trang index này để chỉ còn đúng một audit balance mang nhãn
   `CURRENT`.

Không nâng trạng thái chỉ vì công thức trông hợp lý. Một thay đổi chỉ được tính
là đã triển khai khi code/resource live, migration cần thiết và gate liên quan
đều đã được cập nhật.
