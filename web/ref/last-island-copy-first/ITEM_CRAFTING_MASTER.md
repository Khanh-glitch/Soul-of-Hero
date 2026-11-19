# Item and Crafting Master — Soul of Hero

> GENERATED FILE. Do not edit by hand. Source: `ITEM_CRAFTING_MASTER.json`, produced by `web/tests/item-crafting-master.test.ts`.

**Status:** SPEC_READY / RECIPE_READY. Not PLAYABLE, not VISUAL_ACCEPTED. Source, loot, container and map design are out of scope.

**Authority:** This is the one canonical item and recipe document. It supersedes the recipe sections of ARENA1_ROUND1_REPORT.md, ARENA1_ROUND2_REPORT.md, SOH_147_ITEMS_BY_ROLE.md and earlier item audits. The 157-id roster itself stays in FINAL_THREE_GROUP_ITEM_SET_20261115.json.

**Recipe revision:** 6. **Items:** 157 (A 78 / B 42 / C 37). **Live formulas:** 114 (90 explicit + 24 packs). **Items with a bill:** 108. **Items with no bill by design:** 49.

## How to read this

- acquire_policy is design intent. WORLD_ONLY / BOTH do not assert that a map source exists today; placing sources is the next phase.
- provenance: LI_EXACT / LI_SCALED / SOH_ADJUSTED / SOH_ONLY. provenance_basis LEDGER = hand-audited row in final-item-ledger.ts; AUDIT_DERIVED = classified mechanically against the li_source_audit row; NONE = no LI bill recorded.
- li_grade is the audit grade of the LI figure: DIRECT, INDIRECT, LEGACY_CLAIM, UNSUPPORTED_CITATION or NONE. Every audit row is graded "LI: many versions/modes (mostly historical material)": no figure is tied to one dated LI version.
- No fixed LI -> SOH divisor is claimed. Where SOH counts differ from LI they are SOH_PROVISIONAL.
- Three separate axes per recipe: knowledge (STARTER, DIRECTED_RESEARCH for tier < 3, otherwise random research / blueprint / specimen / core study), bench level, and bill.

## 1. The crafting language in one page

| Ingredient | Always means | Used in (formulas / packs / other) |
|---|---|---|
| Iron Ingot | plain metal body | 24 / 12 / 6 |
| Wood | frame, handle or shaft | 15 / 17 / 1 |
| Parts | fitted mechanical pieces | 18 / 8 / 5 |
| Frost Crystal | Core focus | 16 / 0 / 0 |
| Rope | lashing | 11 / 3 / 0 |
| Stone | mass, head or hearth | 8 / 5 / 1 |
| Refined Iron Ingot | hardened metal | 11 / 1 / 0 |
| Plant Fiber | binding, wick or stuffing | 7 / 3 / 1 |
| Iron Plate | protective sheet metal | 6 / 1 / 4 |
| Mechanical Gear | a mechanism that turns | 3 / 4 / 4 |
| Raw Hide | padding and lining | 10 / 0 / 0 |
| Needle and Thread | sewn assembly | 10 / 0 / 0 |
| Electronic Parts | circuit that senses or decides | 1 / 5 / 2 |
| Glass | lens, still or vessel | 5 / 1 / 1 |
| Leather | grip, strap or shell | 7 / 0 / 0 |
| Cloth | fabric or filter | 6 / 0 / 0 |
| Charcoal | carbon and heat | 5 / 0 / 0 |
| Bitterleaf | medicine or nature element | 4 / 0 / 1 |
| Metal Pipe | tube or hollow structural member | 3 / 2 / 0 |
| Berries | sugar and juice | 4 / 0 / 0 |
| Raw Meat | protein | 4 / 0 / 0 |
| Metal Blade | cutting edge | 4 / 0 / 0 |
| Sulfur | fire element | 4 / 0 / 0 |
| Tin Can | sealed container | 4 / 0 / 0 |

## 2. Family rulebook

### 01 Raw / Scavenged (20)

What the world gives. Nothing here is crafted; everything else is made from it.

**Rules**

1. Seven backbone raws carry the language: Wood (frames, handles, fuel), Stone (mass, heads, hearths), Fiber (binding, cloth), Hide (leather, padding), Iron Ore (all metal), Parts (anything mechanical), Crystal (anything Core).
2. A scavenged raw is a made thing the player cannot make: Parts, Electronic Parts, Resistor Wire, Tin Can, Needle Tube. Each gates one technology and has no formula on purpose.
3. A creature raw names its use: Hide and Fur are worn, Fat is burned or injected, Shell is lime, Gland is medicine, Chitin is plate, Feather is fletching.
4. No raw has a crafting formula. Crude Petroleum is the one raw with a job row (`pump_crude`): that row is extraction from finite seep stock, not a craft.

**Examples**

- Parts: in 23 bills, never craftable, also the research currency. The scarce hand on every machine.
- Tin Can: the container of every preserved food. No tin, no soup, wine, jam or canned meat.
- Resistor Wire: one consumer (the Powered Door lock). A deliberate single-purpose electrical scrap.

**Inferring an unseen formula:** Seeing "Parts" in a bill tells the player the product has moving or fitted pieces; seeing "Electronic Parts" tells them it will need power.

### 02 Processed Materials / Components (14)

One processing step away from raw, or a purpose-built part. These are the words recipes are written in.

**Rules**

1. First-step materials cost exactly one raw and one station: Charcoal (wood, fire), Iron Ingot (ore, furnace), Leather (hide, bench), Rope and Cloth (fiber), Plank (wood).
2. Refined Iron is iron plus carbon: 3 Iron + 2 Charcoal -> 2. It is the marker of tier 2 metal.
3. Four components each mean one thing wherever they appear: Gear = a mechanism that turns; Pipe = a tube or a hollow structural member; Plate = sheet metal that protects; Blade = a cutting edge.
4. A component is metal + Parts at a level-2 bench. Plain iron for Gear and Blade, Refined Iron for Pipe and Plate. Pipe and Plate share one bill and both yield 2.
5. Needle and Thread means "this is sewn". It appears in every stitched armour piece and in travel gear, nowhere else.

**Examples**

- Gear 2 Iron + 3 Parts: the Parts-heaviest component, as in Last Island (50 iron + 65 parts).
- Blade 3 Iron + 1 Part: cheaper than a Gear, as in Last Island (30 + 15).
- Pipe / Plate 2 Refined Iron + 2 Parts -> 2: same bill, different shape.

**Inferring an unseen formula:** Knowing Pipe and Plate, a player who meets the Utility Frame (Pipe + Iron + Refined Iron + Parts) reads it as "a tube skeleton with fittings" without being told.

### 03 Food / Medicine / Consumables (22)

Things used up by using them: eaten, drunk, applied or burned.

**Rules**

1. Fire turns one raw food into one better food, 1:1: Meat -> Roast or Dried, Marsh Cap -> Grilled.
2. A Tin Can turns several raw foods into one dense, slot-efficient food: soup, canned meat, wine, jam. The tin is the cost of density.
3. Each cooked food buys a different thing: Roast = hunger, Dried = weight, Canned = slots, Soup = warmth, Juice = thirst, Wine = portable warmth, Jam = stamina, Stew = the best meal and needs a farm.
4. Medicine climbs in three steps: Bandage (fiber), Medkit (bandages + herb), Syringe (a scavenged Needle Tube + fat + iron). Purge Tonic treats radiation and needs a Mire Gland.
5. A water container is made once and refilled; fuel is made per can.

**Examples**

- Roast Meat 1 Meat, 8 s vs Dried Meat 1 Meat, 20 s: less hunger, half the weight.
- Mushroom Soup 5 Marsh Cap + 1 Tin: Last Island numbers, literal.
- Fuel Canister: 3 Crude + 1 Glass, or 5 Crude + 1 Glass for two, or 6 Fat + 1 Cloth without any oil.

**Inferring an unseen formula:** A player who has made Mushroom Soup (5 + tin) and Fruit Wine (5 berries + tin) expects any new tinned food to be "about five of something plus a tin".

### 04 Tools / Non-Core Weapons (16)

Held items that wear with use. Cores are the main weapon system; these are tools and side arms.

**Rules**

1. Three tool tiers, same shape each time: Stone (wood + stone + rope, by hand), Iron (3 Iron + 2 wood + 1 leather, bench 1), Salvager (the Iron tool itself + 2 Refined Iron + a Pipe, bench 2).
2. An axe and a pick of one tier cost the same, except where the head differs: the Stone Pick takes one more stone, the Salvager Axe takes a Blade.
3. Every edged weapon above stone is priced in Blades: Cleaver 1, Reinforced Spear 1, Machete 3.
4. An upgrade consumes the thing it upgrades (Salvager tools consume the Iron tool), so progress is never two parallel grinds.
5. Weapons with no metal are made by hand and are disposable: Club, Fire-hardened Spear, Torch.

**Examples**

- Stone Axe 3 wood + 3 stone + 1 rope -> Iron Axe 3 Iron + 2 wood + 1 leather -> Salvager Axe = Iron Axe + Blade + 2 Refined Iron + Pipe.
- Cleaver 1 Iron + 1 Blade; Machete 4 Iron + 3 Blades.
- Arrow 6 per wood + stone + fiber; 8 per wood + stone + feather.

**Inferring an unseen formula:** Knowing the Iron Axe and the Salvager Axe, the Salvager Pick is predictable: the Iron Pick plus the same Refined Iron and Pipe, without the Blade.

### 05 Armour / Clothing / Carry (14)

Worn items. Five slots: head, body, back, legs, feet.

**Rules**

1. Soft gear is hide or fur tied with rope: Leather Jerkin, Fur Cloak.
2. An Iron Plate piece is Plate + 3 Hide + 3 Needle and Thread. Only the plate count changes with the area covered: boots 1, helmet 1, pants 2, chest 3 (chest also takes 4 hide).
3. A Refined Iron piece is Refined Iron + 5 Hide + 6 Needle and Thread: helmet, legs and boots 3 ingots; chest 5 ingots and 8 thread.
4. Hide is always the padding and Needle and Thread always the assembly. Metal is the only term that changes between the two sets.
5. Special protection names its special material: Filter Mask = glass lens + cloth filter + Parts; Chitin Plate = chitin + leather.

**Examples**

- Iron Plate Boots 1 Plate + 3 Hide + 3 Thread; Iron Plate Chest 3 Plate + 4 Hide + 3 Thread.
- Refined Iron Helmet 3 Refined + 5 Hide + 6 Thread; Refined Iron Chest 5 Refined + 5 Hide + 8 Thread.
- Trail Pack 2 Cloth + 2 Leather + 2 Thread + 2 Rope: sewn, so it carries Thread.

**Inferring an unseen formula:** A player with Iron Plate Helmet and Chest can guess the Pants (between them: 2 Plate) and the Boots (same as the helmet: 1 Plate).

### 06 Cores / Energies (17)

The SOH weapon system that replaces Last Island firearms. A Core is the weapon; Energy and Essence are its ammunition.

**Rules**

1. Every Core is Iron (housing) + Parts (mechanism) + Crystal (focus). That triple is the Core signature and appears nowhere else as a set.
2. Common Cores are the bare triple (2 Iron, 4 Parts, 1 Crystal). Rare Cores scale the triple and add the raw of their element: Sulfur for fire, Shell for water, Electronic Parts for lightning, Crawler Optic for spirit. The top Core doubles a rare one.
3. Energy is ammunition by tier: Basic from stone and fiber by hand; Refined from Crystal and Iron at a level-2 bench; a level-3 bench makes it in bulk with Charcoal.
4. An Essence is the element raw plus one binder, two per craft: Sulfur + Charcoal (fire), Bitterleaf + its seed (nature), Shell + Crystal (water), Crawler Optic + Crystal (spirit).
5. The four charge Cores (Ember, Quake, Storm, Rime) are an older single-element design: element raw + 8 to 10 Parts + Crystal, known only through study.

**Examples**

- Big Bang 2 Iron + 4 Parts + 1 Crystal -> Meteor 4 Iron + 8 Parts + 3 Crystal + 3 Sulfur -> Dragon's Breath 8 + 16 + 6 + 6.
- Elsa's Sword 3 Iron + 8 Parts + 4 Crystal + 3 Shell: water, so Shell.
- Refined Energy 1 Crystal + 1 Iron -> 4; bulk 2 + 2 + 2 Charcoal -> 12.

**Inferring an unseen formula:** Knowing Meteor (fire, Sulfur) and Elsa's Sword (water, Shell), a player who finds a lightning Core expects the triple plus an electrical raw, and Mjolnir is exactly that.

### 07 Home / Storage / Workstations (17)

Packed devices carried in the pack and placed in the world, where they become a structure with hit points.

**Rules**

1. A pack is paid for once, by hand, and placing it costs nothing more. Picking the structure up returns the same pack.
2. A pack costs what the thing is made of: wood and stone for the hearth tier (Campfire, Furnace, Workbench, Chest), iron when it holds weight, Parts when it has a mechanism.
3. A machine that moves fluid has Pipe; one that turns has a Gear; one that sees or decides has Electronic Parts.
4. A bigger version of a station repeats the smaller one's material and adds the next tier's: the Large Furnace doubles the Furnace stone and adds iron, Plate and a charcoal bed.

**Examples**

- Furnace 18 stone + 4 wood -> Large Furnace 36 stone + 8 Iron + 4 Plate + 4 Charcoal.
- Oil Pump 3 Iron + 1 Gear + 2 Pipe + 2 Parts; Oil Refinery 8 Iron + 8 wood + 2 Pipe + 5 Parts + 2 Glass.
- Wood Chest 8 wood -> Iron-bound Chest 12 wood + 2 Iron.

**Inferring an unseen formula:** Knowing the Oil Pump has a Gear (it pumps) and Pipe (it carries), the Refinery is readable: Pipe again, Glass for the still, no Gear because nothing turns.

### 08 Electricity / Defense (10)

Powered base devices and traps.

**Rules**

1. Anything that carries or switches current has Iron + Electronic Parts + Parts. A cable is the bare conductor: Iron + Fiber.
2. A sensor differs from a switch only in what triggers it: the Pressure Switch adds a Plate to stand on.
3. A mechanical trap has a Gear and no electronics: Bear Trap, Arrow Turret.
4. A wooden obstacle is wood only: Spikes, Barricade.
5. The Powered Door is a module fitted to a door already built, so it has a build cost and no pack.

**Examples**

- Power Switch 1 Iron + 2 Electronic Parts + 1 Parts; Infrared Sensor the same; Pressure Switch adds 1 Iron + 1 Plate.
- Bear Trap 1 Gear + 2 Iron; Arrow Turret 10 wood + 2 Iron + 1 Gear + 2 rope.
- Powered Door module 2 Iron + 2 Electronic Parts + 1 Gear + 2 Plate + 2 Resistor Wire.

**Inferring an unseen formula:** Knowing the Power Switch and the Bear Trap, the Powered Door is the sum: electronics to decide, a Gear to move the bolt, Plate for the leaf.

### 09 Mobility / Traversal (4)

Getting further, carrying more, crossing what blocks a walk.

**Rules**

1. A vehicle is a frame plus what moves it. The Hand Cart is wood, iron and rope. The Motorbike is a Utility Frame + Gears + Plates + Refined Iron at a level-3 bench.
2. A ladder is wood and rope. The steel one consumes the wooden one and adds Refined Iron and a Gear for the fold.

