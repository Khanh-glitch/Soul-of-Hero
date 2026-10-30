# V7 verification evidence

Engine: Godot `4.7.stable.custom_build`, pinned source `5b4e0cb0` (MIT), local native test build.
Scope: **OWNER_CONTRACT_CANDIDATE / NATIVE_FIXTURE_PASS / WORLD_NOT_INTEGRATED / NOT_HUMAN_PLAYTESTED**.

| Suite | Result |
|---|---:|
| V7 meta-economy owner-contract candidate | **43 checks / 12 cases PASS** |
| V7 meta two-OS-process deposit/purchase/reset | **9 + 16 checks PASS** |
| V5 adapter regression | **556 checks / 26 cases PASS** |
| V6 prepared offline operations | **220 checks / 18 cases PASS** |
| V6 offline two-OS-process restart | **12 + 19 checks PASS** |
| V5 world two-OS-process restart | **7 + 14 checks PASS** |
| V5 tool-use callable | **20 checks PASS** |
| Python adversarial/contract/model tests | **65 tests OK** |
| Catalog validator | **PASS** (57 items / 36 recipes / 5 techs / 40 sources / 7 stations / 5 bindings / 3 actions; meta 7 currency sources / 6 stones / 3 deposit endpoints / 3 vending machines / 2 recyclers) |
| V7 deterministic 336h meta-balance model | **PASS**, no universally dominant strategy |

Native save-growth micro-measure at this tree: `bytes_before=4920 bytes_after=13311 delta=8391 transactions=30`.

The meta restart phase-two case intentionally obstructs the SaveService temporary write. The full negative log is preserved; CI gates filter only the exact expected line `ERROR: SaveService: Could not write the temporary save file.` by name. Engine shutdown ObjectDB/resource accounting is reported as a warning by the existing gate convention.

The profile/run/endpoint/source producers in the V7 native tests are explicitly labeled **OWNER-CONTRACT CANDIDATE — NOT PRODUCTION A0**. Production A3 fails closed with `A0_PROFILE_BOUNDARY_ABSENT` until A0 implements the real profile port and RunLifecycle reset boundary. Exact pushed SHA and hosted CI status are recorded in PR #19. No A0 SaveService, A6 scene, A8 POI logic, A1 geography, or AVFX Gold was edited.
