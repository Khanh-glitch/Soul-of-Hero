# MCP và Live Sync cục bộ

Hệ thống này phục vụ chỉnh tuning/map và quan sát runtime hai chiều trong quá trình phát triển. Gameplay không phụ thuộc client MCP và đây không phải multiplayer, cloud save hay online backend của Living Arsenal.

```text
MCP client ⇄ NDJSON-RPC/stdio ⇄ tools/mcp/server.mjs
      ⇅ resource notifications          ⇅ authenticated WebSocket JSON
Godot runtime ⇄ RealtimeBridge (127.0.0.1:9080)
      ⇅ file watch                      ⇅ state/event mỗi 150 ms
gameplay_tuning.json + JSON của live_level đang chạy
      ⇅ validated read/write
Godot editor dock ⇄ dropdown Backdrop / Geometry / Decor
```

Nếu Node/MCP client không chạy hoặc port đang bận, game vẫn chạy. Bridge cảnh báo và phần network bị vô hiệu hóa.

## Khởi động nhanh

1. Mở project bằng Godot 4.7 hoặc chạy `tools/run_game.ps1`.
2. Dùng Node có WebSocket tích hợp, Node 22 trở lên; test local trước đây dùng Node 24.18.0. Không cần `npm install`.
3. Sao chép cấu hình mẫu `tools/mcp/mcp.example.json` vào MCP host và sửa:
   - `command`: đường dẫn tuyệt đối tới `node.exe`.
   - `args[0]`: đường dẫn tuyệt đối tới `tools/mcp/server.mjs`.
4. Restart MCP host. Tool `status` trả `connected: true` và `authenticated: true` khi Godot đang chạy.

Lần chạy đầu, Godot tạo workspace token tại `.godot/mcp_bridge_token`; file này đã được Git ignore.

Biến môi trường:

- `GODOT_WS_URL`: URL phía Node, mặc định `ws://127.0.0.1:9080`.
- `GODOT_WS_PORT`: port phía Godot, mặc định `9080`.
- `GODOT_MCP_TOKEN` hoặc `GODOT_BRIDGE_TOKEN`: truyền token trực tiếp.
- `GODOT_MCP_TOKEN_PATH` hoặc `GODOT_BRIDGE_TOKEN_PATH`: đổi file token phía Node.
- `GODOT_CONNECT_TIMEOUT_MS`: mặc định 2.500 ms.
- `GODOT_REQUEST_TIMEOUT_MS`: mặc định 5.000 ms.
- `GODOT_MCP_ALLOW_UNAUTHENTICATED_READS=1`: chỉ dành cho debug có chủ đích; mutation vẫn cần auth.

Adapter chỉ ghi JSON-RPC lên `stdout`; log chẩn đoán đi qua `stderr`. Mỗi request/response nằm trên một dòng NDJSON và dùng MCP protocol `2025-11-25`.

## Tám MCP tool

| Tool | Tác dụng |
|---|---|
| `status` | Trạng thái Node adapter, WebSocket, auth và bridge. Vẫn trả kết quả khi Godot tắt. |
| `get_state` | Scene, FPS/physics frame, player state và GameSession. |
| `set_player_tuning` | Validate, merge vào section `player`/`combat`, persist rồi apply live. |
| `trigger_action` | Press/release một InputMap action và gọi remote-action handler của player. |
| `get_level` | Đọc level document đang được bridge giữ trong bộ nhớ. |
| `set_tile` | Upsert/xóa một cell của `Backdrop`, `Geometry` hoặc `Decor`; mặc định `Geometry`. |
| `reload` | Reload `tuning`, `level` hoặc `all` từ đĩa. |
| `save_runtime_map` | Serialize runtime `Backdrop`, `Geometry` hoặc `Decor` về đúng layer JSON; mặc định `Geometry`. |

### `set_tile`

`layer` chỉ nhận một trong ba giá trị:

```text
Backdrop | Geometry | Decor
```

Mặc định là `Geometry`. `source: -1` xóa cell. `persist: true` là mặc định; dùng `persist: false` để preview runtime mà chưa đổi file.

Ví dụ đặt wall source 1:

```json
{
  "layer": "Geometry",
  "x": 24,
  "y": 18,
  "source": 1,
  "atlas": [2, 0],
  "alternative": 0,
  "persist": true
}
```

