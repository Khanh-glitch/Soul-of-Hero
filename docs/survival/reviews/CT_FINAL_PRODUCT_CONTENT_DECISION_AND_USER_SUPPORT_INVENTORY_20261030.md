# SOH — Toàn bộ phạm vi game cuối, phân loại quyết định và lịch điều kiện (2026-10-30)

**CHỨC NĂNG:** BẢN KIỂM KÊ THIẾT KẾ + THỈNH CẦU; không phải quyết định mới của người dùng, không phải kế hoạch chi phí/thời hạn, không phải trạng thái gameplay nghiệm thu, không tự động dispatch. **Cắt nguồn:** các trao đổi bắt đầu từ pivot 2026-10-29 và các hồi ức 2019–2020 đã được user tái xác nhận. Câu trả lời/cấp phép sau này có quyền thay thế mục này. Các cuộc nói chuyện trước pivot chỉ là nguồn kế thừa kỹ thuật/art, không tự động hồi sinh roadmap.

**Nguồn truy vấn:** Google Docs Soul of heroes tabs 01,02,03 (U-W01..07, U-G01..13, U-P01..02), 04/12 live handoff, Atlas 1355 dòng SHA256 b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157; `DECISIONS.md` D001–D054; `POST_LAST_ISLAND_2019_2020_PIVOT_IDEA_RECONSTRUCTION_20261030.md`, `ATLAS_RECONCILIATION_AND_DECISIONS.md`, `SYSTEM_FUSION_BLUEPRINT.md` CT01–12, `ACCEPTANCE.md` B0/B1/B2 P1–P8, `POST_PIVOT_44_SYS_26_PACKAGE_DECISION_CLOSURE_20261030.md`, `TWO_PROTOTYPES_MECHANICS_ADMISSION_AND_A1_GATE_20261029.md`, `RSCH_PROT_001_ADDENDUM01_P7_P8_ADMISSION_20261029.md`, `PROTOTYPE_DEVELOPMENT4_LIMITED_AUDIT_MATRIX_20261030.md`, S6 Whitewater design gates, First Core and loot-density corrections, active PR19–26. Google Docs summary of original chat is NOT a 100% verbatim user transcript; counts below strictly enumerate documented decisions/management packages, NOT all possible ideas ever said.

## A. Three exact counts — DO NOT SUM
- **54 rows D001–D054:** 20 USER_LOCKED_HISTORICAL (D001, D002, D003, D004, D005, D006, D007, D021, D022, D032, D033, D034, D035, D044, D045, D046, D051, D052, D053, D054); 4 REVISABLE_ENGINEERING (D008, D009, D010, D011); 5 OPEN_DESIGN (D012, D013, D014, D015, D020); 7 REJECTED (D016, D017, D018, D019, D028, D029, D042); 17 GATE_APPROVED (D023, D024, D025, D026, D027, D030, D036, D037, D038, D039, D040, D041, D043, D047, D048, D049, D050); 1 OPEN_FACT (D031). D045/D046 source identity partly SUPERSEDED by D051, and some gate approvals are nonfinal/reversible. 20 historical user-locked rows ≠ 20 independent active user design selections.
- **44 original SRC systems SYS02–SYS45:** 32 `ADAPT_CORE_DESIGN`; 9 `DEFER_VALUE_GATE`; 3 `REJECT_LITERAL`. They are mechanism coverage statuses, NOT 32 implemented systems.
- **26 deliverable packages:** 10 `P0` current; 6 `P1` scheduled after prerequisites; 6 `P2` conditional value trials; 4 `X` rejected. 16 core/staged, 6 conditional, 4 excluded. ZERO full B0/B1/B2 product ACCEPTED as of current independent CT gates. Progress of individual PRs requires refreshed commit+native/visual proof.

