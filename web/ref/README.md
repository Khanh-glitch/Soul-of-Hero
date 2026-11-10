# Soul of Hero — Gameplay Authority Library

**ONE ENTRY POINT — cập nhật 10/11/2026.** Tất cả thông tin **đang có hiệu lực** để phát triển gameplay bắt đầu tại thư mục `web/ref/`.

| Cần biết | Đọc đúng tệp | Trạng thái |
| --- | --- | --- |
| Game **phải** có luật gì, sandbox freedom, Gold, K1–K8, C01–C24, J01–J20, 336h/last72, offline và 2-run | [bible.md](bible.md) | **Product law duy nhất**; [CHỐT] ưu tiên hơn proposal |
| Code baseline, thứ tự phát triển, acceptance và gate, current player capability | [OPERATIONS.md](OPERATIONS.md) | **Một sổ vận hành duy nhất**; lấy SHA thật trước khi thực thi |
| Dữ liệu Last Island nghiên cứu qua v1–v11, bản gốc và độ tin cậy | [atlas/README.md](atlas/README.md) | **Read-only research**; không cấp phép work order hay auto-approve game features |
| 18 hệ/214 khả năng | [v11 capabilities](atlas/extracted/v11/02_FULL_DEPTH_CAPABILITY_LEDGER.csv) | Coverage candidates, **không phải 214 tính năng thiếu** |
| 20 hành trình quan sát | [v11 player journeys](atlas/extracted/v11/06_REAL_PLAYER_JOURNEYS_20.csv) | QA observational, **không là quest** |
| Các cạnh xuyên hệ | [v11 cross-edges](atlas/extracted/v11/17_EXPLICIT_CROSS_SYSTEM_NETWORK.csv) | Dependency research, cần test với source/consumer hiện hành |
| Kỹ thuật thật | `web/src/game/`, `web/tests/`, `web/evidence/` | Source of actual behavior; không tự thay luật Creator |

## Bắt đầu làm việc
1. Đọc [OPERATIONS.md](OPERATIONS.md) phần mốc R12, nhánh Git, trạng thái và lệnh thực thi.
2. Đọc đúng điều [CHỐT] trong [bible.md](bible.md) cùng K/C/J liên quan; mở Atlas **chỉ theo cơ chế thật sự cần nghiên cứu**.
3. Đối chiếu code ở HEAD, sửa lỗi hoặc triển khai việc có nguồn/chi phí/hậu quả và test; không dừng ở báo cáo.
4. Nghiệm thu theo `SOURCE / FIXTURE / NATURAL / COMPOSED_WEB / COMPOSED_GODOT / HUMAN`; ghi rõ các phần chưa chứng minh.

### Những gì KHÔNG còn điều hành
Các phân vai nhiều agent, work order, PR handoff, cập nhật trạng thái và kế hoạch triển khai cũ bị vô hiệu. Không lấy chúng làm blocker. Không dùng `docs/` cũ để suy ra luật cuối hay chủ sở hữu mới. Nguồn Atlas nguyên bản vẫn được giữ **chỉ để kiểm chứng lịch sử**, dù nó chứa bảng owner theo bối cảnh thời đó.

**Baseline:** `830cb3e7c96ad8057e02d664ce02c52ca3046082`. Bản thử WEC/V3 trước rollback được bảo quản ở `archive/pr47-wec-v3-c872402-20261110`; không đem logic đó vào code mới trước khi nghiệm thu riêng.

## Current authorized integration packet (10/11/2026)
The Creator authorized a single Gameplay Agent to integrate the **complete final Veyra map**, 9 creatures, 4 side bosses, 6 Primordial Elders and husbandry. The **Git-only standalone task and Drive asset preload links** are at [implementation/veyra-creature-20261110/README.md](implementation/veyra-creature-20261110/README.md). **No chat attachment is required; Gold UI/UX/HUD is out of scope until separately provided.** This packet is a task, not a second gameplay Bible, and no production code changes or test acceptance are implied by its publication.
