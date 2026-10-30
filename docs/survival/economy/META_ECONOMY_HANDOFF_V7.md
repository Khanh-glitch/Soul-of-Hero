# A3 V7 — two-layer Ragnarok economy handoff (D062–D067)

**Player-visible target:** late in the 14-day run, dangerous awakened-elder treasures can contain physical, losable Remnant Seal tokens. Carrying them, opening a chest, killing a boss, storing them at home, dying, or reaching expiry does **not** bank them. The player must physically reach a preservation kiosk and commit one exact-once deposit. Only the secured profile balance survives into the next run, where fixed vending machines offer finite, voluntary, paid agency—not a free starter kit and not a Core vending machine. Recycling returns run-local salvage only.

## Four economic objects
1. **Run-local resources / Spares / recipes / production** — unchanged V5/V6 economy.
2. **Physical late-Ragnarok currency** — `ragnarok_unbanked`, unique `key_item` token, one token = one unit only after deposit.
3. **Six elder achievement stones** — profile achievements, zero currency value, not vendor goods, no money multiplier.
4. **Secured account currency** — `profile.secured_ragnarok_currency`, written only by A0 through one SaveService transaction after legitimate physical deposit.

## Authority boundary
A3 is **candidate-only**. Without an injected A0 profile port, every meta plan fails closed with `A0_PROFILE_BOUNDARY_ABSENT`. The native tests use `tests/survival/catalog/a0_profile_port_candidate.gd`, explicitly labeled **OWNER-CONTRACT CANDIDATE — NOT PRODUCTION A0**. It writes the same SaveService document; it is not a second wallet or side file.

## A0 mount order
1. A0 RunLifecycle produces `run_context()` (336h max, last-72h phase, voluntary abandon/expiry).
2. A1/A8 produce physical endpoint/source identity; A0 authenticates visit/open state.
3. A0 implements `soh.economy.a0_profile_port.v1` against the existing SaveService candidate.
4. A0 calls `configure_meta_profile_port(port)` after `configure()`/`load_catalog()`.
5. For deposit/purchase/refund/recycle: plan read-only → one `SaveService.transact_once(proposal_id)` → `apply_*` inside the mutator → commit.
6. A0 run reset preserves only profile achievements/history/secured currency; clears all run-local namespaces.

## Numeric balance (AI_TUNABLE, not creator-locked)
- 6 elder vaults: 35% chance, 2–5 units, one claim/run each, 2.5–3h round trip, risk 4–5.
- Rare roadside last-72 vaults: 18% chance, 1–2 units, up to 12 claims/run, 1.2h round trip, risk 2.
- Vendor meals 1, basic materials 1–2, stone pick 4, salvage hammer 5, research kit 6, iron pick 8. Finite per-machine stock.
- Recycler: run-local salvage only, `profile_currency_delta = 0`.
- Deterministic 336h model: `tools/survival/economy/model_meta_economy.py`. Baseline expected banked units: home 0, exploration ~1.5, combat ~3.8, currency ~6.4, one-stone ~2.6, evacuation ~4.5, six-stone ~4.8. No universally dominant strategy in the model. Sensitivity: drop ±50%, travel +50%, prices ±50%.

## Naming
Working title **Tàn Ấn** (Remnant Seal). Alternatives: Dư Ấn, Hồi Ấn, Di Tích Ấn. The spoken phrase “tiền suy ngụ” is **unverified** and is not an item ID or schema field. Display strings live in `data/survival/items/meta_display_names.v1.json`; technical IDs and receipts never depend on them.

## Evidence level
`NATIVE_FIXTURE_PASS / OWNER_CONTRACT_CANDIDATE / WORLD_NOT_INTEGRATED / NOT_HUMAN_PLAYTESTED`. No A0 production profile boundary, A1 geography, A8 POI logic, A6 scene, or AVFX Gold was edited. See `verification/v7/` and PR #19 for exact SHA/native logs.

## Live owner heads refreshed before V7 coding (2026-10-30)
- CT `docs/ct-loot-discovery-gate-20261030`: `971e0b95e1ea1c5f579f57f53fb35f3a6c3845e8`
- A0 PR #21 (draft): `8750fd8a48a552b0d58834ec519dfc97528ee194`
- A1 PR #20: `178a5ba200c7617b14a9798c4ff21575f5519cd8`
- A6 PR #24 (draft): `63d3fae54b1e204a84fced6a285bc969ed5bfdfe`
- A7 PR #25: `8b8f15e313c348a9fde0a2a7ee57110f2131676c`
- A8 PR #26: `54c66b89b839d773f93c023afb13f0f9295ec9a0`
- A3 starting checkpoint: `a5d11141b12be16cc8d63957d0409169dbb79213`; hosted A3 catalog/native-adapter validation already passed. V7 does not reopen old red CI.