## B. Full product vision in ten coupled pillars
1. Player-visible continent: authored causal geography, biomes, road/home routes, real hazard/gearing access, ten existing dungeon exteriors within starter ~quarter, original dungeons preserved; no empty token sites.
2. Enjoyable SAFE optional looting even with basic melee/no Core: harvest, road crates/recyclers, common supplies, rare clues, physical POI source/respawn and storage; surprise Core opportunities without forced boss.
3. Freeform genuine physical home: foundations, walls, doors, roofs/room fade, interior storage and bed, owned structures and protection, persistence, meaningful expansion/outpost.
4. Material industry/survival: advanced tools, fuel/smelting/workbenches, timed queues, power circuit, hazard gear, food/water/crop/comfort as adapted and balanced, repair and maintenance, ergonomic logistics.
5. Three research modes: blind/spares R&D, directed research, sample reverse engineering; physical specimen distinct from learned recipe and spatial building plan; item reuse and new sinks.
6. Physical charge/durability-limited Skill Core + EXPLICIT later reproduction by researched recipe and source material; source-EXACT 93 Gold library target over time; full enemy and world/terrain VFX/parity, 720/2K/4K; Core finding can be immediately tried and enjoyed OR stored; research desire arises from valuable loss and autonomy, not forced hoarding.
7. Meaningful multi-layer POIs and risk: keys/wards, power/fuel/switches, sealed room, multiple routes, hazard protection, optional bosses, fair retreat, site-specific replenishment, distinct reward; no empty 106 contract points as content.
8. Fair solo risk/death: explicit threat tells, retreat and gear, persistent bed and SAME immutable death bag with recovery; no exploit/forced offline PvP/raid/wipe.
9. Two selectable canonical bald/unarmored PLAYER APPEARANCES male CraftPix555940/female419402, gender-preserving grade1/2 armor visuals on equip; clean expressive contextual responsive HUD/UI/UX, Codex/fog knowledge and relevant native player controls. Knight may remain internal old physics class but cannot remain final visible character.
10. Extended multiple-session progression: house/recipes/POIs/unopened regions and several compelling rare Core milestones, ≥3 future goals across ≥2 systems after ~14-day-like play, no artificial time-gated emptiness. Optional separate resets can preserve main home/knowledge if a later value trial approves.

**Important differentiated design:** Gold must act like original full source, not assistant reinterpreting skill as generic gun. Core physical find/store/use/study/craft choices must be intentionally playable; Gold+environment overlay prototype hypotheses remain CONDITIONAL.

