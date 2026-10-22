# Wizard Hero Soul — thiết kế Hand kit prototype

Ngày thiết kế: 2026-07-16  
Trạng thái: **DESIGN BASELINE — chưa phải runtime authority**

Tài liệu này khóa hướng gameplay đầu tiên cho `wizard_hero` trước khi viết code.
Các con số là baseline để prototype và phải được đo lại trong phòng 1/3/6 mục
tiêu, Elite và boss. Sword/Archer cùng damage pipeline hiện hành vẫn là mốc cân
bằng; tài liệu này không tạo công thức Power, Mana, rarity hay progression riêng.

Hai source pack bắt buộc hiện đều được catalog đánh dấu
`missing_local_proof`: `wizard_pack` và `dark_vfx_01_02`. Vì vậy Wizard chỉ được
đặt `production_ready = false` cho tới khi bằng chứng license được bổ sung hoặc
asset được thay bằng nguồn có quyền sử dụng rõ ràng.

## 1. Bản sắc

Wizard là **dark-space controller**. Nhân vật không đứng yên đặt vòng phép như
một pháp sư MOBA; Wizard thả một bóng ma chậm, để nó nảy trong kiến trúc của
phòng, gieo Dark Point lên quái hoặc tại điểm nó tan biến, rồi dùng chuỗi ba lần
dịch chuyển để lao vào cụm đông, thoát tới điểm an toàn và quay lại kết liễu.

Nhịp trải nghiệm mục tiêu:

1. LMB dự đoán đường nảy và chuẩn bị nhiều Dark Point.
2. Quái bị ám sẽ bỏ leash thông thường và truy đuổi người chơi trong cùng tầng,
   nhờ đó tự gom thành cụm.
3. RMB đọc toàn bộ Dark Point và mật độ quái, không yêu cầu người chơi chọn từng
   điểm bằng tay.
4. Chuỗi lý tưởng có nhịp `lao vào → thoát ra → lao lại`; lần một quái bị trúng
   nhận đủ hệ số Công Lực của vụ nổ, lần trúng thứ hai nhận 40% hệ số đó nhưng bị
   choáng, lần trúng thứ ba trở lại hệ số đầy đủ.

| Identity | Giá trị |
|---|---|
| ID dự kiến | `wizard_hero` |
| Display name | `Wizard` |
| Affinity | `Magician` |
| Vai trò | AoE setup, aggro control, density burst, dark-point mobility |
| Điểm mạnh | Gom quái xuyên phòng, chuẩn bị đường thoát, ba lần đổi vị trí |
| Điểm yếu | Single-target thấp, damage chậm, cần Dark Point, dễ phí chuỗi RMB |

## 2. Mapping asset gốc

### Character

Nguồn: `assets/library/downloaded/wizard_pack/`

| Gameplay | Asset | Cách dùng |
|---|---|---|
| LMB | `Attack2.png` | 8 frame; nhịp phóng ở frame 4/5 |
| RMB | `Attack1.png` | 8 frame; giơ trượng rồi xé không gian ở frame 4 |
| Locomotion | `Idle.png`, `Run.png` | repack theo pivot chân thống nhất với Hero hiện có |
| Reaction | `Hit.png`, `Death.png` | không trộn frame attack vào locomotion |

### Dark VFX

Nguồn: `assets/library/downloaded/dark_vfx_01_02/`

| Gameplay | Asset | Cách dùng |
|---|---|---|
| Bóng ma LMB | `Dark VFX 1 (40x32).png` | 17 frame, khoảng 12 fps, loop toàn dải để tạo nhịp thoắt ẩn–hiện |
| Dịch chuyển/nổ RMB | `Dark VFX 2 (48x64).png` | 16 frame, khoảng 18 fps; chạy ở cả điểm rời và điểm đến, điểm đến lớn hơn |

VFX bổ trợ đã có trong kho và có thể repack:

- `spell_absorb_001_small_violet.png`: hạt tím quanh Dark Point và lúc thân thể
  Wizard biến mất;
- `fantasy_portal_64x64_12.png`: chỉ lấy vòng ngoài, tint tím đen, dùng làm
  telegraph bán kính nổ;
