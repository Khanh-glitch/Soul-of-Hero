# Control Tower independent gate — S6 Unit 3 loss/recovery model (2026-10-30)

## Verdict
**UNIT3_ANALYSIS_ACCEPTED_SCOPED / UNIT3_RECOVERY_POLICY_NOT_YET_IMPLEMENTED / UNIT4_NOT_AUTHORIZED / DESIGN_ONLY / NATIVE_NOT_TESTED / NO_PRODUCTION_ADOPTION.**

Independent source is **`9332e31c0834b536838281d62cadddd579092d82`** on S6's own `feature/surv-s6-poi-depth-001`. Compared against Unit2 `2ee3c5145c51e8e1d6e8c07a397d7f2849498484`: one commit, exactly five S6 lab files, no shared or production code, BRIEF unchanged. Fetched full `MISSION_GRAPH.json`, `UNIT3_RECOVERY_MODEL.json`, `validate_unit3.mjs`, `STATE.json`, `LOG.md` and Issue #18.

## Independent checks (not trusting S6's 551 self-count)
Independent separate in-memory JS graph evaluator verified 11 unique nodes, **23** unique directed edges after new `e23`, 13 actions, all edge endpoints/action-node references, and both complete route A/B sequences and expected exit states. Fixed-state independent BFS over **2,112** combinations reproduces **2,068 reachable / 44 unreachable**, all 44 at `ww_annex` when **both `e18` and `e23` are blocked**, with no other legal exit under their particular power/gear combinations. A single blocked e18 now has e23→e06→e02 as an abstract alternative.

The supplied Node validator's own expected 551 checks and 72-state full-loss search have been source-inspected. The separate review independently confirms why the full-loss state is impossible within the specified resource actions: after death at `ww_collection`, specimen receipt remains spent, specimen plus credentials/priming/protection are in the deep bag, external source and reserve are zero, power is none; available actions create no positive priming or protection, while e16/e17 admission requires ventilation and protection>=2. Thus no reachable entrance to collection or the bag. This is a **valid FAIL of the model's universal-recovery claim**, not a failed completion of Unit3's adversarial-analysis commission. The 72-state exact count remains S6 validator-reported; this independent check did not execute Node `validate_unit3.mjs` itself.

The model's conditional preowned-stock recovery can succeed only if player already has an outside reserve. **Preowned reserve is not an independently verified obtainable A1/A3 production source**. No Gold, collision, physical timing, UI or real SaveService is proven. `T_egress + reaction < H_exposure` must be validated on continuous geometry; fixed-state graph reachability is not physical safety. Duplication/replay checks are JSON reference-model checks only.

### Additional review cautions
- `44` blocked-state combinations are enumerated combinations, not 44 known reachable gameplay failures; the missing proof is an **inductive invariant** that actual play, environmental changes, enemy bodies, saves and migrations cannot generate any trapped state.
- The public `sign_out` is a local proposed credential reissue, not the real source or cost of a rescue package.
- Death bag lost through persistence corruption or custody deletion is **data-loss failure**, not a legitimate balancing mechanic. An explicit authored destruction/abandon mechanic would require a separate mode-specific user-value gate.
- Revised redundancy guards prevent repeated debits in the design model; those guards have not been validated on A0/A3 runtime.
- S6 Whitewater remains **optional** and does not participate in A0 B0 or A1 Waystation/Relay canonical two-POI gate.

## Control Tower gate decision (qualified design policy D047)
**Choose the rebuildable, paid recovery path in NORMAL SOLO mode; reject mandatory permanent loss / free sample regrant.**

1. An existing bag holding the unique specimen persists with stable identity through save/load/death, and normal-mode play must offer an **achievable, physically reachable** recovery route even after the player's personal reserves reach zero. No free teleport, sample duplicate, auto-loot, instant restoration, fake paid resources, or resetting specimen_taken.
2. Starting with a valid empty bag and no stored supplies, player must be able to obtain **replacement low-tier preparation inputs from reachable, non-unique, renewably available safe-side overworld sources** under real costs/time, craft or acquire one genuine priming charge plus sufficient protection and necessary service credentials, then re-enter and retrieve the **same** bag and specimen. Independent A1 geography and A3 recipe/item-source authority must validate exact locations, legal IDs, and production feasibility. Never assert a source exists merely because the design names one. Boss/rare Core cannot be mandatory.
3. Distinguish recoverable expedition loss from permanent global progression: the POI remains optional and cannot become a mandatory gate. The core progression and persistent home must not be softlocked by optional death. The player still spends travel, preparation, consumables and risk.
4. No silent expiration or arbitrary deletion of this optional POI's unique-specimen bag in the current **normal-mode** design; broader D013 corpse timers/Hardcore remain OPEN and require own gameplay gate. If a bag is legitimately lost by future approved mode rules, it must not corrupt recipe/save/custody state or trap the main campaign. A missing saved bag is a BUG, not a design excuse.
5. `e18`/ `e23` must be independently usable *in native continuous geometry* where relevant: protect an adequate service corridor, prohibit persistent last-exit occlusion with commit-time guards, handle transient blocking and invalid old saves without overwriting player data. Do NOT infer physical survival from instantaneous graph edges, or delete a player's structure/teleport by stealth.
6. This is `APPROVED_BY_GATE_DESIGN_DIRECTION`, not `APPROVED_BY_USER`, not an actual economy/source contract, not a tested Whitewater POI, and not a global death-mode change. Until exact safe-side sources and rescue route are demonstrated, **S6_RECOVERY_DESIGN_BLOCKED** remains the truthful subgate.

### Exact next S6 action
Authorize a **narrow Unit3B policy-conformance revision**, not Unit4: extend the model with an explicit `regather_external_basics → craft_preparation → credential_reissue → vent → collection → recover same bag → egress` witness from ZERO reserve, plus deterministic resource generation bounded by safe-side source availability, transactions and no-free-value checks; test the double-exit obstruction invariant. If A1/A3 exact source is unavailable, keep `ECONOMY_SOURCE_NOT_PROVEN` and don't claim product readiness. S6 stays nonblocking and its owned files only. This needs a fresh same-session user-pasted prompt before S6 runs; no autonomous background dispatch.

### Coordinating implications
A0 PR21 stays draft and independent; do not force Whitewater into its current B0 journey. A1 may continue separately on real x369–384 canonical connector, A3/A6 remain paused unless a narrowly demonstrated owner dependency later requires action. AVFX is untouched. Sync Google Docs live ledger tab04 or mark `DOCS_SYNC_PENDING` until readback.
