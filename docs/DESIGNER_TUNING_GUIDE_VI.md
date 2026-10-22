# Hướng dẫn chỉnh game bằng Designer — tiếng Việt, có giải thích ý nghĩa

Tài liệu này dành cho lúc bạn muốn chỉnh game nhưng không muốn đoán mò. Quy tắc quan trọng nhất: **mỗi lần chỉ chỉnh một mục tiêu**, ví dụ “quái Skeleton bớt trâu 15%”, rồi chạy thử. Đừng đồng thời đổi damage, HP, tốc độ và cooldown; khi đó bạn sẽ không biết thay đổi nào tạo ra kết quả.

## Luồng thao tác chung

1. Trong dock **Designer**, vào **Balance chi tiết**.
2. Chọn loại nội dung, sau đó chọn đúng asset và bấm **Chỉnh**.
3. Đổi số trong bảng. Mỗi ô số có giới hạn an toàn; di chuột lên tên số để xem gợi ý.
4. Nếu thấy nút **Mở: ...**, bấm để đi vào skill, weapon profile, wave hoặc phần con đang thật sự chứa số đó.
5. Bấm **Lưu nội dung này**. Nút này tự lưu đúng file chứa số vừa chỉnh.
6. Chạy game, thử đúng tình huống đã định. Nếu không ổn, sửa lại ngay hoặc bấm nạp lại/revert trước khi đổi thứ khác.

`1. Chỉnh Balance` chỉ là bộ số nền cho nhân vật người chơi. Muốn chỉnh một tướng, quái, skill, tỉ lệ spawn hoặc phần thưởng cụ thể thì luôn dùng **Balance chi tiết**.

## Cách hiểu nhanh các loại số

| Dạng số | Cách hiểu | Ví dụ |
| --- | --- | --- |
| Damage / Sát thương | Lượng máu mục tiêu mất mỗi lần trúng | 20 → 24 là tăng 20% damage |
| Health / HP | Máu tối đa | 100 → 85 làm kẻ đó dễ hạ hơn 15% |
| Cooldown / Hồi chiêu | Thời gian chờ, đơn vị giây | 4 → 3 là dùng skill thường xuyên hơn 33% |
| Speed / Tốc độ | Hầu hết là pixel/giây | 58 → 70 khiến quái áp sát nhanh hơn |
| Range / Radius / Distance | Khoảng cách/hitbox, hầu hết là pixel | 80 → 100 là vùng ảnh hưởng rộng hơn 25% |
| Ratio / Multiplier | Hệ số: `1.0 = 100%`, `0.5 = 50%`, `1.5 = 150%` | Damage ratio 0.6 nghĩa là 60% sát thương nền |
| Chance | Xác suất: `0.20 = 20%`, `1.0 = 100%` | Elite chance 0.20: trung bình 20% camp có Elite |
| Cap / Count / Maximum | Số lượng tối đa | Target cap 5: tối đa 5 mục tiêu bị ảnh hưởng |
| Telegraph | Thời gian báo trước đòn đánh, giây | 0.3 → 0.6 giúp người chơi dễ né hơn |
| Recovery | Thời gian hồi sau đòn, giây | 0.85 → 1.2 tạo cửa sổ phản công rộng hơn |

## 1. Chỉnh độ khó toàn game (chỉ số nền)

Nút **1. Chỉnh Balance** dùng cho cảm giác điều khiển chung của nhân vật chính, không phải balance từng tướng.

| Bạn muốn | Chỉnh số | Hướng an toàn |
| --- | --- | --- |
| Di chuyển nhanh/chậm hơn | Tốc độ chạy | đổi 5–10% mỗi lần |
| Né dễ hơn | Hồi lướt, thời gian lướt | giảm hồi 10–20%, không giảm về 0 |
| Người chơi trâu hơn | Máu tối đa | tăng 10–20%, thử boss trước |
| Combat nhanh hơn | Sát thương đánh nhẹ/mạnh | tăng 5–15%, không tăng mọi nguồn damage cùng lúc |
| Combo dễ duy trì hơn | Thời gian reset combo | tăng từ 0.55 lên 0.65–0.75 giây |

Sau khi đổi, bấm **2. Áp dụng** để game runtime đọc số mới. Đây là chỗ duy nhất cần nút Áp dụng riêng.

