# MEC-01 R12 — J10 departure readiness (agent-reported; no PR checks yet)

Chain: Bible J10 (approved) → existing thermal law `thermal.ts` / `settle()` + station custody + territory plan
→ missing read affordance (no single pre-departure view; only HUD card + offline-survival line)
→ `web/src/game/departure.ts` `departureReadiness(r, now)` + `forecastThermal` (read-only), `thermal.ts` target law
  factored into `coldPartsFor` / `insulationOf` / `targetFromParts` (same numbers, one formula)
→ Esc/Menu (`panels.tsx` `MenuPanel`) three-row layout: NOW · FUEL LIMIT · CONDITIONAL OUTLOOK · HOME · CHOICES · UNKNOWN.

Decision the player gets: how long paid heat lasts, when the cold threshold is reachable under dry/wet and roof-kept/lost
scenarios, what is not heating and why, which real actions the state grounds — then prepare or leave now.

## Evidence files
- `R12-menu-640x360.png` — real app, native 640×360, opened by real New run → Begin → Esc. All six blocks inside the frame (lowest edge y=318).
- `R12-menu-after-save-640x360.png` — after a real click on "Save now": inline "Saved locally." (persistent, not only a toast).
- `R12-title-after-save-quit-640x360.png` — after "Save & quit to title": title with Continue.
- `R12_CAUSAL_BEFORE_AFTER.json` — same frozen run, before/after per cause (real intents; staging labelled in the test):
  - C1 6 wood in fuel custody: fuel limit null → 0.033 h, target 19 → 32.5
  - C2 roof_thatch enclosure: sheltered false → true, target 19 → 25
  - C3 fur_cloak worn (STAGED placement into the worn slot): insulation 0 → 18, target 19 → 73
  - C4 furnace idle (no job) → iron_ingot job queued: idle_furnace → burning, target 19 → 28
  - C5 position moved off snow: exposure snow_zone removed, target 19 → 100
- Vitest focused `mec01-r12-departure.test.ts` 21/21.

## Verification (agent-reported)
- Focused R12 21/21, exit 0.
- Full Vitest `--testTimeout=60000`: 122 passed / 1 skipped files, 887 passed / 1 skipped tests, exit 0.
- `tsc --noEmit` exit 0. `npx vite build` exit 0.
- Thermal/cold/heat/shelter regression set (b03, b04, cal01, w08 etc.) passed after the law refactor.

## Settle agreement (same frozen state)
- Dry window, minute-by-minute: forecast warmth equals `settle()` at 5/15/30/60 min (|Δ| < 0.05).
- Cold threshold: forecast reports the physical instant warmth reaches 8; settle is warm at 0.99× and cold at 1.01×.
- Season transition (phase boundary at 42 h): real offline settle from T0 to 20 min before the boundary, then the
  forecast window crossing the boundary matches `settle()` at 10/25/40/60 min.

## Bugs found and fixed in the model (not the tests)
1. Loop stopped at the first crossing, freezing warmthAtEnd. Fixed: integrate to the end.
2. `coldAt` was overwritten each step (last step, not first). Fixed: first crossing only.
3. Exact tie at 8.000: settle's strict damage gate (`<`) switches one slice later. Forecast now reports the earlier physical crossing (safe side). Documented in code.

## Limitations (explicit)
- Not a survival prediction. No certified survival hour. Hunger/thirst are the existing stationary estimate only.
- Weather beyond the current 9-min slot is only dry/wet scenarios; never a fact.
- Roof decay/collapse after the current plan is bounded by the roof-lost scenario only.
- Furnace output-full pauses are not forecast: the heat law counts a queued job as heating (same as the live law).
- Monsters, fire spread, radiation, combat are UNKNOWN.
- The save-failure branch is implemented (persistent red inline note) but was not forced in the browser; only the success path was exercised.
- Native Godot is not touched. No Last Island numerical parity is claimed. No human-enjoyment or visual acceptance is claimed.
- Map, POI, monster AI, AVFX unchanged.
