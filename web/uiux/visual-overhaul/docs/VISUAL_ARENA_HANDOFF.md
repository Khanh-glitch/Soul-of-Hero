# Soul of Heroes — Visual Experience Overhaul · Wave 4 handoff

## Wave 4 (creator feedback: overlapping panels, routine events too loud, clumsy pack, split craft, build panel)

* **HUD arbitration** (`Game.tsx`, "HUD ARBITRATION" block): full-screen surfaces own the screen (HUD cards, feed, centre theatre wait); a docked panel withdraws side cards; combat (Elder in range / Core aim) withdraws comfort cards and the airdrop strip; at most ONE context card (heat only when warmth is actually at risk, home only when unfunded / uncovered / damaged); interaction prompt and Core strip hidden while building; the Core reserve strip shows only while aiming.
* **Notification tiers** (`experience.ts`): `feed` = small left-edge line, duplicates merge ×N, 4 s (crafts, jobs done, builds, harvests, repairs, vehicle actions, early achievements); `stage` = centre plaque only for rare/major (Core recovered, Elder, Ragnarok, first deposit, recipe learned); `ceremony` = upgrades (workbench level, furnace lining, generator, cart, power module) with two counter-rotating pixel gears and a soft world dim.
* **Survivor screen** (`SurvivorScreen.tsx`, I or C): pack + crafting on one full-screen surface. Left: equipment around a live character, 8×3 pack (top row = hotbar), item card. Right: craft grouped by purpose (All / Tools / Gear / Food & Med / Materials / Cores / Stations / Devices), "ready" filter, big tiles, ingredients → output diagram, station shown as a chip. Workstations and devices are placed from here with the unchanged `build` intent and cost.
* **Item handling** (`dragSlots.tsx`, shared by pack, chests, stations, vehicles): drag & drop (move / swap / merge via engine `move`), click = inspect, double-click = use / equip, right-click = quick action, shift-click = quick transfer, **hover a slot + 1–8 = put on that hotbar slot**. The old "click, then click again swaps" state is removed.
* **Build mode** (`BuildBar.tsx`, B): the hotbar becomes the build kit (wood foundation, wall, door, roof, cabinet, bed, chest, barricade, torch, escrow) + Upgrade U / Repair V / Dismantle X; 1–0 or wheel select, LMB place, B / Esc / RMB exit. Material tiers stay on the existing per-piece Upgrade action. *Not done:* "short / long wall" variants — the engine has only single-tile walls, adding shapes would be a gameplay change for Gameplay Tower.
* QA compound adds a level-1 workbench so a real `upgradeStation` triggers the ceremony.
* Evidence: `evidence/wave4/` (640 + 1280): normal play, Survivor screen, mid-drag, inspect, stations tab, feed after craft, build mode, upgrade tool, build exited. Real-input results in `evidence/wave4/run-log.json`: drag Hunting Bow → hotbar 7 ✓, hover + 8 Salvager Pick → hotbar 8 ✓, console errors 0.

---


## 1. Deliverable & provenance

| Item | Value |
|---|---|
| Package | `release/soh-visual-wave3.zip` (47 MB) — verified by extracting into a clean folder: `dist/index.html` present, 54/54 PixelFX PNGs present, `node tools/verify-assets.mjs` passes |
| Runnable build | `dist/index.html` (single file; open via any static server, e.g. `npx serve dist` or `python3 -m http.server -d dist 8080`) |
| Gameplay base | `arena/d4bfcfff-soul-of-hero` @ **`da92b0682f14cbb7c28fdb3b95088cac71ebed7a`** (newest HEAD at this session; `engine.ts`, `sim.ts`, `persist.ts`, `balance.v1.json`, `stimulus.ts`, `world-window.ts`, `presentation-cues.ts` rebased from it unchanged) |
| Git push | **Not performed** — this sandbox has no repository credentials. Nothing was pushed or merged. |
| Build gate | `npm run build` now runs `tools/verify-assets.mjs` first and fails if any manifest PNG is missing (the Wave 2 packaging defect cannot recur silently) |

## 2. What changed this round (creator feedback: *too much text, weak visualization*)

