# SOH Web — player-review build

Reviewed code: `a3485898` (game code). This package is built by `.github/workflows/web-player-review.yml` from the branch HEAD. Each build's artifact is named `soh-web-player-review-<commit SHA>`.

## Download
1. Open the **SOH Web player-review build** workflow in the repository's Actions tab, pick the run for the commit you want, and download the artifact `soh-web-player-review-<SHA>` (GitHub requires a signed-in account to download artifacts).
2. Unzip it. The folder contains `index.html`, the game assets, `fixture-intel-save.json`, `screenshots/`, and this README.

## Launch (requires a local web server)
The game must be served over HTTP. **Double-clicking `index.html` does not work**: it opens a blank page (verified: asset requests fail under `file://`).

Open a terminal in the unzipped folder and choose ONE:
- **Python 3 installed:** `python3 -m http.server 4600` (Windows: `py -m http.server 4600`)
- **Node.js 18+ installed:** `npx --yes http-server -p 4600`
- **VS Code:** install the "Live Server" extension and choose "Open with Live Server" on `index.html`.

Then open `http://localhost:4600/` in Chrome, Edge or Firefox and choose **New run**. Move with WASD, press **M** for the map, **C** for crafting, **I** for inventory.

## Save behaviour
Saves are stored by the browser per exact origin (scheme, host and port). `localhost:4600` and `127.0.0.1:4600` are different saves. Clearing site data removes the run.

## Controlled fixture — NOT gameplay evidence
`fixture-intel-save.json` is a real engine-generated save with observed intel placed beside the Lighthouse door and one fuel recipe marked known. It is for UI inspection only. To load it, on the served page open the browser console and run:
`localStorage.setItem('soh.state.v3', await (await fetch('/fixture-intel-save.json')).text()); location.reload();`
Then choose **Continue**, press **M**.

Intel facts mirror real placements in `web/src/game/world.ts`: the Bow blueprint is at the Crossroads Trading Post, the Arrow blueprint at the Halcyon Hull, and the Fuel Canister in the Lighthouse crate. No blueprint is shown as owned.

## Screenshots (inspected)
Stored in `web/player-review/screenshots/` and in the artifact:
- `map-1280x720.png` — Lighthouse Intel selected.
- `map-640x360.png` — four discovered places; the panel fits.
- `map-trading-post-1280x720.png` — Bow seen, not owned.
- `map-open-recipe-crafting-1280x720.png` — Map → Open recipe → Crafting; Workbench L2 missing; Reserve & queue disabled away from a Workbench.

## Known viewport limit
Four discovered places were inspected at 640×360 and fit. The map has no bounded vertical scroll for the discovery list, so it may clip at larger discovery counts. Not verified beyond four places.

## Not verified here
Natural progression to these gates; crafting at a real Workbench; movement feel, learnability and enjoyment (Creator play).