## C. Full 44 SYS classifications (exact source Atlas headings)
| SYS | Original historical mechanism | Product decision |
| --- | --- | --- |
| SYS-02 | Bản đồ thế giới và tính liên tục | ADAPT_CORE_DESIGN |
| SYS-03 | Biome và nguyên liệu không đồng đều | ADAPT_CORE_DESIGN |
| SYS-04 | Đường đi và thùng phế liệu | ADAPT_CORE_DESIGN |
| SYS-05 | POI là đồ thị mục tiêu nhiều tầng | ADAPT_CORE_DESIGN |
| SYS-06 | Khu nguy hiểm và phân tầng điều kiện | ADAPT_CORE_DESIGN |
| SYS-07 | Thay đổi thiết kế map theo mùa và bản vá | DEFER_VALUE_GATE |
| SYS-08 | Cứ điểm có thẻ: thứ tự nguồn–khóa–phòng | ADAPT_CORE_DESIGN |
| SYS-09 | POI quân sự, sinh hóa, sân bay, cảng | ADAPT_CORE_DESIGN |
| SYS-10 | Khu vực đặc biệt có thời hạn riêng | DEFER_VALUE_GATE |
| SYS-11 | Cơ chế vật phẩm–công thức–vật liệu | ADAPT_CORE_DESIGN |
| SYS-12 | Spares: đơn vị tiền tri thức và linh kiện | ADAPT_CORE_DESIGN |
| SYS-13 | R&D Bench qua ba đời cơ chế | ADAPT_CORE_DESIGN |
| SYS-14 | Drawing Table: phân tích vật phẩm mẫu | ADAPT_CORE_DESIGN |
| SYS-15 | Dây chuyền vật tư nhiều tầng | ADAPT_CORE_DESIGN |
| SYS-16 | Vật phẩm trùng công thức và cạnh tranh đầu vào | ADAPT_CORE_DESIGN |
| SYS-17 | Recipe Scope, rare recipe, quyền sở hữu | ADAPT_CORE_DESIGN |
| SYS-18 | Workshop và meta-progress khác R&D | DEFER_VALUE_GATE |
| SYS-19 | Crafting cấp bàn, thời gian và độ bền | ADAPT_CORE_DESIGN |
| SYS-20 | Xây tự do: foundation, wall, door, floor, roof | ADAPT_CORE_DESIGN |
| SYS-21 | Territory Cabinet: quyền, giới hạn, upkeep, badge | ADAPT_CORE_DESIGN |
| SYS-22 | Kết cấu bảo vệ: lớp, phòng rỗng và lõi nhà | ADAPT_CORE_DESIGN |
| SYS-23 | Giới hạn footprint và thiết bị | ADAPT_CORE_DESIGN |
| SYS-24 | Điện, mạch và bẫy | ADAPT_CORE_DESIGN |
| SYS-25 | Công trình sản xuất tại nhà | ADAPT_CORE_DESIGN |
| SYS-26 | Blueprint căn cứ khác blueprint chế tạo | ADAPT_CORE_DESIGN |
| SYS-27 | Heat / comfort tại căn cứ | ADAPT_CORE_DESIGN |
| SYS-28 | Operation Base: căn cứ cá nhân không reset | ADAPT_CORE_DESIGN |
| SYS-29 | Liên thông Base–Battle giới hạn | ADAPT_CORE_DESIGN |
| SYS-30 | Farming & food ở Operation Base | ADAPT_CORE_DESIGN |
| SYS-31 | Bounty Board, chợ, exchange và currency | DEFER_VALUE_GATE |
| SYS-32 | HP, hunger, dehydration, death và trạng thái đang nằm | ADAPT_CORE_DESIGN |
| SYS-33 | Hồi sinh, giường, túi ngủ và bản đồ chết | ADAPT_CORE_DESIGN |
| SYS-34 | Durability, repair, chế độ cầm đồ đã dùng | ADAPT_CORE_DESIGN |
| SYS-35 | PvP, raid và hợp tác | REJECT_LITERAL |
| SYS-36 | Boss, AI địch và áp lực căn cứ | ADAPT_CORE_DESIGN |
| SYS-37 | Quy tắc target và phòng thủ trong Zombies Tide Trial 2026 | DEFER_VALUE_GATE |
| SYS-38 | Vũ khí, đạn, chống giáp, status | ADAPT_CORE_DESIGN |
| SYS-39 | Vật nuôi, thú cưỡi, nuôi dưỡng và biến dị | DEFER_VALUE_GATE |
| SYS-40 | Phương tiện mặt đất, biển, không | DEFER_VALUE_GATE |
| SYS-41 | Mode theo chu kỳ và endgame reset | REJECT_LITERAL |
| SYS-42 | Civilization mode: giai đoạn công nghệ toàn server | DEFER_VALUE_GATE |
| SYS-43 | Chế độ 2026 tranh 49 mảnh đất | REJECT_LITERAL |
| SYS-44 | Đồ hiếm và game economy ngoài trận | DEFER_VALUE_GATE |
| SYS-45 | Thông tin map/UX trong bản 2025–2026 | ADAPT_CORE_DESIGN |

