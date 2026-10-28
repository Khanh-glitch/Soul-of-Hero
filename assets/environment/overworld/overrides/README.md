# Hand-painted overrides

Drop a PNG named after an atlas frame into `tiles/` or `props/` and it replaces
that frame, at that frame's own size, the next time the atlas is built:

```
assets/environment/overworld/overrides/tiles/floor2.png     # 16x16
assets/environment/overworld/overrides/props/lm_beacon.png  # 48x80, say
```

`python3 tools/overworld/art.py` writes the generated sheet, then
`tools/overworld/overrides.py` pastes every override on top and records what it
did in `data/overworld/art_manifest.json`. Deleting the override restores the
generated frame on the next run, so manual work is never destructive and never
has to be re-applied by hand.

An override whose frame name does not exist, or whose size does not match the
frame, is reported and skipped — a typo must not blank part of the atlas.

The frame names and sizes are in `data/overworld/overworld_tiles.json` and
`data/overworld/overworld_props.json`.
