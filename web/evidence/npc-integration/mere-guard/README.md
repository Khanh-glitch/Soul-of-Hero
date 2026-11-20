# Mere Pier — leave the watch, intercept, return

**[Geographic New Game, seed 7542](new-game-7542.json).** An ordinary visitor walks 36 tiles to the shore side of the pier using directional keys, then stands still. The player does not attack, issue guard commands or manipulate the simulation. The nearby Reagent Ooze is a roaming creature generated with the world, not spawned by this test. Its normal perception of the visitor triggers the encounter. This demonstrates an autonomous response to a player-attracted threat, not an unprovoked raid on an empty settlement.

| Time since start | Observation |
| --- | --- |
| +18.223 s | Guard `h1h` completes the first watch beside the warehouse `e1ga` at `(2476,731,0)`. |
| +21.001 s | From the post, the guard sees ooze `vy:roam:49:14`. A passive grouse nearby is not a threat. |
| +22.150 s | First contact at `(2474,733,0)`: ooze 46 → 34 HP, club `s1gl` 100 → 99 durability. JSON save and validated Continue here retain the same alert, post, creature and damage. |
| +22.900 to +24.400 s | Three more contacts. Each costs one durability on that club; the fourth is lethal. The guard is now at `(2476,736,0)`, five tiles from the original watch position. |
| +24.401 to +33.513 s | The recall keeps the same response ID. The guard walks back to `(2476,731,0)` and finishes a new eight-second watch on the same warehouse. No patrol credit is given merely for dropping the target. |

**[Controlled comparison, Gulf market](staged-wolf-7606.json).** Seed 7606 independently produces a guard on duty. This fixture then places a full-health wolf in `chase` and services human movement/combat; it does not simulate an organic wolf approach. Additional cases check sight, active floor, tamed animals, loss of hostility during windup, changed post ownership and invalid saved response data. The response does not grant items, create enemies or replace companion guard orders.

Run the two evidence suites from `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-guard,npc-guard-response}.test.ts
```

Verification: 50/50 tests in eight suites (the two above plus occupation coverage, companion missions, corrective NPC cases, hunting custody, medical response and the natural builder). Test TypeScript and production build passed; Vite reported its chunk-size warning.
