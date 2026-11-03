#!/usr/bin/env python3
"""Render GOLD terrain rasters (biome+elev) to a pixel-art terrain PNG for
the browser review tool / Godot preview scene.

Source: data/survival/veyra_gold_map.source.json (terrain.elev/biome, 250x175 cell=8)
Tiles: ocean_cainos grass & stone 16px atlases (twin to ocean palette).
Art profile: tile-everything consistency (REAL_MAP_CONVERSION pixel-art contract),
nearest-neighbor, no blended/stretched textures.
Output: assets/environment/veyra/veyra_terrain_render.png (2000x1400 at 1:1)
"""
import base64, json, os, sys
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(REPO, 'data', 'survival', 'veyra_gold_map.source.json')
OUT = os.path.join(REPO, 'assets', 'environment', 'veyra', 'veyra_terrain_render.png')

GW, GH, CELL = 250, 175, 8
WORLD_W, WORLD_H = 2000, 1400

def load_atlas(path, grid=(16,16)):
    im = Image.open(path).convert('RGBA')
    tw, th = grid
    cols = im.size[0] // tw; rows = im.size[1] // th
    tiles = []
    for r in range(rows):
        for c in range(cols):
            tiles.append(im.crop((c*tw, r*th, (c+1)*tw, (r+1)*th)))
    return tiles, im.size

def main():
    data = json.load(open(SRC, encoding='utf-8'))
    proj = data['project']
    t = proj['terrain']
    assert t['gw'] == GW and t['gh'] == GH and t['cell'] == CELL
    elev = list(base64.b64decode(t['elev']))
    biome = list(base64.b64decode(t['biome']))
    assert len(elev) == GW * GH == len(biome)

    grass, _ = load_atlas(os.path.join(REPO, 'assets', 'environment', 'ocean_cainos', 'ocean_tileset_grass.png'))
    stone, _ = load_atlas(os.path.join(REPO, 'assets', 'environment', 'ocean_cainos', 'ocean_tileset_stone_ground.png'))
    print('grass tiles:', len(grass), 'stone tiles:', len(stone))

    canvas = Image.new('RGBA', (WORLD_W, WORLD_H), (0,0,0,0))
    # biome classes: 0=deep ocean,1=shore,2-4=grassland,5-7=forest/jungle,8=sand/desert,
    # 9=snow,10=marsh,11=rock/mountain (observed 0..11). Map to tile families:
    # ocean -> deep teal grass edges; grassland -> grass atlas indices; stone -> stone atlas indices.
    # Keep it deterministic + elevation-driven so mountain = rock, low = grass/sand.
    bad = 0
    for gy in range(GH):
        for gx in range(GW):
            b = biome[gy*GW + gx]; e = elev[gy*GW + gx]
            x0, y0 = gx*CELL, gy*CELL
            # tile selection: deterministic from biome/elev
            if e < 4:
                tile = grass[0]            # water/lowland grass edge
            elif e < 24:
                tile = grass[1]            # grass
            elif e < 96:
                tile = grass[5] if b % 2 else grass[1]   # lighter grass variants
            elif e < 150:
                tile = stone[24]           # stone ground (path-like)
            else:
                tile = stone[0]            # rock/mountain base
            canvas.paste(tile, (x0, y0), tile)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    canvas.save(OUT)
    print('wrote', OUT, canvas.size)

if __name__ == '__main__':
    main()