**Examples**

- Wooden Ladder 12 wood + 1 rope -> Steel Folding Ladder = Wooden Ladder + 6 Refined Iron + 1 Gear.
- Hand Cart 24 wood + 3 Iron + 4 rope.
- Motorbike = Frame + 2 Gears + 3 Plates + 4 Refined Iron.

**Inferring an unseen formula:** The Steel Ladder follows the Salvager-tool rule from family 04: the better item contains the lesser one plus refined metal and one component.

### 10 Farming / Husbandry (4)

Renewable food and animals.

**Rules**

1. A seed is never crafted: it comes from the plant.
2. Fodder is fiber plus a seed: bulk plus feed value.

**Examples**

- Fodder Bundle 3 fiber + 1 Wild Berry Seed -> 3.

**Inferring an unseen formula:** A seed in a bill (Fodder, Nature Essence) always competes with planting it.

### 11 Knowledge / Access / Unique (19)

Items whose value is what they unlock or prove. None is crafted.

**Rules**

1. A Blueprint is a recipe on paper. It is produced by research, not by a bench.
2. A specimen teaches one formula when studied and is consumed by the study.
3. An access card is a physical key with a finite number of scans. Crafting one would defeat the lock.
4. Elder stones, boss relics and Ragnarok Cash are earned once from a specific fight or from the run economy.

**Examples**

- Boar Tusk -> study -> Machete formula.
- Beetle Horn -> study -> Chitin Plate formula.

**Inferring an unseen formula:** If it proves something or opens something, it has no formula.

## 3. All 157 items

### 01 Raw / Scavenged

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Crude Petroleum | `crude_petroleum` | A | WORLD_ONLY | Oil drawn from a seep by an Oil Pump. The only feedstock of the Oil Refinery; finite per seep. | nothing → 1 | crude_oil / DIRECT |
| Wood | `wood` | A | WORLD_ONLY | The first material. Frames, handles, fuel and most early building. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | wood / DIRECT |
| Stone | `stone` | A | WORLD_ONLY | Mass and hardness: tool heads, hearths, furnaces, walls. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Plant Fiber | `fiber` | B | WORLD_ONLY | Plant fiber. Twisted into rope, woven into cloth, used raw for binding and bandages. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Iron Ore | `iron_ore` | A | WORLD_ONLY | The source of all metal. One ore smelts to one Iron Ingot. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | raw_iron_ore / DIRECT |
| Rich Iron Ore | `rich_iron_ore` | A | WORLD_ONLY | High-grade ore freed by an iron-class pick. Smelts straight to Refined Iron, skipping the ingot step. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | refined_iron_ore / DIRECT |
| Frost Crystal | `crystal` | B | WORLD_ONLY | The Core material: focus of every Core, base of Refined Energy, also one route to Glass. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Sulfur | `sulfur` | B | WORLD_ONLY | The fire element: Fire Essence and every fire Core. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Parts | `spares` | A | WORLD_ONLY | Parts (Last Island "Parts"). Fitted mechanical pieces from wrecks and scrap; in every machine and the currency of research. | NO_RECIPE_BY_DESIGN: a manufactured relic of the old world. The player can find it but not make it, which is what gates the technology that needs it. Parts must stay non-renewable: a formula for Parts would let research and every machine be paid in ore. | parts / DIRECT |
| Raw Hide | `hide` | A | WORLD_ONLY | Raw animal hide. Tanned to Leather, or used as the padding of metal armour. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | animal_hide / UNSUPPORTED_CITATION |
| Fur | `fur` | C | WORLD_ONLY | Thick pelt for cold gear (Fur Cloak). | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Ash Chitin | `chitin` | C | WORLD_ONLY | Insect plate for Chitin Plate armour. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Crab Shell | `shell` | C | WORLD_ONLY | Crab shell. Lime for coastal Glass and the water element for Essence and Elsa's Sword. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Mire Gland | `gland` | C | WORLD_ONLY | Mire creature gland: the active part of Purge Tonic. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |
| Animal Fat | `animal_fat` | A | WORLD_ONLY | Tallow. Rendered to low-grade fuel or used as the carrier in a Syringe. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | animal_fat / DIRECT |
| Tin Can | `tin_can` | A | WORLD_ONLY | An empty tin. The container that makes preserved food possible. | NO_RECIPE_BY_DESIGN: a manufactured relic of the old world. The player can find it but not make it, which is what gates the technology that needs it. | tin_can / DIRECT |
| Electronic Parts | `electronic_parts` | A | WORLD_ONLY | Salvaged circuits. Anything that senses, switches or generates needs them. | NO_RECIPE_BY_DESIGN: a manufactured relic of the old world. The player can find it but not make it, which is what gates the technology that needs it. | electronic_parts / DIRECT |
| Resistor Wire | `electric_resistor` | A | WORLD_ONLY | Resistor Wire. The lock coil of the Powered Door, and nothing else. | NO_RECIPE_BY_DESIGN: a manufactured relic of the old world. The player can find it but not make it, which is what gates the technology that needs it. | electric_resistor / DIRECT |
| Needle Tube | `needle_tube` | A | WORLD_ONLY | A sterile injector body. The scavenged half of a Syringe. | NO_RECIPE_BY_DESIGN: a manufactured relic of the old world. The player can find it but not make it, which is what gates the technology that needs it. | needle_tube / DIRECT |
| Grouse Feather | `feather` | C | WORLD_ONLY | Grouse feather. Fletching for the better arrow. | NO_RECIPE_BY_DESIGN: a raw material. It is harvested or dropped; making it from something else would hide where things come from. | — / NONE |

### 02 Processed Materials / Components

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Plank | `plank` | B | CRAFT_ONLY | Sawn timber for Plank Walls: the building upgrade between rough wood and stone. | 2 Wood → 1 | — / NONE |
| Charcoal | `charcoal` | A | CRAFT_ONLY | Wood burned to carbon. Station fuel, the carbon in Refined Iron, the binder of Fire Essence. | 2 Wood → 1 | charcoal / UNSUPPORTED_CITATION |
| Iron Ingot | `iron_ingot` | A | BOTH | Smelted iron. The plain metal body of tools, devices and components. | 1 Iron Ore → 1 | iron_ingot / DIRECT |
| Refined Iron Ingot | `refined_iron_ingot` | A | BOTH | Iron hardened with charcoal. The tier-2 metal: Pipe, Plate, the best tools and armour, vehicles. | 3 Iron Ingot + 2 Charcoal → 2<br>1 Rich Iron Ore + 2 Charcoal → 2 | refined_iron_ingot / DIRECT |
| Rope | `rope` | A | CRAFT_ONLY | Twisted fiber. Lashing for stone tools, bows, carts and ladders. | 3 Plant Fiber → 1 | rope / INDIRECT |
| Cloth | `cloth` | A | BOTH | Woven fiber. Filters, bags, and the thread half of Needle and Thread. | 6 Plant Fiber → 1 | cloth / DIRECT |
| Leather | `leather` | B | CRAFT_ONLY | Tanned hide. Grips, straps and soft armour. | 1 Raw Hide → 1 | — / NONE |
| Glass | `glass` | B | BOTH | Fused stone. Lenses, the refinery still, the canteen vessel and the fuel can. | 2 Stone + 2 Crab Shell → 1<br>1 Frost Crystal + 1 Stone → 1 | — / NONE |
| Metal Pipe | `metal_pipe` | A | BOTH | A tube. Carries fluid in oil machines and is the hollow handle or chassis member of heavy gear. | 2 Refined Iron Ingot + 2 Parts → 2 | metal_pipe / DIRECT |
| Metal Blade | `metal_blade` | A | BOTH | A cutting edge. The unit every edged weapon above stone is priced in. | 3 Iron Ingot + 1 Parts → 1 | metal_blade / DIRECT |
| Mechanical Gear | `mechanical_gear` | A | BOTH | A mechanism that turns. Pumps, traps, turrets, the bike, the folding ladder. | 2 Iron Ingot + 3 Parts → 1 | mechanical_gear / DIRECT |
| Iron Plate | `iron_plate` | A | BOTH | Sheet metal. Armour, the bike body, the Large Furnace shell, and a field patch for walls and doors. | 2 Refined Iron Ingot + 2 Parts → 2 | iron_plate / DIRECT |
| Needle and Thread | `needle_thread` | A | CRAFT_ONLY | A sewing kit. Marks an item as stitched: all plate armour and travel gear. | 2 Cloth + 1 Iron Ingot → 2 | needle_thread / LEGACY_CLAIM |
| Utility Frame | `vehicle_frame` | A | CRAFT_ONLY | The Utility Frame. Chassis of the Motorbike; has no other use. | 1 Metal Pipe + 4 Iron Ingot + 2 Refined Iron Ingot + 4 Parts → 1 | vehicle_frame / DIRECT |

### 03 Food / Medicine / Consumables

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Berries | `berries` | A | WORLD_ONLY | Forage. A little hunger and thirst; base of juice, wine and jam. | NO_RECIPE_BY_DESIGN: a raw food. It is foraged, hunted or grown, then cooked into something else. | wild_berry / INDIRECT |
| Raw Meat | `meat` | A | WORLD_ONLY | Raw meat. Unsafe raw; the base of roast, dried and canned meat and stew. | NO_RECIPE_BY_DESIGN: a raw food. It is foraged, hunted or grown, then cooked into something else. | animal_meat / INDIRECT |
| Marsh Cap | `mushroom` | A | WORLD_ONLY | Marsh Cap. Irradiating raw; safe grilled or in soup. | NO_RECIPE_BY_DESIGN: a raw food. It is foraged, hunted or grown, then cooked into something else. | mushroom / INDIRECT |
| Bitterleaf | `herb` | C | WORLD_ONLY | Bitterleaf. Medicine ingredient and the nature element; foraged or farmed. | NO_RECIPE_BY_DESIGN: a raw food. It is foraged, hunted or grown, then cooked into something else. | — / NONE |
| Sunroot | `crop` | C | WORLD_ONLY | Sunroot. The farmed staple; the bulk of Root Stew. | NO_RECIPE_BY_DESIGN: a raw food. It is foraged, hunted or grown, then cooked into something else. It is grown in a Garden Plot from Sunroot Seed. | — / NONE |
| Roast Meat | `cooked_meat` | A | CRAFT_ONLY | Roast Meat. The standard meal: the most hunger per cut. | 1 Raw Meat → 1 | — / NONE |
| Dried Meat | `dried_meat` | A | CRAFT_ONLY | Dried Meat. Less filling than a roast at half the weight: travel food. | 1 Raw Meat → 1 | dried_meat / DIRECT |
| Canned Meat | `canned_meat` | A | BOTH | Canned Meat. Three cuts in one slot: storage food, limited by tins. | 3 Raw Meat + 1 Tin Can → 1 | canned_meat / DIRECT |
| Grilled Mushroom | `grilled_mushroom` | A | CRAFT_ONLY | Grilled Mushroom. Removes the raw Marsh Cap penalty. | 1 Marsh Cap → 1 | grilled_mushroom / DIRECT |
| Mushroom Soup | `mushroom_soup` | A | CRAFT_ONLY | Mushroom Soup. A warm, filling bowl from five caps and a tin. | 5 Marsh Cap + 1 Tin Can → 1 | mushroom_soup / DIRECT |
| Fruit Juice | `fruit_juice` | A | CRAFT_ONLY | Fruit Juice. Thirst without a flask, squeezed by hand. | 3 Berries → 1 | fruit_juice / DIRECT |
| Fruit Wine | `fruit_wine` | A | CRAFT_ONLY | Fruit Wine. Portable warmth for cold country. | 5 Berries + 1 Tin Can → 1 | fruit_wine / DIRECT |
| Jam | `jam` | A | CRAFT_ONLY | Jam. Stamina food for hauling. | 10 Berries + 1 Cloth + 1 Tin Can → 1 | jam / DIRECT |
| Root Stew | `stew` | C | CRAFT_ONLY | Root Stew. The best meal; needs a farm (Sunroot) as well as a hunt. | 2 Sunroot + 1 Raw Meat + 1 Bitterleaf → 1 | — / NONE |
| Bandage | `bandage` | A | BOTH | Bandage. The first heal, made by hand from fiber. | 4 Plant Fiber → 1 | bandage / DIRECT |
| Field Medkit | `medkit` | A | BOTH | Field Medkit. A stronger heal from bandages and Bitterleaf. | 2 Bandage + 2 Bitterleaf → 1 | medkit / DIRECT |
| Syringe | `syringe` | A | BOTH | Syringe. An instant heal; needs a scavenged Needle Tube. | 1 Needle Tube + 2 Animal Fat + 1 Iron Ingot → 1 | syringe / DIRECT |
| Purge Tonic | `antirad` | B | BOTH | Purge Tonic. Clears radiation; needs a Mire Gland. | 1 Mire Gland + 2 Bitterleaf → 1 | — / NONE |
| Water Flask | `water_flask` | B | BOTH | Water Flask. The starting water container; refilled at fresh water. | 2 Raw Hide + 1 Rope → 1 | — / NONE |
| Trail Canteen | `trail_canteen` | B | CRAFT_ONLY | Trail Canteen. A larger sewn water container for long trips. | 2 Cloth + 1 Leather + 1 Glass + 1 Needle and Thread → 1 | — / NONE |
| Fuel Canister | `fuel_can` | A | BOTH | Fuel Canister. Burned by the Field Generator and the Motorbike. | 3 Crude Petroleum + 1 Glass → 1<br>5 Crude Petroleum + 1 Glass → 2<br>*alt* 6 Animal Fat + 1 Cloth → 1 | low_quality_fuel / DIRECT |
| Grouse Egg | `grouse_egg` | C | WORLD_ONLY | Grouse Egg. Food from wild or kept grouse. | NO_RECIPE_BY_DESIGN: a raw food. It is foraged, hunted or grown, then cooked into something else. | — / NONE |