## D. All 26 work packages with actual gate (management grouping)
| ID | Product scope | Current disposition | Owner/when | Acceptance |
| --- | --- | --- | --- | --- |
| P0-01 | B0 nhà thật→địch→chết→giường→thu hồi đúng túi→nhà→reload | `EXECUTE_EXISTING` | A0 | Một run normal-input no-grant/no-teleport trọn vòng, cùng token, không sửa oracle để giấu lỗi |
| P0-02 | Hai POI A1 Waystation/Relay với stand thật, thưởng và lượt về | `OWNER_FIX_DELIVERED_IN_A1_NOT_MOUNTED` | A0 host; A1 chỉ mở lại nếu native counterexample | Đi đúng stand (408,199), locker 0 item, ledger 0 item, cache 3 scrap+2 spares, Relay trừ 2 scrap+1 oak, cooldown/return/reload |
| P0-03 | Thùng dọc đường, nguồn nguyên liệu, loot ít rủi ro có ý nghĩa | `PARTIAL_NATIVE` | A0/A1 | Tối thiểu một chuyến chỉ đi loot an toàn vẫn đem về vật liệu+manh mối có tác dụng sau này |
| P0-04 | Sổ kho–instance–spares–3 kiểu nghiên cứu–bí kíp–tái chế tạo | `OWNER_FIXTURE_NOT_PRODUCT` | A3 authority (PAUSED), A0 adapter | Item thật có thể chọn giữ/dùng/nghiên cứu; nhận đúng bí kíp, vật liệu và thành phẩm; cùng giá trị qua reload |
| P0-05 | Skill Core vật lý hữu hạn đầu tiên và Full Gold thật | `GOLD_OWNER_ACTIVE_DEPENDENCY` | A4 Gold (ACTIVE), A0 bridge | Một Core nhặt thật, sở hữu khi không cast, cast với enemy/world đầy đủ gốc, debit và dùng/cất/hy sinh tách biệt |
| P0-06 | Nhà thực sự là xưởng: lò, fuel, timed queue, chi phí | `PARTIAL_NATIVE` | A0, A3 source contracts | Tài nguyên thô→fuel/time→đầu ra→recipe/chuẩn bị; interruption/reload không nhân đôi |
| P0-07 | HUD/Core/cất đồ chọn món/map hints/UI gameplay | `A6_V4_DISPATCH_READY_NOT_MOUNTED` | A6 same session khi được user khởi chạy, A0 read-only mount | Input modal không leak, chỉ rõ specimen/recipe/charge, loot & research readable 720/2K/4K |
| P0-08 | Đúng hai nhân vật Male/Female Adventurer đã khóa | `USER_LOCKED_SOURCES_NOT_IN_GIT` | A0/avatar art owner | Hash/license source gốc, actual selectable creation, movement/combat two bodies, SaveService+Gold parities |
| P0-09 | Tuyển và tích hợp art đã tải theo đúng hệ thống | `SOURCE_ADMITTED_PILOT_NOT_GODOT` | A1 world art + A6 UI; không mở AI seat mới | Khóa hash, license, palette/size, import chọn lọc private, screenshots native, runtime source paths; không phát tán ZIP nguồn |
| P0-10 | Hợp nhất regression native/Web/perf + 10 dungeon preserved | `EXECUTE_EXISTING` | A0/Control Tower | Current SHA test pass; perf repeatable, leaks triaged, native 720/2K/4K, all ten entrances round trip |
| P1-11 | Hazard độc/lạnh+gear/counters+chuẩn bị rồi revisit | `SCHEDULE_AFTER_REAL_POI` | A1 geography, A3 item costs, A0 | Thấy nơi khó từ sớm; thất bại có cảnh báo; chuẩn bị hợp lý rồi đi lại thành công không cần level |
| P1-12 | Một POI đa tầng: ấn phù, nguồn, công tắc, mở phòng, bag cứu hộ | `SCHEDULE_AFTER_B0` | A1/S6 design, A0 integration | Ít nhất 2 route/early retreat; credential và power độc lập; no softlock, no duplicate unique |
| P1-13 | Trồng trọt–nấu ăn–heat/comfort sản xuất dùng thật | `ASSET_AVAILABLE_NEEDS_ECONOMY` | A3 authority, A0 structures | 5 chu kỳ farm giảm thời gian chuẩn bị nhưng rare catalyst vẫn bắt đi POI |
| P1-14 | Nhà nâng cấp và kiến trúc ô/phòng/mái có nhiều cấp vật liệu | `PARTIAL_NATIVE_NEEDS_ART_KIT` | A0/A1 art | Đổi tường/door/foundation nâng cấp không trap, nav/roof đúng native, chi phí thật |
| P1-15 | Lục địa đầy đủ và POI có gameplay thay vì site contract | `AUTHORING_READY_NATIVE_WORLD_MISSING` | A1 world + A0 host | Tải vùng, tuyến về nhà, nội dung, loot/địch/POI thật và mười dungeon preserved, không render 192 chunks một lần tùy tiện |
| P1-16 | Chiều sâu 14 ngày không chán, có lý do chơi tiếp | `CANNOT_PASS_PRE_B1` | Control Tower + A3 metrics | ≥3 mục tiêu thật across ≥2 systems, novice/optimizer, ≥3 buổi không dungeon vẫn tiến triển |
| P2-17 | Mưa/tuyết ảnh hưởng crop/fuel/shelter/gear | `ADMISSION_ONLY_POST_FARM` | A0/A1/A3 after P1-13 | Một weather event có 2 hệ quả ích lợi/rủi ro thật và lựa chọn chống chịu, save/reload |
| P2-18 | Xe kéo, hậu cần, tiền đồn lưu trữ/travel | `ADMISSION_ONLY_POST_ROUTE` | A1/A3 after P1-15 | Đo net carried loot/route/time/stranded cart 3 runs; nếu chỉ +20 slots → REJECT |
| P2-19 | Quái đi vòng/phá cửa; thủ thành tự nguyện | `ADMISSION_ONLY_POST_DYNAMIC_NAV` | A0 combat with existing owner | Door open/detour/breach/destroy and repair in native; 2 viable layouts, no involuntary raid |
| P2-20 | NPC giao dịch, bounty, item sinks | `SOLO_ADAPT_NEEDS_BALANCE` | A3/A1 after economy stable | Giao dịch sửa thiếu hụt thật, sink không phá loot/travel; nếu vô nghĩa → REJECT |
| P2-21 | Linh thú, xe, thuyền, cưỡi, khai thác | `LATER_VERSION_OPTIONAL` | A1/A3 after cart and B2 demand | Mở route/yield độc đáo và cost/risk, không decorative speed bonus |
| P2-22 | Expedition tùy chọn có reset riêng, giữ nhà chính | `APPROVED_ARCHITECTURE_PHASE_LATER` | A0/CT after core long-form | Main save/recipes/home bất biến qua expedition reset, phần thưởng không phá đầu game và người chơi tự nguyện |
| X-23 | Bắt buộc wipe toàn bộ thế giới sau 14–15 ngày | `REJECTED` | None | Không được thêm vào default SOH |
| X-24 | PvP bắt buộc, cướp offline, raid không báo trước | `REJECTED` | None | Chỉ opt-in PvE đủ telegraph qua P2-19 |
| X-25 | Clone Unity Last Island trái phép / nhập nguyên FOG SaveManager / tung ZIP Craftpix nguồn lên public | `REJECTED` | None | Chỉ dùng code licensed chọn lọc, duy trì SaveService SOH, game-only art render |
| X-26 | 2026 land-war live service, paid lootbox, forced team recipe scope | `REJECTED_AS_DEFAULT` | None | Không ép hệ thống PvP/live-service chỉ để cho đủ 44 hệ |

