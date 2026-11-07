# SOH Web — player-review build (controlled fixture)

Reviewed code: `a3485898` (player-review docs added in the next commit; no game-code change).

## Launch
1. Build: `cd web && npm ci && npx vite build --config vite.http.config.ts` → `web/dist-http/`.
2. Serve the folder over HTTP (any static server), e.g. `cd web/dist-http && python3 -m http.server 4600 --bind 0.0.0.0`.
3. Open `http://localhost:4600/`. Choose **New run** to play normally.

## Save behaviour (important)
- Saves live in the browser's storage **for that exact origin** (scheme + host + port). `localhost:4600` and `127.0.0.1:4600` are different saves; a new host or port starts with no save.
- Clearing site data deletes the run.

## Controlled fixture (NOT gameplay evidence)
`fixture-intel-save.json` is a real engine-generated save with observed intel placed beside the Lighthouse door. It exists only for UI inspection. To load it in the browser console on the served origin:
`localStorage.setItem('soh.state.v3', await (await fetch('/fixture-intel-save.json')).text()); location.reload();`
(Copy the file into the served folder first, or paste its contents.) Then "Continue", press **M** for the map.

Intel facts in the fixture mirror real placements in `web/src/game/world.ts`: Bow blueprint at the Crossroads Trading Post, Arrow blueprint at the Halcyon Hull, Fuel Canister in the Lighthouse crate. No blueprint is shown as owned.

## Screenshots (inspected)
- `map-1280x720.png` — Map with Intel for Lighthouse selected.
- `map-640x360.png` — four discovered places; chips wrap; panel fits.
- `map-trading-post-1280x720.png` — Blueprint seen, not owned: Hunting Bow.
- `map-open-recipe-crafting-1280x720.png` — Map → Open recipe opens Crafting; Workbench L2 missing, Reserve & queue disabled away from a Workbench.

## Not verified here
Natural progression to these gates; crafting at a real Workbench; feel, learnability and enjoyment (Creator play).