## 2. Balance từng tướng và từng chiêu

Chọn **Tướng + chiêu** → chọn Hero → **Chỉnh**.

### Nên chỉnh ở Hero khi nào?

- `Base damage`: damage nền của tướng, phù hợp khi muốn buff/nerf toàn bộ bộ kỹ năng dùng damage nền.
- `Combo damage multipliers`: từng nhát trong combo mạnh/yếu tương đối. Ví dụ `1.0, 1.1, 1.6` nghĩa nhát ba mạnh hơn nhát đầu 60%.
- `Active skill cooldown seconds`: thời gian chờ kỹ năng chủ động.
- `Active skill mana cost`: mana cần để dùng skill.
- `Target cap`, `radius`, `range`, `width`: độ rộng và số mục tiêu skill có thể đánh.
- `...damage ratios`: danh sách hệ số damage. Ví dụ Wizard density ratio `0.60` là 60% damage nền ở tier đó.

Nếu Hero có nút **Mở: Sword / Bow / Axe / Wizard Staff**, bấm nó: đó là nơi chứa số của vũ khí và skill thực tế. Không chỉnh `Base damage` nếu mục tiêu của bạn chỉ là nerf một skill cụ thể.

### Ví dụ: Wizard mạnh quá ở skill chuột phải

1. Chọn **Tướng + chiêu** → `wizard_hero` → **Chỉnh**.
2. Tìm `Wizard RMB Density Damage Ratios`.
3. Giảm mỗi số khoảng 10%, ví dụ `0.60, 0.75, 1.05` thành `0.54, 0.68, 0.95`.
4. Lưu, thử đúng tình huống nhiều quái.

Đừng đổi đồng thời ratio, cooldown, target cap và radius. Mỗi yếu tố tạo cảm giác khác nhau:

- ratio: mỗi hit đau hơn/yếu hơn;
- cooldown: dùng thường xuyên hơn/ít hơn;
- target cap: đánh được nhiều/ít quái hơn;
- radius: dễ/khó chạm nhiều quái hơn.

## 3. Vũ khí và skill

Chọn **Vũ khí + kỹ năng** → chọn weapon → **Chỉnh**. Bấm **Mở** tại `Normal Attack`, `Hand Skill`, `Spirit Trigger`, hoặc `Spirit Action` để đến đúng profile.

| Mục tiêu | Chỗ nên chỉnh |
| --- | --- |
| Nerf/buff đòn đánh thường | `Normal Attack` → combo damage / hit window / range |
| Nerf/buff skill bấm tay | `Hand Skill` → damage, cooldown, mana cost, radius/range |
| Chỉnh skill linh hồn | `Spirit Action` → damage, cooldown, speed, target cap |
| Skill khó đánh trúng | projectile speed, range, width, radius |
| Skill quá an toàn | cooldown, range, target cap hoặc movement speed multiplier |

`Movement speed multiplier` là hệ số tốc độ khi đang dùng đòn/skill. `0` thường nghĩa là không được di chuyển, `1.0` là giữ nguyên tốc độ.

## 4. Quái: HP, damage, nhịp tấn công và độ dễ né

Chọn **Quái + Elite + tỉ lệ** → chọn quái → **Chỉnh**.

| Số | Ý nghĩa thực tế |
| --- | --- |
| Max health | Quái sống lâu bao nhiêu |
| Movement speed | Quái bám người chơi nhanh thế nào |
| Preferred range | Quái muốn đứng cách mục tiêu bao xa |
| Attack range | Tầm có thể ra đòn |
| Awareness range | Khoảng cách bắt đầu nhận ra người chơi |
| Telegraph seconds | Thời gian “ra dấu” trước đòn; tăng số này làm dễ né |
| Recovery seconds | Khoảng nghỉ sau đòn; tăng làm dễ phản công |
| Attack cooldown seconds | Khoảng cách giữa các đòn; tăng làm nhịp tấn công chậm hơn |
| Attack damage | Damage một đòn |
| Stagger damage/resistance | Khả năng gây/kháng bị khựng |
| Crowd control resistance | Kháng khống chế từ 0 đến 1; `0.4 = kháng 40%` |

### Công thức sửa độ khó an toàn

