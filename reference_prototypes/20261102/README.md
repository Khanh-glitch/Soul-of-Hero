# SOH — Creator's original gameplay prototype ZIPs (02 NOV 2026)

**Status: ORIGINAL BYTE-FOR-BYTE SOURCE ARCHIVES / REFERENCE ONLY — NOT GAMEPLAY AUTHORITY OR PRODUCTION ASSET.**

Uploaded directly from creator-provided ZIPs to a **separate reference branch**, not A0/A1/A3/A6/A8/LW1 code branches. Original ZIP SHA-256 and Git blob SHA were independently checked against the user's local files and then read back from GitHub; the exact ZIP bytes are present in this Git tree.

| Original filename | Bytes | SHA-256 original archive | Git blob SHA | Intended use |
|---|---:|---|---|---|
| `soul-of-hero-rpg-development.zip` | 657426 | `2b86f65620f0a3cc003525a69d8d6e65728a1f61f52c1e70dd1ec956b3efdb75` | `542a2efc9daec14d550eee0b1edd887c728f1a15` | explicit `trackingTraceId`, `nextTraceId`, return-on-loss C08 |
| `soul-of-hero-prototype.zip` | 802437 | `01348a02076fda189048e5dccdf155df8b603524c0d0b8cb7e28fc907e0a05b7` | `9580f666af0a70557f7abc9e034541009baf6863` | falsifying “newer-nearby is successor” and state/receipt invariants |
| `soul-of-hero-rpg-prototype (3).zip` | 723234 | `12438a536de6d068abda4e639710dec4d8c9409435f11d12d74540cdd3bfdf55` | `f377af9611086b0e196b2e9d0e2e9aed60243ace` | cross-run escrow, physical item custody, randomized transfer-property QA |
| `develop-soul-of-hero-rpg (4).zip` | 466053 | `f601ca176b6efd2d3b2d2abfe4ce375b423706663f708f71dc348514878f01ba` | `d79450e402f37f58f7d73abb5f3ccd6f5ba7ba9b` | action dispatcher, negative oracle: faraway harvest / remotely injected footprint; procedural pixel reference only |
| `soul-of-hero-game-development.zip` | 727262 | `fa95538271fd46a70f5737b58b8671124e091e8f6196479950a25dca741a2403` | `5a667c979a597d5d26e80453f7f16756db98f150` | coreless exploration, source→home→offline production→physical research, environment/cart tradeoffs; source audit in `SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md` |

## To fetch in a NEW Arena session

```bash
git fetch origin references/gameplay-prototypes-20261102
git ls-tree -r --long origin/references/gameplay-prototypes-20261102 reference_prototypes/20261102/
mkdir -p /tmp/soh-gameplay-source
for path in \
  "reference_prototypes/20261102/soul-of-hero-rpg-development.zip" \
  "reference_prototypes/20261102/soul-of-hero-prototype.zip" \
  "reference_prototypes/20261102/soul-of-hero-rpg-prototype (3).zip" \
  "reference_prototypes/20261102/develop-soul-of-hero-rpg (4).zip" \
  "reference_prototypes/20261102/soul-of-hero-game-development.zip"; do
    git show "origin/references/gameplay-prototypes-20261102:$path" > "/tmp/soh-gameplay-source/${path##*/}"
done
cd /tmp/soh-gameplay-source
sha256sum *.zip
unzip -t "soul-of-hero-rpg-development.zip"
```

**New donor (5th ZIP):** `soul-of-hero-game-development.zip` adds specific source-backed causal gameplay loops; see [SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md](SOH_GAME_DEVELOPMENT_GAMEPLAY_DEPTH_REUSE.md). It is NOT a replacement Godot engine. The older 829-line Bible inside its ZIP is NOT canon.

**Important**: `git show` requires correct source branch and source path; a new Arena agent must prove retrieval by byte hashes, not just assume these links work. Do not cherry-pick reference archives into the shipping code branch or modify them. If a ZIP contains licensed third-party art, it is never a warrant to import that art into SOH production. These are non-runnable research references until separately built and tested.

## Surgical source order (for gameplay owner)

1. `soul-of-hero-rpg-development.zip → src/engine/simulation.ts:811–850`: AI sees lawful local footprint, stores ID, follows explicit `nextTraceId`, loses track and returns. The phôi itself still requires collision/real-input validation.
2. `soul-of-hero-prototype.zip → src/sim/simulationTick.ts:640–664`: **negative anti-pattern**: `prevId===cur.id OR newer nearby` permits an unrelated chain jump. Turn into a failing test, do not port.
3. `develop-soul-of-hero-rpg (4).zip → src/game/state.ts:1033–1076,1237–1242`: harvest branch lacks player-to-source proximity, trail dispatcher accepts arbitrary `x,y`. Replicate malicious requests against existing SOH A0/A3/C08 source authority.
4. `soul-of-hero-rpg-prototype (3).zip → src/tests/contracts_c01_c24.test.ts:591–774,819–905`: non-Elder Ragnarok escrow/evacuation/new-run and randomized unique item conservation; transplant **test hypotheses only** when allowed and where SOH native coverage is missing.
5. Source UX from other ZIPs is **not** included in this branch; these are outside current gameplay-owner scope. Do not reference them as retrievable from this branch.

## Authority and review
- Gameplay canon: `docs/survival/CURRENT_PRODUCT_CONTRACT.md` **830-line** copy at `a8c718b55130cff29b3adc5e7c531f9211ca22df` (D061 / K2 / K5 / K6 / K8 / C08/C09/C10).
- Baseline code A0×A3: Draft PR #31 `fe9a9287bee31b4f94aa42adc8e9c13aa9c869a1`; its **77-line** contract is stale.
- Active/paused C08 owner: Draft PR #34 (refresh exact head). READ `docs/survival/tasks/GAMEPLAY_AGENT_RECOVERY_NEXT_ORDER_20261102.md` on this reference branch for the actionable recovery sequence.
- **No promotion** from prototype code to canon; no new item/skill/currency/raid/power/map outside Bible; no direct production commits or merge.