# PIXELFX FOUNDRY — Bootstrap from an automatically assigned Agent branch
**This is a READ-ONLY reference branch, NOT the Agent working branch. Do not ask the user to choose a branch.**
Reference: `feature/pixelfx-foundry-244-intake-20261102` @ current verified handoff revision.
The Agent must keep its platform-assigned branch and own its commits and push there. Never merge/cherry-pick this reference branch blindly (it was born from a historical SOH gameplay branch).

## Where every input comes from
| Input | Definitive location | Is it already on this reference branch? |
|---|---|---|
| 244 upstream FX implementations and original PixelFX renderer | https://github.com/patch-gg/pixelfx, `src/fx/**`, `src/core/**`, `tools/lib/fxlib.mjs` | NO — retrieve from upstream and pin the actual 40-character commit SHA |
| PixelFX catalog, methods, license, notices | upstream `docs/CATALOG.md`, `docs/AUTHORING.md`, `README.md`, `LICENSE`, `NOTICE.md` | NO — use upstream originals |
| SOH game repository (Godot production) | https://github.com/Khanh-glitch/Soul-of-Hero | Agent's own repo/branch |
| SOH current product rules | `docs/survival/CURRENT_PRODUCT_CONTRACT.md` on its current authoritative owner branch | Available on this historical reference branch; verify if a newer authoritative edition exists |
| Universal intake contract | `docs/pixelfx_foundry/IMPLEMENTATION_CONTRACT.md` | YES |
| One-shot agent contract | `docs/pixelfx_foundry/AGENT_BATCH_PROMPT.md` | YES |
| Starter source-native exporter, not an accepted production exporter | `tools/pixelfx_foundry/intake.mjs` | YES |
| Foundry v5 historical visual/performance lessons | `docs/pixelfx_foundry/V5_REFERENCE_AND_GAPS.md` | YES — **reference description, not complete source archive** |
| Foundry v5 HTML/QA/source ZIP | Previous ChatGPT conversation artifacts only | NO — not auto-accessible to independent Agent; do not pretend otherwise |
| 244 atlas PNGs | Not pre-generated or pinned | NO — the Agent's batch job must create them |

## Access from any auto-created branch
If git remote fetching is allowed:
```bash
git branch --show-current
git rev-parse HEAD
git fetch origin feature/pixelfx-foundry-244-intake-20261102
REF=origin/feature/pixelfx-foundry-244-intake-20261102
git show "$REF:docs/pixelfx_foundry/IMPLEMENTATION_CONTRACT.md"
git show "$REF:docs/pixelfx_foundry/AGENT_BATCH_PROMPT.md"
git show "$REF:docs/pixelfx_foundry/V5_REFERENCE_AND_GAPS.md"
git show "$REF:tools/pixelfx_foundry/intake.mjs" > /tmp/pixelfx-intake-reference.mjs
```
The above reads other-branch files without checking out, merging or changing the assigned branch.

If the execution environment cannot fetch this reference ref: use the canonical GitHub Contents API on the same repository and explicit ref (authorized tools/connectors if available), or use the full one-shot prompt already supplied in the Agent message. Treat reference-files-unavailable as a named limitation, not a reason to fabricate content.

To obtain the actual FX source, a separate clean checkout is mandatory:
```bash
git clone https://github.com/patch-gg/pixelfx.git /tmp/pixelfx-upstream
git -C /tmp/pixelfx-upstream rev-parse HEAD
git -C /tmp/pixelfx-upstream status --porcelain
node --version
```
Pin the returned upstream SHA before exporting. Do not use the moving GitHub website gallery or historical cached counts as the exact export oracle. Use upstream `allIds()` and metadata.

## Minimal first reproducible gate
1. Copy the reference `intake.mjs` into a working path inside the Agent's assigned branch (or implement a verified replacement).
2. Run discovery on an official clean upstream checkout. Must output **244 unique IDs across 21 categories** for the verified source revision; if not, stop and report source drift.
3. Run only representative exports first: `--export --ids ice/ice-lance,fire/meteor,moves/ice-lance-throw,status/frozen,weather/fireflies,ui/achievement,transitions/crt-off`.
4. Independently decode combined PNG frames and compare against official `renderFrames().frames[].clear` (the included baseline script currently checks source buffer recomposition, not this independent PNG-decoding verification).
5. Check actor, act, back/front and transparent-light semantics. **Do not call this PASS solely because metadata and files exist.**
6. Then scale to full library, registry browser, animation visual QA, day/night and stress tests per contract.

## Protected boundaries
Never change A0/A3/A6/AVFX, `soh_binding/**`, production scenes, or the SOH Bible as part of intake. No merge. Original PixelFX source license + notices must accompany distributed assets. No excluded font distribution.

## Status today
This Git branch stores references and starting tooling, not the 244 effect assets or full v5 source tree. Agent access to both repos from its own compute environment is **NOT YET TESTED**. A GitHub-readable file does not prove that an independent Arena sandbox can clone, execute Node, download binaries, or render visuals. Verify each as R0 and report exact blockers.
