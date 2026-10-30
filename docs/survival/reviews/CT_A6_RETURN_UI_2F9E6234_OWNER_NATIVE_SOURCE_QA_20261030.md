# CT A6 Return UI — independent source/native evidence review, 2026-10-30

## Evidence and status

Actual GitHub commit 2f9e6234b84282ae192d3e6f78e1bef8f4816237 is one commit after f3556747, adds ~3145 lines in A6 UI/return source, tests, capture, docs, bash gate, avatar workflow. No A0 SaveService, AppFlow, actor or chest modified in THIS commit; inherited f355 branch still contains old A0 owner-file edits and cannot be merged wholesale into current A0 28f2d578. This is a separate branch arena/05e0328d-soul-of-hero, NOT existing PR24 (63d3fae5). GitHub Actions for exact head 41063171974 and 41063172072 remain QUEUED. Old f355 A6 workflow cancelled by newer push, not passed.

A6 local native Godot 4.7 headless reported 88/88 return UI assertions, avatar male/female full74/verify31 each. CT read actual tests and scripts but did NOT execute local Godot or inspect true screenshots; tests mostly mocked owner projections, geometry via fixed layout sizes, and read-only SaveService snapshot/file assertions. The new bash runner correctly fails on nonzero editor import and native failure and SCRIPT ERROR (improved over old avatar gate). Visual capture intentionally refuses headless exit2, registered in Xvfb software GL CI but pictures not reviewed. CPU/native geometry is not human visual acceptance.

## Legitimate work

Five true Godot UI scenes plus one read-only CanvasLayer: season 14-day chip, D057 guide, non-blocking return digest, D056 run records/achievements, D061 local cues. Owner projections validated; unknown data hides appropriately; no fake offline forge, crop, research, no made-up season score or persistent buff, no SaveService writes in new commit. A0 source actually has structures/structure_count/inventory_totals/document, so guidance can read currently held state. Owner season clock/digest/history/cue projection methods not yet published on A0; production layer not mounted. Rejection of a FULL 13-day seasonal interval is correct and distinct from showing 13 days remaining.

## Defects visible in source — require A6 owner-only fixes

1. D057 guidance false regression: a6_guidance_model.gd uses CURRENT carried inventory >=6 for gathered milestone, so after spending/putting loot into chest a completed step unchecks. Current structure_count>=1 is treated as valid shelter, but one wall/foundation is not enclosed 1-floor protected room under D004/D059. Tests inject out-of-order bed, not gather->spend or lone-wall shelter. A0 owns durable ever-performed action/valid roof projection; A6 must not fabricate receipt. Separate 'currently holds' from 'ever completed' and represent unknown honestly, request owner semantic facts.

2. D057 run-mode bug: _resolve_mode(clock, completed) guesses RETURNING when no owner season clock and any step is done. A first-run novice who gathered/builds one thing becomes 'returning' mid-season, losing the full novice guide. Do not infer account run_number from items.

3. D061 apparent omniscient radar: site_cues.v1 allows arbitrary precise distance <=400m and displays 'Tiếng bước chân · 42 m' without perceived modality/LOS/human hearing range/observation age TTL. The user locked physical trails and self-reading nearby monsters, not an accurate omniscient 400m sensor. Qualitative owner-perceived cues only or externally justified perception source; old evidence must not be shown as current safe/unsafe. No user-locked sensing constants.

4. D055 last-minute display: A6TimeFormat.countdown(1..59 seconds) prints '1 phút' because maxi(1, minutes), contradicting promised floor and potentially understates urgency; display 'dưới 1 phút' or actual seconds, then 'Đã khép' at expiry. Full 13-day span rejection remains correct.

5. D056 empty record false assertion: A6SeasonRecordPanel.open(history unavailable, clock unavailable) calls present->clear then visible=true, leaving scene-initial 'Chưa có mùa nào khép lại' and 'Chưa có thành tựu nào' instead of 'Chưa có dữ liệu mùa' and 'Chưa có dữ liệu thành tựu'. Test only checks absent history WHEN a valid season clock was injected; add both-unavailable native test.

6. D056 history cap/order: sanitize_run_history takes first 20 valid entries then sorts them. A 21st newer valid entry arriving from unsorted owner data is dropped, contrary 'newest first'. Sort then retain latest 20, cap input processing if needed; test >20 shuffled.

7. Digest once-per-id only per current layer lifetime: _seen_digests is in-memory; fresh process with same owner digest_id may repeat. No second A6 save; owner must provide read-only acknowledgement/generation if 'once across OS' required; test 2 processes after projection contract exists.

8. UI capture: a6_return_ui_capture prints OK (0 files) and exits 0 if PNG save fails; CI global PNG count>0 can be satisfied entirely by avatar captures; require FOUR return UI states per EACH resolution, inspect actual screenshots, plus coexistence with A0 HUD/Gold before real visual PASS.

## Gates

R0 concept: meaningful read-only design, incomplete genuine world-return because owner projections absent; R1 scoped code ownership PASS in new commit, full f355 merge UNSAFE; R2 source+reported local headless positive, exact CI queued and discovered negative test holes; R3 native rendered pixels NOT TESTED; R4 cross-process owner return receipt/season state NOT PROVEN; R5 production HOLD.

Staffing: A6 CONTINUE focused owner-source correction now, no replacement and not PAUSE yet. Keep A0 B0 critical path uninterrupted. After correction and actual source-level and native proof, A6 may mark owner-component READY pending A0/A3 integration. No merge or false user-visible product claim.
