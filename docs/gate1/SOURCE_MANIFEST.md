# Gate 1 — original architecture/lighting art provenance

Candidate B source ref: `e7cad36f8f21e746abefe44ac6cfa54db9a378e6`. Only four previously unused source files are copied into `prototypes/gate1/art/`; existing `prototypes/gate0/art/archive_props.png` and `props.json` remain the authoritative copies of furniture. The copied bytes are the SAME git blobs (no recompression, scaling, filter or recolor).

| Gate 1 destination | B source | pinned git blob |
|---|---|---|
| `prototypes/gate1/art/archive_tiles.png` | `prototypes/environment_art/archive_audition/art/archive_tiles.png` | `dc1fc8fdd95d6d99c20b1f8e16e3bcbe2cf9fe37` |
| `prototypes/gate1/art/tiles.json` | `prototypes/environment_art/archive_audition/art/tiles.json` | `6182ccf44ecd12fae255219bc09bc070a72d3b18` |
| `prototypes/gate1/art/wall_caps.png` | `prototypes/environment_art/archive_audition/art/wall_caps.png` | `d3c2066c489b77666504ad94875d09585a0ad0fd` |
| `prototypes/gate1/art/light_radial.png` | `prototypes/environment_art/archive_audition/art/light_radial.png` | `14f5a09b4cb0c29723a84242d8091963faeb5d9c` |

Every file was original work within B's audition, not a third-party spritesheet. **No license inference beyond the existing project's provenance claim is made.** These files are dedicated to a prototype; they are NOT automatically part of the campaign TileSet.

To audit, compare the exact blob SHA of each destination against this manifest. Do not replace these assets under the same name without explicit review.