- `soul_teleport.wav`: cue dịch chuyển; ba stack tăng pitch nhẹ để người chơi
  nghe được tiến trình chuỗi.

Không tái dùng rune của Soul Mark Archer làm Dark Point vì sẽ làm lẫn ngôn ngữ
combat giữa hai Hero.

### Quy ước Công Lực

Tài liệu này không định nghĩa damage phẳng. Mọi đòn gây damage chỉ author bằng
**hệ số % Công Lực**; kết quả cuối cùng được combat runtime tính từ Công Lực hiện
tại, track của đòn, Hero Soul, trang bị, cấp kỹ năng, modifier mục tiêu và
mitigation:

```text
Damage cuối = Công Lực runtime × Hệ số đòn × Các modifier hợp lệ × Mitigation
```

- LMB thuộc track `normal_attack`.
- RMB thuộc track `active_skill`.
- Relay Shade thuộc track `summon_skill`.
- Hệ số 40% khi RMB trúng lặp là multiplier riêng, áp sau scaling của
  `active_skill`; nó không phải một damage phẳng khác.
- Stagger và thời lượng khống chế là control value, không phải % Công Lực.

## 3. LMB — Wandering Shade

Wizard dùng `Attack2` phóng một bóng ma theo hướng con trỏ. Bóng không tự tìm
mục tiêu.

| Thuộc tính | Baseline prototype |
|---|---:|
| Action duration / release | 0,44 s / 0,20 s |
| Move multiplier khi cast | 70% |
| Projectile speed | 92 px/s |
| Hit radius | 10 px |
| Lifetime tối đa | 10,0 s |
| Hệ số damage khi nổ | 100% Công Lực |
| Stagger | 6 |
| Explosion radius | 56 px |
| Target cap | 5 |
| Số bóng tồn tại đồng thời | 4 |

### 3.1 Chuyển động và nảy

- Bóng bay thẳng theo hướng được chụp tại release; input sau đó không bẻ hướng.
- Khi chạm World collision không phải hostile, velocity phản xạ theo pháp tuyến
  va chạm: `v' = v - 2 × dot(v, n) × n`.
- Bóng giữ nguyên tốc độ sau khi nảy; không random góc và không tự tăng tốc.
- Sau mỗi lần nảy, bóng được đẩy ra khỏi mặt va chạm một epsilon nhỏ để tránh
  rung tại góc tường. Nếu không tìm được hướng hợp lệ sau ba lần giải kẹt, bóng
  tan tại vị trí an toàn gần nhất và tạo Ground Dark Point.
- Bóng không xuyên tường, không nảy trên quái và chỉ nổ một lần khi chạm hostile
  đầu tiên.
- Animation `Dark VFX 1` cứ kết thúc frame 17 thì quay lại frame 1. Việc biến mất
  trong texture chỉ là hình ảnh; collision của bóng tồn tại liên tục, không tạo
  khung vô hình miễn va chạm.

Khi bóng thứ năm được tạo trong lúc bốn bóng cũ còn sống, bóng cũ nhất tan tự
nhiên tại vị trí hiện tại và tạo Ground Dark Point. Quy tắc này vừa giữ performance
vừa cho người chơi cao tay chủ động “ghim” một điểm thoát.

### 3.2 Nổ trúng quái

Khi bóng chạm hostile:

1. chụp danh sách tối đa năm hostile gần tâm nhất trong bán kính 56 px;
2. gây `100% Công Lực` theo track `normal_attack` và 6 stagger qua combat
   pipeline hiện hành;
3. gắn một Dark Point lên từng mục tiêu thực sự bị trúng;
4. áp **Dark Frenzy** trong 10 giây lên các mục tiêu đó;
5. hủy bóng, không tạo thêm Ground Dark Point tại tâm nổ.

Không có cả direct-hit damage lẫn AoE damage trên cùng một target; `100% Công Lực`
là tổng hệ số của lần nổ, không phải hai lần damage chồng nhau.

### 3.3 Hết thời gian mà không trúng quái

