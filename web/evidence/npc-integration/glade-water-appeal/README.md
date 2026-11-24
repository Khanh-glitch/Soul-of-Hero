# Glade: người không tìm thấy nước đi tìm người giúp

**Ca tự nhiên, seed 7606, từ [save h51](../coast-62c9dae/h51.save.gz)**; không tạo người, đổi vị trí, cấp vật liệu hay đặt thời tiết. Đây là phép phát lại mô phỏng từ save, không phải lượt người chơi trên giao diện.

Trước sửa (`34b7c8a`), y sĩ `h4t` còn 9,06 điểm nước, không có bờ nước uống quanh mình. Thợ xây `h4s` còn gỗ phải giao vào một kho đầy. Hai người cách nhau khoảng 5,4 ô nhưng bị che khuất. Một bản sao để thăm dò cho thấy có đường 14 bước cho thợ tới kho và có ô xây hợp lệ. Trong 30 phút phát lại trên bản sao **không thăm dò**, không có thùng: y sĩ không nhờ được người mà mình không nhìn thấy. Có hái quả tự cứu; không kết luận họ đã chết trong nửa giờ này. Xem [đối chứng](control.json).

[Biên nhận sau sửa và số dư cuối](continue.json). Sau sửa, nếu quá khát (<25), không có nước trong tầm tay, không tìm được bờ nước và không thể hái để uống, người dân có thể đi về kho của chính làng để tìm trợ giúp. Điểm đến là kho quen thuộc, không phải tọa độ tra trước của thợ. Trên đường, chỉ một thợ xây cùng làng, nhìn thấy trực tiếp, rảnh và đủ sức mới nhận việc. Lời nhờ không đổi kho, không trả công việc cũ và không làm trời mưa.

| Từ h51 | Việc thực sự xảy ra |
|---|---|
| +4 phút 33 giây | Sau khi đi từ (1534,1380) đến (1538,1380), `h4t` mới lọt vào tầm nhìn của `h4s` ở (1536,1385). Thợ nhận việc `hw2e2j`; lưu giữa đường rồi Continue. |
| +4 phút 37 giây | Tại kho `c25z`, lấy 4 gỗ từ `s2zx` và 3 sợi từ `s2zu` vào túi `c26u`. Túi có sẵn 4 gỗ tự do. Ô định xây đầu tiên bị từ chối; không mất vật liệu và không dựng thùng ở đó. |
| +4 phút 58 giây | Gỗ `sg0e` đã giữ cho việc cũ `hjg0d` được giao đúng **một** vào chồng `s2zx`, không dùng làm vật liệu xây. |
| +5 phút 34 giây | Dựng thùng `e2e3x` từ đúng 8 gỗ + 3 sợi trong túi. Phút 12 thùng vẫn rỗng; biên nhận, người xây, kho, túi, lô hàng và thùng khớp giữa chạy liên tục và Continue. |
| +31 phút 9 giây | Trời mưa. Chính `h4t` đã tới uống **một đơn vị** từ `e2e3x`; ở phút 32 còn 95 HP và 30,72 điểm nước. Không suy ra sống tới ngày 14. |

Từ `web/`, chạy lại, bao gồm các ca âm (khuất tầm nhìn, thợ đã đi cùng người chơi, kho đã đổi chủ, không có đường):

```sh
SOH_GLADE_REPORT=/tmp/glade.json npm test -- --maxWorkers=1 tests/npc-glade-water-help.test.ts
```

Để tách phép phát lại ngắn trên khỏi tác động qua nhiều giờ, `scripts/npc-follow-checkpoint.mjs` có thể dùng trên hai thư mục mã nguồn độc lập. Script nạp cùng save và gọi `settle` tới cùng các mốc giờ tròn, giữ thông số từng người và biên nhận uống; không tái dùng các mốc dừng giữa đường của phép thử Continue.

```sh
node scripts/npc-follow-checkpoint.mjs "$PWD" evidence/npc-integration/coast-62c9dae/h51.save.gz h4t 61 /tmp/glade-h61.json
```

### Đối chiếu thêm 10 giờ: cùng người, cùng save, cùng mốc dừng

Hai tiến trình độc lập đều nạp `h51.save.gz`, dừng mỗi giờ tròn tới h61. Đã so SHA256 của save, hai tệp mã thay đổi với Git, seed, run ID và trạng thái h51. [Trước sửa `34b7c8a`](before-h61.json) và [sau sửa `b4a1196`](after-h61.json):

| Mốc | Y sĩ trước sửa | Y sĩ sau sửa |
|---|---|---|
| h51 | 95 HP, nước 9,06 | Cùng trạng thái |
| h55 | 95 HP, nước 0,05 | 95 HP, nước 59,05 |
| h56 | 10,66 HP, nước 0 | 95 HP, nước 52,80 |
| h57 | Đã chết; làng không có thùng | 95 HP, nước 46,55 |
| h61 | Vẫn chết; 5/7 dân làng còn hoạt động | 95 HP, nước 46,54; 6/7 còn hoạt động |

Từ h51 đến h61 có **4 biên nhận uống của chính `h4t`** từ cùng thùng: hai lần trong giờ đầu, rồi trong khoảng h54–55 và h58–59. Một người khác (`h4q`) đã chết từ h51 ở cả hai nhánh; không ai được hồi sinh. Mức chênh ở đây là kết quả tại Glade từ checkpoint này, **không** phải tỷ lệ cứu được trên toàn đảo, seed khác hay tới Ragnarok.
