# Building the sound files

The files in `web/public/sfx/` are cut from library recordings by the tools in this folder.
The recordings themselves are not in the repository.

## What is where

| Path | Content |
|---|---|
| `recipe.txt` | One line per sound file: `slot | start of the source file name | options`. The source of truth for every pick. |
| `make.py` | Reads the recipe, cuts, shapes, levels and encodes each file to Ogg Vorbis. Options are listed at the top of the file. |
| `place.py` | Replaces the `.ogg` files in `web/public/sfx/` with the built ones; writes `index.json` (level trim per file) and `sources.json` (source of each file). |
| `credits.py` | Writes `docs/sfx/NGUON_AM_THANH.md`: file, recording, library, maker. |
| `probe.py`, `tl.py` | Measure a recording: length, level, spectral centre, events, loudness over time. |
| `sfxlib.py` | Shared helpers. |

## Working folder

The tools read and write a folder outside the repository, named by `SFX_WORK` (default `~/sfxwork`):

| Path | Content |
|---|---|
| `src/` | The library recordings (WAV) the recipe names. |
| `lists/Part*.tsv` | The file lists shipped with the bundles (file name, library, maker). Used by `credits.py`. |
| `slots.json` | Slot facts, written by `node scripts/sfx.mjs dump`. |
| `out/` | Built files and `manifest.json`. |

## Steps

Run from `web/`:

```
python3 -m venv ~/sfxwork/env
~/sfxwork/env/bin/pip install numpy scipy soundfile imageio-ffmpeg
node scripts/sfx.mjs dump > ~/sfxwork/slots.json
~/sfxwork/env/bin/python scripts/sfx-build/make.py scripts/sfx-build/recipe.txt ~/sfxwork/out
~/sfxwork/env/bin/python scripts/sfx-build/place.py
~/sfxwork/env/bin/python scripts/sfx-build/credits.py
node scripts/sfx.mjs index
npx vitest run tests/sfx-bank.test.ts tests/sfx-slots.test.ts
```

`make.py … --only <slot prefix>` builds part of the recipe; `--dry` measures without writing.

## Rules the recipe follows

- A source is named by the start of its file name and must match exactly one file. `**` stands for any text.
- `#` starts a comment only at the start of a line (some file names contain `#`).
- A WAV that the reader rejects (bad `PEAK` chunk) is re-wrapped once with ffmpeg as `pcm_s24le`.
- The picks were made from file names and measurements. Nobody listened to them at the time; see `docs/sfx/KE_HOACH_SFX.md`, section 10.