Ví dụ preview floor source 0:

```json
{
  "layer": "Backdrop",
  "x": 24,
  "y": 18,
  "source": 0,
  "atlas": [1, 4],
  "alternative": 0,
  "persist": false
}
```

Runtime-only preview không tự thay canonical JSON. Muốn lưu snapshot runtime, gọi `save_runtime_map` đúng layer:

```json
{
  "layer": "Backdrop"
}
```

Nếu bỏ `layer`, `save_runtime_map` dùng `Geometry`.

## Resource realtime từ Godot về MCP

Sau lifecycle `initialize → notifications/initialized`, client có thể subscribe:

- `godot://where-i-am/runtime/state`: scene, player, session, objective và bridge status mới nhất.
- `godot://where-i-am/runtime/events`: tối đa 50 gameplay/live-sync event gần nhất.

Khi Godot đẩy state/event, adapter phát `notifications/resources/updated`. Client gọi `resources/read` để lấy snapshot mới, không cần tự polling `get_state` liên tục.

State session gồm score, sigils, `required_sigils`, checkpoint và objective. Event hiện có player registration/action/damage/death/respawn, tuning/map reload, score, sigil, checkpoint, objective và sync status.

## Giao thức WebSocket nội bộ

Sau handshake, Godot gửi `hello` gồm protocol, `workspace_id`, endpoint và yêu cầu `workspace_token`. Adapter đọc token từ environment hoặc `.godot/mcp_bridge_token`, gửi `auth`, sau đó mới được mutation và nhận state/event.

Request:

```json
{"type":"request","id":"42","command":"get_state","params":{}}
```

Response thành công:

```json
{"type":"response","id":"42","ok":true,"result":{}}
```

Response lỗi có `ok: false` và trường `error`.

Giới hạn bridge:

- Chỉ bind `127.0.0.1`.
- Handshake/auth timeout 5 giây.
- Inbound command tối đa 64 KB.
- Outbound response/state tối đa 2 MB.
- Queue tối đa 128 packet.
- 90 request/giây/peer.
- Workspace token 32–512 ký tự và workspace identity phải khớp.

Bridge poll tuning và level đang active mỗi 400 ms, rồi so sánh SHA-256 nội dung:

- `config/gameplay_tuning.json`
- `level_data_path` của đúng một node thuộc group `live_level`; Level 1 hiện là
  `data/levels/crypt_entrance.json`.

Khi đổi scene/level, Bridge đổi watched path ngay và `get_level` load đồng bộ file
mới, không trả snapshot của level trước. Nếu runtime có nhiều live level trỏ tới
các JSON khác nhau, mutation bị từ chối thay vì chọn ngẫu nhiên.

## Schema map và atlas

Level v2 có ba layer canonical và hai TileSet source:

| Source | Grid | Atlas | Vai trò |
|---:|---:|---|---|
| 0 | 32×32 | `dungeon_tileset_ii.png` | Floor/decor |
| 1 | 12×4 | `atlas_walls_low.png` | Geometry wall/corner |

Map hiện tại có 3136 Backdrop floor cell, 756 Geometry wall cell, 24 Decor cell và 33 entity. Cell ngoài footprint không tồn tại, tạo black void.

Ví dụ document rút gọn:

```json
{
  "version": 2,
  "movement_mode": "top_down",
  "tile_size": 16,
  "width": 100,
  "height": 56,
  "layers": {
    "Backdrop": [
      { "x": 4, "y": 4, "source": 0, "atlas": [1, 4], "alternative": 0 }
    ],
    "Geometry": [
      { "x": 3, "y": 4, "source": 1, "atlas": [3, 1], "alternative": 0 }
    ],
    "Decor": []
  },
  "entities": [
    { "id": "player_spawn", "type": "player", "position": [104, 104] },
    { "id": "exit", "type": "exit_gate", "position": [1480, 776] }
  ],
  "metadata": {
    "required_sigils": 3,
    "camera_bounds": [0, 0, 1600, 896]
  }
}
```

Mọi write qua bridge/plugin:

- Đọc revision mới nhất.
- Validate toàn schema và source/grid.
- Chỉ thay array layer yêu cầu.
- Giữ nguyên layer khác, entity và metadata.
- Sort cell theo `y`, sau đó `x`.
- Từ chối ghi nếu revision đã đổi trong lúc xử lý.