- Quái **trâu nhưng công bằng**: giảm `Attack damage` 10% hoặc tăng `Telegraph` 0.1–0.2 giây; giữ HP.
- Quái **quá lâu chết**: giảm `Max health` 10–15%; giữ damage.
- Quái **đuổi quá gắt**: giảm `Movement speed` 5–10%; không cần giảm toàn bộ range.
- Boss **dễ nhưng không mất chất boss**: tăng `Recovery` hoặc `Telegraph` trước, đừng giảm HP một nửa.

## 5. Elite và các tỉ lệ ngẫu nhiên

Trong **Quái + Elite + tỉ lệ**:

- `Elite Spawn Policy` → `Chance per camp`: xác suất một camp có Elite. `0.20` chính là 20%.
- `Health multiplier`: HP Elite nhân lên. `2.25` là 225% HP quái thường.
- `Damage multiplier`: damage Elite nhân lên. `1.35` là 135% damage.
- `Attack rate multiplier`: nhịp đánh. Lớn hơn 1 là ra đòn nhanh hơn.
- `Reward score multiplier`: phần thưởng/score nhân lên.

Khuyến nghị khởi đầu: Chance 10–20%, HP x1.5–2.0, damage x1.15–1.3. Nếu Elite xuất hiện nhiều, đừng đồng thời để HP và damage quá cao.

## 6. Wave, encounter và số lượng quái

Chọn **Đợt quái / Encounter** → encounter của ải → **Chỉnh** → mở Wave → mở Group.

- `Start delay seconds`: chờ trước khi wave bắt đầu.
- `Inter group delay seconds`: thời gian nghỉ giữa các group trong cùng wave.
- Các group/spawn entry: quy định loại quái, số lượng, vị trí/marker và nhịp xuất hiện.
- `Objective`: điều kiện hoàn thành; chỉ chỉnh nếu bạn hiểu đúng flow ải.

Muốn ải đỡ ngộp, ưu tiên tăng delay hoặc giảm một group nhỏ trước. Thay đổi 5 camp cùng lúc sẽ làm khó biết nguyên nhân nhịp chơi tốt/xấu.

## 7. Reward, Item và kinh tế

Chọn **Thưởng + Item**.

- Reward bundle: tiền, Hero Material, Monster Fragment, cấp nhân vật, item stack, Hero Soul, trang bị phụ.
- Item definition: tên hiển thị, mô tả, icon, loại item, stack capacity.
- Không xóa hoặc đổi `ID` của item/reward đã phát hành. Nó có thể liên quan save cũ và reward đã nhận.

Muốn tăng cảm giác có thưởng, tăng một loại currency hoặc thêm đúng một item. Đừng tăng mọi reward cùng lúc vì sẽ phá tốc độ progression.

## 8. VFX

Chọn **VFX** → `vfx_library` → **Chỉnh** → mở profile cần sửa.

| Số | Ý nghĩa |
| --- | --- |
| Texture / Đổi file | spritesheet của effect |
| Cell size, frame count, columns | cách cắt spritesheet thành animation |
| Frames per second | animation nhanh/chậm |
| Base scale | effect to/nhỏ |
| Tint | màu effect |
| Local position offset | lệch vị trí xuất hiện; X theo hướng đòn, Y cao/thấp |
| Rotation offset degrees | xoay effect so với hướng đòn |
| Default Z index | effect nằm trước/sau các sprite khác |

Giữ nguyên `Effect ID` nếu chỉ muốn thay hình/nhịp VFX cũ. Đổi ID chỉ khi đã biết chính xác skill/scene nào tham chiếu tới ID đó.

## Những thứ không nên đổi khi chưa rõ

- `ID`, `behavior ID`, `scene`, `base scene`, `layout type ID`.
- số phần tử trong các mảng combo/ratio nếu không hiểu ràng buộc; hãy ưu tiên đổi giá trị sẵn có.
- liên kết wave/objective/reward đã có ID.
- resource rỗng/chưa gán nếu không biết nó cần loại asset nào.

Nếu lỡ chỉnh sai, đừng lưu. Nếu đã lưu, dùng Git/backup hoặc nhắn tôi kèm ảnh bảng đang chỉnh và mục tiêu muốn đạt — tôi sẽ chỉ đúng một vài số cần đổi, thay vì bắt bạn chỉnh mò.