### 04 Tools / Non-Core Weapons

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Survival Knife | `knife` | B | SPECIAL_AUTHORITY | Survival Knife. The starting tool: cuts plants fast, wood and stone slowly. Repaired at a Workbench. | NO_RECIPE_BY_DESIGN (starter issue): every run begins with one and a Workbench repairs it for 1 stone + 1 fiber. Known risk recorded in open questions: no tool-free way to get stone exists if every tool is broken away from a bench. | — / NONE |
| Stone Pickaxe | `stone_pick` | B | CRAFT_ONLY | Stone Pickaxe. First tool for stone and ore. | 3 Wood + 4 Stone + 1 Rope → 1 | — / NONE |
| Iron Pickaxe | `iron_pick` | B | BOTH | Iron Pickaxe. Faster on stone and ore; can free Rich Iron Ore. | 3 Iron Ingot + 2 Wood + 1 Leather → 1 | — / NONE |
| Salvager Pick | `industrial_pick` | B | CRAFT_ONLY | Salvager Pick. The top pick; an Iron Pick rebuilt with refined metal. | 1 Iron Pickaxe + 2 Refined Iron Ingot + 1 Metal Pipe → 1<br>*alt* 1 Iron Pickaxe + 1 Mechanical Gear + 2 Parts → 1 | — / NONE |
| Stone Axe | `stone_axe` | A | CRAFT_ONLY | Stone Axe. First tool for trees. | 3 Wood + 3 Stone + 1 Rope → 1 | — / NONE |
| Iron Axe | `iron_axe` | A | BOTH | Iron Axe. Faster on trees. | 3 Iron Ingot + 2 Wood + 1 Leather → 1 | iron_axe / DIRECT |
| Salvager Axe | `industrial_axe` | A | CRAFT_ONLY | Salvager Axe. The top axe; an Iron Axe rebuilt with a Blade and refined metal. | 1 Iron Axe + 1 Metal Blade + 2 Refined Iron Ingot + 1 Metal Pipe → 1 | refined_iron_axe / DIRECT |
| Torch | `torch` | A | CRAFT_ONLY | Torch. Light and a little warmth; also the flame of a Torch Post. | 1 Wood + 2 Plant Fiber → 1 | — / NONE |
| Wood Club | `wood_club` | A | CRAFT_ONLY | Wood Club. The first weapon upgrade, made by hand from a lot of wood. | 12 Wood → 1 | wood_club / DIRECT |
| Cleaver | `cleaver` | A | BOTH | Cleaver. A short, quick blade; the first use of a Metal Blade. | 1 Iron Ingot + 1 Metal Blade → 1 | cleaver / DIRECT |
| Machete | `machete` | A | BOTH | Machete. The iron long blade and the best crafted melee weapon. | 4 Iron Ingot + 3 Metal Blade → 1 | machete / DIRECT |
| Fire-hardened Spear | `wood_spear` | B | CRAFT_ONLY | Fire-hardened Spear. Reach without metal. | 4 Wood + 1 Rope → 1 | — / NONE |
| Reinforced Spear | `reinforced_spear` | B | CRAFT_ONLY | Reinforced Spear. Reach with a metal head. | 1 Metal Blade + 1 Iron Ingot + 2 Wood → 1 | — / NONE |
| Hunting Bow | `bow` | B | CRAFT_ONLY | Hunting Bow. Ranged hunting and the Arrow Turret's ammunition family. | 5 Wood + 3 Rope → 1 | — / NONE |
| Arrow | `arrow` | B | BOTH | Arrow. Ammunition for the bow and the Arrow Turret. | *alt* 1 Wood + 1 Stone + 1 Grouse Feather → 8<br>1 Wood + 1 Stone + 1 Plant Fiber → 6 | — / NONE |
| Taming Lead | `lead_rope` | C | CRAFT_ONLY | Taming Lead. Held in the pack to calm and lead a tamable animal into a pen. | 2 Rope + 2 Berries → 1 | — / NONE |

### 05 Armour / Clothing / Carry

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Leather Jerkin | `leather_armor` | B | BOTH | Leather Jerkin. First body armour, with some cold protection. | 5 Leather + 2 Rope → 1 | — / NONE |
| Scrap Helm | `scrap_helm` | B | CRAFT_ONLY | Scrap Helm. First head armour, hammered from iron. | 2 Iron Ingot + 1 Leather → 1 | — / NONE |
| Filter Mask | `gas_mask` | A | BOTH | Filter Mask. Lets the wearer breathe in toxic zones. | 1 Glass + 2 Cloth + 3 Parts → 1 | — / NONE |
| Fur Cloak | `fur_cloak` | C | CRAFT_ONLY | Fur Cloak. Back-slot cold protection. | 4 Fur + 2 Rope → 1 | — / NONE |
| Chitin Plate | `chitin_armor` | C | CRAFT_ONLY | Chitin Plate. Heavy body armour made from an insect; the creature-material alternative to metal. | 6 Ash Chitin + 2 Leather → 1 | — / NONE |
| Iron Plate Helmet | `iron_plate_helmet` | A | CRAFT_ONLY | Iron Plate Helmet. Mid-tier head armour. | 1 Iron Plate + 3 Raw Hide + 3 Needle and Thread → 1 | iron_plate_helmet / LEGACY_CLAIM |
| Iron Plate Chest | `iron_plate_chest` | A | CRAFT_ONLY | Iron Plate Chest. Mid-tier body armour. | 3 Iron Plate + 4 Raw Hide + 3 Needle and Thread → 1 | iron_plate_chest / LEGACY_CLAIM |
| Iron Plate Pants | `iron_plate_pants` | A | CRAFT_ONLY | Iron Plate Pants. Leg armour; reduces knock-back. | 2 Iron Plate + 3 Raw Hide + 3 Needle and Thread → 1 | iron_plate_pants / LEGACY_CLAIM |
| Iron Plate Boots | `iron_plate_boots` | A | CRAFT_ONLY | Iron Plate Boots. Foot armour; reduces ground-hazard damage. | 1 Iron Plate + 3 Raw Hide + 3 Needle and Thread → 1 | iron_plate_boots / LEGACY_CLAIM |
| Refined Iron Helmet | `refined_iron_helmet` | A | CRAFT_ONLY | Refined Iron Helmet. Top crafted head armour. | 3 Refined Iron Ingot + 5 Raw Hide + 6 Needle and Thread → 1 | refined_iron_helmet / LEGACY_CLAIM |
| Refined Iron Chest | `refined_iron_chest` | A | CRAFT_ONLY | Refined Iron Chest. Top crafted body armour. | 5 Refined Iron Ingot + 5 Raw Hide + 8 Needle and Thread → 1 | refined_iron_chest / LEGACY_CLAIM |
| Refined Iron Legs | `refined_iron_legs` | A | CRAFT_ONLY | Refined Iron Legs. Top crafted leg armour. | 3 Refined Iron Ingot + 5 Raw Hide + 6 Needle and Thread → 1 | refined_iron_legs / LEGACY_CLAIM |
| Refined Iron Boots | `refined_iron_boots` | A | CRAFT_ONLY | Refined Iron Boots. Top crafted foot armour. | 3 Refined Iron Ingot + 5 Raw Hide + 6 Needle and Thread → 1 | refined_iron_boots / LEGACY_CLAIM |
| Trail Pack | `trail_pack` | B | CRAFT_ONLY | Trail Pack. Back-slot carry bonus. | 2 Cloth + 2 Leather + 2 Needle and Thread + 2 Rope → 1 | — / NONE |

### 06 Cores / Energies

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Basic Energy | `energy_basic` | B | BOTH | Basic Energy. The common Core ammunition, made by hand. | 2 Stone + 2 Plant Fiber → 8 | — / NONE |
| Refined Energy | `energy_refined` | B | BOTH | Refined Energy. Stronger Core ammunition from Crystal and Iron. | 2 Frost Crystal + 2 Iron Ingot + 2 Charcoal → 12<br>1 Frost Crystal + 1 Iron Ingot → 4 | — / NONE |
| Fire Essence | `essence_fire` | B | CRAFT_ONLY | Fire Essence. Loads the strongest reserve of fire Cores. | 2 Sulfur + 1 Charcoal → 2 | — / NONE |
| Nature Essence | `essence_nature` | B | CRAFT_ONLY | Nature Essence. Loads the strongest reserve of nature Cores. | 2 Bitterleaf + 2 Bitterleaf Seed → 2 | — / NONE |
| Water Essence | `essence_water` | B | CRAFT_ONLY | Water Essence. Loads the strongest reserve of water Cores. | 2 Crab Shell + 1 Frost Crystal → 2 | — / NONE |
| Spirit Essence | `essence_spirit` | B | CRAFT_ONLY | Spirit Essence. Loads the strongest reserve of spirit Cores. | 1 Crawler Optic (specimen) + 1 Frost Crystal → 2 | — / NONE |
| Big Bang | `core_blast` | B | BOTH | Big Bang. The common fire Core: the first weapon. Crafted at a Workbench or found in approved world chests (G1B). | 2 Iron Ingot + 4 Parts + 1 Frost Crystal → 1 | — / NONE |
| Meteor | `core_meteor` | B | BOTH | Meteor. The rare fire Core. Crafted at a Workbench or found in approved world chests (G1B). | 4 Iron Ingot + 8 Parts + 3 Frost Crystal + 3 Sulfur → 1 | — / NONE |
| Dragon's Breath | `core_dragon` | B | BOTH | Dragon's Breath. The top fire Core. Crafted at a Workbench or found in approved world chests (G1B). | 8 Iron Ingot + 16 Parts + 6 Frost Crystal + 6 Sulfur → 1 | — / NONE |
| Elsa's Sword | `core_elsa` | B | BOTH | Elsa's Sword. The rare water Core. Crafted at a Workbench or found in approved world chests (G1B). | 3 Iron Ingot + 8 Parts + 4 Frost Crystal + 3 Crab Shell → 1 | — / NONE |
| Earth Mother's Breath | `core_earthmother` | B | BOTH | Earth Mother's Breath. The common nature Core. Crafted at a Workbench or found in approved world chests (G1B). | 2 Iron Ingot + 4 Parts + 1 Frost Crystal → 1 | — / NONE |
| Mjolnir | `core_mjolnir` | B | BOTH | Mjolnir. The rare lightning Core (nature essence). Crafted at a Workbench or found in approved world chests (G1B). | 4 Iron Ingot + 9 Parts + 4 Frost Crystal + 2 Electronic Parts → 1 | — / NONE |
| Demon Core | `core_demon` | B | BOTH | Demon Core. The rare spirit Core. Crafted at a Workbench or found in approved world chests (G1B). | 4 Iron Ingot + 12 Parts + 5 Frost Crystal + 2 Crawler Optic (specimen) → 1 | — / NONE |
| Ember Core | `core_fire` | B | CRAFT_ONLY | Ember Core. Older single-element charge Core (fire). | 3 Sulfur + 8 Parts + 1 Frost Crystal → 1 | — / NONE |
| Quake Core | `core_earth` | B | CRAFT_ONLY | Quake Core. Older single-element charge Core (earth). | 3 Iron Ingot + 8 Parts + 1 Frost Crystal → 1 | — / NONE |
| Storm Core | `core_storm` | B | CRAFT_ONLY | Storm Core. Older single-element charge Core (storm). | 2 Glass + 10 Parts + 1 Frost Crystal → 1 | — / NONE |
| Rime Core | `core_frost` | B | CRAFT_ONLY | Rime Core. Older single-element charge Core (frost). | 3 Frost Crystal + 8 Parts → 1 | — / NONE |

### 07 Home / Storage / Workstations

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Territory Cabinet | `deploy_claim` | B | CRAFT_ONLY | Territory Cabinet. Claims land so a base can be built and upkept. | 10 Wood + 5 Stone → 1 | territory_cabinet / INDIRECT |
| Straw Bed | `deploy_bed_straw` | A | CRAFT_ONLY | Straw Bed. Rest and a respawn point. | 10 Plant Fiber + 2 Wood → 1 | — / NONE |
| Wood Chest | `deploy_chest_small` | A | CRAFT_ONLY | Wood Chest. 12 slots of storage. | 8 Wood → 1 | — / NONE |
| Iron-bound Chest | `deploy_chest_large` | A | CRAFT_ONLY | Iron-bound Chest. 24 slots of storage. | 12 Wood + 2 Iron Ingot → 1 | — / NONE |
| Campfire | `deploy_campfire` | A | CRAFT_ONLY | Campfire. Cooking, charcoal, warmth and light. | 5 Wood + 3 Stone → 1 | — / NONE |
| Furnace | `deploy_furnace` | A | CRAFT_ONLY | Furnace. Smelts ore, refines iron, fuses glass. | 18 Stone + 4 Wood → 1 | — / NONE |
| Workbench | `deploy_workbench` | A | CRAFT_ONLY | Workbench. Where tools, components, armour and Cores are made; upgrades to level 3. | 14 Wood + 4 Stone → 1 | — / NONE |
| Research Table | `deploy_research` | B | CRAFT_ONLY | Research Table. Turns Parts into formulas. | 10 Wood + 6 Parts + 1 Iron Ingot → 1 | drawing_bench / DIRECT |
| Oil Refinery | `deploy_refinery` | A | CRAFT_ONLY | Oil Refinery. Turns Crude Petroleum into Fuel Canisters. | 8 Iron Ingot + 8 Wood + 2 Metal Pipe + 5 Parts + 2 Glass → 1 | oil_refinery / DIRECT |
| Oil Pump | `deploy_oil_pump` | A | CRAFT_ONLY | Oil Pump. Draws Crude Petroleum from a seep. | 3 Iron Ingot + 1 Mechanical Gear + 2 Metal Pipe + 2 Parts → 1 | — / NONE |
| Garden Plot | `deploy_garden` | C | CRAFT_ONLY | Garden Plot. Grows seeds into crops. | 4 Wood + 4 Plant Fiber → 1 | — / NONE |
| Garden Tender | `deploy_farm_controller` | C | CRAFT_ONLY | Garden Tender. Automates planting, watering and harvest on power. | 12 Wood + 2 Iron Ingot + 1 Mechanical Gear + 2 Electronic Parts + 2 Parts → 1 | — / NONE |
| Rain Barrel | `deploy_barrel` | C | CRAFT_ONLY | Rain Barrel. Collects water for the garden and troughs. | 8 Wood + 1 Rope → 1 | — / NONE |
| Feed & Water Trough | `deploy_feed_trough` | C | CRAFT_ONLY | Feed and Water Trough. Keeps tamed animals fed. | 6 Wood + 2 Stone + 1 Rope → 1 | — / NONE |
| Torch Post | `deploy_torch_post` | B | CRAFT_ONLY | Torch Post. Fixed light. | 2 Wood + 1 Torch → 1 | — / NONE |
| Large Furnace | `large_furnace` | A | CRAFT_ONLY | Large Furnace. Runs every Furnace formula at twice the pace on the same fire. | 36 Stone + 8 Iron Ingot + 4 Iron Plate + 4 Charcoal → 1 | large_furnace / INDIRECT |
| Escrow Chest | `escrow_chest` | C | SPECIAL_AUTHORITY | Escrow Chest. Bought with Ragnarok Cash and placed on claimed land; cash deposited in it is secured to the profile. | NO_RECIPE_BY_DESIGN: sold by the run vendor for Ragnarok Cash. It is an economy instrument, and a bench formula would bypass the cash sink. | — / NONE |

