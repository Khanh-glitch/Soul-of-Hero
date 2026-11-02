#!/usr/bin/env python3
"""Assemble the Level 5 review evidence from native frames.

Input: two directories of native Godot frames produced by
`tools/captures/level5_blood_crucible_capture.tscn` —

    before/before_<station>.png   the pinned baseline map (a1ae892)
    after/after_<station>.png     the redesign at this commit

Output: 1280x720 before/after pairs, 4x nearest-neighbour architecture crops,
a single comparison sheet, and a plan route trace rendered from the map JSON.

Everything this writes is either a *native frame* (unchanged pixels, only
cropped and scaled) or an explicitly labelled *plan diagram*. Nothing here draws
gameplay.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
STATIONS = [
    ("f1_spawn", "F1 spawn — the vestibule threshold"),
    ("f1_camp", "F1 guard camp — six-unit court"),
    ("f2_court", "F2 Blood Court — ring and route choice"),
    ("f2_checkpoint", "F2 checkpoint — landing breather"),
    ("f3_approach", "F3 boss approach — antechamber foreshadow"),
    ("f3_archer", "F3 Archer arena — combat state"),
]
# 4x nearest architecture crops: (station, label, fallback centre-x fraction,
# fallback centre-y fraction). The window is not a fixed fraction of the frame:
# an earlier round shipped crops centred on empty floor because the camera looks
# wherever the station does. The centre is now derived from the level document --
# the crop is placed on the densest cluster of Geometry (masonry) around the
# station, inside the frame -- so a crop always shows built architecture. The
# fractions remain only as the fallback for an image whose map is unavailable.
CROPS = [
    ("f1_spawn", "vestibule threshold and sealed gate", 0.30, 0.45),
    ("f1_camp", "guard court buttress and wall face", 0.62, 0.40),
    ("f2_court", "offering basin kerb and blood channel", 0.45, 0.50),
    ("f2_checkpoint", "landing checkpoint dais", 0.24, 0.58),
    ("f3_approach", "antechamber mouth and arena beyond", 0.58, 0.45),
    ("f3_archer", "arena buttress, tier line and dais", 0.72, 0.52),
]
# Station anchors in cells: the same anchors the capture harness stages, so the
# camera is known to be centred on them (1280 x 720, 1:1 pixel scale).
STATION_CELLS = {
    "f1_spawn": (10, 17),
    "f1_camp": (66, 16),
    "f2_court": (30, 48),
    "f2_checkpoint": (10, 49),
    "f3_approach": (64, 76),
    "f3_archer": (105, 74),
}
CROP_PIXELS = 320
CROP_TILE = 16




def _font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def _load(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    return Image.open(path).convert("RGB")


def _label(image: Image.Image, text: str, size: int = 22) -> Image.Image:
    strip = Image.new("RGB", (image.width, size + 12), (16, 14, 18))
    draw = ImageDraw.Draw(strip)
    draw.text((8, 5), text, fill=(230, 226, 218), font=_font(size))
    out = Image.new("RGB", (image.width, image.height + strip.height), (16, 14, 18))
    out.paste(strip, (0, 0))
    out.paste(image, (0, strip.height))
    return out


def build_pairs(before_dir: Path, after_dir: Path, out_dir: Path) -> list[str]:
    written: list[str] = []
    out_dir.mkdir(parents=True, exist_ok=True)
    for station, caption in STATIONS:
        before = _load(before_dir / ("before_%s.png" % station))
        after = _load(after_dir / ("after_%s.png" % station))
        if before is None or after is None:
            print("MISSING pair for %s (before=%s after=%s)"
                  % (station, before is not None, after is not None), file=sys.stderr)
            continue
        pair = Image.new("RGB", (before.width * 2 + 24, before.height + 48), (16, 14, 18))
        pair.paste(_label(before, "BEFORE  %s" % caption), (0, 0))
        pair.paste(_label(after, "AFTER  %s" % caption), (before.width + 24, 0))
        path = out_dir / ("pair_%s.png" % station)
        pair.save(path)
        written.append(str(path))
    return written


def architecture_centres(data_path: Path) -> dict[str, tuple[int, int]]:
    """Screen centre of the densest masonry cluster around each station.

    The camera is centred on the station cell (both the harness and the
    production camera put the Knight at the middle of the frame), so a masonry
    cell at (gx, gy) lands at screen (640 + (gx - sx) * 16, ...). Windowing
    around the richest 20 x 11 tile neighbourhood keeps every crop on built
    architecture instead of on the floor in front of the Knight.
    """
    try:
        document = json.loads(data_path.read_text(encoding="utf-8"))
    except OSError:
        return {}
    layers = document.get("layers", {})
    geometry = {(int(tile["x"]), int(tile["y"])) for tile in layers.get("Geometry", [])}
    floor = {(int(tile["x"]), int(tile["y"])) for tile in layers.get("Backdrop", [])}
    half_w = CROP_PIXELS // 2 // CROP_TILE       # 10 tiles
    half_h = CROP_PIXELS * 9 // 16 // 2 // CROP_TILE  # 5 tiles
    centres: dict[str, tuple[int, int]] = {}
    for station, (sx, sy) in STATION_CELLS.items():
        best = None
        for gx, gy in sorted(geometry):
            if abs(gx - sx) > 14 or abs(gy - sy) > 9:
                continue
            window = [
                (x, y)
                for x in range(gx - half_w, gx + half_w)
                for y in range(gy - half_h, gy + half_h)
            ]
            density = sum(1 for cell in window if cell in geometry)
            walked = sum(1 for cell in window if cell in floor)
            # A crop has to show architecture *in context*. Maximising masonry
            # alone lands the window in the middle of a solid island, which at
            # 4x is a wall of brick and tells a reviewer nothing. Aim for a
            # window that is roughly 42 % masonry and still has floor in it, so
            # kerbs, thresholds and wall feet are what fills the frame.
            fraction = density / float(len(window))
            if walked < len(window) * 0.25:
                continue
            score = (-round(abs(fraction - 0.42), 3), -(abs(gx - sx) + abs(gy - sy)))
            if best is None or score > best[0]:
                best = (score, gx, gy)
        if best is None:
            continue
        _, gx, gy = best
        centres[station] = (640 + (gx - sx) * CROP_TILE, 360 + (gy - sy) * CROP_TILE)
    return centres


def build_crops(after_dir: Path, out_dir: Path, data_path: Path | None = None) -> list[str]:
    written: list[str] = []
    out_dir.mkdir(parents=True, exist_ok=True)
    foci = architecture_centres(data_path) if data_path is not None else {}
    for station, caption, fx, fy in CROPS:
        source = _load(after_dir / ("after_%s.png" % station))
        if source is None:
            print("MISSING capture for crop %s" % station, file=sys.stderr)
            continue
        half_w, half_h = CROP_PIXELS // 2, CROP_PIXELS * 9 // 32
        if station in foci:
            centred_x, centred_y = foci[station]
        else:
            centred_x = int(source.width * fx)
            centred_y = int(source.height * fy)
        left = max(0, min(source.width - CROP_PIXELS, centred_x - half_w))
        top = max(0, min(source.height - CROP_PIXELS * 9 // 16, centred_y - half_h))
        box = (left, top, left + CROP_PIXELS, top + CROP_PIXELS * 9 // 16)
        crop = source.crop(box).resize((1280, 720), Image.NEAREST)
        crop = _label(crop, "AFTER 4x  %s — %s" % (station, caption))
        path = out_dir / ("crop4x_%s.png" % station)
        crop.save(path)
        written.append(str(path))
    return written


def build_sheet(after_dir: Path, out_dir: Path) -> Path | None:
    thumbs = []
    for station, caption in STATIONS:
        source = _load(after_dir / ("after_%s.png" % station))
        if source is None:
            continue
        thumbs.append(_label(source.resize((640, 360), Image.LANCZOS), caption, 18))
    if not thumbs:
        return None
    columns = 2
    rows = (len(thumbs) + columns - 1) // columns
    cell_w = max(t.width for t in thumbs)
    cell_h = max(t.height for t in thumbs)
    sheet = Image.new("RGB", (columns * cell_w + 16, rows * cell_h + 16), (16, 14, 18))
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % columns) * cell_w, (index // columns) * cell_h))
    path = out_dir / "comparison_sheet.png"
    sheet.save(path)
    return path


def build_route_trace(data_path: Path, out_path: Path, title: str) -> bool:
    """Plan diagram of the authored route. Documentation, never gameplay."""
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import render_level_plan as renderer  # noqa: WPS433

    document = json.loads(data_path.read_text(encoding="utf-8"))
    image = renderer.render(document).convert("RGB")
    draw = ImageDraw.Draw(image)
    entities = document["entities"]

    def position_of(entity_id: str) -> tuple[float, float] | None:
        for entity in entities:
            if entity["id"] == entity_id:
                return float(entity["position"][0]), float(entity["position"][1])
        return None

    order = [
        "player_spawn",
        "l5_camp_1_double_anchor_anchor",
        "l5_sigil_camp_1",
        "door_l5_f1_f2_down",
        "l5_checkpoint_floor_2",
        "l5_sigil_blood_ring",
        "l5_sigil_vampire",
        "door_l5_f2_f3_down",
        "l5_sigil_last_guard",
        "l5_checkpoint_before_boss",
        "l5_hooded_archer_miniboss",
        "l5_exit",
    ]
    camps = {camp["id"]: camp for camp in document["metadata"].get("combat_camps", [])}
    points: list[tuple[str, tuple[float, float]]] = []
    for entity_id in order:
        if entity_id.endswith("_anchor"):
            camp = camps.get(entity_id.replace("_anchor", ""))
            if camp is None:
                continue
            cell = camp["entry_cell"]
            points.append((entity_id.replace("_anchor", ""), (cell[0] * 16 + 8.0, cell[1] * 16 + 8.0)))
            continue
        found = position_of(entity_id)
        if found is not None:
            points.append((entity_id, found))

    floor = {(c["x"], c["y"]) for c in document["layers"]["Backdrop"]}
    geometry = {(c["x"], c["y"]) for c in document["layers"]["Geometry"]}
    # Knight clearance: the body is 12 x 16 with its feet on the cell centre, so
    # a cell also needs the cell above it to be free of masonry.
    clear = {
        c for c in floor
        if c not in geometry and (c[0], c[1] - 1) not in geometry
    }
    doors = {}
    for entity in entities:
        if entity["type"] != "floor_door":
            continue
        source = (entity["position"][0] // 16, entity["position"][1] // 16)
        target = entity["target_position"]
        doors[source] = (target[0] // 16, target[1] // 16)

    def walk(a, b):
        """Breadth-first terrain walk, using the level's own floor doors."""
        if a not in clear or b not in clear:
            return []
        previous = {a: None}
        queue = [a]
        cursor = 0
        while cursor < len(queue):
            current = queue[cursor]
            cursor += 1
            if current == b:
                break
            neighbours = [
                (current[0] + 1, current[1]),
                (current[0] - 1, current[1]),
                (current[0], current[1] + 1),
                (current[0], current[1] - 1),
            ]
            if current in doors:
                neighbours.append(doors[current])
            for neighbour in neighbours:
                if neighbour in clear and neighbour not in previous:
                    previous[neighbour] = current
                    queue.append(neighbour)
        if b not in previous:
            return []
        path = [b]
        while previous[path[-1]] is not None:
            path.append(previous[path[-1]])
        return list(reversed(path))

    colour = (255, 214, 120)
    ascent = (120, 210, 255)
    for index in range(len(points) - 1):
        start = (int(points[index][1][0] // 16), int(points[index][1][1] // 16))
        end = (int(points[index + 1][1][0] // 16), int(points[index + 1][1][1] // 16))
        if index + 1 < len(points):
            # A storey change is drawn as a dashed link between the two floor maps,
            # so a straight line across the black gap between storeys is never read
            # as terrain.
            if abs(start[1] - end[1]) > 8 and (end[1] - start[1]) > 8:
                x0, y0 = points[index][1]
                x1, y1 = points[index + 1][1]
                steps = 40
                for step in range(0, steps, 2):
                    draw.line(
                        [
                            (x0 + (x1 - x0) * step / steps, y0 + (y1 - y0) * step / steps),
                            (x0 + (x1 - x0) * (step + 1) / steps, y0 + (y1 - y0) * (step + 1) / steps),
                        ],
                        fill=ascent,
                        width=3,
                    )
                draw.text((x1 + 10, y1 + 8), "door", fill=ascent, font=_font(15))
                continue
        path = walk(start, end)
        if len(path) < 2:
            print("NO WALKABLE ROUTE %s -> %s" % (points[index][0], points[index + 1][0]),
                  file=sys.stderr)
            continue
        for pixel in path:
            draw.point((pixel[0] * 16 + 8, pixel[1] * 16 + 8), fill=colour)
        draw.line([(p[0] * 16 + 8, p[1] * 16 + 8) for p in path], fill=colour, width=2)
    for index, (name, position) in enumerate(points):
        radius = 7
        draw.ellipse(
            [position[0] - radius, position[1] - radius, position[0] + radius, position[1] + radius],
            fill=(240, 60, 60),
            outline=(255, 240, 210),
        )
        draw.text((position[0] + 10, position[1] - 6), "%d" % (index + 1), fill=(255, 244, 220), font=_font(16))
    for spike in entities:
        if spike["type"] != "spikes":
            continue
        x, y = spike["position"]
        draw.rectangle([x - 3, y - 3, x + 3, y + 3], fill=(190, 60, 60))
    banner = Image.new("RGB", (image.width, 46), (16, 14, 18))
    ImageDraw.Draw(banner).text(
        (8, 6),
        "%s — authored route (PLAN DIAGRAM, not a native capture): "
        "route drawn along walkable Knight-clear cells and the level's own doors; "
        "solid = walked terrain, dashed cyan = floor door; "
        "1 spawn, 2 camp 1, 3 sigil 1, 4 descent, 5 checkpoint, 6 sigil 2, "
        "7 sigil 3, 8 descent, 9 sigil 4, 10 checkpoint, 11 Archer, 12 exit" % title,
        fill=(235, 230, 220),
        font=_font(17),
    )
    out = Image.new("RGB", (image.width, image.height + 46), (16, 14, 18))
    out.paste(banner, (0, 0))
    out.paste(image, (0, 46))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path)
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", default="docs/level-design/level5-redesign/before")
    parser.add_argument("--after", default="docs/level-design/level5-redesign/after")
    parser.add_argument("--out", default="docs/level-design/level5-redesign/comparisons")
    parser.add_argument("--evidence", default="docs/level-design/level5-redesign/evidence")
    parser.add_argument("--data", default="data/levels/chapter_1_level_5.json")
    parser.add_argument("--baseline", default="prototypes/level5/baseline/chapter_1_level_5.json")
    parser.add_argument("--title", default="Level 5 Blood Crucible")
    args = parser.parse_args()

    out_dir = ROOT / args.out
    evidence_dir = ROOT / args.evidence
    pairs = build_pairs(ROOT / args.before, ROOT / args.after, out_dir)
    crops = build_crops(ROOT / args.after, evidence_dir / "crops", ROOT / args.data)
    sheet = build_sheet(ROOT / args.after, out_dir)
    trace_after = build_route_trace(
        ROOT / args.data, evidence_dir / "route_trace_after.png", args.title + " — redesign"
    )
    trace_before = build_route_trace(
        ROOT / args.baseline, evidence_dir / "route_trace_before.png", args.title + " — pinned baseline"
    )
    print("PAIRS %d" % len(pairs))
    print("CROPS %d" % len(crops))
    print("SHEET %s" % (sheet,))
    print("TRACE after=%s before=%s" % (trace_after, trace_before))
    return 0 if pairs and crops and sheet and trace_after and trace_before else 1


if __name__ == "__main__":
    raise SystemExit(main())