## E. Original 21 POI **archetypes** — not 21 mandatory literal Last Island map replicas
- POI 01 — Gas Station / Trạm xăng
- POI 02 — Supermarket / Siêu thị
- POI 03 — Warehouse / Nhà kho
- POI 04 — Abandoned Factory / Nhà máy bỏ hoang
- POI 05 — Abandoned Institute / Viện nghiên cứu bỏ hoang
- POI 06 — Harbor / Cảng
- POI 07 — Airport / Sân bay
- POI 08 — Nuclear Plant / Nhà máy điện hạt nhân
- POI 09 — Bunker / Hầm trú ẩn
- POI 10 — Biochemical Laboratory / Phòng thí nghiệm sinh hóa
- POI 11 — Bandit Camp / Trại cướp
- POI 12 — Military Base / Căn cứ quân sự
- POI 13 — Trading Zone / Khu thương mại
- POI 14 — Roadside Crate / Thùng lộ
- POI 15 — Hidden Cave / Hang thú
- POI 16 — Supply Drop / Airdrop
- POI 17 — Boss Arena / Trạm Boss
- POI 18 — Water Outpost / Trạm nổi
- POI 19 — High Resource Island / Đảo tài nguyên
- POI 20 — Dawn Land / Bình Minh
- POI 21 — Operation Base / Căn cứ hành động
Every source archetype requires include/redesign/reject with evidence before E2; later 2021–26 types have provenance caveats. Current A1 11 regions /22 biomes /192 chunks /108 authored site anchors are AUTHORING, not fixed user-voted numerical targets, and 106 site-only contracts are not functional POIs. Actual final count should be determined by interesting activities, map density, performance and lived navigation.