Sau 10 giây, bóng tan và để lại một Ground Dark Point tại vị trí cuối. Nó không
gây damage. Nếu vị trí nằm sát collision, điểm được snap về safe point gần nhất
trong 16 px; không được đặt vào tường.

## 4. Dark Point và Dark Frenzy

### 4.1 Dark Point

Dark Point có hai dạng:

- **Attached Point:** bám theo hostile bị LMB nổ trúng;
- **Ground Point:** đứng yên tại nơi bóng hết hạn, bị giải kẹt hoặc bị thay do
  vượt giới hạn bóng.

| Thuộc tính | Baseline |
|---|---:|
| Lifetime từ lúc được tạo | 10,0 s |
| Số point tối đa của Wizard | 8 |
| Có bị RMB tiêu thụ | Không |
| Có lưu vào save | Không |
| Có vượt floor/ải | Không |

Reapply lên cùng một hostile chỉ refresh điểm hiện hữu về 10 giây, không tạo hai
Attached Point chồng nhau. Khi vượt tám điểm, điểm có thời gian còn lại thấp nhất
bị xóa trước; nếu bằng nhau, xóa điểm cũ nhất.

Nếu hostile chết, Attached Point rơi thành Ground Point tại vị trí chết với đúng
thời gian còn lại, không được refresh lại 10 giây.

### 4.2 Dark Frenzy

Trong tối đa 10 giây, hostile bị Dark Frenzy:

- ép target combat về controlled player;
- bỏ qua disengage distance/leash thông thường trong **cùng floor**;
- tiếp tục dùng navigation, cửa, tường và attack pattern hiện có;
- không được cộng move speed, attack speed hoặc damage;
- không teleport nếu không tìm được đường;
- tự xóa ngay khi player đổi floor/ải, hostile chết hoặc timer hết.

Dark Frenzy không phá phase/arena leash cứng của boss. Boss vẫn nhận Dark Point
làm đích RMB, nhưng AI phase có quyền cao hơn forced chase.

Dark Point và Frenzy tiếp tục đếm theo gameplay time khi Wizard Relay sang Hero
khác trong cùng floor; Frenzy lúc đó đuổi controlled player hiện hành. Chuỗi RMB
đang mở bị hủy khi Relay, nhưng các điểm thế giới không bị xóa sớm.

## 5. RMB — Dark Passage

RMB là một Active Skill gồm một chuỗi ba lần dịch chuyển tự chọn Dark Point.
`Attack1` được dùng cho cả ba lần, nhưng lần hai và ba có thể rút ngắn phần
wind-up bằng cách bắt đầu từ frame 3 để chuỗi không bị ì.

| Thuộc tính | Baseline prototype |
|---|---:|
| Mana trả ở lần kích hoạt đầu | 36 |
| Main cooldown | 14,0 s, bắt đầu từ lần RMB đầu |
| Stack trong một chuỗi | 3 |
| Internal cooldown giữa hai teleport | 1,0 s |
| Cửa sổ dùng stack kế | 2,0 s từ lúc teleport trước resolve |
| Cast/release mỗi stack | 0,26 s / 0,16 s |
| Teleport invulnerability | 0,12 s |
| Explosion radius | 72 px |
| Explosion target cap | 6 |

Điều kiện mở chuỗi là có ít nhất một Dark Point cùng floor với safe landing hợp
lệ, đủ Mana và skill không cooldown. Nếu không có candidate hợp lệ, RMB không
trừ Mana, không tiêu stack và không bắt đầu cooldown.

Sau một teleport:

- RMB bị khóa trong 1 giây;
- input có thể được buffer trong 0,12 giây cuối của internal cooldown;
- nếu không resolve stack kế trước mốc 2 giây, toàn bộ stack còn lại tự hủy;
- main cooldown vẫn tiếp tục tính từ lần kích hoạt đầu, không reset do hủy sớm.

### 5.1 Thuật toán chọn điểm

Mỗi Dark Point hợp lệ tạo một candidate tại vị trí hiện tại của nó. Mật độ của
candidate là số hostile còn sống trong bán kính nổ 72 px, clamp từ 0 đến 6.

