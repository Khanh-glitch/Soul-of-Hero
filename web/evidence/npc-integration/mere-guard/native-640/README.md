# Mere Pier at native 640×360

Two Chromium playthroughs of the production build, before and after the field cue, had identical sampled positions, creature HP, club durability and return times. [Browser observations](observations.json). This is a repeatable visual review, not a blind usability study.

| UI capture | What is visible |
| --- | --- |
| [Before: first contact](before.png) | A damage number appears among several overlapping sprites. Neither the guard's reason for leaving nor the target is named. |
| [On duty](01-watch.png) | A turquoise pennant marks the actual store; the nearby guard is labelled **Store watch**. |
| [First contact](02-intercept.png) | An amber **Guard: Reagent Ooze!** above the guard and an amber mark beside the ooze distinguish the two from the bystanders. |
| [Breaking contact](03-return.png) | **Back to store** appears on the returning guard; the pennant stays on the original post. |
| [On duty again](04-on-post.png) | The same guard is beside the same post at `(2476,731,0)`; the watch label has replaced the return label. |

The driver clicks New run and selects the ordinary random landing. A controlled browser clock selects seed 7542 and advances animation frames reproducibly. A route derived from a read-only copy of the start save drives ordinary WASD key presses. The script observes the React Game props to time screenshots; it never inserts a game save, writes actor state, invokes combat, or attacks with the player. At +22.150 s it clicks **Save & quit to title**, reloads the document, and clicks **Continue**. The response ID and ooze HP (34) match immediately after Continue. At +34.850 s the guard has completed the next watch. This establishes legibility of this particular encounter, not discoverability of the pier on an unaided random walk.

From `web/`, serve the current production `dist/` and run:

```sh
node scripts/npc-mere-playtest.mjs http://127.0.0.1:4180 /tmp/mere-review
```

Set `CHROME_BIN` if using an external Chromium executable.
