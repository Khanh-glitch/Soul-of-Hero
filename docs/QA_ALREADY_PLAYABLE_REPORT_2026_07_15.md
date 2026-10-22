# Báo cáo QA “Already Playable” — 2026-07-15

## 1. Kết luận tại thời điểm chốt

**PASS cho cổng “Chapter 1 Already Playable” ở phạm vi prototype P0.** Cả 10 màn
Chapter 1, từ Level 1 đến Level 10, hiện đều là `CAMPAIGN_READY`, có thể mở đúng
theo tiến trình, vào gameplay thật, hoàn thành điều kiện màn, nhận Results và lưu
tiến trình. Không còn blocker đã biết khiến người chơi vừa vào màn đã bị đẩy ra
hoặc không thể đi hết tuyến Level 1–10.

Kết luận này có giới hạn rõ ràng:

- **Đã chứng minh bằng automation:** scene tải được, tuyến mở khóa đúng, các tương
  tác vật lý/cơ chế đặc thù hoạt động theo contract, thất bại/retry không giữ state
  bẩn, thưởng first-clear không nhân đôi, save cũ được migration, UI không sập ở
  hai kích thước kiểm tra, và toàn bộ regression hiện tại thoát với mã 0.
- **Chưa chứng minh bằng human playtest:** Chapter 1 đã vui, nhịp độ hợp lý, độ khó
  công bằng, tutorial đủ dễ hiểu, điều khiển “đã tay”, hay người chơi thật có muốn
  chơi lại. Chưa có một biên bản playtest người thật hoàn chỉnh trên build cuối,
  từ save trắng qua liên tục Level 1–10.
- **Không phải kết luận release-ready:** art/audio thương mại, provenance của một
  số asset, localization, hiệu năng thiết bị thật, export build và nội dung
  Level 11–100 vẫn chưa đạt cổng phát hành.

Tóm tắt trạng thái cổng:

| Cổng | Trạng thái | Ý nghĩa |
|---|---|---|
| P0 — Chapter 1 chạy hết bằng automation | **PASS** | Level 1–10 có route, gameplay, reward và save hoạt động |
| P1 — Sẵn sàng đưa cho người chơi test | **READY** | Có thể bắt đầu playtest người thật có ghi nhận dữ liệu |
| P2 — Fun/balance/readability đã được xác nhận | **CHƯA ĐÁNH GIÁ** | Automation không thay thế cảm nhận người chơi |
| P3 — Release candidate | **BLOCKED** | Còn thiếu nội dung 11–100, polish, device/export QA và nhiều hệ thống hậu Chapter 1 |

## 2. Full regression cuối