| Lần RMB | Profile chọn điểm |
|---:|---|
| 1 | chọn candidate có mật độ **cao nhất** |
| 2, HP hiện tại > 50% | chọn candidate có mật độ **cao nhất** |
| 2, HP hiện tại ≤ 50% | chọn candidate có mật độ **thấp nhất**, cho phép 0 |
| 3 | chọn candidate có mật độ **cao nhất** |

HP được snapshot tại thời điểm lần RMB đó bắt đầu, không dùng HP tại lúc bắt đầu
cả chuỗi. Vì vậy lần một có thể lao vào cụm đông, Wizard bị đánh xuống dưới 50%,
rồi lần hai tự chọn Ground Point trống để thoát; lần ba lại chọn cụm đông nhất.

Tie-break bắt buộc deterministic:

1. mật độ theo profile trên;
2. điểm gần con trỏ nhất tại lúc bấm RMB;
3. điểm có lifetime còn lại cao hơn;
4. stable runtime ID thấp hơn.

Con trỏ chỉ phá hòa, không được làm một điểm ít quái thắng điểm đông hơn ở profile
tấn công.

### 5.2 Safe landing

Wizard không được đặt chồng tâm với thân quái hoặc trong World collision. Với
Attached Point, resolver thử tâm rồi tám điểm trên vòng 20 px; chọn điểm hợp lệ
gần Dark Point nhất. Nếu cả vòng đầu sai, thử vòng 32 px. Candidate không có vị
trí hợp lệ bị loại và thuật toán xét candidate tiếp theo.

Nếu mọi candidate mất hợp lệ trong 0,16 giây cast — ví dụ target chết và điểm
rơi vào vùng khóa — stack không bị tiêu và Mana không bị trừ nếu đây là lần đầu.

### 5.3 Vụ nổ mật độ

Ngay sau khi Wizard xuất hiện, chụp `n` là số hostile còn sống trong bán kính
72 px, clamp tối đa 6. Hệ số Công Lực áp lên từng target là:

```text
DarkPassageCoefficient(n) = 0%                              nếu n = 0
DarkPassageCoefficient(n) = 60% + 10% × min(n - 1, 5)      nếu n ≥ 1
```

| Số quái `n` | Hệ số mỗi target |
|---:|---:|
| 0 | 0% Công Lực |
| 1 | 60% Công Lực |
| 2 | 70% Công Lực |
| 3 | 80% Công Lực |
| 4 | 90% Công Lực |
| 5 | 100% Công Lực |
| 6+ | 110% Công Lực |

Tối đa sáu target gần tâm nhất nhận damage theo track `active_skill`. `n` được
chụp trước khi bất kỳ target nào chết để mọi target trong cùng explosion dùng
một hệ số nhất quán.

### 5.4 Ledger trúng lặp trong chuỗi

Mỗi hostile có exposure count riêng chỉ tồn tại trong chuỗi RMB hiện tại:

| Lần chính hostile đó bị explosion chạm | Damage nhận | Hiệu ứng |
|---:|---:|---|
| 1 | 100% hệ số mật độ | damage và stagger thường |
| 2 | 40% hệ số mật độ | stun 0,65 s |
| 3 | 100% hệ số mật độ | damage thường, không stun thêm |

Ví dụ, exposure thứ hai tương ứng với `24% / 28% / 32% / 36% / 40% / 44%`
Công Lực khi mật độ lần lượt là `1 / 2 / 3 / 4 / 5 / 6+`. Hệ số này lấy theo
mật độ của chính vụ nổ đang xảy ra, không giữ lại hệ số của lần trúng trước.

Đây là **lần trúng của từng hostile**, không phải số thứ tự stack. Một quái tránh
explosion thứ hai nhưng bị explosion thứ nhất và thứ ba vẫn xem lần thứ ba là
exposure thứ hai: nó chỉ nhận 40% và bị stun.

Elite nhận stun 0,35 giây. Boss/hostile miễn hard CC không bị stun; lần exposure
thứ hai thay stun bằng 18 stagger. Mức 40% hệ số Công Lực vẫn giữ nguyên.

