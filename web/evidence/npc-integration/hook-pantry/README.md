# Hook — dỡ một phần ăn đã nấu vào kho đầy

So cùng đầu bếp `hm`, đơn `jah5`, bếp `e1ad`, nấm đầu vào `s2uo` và phần ăn `saha`. Seed 7606. Lấy bản lưu thường h8 của [lượt đối chứng](../coast-62c9dae/README.md); không thêm kho, món ăn, đường đi hay ý định làm việc. Đây là mô phỏng qua Continue, không phải thao tác của người chơi trong trình duyệt.

| Nhánh | Giờ giao phần ăn | Bằng chứng |
|---|---:|---|
| `62c9dae`, không sắp lại kho | h13:06 | `control.json`, lấy từ sổ giao hàng còn trong save h24 |
| Continue h8, đầu bếp có thể sắp lại kho | h8:19 | `continued.json`, biên nhận tại `c19v` cùng dòng giao `saha → saha` |

Kho đầy 12 ô, không còn ô cho món nấm nướng. Đầu bếp về đúng kho, gộp cả 3 thảo dược `s1a5` vào `s2uk` (từ 1 thành 4), rồi chuyển món đã trả nguyên liệu vào ô trống. Chỉ gộp chồng thực phẩm cùng loại, đủ chỗ, không có thuộc tính riêng; không xóa UID của hàng từng được giao, hàng giữ cho công việc hay hàng có quyền đòi lại. Không đổi kích thước kho, không dỡ hộ từ xa. Nếu không thể sắp lại thì hàng vẫn ở túi người mang. Lặp thao tác sau nạp lại không ghi thêm phần ăn.

```sh
cd web
npm test -- --maxWorkers=1 tests/npc-{natural-pantry,pantry-unload}.test.ts
```

Món này tới kho sớm hơn khoảng 4 giờ 46 phút. Không suy ra lượng người sống thêm; chỉ đo được việc một phần ăn thật đã đến sớm hơn. Kết quả h24/336 của lượt đối chứng không được gán cho mã mới.
