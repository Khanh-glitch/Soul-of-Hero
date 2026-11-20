# Fishcamp — thuốc ở trong kho chứ không ở trong túi nhân chứng

Điểm xuất phát: save h24 của [lượt đối chứng 7606](../coast-62c9dae/README.md). `h5v`, thợ xây, gục ở (694,1676); kho cộng đồng có băng. Thầy thuốc `h5u` không nhìn thấy người bị thương từ chỗ mình. Người làm vườn `h5w` thấy nạn nhân nhưng không mang liều thuốc trong túi. Trước sửa, người không phải thầy thuốc có thể sơ cứu với thuốc đang cầm nhưng không thể đến lấy một liều từ chính kho của mình. Không có lý do để chữa từ xa hay tăng tầm nhìn.

- `control.json`: giữ nguyên mã `62c9dae`, cùng bản lưu và bước 2 giây. Sau 60 giây: vẫn gục, 1 HP, không có biên nhận điều trị. Không nói rằng nhân vật sẽ chết: ở lần lấy mẫu muộn hơn của lượt đối chứng họ vẫn còn sống.
- `continue.json`: `h5w` nhận việc sau 26,4 giây. Đường đến kho gồm 11 bước; xuất một liều từ chồng `s2de` tại `c2d5`, nhận `s128g` ở túi `c2e8`, trở lại đúng ô nhìn thấy lúc đầu. Save/Continue trong thời gian sơ cứu. Sau 38 giây kể từ h24, đã dùng đúng một liều: 1 → 31 HP. Không thêm thuốc, đổi vị trí hoặc ép giao việc. Nếu được người khác ổn định trước lúc dùng, nhân chứng ngừng và giữ nguyên liều trong túi (nhánh âm có kiểm soát); chăm sóc tiếp vẫn là việc của thầy thuốc.
- `tidecamp-replay.json`: biên nhận thực tế khi chạy lại save h61 sau thay đổi. Không ghi đè biên nhận phiên bản cũ; lịch uống nước có thay đổi.

Lặp lại: `cd web && npm test -- --maxWorkers=1 tests/npc-casualty-witness.test.ts`. Ca tự nhiên từ save, không phải bằng chứng trải nghiệm của người chơi hoặc bảo đảm sống đến h336.
