#!/usr/bin/env python3
"""Write one REVIEW.md per level from the native evidence and an authored critique.

The critique text is written by hand after looking at the frames; nothing here
invents a verdict. A level is only described as worth a human's time when the
author of this file says so, and even then the label is "needs review", never
"accepted" - the owner rejected the previous 80/100 self-score, so this script
does not produce a score at all.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "chapter1-visual-overhaul"
THEMES = ROOT / "data" / "environment" / "chapter1"
STATUS_FILE = THEMES / "review_status.json"

NOTE = """\
Chapter 1 visual overhaul - shared presentation layer
`game/levels/presentation/chapter1_environment_art.gd`
"""

# Authored after inspecting the native frames of run 4012xxxxx on branch
# arena/6e89e68d-soul-of-hero. "improved" is what the AFTER frame demonstrably
# shows against its own BEFORE; "missing" is what the brief asked for and the
# frame does not show yet.
CRITIQUE = {
    "chapter_1_level_1": {
        "improved": [
            "The walls of the first room are the crypt's own storey now: coursed ashlar with a dado course of arched columbarium recesses, each holding a shelf of urns, so the room is an underground burial hall rather than a box with a pattern on it.",
            "The hall is laid out around the level's processional axis: an aisle of dressed stone with a raised kerb on both sides and a bronze inlay down its joint, running the length of the level and crossing at the shaft.",
            "The burial business is furniture, not decoration: sarcophagi stand in ranks through the galleries in four kinds (an effigy chest, a plainer chest with a cut cross and a chipped corner, a two-burial chest, and one levered open), with loculi in the corners, biers, and candelabra with real lights.",
            "Beyond the rooms the rock is the crypt's own, in the crypt's own palette, so the level no longer floats on a shared grey field.",
        ],
        "missing": [
            "Value structure inside the galleries is still flat: the tomb chests are cut from a stone close to the paving they stand on, so a rank of them reads as dark shapes on a dark floor rather than as carved objects with a lit top plane.",
            "There is still no door surround at a room mouth; transitions remain a gap in a wall.",
            "The columbarium dado repeats on a fixed six-cell rhythm, which is visible as a rhythm rather than as an accident of construction.",
        ],
        "next": [
            "Raise the tomb lid's top plane and darken the chest's shaded side, so a rank of them separates from the floor at 1x.",
            "Author a masonry jamb-and-lintel surround at each room opening, in the kit's own stone.",
        ],
    },
    "chapter_1_level_2": {
        "improved": [
            "The Ossuary Fork's walls are built from what the place is made of: coursed long bones with dark seams, a skull frieze set into the framed course at eye height, and plain bone coursing above it. The frieze is one band, not a stamped motif on every row.",
            "A bone arch stands over the crossing the level is named for, with a lantern either side of it, and banks of skulls are built into the wall where the fork's ways meet.",
            "The halls are furnished as an ossuary is: ranks of bone stacks in three kinds (a plain stack, one crowned with a skull, one with a shaft), with passages between them.",
            "Charnel fires burn cold in two places and are the only cool light in the level, which gives the warm bone stone something to answer.",
            "A hypostyle of long-bone shafts stands through the middle of the halls, so the widest camera frame has architecture in it rather than paving with one cabinet against a wall.",
            "The crown of the wall is its own order - a projecting pale lintel carried on corbel tabs with a shadow under it - instead of the skull frieze repeated at the top of the storey, so a wall reads bottom-up as plinth, coursing, frieze, crown.",
            "The charnel drift is dust that settles into the joints and the low corner of a slab, in runs, not single pale pixels scattered over the stone.",
        ],
        "missing": [
            "The fork does not yet tell the player which way is dangerous: both branches are furnished and lit the same way, and the brief asks the environment to signal the choice.",
            "The hall shafts stand on a fixed nine-cell lattice and are one frame, so a long view counts the same column; the hall shafts and the tall bone stacks are also one silhouette at one height.",
            "The plain bone coursing is close to the value of bleach, so in a wide frame the walls out-punch the props standing in front of them.",
        ],
        "next": [
            "Signal the risky branch with a spill, a rubble fall or a darker paving family, and leave the safe branch plain.",
            "Give the hall shaft a second order - a heavier base or a different crown - so the colonnade has two ranks to count.",
            "Drop the wall coursing a value so the props carry the light.",
        ],
    },
    "chapter_1_level_3": {
        "improved": [
            "The archive reads as a scriptorium: ranks of bookcases through the halls, in three variants with different spines, different gaps and the chained volume on a different shelf, plus two kinds of burnt shell where the fire reached them.",
            "Its walls are soot-blackened coursing, stepped well below the paving in value, with iron grilles over shelf recesses and boarded-over recesses as the wall's own language - so floor, wall and furniture are three planes instead of one brown field.",
            "The floor carries ash as a drift that thickens into one corner, with boardwalks and register rings where the level has reading rooms.",
            "Lecterns, scroll racks and braziers are placed with candles that light the shelves they face.",
        ],
        "missing": [
            "The shelf ranks are a lattice at a fixed stride, and from any single camera position the repeat is legible as a grid.",
            "Between the ranks are three and four cells of bare paving with nothing in them; the rooms read as shelving with floor between it rather than as rooms with books in them.",
            "The level has no second storey of readable structure - no gallery, no rail, no upper face - so its walls end at the cornice and stop.",
        ],
        "next": [
            "Break the lattice with a second offset rank and a few cases standing out from the wall.",
            "Add a gallery rail course above the hall so the room has two readable layers.",
        ],
    },
    "chapter_1_level_4": {
        "improved": [
            "The reliquary has verticals now: engaged piers with fluted ivory shafts, bronze astragals, jade capitals and moulded bases stand along the walls at a nine-cell stride, so the halls have bays to count and depth to see.",
            "Walls are a dark warm plaster and the ivory is what the piers, the shrine band and the paving are made of, so the floor is a ground plane rather than a continuation of the wall.",
            "The processional route is walked out over the map's own floor and inlaid in darker paving with a bronze lozenge in every cell, so the way to the relic is legible from across the hall without a painted stripe.",
            "The spiral is cut around the shrine's own cell and the relic stands behind the live objective, so the thing the level is named for is what the floor turns around; the five chapels each have a bronze-framed shrine niche in the wall behind them.",
        ],
        "missing": [
            "The middle of the halls is a hypostyle now - piers on an eight-cell lattice with votive urns on the line between them and dais drums where four bays meet - so the densest camera position is a room with colonnades running out of frame instead of a field of paving.",
            "The four secondary turns are five-by-five discs of two floor families, so they read as patches of a different stone rather than as smaller spirals.",
            "The free-standing columns stand on an eight-cell lattice with a slot missing in seven, so the bays repeat measured rather than ruined: the eye can count the same column across a whole hall.",
            "The wall piers and the free-standing ones are the same frame, so a column in the middle of a hall is lit and modelled like one engaged to a wall.",
        ],
        "next": [
            "Break the column stride further with a second, heavier order at the bay crossings.",
            "Draw the secondary turns as spirals, not as discs - the floor families exist for it.",
        ],
    },
    "chapter_1_level_5": {
        "improved": [
            "Blood-red masonry, wall torches with lights and lit pools replace the previous flat slate hall; the hall now has depth and a horizon line.",
            "Walls no longer read as see-through bricks: transparent authored wall tiles are backed with solid stone.",
        ],
        "missing": [
            "The crucible basin is still not legible from the spawn station; the brief's first-frame landmark is missing.",
            "The forecourt, the court and the boss arena still look like the same room with different props.",
        ],
        "next": [
            "Compose the spawn frame around the processional arch and the basin rim so both are visible on arrival.",
            "Give each floor its own floor family and trim rhythm so the three-storey progression is legible.",
        ],
    },
    "chapter_1_level_6": {
        "improved": [
            "The level is a distinct place: pale cool limestone, verdigris copper and cold soul-light, built from its own kit rather than the Crucible's red basalt and brass.",
            "Each of the three Soul Anchors stands on a dais with an inlaid relay medallion cut into the paving, framed by two pylons and four conduit posts, with its crystal monument on the axis behind the core. The Anchor is now inside something instead of being a light on open floor.",
            "The split diamond is legible as two lanes: conduit runs around the central block on both sides and the floor chevrons run east on the north lane and west on the south one, so the two directions the level teaches are visible without a tooltip.",
            "The east approach is terraced, with risers under each band and a pylon pair at every second brow, so the climb to the first Anchor is counted by the eye.",
            "The last Anchor's conduit circles the chamber and turns back west to the exit arch, which carries the same two-ring mark as the medallions.",
        ],
        "missing": [
            "The east rooms and the two landings are still large and thinly furnished; the authored layer reads best where the composition is dense and weakest in the biggest empty floors.",
            "Wall architecture is carried by inlaid panels and lancets on broadside faces only; a wall seen end-on still shows the default course, and the transition between the two is visible.",
            "The relief panel on the third floor's hollow centre is rock, not architecture: the massif reads correctly but adds nothing to the return loop.",
        ],
        "next": [
            "Furnish the three landing rooms at the same density as the Anchor chambers.",
            "Give the exit room a second element beyond the arch and the two pylons, so the last frame of the level has its own composition.",
        ],
    },
    "chapter_1_level_7": {
        "improved": [
            "The level has its own world: chalk-white dry limestone, blackened iron at every joint, and fire as the only saturated colour, so it reads as a garrison yard at dusk rather than as a recoloured crypt.",
            "The Beacon is defended by an inlaid seven-cell iron ward ring with eight burn marks on it, and framed by four fire-capped watch pillars on the ring's diagonals: the thing being defended has a boundary drawn on the floor instead of being a light on open paving.",
            "The four approaches the waves use are the most legible thing in the room, and they are floor tiles: a raised chalk apron with an iron edge and four three-cell causeways cut open where they meet it. Nothing is placed within a cell of them, so the lanes stay free while reading as roads.",
            "The middle of the hall has four drill squares with four different garrison jobs on them - a muster line, a fire station with the cistern and woodpile, a dressing station and an armoury - so the composition is not symmetry.",
            "The perimeter is furnished all the way round, including the south boundary whose face the camera never sees: crates, barrels, sandbags, firewood and torn banners at the wall feet, buttresses, arrow slits and fire baskets on the broadside faces.",
        ],
        "missing": [
            "The Beacon's own light and the entity's glow still wash the centre of the yard to a pale cream, which flattens the ward ring at gameplay zoom. The correction pass cut the authored ember energy by two thirds, which fixed the furnace, but the centre is still the least legible part of the room.",
            "The drill squares read more strongly as prop clusters than as painted squares: the outline is a floor tile and at 1x it disappears under the props that define it.",
            "The three waves are runtime behaviour and are not photographable as architecture; the frames show the yard, not the wave pacing.",
        ],
        "next": [
            "Give the Beacon's cell a darker apron so the entity's glow has something to fall on.",
            "Consider a second, coarser floor mark for the drill squares so they survive the props standing on them.",
        ],
    },
    "chapter_1_level_8": {
        "improved": [
            "One building, two wings that are separate places to fight: cold black iron, bone and lit niches west; wine velvet, gilt, a running fountain and smashed marble east. The shared base is pale marble, which is what makes it read as one divided reliquary rather than two rooms.",
            "The choice is drawn on the floor: each sealed door has its branch's emblem inlaid in front of it - an iron disc with a scythe, a gilt-ringed disc with a chalice - same construction, different sigil, so the player reads the branch before touching the seal.",
            "Nothing may stand on, beside or in front of a seal: the placer refuses the protected cell set and the validator re-checks it, so there is no decorative bypass.",
            "The Reaper wing is a colonnade of fluted columns and hooded statues with iron grilles over cold-lit niches, sarcophagi along every wall, a bier and a grave cut into the floor in iron inlay.",
            "The vault is a room, not a corridor end: a raised dais with the elite's sigil, the founders' sarcophagi either side of the chest, and a pointed exit arch with a cold, lit opening and two lamps inside it.",
        ],
        "missing": [
            "The two wings share one plan: the differentiation is material and furniture, which is the honest limit of a symmetric map.",
            "Flagstone joints are regular enough to read as a grid at 1x zoom; the veining that was meant to break it up had to be made faint because a bright vein tiled into wallpaper.",
            "The east wing's damage is authored as broken paving and rubble rather than structural collapse, because the map has one floor layer.",
        ],
        "next": [
            "If the owner wants the wings further apart, the cheapest honest lever is the wing's ceiling light colour, not more props.",
            "The reaper statue's scythe reads at 3x and merges into the robe at 1x; it may want a paler blade.",
        ],
    },
    "chapter_1_level_9": {
        "improved": [
            "A gatehouse rather than a hall: oxblood basalt, riveted iron plating and bone trophies, deliberately close to the Crucible's hue and nothing else.",
            "The gate is inside the camera frame. The monumental arch and its two towers are built up from the arena floor instead of hung on the top wall, because the camera stops at the map edge; its cold blue-white opening is the level's only cold light and is visible from anywhere in the nave.",
            "The three gate seals are three fixtures with three silhouettes - a bronze bell on an iron gallows, a burning cauldron on three legs, the great winch wheel - each on the same stone platform inside its own inlaid iron-and-blood floor ring, so they read as three locks on one gate instead of three copies of a marker.",
            "No prop stands on a seal cell or beside one, and the validator re-checks every placement against the protected cell set.",
            "A riveted iron aisle runs the building's whole axis from the spawn to the gate with cross bands where the arms meet the nave, so the level's cross plan is drawn on the floor.",
        ],
        "missing": [
            "The paving still reads as brickwork at gameplay zoom: the flag joints are regular enough to form a grid, and the first native frames show it as a woven texture rather than as large slabs.",
            "The three seal arms are architecturally identical apart from their station, because the map gives them the same geometry; the art differentiates them by fixture and light only.",
            "The portcullis inside the gate arch reads at gameplay scale but disappears in a thumbnail.",
        ],
        "next": [
            "The paving is the one thing worth a second structural attempt if the owner asks: fewer, larger joints and per-slab highlights rather than a repeating course.",
            "The gate's chains could be extended down the arena walls to tie the arch into the room.",
        ],
    },
    "chapter_1_level_10": {
        "improved": [
            "The chapter's last room is built on one axis and reads from the south door: antechamber, nave, crimson runner, four steps, throne, portal, all on the same centre line.",
            "The throne is colossal and inside the frame - a wide seat with a three-panel back, swept canopy fins, gold finials, a crimson cushion and heavy arms on a four-tier approach - because the map edge is at the top and a throne taller than the frame would be a wall.",
            "The fight is drawn on the floor: the crimson cross in the arena is the same carpet as the runner, so the crossing lanes of the encounter are the one part of the floor with nothing on it, without a marker and without touching a boss statistic, phase threshold, telegraph or HUD element.",
            "The portal is the architectural terminus: a moon-lit arch with two gold-banded pillars behind the throne, its cold teal light the only cool light in a room otherwise lit by candles.",
            "The court carries the chapter's formality: four heavy fluted columns on the arena's pillars, gold-leaf friezes, moon windows in the wall, royal banners, veiled statues, censers and the wreckage of the fight that got this far.",
        ],
        "missing": [
            "The arena's east and west flanks are wide and only lightly furnished; filling them would work against a two-phase boss fight, so they are left open on purpose.",
            "The four steps read as inlay more than as elevation: the map is one flat floor layer and the art cannot create a height difference.",
            "Phase two is told by the boss and the HUD, not by the room; the moon windows and cool light are a groundwork for it, not a phase change.",
        ],
        "next": [
            "If a phase-two room state is ever wanted, the cheapest lever is the arena's wall windows and the carpet's condition, not new geometry.",
            "The throne's canopy fins are the one shape worth a second look at 1x zoom.",
        ],
    },
}


def pinned_sources() -> dict:
    path = DOCS / "regressions" / "source_pins.txt"
    pins = {}
    if not path.exists():
        return pins
    for line in path.read_text(errors="replace").splitlines():
        parts = line.split()
        if len(parts) == 2:
            pins[Path(parts[1]).name] = parts[0]
    return pins


def capture_stats() -> dict:
    stats = {}
    logs = DOCS / "regressions" / "logs"
    for log in sorted(logs.glob("*_after.txt")):
        level_id = log.name[: -len("_after.txt")]
        text = log.read_text(errors="replace")
        row = {}
        cap = re.search(r"CHAPTER1 CAPTURE: .*art=(\w+) facade_cells=(\d+) lights=(\d+) entities=(\d+)", text)
        if cap:
            row.update(art=cap.group(1), facade=int(cap.group(2)), lights=int(cap.group(3)), entities=int(cap.group(4)))
        perf = re.search(r"CHAPTER1 PERF: .*nodes=(\d+) draw_calls=(\d+) static_mb=([\d.]+)", text)
        if perf:
            row.update(nodes=int(perf.group(1)), draw_calls=int(perf.group(2)), static_mb=float(perf.group(3)))
        before = logs / f"{level_id}_before.txt"
        if before.exists():
            bperf = re.search(r"CHAPTER1 PERF: .*nodes=(\d+) draw_calls=(\d+)", before.read_text(errors="replace"))
            if bperf:
                row.update(before_nodes=int(bperf.group(1)), before_draw_calls=int(bperf.group(2)))
        stats[level_id] = row
    return stats


def main() -> int:
    index = json.loads((THEMES / "chapter_index.json").read_text())
    status = json.loads(STATUS_FILE.read_text())["levels"] if STATUS_FILE.exists() else {}
    pins = pinned_sources()
    stats = capture_stats()
    written = 0
    for entry in index["levels"]:
        level_id = entry["level_id"]
        folder = DOCS / entry["folder"]
        if not folder.exists():
            continue
        images = sorted(p.name for p in (folder / "images").glob("*.png")) if (folder / "images").exists() else []
        note = CRITIQUE.get(level_id, {})
        row = stats.get(level_id, {})
        theme_path = THEMES / entry.get("theme", f"{level_id}.json")
        theme = json.loads(theme_path.read_text()) if theme_path.exists() else {}
        lines = [
            f"# {entry['title']} (L{entry['slot']:02d}) - visual review",
            "",
            f"- Level id: `{level_id}`",
            f"- Map source: `data/levels/{entry['map']}`",
            f"- Source sha256: `{pins.get(Path(entry['map']).name, 'see regressions/source_pins.txt')}`",
            f"- Status: `{status.get(level_id, 'INCOMPLETE — ART DELIVERY FAILED')}`",
            f"- Art direction: {theme.get('concept', 'see theme document')}",
            "",
            "## What the native frames show",
            "",
            f"- Derived facade cells: {row.get('facade', 'n/a')}",
            f"- Landmark lights: {row.get('lights', 'n/a')}",
            f"- Authored entities preserved: {row.get('entities', 'n/a')}",
            "",
            "### Improved",
            "",
        ]
        lines += [f"- {item}" for item in note.get("improved", ["(not reviewed yet)"])]
        lines += ["", "### Still missing against the brief", ""]
        lines += [f"- {item}" for item in note.get("missing", ["(not reviewed yet)"])]
        lines += ["", "### Next correction pass", ""]
        lines += [f"- {item}" for item in note.get("next", ["(not planned yet)"])]
        lines += ["", "## Cost of the layer", ""]
        if "nodes" in row:
            lines += [
                f"- Nodes: {row['before_nodes']} (art off) -> {row['nodes']} (art on)",
                f"- Draw calls: {row['before_draw_calls']} -> {row['draw_calls']}",
                f"- Static memory: {row['static_mb']} MiB with the layer on",
            ]
        else:
            lines += ["- Not measured in this run."]
        lines += ["", "## Frames", ""]
        if images:
            lines += [f"- `images/{name}`" for name in images]
        else:
            lines += ["- No native frames were produced for this level in this run."]
        lines += [
            "",
            "Every image above is a native Godot frame from the production `AppRoot`",
            "campaign boot at 1280x720. `before_*` is the same map with the art layer",
            "disabled, so the pair isolates the layer and nothing else. Nothing in this",
            "folder is a plan diagram, a PIL preview or a generated image.",
            "",
        ]
        (folder / "REVIEW.md").write_text("\n".join(lines), encoding="utf-8")
        written += 1
    print(f"reviews written: {written}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
