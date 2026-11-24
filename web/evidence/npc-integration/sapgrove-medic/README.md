# Sap Grove — treating a worker seen at a real harvest accident

**Geographic New Game, seed 7606.** `npc-natural-medic.test.ts` advances the full simulation and validates one JSON save. No injury, medicine, job, route or actor position is injected. [Observed receipts](natural-7606.json) (times below are relative to run start):

| Sim time | What happened |
| --- | --- |
| +703.501 s | `h4w` is downed while harvesting the oak at (1896,1264). The body is on the adjoining tile (1897,1264), floor 0. |
| +703.687 s | Sap Grove medic `h50` sees `h4w` and starts a one-step approach. |
| +704.000 s | Save/load during work order `hw3g1`. Patient still downed; both bandages still in `s288` in pack `c285`. |
| +709.915 s | Same order charges one bandage. `h4w` goes from 1 to 31 HP with the wound treated; one bandage remains. |

Responders use same-floor sight out to eight tiles; the saved destination is the last observed position, not a live feed of a moving patient's location. Physical contact and an untreated patient are checked before the dose is spent. A route failure or a hostile hit does not consume it. This implements direct discovery, not a village-wide radio or relay system.

**Separate, controlled combat case:** the Greywater fixture positions a wounded resident and an attacking wolf. Actual combat contact causes bleeding and `DOWNED`. No medical order or treatment is injected: medic `h8` reaches `h9`, resumes after save/load, spends one bandage `s17x`, stops bleeding and restores 30 HP. [Payment receipt](controlled-wolf.json). This is **not** a naturally encountered wolf attack; the organic evidence above is a work accident.

From `web/`:

```sh
npm test -- --maxWorkers=1 tests/{npc-natural-medic,npc-medic-response,npc-paid-work,npc-physical-authority,npc-projectile-flight,npc-mechanic-fetch}.test.ts
```

Verification: all 37 tests in the six suites above passed. `npm run typecheck:tests` and `npm run build` passed (Vite chunk-size warning).
