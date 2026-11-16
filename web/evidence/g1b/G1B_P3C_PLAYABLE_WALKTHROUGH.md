# G1B Batch 3.2 — P3C Creator-playable build & walkthrough

**Build:** live dev preview on **port 5210**, pinned to commit **`fc7288025`** (branch `arena/f7f5cf36-soul-of-hero`, PR #61 **Draft**).
**Preview:** `http://<port>-<sandboxId>.e2b.app/` (the sandbox proxies the Vite dev server bound to `0.0.0.0:5210`; `allowedHosts: true`).
**What this is:** a current Soul of Hero you can play in the browser. The agent verified the mechanics technically; **you** judge the experience.

> ENGINEERING VERIFIED = objective technical facts. DESIGN CANDIDATE = the agent's placement, not accepted. CREATOR PLAYTEST REQUIRED = only you can decide.

## Layout revision

This build carries **layout revision 4** (738 chest sources: 130 base + 608 ecology). A revision-3 save (729 chests) migrates add-only to revision 4 — the 9 new P2 chests are added closed, every existing chest, tile, position and state is kept verbatim. A genuine Batch-2 `layout=2` save (563 sources) also migrates through revision 3 → 4, preserving every Batch-2 possession. Forged / future / partial saves are refused.

## Controls (quick)

| action | key |
|---|---|
| move | WASD / arrows |
| interact (open chest, climb stairs, use generator / card, take all) | **F** |
| open Survivor screen (Core service, inventory) | **I** |
| Core skills (equipped) | **LMB** basic · **Q** refined · **E** signature |
| open chest panel / take all | stand beside + **F** |

## Walkthrough — where to look

### 1. Start
- **New Game** on the title. You spawn on open ground near the first POI; the world streams around you.
- A **roadside chest** appears almost immediately on the cart roads.

### 2. Multi-room, multi-storey POIs (densest sites)
| POI | what to look for |
|---|---|
| **Ironholm Harbor** | Ore Separation / Twin Mill, Counterweight cellar, sorting forecourt |
| **Sandgate (Sluice Port)** | Counterweight Flood-Gate Assembly, Repair Shop, canal service routes |
| **Aion Edge Sawmill** | Main Crosscut Sawhouse, log-feed yard, crosscut room |
| **Hall of Eyes** | Elevated Eyes of the Watchers (upper, open, danger 4) |
| **Typhon's Fracture** | Broken Skybridge above the Rift (upper, danger 4) |
| **Academy / Archive / Meridian** | the gated card rooms (§3) |

### 3. Locked / gated rooms (card + power + PPE)
Five gates. Each needs its card **and** (where marked) a powered circuit; the Archive deep door also needs a filter mask.

| gate | needs | card fixture |
|---|---|---|
| Falls deep (power) | power | generator at the falls |
| Academy green (card) | green card | card:green at po_kestrel |
| Archive purple (card + power + mask) | purple card + power + mask | card:purple at po_slag |
| Archive deep (card + power + mask) | purple card + power + mask | (same card) |
| Meridian blue (card + power) | blue card + power | card:blue at po_freightyard |

- **Fuel a generator:** stand at it, prompt **"add 1 Fuel Canister"**, press **F** (180 s, powers the door).
- **Use a card:** hold it, face the door, press **F** (consumed per use).
- Once open, walk through; the chests inside (all storeys, including the upper platform) are reachable.

### 4. Upper floors, cellars, roofs
- Walk to the **stairs / ladder**, press **F** to climb. A chest on that storey only opens from that storey.
- **Cellars (level −1):** use the cellar stair. Same rule.
- A chest behind a locked door cannot be reached by climbing a stair outside the sealed volume (the gate tests prove the volume is sealed on every storey).

### 5. Road chests
- Cart roads: a roadside cache roughly every 150 tiles; trail roads: a trail cache every ~115 tiles. They sit on the verge, never in the carriageway.
- The most remote road stretch (> 450 tiles from any site) has an abandoned patrol cache (military_low). Harsh ground raises the grade one step.

### 6. Open a chest, take items
- Stand beside a chest, face it, press **F**. It rolls loot once for this run and shows contents.
- **Take all** in the panel or drag stacks to the pack. An emptied chest **restocks after 12–72 h** (game clock, runs offline too).

### 7. Creator Core
- **Find:** drops from Supply / Toolbox / Military chests (Military is Core-rich; only danger-3+ or gated / hidden / climbed rooms).
- **Use:** equip; **LMB** basic, **Q** refined, **E** signature. Each cast costs durability + ammunition from the pack.
- **Wear guard:** a cast is refused when durability is too low ("too worn"), nothing spent.
- **Repair:** at any Workbench, +75 durability (max 300). **Upgrade:** at your own Workbench (Lv2 45 s, Lv3 75 s); the Core keeps its UID.
- **Legacy saves:** an older Core starts Lv3 full durability; pre-V2 loaded energy is returned to the pack once.

## What the agent verified vs. what only you can judge

**Engineering verified:** 738 chests (rev 4) on real wall pockets / storeys / roads; 9 P2 physical additions in 8 large storage rooms; add-only migration rev 2→3→4 preserving state; genuine Batch-2 fixture loaded by the corrected engine; 30 unreachable spaces classified; 25 drawn icons + 156 atlas icons resolved at runtime; tsc clean; full G1B suite 63 pass / 0 fail.

**Design candidate:** the chest counts and positions per room / road. **You decide** if density and distribution feel right.

**Creator playtest required:** exploration reward, danger, loot value, Core economy balance, icon / sheen / UI legibility and acceptability. Art acceptance is the Creator's verdict only.

**Known limitations:** 25 catalog ids have no approved art (drawn icon, tagged `data-icon="drawn"`); 30 spaces unreachable (classified — map-owner decision); captures use QA positioning, not real walks.
