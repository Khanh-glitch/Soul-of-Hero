# Axe asset gap audit — 2026-07-15

## Kết luận

Giữ và tái sử dụng bộ Axe Warrior hiện có. Không tạo lại character sheet nền.
Bộ hiện tại đã đủ cho toàn bộ runtime Axe đang chạy; khoảng trống art gameplay
duy nhất cần xử lý là trạng thái **weaponless / throw / catch** của `Throw &
Recall`, vì rìu đang được bake trong mọi frame nhân vật trong khi projectile rìu
cũng xuất hiện ngoài nhân vật.

## Ma trận khoảng trống

| Phạm vi | Runtime cần | Đã có | Trạng thái | Hành động tối thiểu |
| --- | --- | --- | --- | --- |
| Character-form nền | 30 source action sheet, cell `120×80`, 149 frame, anchor `(60,80)` | 30/30 PNG, 149/149 frame; đủ Idle, Run, attack, hit, death, air, crouch, dash/roll/slide và wall states | **Hoàn chỉnh** | Tái sử dụng; không generate lại |
| Animation mapping | 34 tên animation runtime dùng 30 sheet duy nhất; timing/loop lấy từ manifest | `axe_warrior_animation_library.gd` map đủ; `source_manifest.json` có timing/loop | **Hoàn chỉnh** | Giữ nguyên contract |
| Heavy Cleave | charge pose, release attack, charge/cleave VFX | Character sheet cùng `axe_charge`, `axe_cleave` đã nối runtime | **Hoàn chỉnh** | Không cần art mới |
| Throw & Recall | throw pose, rìu rời tay, projectile, trail, catch/return | Projectile/spin/trail và logic đi–về đã có; character sheet vẫn giữ rìu bake khi rìu đang bay | **Thiếu presentation thật** | Chỉ bổ sung lớp/frame weaponless và transition throw/catch, hoặc giải pháp mask tương đương; không thay bộ 30 sheet |
| Axe Spirit / Follow-through | projectile rìu, path/trail, endpoint/return read | `axe_spin`, `axe_trail` và effect runtime đã có | **Gameplay đủ; polish tùy chọn** | Chỉ polish nếu playtest cho thấy khó đọc |
| Portrait / roster / reward card | Hình tĩnh cho UI | Có thể crop từ Idle làm placeholder; chưa có portrait production riêng | **Tùy chọn, không chặn gameplay** | Chỉ tạo khi chốt art direction UI |
| Commercial release | Bằng chứng quyền dùng mọi reference/input và generation record | Có nhiều bằng chứng kỹ thuật và prompt cục bộ, nhưng chưa có license/usage grant cho `FreeKnight_v1` và thiếu record prompt ban đầu của concept | **Chặn phát hành thương mại, không chặn prototype nội bộ** | Tìm/ghi lại license hoặc usage grant; không suy diễn quyền từ việc file đang có |

## Bằng chứng kỹ thuật đã kiểm tra

- Runtime asset: `res://assets/characters/axe_warrior/`.
- Nguồn cục bộ: `Documents/Codex/2026-07-14/fol/outputs/AxeWarriorRPG`.
- Cả 30 PNG runtime khớp byte-for-byte với nhánh nguồn
  `Colour1/Outline/120x80_PNGSheets`.
- SHA-256 `source_manifest.json`:
  `1B89FFD298CBA379C7B1495E004A40CC67AD114D45D0EC266D5708E60B830CC7`.
- Lượt kiểm thử gần nhất có bằng chứng cục bộ:
  `Character Form Asset 76/76`, `Axe Knight Integration 33/33`,
  `Axe Combat 19/19`, `Weapon Effects 25/25`.
- Project nguồn cục bộ còn giữ concept alpha/chroma, 12 prompt record targeted,
  generator/cleanup/QA script và report 821 assertions. Không có file chỉnh sửa
  `.aseprite`, `.kra` hoặc `.psd`.

## Bằng chứng provenance và giới hạn

- `FreeKnight_v1.zip` còn ở máy, SHA-256
  `133FFD63F05C2D0AF6620C5C6A78C198E6C1209CA601A6A7EC35EA10F88B8A8B`.
- Archive có 256 entry nhưng không chứa file mang tên license, readme, credit,
  terms, copying hoặc author.
- Các prompt targeted ghi rõ dùng built-in `image_gen`; shared prompt quy định
  FreeKnight chỉ làm motion/root/timing guide và cấm sao chép identity. Tuy vậy,
  record prompt ban đầu tạo Axe concept không được tìm thấy.
- Do đó có thể tiếp tục dùng bộ Axe trong prototype nội bộ, nhưng chưa được đổi
  trạng thái sang release-clear chỉ dựa trên bằng chứng hiện có.

## Quyết định thực thi

1. Không tạo hay thay 30 character sheet hiện tại.
2. Tiếp tục triển khai recruitment/campaign bằng bộ đang có.
3. Khi polish `Throw & Recall`, chỉ sản xuất phần weaponless/throw/catch còn
   thiếu và thêm test rằng không xuất hiện hai cây rìu cùng lúc.
4. Xử lý provenance như một release gate riêng, không gọi đó là thiếu asset
   gameplay.