RMB không tạo hoặc refresh Dark Point, không refresh Dark Frenzy và không nổ
nhiều lần chỉ vì có nhiều Dark Point chồng trong cùng vùng.

## 6. Cân bằng dự kiến

Các mốc dưới đây chỉ là **tổng hệ số Công Lực**, không phải damage cố định. Damage
cuối vẫn do combat runtime tính theo quy ước ở trên.

- LMB có trần nhịp lý thuyết `100% / 0,44 = 227,27% Công Lực/giây` trước travel
  time, giới hạn số Shade và xác suất quỹ đạo thực sự chạm mục tiêu.
- RMB vào một target đơn, nếu cùng target trúng đủ ba lần:
  `60% + 24% + 60% = 144% Công Lực` cho cả chuỗi.
- RMB tại mật độ 6+, cùng target trúng đủ ba lần:
  `110% + 44% + 110% = 264% Công Lực` cho cả chuỗi.
- Nhịp tấn công tối đa có thêm một LMB mở combo là `364% Công Lực` lên mỗi target
  ở mật độ 6+. Nhịp phòng thủ vào cụm → thoát tới point rỗng → quay lại chỉ đạt
  `110% + 0% + 44% + 100% = 254% Công Lực`, tính cả LMB mở combo.
- RMB có tổng AoE lớn nhưng cần LMB chuẩn bị point, có cửa sổ input, có rủi ro
  dịch chuyển vào cụm và target cap 6.

Các số phải retune nếu playtest cho thấy một trong các vấn đề sau:

- bóng nảy ngẫu nhiên vẫn trúng quá dễ trong phòng nhỏ;
- Ground Point 0 quái khiến lần hai trở thành nút thoát không có rủi ro;
- chuỗi 1→2→3 cấp quá nhiều thời gian bất tử;
- Dark Frenzy gom cả floor nhanh hơn encounter có thể phản ứng;
- density scaling xóa pack trước khi chúng kịp tạo pressure.

Không tăng HP quái để chữa riêng Wizard; phải chỉnh tốc độ bóng, cap, radius,
damage, i-frame hoặc thời gian Dark Point trước.

## 7. HUD và khả năng đọc

- HUD RMB có ba pip lớn. Pip đã dùng tắt; pip kế nhấp nháy khi internal cooldown
  1 giây kết thúc.
- Một vòng 2 giây co quanh pip đang mở; hết vòng thì chuỗi hủy.
- Dark Point gắn trên quái nằm trên đầu actor; Ground Point nằm ở chân và có
  vòng tròn rỗng để phân biệt.
- Lifetime 10 giây thể hiện bằng vòng tím co dần, không dùng text đếm ngược trên
  từng quái.
- Trong 0,16 giây wind-up RMB, point được thuật toán chọn sáng mạnh và hiện vòng
  bán kính nổ. Các point còn lại giảm alpha nhưng không biến mất.
- Lần RMB thứ hai khi HP ≤ 50% đổi highlight sang tím xanh để báo đây là profile
  chọn nơi ít quái; lần một/ba dùng tím đỏ.
- Mỗi exposure của cùng target dùng số nhỏ `I / II / III` cạnh Dark Point trong
  thời gian chuỗi, giúp người chơi hiểu vì sao lần thứ hai damage thấp nhưng stun.

## 8. Audio/impact

- LMB cast: cue tối, ngắn, không lấn tiếng bóng va tường.
- Mỗi bounce có âm nhỏ và giảm volume theo số lần nảy; không phát full impact.
- LMB trúng quái có bass burst rõ hơn bounce để người chơi biết point đã được
  gắn dù nó xảy ra ngoài màn hình.
- Ba RMB dùng cùng `soul_teleport.wav` với pitch gợi ý `0,92 / 1,00 / 1,10`.
- Exposure thứ hai có âm khóa ngắn riêng đi cùng stun; exposure thứ ba có bass
  mạnh nhất nhưng không thêm hard CC.

## 9. Soul Relay — hướng provisional

Hand kit phải được prototype trước khi khóa Relay. Hướng phù hợp nhất hiện tại:

