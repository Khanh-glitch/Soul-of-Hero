#!/usr/bin/env python3
"""Render before/after Level 2 floor footprints at an identical cells-per-pixel scale.

Both maps are drawn with the same PX_PER_CELL, the same palette and the same
labelling, so a reviewer can compare silhouettes, room proportions, route
structure and entity distribution without mentally rescaling anything.

    python3 tools/design/level2_footprint_compare.py \
        --out docs/design-audition/evidence/level2_before_after_footprint.png

The baseline is read straight out of the frozen audition SHA; the candidate is
the working-tree JSON. Nothing here is a substitute for Godot captures: it is a
plan view of authored data only.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from collections import deque

from PIL import Image, ImageDraw, ImageFont

BASELINE_SHA = "1c21a49c2eb3775c4b421dab86d057c7256f5964"
LEVEL_PATH = "data/levels/chapter_1_level_2.json"
PX = 10  # pixels per 16px cell — identical for both panels

VOID = (10, 12, 15)
FLOOR = (74, 80, 90)
SOLID = (28, 32, 38)
ROOM_LINE = (86, 178, 198)
LABEL = (226, 232, 240)
DIM = (140, 150, 162)
ROUTE = (232, 176, 92)
ROUTE_ALT = (128, 196, 232)

ENTITY_COLOURS = {
    "player": (120, 240, 150),
    "skeleton": (232, 96, 96),
    "floor_door": (96, 148, 240),
    "sigil": (245, 214, 92),
    "checkpoint": (150, 236, 214),
    "exit_gate": (255, 140, 60),
    "chest": (214, 148, 92),
    "spikes": (200, 200, 210),
    "torch": (250, 190, 120),
    "coin": (238, 200, 120),
}


def load_baseline() -> dict:
    raw = subprocess.check_output(
        ["git", "show", f"{BASELINE_SHA}:{LEVEL_PATH}"], text=True
    )
    return json.loads(raw)


def load_candidate(path: str) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


# Branch sketches are given as ordered waypoints in cell space; the drawn line
# is the real 4-connected shortest path across authored floor, so the figure
# shows walkable lanes rather than decorative arrows.
NEW_ROUTES = [
    ("F1 high road: Ledge of Relics", [
        (12, 26), (44, 26), (44, 16), (50, 11), (79, 12), (96, 11),
        (116, 12), (124, 15), (140, 24), (143, 26),
    ], ROUTE),
    ("F1 low road: Flooded Nave", [
        (12, 26), (44, 26), (44, 34), (62, 38), (86, 37), (110, 37),
        (126, 38), (138, 30), (143, 26),
    ], ROUTE_ALT),
    ("F2 ring + spans", [
        (11, 72), (30, 72), (44, 72), (58, 72), (72, 72), (85, 66),
        (88, 72), (96, 72), (120, 72), (142, 72),
    ], ROUTE),
    ("F3 choir lanes", [
        (11, 116), (26, 116), (40, 116), (52, 113), (68, 116), (84, 113),
        (96, 116), (100, 116),
    ], ROUTE),
]

BASELINE_LABELS = [
    ("entry", (10, 12)),
    ("fork", (48, 10)),
    ("north wing", (70, 16)),
    ("convergence", (86, 16)),
    ("F2 landing", (10, 44)),
    ("F2 ring", (60, 42)),
    ("F3 landing", (10, 68)),
    ("F3 gauntlet", (52, 62)),
    ("exit", (86, 68)),
]

NEW_ROOM_LABELS = [
    ("R1 Mouth Court (spawn)", (4, 14)),
    ("R2 Jaw Hall / fork", (44, 22)),
    ("north balcony", (46, 6)),
    ("HIGH: Reliquary Chapel", (104, 9)),
    ("chest x220", (101, 17)),
    ("LOW: Flooded Nave", (68, 40)),
    ("R5 Cenotaph Rotunda / camp 1", (128, 5)),
    ("moat + 4 bridges", (128, 42)),
    ("F2 Well Antechamber", (12, 78)),
    ("R7 ring gallery", (56, 56)),
    ("camp 2", (128, 62)),
    ("island sigil", (74, 77)),
    ("N cache", (128, 60)),
    ("S cache", (128, 92)),
    ("F3 landing", (12, 124)),
    ("R12 White Choir / camp 3", (56, 124)),
    ("exit apse", (96, 106)),
    ("discovery chest x280", (112, 128)),
]


def panel(level: dict, title: str, subtitle: str) -> Image.Image:
    width = int(level["width"])
    height = int(level["height"])
    head = 74
    image = Image.new("RGB", (width * PX, height * PX + head), VOID)
    draw = ImageDraw.Draw(image, "RGBA")
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15
        )
        small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12
        )
    except OSError:  # pragma: no cover - font fallback
        font = small = ImageFont.load_default()

    draw.text((10, 8), title, fill=LABEL, font=font)
    draw.text((10, 28), subtitle, fill=DIM, font=small)
    draw.text(
        (10, 46),
        f'floor {len(level["layers"]["Backdrop"])}  geometry '
        f'{len(level["layers"]["Geometry"])}  decor '
        f'{len(level["layers"]["Decor"])}  entities {len(level["entities"])}  '
        f'{width}x{height} cells',
        fill=DIM,
        font=small,
    )

    offset = head
    floor = level["layers"]["Backdrop"]
    for cell in floor:
        x, y = int(cell["x"]), int(cell["y"])
        draw.rectangle(
            [x * PX, offset + y * PX, x * PX + PX - 1, offset + y * PX + PX - 1],
            fill=FLOOR,
        )
    for cell in level["layers"]["Geometry"]:
        x, y = int(cell["x"]), int(cell["y"])
        draw.rectangle(
            [x * PX, offset + y * PX, x * PX + PX - 1, offset + y * PX + PX - 1],
            fill=SOLID,
        )
    for cell in level["layers"]["Decor"]:
        x, y = int(cell["x"]), int(cell["y"])
        draw.rectangle(
            [x * PX + 3, offset + y * PX + 3, x * PX + PX - 4, offset + y * PX + PX - 4],
            fill=(120, 108, 96),
        )

    for room in level["metadata"].get("rooms", []):
        x0, y0, w, h = room["rect"]
        draw.rectangle(
            [x0 * PX, offset + y0 * PX, (x0 + w) * PX, offset + (y0 + h) * PX],
            outline=ROOM_LINE + (110,),
            width=1,
        )

    for entity in level["entities"]:
        kind = entity["type"]
        colour = ENTITY_COLOURS.get(kind, (255, 255, 255))
        px = entity["position"]
        cx = int(px[0]) // 16 * PX + PX // 2
        cy = int(px[1]) // 16 * PX + PX // 2 + offset
        r = 4 if kind in ("player", "exit_gate", "sigil", "floor_door") else 3
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour)
    return image


def shortest_path(floor: set, start: tuple, goal: tuple) -> list:
    """4-connected BFS across authored floor cells."""
    if start not in floor or goal not in floor:
        return [start, goal]
    previous = {start: None}
    queue = deque([start])
    while queue:
        x, y = queue.popleft()
        if (x, y) == goal:
            break
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nxt = (x + dx, y + dy)
            if nxt in floor and nxt not in previous:
                previous[nxt] = (x, y)
                queue.append(nxt)
    if goal not in previous:
        return [start, goal]
    path = [goal]
    while previous[path[-1]] is not None:
        path.append(previous[path[-1]])
    return path[::-1]


def nearest_floor(floor: set, cell: tuple) -> tuple:
    if cell in floor:
        return cell
    best, score = cell, None
    for candidate in floor:
        distance = (candidate[0] - cell[0]) ** 2 + (candidate[1] - cell[1]) ** 2
        if score is None or distance < score:
            best, score = candidate, distance
    return best


def decorate(image: Image.Image, level: dict, routes, labels) -> None:
    """Draw measured routes and room labels over a rendered panel."""
    head = 74
    floor = {(int(c["x"]), int(c["y"])) for c in level["layers"]["Backdrop"]}
    draw = ImageDraw.Draw(image, "RGBA")
    try:
        small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12
        )
    except OSError:  # pragma: no cover
        small = ImageFont.load_default()
    for _name, waypoints, colour in routes:
        cells = []
        for a, b in zip(waypoints, waypoints[1:]):
            segment = shortest_path(
                floor, nearest_floor(floor, a), nearest_floor(floor, b)
            )
            cells.extend(segment if not cells else segment[1:])
        pts = [(x * PX + PX // 2, head + y * PX + PX // 2) for x, y in cells]
        if len(pts) > 1:
            draw.line(pts, fill=colour + (170,), width=2, joint="curve")
    for text, (x, y) in labels:
        text_width = draw.textlength(text, font=small)
        left = min(max(4, x * PX), image.width - text_width - 6)
        top = head + y * PX
        draw.rectangle(
            [left - 3, top - 2, left + text_width + 3, top + 14],
            fill=VOID + (200,),
        )
        draw.text((left, top), text, fill=LABEL, font=small)


def legend(width: int) -> Image.Image:
    height = 64
    image = Image.new("RGB", (width, height), VOID)
    draw = ImageDraw.Draw(image)
    try:
        small = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12
        )
    except OSError:  # pragma: no cover
        small = ImageFont.load_default()
    entries = [
        ("floor tile (Backdrop)", FLOOR),
        ("solid obstruction (Geometry)", SOLID),
        ("room anchor rect", ROOM_LINE),
        ("F1 high road", ROUTE),
        ("F1 low road", ROUTE_ALT),
        ("player", ENTITY_COLOURS["player"]),
        ("skeleton", ENTITY_COLOURS["skeleton"]),
        ("floor door", ENTITY_COLOURS["floor_door"]),
        ("sigil", ENTITY_COLOURS["sigil"]),
        ("exit gate", ENTITY_COLOURS["exit_gate"]),
    ]
    x = 10
    for text, colour in entries:
        draw.rectangle([x, 22, x + 12, 34], fill=colour)
        draw.text((x + 18, 22), text, fill=DIM, font=small)
        x += 24 + draw.textlength(text, font=small)
    draw.text(
        (10, 44),
        "Same cells-per-pixel scale in both panels. Plan view of authored JSON; "
        "not a gameplay screenshot.",
        fill=(110, 120, 132),
        font=small,
    )
    return image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="docs/design-audition/evidence/level2_before_after_footprint.png")
    parser.add_argument("--level", default=LEVEL_PATH)
    args = parser.parse_args()

    base = panel(
        load_baseline(),
        "BEFORE — baseline 1c21a49",
        "Ossuary Fork as shipped: 112x80, one repeated left-entry formula",
    )
    cand = panel(
        load_candidate(args.level),
        "AFTER — candidate B redesign",
        "Ossuary Fork rebuilt at camera scale: jawbone fork, bone well, white choir",
    )
    decorate(base, load_baseline(), [], BASELINE_LABELS)
    decorate(cand, load_candidate(args.level), NEW_ROUTES, NEW_ROOM_LABELS)

    width = max(base.width, cand.width) + 20
    height = base.height + cand.height + legend(width).height + 20
    sheet = Image.new("RGB", (width, height), VOID)
    sheet.paste(base, (10, 10))
    sheet.paste(cand, (10, base.height + 10))
    sheet.paste(legend(width), (0, base.height + cand.height + 10))

    sheet.save(args.out)
    print(f"wrote {args.out} ({sheet.width}x{sheet.height}, {PX}px per cell)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
