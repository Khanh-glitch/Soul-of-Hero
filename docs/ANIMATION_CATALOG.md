# Catalog FreeKnight

`knight_animation_library.gd` đăng ký toàn bộ 30 sheet, frame 120×80. Sprite đặt lệch `y=-31` để node origin nằm tại chân, phù hợp Y-sort của game top-down.

| Animation runtime | Sheet | Frames | Gameplay |
|---|---|---:|---|
| idle | `_Idle.png` | 10 | đứng |
| run | `_Run.png` | 10 | chạy |
| crouch / crouch_walk | `_Crouch.png`, `_CrouchWalk.png` | 1 / 8 | cúi, đi cúi |
| jump / jump_to_fall / fall | `_Jump.png`, `_JumpFallInbetween.png`, `_Fall.png` | 3 / 2 / 3 | chuỗi né/hop top-down |
| wall_hang / wall_slide / wall_climb | các sheet Wall | 1 / 3 / 7 | catalog/preview, dành cho ladder hoặc setpiece sau này |
| attack | `_AttackNoMovement.png` | 4 | light |
| attack_combo | `_AttackComboNoMovement.png` | 10 | combo hai hit |
| heavy_attack | `_Attack2NoMovement.png` | 6 | heavy |
| crouch_attack | `_CrouchAttack.png` | 4 | low attack |
| dash / roll / slide_full | các sheet tương ứng | 2 / 12 / 4 | evade/movement |
| turn | `_TurnAround.png` | 3 | đổi hướng |
| hit / death | `_Hit.png`, `_DeathNoMovement.png` | 1 / 10 | hurt/death |

Các bản root-motion (`attack_moving`, `attack2_moving`, `attack_combo_moving`, `death_moving`, `wall_climb_moving`) và transition/full variants vẫn có trong SpriteFrames để preview hoặc dùng cho cutscene. Gameplay top-down mặc định chọn bản `NoMovement` để sprite không lệch khỏi collider; hướng đánh thực tế đến từ `facing_direction` và rotation của hitbox.
