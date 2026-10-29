"""Emit JSON Schema (2020-12) contracts for A0/A3/A5/A6. Deterministic."""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parents[3] / "data" / "survival" / "world" / "schemas"
D = "https://json-schema.org/draft/2020-12/schema"

def s(title, typ, props=None, req=None, **kw):
    o = {"$schema": D, "$id": f"soh://world/{title}.v1.json", "title": title, "type": typ}
    if props: o["properties"] = props
    if req: o["required"] = req
    o.update(kw)
    return o

ID = {"type": "string", "minLength": 1}
CELL = {"type": "array", "items": {"type": "integer"}, "minItems": 2, "maxItems": 2}
RECT = {"type": "array", "items": {"type": "integer"}, "minItems": 4, "maxItems": 4}
CAPS = {"type": "array", "items": {"type": "string", "pattern": "^cap_[a-z0-9_]+$"}}

SCHEMAS = {
"region": s("region", "object", {
    "region_id": {"type":"string","pattern":"^r_[a-z0-9_]+$"}, "name": {"type":"string"}, "rect": RECT,
    "band": {"enum":["early","mid","late"]}, "base_elevation_m":{"type":"number"}, "climate":{"type":"string"},
    "geology":{"type":"string"}, "soils":{"type":"string"}, "allowed_biomes":{"type":"array","items":{"type":"string"}},
    "material_keys":{"type":"array","items":{"type":"string"}}, "identity":{"type":"string"}, "revisit_hook":{"type":"string"},
    "entry_capabilities": CAPS, "contains_legacy_inset":{"type":"boolean"}, "status":{"type":"string"}},
    ["region_id","name","rect","band","allowed_biomes","material_keys","identity","revisit_hook","entry_capabilities"]),
"biome": s("biome", "object", {
    "surface":{"type":"string"}, "walkable":{"type":"boolean"}, "buildable":{"type":"boolean"},
    "color":{"type":"array","items":{"type":"integer","minimum":0,"maximum":255},"minItems":3,"maxItems":3},
    "resources":{"type":"array","items":{"type":"string"}}}, ["surface","walkable","buildable","color","resources"]),
"elevation": s("elevation", "object", {
    "chunk_id":{"type":"string"}, "elevation_band_rle":{"type":"array","items":{"type":"array","items":{"type":"integer"},"minItems":2,"maxItems":2}},
    "band_size_m":{"type":"integer","const":50}, "legacy_elevation":{"const":"UNKNOWN_NOT_FABRICATED"}}, ["chunk_id","elevation_band_rle","band_size_m"]),
"hydrology": s("hydrology", "object", {
    "rivers":{"type":"array","items":{"type":"object","required":["river_id","vertices","outlet","width_tiles"],
        "properties":{"river_id":ID,"vertices":{"type":"array","items":{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3}},"outlet":{"type":"string"},"width_tiles":{"type":"number","minimum":1}}}},
    "lakes":{"type":"array","items":{"type":"object","required":["lake_id","center","water_level_m"],"properties":{"lake_id":ID,"center":CELL,"water_level_m":{"type":"number"}}}},
    "subsurface_hydrology":{"type":"array"}}, ["rivers","lakes"]),
"resource": s("resource", "object", {
    "node_id":{"type":"string","pattern":"^res:[a-z0-9_]+:[0-9]{2}$"}, "site_id":ID, "region_id":ID,
    "material_key":ID, "cell":CELL, "cause":{"type":"string"}, "biome_constraint":{"type":"string"},
    "required_capabilities":CAPS, "renewal":{"type":"string"}, "status":{"type":"string"}},
    ["node_id","site_id","region_id","material_key","cell","cause","required_capabilities","renewal"]),
"poi": s("poi", "object", {
    "poi_id":ID, "region_id":ID, "name":{"type":"string"}, "archetype":{"type":"string"}, "cell":CELL,
    "band":{"enum":["early","mid","late"]}, "purpose":{"type":"string"}, "material_keys":{"type":"array","items":{"type":"string"}},
    "required_capabilities":CAPS, "grants_capabilities":CAPS, "access_stages":{"type":"array","items":{"type":"object"}},
    "footprint_radius_tiles":{"type":"integer","minimum":1}, "preserved_legacy":{"type":"boolean"}, "status":{"type":"string"}},
    ["poi_id","region_id","name","archetype","cell","band","purpose","required_capabilities","access_stages","preserved_legacy"]),
"route": s("route", "object", {
    "route_id":ID, "from":ID, "to":ID, "polyline":{"type":"array","items":CELL,"minItems":2},
    "mode":{"enum":["foot","pass","boat","legacy_path"]}, "required_capabilities":CAPS, "risk":{"type":"string"}, "kind":{"enum":["trunk","spur"]}},
    ["route_id","from","to","polyline","mode","required_capabilities"]),
"chunk": s("chunk", "object", {
    "schema":{"const":"soh.world.chunk.v1"}, "chunk_id":{"type":"string","pattern":"^chunk:[0-9]+:[0-9]+$"},
    "origin":CELL, "size":CELL, "tile_px":{"const":16}, "layers":{"type":"object"}, "legend":{"type":"object"}},
    ["schema","chunk_id","origin","size","tile_px","layers","legend"]),
"identity": s("identity", "object", {
    "world_id":ID, "region_id_pattern":{"type":"string"}, "poi_id_pattern":{"type":"string"}, "chunk_id_pattern":{"type":"string"},
    "resource_node_id_pattern":{"type":"string"}, "legacy_ids":{"type":"string"}, "dynamic_state":{"type":"string"}},
    ["world_id","region_id_pattern","poi_id_pattern","chunk_id_pattern","resource_node_id_pattern","legacy_ids","dynamic_state"]),
"masterplan": s("masterplan", "object", {
    "schema":{"const":"soh.world.masterplan.v1"}, "world_id":ID, "status":{"type":"string"}, "frame":{"type":"object"},
    "legacy_inset":{"type":"object"}, "starter_quarter":{"type":"object"}, "chunk_size":{"type":"integer"}, "regions":{"type":"array"},
    "biomes":{"type":"object"}, "materials":{"type":"object"}, "capabilities":{"type":"object"}, "hazards":{"type":"array"},
    "rivers":{"type":"array"}, "lakes":{"type":"array"}, "pois":{"type":"array"}, "route_graph":{"type":"object"},
    "resource_sites":{"type":"array"}, "resource_nodes":{"type":"array"}, "long_run_goals":{"type":"array"},
    "chunk_manifest":{"type":"array"}, "metrics":{"type":"object"}, "identity_contract":{"type":"object"}, "integration":{"type":"object"}},
    ["schema","world_id","status","frame","legacy_inset","starter_quarter","regions","pois","route_graph","resource_nodes","chunk_manifest","metrics","identity_contract","integration"]),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, schema in SCHEMAS.items():
        (OUT / f"{name}.schema.json").write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {len(SCHEMAS)} schemas to {OUT}")