### 08 Electricity / Defense

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Field Generator | `deploy_base_generator` | A | CRAFT_ONLY | Field Generator. Burns Fuel Canisters to power the base. | 4 Iron Ingot + 2 Refined Iron Ingot + 2 Electronic Parts + 4 Parts → 1 | fuel_generator / DIRECT |
| Power Cable | `deploy_power_cable` | A | CRAFT_ONLY | Power Cable. Carries power between devices. | 1 Iron Ingot + 1 Plant Fiber → 1 | — / NONE |
| Power Switch | `deploy_power_switch` | A | CRAFT_ONLY | Power Switch. Opens or closes a circuit by hand. | 1 Iron Ingot + 2 Electronic Parts + 1 Parts → 1 | switch / DIRECT |
| Pressure Switch | `deploy_pressure_switch` | A | CRAFT_ONLY | Pressure Switch. Closes a circuit when stepped on. | 2 Iron Ingot + 1 Parts + 2 Electronic Parts + 1 Iron Plate → 1 | pressure_switch / DIRECT |
| Infrared Sensor | `deploy_ir_sensor` | A | CRAFT_ONLY | Infrared Sensor. Closes a circuit when something moves in front of it. | 1 Iron Ingot + 2 Electronic Parts + 1 Parts → 1 | infrared_switch / DIRECT |
| Arrow Turret | `deploy_arrow_turret` | B | CRAFT_ONLY | Arrow Turret. Automated defence that spends Arrows. | 10 Wood + 2 Iron Ingot + 1 Mechanical Gear + 2 Rope → 1 | auto_rifle_turret / LEGACY_CLAIM |
| Bear Trap | `deploy_bear_trap` | A | CRAFT_ONLY | Bear Trap. Holds and hurts what steps in it; re-armed with a Plate. | 1 Mechanical Gear + 2 Iron Ingot → 1 | bear_trap / DIRECT |
| Spike Trap | `deploy_spikes` | A | CRAFT_ONLY | Spike Trap. Cheap passive damage. | 6 Wood → 1 | wood_spikes / DIRECT |
| Barricade | `deploy_barricade` | A | CRAFT_ONLY | Barricade. A cheap wall segment that blocks a path. | 8 Wood → 1 | — / NONE |
| Powered Door | `door_powered` | B | CRAFT_ONLY | Powered Door. A lock module fitted into a door the player already built; opens on power. | Build cost: 2 Iron Ingot + 2 Electronic Parts + 1 Mechanical Gear + 2 Iron Plate + 2 Resistor Wire. NO PACK BY DESIGN: it is a module, not a packed device. Its bill is a build cost (STRUCTS.door_powered) paid when fitted to a Wood or Iron Door. | electric_door / DIRECT |

### 09 Mobility / Traversal

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Hand Cart (packed) | `cart_kit` | C | BOTH | Hand Cart. Hauls more than the pack on foot. | 24 Wood + 3 Iron Ingot + 4 Rope → 1 | — / NONE |
| Utility Motorbike (packed) | `motorbike_kit` | A | CRAFT_ONLY | Utility Motorbike. Fast freight on fuel; the end of the vehicle chain. | 1 Utility Frame + 2 Mechanical Gear + 3 Iron Plate + 4 Refined Iron Ingot → 1 | motorcycle / DIRECT |
| Wooden Ladder | `wooden_ladder` | A | CRAFT_ONLY | Wooden Ladder. A foot crossing over a cliff one tile thick. | 12 Wood + 1 Rope → 1 | wooden_ladder / DIRECT |
| Steel Folding Ladder | `steel_folding_ladder` | A | CRAFT_ONLY | Steel Folding Ladder. Crosses a cliff up to three tiles thick. | 6 Refined Iron Ingot + 1 Wooden Ladder + 1 Mechanical Gear → 1 | steel_folding_ladder / DIRECT |

### 10 Farming / Husbandry

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Sunroot Seed | `seed_sunroot` | C | WORLD_ONLY | Sunroot Seed. Grows Sunroot. | NO_RECIPE_BY_DESIGN: a seed comes from the plant (harvest or forage), never from a bench. | — / NONE |
| Bitterleaf Seed | `seed_bitterleaf` | C | WORLD_ONLY | Bitterleaf Seed. Grows Bitterleaf; also the binder of Nature Essence. | NO_RECIPE_BY_DESIGN: a seed comes from the plant (harvest or forage), never from a bench. | — / NONE |
| Wild Berry Seed | `seed_wildberry` | C | WORLD_ONLY | Wild Berry Seed. Grows berries; also the feed value in Fodder. | NO_RECIPE_BY_DESIGN: a seed comes from the plant (harvest or forage), never from a bench. | — / NONE |
| Fodder Bundle | `animal_feed` | C | CRAFT_ONLY | Fodder Bundle. Fills a trough to keep animals. | 3 Plant Fiber + 1 Wild Berry Seed → 3 | — / NONE |

### 11 Knowledge / Access / Unique

| Item | id | Grp | Policy | Purpose | How it is made, or why it is not | LI id / grade |
|---|---|---|---|---|---|---|
| Blueprint | `blueprint` | A | SPECIAL_AUTHORITY | Blueprint. One formula on paper; reading it teaches the formula. | NO_RECIPE_BY_DESIGN: produced by the Research Table (a paid study job), never by a bench formula. | — / NONE |
| Green Card | `green_card` | A | WORLD_ONLY | Green Card. Opens green-class doors; finite scans. | NO_RECIPE_BY_DESIGN: a physical access key with finite scans. A craftable key is not a lock. Its source is next-phase work. | green_card / INDIRECT |
| Blue Card | `blue_card` | A | WORLD_ONLY | Blue Card. Opens blue-class doors; finite scans. | NO_RECIPE_BY_DESIGN: a physical access key with finite scans. A craftable key is not a lock. Its source is next-phase work. | blue_card / INDIRECT |
| Purple Card | `purple_card` | A | WORLD_ONLY | Purple Card. Opens purple-class doors; finite scans. | NO_RECIPE_BY_DESIGN: a physical access key with finite scans. A craftable key is not a lock. Its source is next-phase work. | purple_card / INDIRECT |
| Wolf Fang (specimen) | `wolf_fang` | C | WORLD_ONLY | Wolf Fang. Study it to learn the Fur Cloak. | NO_RECIPE_BY_DESIGN: a specimen. It is taken from one creature and consumed by study to teach one formula. | — / NONE |
| Crawler Optic (specimen) | `crawler_optic` | C | WORLD_ONLY | Crawler Optic. Study it to learn the Filter Mask; also the spirit element in Spirit Essence and the Demon Core. | NO_RECIPE_BY_DESIGN: a specimen. It is taken from one creature and consumed by study to teach one formula. | — / NONE |
| Boar Tusk (specimen) | `boar_tusk` | C | WORLD_ONLY | Boar Tusk. Study it to learn the Machete. | NO_RECIPE_BY_DESIGN: a specimen. It is taken from one creature and consumed by study to teach one formula. | — / NONE |
| Beetle Horn (specimen) | `beetle_horn` | C | WORLD_ONLY | Beetle Horn. Study it to learn the Chitin Plate. | NO_RECIPE_BY_DESIGN: a specimen. It is taken from one creature and consumed by study to teach one formula. | — / NONE |
| Ragnarok Cash | `rcash` | C | SPECIAL_AUTHORITY | Ragnarok Cash. Physical run currency: buys the Escrow Chest, and is secured to the profile by depositing it there. | NO_RECIPE_BY_DESIGN: currency. Minting it at a bench would break the economy. | — / NONE |
| Stone of Surtur | `stone_surtur` | C | SPECIAL_AUTHORITY | Stone of Surtur. Proof of the Elder Surtur. | NO_RECIPE_BY_DESIGN: an Elder stone. One per Primordial Elder, earned by that fight. | — / NONE |
| Stone of Typhon | `stone_typhon` | C | SPECIAL_AUTHORITY | Stone of Typhon. Proof of the Elder Typhon. | NO_RECIPE_BY_DESIGN: an Elder stone. One per Primordial Elder, earned by that fight. | — / NONE |
| Stone of Aion | `stone_aion` | C | SPECIAL_AUTHORITY | Stone of Aion. Proof of the Elder Aion. | NO_RECIPE_BY_DESIGN: an Elder stone. One per Primordial Elder, earned by that fight. | — / NONE |
| Stone of Atlas | `stone_atlas` | C | SPECIAL_AUTHORITY | Stone of Atlas. Proof of the Elder Atlas. | NO_RECIPE_BY_DESIGN: an Elder stone. One per Primordial Elder, earned by that fight. | — / NONE |
| Stone of Argus | `stone_argus` | C | SPECIAL_AUTHORITY | Stone of Argus. Proof of the Elder Argus. | NO_RECIPE_BY_DESIGN: an Elder stone. One per Primordial Elder, earned by that fight. | — / NONE |
| Stone of Anubis | `stone_anubis` | C | SPECIAL_AUTHORITY | Stone of Anubis. Proof of the Elder Anubis. | NO_RECIPE_BY_DESIGN: an Elder stone. One per Primordial Elder, earned by that fight. | — / NONE |
| Shaleheart Coreplate | `relic_shaleheart` | C | SPECIAL_AUTHORITY | Shaleheart Coreplate. Body armour taken from the side boss Greyback Shaleheart. | NO_RECIPE_BY_DESIGN: a side-boss trophy. Unique equipment earned once; a formula would make it ordinary. | — / NONE |
| Oathless Nodachi | `ronin_nodachi` | C | SPECIAL_AUTHORITY | Oathless Nodachi. Side-boss long blade. | NO_RECIPE_BY_DESIGN: a side-boss trophy. Unique equipment earned once; a formula would make it ordinary. | — / NONE |
| Saltwick Trident | `tidemarshal_trident` | C | SPECIAL_AUTHORITY | Saltwick Trident. Side-boss polearm. | NO_RECIPE_BY_DESIGN: a side-boss trophy. Unique equipment earned once; a formula would make it ordinary. | — / NONE |
| Archive Lantern | `custodian_lantern` | C | SPECIAL_AUTHORITY | Archive Lantern. Side-boss light source. | NO_RECIPE_BY_DESIGN: a side-boss trophy. Unique equipment earned once; a formula would make it ordinary. | — / NONE |

## 4. Every formula

Unit cost divides the bill by the yield. Knowledge: Starter = known from the first minute; directed research = tier below 3, can be studied on purpose for Parts.

### 01 Raw / Scavenged

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `pump_crude` | 1 Crude Petroleum | nothing | — | Oil Pump | 1 / Starter | 12 s | SOH_ONLY (NONE) | — | KEEP | Extraction job, no inputs: one Crude per cycle out of finite seep stock. Not a craft. |

### 02 Processed Materials / Components

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `vehicle_frame` | 1 Utility Frame | 1 Metal Pipe + 4 Iron Ingot + 2 Refined Iron Ingot + 4 Parts | — | Workbench L2 | 1 / Starter | 22 s | SOH_ONLY (NONE) | — | KEEP | A Pipe skeleton with iron, refined iron and Parts fittings. Starter-known so the bike chain is visible from the start. |
| `metal_pipe` | 2 Metal Pipe | 2 Refined Iron Ingot + 2 Parts | 1 Refined Iron Ingot + 1 Parts | Workbench L2 | 2 / Starter | 18 s | LI_SCALED (DIRECT) | 5 Refined Iron Ingot + 30 parts | KEEP | Component rule: Refined Iron + Parts, yields 2. One pipe = 1 Refined Iron + 1 Part. |
| `metal_blade` | 1 Metal Blade | 3 Iron Ingot + 1 Parts | — | Workbench L2 | 2 / Starter | 16 s | LI_SCALED (DIRECT) | 30 Iron Ingot + 15 parts | REVISE (rev 6) | Component rule: plain Iron + Parts. Revision 6 cut Iron 4 -> 3 so a Blade costs less than a Gear, as it does in Last Island (30 + 15 against 50 + 65). Still above its 2-ingot recycle return. |
| `mechanical_gear` | 1 Mechanical Gear | 2 Iron Ingot + 3 Parts | — | Workbench L2 | 2 / Starter | 20 s | LI_SCALED (DIRECT) | 50 Iron Ingot + 65 parts | KEEP | Component rule: plain Iron + Parts. The Parts-heaviest component, as in Last Island. |
| `iron_plate` | 2 Iron Plate | 2 Refined Iron Ingot + 2 Parts | 1 Refined Iron Ingot + 1 Parts | Workbench L2 | 2 / Starter | 18 s | LI_SCALED (DIRECT) | 5 Refined Iron Ingot + 30 parts | KEEP | Component rule: same bill as the Pipe, yields 2. Sheet instead of tube. |
| `needle_thread` | 2 Needle and Thread | 2 Cloth + 1 Iron Ingot | 1 Cloth + 0.5 Iron Ingot | Workbench L1 | 1 / directed research | 10 s | LI_SCALED (LEGACY_CLAIM) | 10 Cloth + 5 Iron Ingot | KEEP | Cloth is the thread, Iron the needle. Yields 2 so a three-thread armour piece is two crafts. |
| `rope` | 1 Rope | 3 Plant Fiber | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (INDIRECT) | 10 nettle | KEEP | First-step rule, by hand: 3 fiber. |
| `charcoal` | 1 Charcoal | 2 Wood | — | Campfire | 0 / Starter | 12 s | SOH_ONLY (NONE) | — | KEEP | First-step rule: one raw, one station. Two wood make one charcoal, so charcoal is always dearer than the wood it replaces as fuel. |
| `iron_ingot` | 1 Iron Ingot | 1 Iron Ore | — | Furnace | 0 / Starter | 10 s | SOH_ONLY (NONE) | — | KEEP | First-step rule, 1:1. Ore count equals ingot count, so every iron bill reads directly as mining. |
| `refined_iron_ingot` | 2 Refined Iron Ingot | 3 Iron Ingot + 2 Charcoal | 1.5 Iron Ingot + 1 Charcoal | Furnace | 1 / Starter | 20 s | SOH_ADJUSTED (DIRECT) | — | KEEP | Iron + carbon. 1.5 Iron and 1 Charcoal per ingot: refining costs a burn, not more ore. |
| `refined_iron_rich` | 2 Refined Iron Ingot | 1 Rich Iron Ore + 2 Charcoal | 0.5 Rich Iron Ore + 1 Charcoal | Furnace | 1 / Starter | 14 s | SOH_ONLY (NONE) | — | KEEP | Alternative with a real trade: one Rich Ore replaces three ingots and is 6 s faster, but Rich Ore only comes from an iron-class pick. |
| `shell_glass` | 1 Glass | 2 Stone + 2 Crab Shell | — | Furnace | 1 / Starter | 16 s | SOH_ONLY (NONE) | — | KEEP | Alternative with a real trade: Shell as lime instead of Crystal. Coastal route, starter-known, slower and takes two of each. |
| `glass` | 1 Glass | 1 Frost Crystal + 1 Stone | — | Furnace | 2 / directed research | 14 s | SOH_ONLY (NONE) | — | KEEP | Stone fused with Crystal. Inland route; competes with Cores for Crystal. Learned by study. |
| `leather` | 1 Leather | 1 Raw Hide | — | Workbench L1 | 0 / Starter | 8 s | SOH_ONLY (NONE) | — | KEEP | First-step rule, 1:1 at the bench. |
| `cloth` | 1 Cloth | 6 Plant Fiber | — | Workbench L1 | 0 / Starter | 8 s | SOH_ONLY (NONE) | — | KEEP | First-step rule at the bench: 6 fiber. Twice a rope, so sewn goods are visibly dearer than lashed ones. |
| `plank` | 1 Plank | 2 Wood | — | Workbench L1 | 1 / Starter | 6 s | SOH_ONLY (NONE) | — | KEEP | First-step rule. One consumer (Plank Wall); kept because the building tier between wood and stone needs its own material. |

