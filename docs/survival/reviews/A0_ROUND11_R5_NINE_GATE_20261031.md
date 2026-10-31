# A0 ROUND 11 — R5 nine-domain verdict at `58703bd6` (2026-10-31)

**Scope.** A0-owned code on draft PR #21, branch `arena/dea2428e-soul-of-hero`, commit
`58703bd6` (`58703bd6…`, pushed). Local Godot 4.7 `stable.custom_build` built from the
`4.7-stable` tarball in this sandbox. This is not a merge, not a B0 acceptance and not
E2/human play. Every verdict below is scoped to what was actually executed here.

| # | Domain | Verdict | Evidence / why |
| --- | --- | --- | --- |
| 1 | RESEARCH_PROVENANCE | **PASS scoped** | A3 owner bytes adopted unmodified at `35214ed8` (service `109c2680`, items `cd1a27c4`, planners `11ba4037`/`35e88cc0`); no A3 cost, formula, rate or loot table was rewritten. Every endpoint/deposit/vending/recycler number is read from `meta_economy.v1.json`, every recipe from `recipes.json`. No invented price, no invented reward. |
| 2 | ARCHITECTURE | **PASS scoped** | One SaveService, one run authority (`RunLifecycle`), one wallet (`profile.*` inside the same document), one profile port. A3 planners stay canonical; A0 added only `commit_tool_use` / `commit_offline_settlement` commit boundaries. The A3 profile port no longer creates runs (`ensure_run` removed) so a second run identity is structurally impossible. |
| 3 | CODE_RUNTIME | **PASS (native, headless)** | Native runs at this SHA: foundation 144; pin fence 10; profile port 49 + 15; run lifecycle 49 + 14; tool/offline 35 + 9; player return 26 + 17; damage/death probe 19 + 11. All two-process pairs green on the same disk profile. Rendered runs remain **NOT_TESTED** here (no X11/GL in this sandbox) — they only run on hosted CI. |
| 4 | TEST_ORACLE | **PASS scoped** | Negatives actually executed, not described: stale tool revision (`TOOL_REVISION_STALE`, no condition cost, no item), foreign tool (`TOOL_NOT_OWNED`), broken tool (worn out through A3's own `wear()`), wrong node kind (`TOOL_KIND_MISMATCH`), nonexistent node (A0 refuses before A3), stale A3 owner bytes (`a3_data_pin_mismatch` → `A3_OWNER_BYTES_STALE:`), stale script bytes, candidate endpoint, absent endpoint site, forged/replayed deposit, refused deposit secures 0 currency. No oracle was weakened: the death probe was fixed by honouring the real i-frame window, not by raising damage. |
| 5 | VISUAL_UX | **NOT_TESTED** | 720p/1440p/2160p, A6 bodies, player-facing prompts: nothing was viewed in this sandbox. A6 remains unmounted; no visual claim is made. |
| 6 | SYSTEM_VALUE | **FAIL (B0 not earned)** | What a new player can now do: open a fresh run, gather stone and oak bare-handed, craft the authored stone pick at the hand station, harvest a real iron vein with a real A3 tool-use receipt, and keep the exact result across a quit and relaunch. What is still missing for B0: one single continuous rendered journey that does the walking *and* the tool leg, a real damage source, and a human playtest. |
| 7 | SAVE_MIGRATION | **PASS scoped** | Two independent OS processes on the same file: exact item conservation, same unique instance id, same condition/revision, same single `soh.a3.tool_use.*` receipt, no extra transaction, receipt still durably applied, run identity/epoch/deadline restored, secured profile preserved across a 336 h expiry reset while run-local items are dropped. |
| 8 | INTEGRATION | **FAIL (external owners)** | Every A3 meta endpoint is `OWNER_CONTRACT_CANDIDATE_A1_A8`, so A0 now reports `A1_A8_ENDPOINT_UNAUTHORIZED`; endpoints in `crown_approach`/`harbor_ruin` have no authored stand at all (`A1_A8_ENDPOINT_SITE_ABSENT`). Every `currency_source` is `OWNER_CONTRACT_CANDIDATE_A8`. No authentic damage producer exists (hazard rectangles are geometry only). All three are owner decisions, not A0 bugs. |
| 9 | BALANCE_REPLAY | **NOT_TESTED** | The 14-day / 6-elder-region arc is creator-locked in A3 data and A0 enforces the 336 h window and the 264 h last-72 phase, but no multi-day replay was played. No balance claim. |

## Task verdict

`CONTINUE_WITH_CORRECTION` → the correction this round was **product**, not more fixtures:
the round added a real craft→tool→harvest→return→relaunch chain on the production scene
and a fail-closed endpoint/authorization surface, and it removed the two fake passes it
found (a stale A0 adapter pin that silently unmounted the whole economy session, and a
death probe that never landed a lethal hit).

**Product verdict:** `PR21 DRAFT / B0 HOLD / E2 NOT DUE`.
