# ARCANA — VFX Doctrine v2

> Bộ chuẩn này được viết sau đợt review v1: *"đẹp nhưng mở/đóng chưa có lực,
> nhiều chỗ còn 'shape-like', không mượt; thiếu enemy và phản ứng của chúng."*
> Đây không phải danh sách vá lỗi mà là **luật** cho mọi effect. Mỗi luật đều
> có thông số cụ thể và được cài thành hệ thống trong engine, không làm thủ công
> từng chỗ.

Tham khảo: Squirrel Eiserloh — *Juicing Your Cameras With Math* (GDC 2016);
Jan Willem Nijman — *The Art of Screenshake*; kỹ thuật impact frame / smear
frame trong sakuga (Sakugabooru glossary; breakdown VFX của Genshin Impact về
inverted flash); các "game feel lab" hiện đại (knockback / hitstun / hit-stop /
trauma shake / flash & squash).

---

## 1. Lực đến từ *tương phản*, không phải từ kích thước

Một vụ nổ to mà không có tương phản về thời gian, độ sáng và chuyển động thì
trông "nhẹ". Lực = **Δ thời gian × Δ độ sáng × Δ khối lượng**.

| Trục | Trước va chạm | Tại va chạm | Sau va chạm |
|---|---|---|---|
| Thời gian | chậm dần, căng (anticipation) | **đóng băng** (hit-stop) | tăng tốc trở lại (speed ramp) |
| Ánh sáng | thế giới **tối đi** (inhale) | impact frame 2 tông màu | phơi sáng hồi lại, vệt sáng còn lại |
| Camera | **chồm vào** điểm hội tụ (focus) | giật zoom + đẩy theo hướng lực | rung theo trauma², hồi lò xo |
| Vật thể | bị **hút vào** / co lại | flash trắng, nén (squash) | bị hất văng, bay, tiếp đất, trượt |

**Luật 1.1** — Không effect nào được có cao trào mà thiếu ít nhất 3/4 trục trên.

## 2. Cấu trúc 6 nhịp (bắt buộc)

```
TELL → GATHER → COMMIT → STRIKE → RELEASE → RESIDUE (+ LAST BEAT)
```

1. **TELL (0–150 ms)** — *cast snap*: tay người cast giật lùi (lò xo), hit-stop
   30 ms, chớp sáng ở điểm phát, gợn khúc xạ nhỏ. Effect không bao giờ bắt đầu
   bằng alpha 0 → 1. Khung hình đầu tiên phải có một sự kiện rõ ràng.
2. **GATHER** — năng lượng gom lại. Camera focus tăng dần (zoom tối đa +7%).
   Mỗi lần một cấu trúc "khóa" vào chỗ thì có một nhịp nhỏ (shake 0.1, punch nhẹ)
   để buildup có tiết tấu chứ không chỉ là một đường dốc đều.
3. **COMMIT (150–600 ms)** — *inhale*: nền tối đi tới 55%, kẻ địch bị hút về
   tâm, có thể run nhẹ (tremor). Đây là khoảnh khắc tĩnh và căng nhất.
4. **STRIKE (1 khung hình)** — gọi `W.impact()`:
   * hit-stop `0.03 + 0.09·force` giây (lực lớn tới 0.22 s);
   * impact frame: khung 1 = cháy trắng (silhouette đen/trắng), khung 2 = âm bản
     nhuộm màu nguyên tố, khung 3 = phơi sáng ×1.4;
   * trauma `+0.2 + 0.4·force`, shake = trauma², noise mượt (không random),
     tịnh tiến + xoay;
   * camera bị đẩy *ngược* hướng nguồn lực (lò xo k=260, d=16);
   * zoom punch qua lò xo (k=300, d=18);
   * sóng xung kích **khúc xạ** (dịch pixel thật của khung hình) thay cho vòng
     tròn vẽ đè;
   * quang sai màu (chromatic aberration) theo hướng xuyên tâm, tắt dần e^-7t.
5. **RELEASE** — speed ramp: thời gian hồi từ 0.15–0.6× về 1× theo t² trong
   0.2–0.4 s. Mảnh vỡ có khối lượng: rơi theo trọng lực, nảy, ma sát.
