# 09 — NGHIỆM THU HIỆN HÀNH + PROMPT BÀN GIAO CHO AI KẾ TIẾP

> File này có hai phần:
> **PHẦN I** — nghiệm thu trung thực trạng thái tại SHA `3b4438d` (đã kiểm lại bằng lệnh thật trong lượt này).
> **PHẦN II** — prompt copy-paste được, tự đủ, để một AI khác nhận và triển khai toàn bộ kế hoạch.
> Đọc kèm: `06_VERIFICATION_RELEASE_AND_EVIDENCE.md` (phương pháp A–I + release), `07_EXECUTION_LEDGER_AND_HANDOFF.md` (nhật ký 16 gói), `08_AGENT_STANDING_ORDER.md` (mệnh lệnh thường trực).

---

# PHẦN I — NGHIỆM THU TẠI `3b4438d`

## I.1 Danh tính bản dựng

| Mục | Giá trị |
|---|---|
| Repo | `Khanh-glitch/Soul-of-Hero` |
| Nhánh | `arena/3bce0158-soul-of-hero` (base `82089fea0b28ad1662f9f04496271b92c74c03a7`) |
| HEAD nghiệm thu | `3b4438d` — "Record why foraging cannot reach the kitchen yet" |
| Nhánh đã push? | Có (`git push origin arena/3bce0158-soul-of-hero`) |
| Cây làm việc | Sạch |
| Baseline so sánh | worktree `/tmp/base` @ `79ac5f0` (dựng lại: `git worktree add`, symlink `web/node_modules`) |

**16 gói sản xuất trong nhánh** (mới nhất trước): `3b4438d`, `5b57212`, `9cd8bce`, `7f65fcc`, `34224b6`, `080bfb9`, `351aacc`, `0b433f5`, `35e55e9`, `5e75e14`, `f3a0afb`, `545c2d4`, `1b886c5`, `6a6d2ca`, `02144f1`, `9806618`, `bc4dc18`, `1df6c00`, `49c735c`, `19528db`.

## I.2 Kiểm chứng chạy lại trong lượt nghiệm thu này (không dùng số cũ)

```
cd web
npx vitest run --testTimeout=900000 \
  tests/npc-elder-global-assault.test.ts tests/npc-projectile-flight.test.ts \
  tests/npc-basket-trade.test.ts tests/npc-occupation-coverage.test.ts \
  tests/global-source-ledger.test.ts
→ Test Files 5 passed (5) ; Tests 19 passed (19)
   (occupation-coverage 60.3s, elder 5.1s, ledger 2.3s, projectile 1.5s, basket 1.2s)

npx tsc --noEmit -p .            → sạch
npx tsc --noEmit -p tsconfig.test.json → sạch
npm run build                    → ✓ built in 12.98s
```

## I.3 Cái gì THỰC SỰ xong (SOURCE IMPLEMENTED + ENGINEERING VERIFIED)

| Hạng mục | Bằng chứng |
|---|---|
| Luật lưu trữ Elder toàn cầu (một thân thể duy nhất, archive/off-window, diệt + loot một lần) | `npc-elder-global-assault` 10/10 |
| Elder có tuyến đi thật, mục tiêu thật, garrison hồi phục, cover của lính gác | `npc-elder-global-assault`, `545c2d4`, `5e75e14` |
| Đạn của NPC bay thật (cung của người sống), sát thương chỉ khi chạm, trượt thì không ai mất máu | `npc-projectile-flight` 2/2 |
| Đổi chác nhiều món trọn gói (hoàn nguyên khi hỏng, không mint) | `npc-basket-trade` 2/2 |
| Trực gác + chữa thương có biên nhận kiểm toán | `7f65fcc` |
| Nguồn thương tích thật trong sinh thái (tai nạn nhẹ; tai nạn nặng → DOWNED tại nguồn) | `9cd8bce`, đo được 2 ca DOWNED / 36 giờ-làng |
| 6/8 nghề tự nhiên có sản lượng quy đúng người | `npc-occupation-coverage` (builder, engineer, gardener, guard, mechanic, salvager) |

