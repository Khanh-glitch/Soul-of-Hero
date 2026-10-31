# Control Tower R0–R5 — A0/A1/A6/A8 Round 11: native, visual, product and joined evidence

Date: 2026-10-31 ICT. Authority: CURRENT_PRODUCT_CONTRACT; D062–D074; immutable Atlas with SOURCE_COVERAGE_TRACE; INDEPENDENT_DEEP_REVIEW_PROTOCOL; EVERY_REPLY_HANDOFF_PROTOCOL. **Exact refs are snapshots, refresh before execution.** This is a scoped *independent* CT review, not self-merge or player acceptance.

## 0. Disposition

- **A0 PR21** `738e621b688e9d9890f636ef2ece48f6d29f5b01` (tested gameplay code `222f6357aeafebbe867bc0684a8b4d3057f245b9`): ACCEPT_NATIVE_ENGINEERING_SCOPE / CONTINUE_INTEGRATED_PRODUCTION / B0_HOLD.
- **A1 PR20** `9ca1453ccdd315c9de4aae01cf0e1e5b4e0a71cf`: ACCEPT_SOURCE_AND_ISOLATED_NATIVE_SCOPE / PAUSE_NEW_GEOGRAPHY / READY_TO_SUPPORT_A0_A8_ADOPTION; no authoring creep.
- **A6** `b32f347ea1b234386ba16949c54f7119fdda0341`: REJECT_ROUND12_AS_DONE / NATIVE_PARSE_FAIL / VISUAL_LAYOUT_FAIL_720P / CONTINUE_COHESIVE_UX_INTEGRATION.
- **A8 PR26** `6337533f7cc0d39487921e279d3967ac29a59297`: ACCEPT_NATIVE_PHYSICAL_POI_SCOPE / VISUAL_PRODUCT_HOLD / A0_A3_PRODUCTION_HOLD; CONTINUE_REAL_MOUNT_AND_SITE_PAYOFF.
- **A3 PR19** `b44e22df`: PAUSED; dedicated native PASS; no new work until exact physical source, meaningful sink/cost and A0 native owner projection or independently proven A3 defect.
- **A7 PR25** `9a386d8d`: historical Round10 input diagnostics valid, current owner composition absent. CONTINUE independent exact-current composition after owner fixes.
- B0 HOLD, E2 NOT_STARTED, NO_MERGE. Source-safe Gold/AVFX unchanged.

## 1. Directly inspected evidence

### A0
- Native 4.7 on local tool, two OS processes 12/12 exit 0 at `222f6357`, evidence in `docs/survival/reviews/A0_ROUND11_R5_NINE_GATE_20261031.md`: fresh run → bare-hand oak/stone → A3-priced 2 oak+3 stone stone_pick → iron vein harvest wearing 100→99, exact receipt + restart, late expiry reset isolation. Danger: no authentic damage source; no single continuously *rendered*, human-inspected walking/tool/return scene. A0 report itself marks SYSTEM_VALUE FAIL and VISUAL_UX NOT_TESTED.
- A0+A6 temporary pinned native workflow [41166608047](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41166608047) SUCCESS but used older A6 SHA `6b801554...`; this does **not** authorize current A6 UI.
- Newer A0+A6 V4 temporary workflow [41166608006](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41166608006) FAILS using A6 SHA `8bc0af5a...` in workspace/planner and presentation: `expedition_planner.gd` inference parse errors for `live_owner`/`developer_fixture`; `open_planner/close_planner` invalid calls; workspace/modal timeouts and failed HUD, journey and owner-dependent tests. Attribute source precisely; do not rewrite A0 SaveService to make bad A6 compile.

### A1
- World Reader [41164830322](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41164830322) and [41164835626](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41164835626) both SUCCESS at `9ca1453c`: 142 Python, 174 native, 73 driven segments, 18 distributed safe spawn candidates, 25 captures at 720p/1440p/2160p, 0 fixture collision/stream/teleport violations; marsh slowdown 0.65 remains **test-only**.
- CT independently downloaded native 18 MB artifact ID `13029217461` and opened real Godot 720p screenshots for Crown Waystation day/night, Mirrormere, Ashwater Fen, Ember Steppe, Frost Crown, Pearl Mangroves, Verdant Fold and Saffron Coast. World palette and POI silhouettes differ clearly; night and high-volume terrain are atmospheric. **Limit:** still isolated Godot fixture using old WHITE KNIGHT character; no A6 grade0 player/HUD, no production exploration/economic/hazard payoff. Several field windows exhibit sparse interaction landmarks and broad visually flat/patterned surfaces at player scale; do not turn broad biome variety into a final 'fun/visual' pass.
- All four A1 Ragnarok endpoints are **TRIAL**, not approved production. The `a8_deep_chest_south_quarry_01` proposal at socket [33,280], stand [33,282], last72 only is `interaction_enabled=false`, `reward_items=[]`; no A3 auth or A0 mount, no payment/credit.