Lệnh dùng để chốt cổng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/run_full_regression.ps1 -SkipMcp
```

Kết quả cuối:

- **Exit code: 0**.
- **Thời gian: 386,6 giây**.
- Runner thực thi 45 suite/asset-validation con khi bỏ MCP.
- Mọi Godot subprocess dùng cả `SOUL_OF_HERO_SAVE_PATH` và
  `LIVING_ARSENAL_SAVE_PATH` trỏ vào profile QA cô lập. Full regression không dùng
  save gameplay thật của người chơi làm fixture.
- Không có `SCRIPT ERROR` hoặc lỗi assertion chưa xử lý trong lần chạy chốt.

Đây là bằng chứng mạnh cho tính ổn định kỹ thuật của snapshot hiện tại, nhưng chỉ
đúng cho code/content và môi trường đã được chạy ngày 2026-07-15. Mọi chỉnh sửa
sau mốc này cần chạy lại full regression trước khi giữ nguyên verdict PASS.

## 3. Bằng chứng Chapter 1 Level 1–10

### 3.1. Cổng tổng thể

`run_already_playable_qa.ps1` đạt **40/40** kiểm tra:

- Xác nhận **10/10 màn playable** trong production registry.
- Chạy **100 chu kỳ Soul Relay** cô lập và luôn trở về trạng thái idle sạch.
- Tạo, lưu, reload và kiểm tra **550 Hero Soul instance** không trùng UUID.
- Xác nhận reward reload/idempotency: receipt first-clear tồn tại sau reload và
  callback/replay không nhân đôi reward.
- Verdict do report sinh ra: `already_playable_gate = true`; blocker còn lại được
  phân loại là polish art/audio thương mại, không phải blocker gameplay Chapter 1.

`campaign_entry_runtime` đạt **475/475** kiểm tra trên mọi màn
`CAMPAIGN_READY`: mỗi Level 1–10 đều đi qua production `AppRoot`/`AppFlow`, vào
gameplay và thoát lại mà thao tác entry/exit tự nó không phát thưởng hoặc làm đổi
tiến trình ngoài ý muốn.

### 3.2. Tuyến mới từ save trắng và các màn đặc thù

- Fresh-player loop tổng quát đạt **101/101** kiểm tra.
- Level 6 fresh promotion route đạt **74/74**: Soul Anchors, Sword/Axe hai chiều,
  Soul Relay và skill unlock đi qua route thật.
- Level 7 promotion route đạt **66/66**; các suite riêng xác nhận Beacon 900 HP,
  ba wave, điều kiện thua, retry và cleanup state.
- Level 8 fresh route đạt **59/59**; static/live coverage xác nhận hai nhánh
  Reaper/Vampire, một Elite theo bộ trục áp lực tách biệt, chest vật lý và Epic Soul Vessel.
- Level 9 đạt **58 static + 51 live + 67 fresh-route**: đúng ba Gate Seal vật lý,
  Crimson Reaper elite, Rare Sword Soul, gate feature và mở Level 10 atomically.
- Level 10 đạt **41 static + 50 live + 79 fresh-route**: một Vampire Castellan
  thật, hai phase liên tục, phase transition, telegraph/pattern, death/retry sạch,
  Results, Epic Soul và replay bounty nhỏ hơn first-clear.

Level 10 không thể được mở chỉ bằng cách chèn ID vào `unlocked_levels`. Runtime
kiểm tra lại prerequisite và `chapter_1_boss_gate`. Reconciliation v5 cũng đã được
kiểm tra với profile cũ có receipt v2/v4: Player Level, feature, Hero Soul và trang
bị unique được khôi phục mà không nhân đôi currency/stackable. Suite này đạt
**65/65**.

## 4. Bằng chứng cho core gameplay và meta

Các kết quả tiêu biểu trong lần regression chốt:

- Content contracts: **206/206**.
- Campaign rewards: **48/48**.
- Visible progression/Results: **92/92**.
- Save compatibility: **118/118**; save/unlock: **143/143**.
- Hero skill combat: **48 rules + 67 live-runtime**.
- Hero Soul exact-instance/live-affix: **53 manager/save + 33 Knight runtime**.
- Auxiliary equipment: **76 rules + 39 save + 61 combat + 53 Knight integration**.
- UI shell: **149/149**.
- Chapter 1 map-design validation: **784/784** trên phần map được suite này kiểm
  tra; các generator và vertical-slice suite riêng của Level 8–10 cũng đều xanh.

Những gì các suite trên thực sự xác nhận:

- Sword và Axe đều có runtime/HUD riêng; Relay hai chiều không chỉ là data.
- HP, Damage và Mana có tác dụng trong combat; active skill tốn Mana và Mana hồi
  lại theo runtime.
- Skill rank, Hero Soul affix được đánh dấu LIVE và ba slot trang bị phụ có thể
  thay đổi chỉ số combat.
- Sell/fusion tuân theo feature gate; Soul đang được chọn không bị bán/hợp nhất;
  receipt chống trả thưởng hai lần.
- First-clear, replay, retry, migration và reload đều dùng save transaction có
  idempotency thay vì cộng tiến trình bằng callback rời rạc.
- Results không tuyên bố quá mức: Level 10 cấp
  `Chapter 2 entitlement (content pending)` và **Level 10 Boss Replay Bounty**;
  nó không nói Chapter 2 hay một Hunt mode riêng đã playable.

## 5. Bằng chứng hình ảnh và responsive layout

Các capture OpenGL thật được sinh ở cả 847×437 và 1280×720, không phải mockup
ngoài game. Những nhóm hình chính:

- Axe combat/HUD:
  `.artifacts/visual_acceptance_axe_847x437.png` và
  `.artifacts/visual_acceptance_axe_1280x720.png`.
- Level 7 Beacon:
  `.artifacts/visual_acceptance_level7_beacon_847x437.png` và
  `.artifacts/visual_acceptance_level7_beacon_1280x720.png`.
- Hero Soul/skill roster:
  `.artifacts/visual_acceptance_roster_souls_847x437.png`,
  `.artifacts/hero_roster_847x437.png`, `.artifacts/hero_roster_1280x720.png`,
  `.artifacts/hero_skills_847x437.png` và `.artifacts/hero_skills_1280x720.png`.
- Level 9 Crimson Reaper: `.artifacts/level9_crimson_reaper_847x437.png`.
- Level 10 Vampire Castellan:
  `.artifacts/level10_vampire_castellan_847x437.png` và
  `.artifacts/level10_vampire_castellan_1280x720.png`.
- Production shell/Results: nhóm `.artifacts/ui_shell_*.png`.

Các capture xác nhận HUD, Roster và boss presentation không collapse hoặc bị cắt
nghiêm trọng ở hai viewport đã chọn. Chúng **không** thay thế usability test:
ảnh đúng layout chưa chứng minh người chơi đọc kịp telegraph, hiểu affix, tìm được
nút fusion hoặc biết vì sao một tính năng còn khóa.

## 6. Cảnh báo trong log

Các cảnh báo sau được phân loại là nonfatal/expected trong lần QA hiện tại:

1. **RealtimeBridge port 9080 đã được dùng.** Một số subprocess báo bridge không
   thể listen trên `127.0.0.1:9080` vì editor/debug game khác đang giữ cổng. Bridge
   này là phụ trợ; suite vẫn hoàn thành, save/gameplay assertion không phụ thuộc
   vào nó. Đây không phải lý do để bỏ qua nếu build release thực sự cần bridge,
   nhưng không phải blocker của Chapter 1 offline hiện tại.
2. **Authority-failure warnings ở Level 8/9.** Các test âm cố tình làm thiếu branch
   marker/Elite modifier hoặc từ chối Gate Seal để xác nhận transaction rollback.
   Cảnh báo là bằng chứng nhánh fail-closed đã được chạy, không phải lỗi của happy
   path.
3. **`6 ObjectDB instances were leaked at exit` trong hai capture Hero Roster.**
   Capture và layout assertion vẫn pass; dấu hiệu hiện nghiêng về cleanup của
   visual-test harness. Tuy vậy đây là QA debt cần dọn hoặc chứng minh không xảy
   ra trong phiên gameplay dài trước release.
4. `.artifacts/living_arsenal_runtime_report.json` là artifact cũ của contract
   Bow/weapon trước khi dự án chuyển sang Sword/Axe Hero Soul. Report fail cũ này
   không thuộc full runner hiện tại và không được dùng làm verdict cho snapshot
   đã chốt; nên archive/xóa artifact stale để tránh gây hiểu nhầm.

Không có cảnh báo nào ở trên được chuyển thành “đã sửa” chỉ vì test exit 0. Chúng
được ghi lại để phân biệt expected negative-path output với nợ kỹ thuật thật.

## 7. Automation đã chứng minh gì — và chưa chứng minh gì

### Đã chứng minh ở mức hợp lý

- Production route Level Details → gameplay → Results hoạt động qua AppFlow.
- Scene/resource/script parse và instantiate được trong Godot 4.7.
- Interaction, objective, boss phase, reward và save contract chạy deterministically.
- Các nhánh retry/reload/replay quan trọng không nhân đôi reward hoặc giữ actor cũ.
- Save fixture được cô lập khỏi profile người chơi trong full regression.
- UI nằm trong biên viewport ở các kích thước đã test.

### Chưa được phép suy ra từ automation

- “Game đã vui”, “không chán trong 100 level” hoặc “balance đã tốt”.
- Người mới hiểu Soul Relay, Mana, stat milestone, affix, sell và fusion mà không
  cần giải thích ngoài game.
- Mỗi normal level thật sự đạt mục tiêu 3–6 phút và boss đạt 5–8 phút.
- Telegraph của Castellan đủ công bằng với phản xạ người thật và input latency.
- Hiệu năng, nhiệt, pin, vibration và control trên điện thoại/thiết bị mục tiêu.
- Không có memory leak trong phiên 30–60 phút; suite ngắn và cảnh báo ObjectDB vẫn
  cần điều tra.
- Độ ổn định sau hàng nghìn lần loot/fusion hoặc nhiều giờ save/reload thực tế.

Telemetry balance hiện mới có sample tổng hợp/schema-validation. Nó không phải dữ
liệu người chơi và chưa hỗ trợ kết luận về win rate, thời lượng hay mức sử dụng
Relay.

## 8. Gap trung thực ngoài cổng Chapter 1 P0

- **Level 11–100 chưa phải content playable.** Dự án có schema/capacity 100 level,
  không có nghĩa 90 màn còn lại đã được author, balance hay playtest.
- **Chapter 2 chưa có content chạy được.** Level 10 chỉ cấp entitlement với nhãn
  `content pending`.
- **Monster Soul mới là foundation/rules.** Chưa có vòng save/UI/loot/combat hoàn
  chỉnh tại Level 50; report test cũng ghi rõ scope foundation-only.
- **Monster Parts chưa thành gameplay loop hoàn chỉnh.** Chưa thể xem đây là hệ
  thống giữ chân người chơi cho 100 level.
- **Gacha/shop/quest khó/rare drop/Hunt mode riêng** chưa có vòng sản phẩm hoàn
  chỉnh. Level 10 replay bounty là thật, nhưng không đồng nghĩa Hunt mode đã tồn tại.
- Một số affix/milestone vẫn fail-closed hoặc được gắn nhãn `NOT YET LIVE`; đặc
  biệt không được tính chúng vào build diversity cho đến khi runtime support có test.
- Hero variant, pity/economy dài hạn và nguồn Hero Soul hiếm chưa được author/balance
  đủ cho campaign 100 level.
- Audio/music/SFX, VFX, text Việt–Anh, tutorial wording và art boss/enemy còn ở mức
  prototype; provenance của bộ Axe vẫn là release risk cần giải quyết.
- Chưa có export/device matrix, profiler budget, crash soak dài, accessibility QA
  hoặc store/package validation.
- Worktree chưa có baseline Git sạch đáng tin cậy; cần đưa snapshot đã pass vào
  version control trước khi tiếp tục thay đổi lớn để tránh mất khả năng bisect.

## 9. Cổng tiếp theo được đề xuất

Trước khi mở rộng Chapter 2 hoặc sản xuất hàng loạt level, nên chạy một vòng
human acceptance có kiểm soát:

1. Khởi động lại debug game để chắc chắn toàn bộ script mới được reload.
2. Dùng một save trắng riêng, chơi liền Level 1–10 mà không dùng teleport/debug
   damage.
3. Ghi cho từng màn: thời lượng, số lần chết, chỗ không hiểu, damage nhận/gây,
   Hero đang active, số lần Relay, skill/Mana usage và trang bị được thay.
4. Chạy ít nhất ba tuyến: Sword ưu tiên, Axe ưu tiên và Relay cân bằng.
5. Xác nhận bằng mắt/tay các điểm khó tự động hóa: chest/Seal có dễ nhận biết,
   Beacon có bảo vệ được, boss telegraph có công bằng, Results có giải thích đúng
   reward, sell/fusion có tránh thao tác nhầm.
6. Sau playtest, khóa balance Chapter 1 và chỉ sửa blocker/readability trước khi
   nhân template sang Chapter 2–5.

Verdict cuối cùng của báo cáo này vì vậy là: **game đã đạt trạng thái Chapter 1
prototype “already playable” về mặt kỹ thuật; game chưa được chứng minh “already
fun”, chưa hoàn thành mục tiêu 100 level và chưa sẵn sàng phát hành thương mại.**