- **Ready — Unbroken Pursuit:** ít nhất ba hostile cùng target controlled player
  và liên tục tiến về phía player trong 1 giây; READY tồn tại 5 giây.
- **Summon — Haunting Arrival:** Wizard xuất hiện tại candidate có mật độ cao
  nhất trong 180 px quanh player, bắn một Shade ngắn sống 2 giây. Shade gây
  `80% Công Lực` theo track `summon_skill` và có thể tạo tối đa ba Dark Point. Nếu
  takeover, Wizard đứng tại vị trí
  summon và dùng được các point vừa tạo.
- **Departure — False Exit:** khi rời sân, Wizard để lại một Ground Dark Point
  sống 10 giây tại vị trí departure. Nó không gây damage và giữ vai trò đường
  quay lại nếu Wizard được takeover lần nữa trong cùng floor.

Relay numbers và takeover windows chưa được coi là baseline cho tới khi Hand kit
qua test mật độ/teleport safety.

## 10. Trường hợp biên bắt buộc

- Đổi floor/ải: xóa Shade, Dark Point, Dark Frenzy, ledger và chuỗi RMB.
- Wizard chết: hủy chuỗi, xóa Shade; point/Frenzy có thể chạy nốt death cleanup
  frame nhưng không được dùng để teleport.
- Pause/inventory: mọi timer dùng gameplay time và dừng cùng world.
- Target chết lúc RMB wind-up: Attached Point rơi xuống đất với lifetime còn lại,
  sau đó safe-landing resolver xét lại vị trí mới.
- Không có safe candidate: không teleport và không tiêu stack.
- Nhiều Dark Point cùng vị trí: chỉ là nhiều candidate; một RMB vẫn chỉ tạo một
  explosion.
- Ground Point 0 quái hợp lệ cho profile phòng thủ lần hai, nhưng không hợp lệ
  nếu nó nằm ngoài floor authority hiện tại.
- Frenzy không mở cửa khóa, không xuyên sealed objective và không kéo enemy qua
  encounter boundary cứng.
- Chain ledger là runtime transient, không ghi save và không sống qua Relay.

## 11. Contract triển khai sau khi duyệt thiết kế

Implementation phải dùng các contract tổng quát thay vì hardcode theo từng enemy:

1. floor-scoped Dark Point registry với stable runtime ID;
2. moving projectile có deterministic world reflection và anti-stuck;
3. generic forced-target/ignore-soft-leash effect để mọi enemy authority có thể
   nhận Dark Frenzy mà không sửa Main theo ID;
4. safe teleport resolver dùng collision query;
5. density scorer chụp enemy snapshot trước damage;
6. per-chain exposure ledger;
7. hard-CC adapter: regular stun, Elite duration reduction, boss đổi sang stagger;
8. toàn bộ damage đi qua `combat_resolver.gd` và Hero action modifier hiện hành;
9. test cho lifetime, bounce, candidate ordering, HP threshold, safe landing,
   100%/40%/100% ledger, floor cleanup và Relay cancellation.

## 12. Acceptance prototype

Prototype chỉ được coi là đạt khi chứng minh được:

- người chơi có thể chủ động bắn Shade nảy vào góc phòng và dự đoán điểm đến;
- Shade loop thoắt ẩn–hiện không làm mất collision/hit readability;
- Dark Frenzy kéo được quái xa nhưng không phá wall, door, boss phase hoặc floor;
- lần RMB 1/3 luôn chọn mật độ cao nhất theo snapshot;
- lần RMB 2 dưới hoặc bằng 50% HP chọn được Ground Point có 0 quái;
- cùng target nhận damage theo đúng `100% hệ số → 40% hệ số + stun → 100% hệ số`;
- ba i-frame 0,12 giây không ghép thành trạng thái bất tử;
- Wizard yếu hơn Sword/Archer ở một target nhưng vượt rõ ở setup 3–6 target;
- VFX Attack/Dark mapping đúng asset chỉ định và đọc được ở độ phân giải nhỏ;
- license của hai pack được giải quyết trước khi nâng `production_ready`.
