# CT independent A6 Round 11: source unblock verified; first engine-frame inspection; player-journey hold

Date: 2026-10-31. Reviewer: Control Tower. Source A6 branch `arena/05e0328d-soul-of-hero` HEAD `fbe8b2940adbf0ded5f2e009c09309b51a539eb4`, docs-only above green tested code `19c9c7872cf908f123cf50862556c99545660f0a`. This review does not alter the A6 branch or merge.

## R0 / Evidence ledger

- [Native Godot 4.7 workflow 41162133383](https://github.com/Khanh-glitch/Soul-of-Hero/actions/runs/41162133383), exact tested SHA `19c9c787`: all four jobs SUCCESS (real staged art identities; real rendered captures; public clone fail-closed; return UI).
- Separate asset repo `Khanh-glitch/APEX-CHAOS`, male 555940 commit `bf11a0cecfda43beca510062bd5d9dc1a8573cc5`, blob `ce3e032df5b67ef6c25ae4dcb0562bb3b7e545c0`, 6,439,805 bytes, SHA256 `b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795`; female 419402 commit `b75dfc0ffa98c25059d67f655be14e419e63430b`, blob `854be998896252479a678aef6f4b7b09d809a6b4`, 6,419,098 bytes, SHA256 `f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad`. Old anonymous Drive ZIP blocker is CLOSED.
- Unlike the owner sandbox, CT successfully downloaded **GitHub Actions artifact id 13028032333, `a6-native-captures` (21,623,596 bytes)** and **opened actual Godot PNGs** for both genders in Home, Overworld, attack, death, respawn and Continue. Source contact strips also directly opened. Valid framebuffer resolutions: 1280x720, 2560x1440, 3840x2160.
- Return consumer source: `tests/survival/ui/a6_a0_consumer_test.gd`. Two OS processes exercise A0 `grant_inventory_item` and `place_structure`, save, then compare current A0 state after cold boot; A6 has read-only behavior and no invented digest. The test does not establish actual A3 funded offline settlement or 336-hour season owner projections.

## R1 / Player-visible observations from real PNG

1. The authored male and female grade-0 characters are both genuinely visible and visually distinguishable on in-engine Home and Overworld screenshots, including action frames. Pixel edges look nearest-sampled. Death/respawn screens exist. Source sprite sheet death frame index 4 is a red silhouette in both identities; a source feature, not grounds for unapproved redraw.
2. **Home is currently the existing legacy `home_map_screen` hub**. Its HUD still says `CHƯƠNG 01 • 0000 VÀNG`, and an existing blue archer/NPC is directly adjacent to the bald avatar in the 720p image; this is confusing composition, but it is NOT evidence that the avatar's own Sprite remains the old Knight. The native test asserts A0-selected player's old `Sprite` is hidden.
3. Overworld screenshots include older HUD text (`PROVISIONS`, `CAMPS`, `FINDS`, `WAYS`) and microtext instructions. These are proof the route exists, not final E2 UX or a playable home/loot/build/research loop.
4. On the separate-process Continue captures, the frames labelled `22_continue_overworld_idle`, `23_continue_overworld_walk` and `24_continue_overworld_idle_after_walk` report A6 presenter action **`idle`** at the purported walk frame for both genders. Direct RGB image diffs between 22→23 are confined to tiny character-local pixel bounds: male approximately (642,359)-(647,366), female (640,359)-(650,366), with no world camera shift. The screenshots **do not prove resumed world locomotion**. Before diagnosing root cause, measure actual actor world position/velocity, inputs and host action under Continue after pending-death recovery; distinguish genuine input/collision lock from capture harness misuse. Do not claim walking merely because a PNG filename contains 'walk'.
5. At 720p the actor is rendered small relative to map; check real camera size/contrast and avatar visibility in an ordinary loot/combat scenario. 1440p/2160p mechanically render valid pixels, but sharp scaling alone cannot prove usability in all display contexts.
6. During death, the modal overlays the live scene. The frame supports a death/respawn route but does not prove a physical bag, bed, or recoverable-item gameplay. Do not claim these outcomes from the A6 capture.

## R2 / Nine gates (scope-specific)

| Gate | Verdict | Reason |
| --- | --- | --- |
| Research provenance | PASS | Exact source binary repo/commit/blob/size/SHA; source identity fixed |
| Architecture | PASS_SCOPED | Avatar adapter read-only; A0 projection source; no A6 second SaveService |
| Code/runtime | PASS_SCOPED | Godot 4.7 native male/female & A0 read-only consumer; Continue world movement still unproven |
| Test/oracle | PARTIAL | Native jobs green but labelled Continue walk doesn't assert position or action change |
| Visual/UX | PASS_SOURCE_AND_ENGINE_FRAMES / HOLD_GAMEPLAY | CT opened real engine screenshots; legacy hub, tiny actor, old text, and Continue movement uncertainty remain |
| System value | HOLD | No real day-1 knife→loot→paid home→bed→offline production loop shown |
| Save/migration | PARTIAL | Identity & structure survive two OS processes; 336h run reset/return digest not proven |
| Integration | HOLD | A0/A3/AVFX production player journey and return projections not composed |
| Balance/replay | NOT_TESTED | A6 alone does not prove economy/replay |

## R3–R5 / Dispatch decisions

**ACCEPT:** Genuine grade-0 male/female source, transport/staging, native presentation at measured resolutions, death/respawn presentation path, cross-process identity persistence, read-only A0 current-state bridge. This is a meaningful win.

**HOLD:** `PLAYER_RETURN_S1`, real-world continuous loop, real A3 funded settlement digest and D055/D057/D061 owner state, verified motion after Continue, grade1/2 matching armour, human playtest, B0/E2 integration. Do not reuse stale PR24; no merge.

**Next A6 P2 (same branch):**
1. Immediately pin and instrument second-process Continue world input. Assert nonzero displacement, velocity, actual `run/walk` action and rendered pixel displacement on traversable ground; verify for male/female with and without pending death. If the blocked input is A0-owned, prove exact caller and hand off to A0 without A6 rewriting physics.
2. Render an A0-composed *ordinary* J01 player journey from New Game: selected bare avatar, real roadside loot interaction, knife vs real weak enemy, build paid shelter, death→bed respawn, and Continue; distinguish unavailable mechanics rather than fabricate test paths.
3. Coordinate `PLAYER_RETURN_S1` with A0/A3: funded station input → real elapsed offline time → claim once → fresh process → read-only digest/clock/history; no injected projection on acceptance path; A0 commits receipts.
4. Inspect screenshot at normal playable scale for legibility, contrast and crowded Home NPC; make A6-owned HUD adjustments only without rewriting owners' world or Gold.
5. Scout matching grade1/grade2 visual sources independently in the now-located asset repository, but do not delay shipping grade0 on that work. Do not substitute another character.
6. A7 adversarially validates latest SHA with negative identity, input/modal blocking, asset missing, duplicate rewards, stale digest and run reset.

**Cross-owner:** A0 to expose real run clock/guidance, digest/ack/history and integrate main scene; A3 to provide funded settled offline outputs only through A0; A7 to compose same HEAD and verify ordinary input. A6 may not mint/commit.

No approvals to merge; retain CT evidence per run SHA.