### A6
- Verified 29 source-receipted real CraftPix UI pieces and inspected source contact sheets, pixel crops and icon binding samples. Authored nine-slice parchment/wood/teal surfaces are a meaningful upgrade over the former flat panels, but the product is about rendered real scenes, not source art quality.
- [Native avatar workflow 41167017013](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41167017013) current `b32f347e`: real 720p render job FAILED. `game/ui/screens/avatar_choice/avatar_choice_screen.gd` defines identical `_manifest_has_staged_art()` twice, at lines **122** and **139**, causing Parse Error. The capture then cannot reach Home. CT fetched and compared both definitions directly, so this is a proven code regression, NOT runner congestion or bad sprite.
- CT downloaded partial A6 native artifact ID `13029686099` and visually opened actual 1280x720 `male_720p_01_01_title.png`, `male_720p_02_02_identity_choice.png`. 'Title' capture is legacy SOUL FORGE loading screen at 08%, 'Đang triệu hồi các linh hồn Hero'/'Đang dựng Thánh Địa', not a settled survival title; capture timing and residual product copy are suspect. Identity screenshot clips oversized 'BẠN LÀ AI?' at top, clips NAM/NỮ labels at bottom, allocates huge blank area in each parchment panel while grade0 avatar is tiny. Direct observed 720p LAYOUT_FAIL and weak character salience, not a taste-only issue. No current complete 2K/4K native screenshots observed; `a6-survival-ui-render` [41166892389](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41166892389) still queued at review, tested older `8b39f756`, not `b32f347e`.
- Real return/season, equipped slot and keyboard I/TAB are not yet owner-resolved; 28 of 49 items lack truthful distinct icons. Do not show 'no art' debug to player as a finished visual strategy or fabricate item pictures.

### A8
- [A8 native world-content pilot 41166238346](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41166238346) at `6337533f`: completed SUCCESS. All jobs/steps for authoring, Godot native physics, exterior transitions, real input journeys, surface, Ragnarok projection, 720p/1440p/2160p captures passed. CT downloaded artifact ID `13030155012`: `A8_NATIVE_POI_INPUT_JOURNEY_PASS assertions=293`, mutation probe explicitly catches unauthorized gate entry, 27 frames per each of three output resolutions. Previous A8 FAIL at 9d568e is SUPERSEDED for scoped native fixture.
- CT viewed nine representative real 720p A8 captures: Quarry east vs west, Orchard irrigated/graft, Mill leave seized vs repair, shell baselines. This native presentation shows actual different spatial opening/closures; BUT huge dark/black dead areas, microtext and diagnostic bars dominate many frames, interaction outcomes hard to distinguish visually on standard 720p. The images explicitly say `A8 INPUT JOURNEY: projection fixture only - no live economy/save`. Native fixture visually inspectable, still **VISUAL_UX_HOLD_FOR_PRODUCTION** and SYSTEM_VALUE_NOT_PROVEN, not equivalent to genuinely satisfying living POI.
- `data/survival/world_content/quarry_integration_candidate.v2.json` still says `A8_SOURCE_READY_A0_A3_INTEGRATION_HOLD`, no canonical A0 instance, no A3 approved bindings and `cost/yield/active_cooldown=null`. `quarry_economics_evidence.v2.json` marks economics null intentionally and warns east/west local path difference is only **104 px / 6.5 tiles** with no risk/time/reward difference proven. Do not mint artificial rewards.

## 2. R0–R5 judgment

R0 research/product: PASS referenced current contract; all recent owner reports respect fail-closed and source identity as far as observed, but actual 'quiet knife-first, Core, home, meaningful return' not demonstrated. R1 source/diff: PASS reviewed precise latest commits, A6 duplicate and A0/A6 exact overlay; stale A7 conclusions not reused. R2 tests: A0/A1/A8 independent scoped evidence valid; A6 regressed parse; A8 fixture source selection is not production authority. R3 engine/eyes: A1 & A8 **actual 720p native personally inspected**, A6 partial actual 720p inspected with defects, A0 composed two engine configurations success/failure but no continuous visual player journey. R4 product: FAIL as current combined game: missing authentic damage/knife, physical funded POI consequence, fully owner-backed return, life-cycle, Core/Gold coupling; decisions not yet meaningfully quantified or human played. R5 acceptance: NO_MERGE, B0 HOLD, E2 NOT_STARTED; dispatch one cohesive 3–6+ hour owner milestone, not micro-tickets.

## 3. Nine-domain product gate at composed-current state

| Gate | Verdict | Explanation |
|---|---|---|
| RESEARCH_PROVENANCE | PASS_SCOPED | canonical rules and exact source/asset identities available |
| ARCHITECTURE | PASS_SCOPED / join pending | one A0 owner; A6/A8 fixture adapters must not become alternate owner |
| CODE_RUNTIME | PARTIAL | A1/A8 native scoped PASS, A0 own native PASS, **A6 exact head FAIL** |
| TEST_ORACLE | PARTIAL | A8 mutation positive, A0 2pid; A6 parser escaped local lint; A7 latest join needed |
| VISUAL_UX | FAIL_720P_A6 / HOLD_A8_PRODUCT / PASS_A1_SCOPED | actual native pictures inspected with precise issues |
| SYSTEM_VALUE | FAIL_UNPROVEN | no complete first-hour authentic input→risk→reward→home→return |
| SAVE_MIGRATION | PASS_A0_SCOPED / join NOT_TESTED | 2pid A0 save, POI owner not mounted |
| INTEGRATION | FAIL | A0+A6 V4 latest failed; A8 source refuses production rewards |
| BALANCE_REPLAY | NOT_TESTED | utility and 14-day replay lack human observations |

## 4. Decision, no churn

Run a single owner-coordinated **ROUND12_CONNECTED_PLAYER_EXPEDITION** with A0 integration and player input, A8 three real physical sites, A6 finished authored UI at actual display sizes, A7 source-composed independent falsification. A1 pauses more world authoring but supplies immutable geography/stand/hazard evidence; A3 stays paused until exact owner-backed approved economic source or real implementation bug; AVFX continues original Gold. No extra props, new PR or conflicting docs. Full owner work orders at `docs/survival/tasks/CT_ROUND12_CONNECTED_PLAYER_EXPEDITION_20261031.md`.
