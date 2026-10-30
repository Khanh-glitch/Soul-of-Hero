# V6 verification evidence

Engine: Godot `4.7.stable.custom_build`, pinned source `5b4e0cb0` (MIT), local native test build.
Scope: **NATIVE_FIXTURE_PASS / WORLD_NOT_INTEGRATED / NOT_HUMAN_PLAYTESTED**.

| Suite | Result |
|---|---:|
| V5 adapter regression | **556 checks / 26 cases PASS** |
| V6 prepared offline operations | **220 checks / 18 cases PASS** |
| V6 offline two-OS-process restart | **12 + 19 checks PASS** |
| V5 world two-OS-process restart | **7 + 14 checks PASS** |
| V5 tool-use callable | **20 checks PASS** |
| Python adversarial/contract/model tests | **53 tests OK** |
| Catalog validator | **PASS** (56 items / 36 recipes / 5 techs / 40 sources / 7 stations / 5 bindings / 3 actions; offline allowlist 2 craft + 1 research + 2 tech) |

Native save-growth micro-measure at this tree: `bytes_before=4789 bytes_after=13180 delta=8391 transactions=30`.

The offline crash/replay case intentionally obstructs the SaveService temporary write. The full negative log is preserved; CI gates filter only the exact expected line `ERROR: SaveService: Could not write the temporary save file.` by name. Engine shutdown ObjectDB/resource accounting is reported as a warning by the existing gate convention.

Exact pushed SHA and hosted CI status are recorded in PR #19. Hosted CI is not claimed here until observed. No A0 production mount, human playtest, A4 Gold parity, or visual capture is claimed.
