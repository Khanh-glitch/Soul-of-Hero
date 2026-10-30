# Pinned Candidate A Level 3 fixture

`chapter_1_level_3_a.json` is a **verbatim copy** of Candidate A's Chapter 1
Level 3 (`Thư Khố Giao Hỏa`) at design-pilot commit
`f27e8b7fe03f33b2001b08579543e5010a0a1b9d`.

| | |
|---|---|
| source | `f27e8b7:data/levels/chapter_1_level_3.json` |
| blob | `8687766b3a92367391804c48c20e5dc489b8b381` |
| sha256 | `5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54` |
| size | 116×96 cells, 3351 Backdrop / 1702 Geometry / 73 Decor, 79 entities |

## Why a copy exists

Gate 0 authors its overlay against exactly this document, and
`tools/gate0/author_overlay.py` refuses to run unless the file it is given hashes
to the value above. The capture harness applies the same assertion at runtime.

Keeping the fixture in the repository means the pin travels with the branch:
CI can materialise Candidate A's geometry and verify it without depending on
another branch still existing, and a reviewer can reproduce the exact input.

`data/**` is frozen by the execution contract, so Gate 0 never writes this file
into `data/`. The CI workflow copies it over `data/levels/chapter_1_level_3.json`
inside the ephemeral runner only, so the game boots the canonical path with
Candidate A's geometry; on a branch where that path already holds the pinned
document the step is a verified no-op.

Regenerate the pin after any intentional change to the reference:

```bash
sha256sum prototypes/gate0/level_data/chapter_1_level_3_a.json
# and update PINNED_LEVEL_SHA256 in tools/gate0/author_overlay.py
```
