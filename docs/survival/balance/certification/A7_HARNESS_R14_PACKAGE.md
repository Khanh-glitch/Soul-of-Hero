# A7 certification harness — R14 package (frozen, `PAUSE_DEPENDENCY`)

One page an operator can follow without reading the harness. Nothing here judges an owner's code by
its text alone, and nothing here can grant acceptance.

## What it is

| piece | path |
|---|---|
| harness | `tools/survival/balance/a7_certify.py` (schema `soh.a7.certification.v2`, 32 cases, 4 tracks) |
| native probe | `tests/survival/a7_certification_probe.gd` (A7-owned, Godot 4.7, emits `A7C <case> {json}`) |
| workflow | `.github/workflows/a7-certification.yml` |
| manifest | `docs/survival/balance/certification/manifest.r14.json` |
| evidence | `docs/survival/balance/certification/r14_ci/` |
| report | `docs/survival/balance/certification/A7_CERTIFICATION_R14.md` |
| machine report | `data/survival/balance/certification/a7_certification.r14.v2.json` |

## How a run works

1. Pin five owner SHAs and one declared tree.
2. `git worktree add` at A0, compose with `tools/a0/compose_owners.py`, then `git write-tree`.
   A declared tree that does not reproduce is `STALE_COMPOSITION` and the run is void.
3. `godot --headless --path . --import` **then** probe a copy that differs by exactly one A7 file.
   The certified tree itself is graded pristine.
4. Run the same probe on a **reconciled control**: byte-identical to the composition except one
   owner file restored. The control answers *where the defect lives*; it is never graded as the
   product.
5. Capture each tree's engine errors into `composed.native.txt` / `control.native.txt`.
6. `a7_certify.py --certify` grades 32 cases and writes `report.json` + `report.md`.

Local:

```bash
python3 tools/survival/balance/a7_certify.py --self-test          # must print A7_CERT_SELFTEST N/N
python3 tools/survival/balance/a7_certify.py --certify \
    --composition <tree> --evidence <dir> --manifest manifest.json \
    --out report.json --markdown report.md
```

## Verdict vocabulary

| verdict | means |
|---|---|
| `PASS` | the case reached its required stage on this tree |
| `FAIL` | a named, reproduced defect, with an owner and a `file:line` |
| `BLOCKED` | the evidence does not exist yet; **never** a pass, never an invented failure |
| `NOT_IMPLEMENTED` | the feature is absent, so its gate cannot run |

Maturity: `TEST_HARNESS_VALID` → `OWNER_SOURCE_VALID` → `PRODUCT_COMPOSED` → `HUMAN_ACCEPTED`.
Only the first is granted by this program, and only the last is a human decision.

Rules that exist because each was violated once:

* **Text is not a program.** `load()` + `can_instantiate()` + `new()` decide; source scanning cannot.
* **Engine errors block promotion.** Any `SCRIPT ERROR` / `Parse Error` / `Compile Error` in a tree's
  log is evidence against that tree, whatever the markers say.
* **Unknown is `BLOCKED`.** An unresolved live world yields `null`, never a qualified guess.
* **A composition artifact is not owner gameplay.** `COMPOSITION_DROPS_OWNER_WORK` names the
  metadata; `AUTHORITY_SCRIPT_DOES_NOT_RUN` names the source. Both can be true at once.
* **A control marker can never overwrite a product marker**, and no fixture, teleport or invented
  receipt ever counts as player capability.

## Frozen state

`PAUSE_DEPENDENCY`: no full certification runs until the trigger in §7 of the report is met
(new exact composed SHA with A3/A6's new heads, an authority that actually instantiates, a clean
native log, and native input journeys). Harness-only and docs-only commits do not re-run journeys.
