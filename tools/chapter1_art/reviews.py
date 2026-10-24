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
            "The slate-blue floor and flat grey wall tops are now warm sandstone with brick courses, a coping course and side returns, so the first room reads as built masonry.",
            "Wall torches and banners hang at a fixed rhythm with real point lights, and the room has lit pools instead of uniform brightness.",
            "A dark paved margin runs around the room, so the walkable floor no longer runs edge to edge into its own walls.",
        ],
        "missing": [
            "The tutorial must stay readable, so the world tint is only 0.95; contrast is therefore weaker here than in later levels, and the room can still read flat.",
            "There is no doorway frame or arch at the room mouth - transitions are still a gap in a wall.",
            "Identity is carried by palette and props; nothing in the derived architecture says 'crypt entrance' specifically.",
        ],
        "next": [
            "Author a masonry door surround (jambs + lintel) at each room opening.",
            "Add paired sconces flanking the spawn and the sigil so the eye has a landmark to lock onto immediately.",
        ],
    },
    "chapter_1_level_2": {
        "improved": [
            "The burial gallery keeps its authored bone piles and urns and now sits inside brick walls with a coping line and contact shadow.",
            "Warm bone-toned palette separates this floor from Level 1 without changing the map.",
        ],
        "missing": [
            "Burial niches are not architectural yet: the bone galleries are props on a floor, not constructed recesses in a wall.",
            "Safe and risky branches read the same; the brief asked for the environment to signal which fork is dangerous.",
        ],
        "next": [
            "Add a niche band on wall faces (a recessed dark tile framed by two jambs) at fixed intervals.",
            "Differentiate the branches with a blood channel or rubble fall on the risky side.",
        ],
    },
    "chapter_1_level_3": {
        "improved": [
            "Amber palette and masonry framing make the archive hall warmer while leaving the production map and its collision untouched.",
        ],
        "missing": [
            "The archive identity lives in scattered shelf props; there are no constructed shelf bays, no reading alcoves, no gallery rail.",
            "The Gate 3 geometry was deliberately not promoted, so the room still reads as a hall with books in it.",
        ],
        "next": [
            "Build shelf bays from the decor sheet against wall faces, three tiles wide, with a lintel course.",
            "Add a gallery rail course above the hall to give the room a second storey of readable structure.",
        ],
    },
    "chapter_1_level_4": {
        "improved": [
            "Neutral stone palette and a paved margin make the reliquary floor read as cut stone rather than a tile grid.",
        ],
        "missing": [
            "The concentric ritual stonework and the central landmark the brief asks for are in the plan, not in the picture.",
            "The final apse is architecturally identical to the rest of the floor.",
        ],
        "next": [
            "Ring the central landmark with a concentric band of paving and four cardinal inlays.",
            "Give the apse a distinct floor family and a heavier coping so the room change is visible from the doorway.",
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
            "Spectral palette reads immediately as a different place from the crypt, and the anchor landmarks cast cool light.",
        ],
        "missing": [
            "The three anchor chambers are distinguished only by a light colour; there is no architecture saying 'chamber'.",
            "Split lanes are not readable as lanes.",
        ],
        "next": [
            "Frame each anchor with a stone housing (plinth, jamb, cap) so the anchor is inside something.",
            "Mark the split with a central pier rather than an open floor.",
        ],
    },
    "chapter_1_level_7": {
        "improved": [
            "The beacon is the brightest thing on the floor and the ember palette supports it; no new solids were added, so enemy lanes are untouched.",
        ],
        "missing": [
            "Siege damage is absent from the derived layer: no collapsed courses, no rubble spills, no scorch.",
            "The beacon itself is a light, not a structure.",
        ],
        "next": [
            "Add a damaged coping pass: every few bays the cap course is missing or displaced.",
            "Ring the beacon with a broken masonry base so the light has a source.",
        ],
    },
    "chapter_1_level_8": {
        "improved": [
            "Cool neutral palette and masonry framing keep both wings consistent while leaving the exclusive branch logic untouched.",
        ],
        "missing": [
            "The two wings are separated only by hue; the decision chamber is not marked as a threshold.",
            "The vault is not visible as an earned destination.",
        ],
        "next": [
            "Give each wing its own trim rhythm and floor family so the player can tell them apart at a glance.",
            "Put a heavier threshold course at the decision chamber mouth.",
        ],
    },
    "chapter_1_level_9": {
        "improved": [
            "Crimson palette plus focal red light at the gate; the gate hall no longer loses its floor to near-black.",
        ],
        "missing": [
            "The three seal chambers are not legible as separate chambers with seal-state feedback.",
            "Fortress scale is a plan property, not a picture property yet.",
        ],
        "next": [
            "Build three distinct seal housings, each with its own lit ring that can show state.",
            "Raise the gate wall two courses above the rest of the room so the frame reads as fortification.",
        ],
    },
    "chapter_1_level_10": {
        "improved": [
            "Axial hall with warm masonry, torch trim and the boss arena lit from the throne end.",
        ],
        "missing": [
            "Royal symbols and damage to them are not in the derived layer.",
            "Phase distinction is carried by the boss, not by the room.",
            "The completion portal is a prop, not an architectural terminus.",
        ],
        "next": [
            "Author a throne dais: raised platform edge, damaged banner pairs, a broken crest behind the throne.",
            "Frame the portal with a full-height arch so completion reads as leaving through something.",
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
            f"- Status: `{status.get(level_id, 'TECHNICALLY VALID - VISUAL NOT READY')}`",
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