## Dock Knightfall Live Sync

Dock editor có dropdown chọn:

- `Backdrop`
- `Geometry` — mặc định
- `Decor`

Nút và auto sync luôn áp dụng cho layer đang chọn:

- **Pull JSON → selected layer**: validate document và mọi tile trước khi thay cell scene.
- **Push selected layer → JSON**: serialize đúng layer, giữ phần còn lại.
- **Auto sync (0,75 s)**: theo dõi cả file và selected layer.

Nếu file và scene cùng thay đổi giữa hai poll, auto sync dừng và yêu cầu người dùng chọn Pull hoặc Push. Tool không tự merge xung đột nhiều người.

Sau Pull, hãy `Ctrl+S` nếu muốn giữ serialized state trong `.tscn`; JSON vẫn là canonical content source của sandbox.

## Ghi file an toàn và recovery

Plugin và bridge dùng chung:

- Expected SHA-256 signature/compare-and-swap.
- Directory lock `<file>.write.lock`.
- Temp file cùng volume.
- Recovery copy `<file>.write.backup`.

Trên Windows, bản cũ được đổi tên sang backup trước khi promote temp. Target mới được kiểm tra hash rồi backup mới bị xóa. Nếu crash giữa chừng, lần đọc/ghi sau phục hồi backup khi lock không còn.

Nếu process chết và để lại stale lock:

1. Đóng Godot và mọi writer liên quan.
2. Xác nhận không còn process sử dụng file.
3. Xóa đúng thư mục `.write.lock` cạnh JSON.
4. Chạy lại để recovery tiếp tục.

Không xóa lock khi writer vẫn đang chạy.

## Remote action và touch controls

`trigger_action` thao tác InputMap và có thể giữ action nếu gửi `pressed: true`, `duration: 0`. Phải gửi `pressed: false` để nhả khi không dùng auto-release duration.

Virtual controls trong HUD độc lập với MCP:

- Ẩn mặc định trên desktop.
- Hiện trong mobile build.
- Có thể ép hiện khi test desktop bằng `GODOT_FORCE_TOUCH_CONTROLS=1`.
- Khi control bị ẩn/pause/focus loss, button script nhả simulated action để tránh kẹt input.

## Kiểm thử

Gameplay/schema smoke:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_tests.ps1
```

Parse project/plugin:

```powershell
.\.tools\godot\Godot_v4.7-stable_win64.exe --headless --path . --editor --quit
```

Toàn bộ MCP suite:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run_mcp_tests.ps1
```

Suite bao gồm:

- WebSocket `status` + `get_level` và workspace auth.
- MCP stdio lifecycle/schema errors/resource subscription.
- Tuning → file → runtime.
- Remote action → player.
- Tile runtime-only → `save_runtime_map(layer)` → JSON.
- Reconnect: state resource chuyển available → unavailable → available khi Godot restart.
- Write-lock, restore và từ chối đè edit ngoài test.

Smoke report gameplay gần nhất có 88 check, 0 failure. Đây là baseline cho vertical slice, không phải full Living Arsenal acceptance suite.

## Giới hạn an toàn

- Không đổi host sang `0.0.0.0`; bridge được thiết kế cho local development.
- `set_tile`/`save_runtime_map` chỉ nhận đúng ba tên layer đã whitelist.
- Plugin Pull/Push chỉ thao tác selected layer, nhưng vẫn validate toàn document.
- Realtime sync không thay thế version control, backup hoặc checkpoint trước refactor.
- Bridge và editor dock tự route theo `level_data_path` của scene đang active và
  fail closed khi không xác định được một level duy nhất.
- Shipping export phải tắt hoặc loại MCP/debug bridge bằng development flag.
- MCP realtime không chứng minh save progression, leaderboard hoặc online infrastructure đã tồn tại.

## Liên quan Living Arsenal

Realtime tooling này là nền hỗ trợ development, không phải một feature người chơi. Trạng thái sản phẩm và thứ tự triển khai nằm tại:

Living Arsenal chưa hoàn tất; việc realtime map/tuning hoạt động không đồng nghĩa campaign, weapon system, save progression hoặc online service đã được xây xong.

- [Master spec](LIVING_ARSENAL_MASTER_SPEC.md)
- [Project audit](PROJECT_AUDIT.md)
- [Product roadmap](PRODUCT_ROADMAP.md)