6. **RESIDUE** — chiếm 25–40% thời lượng: vết sẹo, tro, nước đọng, băng tan,
   tàn lửa nguội dần theo ramp (trắng→cam→đỏ→xám).
7. **LAST BEAT** — kết thúc bằng một nhịp nhỏ có chủ đích (`W.settle()`), hoặc
   một chi tiết cuối (vùng bị rách cuối cùng tự khâu lại, hạt giống cuối cùng tắt).
   **Cấm fade tuyến tính về 0.** Biến mất phải dùng dither dissolve (ngưỡng
   Bayer), nguội màu, hoặc co lại kèm nhấp nháy.

## 3. Tiêu chuẩn độ mượt (chống "shape-like")

"Shape-like" = mắt nhận ra hình học nguyên thủy (vòng tròn hoàn hảo, đĩa sáng
có tâm nhọn, đa giác phẳng, đường thẳng 1px giật cục từng pixel).

| Luật | Cài đặt |
|---|---|
| **3.1 Định vị dưới pixel** | `fb.add()` chia điểm theo bilinear ra 4 pixel → hạt và viền chuyển động mượt dưới 1px thay vì nhảy từng pixel. Độ "pixel" được giữ lại bằng bước lượng tử hóa + dither cuối pipeline. |
| **3.2 Không có đĩa sáng tâm nhọn** | Kernel glow đổi từ `(1-d)²` (có điểm gãy ở tâm) sang `(1-d²)³` (trơn C²). |
| **3.3 Không có vòng tròn hoàn hảo** | `pulseRing` có biên dạng mặt sóng xung kích (mép trước sắc, đuôi dài), bán kính bị nhiễu nhiều tần số, độ sáng bị fbm làm đứt đoạn. Lực thật được truyền bằng *khúc xạ*, vòng vẽ ra chỉ là phần phụ. |
| **3.4 Persistence (vệt sáng theo thời gian)** | Mọi ánh sáng của effect được ghi vào buffer lưu vết `trail = max(fx, trail·decay)` rồi cộng lại — tương đương motion blur / smear frame cho mọi chuyển động nhanh. Mỗi trường phái có hệ số riêng (Tempest để lại dư ảnh lâu nhất). |
| **3.5 Camera dưới pixel** | Rung, zoom, xoay được resample bilinear trên buffer HDR trước khi tone map, nên camera trôi mượt chứ không giật theo lưới pixel. |
| **3.6 Easing** | Không chuyển động tuyến tính nào được nhìn thấy. Mặc định: ease-out expo cho release, lò xo cho mọi phản ứng vật lý, t² cho speed ramp. |

## 4. Kẻ địch — phản ứng là một nửa của effect

Một spell chỉ có lực khi *có vật nhận lực*. Mỗi kẻ địch có:

* **Thân vật lý**: vị trí mặt đất (x,y), độ cao z, khối lượng (husk 1.0,
  crawler 0.7, brute 2.6), ma sát, nảy khi chạm đất, va tường.
* **7 lớp phản ứng khi trúng đòn**: (1) flash trắng 2 khung → màu nguyên tố
  3 khung, (2) squash lò xo, (3) knockback theo hướng lực / khối lượng,
  (4) hất lên (z) khi lực lớn, (5) nghiêng người theo vận tốc (shear),
  (6) hitstun/stagger, (7) số sát thương nảy lên + thanh máu có đoạn trễ.
* **Tự hồi phục**: sau khi hết stagger thì lê chân về vị trí cũ.
* **Trạng thái nguyên tố** (hiển thị trên chính sprite):
  | Nguyên tố | Trạng thái | Hiển thị | Cơ chế |
  |---|---|---|---|
  | Lửa | burn → char | lưỡi lửa bốc từ đỉnh silhouette, vết nứt nóng, thân cháy đen dần | sát thương theo thời gian, tàn lửa |
  | Nước | wet | thân tối và ướt, nhỏ giọt | Sét gây ×1.5 sát thương |
  | Băng | freeze | tông màu lạnh, vỏ tinh thể bao quanh, ngừng mọi animation | trượt trên băng; đòn mạnh → **vỡ vụn** (×1.8) |
  | Sét | shock | khung X-quang (thân đen, viền sáng), giật ±1px, hồ quang chạy trên người | |
  | Sống | root / spore | dây leo quấn quanh, đốm nấm phát sáng | bị giữ chặt (knockback ×0.25); spore + đòn Verdant → nổ bào tử |
  | Astral | warp | bóng ma tách kênh R/B, các hàng pixel bị lệch | |
