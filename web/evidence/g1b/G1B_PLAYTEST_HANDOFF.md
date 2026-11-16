# G1B — Creator playtest handoff (batch 3)

**Build:** the QA build on port **5200** (`VITE_SOH_QA=1`), or any production build of this branch.
**SHA:** see the PR head. PR #61 is **Draft** — do not merge.
**What this is:** a current SOH you can play yourself. The agent verified the mechanics technically; **you** judge the
experience (density, exploration, danger, reward, UI, art). Nothing here needs the console or QA tools.

> The numbers in `G1B_BATCH3_REPORT.md` are arithmetic and placement facts. They are **not** a verdict that the game
> feels right. Play it and decide.

---

## 1. New Game — where you start

- Pick **New Game** on the title. You spawn on the open ground of **Veyra (U=0.5)** near your first POI.
- The whole island is one streaming window: as you walk, the world scrolls and loads around you. Chests, gates and
  stairs are all in the real map.
- First things to see: a **road chest** almost immediately on the cart roads, and the first multi-room POI.

## 2. Multi-room, multi-storey POIs worth checking

These are the densest, most vertical sites (each has several rooms across storeys, many with the new chests):

| POI | what to look for |
|---|---|
| **Ironholm Harbor (Ore Quay)** | Ore Separation / Twin Mill (large workroom, now 2 chests), the Counterweight cellar below, sorting forecourt |
| **Sandgate (Sluice Port)** | Counterweight Flood-Gate Assembly, the Repair Shop, canal service routes |
| **Aion Edge Sawmill** | Main Crosscut Sawhouse, the log-feed yard, crosscut room |
| **Hall of Eyes** | the Elevated Eyes of the Watchers (upper storey, open, danger 4 — 4 chests against cover) |
| **Typhon's Fracture** | the Broken Skybridge above the Rift (upper, danger 4 — 2 chests in wall pockets) |
| **Necropolis of the Hollow Sun** | the Processional Avenue (deliberately kept clear — an open span with nowhere to store) |
| **Academy / Archive / Meridian** | the gated card rooms (see §4) |

## 3. Reaching upper floors, cellars and roofs

- **Upper floors / roofs:** walk to the **stairs / ladder** in the room (look for the stair tile or ladder sprite),
  press **F** to climb. Chests on that storey are solid and openable only from that storey; from the ground they are
  not solid and cannot be opened.
- **Cellars (level −1):** use the cellar stair. Same rule — a cellar chest only opens on the cellar storey.
- **No bypass:** a chest behind a locked door cannot be reached by climbing a stair that starts outside the sealed
  volume (the gate tests prove the sealed volume is closed on every storey).

## 4. Locked / gated rooms (card + power)

Five gates. Each needs its card **and** (where marked) a powered circuit; some need a filter mask (PPE).

| gate | door tile (global) | needs | card fixture |
|---|---|---|---|
| Falls deep (power) | 1464, 899 | power | generator at 1464, 896 |
| Academy green (card) | 1868, 506 | green card | card:green at po_kestrel 1390, 613 |
| Archive purple (card + power + mask) | 2047, 443 | purple card + power + mask | card:purple at po_slag 2402, 1843 |
| Archive deep (card + power + mask) | 2035, 443 | purple card + power + mask | (same card) |
| Meridian blue (card + power) | 2249, 1361 | blue card + power | card:blue at po_freightyard 1408, 989 |

- **Fuel a generator:** stand at the generator, it prompts **"add 1 Fuel Canister"** — have a Fuel Canister in the
  pack (grant or find one), press **F**. It runs for 180 s and powers the door.
- **Use a card:** hold the card, face the door, press **F**. The card is consumed per use.
- **PPE (mask):** the Archive deep door also needs a filter mask equipped.
- Once the door is open, walk through; the chests inside (on every storey, including the upper platform reached by
  the internal ladder) are now reachable.

## 5. Road chest routes

- Cart roads carry a **roadside wreck / dropped-load cache** roughly every 150 tiles; trail roads a **trail cache**
  every ~115 tiles. They sit on the verge, never in the carriageway.
- The most **remote stretch** of any long road (> 450 tiles from any site) has an **abandoned patrol cache**
  (military_low). Harsh ground (toxic / ash / snow / sand / ice) raises the grade one step.
- **Bridgeheads, docks and forks** each carry a small cache. Follow the roads and bridges; the caches mark the stops.

## 6. Open a chest, take items, check the save

- Stand next to a chest, face it, press **F**. It rolls its loot once for this run and shows the contents.
- **Take all** (the button in the chest panel) or drag individual stacks to the pack.
- **Check the save:** the game auto-saves. To verify integrity yourself, open the browser devtools → Console and run
  nothing — the game logs `[save] ok` or `[save] <category>`. A valid save never logs `invalid-state`. (You do not
  need to do this to play.)
- A chest you emptied **restocks after its timer** (12–72 h). Come back later and it has a new roll.

## 7. Creator Core — find, use, repair, upgrade

- **Find:** Cores drop from Supply / Toolbox / Military chests (Military is the Core-rich family; only in danger-3+
  or gated / hidden / climbed rooms). A rolled Core lands in the pack.
- **Use:** equip it (it goes in the equipment slots). **LMB** casts the basic skill, **Q** the refined skill,
  **E** the signature skill. Each cast costs **durability** (wear) and ammunition from the pack
  (basic 1 `energy_basic`; refined 1 `energy_refined`; signature 1 `energy_refined` + 1 `essence_<element>`).
- **Wear guard:** a cast is **refused** when durability is below the skill's wear — you are told "too worn", and
  nothing is spent. Repair restores it.
- **Repair:** at any **Workbench** (the Core service card). Repair adds **+75 durability** (max 300).
- **Upgrade:** at your **own Workbench** — Lv2 needs a **Workbench Lv2** (45 s), Lv3 a **Workbench Lv3** (75 s).
  The Core keeps its UID across upgrades.
- **Open the Core service card:** press **I** (Survivor screen), scroll the left column to the **CORE SERVICE** card.
  It shows level, durability, the three skills' wear, and the Upgrade / Repair buttons.
- **Legacy saves:** a Core from an older save starts at **Lv3, full durability**; its pre-V2 loaded energy is returned
  to the pack once (with a receipt) — you do not lose it.

## 8. Real-time restock (including offline)

- A chest you emptied shows **"restocks in …"**. The timer runs on the **game clock**, which advances while you play
  **and while the game is closed** (offline progression). Reopen the game and the chest has restocked.
- Settlement also refills chests that are offscreen (out of the current window) as time passes.

## 9. What the agent verified vs. what only you can judge

**Engineering verified (objective):** 729 chests placed on real wall pockets / storeys / roads; every source id and
tile preserved from batch 2; save migration from the 130-source layout; gates sealed on every storey; Core wear
guard, repair / upgrade, legacy owed; restock timers; the `Save refused` root cause (a capture-script blueprint
without a recipe, not the Take All); icon / sheen channels; UI has no overflow at 640×360.

**Design candidate (agent's placement, not accepted):** the chest counts and positions per room / road, derived from
physical constraints. **You decide** if the density and distribution feel right.

**Creator playtest required:** whether exploration is rewarding, danger is exciting, loot is worth picking up, the
Core economy (11 → 35 per full sweep) is balanced, and the icons / sheen / UI are legible and acceptable.

**Known limitations:** 25 catalog ids have no approved art (drawn icon, tagged); icons are ~20 px in 24 px cells at
640×360 (full 32 px needs a slot-layout redesign); 30 spaces are unreachable (categorised in the report — a map-owner
decision); captures use QA positioning, not real walks.
