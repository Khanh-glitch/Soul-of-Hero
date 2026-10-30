# SOH — BẢNG FINAL CANDIDATE v0.1 · one-map many-runs · for user review

**DRAFT NOT USER-RATIFIED | 2026-10-30 | NO AGENT DISPATCH | NOT PRODUCTION ACCEPTANCE**

## Định nghĩa trạng thái (TÁCH KHỎI LỊCH LẬP TRÌNH)
- USER_WANTS: user đã thể hiện muốn đưa vào game cuối, không phải đã nghiệm thu triển khai hoặc cho phép tôi tự chốt toàn bộ tiểu tiết.
- CT_PROPOSES: tôi chọn hướng đề xuất về tính logic/kỹ thuật, cần thông báo và user có thể phủ quyết.
- ASK_USER: hướng trải nghiệm/quy tắc mùa cần user lựa chọn, không thể lấy từ nghiên cứu gốc.
- ASK_USER_LATER: phải có A4 Gold catalog/benchmark trước khi hỏi con số cụ thể.
- TASTE_REVIEW: có tiềm năng nhưng user chưa lựa chọn đủ mạnh; KHÔNG phải kho chỉ vì khó code.
- PARKED_NOT_LOVED: chưa thấy hấp dẫn / không hợp hướng vào lúc này, giữ lưu hồ sơ để có thể xem lại; đúng nghĩa 'hàng chờ' theo user.
- REJECTED: user không muốn hoặc mâu thuẫn pháp lý/logic; không mặc định hồi sinh.

**57 nhóm đầu mục biên tập** (không phải 54 D quyết định hay 44 SYS/26 package): USER_WANTS 35; CT_PROPOSES 5; ASK_USER 5; TASTE_REVIEW 2; ASK_USER_LATER 1; PARKED_NOT_LOVED 3; REJECTED 6. Số nhóm có thể thay đổi khi tách/gộp tính năng, tuyệt đối không coi là số lượng feature code/gameplay pass.

## Insight trung tâm mới nhất
**Một map có thể học thuộc, một run có điểm kết thúc, nhiều chiến lược không thể làm hết trong ~14 ngày trải nghiệm.** Nhà ở đâu quyết định đường tài nguyên/đánh quái/POI/Skill Core; vật liệu và thời gian là cơ hội phải hy sinh. Người chơi nhớ một cửa phòng chưa mở/Skill Core vừa thấy/biome chưa thăm và chủ động chọn mở đầu khác khi chơi lại trên cùng map. Map không cần procedural đảo hết địa lý; sáng tạo đến từ mục tiêu cạnh tranh, sinh vật/mùa thời tiết/loot động có lý và player knowledge/agency. Không khóa “≥3 mục tiêu” như một mục tiêu độ sâu; đó chỉ là một tầng gate test trước đây.

## Bảng thảo luận

### Bản đồ
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB01 | Bản đồ lớn duy nhất; landmarks và địa lý ổn định qua các ván | USER_WANTS | Giữ khả năng ghi nhớ/lập kế hoạch tuyến |
| FB02 | Biome có nguyên nhân, nguồn tài nguyên, địa hình, thời tiết | USER_WANTS | Không rải tile ngẫu nhiên |
| FB03 | Nhiều POI vật lý có phòng/khóa/điện/đường phụ/hazard | USER_WANTS | Không có hàng trăm dấu map rỗng |
| FB04 | Rất nhiều mục tiêu khám phá và thành tựu khác nhau | USER_WANTS | Không phải một main quest tuyến tính |
| FB05 | 10 dungeon cũ chỉ là nguồn tái sử dụng có chọn lọc | USER_WANTS | Không bắt buộc gắn vào survival map |
| FB06 | Fog/Codex và thông tin phát hiện theo dấu vết có lý do | CT_PROPOSES | Không spoiler, không bí ẩn vô lý |

### Mùa chơi & replay
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB07 | Một cuộc chơi hữu hạn, có điểm kết thúc rõ ràng | ASK_USER | Thời lượng/mốc kết thúc một run |
| FB08 | Quy tắc reset world, nhà, kho, Core và công thức | ASK_USER | Chưa có luật được user chốt |
| FB09 | Đồng hồ 14 ngày theo lịch thực hay thời gian chơi | ASK_USER | Không lấy số 2019 làm số SOH |
| FB10 | Các vị trí nhà khác dẫn đến chiến lược riêng | USER_WANTS | Thời gian/tài nguyên tạo chi phí cơ hội |
| FB11 | Cùng map, học địa điểm/Core qua mỗi lần chơi lại | USER_WANTS | Tri thức người chơi có giá trị |
| FB12 | Nguồn loot/địch/thời tiết biến thiên vừa đủ qua ván | CT_PROPOSES | Không xáo trộn lục địa vô cớ |
| FB13 | Khởi đầu cố định, ngẫu nhiên hay lựa chọn vị trí | ASK_USER | Chi phối replay và độ khó |