* **6 kiểu chết riêng theo nguyên tố** — mỗi pixel của sprite trở thành một hạt
  có quỹ đạo giải tích (tất định, tua lại được):
  * Lửa: cháy từ trên xuống, mép cháy phát sáng, tro bốc lên → để lại đống tro
    còn tàn đỏ.
  * Nước: bị nén bẹp rồi vỡ thành giọt nước có trọng lực → vệt ướt.
  * Băng: tách thành các khối Voronoi, xoay, rơi, nảy, lấp lánh rồi tan.
  * Sét: một khung X-quang rồi tan rã theo từng hàng quét ngang → vết cháy sém.
  * Sống: hóa xanh, chìm xuống đất → để lại một bụi hoa.
  * Astral: "tắt TV" — glitch, ép thành một đường, thành một chấm, mất →
    một ô pixel sai chỗ còn nhấp nháy rồi tự sửa.
  * Đặc biệt — **Chém** (Ashen Guillotine): sprite bị cắt đôi đúng theo đường
    chém, hai nửa trượt ra, mép cắt nóng chảy, sau đó hóa tro.
* **Ánh sáng**: kẻ địch được vẽ *đè lên* ánh sáng của spell (silhouette tối
  trước nền sáng — ngôn ngữ của Hyper Light Drifter), được chiếu sáng theo màu
  ánh sáng spell lấy mẫu xung quanh, có rim light ở viền, và 40% ánh sáng spell
  được cộng lại lên trên để trông như đang *ở trong* lửa/nước.

## 5. Mỗi trường phái tác động lên cơ thể theo kiểu riêng

| Trường phái | Lực tác động | Chuyển động của kẻ địch |
|---|---|---|
| PYRE | nổ / va đập / chém | hất văng mạnh, cháy, chết thành tro hoặc bị chém đôi |
| TIDE | áp suất / hút / quét | bị hút xoáy, bị sóng quét ngang, bị đóng băng rồi vỡ |
| TEMPEST | xung điện tức thời | khựng lại (hitstop ngắn liên tiếp), giật X-quang, tan rã |
| VERDANT | giữ chặt rồi phóng | bị trói, rồi bị gai đâm hất thẳng lên |
| ASTRAL | phá luật không gian/thời gian | bị kéo dài, tách bóng ma, phản ứng *trước* khi đòn tới, bị nuốt |

## 6. Ngân sách & chống lạm dụng

* Hit-stop chỉ dành cho nhịp chính. Đòn phụ (va chạm thân, mảnh vụn) dùng
  hit-stop ≤ 0.04 s hoặc không có.
* Impact frame mỗi spell ≤ 2 lần.
* Trauma luôn được kẹp ≤ 1 *trước* khi bình phương.
* Mọi thứ đều tất định: tua timeline luôn ra đúng khung hình đó.

## 7. Kiến trúc cài đặt

* `src/engine/world.ts` — `W`: camera (trauma, kick, zoom, focus), hit-stop,
  speed ramp, inhale, impact frame, sóng khúc xạ, API gây sát thương
  (`impact / hit / sweep / lineHit / pull / status / kill`).
* `src/engine/enemies.ts` — mô phỏng, render, trạng thái, 7 kiểu chết, số sát
  thương, thanh máu, hạt hiệu ứng của thế giới.
* `src/spells/choreo.ts` — **bản tổng phổ tác động**: với mỗi spell, các nhịp
  TELL/GATHER/COMMIT/STRIKE/RESIDUE được viết ra như một bản nhạc, tách biệt
  khỏi phần vẽ.
* `src/engine/framebuffer.ts` — pipeline hậu kỳ: resample camera + khúc xạ +
  quang sai → bloom → tone map → impact frame → dither.
