# Quy trình thiết kế UI thuần kéo-thả trong Godot

Bạn không cần mở hay sửa GDScript để thiết kế giao diện. Project cung cấp một workbench và các scene component độc lập, tất cả đều chỉnh được bằng Scene Tree, Inspector và thao tác kéo-thả.

## Mở catalog thiết kế

1. Trong FileSystem, mở `res://game/ui/designer/workbench/ui_workbench.tscn`.
2. Nhấn **F6** để xem toàn bộ font, màu, button state, HUD, card, dialog, navigation, input glyph và asset branding trong đúng logical viewport 640×360.
3. Cuộn catalog để chọn component phù hợp.

Workbench chỉ là bảng mẫu, không tham gia gameplay và không chứa script.

Nếu muốn bắt đầu nhanh, duplicate một trong hai template:

- `res://game/ui/designer/templates/fullscreen_screen_template.tscn`: menu hoặc màn hình toàn trang;
- `res://game/ui/designer/templates/hud_overlay_template.tscn`: HUD gameplay trong khung 640×360.

## Kéo một component vào giao diện

1. Mở scene giao diện đích, ví dụ `res://game/ui/screens/title/title_screen.tscn`.
2. Trong FileSystem, mở `res://game/ui/designer/components/`.
3. Kéo file `.tscn` mong muốn vào một `Container` hoặc `Control` trong Scene Tree.
4. Nhấp phải instance vừa tạo và chọn **Editable Children**.
5. Chọn node con rồi chỉnh trong Inspector:
   - `Text`: nội dung và nhãn;
   - `Texture`: icon, ảnh hoặc input glyph;
   - `Custom Minimum Size`: kích thước tối thiểu;
   - `Layout > Container Sizing`: cách component co giãn;
   - `Theme Overrides`: màu, font size, khoảng cách;
   - `Theme Type Variation`: kiểu `TitleLabel`, `CardPanel`, `PrimaryButton`, v.v.
6. Lưu scene bằng **Ctrl+S** và chạy riêng bằng **F6** để xem.

Nếu muốn biến một bản đã chỉnh thành component mới, chọn nhánh node rồi nhấp phải **Save Branch as Scene**. Lưu dưới `res://game/ui/designer/components/custom/` hoặc một thư mục riêng của bạn.

## Component có sẵn

| Scene | Công dụng |
|---|---|
| `brand_header.tscn` | Logo, tên game/chương và tiến độ |
| `stat_cluster.tscn` | HP, thể lực và Soul với ba màu riêng |
| `action_deck.tscn` | Combo, Soul Echo, Dash, Relay và glyph J/K/Space/Q |
| `content_card.tscn` | Hero, quái, level, vật phẩm hoặc dossier |
| `dialog_card.tscn` | Popup xác nhận hai hành động |
| `navigation_bar.tscn` | Năm tab Hub có icon |
| `prompt_toast.tscn` | Prompt tương tác E |
| `inventory_slot.tscn` | Slot vật phẩm/action asset-backed |

Các component không có signal hoặc script bắt buộc. Bạn có thể dùng chúng làm visual prototype. Khi đặt vào một màn hình runtime hiện hữu, script của màn hình vẫn sở hữu hành vi.

## Tự dựng một màn hình mới không dùng code

1. Tạo scene với root `Control`.
2. Chọn **Layout > Full Rect**.
3. Kéo `res://game/ui/theme/dungeon_backdrop.tscn` vào làm nền nếu cần.
4. Trong Inspector của root, gán `Theme` thành `res://game/ui/theme/living_arsenal_theme.tres`.
5. Thêm `MarginContainer` Full Rect, đặt margin an toàn tối thiểu 8 px.
6. Thêm `VBoxContainer`, `HBoxContainer` hoặc `GridContainer` để tạo bố cục.
7. Kéo các component vào container. Hãy để container điều khiển vị trí thay vì nhập từng tọa độ thủ công.
8. Dùng `PanelContainer` với một trong các variation:
   - `CardPanel`: nội dung thông thường;
   - `ElevatedPanel`: modal hoặc khối chính;
   - `HudPanel`: HUD nhỏ gọn;
   - `PromptPanel`: input prompt/callout.
9. Dùng `Button` với `PrimaryButton`, `NavigationButton` hoặc `ActionButton` tùy vai trò.

## Bộ asset chỉnh trực tiếp trong Inspector

| Nhóm | Đường dẫn | Cách dùng |
|---|---|---|
| Theme tổng | `res://game/ui/theme/living_arsenal_theme.tres` | Kéo vào thuộc tính `Theme` của root |
| Emblem | `res://assets/branding/soul_hero_emblem_imagen.png` | Kéo vào `TextureRect.Texture` |
| Chapter key art | `res://assets/branding/chapter_1_key_art_imagen.png` | Dùng cho title/level card/background |
| Fantasy icons | `res://assets/ui/fantasy_icons.png` | Tạo `AtlasTexture`, mỗi ô 32×32 |
| Input prompts | `res://assets/ui/input_prompts/tilemap_packed.png` | Tạo `AtlasTexture`, phần lớn glyph 16×16 |
| Inventory chrome | `res://assets/ui/free_inventory/` | Slot, selection, bar và background pixel |
| Fonts | `res://assets/fonts/` | Đã gán qua theme; override khi thực sự cần |

Để cắt một icon từ atlas: tại thuộc tính `Texture`, chọn **New AtlasTexture**, kéo file atlas vào trường `Atlas`, rồi nhập `Region`. Fantasy icon dùng lưới 32×32. Input prompt thường dùng 16×16; Space là 48×16. Bạn có thể copy một TextureRect mẫu từ Workbench để không cần nhập region lại.

## Màn hình runtime có thể chỉnh bằng tay

| Giao diện | Scene |
|---|---|
| Title | `res://game/ui/screens/title/title_screen.tscn` |
| Hub khung chính | `res://game/ui/screens/hub/hub_screen.tscn` |
| Campaign | `res://game/ui/screens/hub/tabs/campaign_tab.tscn` |
| Hero roster | `res://game/ui/screens/hub/tabs/arsenal_tab.tscn` |
| Bestiary | `res://game/ui/screens/hub/tabs/bestiary_tab.tscn` |
| Modes | `res://game/ui/screens/hub/tabs/modes_tab.tscn` |
| Settings | `res://game/ui/components/settings_panel.tscn` |
| Level detail | `res://game/ui/screens/level_details/training_details_screen.tscn` |
| Gameplay HUD | `res://game/ui/HUD.tscn` |
| Results | `res://game/ui/screens/results/training_results_screen.tscn` |
| Credits | `res://game/ui/screens/credits/credits_screen.tscn` |

## Quy tắc để không làm hỏng hành vi runtime

- Không đổi tên hoặc xóa node có biểu tượng **Unique Name** (`%`) trong màn hình đang chạy.
- Không gỡ script khỏi root của Title, Hub, HUD, Settings, Results hoặc Level Detail.
- Có thể chỉnh anchors, offsets, container, text, texture, theme và thứ tự visual.
- Khi muốn thay cấu trúc lớn, hãy duplicate scene trước rồi thử bằng F6.
- Logical viewport chuẩn là 640×360; luôn kiểm tra cả khung desktop và touch trước khi chốt.
- Không scale pixel texture bằng tỷ lệ lẻ như 1.25 hoặc 1.5 nếu muốn giữ cạnh sắc; ưu tiên 1×, 2×, 3×.
