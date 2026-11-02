# Google Docs authoritative design archive and reconciliation (2026-10-29)

**Google Doc:** https://docs.google.com/document/d/1q8Vevy4qx_6AFyfJodmsWAhdSBBumtx31hxXnWPelqo/edit

## Required read order before starting an agent session
1. Original tab `t.0` (Thẻ 1) and `t.cl88ua16ygx3` (Thẻ 2); neither is a complete literal transcript of both voices.
2. Tab `t.4fbojrhyupx9` — `03 · Yêu cầu & audit đầy đủ`: detailed user requirement IDs, proposed ideas, unapproved choices and eleven audit gaps.
3. Tab `t.h4haqfdoyzzn` — `04 · Nhật ký LIVE & bàn giao`: append-only session/commit/test/next task record.
4. This branch's `AGENTS.md`, `docs/survival/STATE.json`, `DECISIONS.md`, `CONTRACTS.md`, `SOURCES.md`, `ACCEPTANCE.md`, `WORKLOG.md` and issue #9. Independently resolve current Git HEAD and CI.

## Critical findings from direct original-doc review
- The original “Thẻ 1” has ~63,151 extracted characters (835 paragraphs) and begins with the assistant's explanation of *Last Island of Survival*. It largely reproduces **assistant answers**, not all user prompts, and omits substantial early world/overworld work. “Thẻ 2” is a ~5,176-character inspiration recap, also not verbatim conversation. Do not assert 100% transcript coverage.
- All confirmed user requirements are enumerated in tab 03 as `U-W##`, `U-G##`, `U-P##`. Suggested / NOT user-approved ideas use `A-...` labels. Never turn a scenario (e.g. Venom Core 37/80 uses, illustrative recipe, map 768x512) into an approved balance rule.
- Original Git summaries did **not** preserve fine-grained loot barrels/scrap, graded keycard POIs, room-roof behavior, weather/farm acceleration, source-locked VFX and the distinction between a valuable found Core and permanent recipe in sufficient detail. Agent must consult the Google Doc tab 03 before coding each corresponding feature.
- The `Four Frontiers`, `Living Continent`, `Kingdoms of Frontier` world design alternatives were suggested; user respected the ideas but **did not finalize B or any map architecture**. World masterplan remains OPEN.
- A vertical slice is an integration proof, **not the full scope ceiling**. User wants an end-to-end implemented world/gameplay, not an indefinite sequence of small demo approvals.
- 93 Gold entries on the audited readiness branch were **0 native-port-ready**. No Gold exact source claim without original ZIP bytes and native same-seed full-cast proof.
- Asset catalog records ≠ downloaded archives present in Git. Separate source-art reuse licenses from permissively licensed external code.
- Drive permissions readback showed `anyone` role `writer`; it is sensible for owner to restrict write access. This audit did not change sharing permissions.

## Synchronization protocol
At the end of **every meaningful implementation session**: update Git `STATE.json` and append `WORKLOG.md` with exact SHA, path, tests and failures; update Doc tab 04 with the same evidence; update tab 03 when requirements/decisions change. Verify both readbacks. Git is code/CI truth; Google Doc is context/design archive. No background automation or automatic sync exists merely because these rules are written. If an agent lacks Drive permissions, mark `DOCS_SYNC_PENDING` in Git and never claim synchronization.

## Provenance and safety
Original tabs retained without editing. The summaries in tab 03 are structured interpretations and gap tracking, NOT a complete word-for-word speaker transcript. For exact phrasing, revisit the source conversation. Do not put personal secrets/tokens into repo or document.

## 2026-10-29 historical A–Z research sync
New Google tab `t.dg7e10u8in6k`: `05 · Last Day Rules 2019–2020 · A–Z`. Source-grounded detailed 29,902-character atlas is mirrored in `docs/survival/LAST_DAY_RULES_2019_2020_RESEARCH_ATLAS.md`. See full H1/H2/H3 version boundaries, dated formula samples, missing recipe count, long-run replay value and autonomous F0–F5 approval gates. Tab 04 appends verified commit/test data; read all **five** tabs, not just old tab 1–4.

## 2026-10-29 uploaded source research archived fully
- Tab `t.zd0pbvgw748h`, title `06 · BẢN GỐC NGHIÊN CỨU · 1355 DÒNG`: full Markdown research text mirrored; original exact byte copy in `source_archive/` with SHA256 proof.
- Tab `t.zhlc1xjywaxp`, title `07 · FUSION KIẾN TRÚC · AGENT PLAN`: full copies of SYSTEM_FUSION_BLUEPRINT, ATLAS_RECONCILIATION_AND_DECISIONS, MULTI_AGENT_EXECUTION, ECONOMY_AND_14DAY_REPLAY_BALANCE.
- The LIVE journal tab 04 is updated after each real Git commit with commit/tests/failures; Git `STATE.json` is authoritative for code status. Google Docs does not auto-sync by itself.
- The detailed 108-entry machine index is Git `SOURCE_COVERAGE_TRACE.json`, not a thin summary. Source file never edited.