### Nhà & xưởng
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB14 | Nhà một tầng, xây tường/cửa/lối đi/đặt máy | USER_WANTS | Physical construction, no prefab-only |
| FB15 | Một lớp mái đơn giản, fade và vùng shelter thật | USER_WANTS | Không xây mái nhiều lớp |
| FB16 | Kho, giường, phòng an toàn và hồi sinh | USER_WANTS | Căn cứ có chức năng thật |
| FB17 | Nâng cấp vật liệu, phòng thủ, sửa chữa công trình | USER_WANTS | Có ý nghĩa trong solo PvE |
| FB18 | Xưởng/lò/fuel/điện/bàn nghiên cứu, hàng chờ thật | USER_WANTS | Căn cứ là hệ kinh tế |
| FB19 | Nông trại, nấu ăn, heat/comfort hợp lý | USER_WANTS | Có chiến lược ít phải đi farm |
| FB20 | Tiền đồn, kho tiếp tế, tuyến đi xa | CT_PROPOSES | Đo giá trị logistics trước khi thêm |

### Sinh tồn
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB21 | Chặt cây, đào đá, thu hoạch tự do không cần Core | USER_WANTS | Khởi đầu bằng melee vẫn vui |
| FB22 | Loot dọc đường; vật liệu, Spares, rare clues | USER_WANTS | Mỗi chuyến có giá trị khác nhau |
| FB23 | Mất đồ, túi chết, giường, thu hồi đúng đồ | USER_WANTS | Độ khó và timer còn phải cân |
| FB24 | Thời tiết có hậu quả, có phương án ứng phó | USER_WANTS | Được user muốn rõ ràng |
| FB25 | Mức đói, khát, rét, bệnh và phạt sinh tồn | ASK_USER | Cảm giác khắc nghiệt chưa chốt |

### Kinh tế
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB26 | Luyện quặng, chế tạo vật liệu nhiều tầng | USER_WANTS | Nâng công cụ đổi hành động |
| FB27 | Ba cách nghiên cứu, vật mẫu và bí kíp vĩnh viễn | USER_WANTS | Không biến nghiên cứu thành roulette vô nghĩa |
| FB28 | Vật phẩm khác công thức khác specimen/Skill Core | USER_WANTS | Đủ hành vi dùng/cất/nghiên cứu |
| FB29 | Spares, vật liệu cũ được dùng lại sau nâng cấp | USER_WANTS | Loot thường có sink về sau |
| FB30 | Hao mòn, sửa chữa, bảo dưỡng có chi phí | USER_WANTS | Chọn giữ, dùng hoặc tái sản xuất |
| FB31 | NPC merchant, bounty, market | TASTE_REVIEW | User thấy ổn, chưa thích tới mức chốt |

### Skill & combat
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB32 | Melee/combat hữu ích trước khi có Core | USER_WANTS | Tránh ép farm Boss để chơi được |
| FB33 | Bảo toàn toàn bộ skill Gold gốc kể cả world/enemy | USER_WANTS | Source exact, không vẽ na ná |
| FB34 | Core hữu hạn, tìm, equip, dùng, cất, nghiên cứu | USER_WANTS | Khoảnh khắc đầu tiên nên được thử dùng |
| FB35 | Bao nhiêu loại Core/kỹ năng/slot/độ hiếm | ASK_USER_LATER | Cần A4 map Gold->gameplay trước |
| FB36 | Giảm sáng môi trường thông minh khi cast để Gold nổi bật | USER_WANTS | Không làm mờ/đổi nguồn Gold |
| FB37 | Đóng băng nước, cấp điện, tường đá theo Gold | TASTE_REVIEW | Ý tưởng hay, chỉ hợp lệ nếu Gold nguồn hỗ trợ |
| FB38 | Boss/elite và mục tiêu quái nguy hiểm đa dạng | USER_WANTS | Một hướng chơi, không phải duy nhất |

### Quái
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB39 | AI biết đi vòng, phá tường/cửa, người chơi sửa lại | USER_WANTS | User yêu cầu rõ |
| FB40 | Dấu chân/mùi phân rã, quái truy theo về nhà | USER_WANTS | Có dấu hiệu và phản chế, chỉ mô phỏng offline app khi có luật |
| FB41 | Chủ động dụ quái quanh vùng để farm/thủ thành | USER_WANTS | Chống score/loot farming, rõ rủi ro |

### Phương tiện
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB42 | Xe kéo/cargo có va chạm và rủi ro vận chuyển | USER_WANTS | Không chỉ tăng slots |
| FB43 | Thú cưng/thú cưỡi hiếm, có ích thật | USER_WANTS | User nói bắt buộc phải có |
| FB44 | Thuyền/phương tiện khác nếu có lộ trình phù hợp | CT_PROPOSES | Không cần sao chép mọi xe hiện đại |

