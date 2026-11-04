# WMP-03 commit / push / PR reference

| Item | Value |
| --- | --- |
| Branch (only branch written) | `arena/2e3cfbd2-soul-of-hero` |
| Parent (WMP-02 final) | `c600f0410b2d47607f44b2882336dddd877dbbe9` |
| `main` | `5214788933b1a827f3a177d11ff486433dfe5e8a` — untouched |
| Exact WMP-03 commit SHAs | `git log --oneline c600f041..HEAD` on the Map branch; also recorded verbatim in the single PR44 WMP-03 exact-SHA handoff comment |
| Push | `git push origin arena/2e3cfbd2-soul-of-hero` |
| PR44 | OPEN / DRAFT, head `d73aa63f9f7f98aa1f6c6a42211693c7710cf3c4`, base `arena/4795760e-soul-of-hero` — **NOT merged, NOT closed, NOT retargeted** |
| WMP-03 PR44 handoff comment | **one** exact-SHA comment posted after the push; see PR44 comment list for its ID |
| WMP-02 historical comment (do not duplicate) | `6625676255` |

`v3/manifest.v3.json` SHA-256:
`9043386cb9ba9a470a9d2764a5b9a7ec20fc3ecb433b23aaace212d8330f8004`
`revisionDigest`:
`1356735557a421f720e24c6e9dd54ae0812e5f75cc18a48c14ddfc69de9bd114`

Only these paths are added by WMP-03:

- `veyra-world-master/v3/**`
- `veyra-world-master/reproduce_v3.sh`
- `veyra-world-master/clean-room_v3.sh`

No WMP-01 or WMP-02 tracked file is modified. `*.log` runtime transcripts are ignored.