## F. Newly proposed mechanics, prototype discoveries and crossed-topic requests (NOT secretly approved)
| Distinct proposal | Current status | Relationship | Revisit trigger |
| --- | --- | --- | --- |
| After-cast frost on water / energized relay / temporary stone obstacle | CONDITIONAL R&D, Issue#23 P1 | CT-08/Gold synergy already envisioned; not free change to any Gold skill | First A4 actual Gold cast source semantics + A0 terrain/collision truth, then compare first two alternative environmental affordances |
| Rain/snow influences actual crop/fuel/roof protection | P2-17 value trial | Farm/heat P1-13 prerequisite | Real five crop/production cycles, genuine choices and observability |
| Towable physical cart with loaded goods and obstructed paths | P2-18 value trial | Logistics originally planned | A1/A0 real return trip and A3 inventory/custody stable; net value > "extra slots" |
| PvE enemy pathing, damaging walls, repairing base | P2-19 conditional opt-in | CT-07/Atlas SYS36; Prototype P7 | Native structure and nav, no offline grief, demonstrable choice |
| Existing key/power/high-risk site | IN CORE P1-12, not new | Prototype P5 is duplicate of earlier accepted system | Real layered POI and one safe alternative |
| UI context and no schema clutter | IN CORE P0-07, D052/054 | Prototype P6 duplicates binding requirement | A6 real native input+screens and A0 owner receipt |
| Expedition outcome/net-benefit analytics (ExpeditionSummary) | RESEARCH/QA metric, optional player facing | Prototype P8, CT-12 | Authoritative A0/A3 events + actual route outcomes; don't invent performance |
| S6 Whitewater deep POI & paid reconstruction for trapped unique specimen | OPTIONAL POI DESIGN, D047 scope-specific | NOT universal death bag policy | Correct no-softlock design, verified price/source, independent native |
| Last-exit build trap, roof/nav revalidation, full chest/double full inventory, generator split/ice thaw | QA gaps and conditional adapters ONLY, Development(4) | Some SOH safeguards already stronger than prototype bug | Existing native tests reveal real defect; no duplicate design |
| Fire Warrior/Fire Knight / Water Witch and historic five Hero roster | PRE-PIVOT inherited combat/asset ideas; unresolved later decision as **class vs body** | Must NOT override D051 two starting human appearances or 93 Gold source | When A4 skill classes + player identity/state composition proves viable; source assets verified |
| 20/21 Gold Arena fusion/voting passes and exact ancillary environment/enemy effects | INHERITED SOURCE-CUSTODY and A4 acceptance, NOT more UI prototypes | Gold original source full lifecycle and AVFX native fidelity | Per skill source hash, native tick+enemy+terrain pixel comparison before production |
| Dynamic map darkening/contrast for bright terrain during casts | DESIGN QUALITY GOAL, precise implementation open | A1 light mask + A4 source-authentic Gold constraint | Once native Gold on real bright biome available, evaluate visual evidence at 720/2K/4K |
| Decorative mass import of older sources / random terrain / static POI marks | REJECTED as production methodology | D018/D052 | Not reopened absent evidence of real player value |

