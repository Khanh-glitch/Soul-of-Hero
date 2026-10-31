#!/usr/bin/env python3
"""Import the selected A6 interface art from its licensed source packs.

    python3 tools/import_a6_ui_art.py --source-root /tmp/packs

Every output file in `assets/a6_ui/` comes from a pinned Git blob, is cut with the
exact rectangle recorded here, and is written with its provenance next to it in
`assets/a6_ui/PROVENANCE.json`. Nothing is invented: no procedural noise, no
gradient, no "close enough" substitute for art the packs already contain.

What this tool deliberately does **not** do:

  * it never copies a whole pack into the repository - only the panels, buttons,
    slots and icons the UI actually binds to;
  * it never resamples with filtering. Crops are 1:1 and are always aligned to the
    source pixels, so the game can scale them with nearest filtering;
  * it never modifies a source pixel. A nine-slice source keeps its authored corners;
    the receipt says which margins the UI must use and the UI must honour them.

`--verify` re-reads every output and checks its digest against the receipt, so a
tampered or half-written asset fails instead of shipping.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "review"))
import pixel_probe as pp  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "a6_ui"

# ---------------------------------------------------------------------------
# Source packs. Commits are immutable; the repository is the creator's asset repo,
# not this one. `archive` is the exact member name inside that commit.
# ---------------------------------------------------------------------------
PACKS = {
    "255216": {
        "repository": "Khanh-glitch/APEX-CHAOS",
        "commit": "bf11a0cecfda43beca510062bd5d9dc1a8573cc5",
        "branch": "Khanh-glitch-patch-6",
        "archive": "craftpix-net-255216-free-basic-pixel-art-ui-for-rpg.zip",
        "blob": None,  # filled by the fetch receipt
        "product": "https://craftpix.net/freebies/free-basic-pixel-art-ui-for-rpg/",
    },
    "994534": {
        "repository": "Khanh-glitch/APEX-CHAOS",
        "commit": "a960f0945b36614c9754d8dbf2d3e6ec367d449f",
        "branch": "Khanh-glitch-patch-3",
        "archive": "craftpix-net-994534-free-basic-pixel-art-fantasy-icons-16x16-for-ui.zip",
        "blob": None,
        "product": "https://craftpix.net/freebies/free-basic-pixel-art-fantasy-icons-16x16-for-ui/",
    },
}

# ---------------------------------------------------------------------------
# Nine-slice panels. `box` is the absolute rect inside the source PNG; `slice` is
# the margin the UI must use. The margins are chosen so that every authored corner
# detail sits inside a fixed band and the stretched region is flat colour.
# ---------------------------------------------------------------------------
PANELS = [
    # Window: teal title band over parchment, torn corners, right/bottom shadow.
    # Every frame in Inventory.png is exactly 98x101 at x=7, 119 and 231 (measured by
    # connected-component analysis of the sheet), and the band on all three is plain
    # colour - the "INVENTORY" lettering lives in separate elements *below* the
    # frames, which is why the earlier 103x158 crop dragged fake words and a slot
    # grid into the art. The band is 14px (y0 outline, y1 highlight, y2-13 flat), so
    # the top slice margin is 15: the band stays in the unstretched strip and is only
    # repeated horizontally, where it is a flat colour.
    {
        "id": "window",
        "pack": "255216",
        "member": "PNG/Inventory.png",
        "box": (7, 0, 98, 101),
        "slice": (4, 15, 4, 5),
        "scale": 3,
        "note": "teal band (y0-13) + parchment body; lettering-free",
    },
    # Body only: the same frame with the band cropped away, for content cards and
    # nested groups that carry their own heading. y14 is the band's parchment lip, so
    # this keeps a thin top rule and the full wood border.
    {
        "id": "panel",
        "pack": "255216",
        "member": "PNG/Inventory.png",
        "box": (7, 14, 98, 88),
        "slice": (4, 3, 4, 5),
        "scale": 3,
        "note": "parchment body without the title band",
    },
    # Empty cell: a wood-framed dark socket from the action panel. The tan 16x16
    # squares in the inventory grid are flat fill with no frame, so they read as
    # blobs when scaled; this socket has an authored 2px wood edge and a lit lip, and
    # is the shape the pack itself uses for an empty equipment position.
    {
        "id": "slot",
        "pack": "255216",
        "member": "PNG/Action_panel.png",
        "box": (96, 80, 16, 16),
        "slice": (4, 4, 4, 4),
        "scale": 3,
        "note": "wood-framed empty socket",
    },
    # Buttons. The pack's wide pills have words baked into them ("DECLINE",
    # "RESUME", "EQUIPMENT"...), so they cannot be used as generic art. The four
    # small rounded squares are lettering-free: they are the four authored states of
    # one button shape, and nine-slicing the middle gives any width while keeping
    # every corner pixel untouched.
    {
        "id": "button_normal",
        "pack": "255216",
        "member": "PNG/Buttons.png",
        "box": (13, 12, 22, 23),
        "slice": (7, 8, 7, 8),
        "scale": 3,
        "note": "default state",
    },
    {
        "id": "button_hover",
        "pack": "255216",
        "member": "PNG/Buttons.png",
        "box": (61, 13, 22, 22),
        "slice": (7, 7, 7, 7),
        "scale": 3,
        "note": "hover state (second authored shade)",
    },
    {
        "id": "button_pressed",
        "pack": "255216",
        "member": "PNG/Buttons.png",
        "box": (109, 12, 22, 23),
        "slice": (7, 8, 7, 8),
        "scale": 3,
        "note": "pressed state (third authored shade)",
    },
    {
        "id": "button_disabled",
        "pack": "255216",
        "member": "PNG/Buttons.png",
        "box": (157, 13, 22, 22),
        "slice": (7, 7, 7, 7),
        "scale": 3,
        "note": "disabled state (desaturated authored shade)",
    },
    # Bar: a plain authored plank with a lit top edge and a dark underside, five
    # colours total and no lettering. Used for HUD strips and progress tracks. The
    # 168x20 island below it on the same sheet is a strip of nine slots, which is
    # why it is *not* used as a bar.
    {
        "id": "hud_bar",
        "pack": "255216",
        "member": "PNG/Action_panel.png",
        "box": (13, 13, 166, 19),
        "slice": (6, 4, 6, 4),
        "scale": 3,
        "note": "plain wood bar, no lettering",
    },
]

ICON_BY_NAME = {
    # Every binding below was checked by eye on a numbered contact sheet
    # (docs/survival/reviews/labeled_001_064.png, labeled_065_120.png,
    # labeled_32px_1_120.png). Names are the source member, which is literally the
    # pack's icon number, so a re-sort upstream cannot silently shift them.
    #
    # Deliberately absent: a bone, an ore-vs-scrap distinction, and a warning glyph.
    # The pack has nothing unambiguous for those, so those rows show their text name
    # and no icon rather than a plausible-looking wrong picture.
    "oak_wood": "Icon75_1",           # bound bundle of split logs
    "stone_chunk": "Icon19_1",        # pale rough rock
    "iron_scrap": "Icon20_1",         # pale rock with metal flecks
    "iron_ingot": "Icon21_1_2",       # cast silver ingot (32px)
    "reed_fibre": "Icon99_1",         # green leaf cluster
    "fire_wood": "Icon27_1",          # glowing golden fuel bundle
    "crystal_shard": "Icon29_1",      # blue crystal cluster
    "frost_shard": "Icon16_1",        # cold blue gem cluster
    "moonleaf_seed": "Icon73_1",      # sapling
    "furnace_kit": "Icon102_1",       # cauldron on hot coals
    "workbench_kit": "Icon54_1",      # hammer
    "research_kit": "Icon25_1",       # spark of insight (a glow, not a literal scroll)
    "garden_kit": "Icon74_1",         # potted plant
    "station_kit": "Icon53_1",        # pickaxe
    "knife": "Icon57_1",              # short blue blade
    # HUD and status
    "health": "Icon1_1",              # red cross
    # The pack has no house, tent or roof. Icon42 is a lit lantern: it stands for a
    # camp you can see from a distance, which is what the counter measures, and it is
    # not called "shelter" so nothing in the UI claims it is a building.
    "camp_light": "Icon42_1",         # lit lantern
    "time_dawn": "Icon49_1",          # hourglass
    "capacity": "Icon48_1",           # pouch
    "travel": "Icon44_1",             # compass
    "field_meal": "Icon92_1",         # bowl of stew
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def crop(rgba: bytearray, width: int, x: int, y: int, w: int, h: int) -> bytearray:
    out = bytearray()
    for row in range(y, y + h):
        start = (row * width + x) * 4
        out += rgba[start : start + w * 4]
    return out


def find_member(archive: zipfile.ZipFile, wanted: str) -> str:
    if wanted in archive.namelist():
        return wanted
    lowered = wanted.lower()
    for name in archive.namelist():
        if name.lower() == lowered:
            return name
    raise KeyError(wanted)


def load_pack(pack_id: str, source_root: pathlib.Path) -> zipfile.ZipFile:
    path = source_root / f"{pack_id}.zip"
    if not path.is_file():
        raise SystemExit(
            f"missing source pack {path}\n"
            f"fetch it with tools/fetch_a6_ui_sources.sh {source_root}"
        )
    return zipfile.ZipFile(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=pathlib.Path, required=True)
    parser.add_argument("--verify", action="store_true", help="check outputs against the receipt")
    args = parser.parse_args()

    receipt_path = OUT / "PROVENANCE.json"
    if args.verify:
        if not receipt_path.is_file():
            print("no provenance receipt to verify", file=sys.stderr)
            return 1
        receipt = json.loads(receipt_path.read_text())
        bad = 0
        for entry in receipt["assets"]:
            target = ROOT / entry["output"]
            if not target.is_file():
                print(f"MISSING {entry['output']}")
                bad += 1
                continue
            actual = sha256(target.read_bytes())
            if actual != entry["output_sha256"]:
                print(f"CHANGED {entry['output']} ({actual[:12]} != {entry['output_sha256'][:12]})")
                bad += 1
        print(f"A6 UI ART RECEIPT {'FAILED' if bad else 'VERIFIED'} ({len(receipt['assets'])} assets, {bad} problems)")
        return 1 if bad else 0

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "panels").mkdir(exist_ok=True)
    (OUT / "icons").mkdir(exist_ok=True)

    archives = {pid: load_pack(pid, args.source_root) for pid in PACKS}
    assets: list[dict] = []

    # --- panels -----------------------------------------------------------
    for spec in PANELS:
        archive = archives[spec["pack"]]
        member = find_member(archive, spec["member"])
        raw = archive.read(member)
        width, height, rgba = pp.decode_bytes(raw, member)
        x, y, w, h = spec["box"]
        if x + w > width or y + h > height:
            raise SystemExit(f'{spec["id"]}: box {spec["box"]} leaves {width}x{height}')
        tile = crop(rgba, width, x, y, w, h)
        target = OUT / "panels" / f'{spec["id"]}.png'
        pp.encode(target, w, h, tile)
        assets.append({
            "kind": "panel",
            "id": spec["id"],
            "output": str(target.relative_to(ROOT)),
            "source": {
                "pack": spec["pack"],
                **{k: PACKS[spec["pack"]][k] for k in ("repository", "commit", "branch", "archive", "product")},
                "member": member,
                "member_sha256": sha256(raw),
                "rect": [x, y, w, h],
            },
            "size": [w, h],
            "nine_slice_margin": list(spec["slice"]),
            "scale": spec["scale"],
            "note": spec["note"],
            "output_sha256": sha256(target.read_bytes()),
        })

    # --- icons ------------------------------------------------------------
    icon_archive = archives["994534"]
    for item_id, source_name in sorted(ICON_BY_NAME.items()):
        member = find_member(icon_archive, f"PNG/Separately/{source_name}.png")
        raw = icon_archive.read(member)
        width, height, rgba = pp.decode_bytes(raw, member)
        target = OUT / "icons" / f"{item_id}.png"
        pp.encode(target, width, height, rgba)
        assets.append({
            "kind": "icon",
            "id": item_id,
            "output": str(target.relative_to(ROOT)),
            "source": {
                "pack": "994534",
                **{k: PACKS["994534"][k] for k in ("repository", "commit", "branch", "archive", "product")},
                "member": member,
                "member_sha256": sha256(raw),
            },
            "size": [width, height],
            "note": source_name,
            "output_sha256": sha256(target.read_bytes()),
        })

    receipt = {
        "schema": "soh.a6.ui_art_receipt.v1",
        "generated_by": "tools/import_a6_ui_art.py",
        "license": {
            "status": "GAME_USE_SUPPORTED_RAW_REDISTRIBUTION_NOT_APPROVED",
            "url": "https://craftpix.net/file-licenses/",
            "boundary": (
                "These are derivative crops of licensed CraftPix packs, imported so the "
                "game can display them. The source ZIPs are not stored in this repository "
                "and must not be; do not republish these crops as an asset pack."
            ),
        },
        "slice_contract": (
            "nine_slice_margin is authored-corner safe: the UI must set texture_margin_* "
            "to these values and enable nine-slice, never stretch the raw texture."
        ),
        "assets": assets,
    }
    receipt_path.write_text(json.dumps(receipt, indent=1) + "\n", encoding="utf-8")

    panels = [a for a in assets if a["kind"] == "panel"]
    icons = [a for a in assets if a["kind"] == "icon"]
    print(f"imported {len(panels)} panels, {len(icons)} icons -> {OUT}")
    print(f"receipt: {receipt_path}")
    sizes = sorted({tuple(a["size"]) for a in icons})
    print(f"icon sizes present: {sizes}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
