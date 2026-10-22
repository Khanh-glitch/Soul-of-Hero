# Project and asset governance

## Runtime ownership

- `game/characters/` owns controllable bodies and enemy bodies only.
- `game/heroes/` owns hero-specific combat runtimes, hero data and Soul loops.
- `game/weapons/` owns reusable hand/spirit weapon profiles and travelling effects.
- `game/combat/` is the shared damage and targeting authority; no hero computes a
  second damage formula.
- `game/loot/` owns item payloads, physical ground loot and bag admission.
- `game/vfx/` owns reusable sprite-sheet playback and pooling. Hero code supplies
  only an asset-backed effect, position and gameplay-matched scale.
- `game/ui/` owns presentation and requests; `SaveService` remains the only
  authority for persistent inventory changes.

Chapter content stays data-first under `data/levels/` and `data/content/`.
Chapter-specific scripts go under `game/levels/`; they must not be copied into
hero or generic world folders.

## Asset policy

`assets/library/downloaded/` is a local source library and is ignored by Git by
default. The small, explicitly whitelisted production subsets referenced at
runtime are versioned, so a clone runs in Godot without carrying the entire
exploratory library. Production references must point to a selected file under
`assets/` or to one of those explicitly licensed runtime subsets.
The same bitmap can have at most two intentional paths when each path carries a
different gameplay-semantic name (for example a generic sparkle and a Soul
anchor). Three-or-more copies are treated as an audit failure candidate.

Do not delete a duplicate solely by filename: first verify its hash, then search
for its path in `game/`, `data/`, `tests/` and scenes. The audit script below is
read-only and lists both hash duplicates and references so cleanup is safe.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/audit_asset_duplicates.ps1
```

## Performance invariant

VFX optimization may reuse decoded frames, nodes and materials, but it may not
cap, skip, lower-resolution, simplify or throttle a requested visual effect.
The pool expands to peak concurrent demand; inactive entries are reused only
after their complete authored animation finishes.