### 03 Food / Medicine / Consumables

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `refinery_fuel` | 1 Fuel Canister | 3 Crude Petroleum + 1 Glass | — | Oil Refinery | 1 / Starter | 14 s | SOH_ONLY (NONE) | — | KEEP | Oil route, small batch: 3 Crude + 1 Glass -> 1. |
| `refinery_fuel_batch` | 2 Fuel Canister | 5 Crude Petroleum + 1 Glass | 2.5 Crude Petroleum + 0.5 Glass | Oil Refinery | 1 / Starter | 22 s | SOH_ONLY (NONE) | — | KEEP | Oil route, bulk: 5 Crude + 1 Glass -> 2. Cheaper per can; the trade is needing five Crude and two free output slots at once. Owned by the oil workstream (#59); recorded, not changed. |
| `trail_canteen` | 1 Trail Canteen | 2 Cloth + 1 Leather + 1 Glass + 1 Needle and Thread | — | Workbench L2 | 2 / directed research | 20 s | SOH_ONLY (NONE) | — | KEEP | Sewn rule (Thread) + a glass vessel, made at a level-2 bench. |
| `syringe` | 1 Syringe | 1 Needle Tube + 2 Animal Fat + 1 Iron Ingot | — | Workbench L2 | 2 / directed research | 14 s | SOH_ADJUSTED (DIRECT) | 1 Needle Tube + 10 low_quality_fuel + 10 Iron Ingot | KEEP | Scavenged injector + fat carrier + an iron needle. Level-2 bench: the top heal needs the top bench. |
| `low_quality_fuel` | 1 Fuel Canister | 6 Animal Fat + 1 Cloth | — | Furnace | 1 / directed research | 24 s | SOH_ADJUSTED (DIRECT) | 3 Animal Fat + 1 Cloth | KEEP | Alternative with a real trade: fuel without oil. 6 Fat + 1 Cloth at a Furnace, slow, and it competes with Syringes for fat. |
| `dried_meat` | 1 Dried Meat | 1 Raw Meat | — | Campfire | 0 / Starter | 20 s | LI_EXACT (DIRECT) | 1 animal_meat | KEEP | Fire rule, 1:1, 20 s. Same input as a roast; the trade is weight for hunger and time. |
| `grilled_mushroom` | 1 Grilled Mushroom | 1 Marsh Cap | — | Campfire | 0 / Starter | 6 s | LI_EXACT (DIRECT) | 1 Marsh Cap | KEEP | Fire rule, 1:1. Removes the raw penalty. |
| `mushroom_soup` | 1 Mushroom Soup | 5 Marsh Cap + 1 Tin Can | — | Campfire | 0 / Starter | 14 s | LI_EXACT (DIRECT) | 5 Marsh Cap + 1 Tin Can | KEEP | Tin rule: five of a raw + a tin. Last Island numbers. |
| `canned_meat` | 1 Canned Meat | 3 Raw Meat + 1 Tin Can | — | Campfire | 0 / Starter | 18 s | SOH_ADJUSTED (DIRECT) | 10 animal_meat + 1 Tin Can | KEEP | Tin rule, three cuts. Last Island asks ten; SOH animals drop two, so ten would never be made. |
| `fruit_juice` | 1 Fruit Juice | 3 Berries | — | Hand | 0 / Starter | 2 s | LI_EXACT (DIRECT) | 3 wild_berry | KEEP | By hand, no container: drink it now. Last Island numbers. |
| `fruit_wine` | 1 Fruit Wine | 5 Berries + 1 Tin Can | — | Campfire | 0 / Starter | 30 s | LI_EXACT (DIRECT) | 5 wild_berry + 1 Tin Can | KEEP | Tin rule: five berries + a tin, long fire. Last Island numbers. |
| `jam` | 1 Jam | 10 Berries + 1 Cloth + 1 Tin Can | — | Campfire | 0 / Starter | 20 s | LI_SCALED (DIRECT) | 10 wild_berry + 5 Cloth + 1 Tin Can | KEEP | Tin rule with a cloth strainer: ten berries. The dearest berry food, for the stamina effect. |
| `bandage` | 1 Bandage | 4 Plant Fiber | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 5 Cloth | KEEP | By hand: 4 fiber. The same fiber that makes rope, so healing competes with tools early. |
| `water_flask` | 1 Water Flask | 2 Raw Hide + 1 Rope | — | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | Hide + rope by hand, so a lost flask can always be replaced. |
| `cooked_meat` | 1 Roast Meat | 1 Raw Meat | — | Campfire | 0 / Starter | 8 s | SOH_ONLY (NONE) | — | KEEP | Fire rule, 1:1, 8 s. The baseline meal. |
| `stew` | 1 Root Stew | 2 Sunroot + 1 Raw Meat + 1 Bitterleaf | — | Campfire | 1 / directed research | 14 s | SOH_ONLY (NONE) | — | KEEP | The only food that needs a farm, a hunt and a herb. Learned by study. |
| `medkit` | 1 Field Medkit | 2 Bandage + 2 Bitterleaf | — | Workbench L1 | 1 / directed research | 8 s | SOH_ADJUSTED (DIRECT) | 2 Syringe + 50 low_quality_fuel + 100 Wood + 2 Iron Ingot | KEEP | Two bandages + two Bitterleaf: the previous tier plus a medicine. |
| `antirad` | 1 Purge Tonic | 1 Mire Gland + 2 Bitterleaf | — | Workbench L1 | 2 / directed research | 10 s | SOH_ONLY (NONE) | — | KEEP | Gland + Bitterleaf: the creature of the hazard supplies the cure. |

### 04 Tools / Non-Core Weapons

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `industrial_pick` | 1 Salvager Pick | 1 Iron Pickaxe + 2 Refined Iron Ingot + 1 Metal Pipe | — | Workbench L2 | 2 / directed research | 25 s | SOH_ONLY (NONE) | — | KEEP | Salvager rule: the Iron Pick itself + 2 Refined Iron + Pipe handle. Learned by study. |
| `industrial_axe` | 1 Salvager Axe | 1 Iron Axe + 1 Metal Blade + 2 Refined Iron Ingot + 1 Metal Pipe | — | Workbench L2 | 2 / directed research | 25 s | SOH_ONLY (NONE) | — | KEEP | Salvager rule: the Iron Axe itself + 2 Refined Iron + Pipe handle, and a Blade because it cuts. |
| `reinforced_spear` | 1 Reinforced Spear | 1 Metal Blade + 1 Iron Ingot + 2 Wood | — | Workbench L2 | 2 / Starter | 16 s | SOH_ONLY (NONE) | — | REVISE (rev 6) | Blade rule: one Blade + Iron socket + shaft. Revision 6 folded the starter-known alias into this id (was 2 Iron, 20 s, study-only; now 1 Iron, 16 s, starter-known). |
| `industrial_pick_geared` | 1 Salvager Pick | 1 Iron Pickaxe + 1 Mechanical Gear + 2 Parts | — | Workbench L2 | 2 / Starter | 25 s | SOH_ONLY (NONE) | — | KEEP | Alternative with a real trade: a Gear and 2 Parts instead of refined metal and a Pipe. No furnace work, but 5 Parts in total. Starter-known. |
| `wood_club` | 1 Wood Club | 12 Wood | — | Hand | 0 / Starter | 3 s | LI_SCALED (DIRECT) | 300 Wood | KEEP | By hand, wood only. Last Island 300 wood at the bulk divisor. |
| `cleaver` | 1 Cleaver | 1 Iron Ingot + 1 Metal Blade | — | Workbench L1 | 1 / directed research | 14 s | LI_SCALED (DIRECT) | 15 Iron Ingot + 1 Metal Blade | KEEP | Blade rule: one Blade + one Iron. Level-1 bench on purpose: a found Blade becomes a weapon before the player can forge one (forging needs level 2). |
| `machete` | 1 Machete | 4 Iron Ingot + 3 Metal Blade | — | Workbench L2 | 2 / specimen / study the item / directed research | 22 s | LI_SCALED (DIRECT) | 100 Iron Ingot + 3 Metal Blade | KEEP | Blade rule: three Blades + 4 Iron. Last Island shape (100 iron + 3 blades). |
| `lead_rope` | 1 Taming Lead | 2 Rope + 2 Berries | — | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | Two ropes and berries as bait, by hand. |
| `arrow_fletched` | 8 Arrow | 1 Wood + 1 Stone + 1 Grouse Feather | 0.125 Wood + 0.125 Stone + 0.125 Grouse Feather | Workbench L1 | 1 / Starter | 4 s | SOH_ONLY (NONE) | — | KEEP | Alternative with a real trade: a Feather instead of fiber gives 8, but feathers come only from grouse. |
| `torch` | 1 Torch | 1 Wood + 2 Plant Fiber | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | By hand: wood + fiber wick. |
| `stone_axe` | 1 Stone Axe | 3 Wood + 3 Stone + 1 Rope | — | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | Stone-tier rule: wood handle, stone head, rope lashing, by hand. |
| `stone_pick` | 1 Stone Pickaxe | 3 Wood + 4 Stone + 1 Rope | — | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | Stone-tier rule. One more stone than the axe: a pick head is heavier. |
| `wood_spear` | 1 Fire-hardened Spear | 4 Wood + 1 Rope | — | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | By hand: shaft + lashing. |
| `arrow` | 6 Arrow | 1 Wood + 1 Stone + 1 Plant Fiber | 0.167 Wood + 0.167 Stone + 0.167 Plant Fiber | Workbench L1 | 1 / Starter | 5 s | SOH_ONLY (NONE) | — | REVISE | Wood shaft, stone head, fiber binding: 6. Revision 6 made it starter-known; the better fletched arrow already was. Bill unchanged. |
| `bow` | 1 Hunting Bow | 5 Wood + 3 Rope | — | Workbench L1 | 1 / study the item / directed research | 12 s | SOH_ONLY (NONE) | — | KEEP | Wood stave + rope string. Learned by study. |
| `iron_axe` | 1 Iron Axe | 3 Iron Ingot + 2 Wood + 1 Leather | — | Workbench L1 | 1 / Starter | 15 s | SOH_ADJUSTED (DIRECT) | 75 Iron Ingot + 100 Wood | KEEP | Iron-tier rule: 3 Iron head, 2 wood handle, 1 leather grip. |
| `iron_pick` | 1 Iron Pickaxe | 3 Iron Ingot + 2 Wood + 1 Leather | — | Workbench L1 | 1 / Starter | 15 s | SOH_ONLY (NONE) | — | KEEP | Iron-tier rule, identical to the axe. |

### 05 Armour / Clothing / Carry

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `trail_pack` | 1 Trail Pack | 2 Cloth + 2 Leather + 2 Needle and Thread + 2 Rope | — | Workbench L2 | 2 / directed research | 22 s | SOH_ONLY (NONE) | — | KEEP | Sewn rule: cloth body, leather straps, Thread, rope ties. |
| `iron_plate_helmet` | 1 Iron Plate Helmet | 1 Iron Plate + 3 Raw Hide + 3 Needle and Thread | — | Workbench L2 | 2 / directed research | 24 s | LI_SCALED (LEGACY_CLAIM) | 1 Iron Plate + 30 animal_hide + 3 Needle and Thread | KEEP | Plate-armour rule: 1 Plate + 3 Hide + 3 Thread. |
| `iron_plate_chest` | 1 Iron Plate Chest | 3 Iron Plate + 4 Raw Hide + 3 Needle and Thread | — | Workbench L2 | 2 / directed research | 30 s | LI_SCALED (LEGACY_CLAIM) | 3 Iron Plate + 40 animal_hide + 3 Needle and Thread | KEEP | Plate-armour rule: 3 Plate; the largest piece also takes a fourth hide. |
| `refined_iron_helmet` | 1 Refined Iron Helmet | 3 Refined Iron Ingot + 5 Raw Hide + 6 Needle and Thread | — | Workbench L2 | 2 / directed research | 30 s | LI_SCALED (LEGACY_CLAIM) | 50 animal_hide + 6 Needle and Thread + 15 Refined Iron Ingot | REVISE | Refined-armour rule: 3 Refined + 5 Hide + 6 Thread. Revision 6: research tier 3 -> 2 so it can be studied directly. Bill unchanged. |
| `refined_iron_chest` | 1 Refined Iron Chest | 5 Refined Iron Ingot + 5 Raw Hide + 8 Needle and Thread | — | Workbench L2 | 2 / directed research | 38 s | LI_SCALED (LEGACY_CLAIM) | 50 animal_hide + 8 Needle and Thread + 25 Refined Iron Ingot | REVISE | Refined-armour rule: 5 Refined + 5 Hide + 8 Thread. Revision 6: research tier 3 -> 2. Bill unchanged. |
| `iron_plate_pants` | 1 Iron Plate Pants | 2 Iron Plate + 3 Raw Hide + 3 Needle and Thread | — | Workbench L2 | 2 / directed research | 26 s | LI_SCALED (LEGACY_CLAIM) | 2 Iron Plate + 30 animal_hide + 3 Needle and Thread | KEEP | Plate-armour rule: 2 Plate. |
| `iron_plate_boots` | 1 Iron Plate Boots | 1 Iron Plate + 3 Raw Hide + 3 Needle and Thread | — | Workbench L2 | 2 / directed research | 22 s | LI_SCALED (LEGACY_CLAIM) | 1 Iron Plate + 30 animal_hide + 3 Needle and Thread | KEEP | Plate-armour rule: 1 Plate. |
| `refined_iron_legs` | 1 Refined Iron Legs | 3 Refined Iron Ingot + 5 Raw Hide + 6 Needle and Thread | — | Workbench L2 | 2 / directed research | 32 s | LI_SCALED (LEGACY_CLAIM) | 50 animal_hide + 6 Needle and Thread + 15 Refined Iron Ingot | REVISE | Refined-armour rule: 3 Refined + 5 Hide + 6 Thread. Revision 6: research tier 3 -> 2. Bill unchanged. |
| `refined_iron_boots` | 1 Refined Iron Boots | 3 Refined Iron Ingot + 5 Raw Hide + 6 Needle and Thread | — | Workbench L2 | 2 / directed research | 28 s | LI_SCALED (LEGACY_CLAIM) | 50 animal_hide + 6 Needle and Thread + 15 Refined Iron Ingot | REVISE | Refined-armour rule: 3 Refined + 5 Hide + 6 Thread. Revision 6: research tier 3 -> 2. Bill unchanged. |
| `leather_armor` | 1 Leather Jerkin | 5 Leather + 2 Rope | — | Workbench L1 | 1 / directed research | 15 s | SOH_ONLY (NONE) | — | KEEP | Soft-gear rule: leather + rope. |
| `chitin_armor` | 1 Chitin Plate | 6 Ash Chitin + 2 Leather | — | Workbench L1 | 3 / specimen / random research / blueprint | 20 s | SOH_ONLY (NONE) | — | KEEP | Chitin plates on a leather shell. Taught by the Beetle Horn, which is why it stays tier 3: the specimen is the access. |
| `fur_cloak` | 1 Fur Cloak | 4 Fur + 2 Rope | — | Workbench L1 | 2 / specimen / directed research | 14 s | SOH_ONLY (NONE) | — | KEEP | Soft-gear rule: fur + rope. Taught by the Wolf Fang. |
| `gas_mask` | 1 Filter Mask | 1 Glass + 2 Cloth + 3 Parts | — | Workbench L1 | 2 / specimen / directed research | 16 s | SOH_ONLY (NONE) | — | KEEP | Glass lens, cloth filter, Parts fittings. Taught by the Crawler Optic. |
| `scrap_helm` | 1 Scrap Helm | 2 Iron Ingot + 1 Leather | — | Workbench L1 | 1 / directed research | 12 s | SOH_ONLY (NONE) | — | KEEP | Hammered iron + a leather liner at a level-1 bench: head armour before Plate exists. |

### 06 Cores / Energies

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `energy_basic` | 8 Basic Energy | 2 Stone + 2 Plant Fiber | 0.25 Stone + 0.25 Plant Fiber | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | By hand from the two commonest raws, 8 per craft: the first Core can always be fed. |
| `energy_refined_industrial` | 12 Refined Energy | 2 Frost Crystal + 2 Iron Ingot + 2 Charcoal | 0.167 Frost Crystal + 0.167 Iron Ingot + 0.167 Charcoal | Workbench L3 | 2 / Starter | 40 s | SOH_ONLY (NONE) | — | KEEP | Alternative with a real trade: a level-3 bench and Charcoal buy 12 for double the Crystal and Iron (a third less Crystal per unit). |
| `energy_refined` | 4 Refined Energy | 1 Frost Crystal + 1 Iron Ingot | 0.25 Frost Crystal + 0.25 Iron Ingot | Workbench L2 | 2 / Starter | 16 s | SOH_ONLY (NONE) | — | KEEP | Crystal + Iron -> 4 at a level-2 bench. |
| `essence_fire` | 2 Fire Essence | 2 Sulfur + 1 Charcoal | 1 Sulfur + 0.5 Charcoal | Workbench L2 | 2 / Starter | 16 s | SOH_ONLY (NONE) | — | KEEP | Essence rule: element raw (Sulfur) + binder (Charcoal) -> 2. |
| `essence_nature` | 2 Nature Essence | 2 Bitterleaf + 2 Bitterleaf Seed | 1 Bitterleaf + 1 Bitterleaf Seed | Workbench L2 | 2 / Starter | 16 s | SOH_ONLY (NONE) | — | KEEP | Essence rule: Bitterleaf + its seed -> 2. Competes with planting. |
| `essence_water` | 2 Water Essence | 2 Crab Shell + 1 Frost Crystal | 1 Crab Shell + 0.5 Frost Crystal | Workbench L2 | 2 / Starter | 16 s | SOH_ONLY (NONE) | — | KEEP | Essence rule: Shell + Crystal -> 2. |
| `essence_spirit` | 2 Spirit Essence | 1 Crawler Optic (specimen) + 1 Frost Crystal | 0.5 Crawler Optic (specimen) + 0.5 Frost Crystal | Workbench L2 | 2 / Starter | 16 s | SOH_ONLY (NONE) | — | KEEP | Essence rule: Crawler Optic + Crystal -> 2. The specimen is also its own element. |
| `core_blast` | 1 Big Bang | 2 Iron Ingot + 4 Parts + 1 Frost Crystal | — | Workbench L1 | 1 / Starter | 30 s | SOH_ONLY (NONE) | — | KEEP | The bare Core triple: 2 Iron, 4 Parts, 1 Crystal. Starter-known. |
| `core_earthmother` | 1 Earth Mother's Breath | 2 Iron Ingot + 4 Parts + 1 Frost Crystal | — | Workbench L1 | 1 / Starter | 30 s | SOH_ONLY (NONE) | — | KEEP | The bare Core triple, identical to Big Bang: the two common Cores cost the same so the first choice is about play style. |
| `core_mjolnir` | 1 Mjolnir | 4 Iron Ingot + 9 Parts + 4 Frost Crystal + 2 Electronic Parts | — | Workbench L2 | 2 / core study / directed research | 50 s | SOH_ONLY (NONE) | — | KEEP | Rare-Core rule: the triple scaled + 2 Electronic Parts for lightning. |
| `core_demon` | 1 Demon Core | 4 Iron Ingot + 12 Parts + 5 Frost Crystal + 2 Crawler Optic (specimen) | — | Workbench L2 | 2 / core study / directed research | 55 s | SOH_ONLY (NONE) | — | KEEP | Rare-Core rule: the triple scaled + 2 Crawler Optics for spirit. The dearest rare Core. |
| `core_meteor` | 1 Meteor | 4 Iron Ingot + 8 Parts + 3 Frost Crystal + 3 Sulfur | — | Workbench L2 | 2 / core study / directed research | 45 s | SOH_ONLY (NONE) | — | KEEP | Rare-Core rule: the triple scaled (4, 8, 3) + 3 Sulfur for fire. |
| `core_dragon` | 1 Dragon's Breath | 8 Iron Ingot + 16 Parts + 6 Frost Crystal + 6 Sulfur | — | Workbench L3 | 3 / core study / random research / blueprint | 75 s | SOH_ONLY (NONE) | — | KEEP | Top-Core rule: Meteor doubled (8, 16, 6, 6) at a level-3 bench. |
| `core_elsa` | 1 Elsa's Sword | 3 Iron Ingot + 8 Parts + 4 Frost Crystal + 3 Crab Shell | — | Workbench L2 | 2 / core study / directed research | 45 s | SOH_ONLY (NONE) | — | KEEP | Rare-Core rule: the triple scaled + 3 Shell for water. |
| `core_fire` | 1 Ember Core | 3 Sulfur + 8 Parts + 1 Frost Crystal | — | Workbench L1 | 3 / core study / random research / blueprint | 40 s | SOH_ONLY (NONE) | — | KEEP | Charge-Core rule: element raw (Sulfur) + 8 Parts + Crystal. Level-1 bench, knowledge by study only: the insight is the gate, not the machine. |
| `core_earth` | 1 Quake Core | 3 Iron Ingot + 8 Parts + 1 Frost Crystal | — | Workbench L1 | 3 / core study / random research / blueprint | 40 s | SOH_ONLY (NONE) | — | KEEP | Charge-Core rule: Iron as the earth element + 8 Parts + Crystal. |
| `core_storm` | 1 Storm Core | 2 Glass + 10 Parts + 1 Frost Crystal | — | Workbench L1 | 3 / core study / random research / blueprint | 40 s | SOH_ONLY (NONE) | — | KEEP | Charge-Core rule: Glass as the storm element + 10 Parts + Crystal. |
| `core_frost` | 1 Rime Core | 3 Frost Crystal + 8 Parts | — | Workbench L1 | 3 / core study / random research / blueprint | 40 s | SOH_ONLY (NONE) | — | KEEP | Charge-Core rule: three Crystal (frost is the Crystal itself) + 8 Parts. |

### 07 Home / Storage / Workstations

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `large_furnace` | 1 Large Furnace | 36 Stone + 8 Iron Ingot + 4 Iron Plate + 4 Charcoal | — | Workbench L2 | 2 / directed research | 40 s | SOH_ADJUSTED (INDIRECT) | — | KEEP | Bigger-station rule: Furnace stone doubled + 8 Iron + 4 Plate shell + charcoal bed. 59.2 kg of inputs against a 60 kg carry limit is intended: it is a base project that needs storage beside the bench. |
| `deploy_claim` | 1 Territory Cabinet | 10 Wood + 5 Stone | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (INDIRECT) | 1000 Wood | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood cabinet on a stone footing. |
| `deploy_bed_straw` | 1 Straw Bed | 10 Plant Fiber + 2 Wood | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Fiber bedding on a wood frame. |
| `deploy_chest_small` | 1 Wood Chest | 8 Wood | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood only. |
| `deploy_chest_large` | 1 Iron-bound Chest | 12 Wood + 2 Iron Ingot | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. More wood, iron bands: iron when it holds weight. |
| `deploy_campfire` | 1 Campfire | 5 Wood + 3 Stone | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood on a stone ring. |
| `deploy_furnace` | 1 Furnace | 18 Stone + 4 Wood | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Stone body, wood to fire it. |
| `deploy_oil_pump` | 1 Oil Pump | 3 Iron Ingot + 1 Mechanical Gear + 2 Metal Pipe + 2 Parts | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Iron body, a Gear because it pumps, Pipe because it carries. Owned by the oil workstream (#59); recorded, not changed. |
| `deploy_refinery` | 1 Oil Refinery | 8 Iron Ingot + 8 Wood + 2 Metal Pipe + 5 Parts + 2 Glass | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 500 Iron Ingot + 200 Wood + 250 low_quality_fuel | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Iron vessel, wood frame, Pipe for flow, Parts, Glass for the still. Owned by the oil workstream (#59); recorded, not changed. |
| `deploy_workbench` | 1 Workbench | 14 Wood + 4 Stone | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood top, stone anvil. |
| `deploy_research` | 1 Research Table | 10 Wood + 6 Parts + 1 Iron Ingot | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 200 Iron Ingot + 75 parts | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood desk, Parts to study, an iron tool. |
| `deploy_garden` | 1 Garden Plot | 4 Wood + 4 Plant Fiber | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood border, fiber mulch. |
| `deploy_farm_controller` | 1 Garden Tender | 12 Wood + 2 Iron Ingot + 1 Mechanical Gear + 2 Electronic Parts + 2 Parts | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood housing, a Gear to move, Electronic Parts to decide. |
| `deploy_barrel` | 1 Rain Barrel | 8 Wood + 1 Rope | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood staves, rope hoop. |
| `deploy_feed_trough` | 1 Feed & Water Trough | 6 Wood + 2 Stone + 1 Rope | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood trough, stone base, rope tie. |
| `deploy_torch_post` | 1 Torch Post | 2 Wood + 1 Torch | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. A post and a Torch. |

### 08 Electricity / Defense

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `deploy_base_generator` | 1 Field Generator | 4 Iron Ingot + 2 Refined Iron Ingot + 2 Electronic Parts + 4 Parts | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 20 Refined Iron Ingot + 100 Iron Ingot + 30 Electronic Parts + 100 parts | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Iron and Refined Iron body, Electronic Parts to generate, Parts fittings. Owned by the building workstream (#56); recorded, not changed. |
| `deploy_power_cable` | 1 Power Cable | 1 Iron Ingot + 1 Plant Fiber | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Iron conductor, fiber wrap. |
| `deploy_power_switch` | 1 Power Switch | 1 Iron Ingot + 2 Electronic Parts + 1 Parts | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 10 Iron Ingot + 2 Electronic Parts + 10 parts | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Electrical rule: Iron + Electronic Parts + Parts. |
| `deploy_pressure_switch` | 1 Pressure Switch | 2 Iron Ingot + 1 Parts + 2 Electronic Parts + 1 Iron Plate | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 50 Iron Ingot + 15 parts + 10 Electronic Parts + 2 Iron Plate | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Electrical rule + a Plate to stand on. |
| `deploy_ir_sensor` | 1 Infrared Sensor | 1 Iron Ingot + 2 Electronic Parts + 1 Parts | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 30 Iron Ingot + 10 Electronic Parts + 15 parts | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Electrical rule, same bill as the switch: only the trigger differs. |
| `deploy_arrow_turret` | 1 Arrow Turret | 10 Wood + 2 Iron Ingot + 1 Mechanical Gear + 2 Rope | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (LEGACY_CLAIM) | 10 Electronic Parts + 50 Iron Ingot + 1 semi_auto_rifle | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood frame, iron fittings, a Gear to aim, rope to draw. |
| `deploy_bear_trap` | 1 Bear Trap | 1 Mechanical Gear + 2 Iron Ingot | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 50 Iron Ingot + 1 Mechanical Gear | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. A Gear for the spring jaw and iron teeth. |
| `deploy_spikes` | 1 Spike Trap | 6 Wood | — | Hand | 0 / Starter | 1 s | SOH_ADJUSTED (DIRECT) | 300 Wood | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood only. |
| `deploy_barricade` | 1 Barricade | 8 Wood | — | Hand | 0 / Starter | 1 s | SOH_ONLY (NONE) | — | KEEP | Pack rule: the bill is the structure cost, paid once by hand; placing the pack costs nothing more. Wood only. |

### 09 Mobility / Traversal

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `motorbike_kit` | 1 Utility Motorbike (packed) | 1 Utility Frame + 2 Mechanical Gear + 3 Iron Plate + 4 Refined Iron Ingot | — | Workbench L3 | 2 / directed research | 40 s | SOH_ADJUSTED (DIRECT) | 200 Refined Iron Ingot + 1 Utility Frame + 30 Mechanical Gear + 30 Iron Plate | KEEP | Frame + 2 Gears (drive) + 3 Plates (body) + 4 Refined Iron at a level-3 bench. Last Island shape, SOH counts. |
| `wooden_ladder` | 1 Wooden Ladder | 12 Wood + 1 Rope | — | Workbench L1 | 1 / directed research | 14 s | LI_SCALED (DIRECT) | 300 Wood + 3 Rope | KEEP | Wood rails and rungs, rope lashing. Last Island 300 wood + 3 rope at the bulk divisor. |
| `steel_folding_ladder` | 1 Steel Folding Ladder | 6 Refined Iron Ingot + 1 Wooden Ladder + 1 Mechanical Gear | — | Workbench L2 | 2 / directed research | 30 s | LI_SCALED (DIRECT) | 30 Refined Iron Ingot + 1 Wooden Ladder + 3 Mechanical Gear | KEEP | Upgrade rule: consumes the Wooden Ladder, adds Refined Iron and a Gear for the fold. Research tier 2 so it can be studied directly. |
| `cart_kit` | 1 Hand Cart (packed) | 24 Wood + 3 Iron Ingot + 4 Rope | — | Workbench L1 | 1 / directed research | 25 s | SOH_ONLY (NONE) | — | KEEP | A wooden bed, iron axle, rope harness. Level-1 bench: hauling comes before metalwork. |

### 10 Farming / Husbandry

| Formula | Makes | Bill | Per unit | Station | Tier / knowledge | Time | Provenance (LI grade) | LI figure | Decision | Why it has this shape |
|---|---|---|---|---|---|---|---|---|---|---|
| `animal_feed` | 3 Fodder Bundle | 3 Plant Fiber + 1 Wild Berry Seed | 1 Plant Fiber + 0.333 Wild Berry Seed | Hand | 0 / Starter | 2 s | SOH_ONLY (NONE) | — | KEEP | Fiber bulk + one seed -> 3. |

### Retired at this revision

- `reinforced_spear_blade` → successor `reinforced_spear`. Frozen as `reinforced_spear_blade@5` (1 Metal Blade + 1 Iron Ingot + 2 Wood). Retired at revision 6. It made the same spear for less iron, in less time, with no study, so the main formula was never worth using. Its bill is now the one spear formula. Old jobs finish under reinforced_spear_blade@5.

## 5. Costs that are not formulas

- **Powered Door module:** 2 Iron Ingot + 2 Electronic Parts + 1 Mechanical Gear + 2 Iron Plate + 2 Resistor Wire. Build cost, fitted to a Wood or Iron Door. No pack item.
- **Workbench level 1 -> 2** (`workbench_level_2`): 2 Iron Ingot + 4 Parts.
- **Workbench level 2 -> 3** (`workbench_level_3`): 2 Mechanical Gear + 2 Iron Plate + 8 Iron Ingot + 12 Parts.
- **Capability upgrade at a level-2 bench** (`industrial_module`): 2 Mechanical Gear + 6 Parts + 3 Iron Ingot.
- **Furnace upgrade at a level-2 bench** (`furnace_lining`): 6 Stone + 1 Iron Plate.
- **Field Generator capacity upgrade** (`generator_capacity`): 2 Electronic Parts + 1 Mechanical Gear + 3 Iron Ingot + 4 Parts.
- **Hand Cart freight upgrade** (`cart_freight`): 2 Iron Plate + 3 Iron Ingot + 3 Parts.
- **Garden Plot cold frame** (`garden_frame`): 4 Wood + 4 Plant Fiber + 1 Glass + 1 Bitterleaf.
- **Research:** random study 4 Parts, 25 s; directed study 9 Parts, 45 s (knowledge tier < 3); specimen study 30 s and consumes the specimen.
- **Specimen study** (consumes the specimen): Wolf Fang (specimen) → Fur Cloak; Crawler Optic (specimen) → Filter Mask; Boar Tusk (specimen) → Machete; Beetle Horn (specimen) → Chitin Plate.
- **Studying the item itself** teaches its own formula: Hunting Bow, Machete.
- **Core study** (taking a Core apart teaches its formula): Ember Core, Quake Core, Storm Core, Rime Core, Meteor, Dragon's Breath, Elsa's Sword, Mjolnir, Demon Core.
- **Item repair at a station:** Wood Club = 3 Wood; Cleaver = 1 Iron Ingot; Machete = 1 Iron Ingot + 1 Metal Blade; Survival Knife = 1 Stone + 1 Plant Fiber; Stone Axe = 1 Stone + 1 Wood; Stone Pickaxe = 1 Stone + 1 Wood; Iron Axe = 1 Iron Ingot + 1 Wood; Iron Pickaxe = 1 Iron Ingot + 1 Wood; Salvager Pick = 1 Refined Iron Ingot + 1 Parts; Salvager Axe = 1 Refined Iron Ingot + 1 Parts; Hunting Bow = 1 Wood + 2 Plant Fiber; Reinforced Spear = 1 Iron Ingot + 1 Wood; Oathless Nodachi = 1 Refined Iron Ingot + 1 Leather; Saltwick Trident = 2 Iron Ingot + 2 Crab Shell; Archive Lantern = 1 Glass + 1 Parts; Territory Cabinet = 3 Wood + 2 Stone; Straw Bed = 3 Plant Fiber + 1 Wood; Wood Chest = 2 Wood; Iron-bound Chest = 3 Wood + 1 Iron Ingot; Campfire = 2 Wood + 1 Stone; Furnace = 5 Stone + 1 Wood; Oil Pump = 1 Iron Ingot + 1 Mechanical Gear + 1 Metal Pipe + 1 Parts; Oil Refinery = 2 Iron Ingot + 2 Wood + 1 Metal Pipe + 2 Parts + 1 Glass; Workbench = 4 Wood + 1 Stone; Research Table = 3 Wood + 2 Parts + 1 Iron Ingot; Garden Plot = 1 Wood + 1 Plant Fiber; Garden Tender = 3 Wood + 1 Iron Ingot + 1 Mechanical Gear + 1 Electronic Parts + 1 Parts; Rain Barrel = 2 Wood + 1 Rope; Feed & Water Trough = 2 Wood + 1 Stone + 1 Rope; Field Generator = 1 Iron Ingot + 1 Refined Iron Ingot + 1 Electronic Parts + 1 Parts; Power Cable = 1 Iron Ingot + 1 Plant Fiber; Power Switch = 1 Iron Ingot + 1 Electronic Parts + 1 Parts; Pressure Switch = 1 Iron Ingot + 1 Parts + 1 Electronic Parts + 1 Iron Plate; Infrared Sensor = 1 Iron Ingot + 1 Electronic Parts + 1 Parts; Arrow Turret = 3 Wood + 1 Iron Ingot + 1 Mechanical Gear + 1 Rope; Bear Trap = 1 Mechanical Gear + 1 Iron Ingot; Spike Trap = 2 Wood; Barricade = 2 Wood; Torch Post = 1 Wood + 1 Torch.
- **Vendor, paid in Parts** (price / quantity / stock): Iron Ore 3/2/5; Charcoal 3/3/4; Glass 4/1/3; Crude Petroleum 5/1/4.
- **Vendor, paid in Ragnarok Cash** (price / stock): Iron Pickaxe 12/1; Iron Axe 12/1; Field Medkit 4/4; Hand Cart (packed) 20/1; Leather Jerkin 10/1; Water Flask 3/2.
- **Recycler (latest rule per component):** Metal Pipe → 1 Refined Iron Ingot; Mechanical Gear → 2 Parts + 1 Iron Ingot; Metal Blade → 2 Iron Ingot; Iron Plate → 1 Iron Ingot.

| Item | System | What consumes or uses it | Code anchor |
|---|---|---|---|
| Parts | Research | Random study and directed study are paid in Parts (BAL.research). | `engine.ts research()` |
| Parts | Vehicle repair | A Motorbike repair costs 3 Parts. | `engine.ts vehicle repair intent` |
| Parts | Vendor | The trader sells Iron Ore, Charcoal, Glass and Crude Petroleum for Parts. | `catalog.ts VENDOR_SPARES` |
| Fuel Canister | Power and vehicles | One can fuels a generator or refills the Motorbike. Stations never burn it. | `engine.ts vehicle.refuel, generator fuel intent` |
| Wood | Station fuel | Station fuel (stationBurnable). | `catalog.ts stationBurnable` |
| Charcoal | Station fuel | Station fuel (stationBurnable). | `catalog.ts stationBurnable` |
| Arrow | Ammunition | One arrow is spent per bow shot; the Arrow Turret fires arrows from its own container. | `sim.ts (ranged release), engine.ts turret` |
| Basic Energy | Core reserves | Primary reserve of every Core (capacity 40). | `creator-contract.ts` |
| Refined Energy | Core reserves | Technique reserve of every Core (capacity 12). | `creator-contract.ts` |
| Fire Essence | Core reserves | With Refined Energy, loads the Signature reserve of fire Cores (capacity 4). | `creator-contract.ts` |
| Nature Essence | Core reserves | With Refined Energy, loads the Signature reserve of nature Cores. | `creator-contract.ts` |
| Water Essence | Core reserves | With Refined Energy, loads the Signature reserve of water Cores. | `creator-contract.ts` |
| Spirit Essence | Core reserves | With Refined Energy, loads the Signature reserve of spirit Cores. | `creator-contract.ts` |
| Sunroot Seed | Garden | Planted in a Garden Plot; grows Sunroot. | `catalog.ts GARDEN_CROPS` |
| Bitterleaf Seed | Garden | Planted; grows Bitterleaf. | `catalog.ts GARDEN_CROPS` |
| Wild Berry Seed | Garden | Planted; grows berries. | `catalog.ts GARDEN_CROPS` |
| Fodder Bundle | Husbandry | Stocked in the Feed and Water Trough. | `engine.ts trough container` |
| Taming Lead | Husbandry | Must be in the pack to lead livestock; it is not spent. | `engine.ts husbandry follow intent` |
| Grouse Egg | Husbandry | Produced by kept female grouse on a cycle; eaten. | `husbandry.ts` |
| Iron Plate | Field patch | One plate patches a structure for up to 25% of its hit points; one plate re-arms a Bear Trap. | `engine.ts structure.repair.plate, BAL.bearTrapV1.armCost` |
| Blueprint | Knowledge | Read to learn its formula; produced by Research Table jobs. | `engine.ts learn.blueprint` |
| Wolf Fang (specimen) | Specimen study | Consumed at a Research Table to teach Fur Cloak. | `catalog.ts ITEMS.specimen` |
| Crawler Optic (specimen) | Specimen study | Consumed to teach Filter Mask. | `catalog.ts ITEMS.specimen` |
| Boar Tusk (specimen) | Specimen study | Consumed to teach Machete. | `catalog.ts ITEMS.specimen` |
| Beetle Horn (specimen) | Specimen study | Consumed to teach Chitin Plate. | `catalog.ts ITEMS.specimen` |
| Green Card | Access | Scanned at a card-locked door; a card carries a fixed number of uses (BAL.poiAccess.cardUses). | `final-item-set.ts cardItemForClass` |
| Blue Card | Access | As the Green Card, for blue-class doors. | `final-item-set.ts cardItemForClass` |
| Purple Card | Access | As the Green Card, for purple-class doors. | `final-item-set.ts cardItemForClass` |
| Ragnarok Cash | Run economy | Pays for the Escrow Chest at the trader; deposited at an Escrow Chest it becomes profile-secured cash. | `engine.ts buy, cash deposit intent` |
| Escrow Chest | Run economy | Placed on claimed land; receives Ragnarok Cash deposits. | `catalog.ts STRUCTS.escrow` |
| Water Flask | Thirst | Holds drinks as charges; refilled at fresh water or a Rain Barrel. | `catalog.ts ITEMS.water_flask` |
| Trail Canteen | Thirst | As the flask. | `catalog.ts ITEMS.trail_canteen` |
| Torch | Light and heat | Held for light and warmth. | `catalog.ts ITEMS.torch, thermal.ts` |
| Stone of Surtur | Primordial Elders | Claimed from its Elder; the record of that fight. | `catalog.ts PRIMORDIAL_ELDERS` |
| Stone of Typhon | Primordial Elders | Claimed from its Elder; the record of that fight. | `catalog.ts PRIMORDIAL_ELDERS` |
| Stone of Aion | Primordial Elders | Claimed from its Elder; the record of that fight. | `catalog.ts PRIMORDIAL_ELDERS` |
| Stone of Atlas | Primordial Elders | Claimed from its Elder; the record of that fight. | `catalog.ts PRIMORDIAL_ELDERS` |
| Stone of Argus | Primordial Elders | Claimed from its Elder; the record of that fight. | `catalog.ts PRIMORDIAL_ELDERS` |
| Stone of Anubis | Primordial Elders | Claimed from its Elder; the record of that fight. | `catalog.ts PRIMORDIAL_ELDERS` |
| Shaleheart Coreplate | Side bosses | Unique drop of one side boss; equipped and used like any gear. | `catalog.ts CREATURES.boss_*.uniqueDrop` |
| Oathless Nodachi | Side bosses | Unique drop of one side boss; equipped and used like any gear. | `catalog.ts CREATURES.boss_*.uniqueDrop` |
| Saltwick Trident | Side bosses | Unique drop of one side boss; equipped and used like any gear. | `catalog.ts CREATURES.boss_*.uniqueDrop` |
| Archive Lantern | Side bosses | Unique drop of one side boss; equipped and used like any gear. | `catalog.ts CREATURES.boss_*.uniqueDrop` |
| Survival Knife | Starting kit | Issued at the start of a run; the baseline tool. | `catalog.ts ITEMS.knife` |

## 6. Cross-family graph audit

### Ten most reused ingredients

| # | Ingredient | Formulas | Packs | Other costs | Total |
|---|---|---|---|---|---|
| 1 | Iron Ingot | 24 | 12 | 6 | 42 |
| 2 | Wood | 15 | 17 | 1 | 33 |
| 3 | Parts | 18 | 8 | 5 | 31 |
| 4 | Frost Crystal | 16 | 0 | 0 | 16 |
| 5 | Rope | 11 | 3 | 0 | 14 |
| 6 | Stone | 8 | 5 | 1 | 14 |
| 7 | Refined Iron Ingot | 11 | 1 | 0 | 12 |
| 8 | Plant Fiber | 7 | 3 | 1 | 11 |
| 9 | Iron Plate | 6 | 1 | 4 | 11 |
| 10 | Mechanical Gear | 3 | 4 | 4 | 11 |

### Bridge materials (used by formulas in four or more families)

- Iron Ingot: families 02, 03, 04, 05, 06, 07, 08, 09
- Wood: families 02, 04, 07, 08, 09
- Parts: families 02, 04, 05, 06, 07, 08
- Rope: families 03, 04, 05, 07, 08, 09
- Stone: families 02, 04, 06, 07
- Refined Iron Ingot: families 02, 04, 05, 08, 09
- Plant Fiber: families 02, 03, 04, 06, 07, 08, 10
- Iron Plate: families 05, 07, 08, 09
- Mechanical Gear: families 04, 07, 08, 09
- Glass: families 03, 05, 06, 07

### Reachability, ignoring map placement

Start set = every item without a formula, treated as obtainable; map placement ignored. Result: bench level 3 reached; 107 craftable items reached; formulas that cannot be reached: none.

### Bench-level gates hidden inside a bill

- `cleaver` is a level-1 formula but Metal Blade can only be made at level 2. Ingredient policy: BOTH.

### Alternative routes to one item

- **Fuel Canister** — WEAK_TRADE_RECORDED. Three routes. Fat route: no oil chain, but 6 fat per can and the slowest. Refinery single against batch: batch is cheaper and faster per can, and gives up only batch size (5 Crude and room for 2 cans). The single route is therefore weak. It belongs to the oil workstream (#59) and was left as is.
  - `refinery_fuel`: raw per unit 3 Crude Petroleum + 1 Frost Crystal + 1 Stone; 14 s per unit; refinery; starter
  - `refinery_fuel_batch`: raw per unit 2.5 Crude Petroleum + 0.5 Frost Crystal + 0.5 Stone; 11 s per unit; refinery; starter
  - `low_quality_fuel`: raw per unit 6 Animal Fat + 6 Plant Fiber; 24 s per unit; furnace; learned
  - Mechanical check: refinery_fuel_batch dominates refinery_fuel.
- **Refined Energy** — LEGITIMATE. Bulk route needs a level-3 bench and Charcoal; per unit it saves a third of the Crystal and Iron.
  - `energy_refined_industrial`: raw per unit 0.167 Frost Crystal + 0.167 Iron Ore + 0.333 Wood; 3.333 s per unit; workbench L3; starter
  - `energy_refined`: raw per unit 0.25 Frost Crystal + 0.25 Iron Ore; 4 s per unit; workbench L2; starter
- **Salvager Pick** — LEGITIMATE. Refined route (2 Refined Iron + Pipe, study) against Parts route (Gear + 2 Parts = 5 Parts, starter-known). Furnace time against scarce Parts.
  - `industrial_pick`: raw per unit 1 Raw Hide + 7.5 Iron Ore + 1 Parts + 8 Wood; 25 s per unit; workbench L2; learned
  - `industrial_pick_geared`: raw per unit 1 Raw Hide + 5 Iron Ore + 5 Parts + 2 Wood; 25 s per unit; workbench L2; starter
- **Arrow** — LEGITIMATE. Fiber gives 6, a Feather gives 8. Feathers come only from grouse.
  - `arrow_fletched`: raw per unit 0.125 Grouse Feather + 0.125 Stone + 0.125 Wood; 0.5 s per unit; workbench L1; starter
  - `arrow`: raw per unit 0.167 Plant Fiber + 0.167 Stone + 0.167 Wood; 0.833 s per unit; workbench L1; starter
- **Refined Iron Ingot** — LEGITIMATE. Rich Ore route: 1 ore instead of 3 ingots and faster, but Rich Ore needs an iron-class pick and is a separate, scarcer world material.
  - `refined_iron_ingot`: raw per unit 1.5 Iron Ore + 2 Wood; 10 s per unit; furnace; starter
  - `refined_iron_rich`: raw per unit 0.5 Rich Iron Ore + 2 Wood; 7 s per unit; furnace; starter
- **Glass** — LEGITIMATE. Crystal route (inland, study, competes with Cores) against Shell route (coast, starter-known, slower, two of each).
  - `shell_glass`: raw per unit 2 Crab Shell + 2 Stone; 16 s per unit; furnace; starter
  - `glass`: raw per unit 1 Frost Crystal + 1 Stone; 14 s per unit; furnace; learned

### Conservation: craft then recycle

| Component | Craft, per unit | Recycle returns | Net raw per cycle | Loses every cycle |
|---|---|---|---|---|
| Metal Pipe | 1 Refined Iron Ingot + 1 Parts | 1 Refined Iron Ingot | -1 Parts | yes |
| Mechanical Gear | 2 Iron Ingot + 3 Parts | 2 Parts + 1 Iron Ingot | -1 Iron Ore, -1 Parts | yes |
| Metal Blade | 3 Iron Ingot + 1 Parts | 2 Iron Ingot | -1 Iron Ore, -1 Parts | yes |
| Iron Plate | 1 Refined Iron Ingot + 1 Parts | 1 Iron Ingot | -0.5 Iron Ore, -1 Parts, -2 Wood | yes |

Zero-input formulas: `pump_crude` (extraction from finite seep stock). Formulas that consume their own output: none. Parts have no formula and no recycle rule returns more Parts than its craft spent.

### Materials with no consumer or one consumer

No consumer: none.

- Plank: only `struct:wall_plank`
- Iron Ore: only `recipe:iron_ingot`
- Rich Iron Ore: only `recipe:refined_iron_rich`
- Fur: only `recipe:fur_cloak`
- Ash Chitin: only `recipe:chitin_armor`
- Mire Gland: only `recipe:antirad`
- Utility Frame: only `recipe:motorbike_kit`
- Grouse Feather: only `recipe:arrow_fletched`
- Resistor Wire: only `struct:door_powered`
- Needle Tube: only `recipe:syringe`

### Items outside the main crafting graph

Main connected component: 135 of 157 items. The rest have no bill and appear in no bill; each is tied to the game by a system, not a formula:

- Survival Knife (family 04, SPECIAL_AUTHORITY): system:Starting kit
- Blueprint (family 11, SPECIAL_AUTHORITY): system:Knowledge
- Wolf Fang (specimen) (family 11, WORLD_ONLY): system:Specimen study
- Boar Tusk (specimen) (family 11, WORLD_ONLY): system:Specimen study
- Beetle Horn (specimen) (family 11, WORLD_ONLY): system:Specimen study
- Ragnarok Cash (family 11, SPECIAL_AUTHORITY): system:Run economy
- Escrow Chest (family 07, SPECIAL_AUTHORITY): system:Run economy
- Stone of Surtur (family 11, SPECIAL_AUTHORITY): system:Primordial Elders
- Stone of Typhon (family 11, SPECIAL_AUTHORITY): system:Primordial Elders
- Stone of Aion (family 11, SPECIAL_AUTHORITY): system:Primordial Elders
- Stone of Atlas (family 11, SPECIAL_AUTHORITY): system:Primordial Elders
- Stone of Argus (family 11, SPECIAL_AUTHORITY): system:Primordial Elders
- Stone of Anubis (family 11, SPECIAL_AUTHORITY): system:Primordial Elders
- Grouse Egg (family 03, WORLD_ONLY): system:Husbandry
- Shaleheart Coreplate (family 11, SPECIAL_AUTHORITY): system:Side bosses
- Oathless Nodachi (family 11, SPECIAL_AUTHORITY): system:Side bosses
- Saltwick Trident (family 11, SPECIAL_AUTHORITY): system:Side bosses
- Archive Lantern (family 11, SPECIAL_AUTHORITY): system:Side bosses
- Blue Card (family 11, WORLD_ONLY): system:Access
- Green Card (family 11, WORLD_ONLY): system:Access
- Purple Card (family 11, WORLD_ONLY): system:Access
- Sunroot Seed (family 10, WORLD_ONLY): system:Garden

## 7. Full bill expansions

Raw totals expand every intermediate through its main formula. Fractions come from batch yields; round up per craft.

### Iron Plate armour set (4 pieces) (L2 bench)

- Direct bill: 7 Iron Plate + 13 Raw Hide + 12 Needle and Thread — 21.5 kg carried to the station
- Intermediates made on the way: 7 Iron Plate + 7 Refined Iron Ingot + 16.5 Iron Ingot + 7 Charcoal + 12 Needle and Thread + 12 Cloth
- Raw total: 72 Plant Fiber + 13 Raw Hide + 16.5 Iron Ore + 7 Parts + 14 Wood

### Refined Iron armour set (4 pieces) (L2 bench)

- Direct bill: 14 Refined Iron Ingot + 20 Raw Hide + 26 Needle and Thread — 31.3 kg carried to the station
- Intermediates made on the way: 14 Refined Iron Ingot + 34 Iron Ingot + 14 Charcoal + 26 Needle and Thread + 26 Cloth
- Raw total: 156 Plant Fiber + 20 Raw Hide + 34 Iron Ore + 28 Wood

### Utility Motorbike (L3 bench)

- Direct bill: 1 Utility Frame + 2 Mechanical Gear + 3 Iron Plate + 4 Refined Iron Ingot — 14.1 kg carried to the station
- Intermediates made on the way: 1 Utility Frame + 1 Metal Pipe + 10 Refined Iron Ingot + 23 Iron Ingot + 10 Charcoal + 2 Mechanical Gear + 3 Iron Plate
- Raw total: 23 Iron Ore + 14 Parts + 20 Wood

### Workbench level 3 (both upgrades) (prerequisite of the Motorbike)

- Direct bill: 10 Iron Ingot + 16 Parts + 2 Mechanical Gear + 2 Iron Plate — 19.4 kg carried to the station
- Intermediates made on the way: 17 Iron Ingot + 2 Mechanical Gear + 2 Iron Plate + 2 Refined Iron Ingot + 2 Charcoal
- Raw total: 17 Iron Ore + 24 Parts + 4 Wood

### Big Bang (common Core) (L1 bench)

- Direct bill: 2 Iron Ingot + 4 Parts + 1 Frost Crystal — 3.7 kg carried to the station
- Intermediates made on the way: 2 Iron Ingot
- Raw total: 1 Frost Crystal + 2 Iron Ore + 4 Parts

### Meteor (rare Core) (L2 bench)

- Direct bill: 4 Iron Ingot + 8 Parts + 3 Frost Crystal + 3 Sulfur — 9.4 kg carried to the station
- Intermediates made on the way: 4 Iron Ingot
- Raw total: 3 Frost Crystal + 4 Iron Ore + 8 Parts + 3 Sulfur

### Dragon's Breath (top Core) (L3 bench)

- Direct bill: 8 Iron Ingot + 16 Parts + 6 Frost Crystal + 6 Sulfur — 18.8 kg carried to the station
- Intermediates made on the way: 8 Iron Ingot
- Raw total: 6 Frost Crystal + 8 Iron Ore + 16 Parts + 6 Sulfur

### Field Generator (pack)

- Direct bill: 4 Iron Ingot + 2 Refined Iron Ingot + 2 Electronic Parts + 4 Parts — 7.6 kg carried to the station
- Intermediates made on the way: 7 Iron Ingot + 2 Refined Iron Ingot + 2 Charcoal
- Raw total: 2 Electronic Parts + 7 Iron Ore + 4 Parts + 4 Wood

### Powered Door module (build cost)

- Direct bill: 2 Iron Ingot + 2 Electronic Parts + 1 Mechanical Gear + 2 Iron Plate + 2 Resistor Wire — 6.4 kg carried to the station
- Intermediates made on the way: 7 Iron Ingot + 1 Mechanical Gear + 2 Iron Plate + 2 Refined Iron Ingot + 2 Charcoal
- Raw total: 2 Resistor Wire + 2 Electronic Parts + 7 Iron Ore + 5 Parts + 4 Wood

### Large Furnace (L2 bench)

- Direct bill: 36 Stone + 8 Iron Ingot + 4 Iron Plate + 4 Charcoal — 59.2 kg carried to the station
- Intermediates made on the way: 14 Iron Ingot + 4 Iron Plate + 4 Refined Iron Ingot + 8 Charcoal
- Raw total: 14 Iron Ore + 4 Parts + 36 Stone + 16 Wood

### Salvager Axe (from nothing) (L2 bench)

- Direct bill: 1 Iron Axe + 1 Metal Blade + 2 Refined Iron Ingot + 1 Metal Pipe — 5.6 kg carried to the station
- Intermediates made on the way: 1 Iron Axe + 10.5 Iron Ingot + 1 Leather + 1 Metal Blade + 3 Refined Iron Ingot + 3 Charcoal + 1 Metal Pipe
- Raw total: 1 Raw Hide + 10.5 Iron Ore + 2 Parts + 8 Wood

### Machete (L2 bench)

- Direct bill: 4 Iron Ingot + 3 Metal Blade — 6.4 kg carried to the station
- Intermediates made on the way: 13 Iron Ingot + 3 Metal Blade
- Raw total: 13 Iron Ore + 3 Parts

### Steel Folding Ladder (L2 bench)

- Direct bill: 6 Refined Iron Ingot + 1 Wooden Ladder + 1 Mechanical Gear — 10.8 kg carried to the station
- Intermediates made on the way: 6 Refined Iron Ingot + 11 Iron Ingot + 6 Charcoal + 1 Wooden Ladder + 1 Rope + 1 Mechanical Gear
- Raw total: 3 Plant Fiber + 11 Iron Ore + 3 Parts + 24 Wood

### Oil chain: Pump + Refinery (packs)

- Direct bill: 11 Iron Ingot + 1 Mechanical Gear + 4 Metal Pipe + 7 Parts + 8 Wood + 2 Glass — 27.5 kg carried to the station
- Intermediates made on the way: 19 Iron Ingot + 1 Mechanical Gear + 4 Metal Pipe + 4 Refined Iron Ingot + 4 Charcoal + 2 Glass
- Raw total: 2 Frost Crystal + 19 Iron Ore + 14 Parts + 2 Stone + 16 Wood

## 8a. Balance watch

- **W1 sewn armour is a fiber sink.** Needle and Thread is 1 Cloth each and Cloth is 6 Plant Fiber. The Iron Plate set needs 12 Thread (72 fiber); the Refined Iron set needs 26 Thread (156 fiber).
  - Posture: Kept. The LI figure for Needle and Thread is LEGACY_CLAIM (10 cloth + 5 iron), so there is no verified number to move toward. If the grind is judged too long, change the Thread yield, not the armour bills, so the family rule survives.
- **W2 Parts are the real gate.** Workbench level 3 costs 24 Parts in total; the Motorbike 14 more; Dragon's Breath 16; each directed study 9.
  - Posture: Intended: Parts have no formula. The Parts supply rate is a source question for the next phase.
- **W3 Large Furnace weight.** The direct bill weighs 59.2 kg against a 60 kg carry limit.
  - Posture: Kept at 36 Stone by Control Tower posture: a base project built next to storage.
- **W4 Common Cores share one bill.** Big Bang and Earth Mother's Breath have identical bills.
  - Posture: Kept: both are starter-known first weapons; a cost difference would make one the default.
- **W5 Pipe and Plate share one bill.** Same inputs, same yield.
  - Posture: Kept on purpose: one rule to learn for refined components. They are not alternatives because they are different items with different consumers.

## 8. Changelog (revision 5 → 6)

| Formula | Kind | Before | After | Evidence | Economic consequence | Status |
|---|---|---|---|---|---|---|
| `metal_blade` | BILL | 4 Iron + 1 Parts | 3 Iron + 1 Parts | LI DIRECT: metal_blade = 30 iron + 15 parts; mechanical_gear = 50 iron + 65 parts. LI prices a blade at well under half a gear. SOH had them equal (5 units each). The new number is SOH_PROVISIONAL. | Cleaver 5 -> 4 Iron in total, Machete 16 -> 13, Reinforced Spear and Salvager Axe 1 less. Recycling a blade still returns 2 Iron of 3 and never the Part, so craft -> recycle loses material every turn. | IMPLEMENTED |
| `reinforced_spear` | BILL | 2 Iron + 1 Blade + 2 wood, 20 s, learned by study | 1 Blade + 1 Iron + 2 wood, 16 s, starter-known | SOH_ONLY. No LI figure. Internal contradiction: the alias below produced the same item for strictly less. | One formula instead of two. No player loses anything: everyone already knew the cheaper alias. | IMPLEMENTED |
| `reinforced_spear_blade` | RETIRED | alias: 1 Blade + 1 Iron + 2 wood, 16 s, starter-known | retired; successor reinforced_spear | SOH_ONLY. Strictly dominated the main formula. | Recipe count 115 -> 114. Knowledge of the alias is pruned on load; a job queued under it finishes under reinforced_spear_blade@5. | IMPLEMENTED |
| `refined_iron_helmet / chest / legs / boots` | KNOWLEDGE | research tier 3 (random tinkering only) | research tier 2 (directed study allowed) | LI LEGACY_CLAIM for the bills, which are unchanged. The tier is an SOH access rule; Control Tower posture 2026-11-15. | A directed study (9 Parts, 45 s each) reaches the top armour set without four invented blueprint sources. Bench level 2 and the bills are untouched. | IMPLEMENTED |
| `arrow` | KNOWLEDGE | learned by study | starter-known | SOH_ONLY. The better fletched arrow (8 per craft) was starter-known while the plainer one (6) needed study. | A bow owner without feathers can always make arrows. Bill unchanged. | IMPLEMENTED |

Migration: A queued job stamped with revision 5 or older resolves to its frozen bill and yield. Frozen rows are never edited. Frozen at revision 5: `reinforced_spear@5`, `reinforced_spear_blade@5`, `metal_blade@5`, `refined_iron_helmet@5`, `refined_iron_chest@5`, `refined_iron_legs@5`, `refined_iron_boots@5`, `arrow@5`.

## 9. Open questions

- **Q1 refined-armour and needle_thread LI figures.** Are the Last Island bills for the eight armour pieces and for Needle and Thread correct?
  - Why the sources cannot settle it: The audit grades all nine LEGACY_CLAIM: the numbers were carried from an earlier SOH document and no dated primary source for them is in the repository.
  - Current posture: Kept as recorded and labelled LEGACY_CLAIM. They are internally regular, which is why they were not changed.
- **Q2 Last Island crafting-tab order.** Does the eleven-family split match any real Last Island crafting UI?
  - Why the sources cannot settle it: No dated screenshot or video of a version-specific crafting menu is in the repository, and the sandbox cannot reach the four cited pages.
  - Current posture: The families are an SOH proposal. No claim of identity with Last Island is made.
- **Q3 knife.** Should the Survival Knife be unbreakable, or should a tool-free way to obtain stone exist?
  - Why the sources cannot settle it: It is a source-placement or mechanic decision, which is next-phase work. As a recipe question it is settled: the knife has no formula.
  - Current posture: No formula. Repair at a Workbench (1 stone + 1 fiber). Risk recorded.
- **Q4 metal_blade as a found part.** Will Metal Blade have a world source?
  - Why the sources cannot settle it: Source design is the next phase.
  - Current posture: The Cleaver stays at bench level 1 as an intentional found-part shortcut. If Blades are never found, the Cleaver is in practice a level-2 item and should then move to level 2.
- **Q5 refinery single route.** Should the 3 Crude -> 1 can route stay beside the cheaper 5 Crude -> 2 route?
  - Why the sources cannot settle it: It belongs to the oil workstream (#59).
  - Current posture: Left unchanged and recorded as a weak trade.
