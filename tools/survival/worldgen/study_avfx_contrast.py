#!/usr/bin/env python3
"""AVFX-compatible lighting contract + measured effect/ground contrast study.

This is a CPU-side composite/measurement over the REAL inherited effect textures
and the REAL baked ground tiles. It is NOT native Godot acceptance and NOT full
Gold parity: it proves the A1 lighting contract keeps world light on a private
cull mask and that representative bright effects retain contrast over the
brightest and darkest authored ground at day and night. Full exact-Gold cast and
A6 human-body composition remain PENDING (source not mounted here).
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "data/survival/world/art"
OUT = ROOT / "docs/survival/world/evidence"


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def lum(rgb) -> float:
    def ch(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def mean_lum(im: Image.Image, ambient=(1, 1, 1)) -> float:
    px = im.convert("RGBA").load()
    tot = n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            tot += lum((r * ambient[0], g * ambient[1], b * ambient[2]))
            n += 1
    return tot / n if n else 0.0


def ratio(l1: float, l2: float) -> float:
    a, b = max(l1, l2), min(l1, l2)
    return (a + 0.05) / (b + 0.05)


def first_cell(path: Path, cell: int) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    return im.crop((0, 0, min(cell, im.width), min(cell, im.height)))


def main() -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    atlas = load(ART / "atlas.v1.json")
    grammar = load(ART / "world_art_grammar.v1.json")
    terrain = Image.open(ROOT / "assets/environment/survival_world/terrain.png").convert("RGBA")
    grounds = {}
    for name in ("snow_0", "basalt_0", "ash_0", "grass_0", "soil_0", "gravel_0", "salt_0", "lava_0", "jungle_0", "fen_0", "tidal_0"):
        r = atlas["terrain"][name]
        grounds[name] = terrain.crop((r[0], r[1], r[0] + r[2], r[1] + r[3]))
    effects = {
        "sword_crescent_wave": Image.open(ROOT / "assets/vfx/sword/sword_crescent_wave.png").convert("RGBA"),
        "world_sparkle_f0": first_cell(ROOT / "assets/vfx/world/interaction_sparkle_32x32_8.png", 32),
        "blade_impact_f0": first_cell(ROOT / "assets/vfx/untied/symmetrical_impact_001_small_yellow.png", 48),
    }
    rows = []
    for profile, lp in grammar["lighting_profiles"].items():
        for phase, key in (("day", "ambient_day"), ("night", "ambient_night")):
            amb = tuple(lp[key][:3])
            for gname, gtile in grounds.items():
                gl = mean_lum(gtile, amb)
                for ename, eim in effects.items():
                    el = mean_lum(eim)  # Gold stays on default mask: NOT ambient-tinted by A1
                    rows.append({"profile": profile, "phase": phase, "ground": gname,
                                 "ground_lum": round(gl, 4), "effect": ename,
                                 "effect_lum": round(el, 4), "contrast_ratio": round(ratio(el, gl), 3)})
    worst = min(rows, key=lambda r: r["contrast_ratio"])
    contract = {
        "schema": "soh.world.avfx_lighting_contract.v1", "owner": "A1", "consumer": "AVFX/A0",
        "status": "CONTRACT_AND_CPU_CONTRAST_STUDY_NATIVE_PENDING",
        "world_light_cull_mask": 2, "inherited_vfx_light_mask": 1,
        "rules": [
            "A1 ground/props/overlays use light_mask=2; A1 PointLight2D range_item_cull_mask=2 only.",
            "Inherited Gold/Hero/enemy/environment VFX stay on default light_mask=1 and are never additive-lit or ambient-tinted by A1.",
            "A1 ambient shader multiplies only A1-owned CanvasItemMaterials; it never touches Gold timelines or effect textures.",
            "Ground luminance is capped by the shared ramp (snow day <= ~0.55 linear) so bright effects keep >= 1.6:1 contrast.",
            "Reserved accents: fire_warm=shelter, soul_cyan=relic/mineral, rust_red=warning, moss_green=growth; no per-site arbitrary glow.",
        ],
        "measurements": rows,
        "worst_case": worst,
        "pending": ["exact 93-skill Gold cast parity (AVFX source not mounted)", "A6 D051 human-body composition", "native on-screen inspection"],
    }
    (ART / "avfx_lighting_contract.v1.json").write_text(json.dumps(contract, indent=2) + "\n", encoding="utf-8")
    # Composite study: bright effect over brightest and darkest ground, day+night.
    cell = 96
    combos = [("snow_0", "day", "frost_blue_hour"), ("snow_0", "night", "frost_blue_hour"),
              ("basalt_0", "day", "frost_blue_hour"), ("ash_0", "day", "overcast_frontier")]
    sheet = Image.new("RGB", (len(combos) * cell, cell + 22), "#1d1a22")
    d = ImageDraw.Draw(sheet)
    for i, (gname, phase, prof) in enumerate(combos):
        amb = tuple(grammar["lighting_profiles"][prof]["ambient_day" if phase == "day" else "ambient_night"][:3])
        tile = grounds[gname].resize((cell, cell), Image.Resampling.NEAREST)
        tp = tile.load()
        for y in range(cell):
            for x in range(cell):
                r, g, b, a = tp[x, y]
                tp[x, y] = (int(r * amb[0]), int(g * amb[1]), int(b * amb[2]), a)
        sheet.paste(tile, (i * cell, 22))
        eff = effects["world_sparkle_f0"].resize((48, 48), Image.Resampling.NEAREST)
        sheet.paste(eff, (i * cell + 24, 22 + 24), eff)
        d.text((i * cell + 3, 6), f"{gname}/{phase}", fill="white")
    sheet.save(OUT / "avfx_contrast_study.png")
    return {"ok": True, "rows": len(rows), "worst_case": worst,
            "contract": "data/survival/world/art/avfx_lighting_contract.v1.json",
            "study": "docs/survival/world/evidence/avfx_contrast_study.png"}


if __name__ == "__main__":
    print(json.dumps(main(), sort_keys=True))