## I.4 Cái gì CHƯA xong — nói đúng mức

| Hạng mục | Trạng thái | Nguyên nhân đã đo |
|---|---|---|
| **Cook** (nghề thứ 7) | NOT DONE | Bếp chỉ có 2 công thức bậc 0: `dried_meat` (thịt), `grilled_mushroom` (nấm). Kho làng **không có thịt/nấm**. Đường hái nguyên liệu đã đúng nhưng `globalSourceCandidates` **chỉ trả nguồn trong cửa sổ đang nạp** → đầu bếp không thể đi hái nấm ngoài cửa sổ. |
| **Medic** (nghề thứ 8) | NOT DONE | `treatHuman` có ghi biên nhận nhưng 36 giờ-làng **0 lần** chữa: thiếu **luật phản ứng** (người cùng cộng đồng biết có người nằm xuống và đi tới). |
| **Săn thú → thịt** | NOT DONE | Chưa có đường người dân giết sinh vật rồi mang thịt về kho (charter cấm nghề sản xuất thứ 9 → phải nằm trong guard/salvager). |
| **Tàu: chi phí chuyến / thủy thủ / tổn thất thân tàu** | NOT DONE | Chưa triển khai. |
| **Sinh thái sau khi kho bị phá (re-plan)** | NOT DONE | Hiện chỉ có backoff 6 s → 5 phút, chưa có kế hoạch thay thế. |
| **Rà soát UI 640×360** | NOT DONE | Chưa làm. |
| **Chiến dịch trình duyệt A–I** | IMPOSSIBLE Ở SANDBOX | Không có Playwright browsers, không có host tải được phép ⇒ **BROWSER: NOT VERIFIED** (không được tuyên bố khác). |
| **Toàn bộ test-suite xanh** | BLOCKED, có sẵn từ baseline | `src/veyra05/audit-closure.test.ts` P0-1 mất ~841 s trên `/tmp/base` và ~800 s ở đây (giới hạn thời gian, không phải hồi quy); P0-4 và P1-9..12 fail **y hệt** trên baseline; `review-r2-acceptance.test.ts` **treo** ngay trên baseline. |
| **Ma trận save cũ + settle offline khi đang có việc giữa đường** | NOT RUN | Chưa chạy. |
| **Gói bằng chứng release cuối** (`final-acceptance/<SHA>/`) | NOT PRODUCED | Theo `06` §G. |

## I.5 Nhãn đúng cho toàn sản phẩm hiện tại

`SOURCE IMPLEMENTED` ✔ (nhiều phần) · `ENGINEERING VERIFIED` ✔ (các gói ở I.3) · `BROWSER` ✘ · `CREATOR` ✘ (REVIEW REQUIRED) · **Tổng thể: PARTIAL** — tuyệt đối không gọi là DONE.

---

# PHẦN II — PROMPT BÀN GIAO (copy toàn bộ khối dưới đây cho AI kế tiếp)

