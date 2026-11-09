# VEYRA — CURRENT ONE GAME / 81 POIs / SIX ELDER SANCTUARIES

**This is the authoritative entry point for map refinement on branch `game/veyra-81-poi-art-battle-20261109`.**

## Only one game to open

The current playable map is **not** the historical R4/R5 standalone `PLAY_VEYRA_WORLD_R5_81_POI_SIX_ELDERS.html`. That old release and its `R5_RELEASE_MANIFEST.json` remain historical provenance, not a current game or source to refine.

The current and only player-facing new-run game is the **existing Soul of Heroes Web app**:
- Entry: `web/src/main.tsx` → `web/src/App.tsx` → `web/src/ui/Title.tsx` → `web/src/ui/Game.tsx`.
- Default and only listed new-run layout: `veyra05-world`; old layouts are internal read-compatibility for legacy saves, **not alternative new-run games**.
- Its world loader: `web/src/game/world.ts` → `web/src/veyra05/window.ts` → `web/src/veyra05/poi-kit.ts` / `floors.ts`.
- Canonical 81 authored POIs: `web/src/veyra05/arch/sites.ts` = 33 individually authored entries + 48 `REST48_IDS` from `web/src/veyra05/arch/rest48.ts`.
- The latest SIX Elder lairs are authored in that same `rest48.ts`: `po_elderwood` (Aion), `po_typhon` (Typhon), `po_gate` (Atlas), `po_surtur` (Surtur), `po_necropolis` (Anubis), `po_hall_eyes` (Argus).
- Physical geography authority: `web/geography/veyra-lr01/map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json` plus source-verified WMP rasters. Do not invent an isolated island or use `web/src/game/world.ts`'s retained shipping generator as the VEYRA map.

### Start the actual existing game

```sh
cd web
npm ci
npm run dev
```

Open the Vite URL. On the original SOUL OF HERO title screen:
- **New run** uses **VEYRA · Unified World · 81 canonical POIs** (the one game).
- **World Map · 81 POIs** opens the built-in Creator Inspection of that same world source. Select a POI, then **Inspect & Play** to explore using normal game controls; that separate QA session never overwrites a real save.
- In VEYRA gameplay, press **M** for its world map and **E** at real stairs/hatches for authored multi-floor traversal. Do not infer a fully implemented Elder boss encounter from the architectural symbols.

### Evidence and limits

- `web/src/veyra05/integrated-world.test.ts`: checks that the actual new-run map loader and 81-POI overview share canonical data and six latest lairs.
- `web/src/veyra05/arch/elder-lairs.test.ts`: real compiled topology / paths.
- `web/src/veyra05/integrated-lifecycle.test.ts`: strict save identity checks after window shifts and Elder floor changes.
- `web/e2e/veyra-unified-smoke.mjs`: launches the **existing** game in Chromium, opens 81-POI inspector, checks six Elder identities, enters an actual playable Creator QA session, exits, then starts a normal U=0.5 VEYRA run. Evidence and exact SHA are retained by the VEYRA branch GitHub Actions run.
- Run `npm run build` and `npx tsc --noEmit` before claiming code integration PASS.
- Passing source checks and browser smoke is **not** 81/81 human visual acceptance, every stair's manual playthrough, gameplay-combat integration, or a production Godot port. Art refinement remains pending Creator review.
- C03 `po_strait`, `po_mere` and `po_southfoot` are **provisional reconstructions**, not recovered original authoring.

### No competing release

The old `R5_RELEASE_MANIFEST.json`, `build_world_portable.cjs` and `r5/source/` are retained as old distribution records. **Do not build, open, regenerate or judge the current map from those files**. Their referenced standalone ZIP has a different earlier source SHA and cannot stand in for the current game. All future VEYRA Arena refinements must target the existing `web/src/veyra05/` architecture and art inside this **same game**, verify the game UI loads their edits, and preserve GOLD identities.

No production merge without Creator approval.