### Nhân vật & HUD
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB45 | Hai nhân vật nam/nữ bald, giáp cấp đổi đúng người | USER_WANTS | Không giữ Knight/5 Hero cũ làm roster |
| FB46 | HUD/inventory/map/Codex đủ đẹp, dễ chơi, sắc nét | USER_WANTS | 720p,2K,4K, không debug |

### Nền tảng cập nhật
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB47 | Single SaveService, receipts, migration, typed domain interfaces | CT_PROPOSES | Chọn chuẩn cập nhật dài hạn |
| FB48 | Repository-first và giấy phép nguồn đúng | USER_WANTS | Công khai không luôn có quyền redistrib |

### Kho ý tưởng
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB49 | Khu expedition tách biệt reset riêng | PARKED_NOT_LOVED | User thấy thiếu logic khi đã có một run theo mùa |
| FB50 | Chiếm đất chính trị/guild và đại chiến 49 vùng | PARKED_NOT_LOVED | Không có nhu cầu solo rõ |
| FB51 | Pet fusion/gacha và cơ chế đời 2026 không ăn nhập | PARKED_NOT_LOVED | Chỉ xét nếu về sau thấy thú vị |

### Đã loại
| ID | Nội dung | Trạng thái | Lý do/hàng rào |
|---|---|---|---|
| FB52 | PvP người thật bắt buộc và cướp offline | REJECTED | User không thích |
| FB53 | Năm Hero cũ làm playable roster | REJECTED | User đã nói bỏ hết |
| FB54 | Bắt buộc đặt đủ 10 dungeon cũ trong world mới | REJECTED | Tái sử dụng tùy hợp lý |
| FB55 | Mái nhiều tầng, đặt từng ngói, công trình 3D kiểu shooter | REJECTED | Sai tỉ lệ giá trị cho top-down |
| FB56 | Đồ họa ngẫu nhiên/site rỗng/UI rác/timer grind | REJECTED | Không tạo lựa chọn thật |
| FB57 | Sao chép source không có license, parallel SaveManager | REJECTED | Phải chọn đúng nguồn và authority |

## Chốt đầu tiên cần hỏi user (không hỏi 57 ý một lượt)
1. Một SOH **run** thật sự kết thúc theo luật nào? a/ 14 ngày lịch thực (kể cả thời gian tắt app); b/ 14 ngày active/chơi thực hoặc in-game cycles, pause ngoài game; c/ không ép lịch kết thúc, chỉ 14 ngày là cảm hứng và người chơi tự start next run. CT nghiêng về seasonal finite run nhưng chống offline calendar punishment; KHÔNG tự khóa.
2. Nếu run reset: reset vật phẩm, nhà, Core, blueprint tri thức, khám phá, map events, achievements theo scope nào? Tôi nghiêng về nhà/kho/Core/tri thức công nghệ trong run đều reset, còn ghi chép kỷ lục/đạt thành tựu được giữ dưới meta không tăng power. CẦN user xem.
3. Một map ổn định nên có spawn tự chọn/gần vùng ngẫu nhiên, loot/hazard thay đổi thế nào mỗi run? Tôi nghiêng về stable geography, reset điểm xây nhà, nguồn loot và sinh vật đổi có nguyên nhân, nhiều đường chơi; không nên ngẫu nhiên hóa vị trí các di tích trọng yếu.
4. Lựa chọn muộn: mức phạt đói/khát/death, hiếm của Core và số lượng loại/slot, sau khi engine/audio/gameplay Gold có bằng chứng.

## Nguồn & tránh false lock
Từ lúc chuyển hướng 2026-10-29: tài liệu gốc trong Google Docs tabs 01/02/03; Atlas 1.355 dòng, 44 SYS/21 POI/31 DEP/12 JOURNEY; DECISIONS D001-D054, bản hậu kiểm, 26-package, user round1 correction (dungeon reuse, 1-floor roof, weather/cart/pets/tracking/Gold dimming, reset reconsideration, engineering updateability). Prototype issue23 P1–P8, development4 safety and S6 POI design. Sources có lời trợ lý trong tab 01 nên không phải mọi câu được ghi ở đó đều là quyết định user. Cấm tự đổi trạng thái bản final từ DRAFT sang LOCKED; cần user rà soát và chốt. B0/B1/B2 là progress gate riêng, không được dùng như nhãn hàng chờ. Next: ask Q1, then Q2, then review all user taste exceptions before marking FINAL. Source of truth: docs/survival/CHAT_REENTRY_HANDOFF_CURRENT.md; before any future agent prompt refresh Git and this ledger.