```text
BẠN LÀ KỸ SƯ TRIỂN KHAI CHO DỰ ÁN "SOH — THE LAST HUMANITY" (repo Khanh-glitch/Soul-of-Hero).
Nhiệm vụ: tiếp tục và HOÀN TẤT kế hoạch sản xuất đang dở, không phải làm một báo cáo chẩn đoán.
Giao tiếp với người dùng bằng TIẾNG VIỆT. Không hỏi lại ở các mốc nội bộ; chỉ hỏi khi có xung đột thiết kế thật.

## 0. ĐỌC TRƯỚC KHI VIẾT CODE (theo thứ tự)
1. web/evidence/npc-integration/20261117-final-production-control-tower/README.md
2. .../01_SIMULATION_AND_WORLD_AUTHORITY.md  → luật K1–K8, quyền của cửa sổ vs toàn cục
3. .../02_ECOLOGY_CENSUS_AND_SOURCES.md      → nguồn vật chất hữu hạn, PLAYER_EXPLORATION
4. .../03_EIGHT_OCCUPATIONS.md               → 8 nghề, trạm thật, output thật
5. .../04_HUMAN_AGENCY_COMBAT_AND_UX.md      → xã hội/tội phạm/chiến đấu/K5, 640×360
6. .../05_ELDER_EVACUATION_AND_RUN_END.md    → 6 Elder, 3 tuyến sơ tán, K8
7. .../06_VERIFICATION_RELEASE_AND_EVIDENCE.md → phương pháp A–I, hiệu năng, gói release
8. .../07_EXECUTION_LEDGER_AND_HANDOFF.md    → 16 gói đã làm + mọi kết quả đo
9. .../08_AGENT_STANDING_ORDER.md            → mệnh lệnh thường trực
10. .../09_HANDOFF_PROMPT_NEXT_AGENT.md (file này) → trạng thái nghiệm thu + danh sách việc

## 1. TRẠNG THÁI XUẤT PHÁT (đã nghiệm thu, đừng làm lại từ đầu)
- Nhánh: arena/3bce0158-soul-of-hero, HEAD 3b4438d, cây sạch, đã push.
- Xanh tại HEAD (chạy lại được):
  cd web && npx vitest run --testTimeout=900000 tests/npc-elder-global-assault.test.ts \
    tests/npc-projectile-flight.test.ts tests/npc-basket-trade.test.ts \
    tests/npc-occupation-coverage.test.ts tests/global-source-ledger.test.ts   → 19/19 pass
  npx tsc --noEmit -p . && npx tsc --noEmit -p tsconfig.test.json && npm run build  → sạch, 13s
- ĐÃ XONG: luật Elder lưu trữ/duy nhất một thân, tuyến đi + garrison + cover, đạn NPC bay thật,
  đổi chác nhiều món trọn gói, biên nhận trực gác & chữa thương, nguồn thương tích tai nạn lao động,
  6/8 nghề tự nhiên có sản lượng quy đúng người.
- CHƯA XONG (chính là việc của bạn, theo đúng thứ tự dưới đây):
  cook(7) / medic(8) / săn thú lấy thịt / tàu (giá chuyến-thủy thủ-thân tàu) / re-plan khi kho bị phá /
  rà soát 640×360 / chiến dịch trình duyệt A–I / ma trận save cũ + offline-settle / gói release cuối.

## 2. LUẬT BẤT KHẢ XÂM PHẠM (vi phạm = rollback, không thương lượng)
1. KHÔNG bao giờ nới `validate`/assertion để test xanh. Sửa nguồn.
2. Save không được MINT, không tự tạo vật/berth/vị trí. Mọi thứ di chuyển phải rời một container thật.
3. Không teleport: mọi di chuyển (kể cả ngoài cửa sổ) phải có tuyến + thời gian + tầng hợp lệ.
4. Không viết lại kỳ vọng của test đã được chấp nhận. Nếu thí nghiệm mâu thuẫn hợp đồng đã pin → rút thí nghiệm, xoá fixture.
5. Không dùng Math.random trong sim. Mọi ngẫu nhiên phải tất định theo (seed, actor, vị trí, phút sim) để replay/test khớp.
6. Không tạo nghề sản xuất thứ 9. Việc mới phải nằm trong 8 nghề hiện có.
7. Không xoá dân/giảm dân số/giảm độ phân giải/tắt VFX để "cho xanh" hay "cho nhanh".
8. Không tuyên bố BROWSER/CREATOR khi chưa có bằng chứng trình duyệt thật. Nhãn phải tách:
   SOURCE IMPLEMENTED / ENGINEERING VERIFIED / BROWSER VERIFIED / CREATOR REVIEW.
9. Không khôi phục các luật đã bị xoá có chủ đích: dockHours, playerEvacuate, boarding bán kính 6,
   EVACUATED-khi-boarding, elderCorridorOpen, kỳ vọng P0.9 lịch sử.
10. Không ghi đè tay r.sourceMap.veyra.originAu trong fixture (làm lệch cửa sổ, phá test lưu trữ);
    không pre-set awakenedAt (advanceElderPressure tự đặt); luôn drive Elder thức dậy qua advanceElderPressure.

## 3. HIỂU ĐÚNG MÁY MÓC (những điểm đã trả giá để biết)
- RunState: r.creatures (trong cửa sổ) vs r.veyraOffscreenCreatures (toàn cục, pixel toàn cục).
  Sinh vật lưu trữ bị `validate` từ chối trừ khi có r.veyraWw và id không nằm trong r.creatures.
- damageCreature KHÔNG tác động được ngoài tầng/cửa sổ đang hoạt động; tầng toàn cục ghi thẳng
  Creature.hp + killCreature. spawnDrop đặt đồ theo pixel CỬA SỔ → Elder lưu trữ dùng pendingLoot.
- Proj (core.ts): {x,y,vx,vy,life,dmg,from:'player'|'enemy'|'human',kind,r,owner?,victim?}.
  tickProj được export; quét theo bước 2 px; va chạm sinh vật dùng luật chung.
  Đạn 'human' phải có owner là actorId có thật và victim là actorId/'player'/creatureId có thật (persist kiểm).
- resolveElderVolley: thân Elder nạp trong cửa sổ ⇒ tiếp xúc do chiến đấu cục bộ sở hữu (skippedLocal),
  không có lính "nhìn thấy"; thân lưu trữ ⇒ phát bắn giải quyết theo vùng, biên nhận có hậu tố ":regional".
- stepHumanCombat(r,hw,now,hitCreature?,hitPlayer?,spawnShot?): đòn bắn của người sống đi qua spawnShot
  (mặc định: không có seam thì giữ luật trừ máu tức thời cho caller cũ). Production nối spawnHumanShot.
- Vết thương CHỈ tồn tại trên thân DOWNED (`downHuman` là nơi duy nhất wounds.push).
  treatHuman đã ghi biên nhận human.treat và tiêu bandage/herb thật từ túi bệnh nhân hoặc kho tiếp cận được.
- globalSourceCandidates CHỈ trả nguồn NẰM TRONG CỬA SỔ đang nạp (lx/ly ngoài WW×WH → bỏ).
  Đường hái TOÀN CỤC đã có: humanHarvest(..., global=true) + globalSourceAt + humanNavigation (dùng cho vận chuyển).
- Bếp lửa: chỉ 2 công thức bậc 0 — dried_meat (meat×1), grilled_mushroom (mushroom×1).
  SOURCES.mushroom = "Marsh Caps", mat 'plant', stock 2, regrow 600 (hái tay được).
- Không dùng integer() cho lairFloor (chỉ >= 0). finalizeHumanOutcomes chỉ chạy một lần; r.qaOffset cộng dồn.
- Biên nhận: receipt(r, now, kind, detail). human.harvest.complete có dạng `${jobId}:${actorId}:${dst}`
  (KHÔNG phải actor đầu tiên); human.production.pickup là JSON có workerId.

## 4. DANH SÁCH VIỆC — LÀM ĐÚNG THỨ TỰ, MỖI VIỆC MỘT GÓI COMMIT

### T1. Hái lượm XUYÊN CỬA SỔ để bếp có nguyên liệu (ưu tiên người dùng đã chọn)
Mục tiêu: đầu bếp (và người hái lượm) lập được công việc tới nguồn nấm/thịt TOÀN CỤC ngoài cửa sổ,
đi trên lưới toàn cục, hái tại chỗ, mang stack thật về kho làng; bếp có nấm ⇒ nấu thật.
File: src/game/humanworld.ts (planHumans/harvest job), src/game/human-jobs.ts (nếu cần task),
src/game/human-navigation.ts (tuyến toàn cục), src/veyra05/window.ts (chỉ đọc; không nới luật cửa sổ cho player).
Cách làm gợi ý: tách hàm chọn nguồn cho công việc hái thành hai làn — làn trong cửa sổ (như hiện tại)
và làn toàn cục dùng globalSourceAt + navigation, chỉ mở cho actor có harvestJob hợp lệ (đúng như vận chuyển).
Điều kiện: không mint, không teleport, output phải là stack thật có UID, giao vào kho có thật.
Test bắt buộc: tests/npc-forage-cross-window.test.ts
  (a) đầu bếp không có nguyên liệu trong cửa sổ lập được job tới nguồn nấm toàn cục;
  (b) đi thật (route.length > 0), hái thật (stock nguồn giảm), stack có UID, giao vào kho thật;
  (c) phủ định: nguồn cạn → blocked có lý do, không có item nào sinh ra;
  (d) reload giữa đường → job còn đó, không nhân đôi output.
Nghiệm thu: tests/npc-occupation-coverage.test.ts phải chứng minh THÊM cook với human.work.start (>0)
và grilled_mushroom (hoặc dried_meat) xuất hiện trong kho/người.

### T2. Luật phản ứng y tế để medic thật sự cứu người
Mục tiêu: khi một người trong cùng cộng đồng bị DOWNED, người có nghề medic (hoặc người gần nhất có thuốc)
BIẾT được và ĐI tới, tiêu bandage/herb thật, bệnh nhân được treat (wounds.treated=true).
File: src/game/human-jobs.ts (taskCandidates medical), src/game/humanworld.ts (phát hiện/phản ứng, treatHuman).
Test bắt buộc: tests/npc-medic-response.test.ts
  (a) tai nạn nặng làm một người DOWNED → trong N phút sim có human.treat và bệnh nhân IDLE, hp tăng, thuốc giảm 1;
  (b) phủ định: không có thuốc ở bất cứ đâu → không treat, giữ DOWNED, có lý do chặn rõ ràng;
  (c) phủ định: medic ở tầng/cửa sổ khác, không có tuyến → không treat từ xa.
Nghiệm thu: occupation-coverage in ra medic với human.treat > 0.

### T3. Săn thú → thịt vào kho (đường thứ hai, sau khi T1 xong)
Chỉ dùng nghề hiện có (guard bảo vệ dân → giết sinh vật; xác sinh vật cho thịt thật).
Không thêm nghề thứ 9, không spawn thịt từ hư không: thịt chỉ đến từ sinh vật bị giết thật.
Test: tests/npc-hunt-meat-chain.test.ts (giết thật → thịt có UID → giao kho; phủ định: không giết thì không có thịt).

### T4. Tàu: giá chuyến, thủy thủ, tổn thất thân tàu
File: nơi định nghĩa EvacTrip/vessel (xem 05_ELDER_EVACUATION_AND_RUN_END.md), humanworld.ts, persist.ts.
Yêu cầu: chuyến đi tiêu hàng thật (nhiên liệu/lương) từ kho tàu; thiếu thì chuyến FAILED có biên nhận;
thủy thủ phải thật sự ở trên tàu; thân tàu chịu tổn thất theo hành trình (hull giảm theo giờ/điều kiện),
tàu hỏng nặng → chuyến không hoàn tất; sửa chữa tốn vật tư thật.
Test: tests/npc-vessel-cost-and-hull.test.ts (dương + âm: thiếu lương → không khởi hành; hull về 0 → không tới nơi).

### T5. Sinh thái sau khi kho/bếp bị phá
Mục tiêu: mất kho ⇒ cộng đồng lập kế hoạch thay thế (kho tạm/gom hàng tại chỗ ở hợp lệ/sửa kho bằng vật tư thật),
không đóng băng cả làng, không mint.
Test: tests/npc-store-destroyed-replan.test.ts (dương + âm: không có vật tư ⇒ blocked có lý do, không item ma).

### T6. Rà soát 640×360 (native)
Chỉ tiêu: HUD/ô chữ không chồng nhau, không tràn, chữ đọc được, prompt không đè; mọi bảng mở/đóng bằng
điều khiển thường. Nếu không có trình duyệt trong môi trường: ghi BROWSER: NOT VERIFIED + mô tả chính xác
cần chụp gì, đừng tuyên bố đã xong.

### T7. Chiến dịch A–I (theo 06 §D)
Chỉ chạy được khi có trình duyệt thật. Với sandbox không có Playwright/host tải: KHÔNG giả lập, ghi NOT VERIFIED
và để lại checklist chính xác (seed, điểm xuất phát, thao tác, actor/source ID, receipt cần chụp).

### T8. Ma trận save cũ + settle offline khi đang có việc giữa đường
Test: legacy save cũ (có trong repo) → mở được, không mint, không nhân đôi job; offline settle với
harvestJob/evac/elder đang dở → mỗi việc settle đúng một lần.

### T9. Phân loại toàn bộ suite ở SHA cuối
Chạy full inventory (197 file) bằng scripts/regression-shards.mjs; phân loại từng fail theo 06 §C
(NEW regression / inherited / obsolete / ENV-timeout / UNINVESTIGATED). Đã biết trước và KHÔNG phải hồi quy:
audit-closure P0-1 (~841 s trên baseline), P0-4, P1-9..12; review-r2-acceptance treo trên baseline;
npc-runtime-throughput (90 s), npc-natural-procurement (81 s); cal01-world-calendar; control-tower-audit-regressions B7;
control-tower-journey-durability; g1a-industrial-salvage tool matrix. Vẫn phải chứng minh bằng so sánh baseline,
không được miễn trừ chung.

### T10. Gói release cuối theo 06 §G tại SHA cuối
web/evidence/npc-integration/final-acceptance/<SHA>/ gồm 11 mục (STATUS, census 81 POI, ma trận 8 nghề,
route/cargo, social/combat, Elder/evac/outcome, ảnh 640×360, log TS+full regression, endurance+performance,
walkthrough tiếng Việt, bảng gate DONE/PARTIAL/BLOCKED tách CODE/ENGINEERING/BROWSER/CREATOR).

## 5. QUY TRÌNH LÀM VIỆC (bắt buộc)
- Mỗi gói: (1) sửa NGUỒN; (2) test dương + test phủ định (race/interruption/reload); (3) tsc app + test;
  (4) build nếu chạm UI; (5) append mục vào 07_EXECUTION_LEDGER_AND_HANDOFF.md (diff nguồn, đường biên nhận,
  test, kết quả đo, lỗi còn lại, verdict, việc kế tiếp); (6) commit + push lên ĐÚNG nhánh hiện tại; (7) tóm tắt tiếng Việt.
- Không chạy full suite mỗi vòng. Không chạy lại test 336h đã biết fail chỉ để xác nhận lại.
- Nếu bị chặn thật: commit phần đã làm đúng, ghi rõ lỗi + lệnh + ràng buộc, rồi đi tiếp phụ thuộc khả thi khác.

## 6. ĐỊNH NGHĨA HOÀN THÀNH
Chỉ khi TẤT CẢ cùng một SHA: 8/8 nghề tự nhiên (có cook nấu thật + medic cứu thật), tàu có giá/thủy thủ/thân tàu,
re-plan khi kho phá, dual rescue trong cùng run, Elder 6 nguồn + outcome K8, save cũ + offline settle đúng một lần,
full suite phân loại xong, A–I chạy trên trình duyệt thật với 640×360, và gói final-acceptance đủ 11 mục.
Nếu thiếu bất kỳ mục nào → trạng thái là PARTIAL và phải nói rõ thiếu gì.
```

---

## PHỤ LỤC — LỆNH NHANH

```bash
# dựng lại môi trường
cd web && npm ci
# kiểm tra kiểu
npx tsc --noEmit -p . && npx tsc --noEmit -p tsconfig.test.json
# bộ test trọng tâm hiện xanh (19/19)
npx vitest run --testTimeout=900000 tests/npc-elder-global-assault.test.ts \
  tests/npc-projectile-flight.test.ts tests/npc-basket-trade.test.ts \
  tests/npc-occupation-coverage.test.ts tests/global-source-ledger.test.ts
# bản dựng
npm run build
# baseline để so sánh hồi quy
git worktree add /tmp/base 79ac5f0 && ln -s /home/user/Soul-of-Hero/web/node_modules /tmp/base/web/node_modules
```