### Notifications → an event vocabulary, icon first
* `src/game/experience.ts` maps committed receipts to short events: `CRAFTED · 2 Rope`, `BUILT · Wood Wall`, `NO FUEL · job paused`, `SECURED · 45 coins → profile`, `RAGNAROK · final 72 hours`. Details are ≤ 6 words; batch outputs render as icon chips, not sentences.
* `src/ui/ExperienceStage.tsx`: one non-modal plaque at a time (icon sigil, orbit ring, wings), a full-width *world cut* for Ragnarok / Elder waking, and a world-anchored `+N` pickup float for container withdrawals. Priority queue, 30 s dedupe per receipt, max 4 queued, dismissable, world stays playable.
* Toasts are one-line icon pills (✓ / ✕), the log is two short lines that fade in 8 s. The old duplicated entry banner is gone.
* Staged QA buttons are labelled **STAGED PREVIEW** on the plaque itself.

### Pack (I)
Paper-doll: equipment slots with ghost icons flank a live preview of the actual Adventurer; armour / warmth / coins / load are glyph chips and a load bar; the item card is icon + category chip + stat chips (DMG, reach, warmth, fuel, food, charges, reserves, weight) with a durability bar and icon-only "known uses".

### Craft (C)
Station rail (icons, green lamp = station in reach) → recipe tile grid (green dot = ready, red = missing, amber = station out of reach) → diagram `ingredients → output` with have/need chips, station/time/fuel/queue chips, one Craft/Queue button and a one-line reason when disabled.

### Build (B)
Tabs with icons, 4-column structure tiles (sprite on a ground swatch, cost as icon+number), focus card with layer/role chips, cost chips and HP, single Place button, key-cap mode row (X / V / U / G / RMB).

### Contextual cards
* Heat card: warmth gauge with target tick + lamps (shelter, insulation, exposures, heaters), no sentences.
* Home card: name + HP bar + PROTECTED/UNFUNDED/NO CABINET chip with hours + material icons.
* Airdrop card: `AIRDROP · DESCENDING · sector · 4s` on one line.

### Rider identity (creator requirement)
`vehicle-art.ts` no longer paints any rider; the bike is machine art only. `render.ts` composites the **actual selected Adventurer** (`hero-art.ts` new `ride` pose, 3 frames, knees over the tank, hands on the grips) plus the **equipped head/body/back items** on top of the bike, in all four facings. Mount/dismount is a 360 ms eased transition from the last real position (`updateActorTransition`) with the `vault` pose — no teleport, no proxy sprite. Equipment layers are also drawn on foot, so gear persists across mount → ride → dismount.

### QA isolation (review finding)
* QA runs only from the Title button; `F9` is inert in production runs.
* In QA: autosave, 5 s periodic save, death save, visibility/beforeunload save, "Save now" and quit-save are all disabled; leaving QA restores the production layout. The production save object is never passed to `Game` while QA is active.
* Fixtures use engine intents where an intent exists: Furnace / Refinery / Research jobs are queued with `craft` / `research`; the motorbike and cart are deployed with `placeMotorbike` / `placeCart` / `vehicleRefuel` / `vehicleLubricate`; freight is bought with `buy{freight}`; Ragnarok is reached with `qaAdvance`; offline return runs the real `settleWithReturn` against the live world (no hand-written report rows). Entity placement for structures, test creatures, cash cache and the airdrop remain staged and are labelled so.

## 3. Evidence (captured from the final build, native 1× and 2×)
`evidence/wave3/640-*.png`, `evidence/wave3/1280-*.png`: entry event, pack, pack with item card, craft, build, craft event frame, bike parked, bike sequence 0–5, dismounted. `evidence/wave3/crops/bike-sequence-4x.png` is a 4× nearest-neighbour contact sheet of the actor window proving the same Adventurer palette on foot and in the saddle. Console errors across all captures: **0**.

## 4. Checks
* `npx tsc --noEmit` — clean.
* `vitest`: 8 files, 84 tests pass (industrial art, presentation cues, integrity, vehicle unload, return, vendor freight).
* `npm run build` — success with asset gate.

## 5. Known limitations (honest)
* Audio playback cannot be verified in this headless container; the mixer and cues compile and run without errors but need human listening.
* The QA bike spawn is chosen by pre-checking the engine's own mount conditions; on an unlucky spawn the demo reports the real engine refusal instead of faking success.
* Elder summon / overheat / instant defeat, death overlay and airdrop spawn are staged previews (labelled). Natural triggers are untouched engine paths.
* Secondary panels (vendor, escrow, rest, map, skills, menu) keep Wave 2 styling; they were not in this round's scope.
