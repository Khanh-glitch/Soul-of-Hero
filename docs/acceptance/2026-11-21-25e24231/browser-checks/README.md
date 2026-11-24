# Browser checks on the production build (`d00d7791`; `o1` on `ff678df9`; `p1` on `224d5d7a`)

Results are written up in the last section of `../TIEN_DO_SUA_LOI.md`.

All scripts drive headless Chromium (Playwright + `@sparticuz/chromium`, 640×360) against `web/dist` served on port 4174.
`kit.mjs` replaces the page clock: nothing moves unless the script steps frames, and the script can set the date.
Paths inside the scripts point at the workbench `/home/user/acc` (saves, output folders); change them before reuse.

**None of these is free play.** Each script stages part of the scene; what was staged is listed per script.

| Script | Staged by the script | Done through the game's own controls | Output |
|---|---|---|---|
| `j1-softlock.mjs` | club durability set to 1; wood removed from the bag | new run, walking, every swing, the Craft panel | `out-j1.txt` |
| `m1-retired-wall.mjs` | a Wood Wall stack put in the bag; the saved text edited to `wall_plank` (hp 240), checksum recomputed | placing the wall, saving, reload, "Continue" | `out-m1.txt` |
| `k1-evac-watch.mjs` | hour-288 save of campaign run 13 put in storage; date set 7 h later | "Continue", the catch-up, the Return Chronicle | `out-k1.txt` |
| `k2-evac-player.mjs` | same save; the player's position rewritten to carry them to the west berth (the game slides its own window 22 times); date moved twice | "Continue", "Rise", E on the beacon, "Request a Seat", "Board the Vessel", the two returns | `out-k2.txt` |
| `l1-fight.mjs` | the player placed about 4 tiles from the nearest hostile creature | walking, swinging, the creature's attacks | `out-l1.txt` |
| `n1-elder-sea.mjs` | hour-312 save of run 13; date set 6.5 h or 14.5 h later; player carried next to an Elder | "Continue", "Enter the Island", "Rise"; the Elder's behaviour | `out-n1-*.txt` |
| `o1-starter-axe.mjs` (on `ff678df9`, rerun on `224d5d7a`) | the death: health, hunger and thirst set to almost zero so the game's own tick kills the player | new run, walking, swinging the Stone Axe, "Rise" | `out-o1.txt`, `out-o1-224d5d7a.txt` |
| `p1-rulings.mjs` (on `224d5d7a`) | nothing | new run, the handbook (all 11 chapters), a blind walk swinging the Stone Axe at whatever blocks the way, Esc menu, "Stuck? Give up…", "No", "Give up & wake" | `out-p1.txt` |

`shots/` holds fifteen of the screenshots. The campaign saves themselves (2–4 MB each) are not in the repository.

Script faults met on the way (not game faults): a staged stack needs a base-36 uid from `run.nextId`, otherwise every later
save is refused; after a reload with a large save, "Continue" appears only after "Raising the island…" ends; creature types
differ per new run, so `l1` takes the first type present from a preference list.

`p1` was run four times. Runs 1 and 2 had a script fault: closing the handbook with repeated Esc left the menu open, so
the walk never started (run 1 ran into the script's time limit, run 2 reported no harvest). Run 3, with that fixed, hit
the time limit while the 336-hour campaign was using the machine. Run 4 (alone on the machine, 97 s) is the saved result.
The walk is blind, so what it meets differs per run: run 4 met an oak and a rock, no ore vein.
