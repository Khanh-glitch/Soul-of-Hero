# Kenney Input Prompts Pixel

- Asset: Input Prompts Pixel 1.0
- Creator/distributor: Kenney (https://www.kenney.nl/)
- Source: https://kenney.nl/assets/input-prompts-pixel
- Creation date in source archive: 2021-09-23
- Download/review date: 2026-07-15
- Archive: `kenney_input-prompts-pixel.zip`
- Archive SHA-256: `64478174064B77E9C0EBB8271FD38AF598CEC922650157CE1E564DF1272575CC`
- License: Creative Commons Zero 1.0 Universal (CC0)
- License URL: https://creativecommons.org/publicdomain/zero/1.0/

Kenney permits these assets in personal, educational and commercial projects.
Credit is appreciated but is not mandatory.

## Production selection

`tilemap_packed.png` is the original packed 816-glyph atlas. It is 544 x 384
pixels, arranged as 34 columns by 24 rows of 16 x 16 pixel cells with no
gutter. The preview, URL shortcuts, spaced atlas and 816 duplicate loose PNGs
were intentionally not imported.

For an `AtlasTexture`, use:

```text
region = Rect2(column * 16, row * 16, 16, 16)
tile_index = row * 34 + column
```

Useful verified cells for the current top-down default layout:

| Prompt | Column | Row | Tile index |
| --- | ---: | ---: | ---: |
| Escape | 17 | 0 | 17 |
| Q | 17 | 2 | 85 |
| W | 18 | 2 | 86 |
| E | 19 | 2 | 87 |
| A | 18 | 3 | 120 |
| S | 19 | 3 | 121 |
| D | 20 | 3 | 122 |
| J | 24 | 3 | 126 |
| K | 25 | 3 | 127 |
| Mouse left | 9 | 2 | 77 |
| Mouse right | 10 | 2 | 78 |
| Xbox A | 4 | 0 | 4 |
| Xbox B | 5 | 0 | 5 |
| Xbox X | 6 | 0 | 6 |
| Xbox Y | 7 | 0 | 7 |
| Xbox LB | 9 | 16 | 553 |
| Generic A | 13 | 0 | 13 |
| Generic B | 14 | 0 | 14 |
| Generic X | 15 | 0 | 15 |
| Generic Y | 16 | 0 | 16 |

The light Space prompt is the three-cell strip at row 6, columns 31-33 (indices
235-237). Other wide prompts such as Shift span multiple cells as well. Compose
those cells in a container instead of stretching one cell.
Runtime UI should resolve the active `InputMap` binding and device family; the
table is a production shortcut, not a replacement for rebinding support.
