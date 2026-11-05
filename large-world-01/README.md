# LW-01 — Soul of Hero Web large-world / streaming pilot

A **runnable, independently reviewable** bounded pilot that removes the isolated
200×200 window from a *copy* of the current Gameplay Web engine and plays one
contiguous, geospatially faithful WMP-04R1 Veyra at U=1. It is **not** MapLab,
not a static zoom chart, not a production merge and not a claim of complete
Veyra gameplay.

> 10× **linear** = 100× **cells**. 200×200 = 40,000; 2,000×2,000 = 4,000,000.
> The authored WMP-04R1 Veyra frame at U=1 is **2,000×1,400 = 2,800,000 cells**,
> **not square** — no 600 rows of fabricated land are added. There is **no
> approved final U**; U=1 is a test candidate, U=2 the prior diagnostic and
> U=0.5 a bounded Beacon-only triage.

## Layout

| Path | What |
|---|---|
| `web-legacy/` | verbatim `git archive <Gameplay e11a9b44> web` — untouched 200×200 baseline |
| `web-large/` | same verbatim copy + new `src/game/large/` runtime and patched `render.ts` / `world-economy.ts` |
| `map-data/` | 39 authoritative WMP-04R1 / WMP-03 / GOLD files + `GENERATED_META.json` |
| `SOURCE_PROVENANCE.json` | exact heads, file digests, custody policy |
| `tools/` | vendor, source-builder, engine patcher, browser QA, verifier |
| `evidence/shots/` | 16 real 640×360 Chromium captures |
| `evidence/qa-report.json`, `evidence/verification.json`, `evidence/build.log` | machine-readable proofs |
| `docs/CONTROL_TOWER_HANDOFF.md` | the single final handoff |

## Launch

```bash
cd large-world-01/web-large  && npm install && npm run dev -- --port 5180 --strictPort   # LW-01 pilot
cd large-world-01/web-legacy && npm install && npm run dev -- --port 5181 --strictPort   # 200×200 baseline
```

Open the Arena live preview for **port 5180** (pilot) and **5181** (baseline), or
`http://localhost:5180` / `http://localhost:5181` locally. Both bind `0.0.0.0`
with `allowedHosts: true`.

Direct entry (all URL options are reproducible QA switches, not gameplay):

```
http://localhost:5180/?profile=veyra-u1&scene=beacon&seed=20261105&hours=0.08&autostart=1&hud=0&fresh=1
```

* `profile`: `capacity-2000x2000` (synthetic non-canon), `veyra-u2`, `veyra-u1`, `beacon-u05`
* `scene`: `beacon`, `village`, `snow`, `shore`, `westmouth`
* `hours`: QA clock offset (`0.08` ≈ midday, `0.32` ≈ deep night); flagged `QA·LOCAL`
* `hud=1`: developer HUD on (default OFF); `fresh=1`: ignore any LW-01 save
* `cam=tx,ty`: **QA fast scene selection only — not a walked journey**

Remove `fresh=1` and reload to resume the saved global coordinate.

## Controls (original GameRoot bindings, unchanged player/camera dimensions)

| Key | Action |
|---|---|
| `W A S D` / arrows | real WASD movement, `TILE=16`, `BAL.player.speed=72` px/s (no speed hack) |
| `F3` | toggle developer HUD (off by default) |
| `F9` | save (`soh.lw01.save.v1`), reports legacy-save preservation |
| `H` / `J` | **QA-only** harvest / place state fixtures (production interaction range is NOT implemented) |
| `1`–`8` | quickbar slot |
| `Esc` | menu / save & title |

The dev HUD exposes active profile + U + cells, exact source revision and map/
Gameplay heads, global tile + linear index, chunk/local coords, loaded chunks,
loads/unloads, resident layer bytes, render-canvas bytes, JS heap, frame p50/p95,
save size, walked distance, boundaries, active/distant creatures and deferred events.

## Reproduce

```bash
node tools/vendor.mjs                 # re-verify source custody
node tools/build-sources.mjs          # regenerate browser-safe source module
node tools/patch-engine.mjs           # reproducible patch (idempotent; LW_SRC=... for a clean tree)
cd web-large && npx tsc --noEmit && npm test && npm run build
cd ../web-legacy && npx tsc --noEmit && npm test && npm run build
# with both dev servers running:
LW_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib node tools/qa-browser.mjs
node tools/verify.mjs
```

`qa-browser.mjs` needs a Chromium binary (`LW_CHROMIUM`, default `/tmp/chromium`,
fallback `playwright.chromium.executablePath()`) and the two dev servers. It uses
Playwright at viewport 640×360, DPR 1, `--no-sandbox --disable-dev-shm-usage
--disable-gpu`.

## Honesty limits

No `VEYRA_PLAYABLE`, `VISUAL_ACCEPTED`, `MERGE_READY`, world-master sealing,
production art approval, approved final U, marine/boat/ferry travel, helicopter
object, complete Veyra gameplay or sustained-60-FPS claim. The helicopter landmark
at AU [272,652] is reported `PROVEN_MISSING`; the creator's Beacon scale decision
is still pending. See `docs/CONTROL_TOWER_HANDOFF.md` for gate verdicts, exact
blockers and one Control Tower action per blocker.
