# LAST ISLAND → SOH: một set item thiết kế chính thức

**CURRENT DESIGN DECISION · 2026-11-15.** Creator đã chốt **ba nhóm item** (chỉ là các nhóm quyết định, không phải item categories trong game). Quyết định này thay những đề xuất Item Ontology V2 và PR #62 ngày 14/11 còn mâu thuẫn, đặc biệt kết luận cũ “giữ toàn bộ súng và đạn chỉ vì PvE có thể dùng chúng”.

## Chỉ đọc hai file này để lấy quyết định hiện hành

1. [FINAL_THREE_GROUP_ITEM_SET_20261115.md](FINAL_THREE_GROUP_ITEM_SET_20261115.md) — **bản thiết kế quyết định** có đủ 157 item, 19 retire, 6 legacy, cách xử lý 139 nguồn LI.
2. [FINAL_THREE_GROUP_ITEM_SET_20261115.json](FINAL_THREE_GROUP_ITEM_SET_20261115.json) — **một bảng machine-readable** cho việc triển khai/migration, chỉ có ba trạng thái ACTIVE A/B/C, RETIRE và LEGACY nằm ngoài active set.

**Con số thiết kế:** 78 item giữ vai trò LI, 42 item chuyển hóa theo bản chất SOH, 37 item thực sự SOH; **157** ID active-design bao gồm **24 pack công trình**, 3 seed mới và cửa điện còn pending. `web/src/game/catalog.ts` chưa được sửa; **không được gọi 157 playable**.

## Chỉ dùng những file còn lại làm dữ liệu nguồn/lịch sử

- `LI_SOURCE_ITEMS_AND_RECIPES.json`: dữ liệu 139 ID LI đa ấn bản, 82 hàng có công thức nguyên liệu, kèm độ tin cậy; chưa phải baseline verified đầy đủ của một phiên bản.
- `SOH_LI_ALIGNMENT.json`, `BIBLE_ITEM_DELTA_AUDIT.json`, `BIBLE_DELTA_RESULTS.md`, `SOH_147_ITEMS_BY_ROLE.md`: **AUDIT HISTORY ONLY · SUPERSEDED**, các verdict và con số cũ **không còn là quyết định chốt**.
- `web/ref/bible.md`: authority các cơ chế K1–K8. Các thay đổi có tính quyết định cho item dưới ba nhóm phải được hợp nhất lại Bible trước khi production; không tự xóa save cũ.

## Hợp đồng thực thi

Mọi item mới phải có physical source hoặc recipe+unlock, input/action, consumer, world consequence, durability/charges nơi phù hợp, run-local save/reset và nghiệm thu hành trình thật. Trường hợp chưa có nguồn chứng cứ không được bịa recipe, drop rate, giá hoặc claim playable. Không tự tăng scope so với roster để “tạo chiều sâu” và không đưa súng/đạn LI trở lại sau quyết định Core thay súng.
