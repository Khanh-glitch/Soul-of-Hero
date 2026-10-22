# LIVING ARSENAL — Game flow

> **SUPERSEDED / LEGACY (2026-07-14).** Luồng Hand/Spirit/Bow/Axe bên dưới chỉ
> được giữ làm lịch sử. Luồng production hiện tại là SOUL OF HERO; xem
> `README.md`, `docs/ARCHITECTURE.md` và `docs/SOUL_RELAY_RULES.md`.

## Flow hiện đã triển khai

Main scene hiện là `game/app/app_root.tscn`. Lượt chạy bình thường đi qua Boot, Title và Hub; test/MCP direct-load gameplay theo cờ môi trường/tham số để giữ automation. Training là đường playable duy nhất và **không** được tính là campaign Level 1.

Flow shell đã được kiểm thử:

```text
Boot/Studio
  → Title (Continue / New Game / Settings / Credits)
    → Hub: Campaign | Arsenal | Modes | Bestiary | Settings
      → Campaign (0/20; 20 slot MISSING)
        → Training Details
          → Gameplay Training
            → Training Results
              → Retry | Arsenal | Hub
```

`Arsenal` là loadout UI thật; `Modes` chỉ hiển thị các mode khóa có lý do; `Bestiary` hiện mô tả ba enemy Training; Settings và Credits có back route. Không có nút Start cho campaign slot chưa có content.

## Trách nhiệm từng trạng thái

| Trạng thái | Đọc | Ghi | Điều kiện rời trạng thái |
|---|---|---|---|
| Boot | project config, save metadata | không sửa progression | autoload sẵn sàng; save được load/recover |
| Title | có save hợp lệ hay không | New Game có xác nhận; settings độc lập | Continue hoặc tạo profile thành công |
| Hub | progression, unlocks, currencies | không cấp reward tự động | chọn Campaign/Arsenal/Modes/Bestiary/Settings |
| Campaign | trạng thái campaign + Training entry | không sửa progression | Training Details hoặc tab khác; 20 slot MISSING không launch |
| Training Details | metadata Training, ba enemy, selected loadout | level ID tạm `training_crypt` | Start/Arsenal/Back |
| Arsenal/Loadout | weapon catalog, unlocks, slot gate | equipped weapon IDs qua SaveService | loadout hợp lệ hoặc Back |
| Gameplay Training | level snapshot + loadout snapshot | run-local HP/objective/enemy state | victory, defeat, pause-to-exit |
| Training Results | immutable run result | không cấp campaign reward | Retry/Arsenal/Hub |
| Settings | validated settings snapshot | update settings qua SaveService | Back về Title hoặc Hub |
| Credits | attribution/source notice | không ghi progression | Back về Title |

## Scene transition contract hiện tại

`AppFlow` truyền ID/snapshot, không truyền node gameplay sống. Active Training run hiện có dạng:

```gdscript
{
  "run_id": "training_<ticks>",
  "level_id": &"training_crypt",
  "mode_id": &"training",
  "loadout": {
    "hand_weapon": &"sword",
    "spirit_slots": [&"bow", &""]
  }
}
```

- AppRoot cleanup route scene cũ và giữ autoload.
- Gameplay Training không tự mở campaign level; khi thắng, nó gửi result sang Training Results.
- Training Results không commit campaign reward.
- Retry dùng active-run/loadout snapshot trước đó và tạo lại scene gameplay.
- Hub luôn đọc snapshot mới từ SaveService; không giữ cache progression xuyên commit.

## New Game và Continue

### New Game

1. Nếu có profile, yêu cầu xác nhận rõ ràng.
2. Tạo defaults schema hiện hành.
3. Vào Hub/Training với Sword; không giả vờ đưa người chơi vào campaign Level 1.
4. Save ngay sau profile initialization.

### Continue

1. Load primary; nếu hỏng, thử backup.
2. Migrate tuần tự đến schema hiện hành.
3. Nếu run trước bị đóng giữa gameplay, trở về Hub/Level Details; không tự cấp result.
4. Hiện tại vào Hub Campaign; chỉ Training có thể launch vì chưa có progression canonical 20 level.

## Training result contract

```gdscript
{
  "run_id": "uuid-or-deterministic-session-id",
  "level_id": &"training_crypt",
  "mode_id": &"training",
  "outcome": &"victory",
  "score": 0,
  "sigils": 0,
  "required_sigils": 0,
  "duration_seconds": 0.0
}
```

Training result chỉ phục vụ hiển thị score/sigil/time và retry/navigation; nó không tạo transaction hoặc unlock campaign. Contract idempotent reward của campaign vẫn là việc phải làm khi có `LevelDefinition`/encounter thật.

## Defeat, pause và exit

- Death freeze harmful gameplay ngay lập tức; Knight death presentation vẫn chạy bằng pause mode phù hợp.
- Defeat card ưu tiên Retry; khi run được mở từ AppRoot có đường về Arsenal/Hub.
- Exit to Hub không hoàn thành objective và không cấp reward.
- Pause có Resume, Retry/Restart và về Hub khi có active AppFlow run; không để projectile/enemy tiếp tục khi paused.

## Settings runtime đã nối

- SaveService validate/persist settings; New Game reset progression nhưng giữ settings.
- Panel áp dụng volume `Master/Music/SFX` và fullscreen ngay; bus `UI` đã có nhưng chưa có slider riêng.
- Khi gameplay load, touch opacity, joystick size, button scale và left-handed layout được áp dụng.
- Enemy đọc telegraph palette và high-contrast setting.
- Shake, vibration, damage numbers, aim assist, reduced effects/motion và localization chưa được xem là hoàn thành nếu chưa có runtime consumer/test riêng.
- Audio bus layout đã có, nhưng không có ship audio clip và chưa có gameplay cue wiring.

## Definition of done cho campaign Level 1

Chỉ đổi trạng thái từ sandbox sang campaign Level 1 khi có đủ:

- LevelDefinition + EncounterDefinition + objective rõ ràng;
- Bow reward một lần và onboarding Living Arsenal;
- victory/defeat, Results và replay/Next Level;
- reward transaction idempotent và unlock Level 2;
- Level Details/Loadout path thật, không dead button;
- desktop và touch test, scene cleanup, save/reload regression.