## G. Open decisions versus direct user burden
**Current five explicit OPEN design rows:** D012 Core debit/depletion/repair per family; D013 death-bag timer/difficulty/respawn; D014 final wall/roof art kit; D015 exact world dimensions and biome boundaries; D020 weather/crop/NPC hostile-raid depth at first launch. D031 exact original 2019 item/recipe count is UNKNOWN HISTORICAL FACT, NOT a design vote.

Additional unresolved specifications INSIDE approved directions (do not double-count as 6th–Nth formal decision): first Core source rarity/reward opportunity and surprise; loot density and 20–180-min pacing; fatigue/temperature/hunger severity; three research mode price/knowledge visibility and specimen sacrifice; station productive queue duration; A8 Quarry rates/harvest/replenishment; armor1/2 legally source-coherent art; UI details and map discoverability; conditional outer-world weather/vehicles/base-defense/NPC/pets; repeatable expedition reset/loadout policy and long-run goal density.

**Immediate user action?** No new design ballot needed before A0/A6/A4 get meaningful native integrated proof. Agent can choose material palette, art kit, site dressing, intermediate recipes/experiments within owner constraints. Human user needed only for genuine qualitative tradeoffs or source permission: if A4 session needs explicit private Gold-vault/connector access, user connects; if A6 private asset import access/permissions require authorization, user connects; no request to publish raw Craftpix ZIPs. Ask at most one materially blocked decision, not dozens at once.

**Decision windows**:
- **NOW / E0 engineering**: fix Knight D051 drift, no-Core real loot/first house, A1/A3 mount and native restart/dupe; A7 can verify. User can stay out until hard access or genuinely taste-sensitive conflict.
- **B0 integrated first-hour**: test no-Core 20/45/90-min alternative routes, bag fairness, protection signal, home chores; propose 2–3 evidence-backed tunings, then user chooses severity ONLY if source data cannot decide. Do not invite user as premature full-playtest.
- **B1 first authentic Core**: show two real cast options/use-store-research flow, audit EXACT source Gold, decide D012 per cast vs channel/recharge/exception and rarity/repair, no generic mandatory hoarding. A4 source needed.
- **B1 layered POI+farm production**: calibrate D013 bag rescue, P1-12 hazards/credential/power, timed production/crops/heat and D020 weather integration. Choose via reproducible 1–3 hour native comparisons, preferably agent-led.
- **World content expansion**: decide D014 art kit and D015 dimensions/density after streaming perf, actual views and 2+ representative regions; avoid arbitrary dimensions up front; genre-inappropriate asset source rejected.
- **B2 long-form before E2**: optional P2-17..22 experiments, accept/reject each via gameplay value, 14-day-esque economy not artificial waiting, three genuine future goals. E2 first human complete game playtest after connected full experience; user qualitative judgment then essential.

## H. What is NOT DONE
Neither 54 decision rows nor 44 SYS classifications are native feature passes. A0 last verified overworld still instantiates Knight; A6 base sprite sheets not imported; A1 world/Waystation and A8 3 POIs not in normal production; A3 source–recipe tests and 14x45m sim not evidence player enjoyment; Gold 93 registry does not imply 93 fully-native; B0/B1/B2/E2 NOT accepted. Each owner PR needs HEAD refresh and actual native/visual/human evidence. Cannot honestly count #individual implemented features as one stable inventory using management package tallies.

## I. Handoff and change control
Mark this report as `RESEARCH_SYNTHESIS_NOT_USER_APPROVAL`, not an added D055 or a new mandate to add all deferred content. Next coordinator must read `docs/survival/NEW_CHAT_BOOTSTRAP.md`, `EVERY_REPLY_HANDOFF_PROTOCOL.md`, Atlas and D001–D054, direct user asks; refresh PR19–26 and native results; update only with reasoned source changes and dated supersession. No Arena prompt is dispatched by creation of this report.