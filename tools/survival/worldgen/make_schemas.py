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
RLE = {"type": "array", "minItems": 1, "items": {"type": "array", "items": {"type": "integer", "minimum": 0}, "minItems": 2, "maxItems": 2}}
REQUIRED_LAYERS = ["region", "biome", "surface", "walk", "build", "build_permission", "hazard", "road", "preserved", "elevation_band"]
LAYER_PROPS = {k: RLE for k in REQUIRED_LAYERS}
LAYER_PROPS["build_permission"] = {"type": "array", "minItems": 1, "items": {"type": "array", "minItems": 2, "maxItems": 2, "items": [{"type": "integer", "enum": [0, 1, 2]}, {"type": "integer", "minimum": 1}]}}
for k in ("walk", "build", "road", "preserved"):
    LAYER_PROPS[k] = {"type": "array", "minItems": 1, "items": {"type": "array", "minItems": 2, "maxItems": 2, "items": [{"type": "integer", "enum": [0, 1]}, {"type": "integer", "minimum": 1}]}}

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
    "footprint_radius_tiles":{"type":"integer","minimum":1}, "preserved_legacy":{"type":"boolean"}, "status":{"type":"string"},
    "content_readiness":{"enum":["WORLD_SITE_CONTRACT_ONLY","INTERACTION_SPEC_AUTHORED_NOT_NATIVE","PRESERVED_BASELINE"]},
    "authoring_spec_ref":{"type":["string","null"]}},
    ["poi_id","region_id","name","archetype","cell","band","purpose","required_capabilities","access_stages","preserved_legacy","content_readiness"]),
"route": s("route", "object", {
    "route_id":ID, "from":ID, "to":ID, "polyline":{"type":"array","items":CELL,"minItems":2},
    "mode":{"enum":["foot","pass","boat","legacy_path"]}, "required_capabilities":CAPS, "risk":{"type":"string"}, "kind":{"enum":["trunk","spur"]}},
    ["route_id","from","to","polyline","mode","required_capabilities"]),
"chunk": s("chunk", "object", {
    "schema":{"const":"soh.world.chunk.v1"}, "chunk_id":{"type":"string","pattern":"^chunk:[0-9]+:[0-9]+$"},
    "origin":CELL, "size":CELL, "tile_px":{"const":16},
    "layers":{"type":"object", "properties":LAYER_PROPS, "required":REQUIRED_LAYERS, "additionalProperties":False},
    "legend":{"type":"object"}},
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
    "chunk_manifest":{"type":"array"}, "metrics":{"type":"object"}, "identity_contract":{"type":"object"}, "integration":{"type":"object"},
    "layer_semantics":{"type":"object"}},
    ["schema","world_id","status","frame","legacy_inset","starter_quarter","regions","pois","route_graph","resource_nodes","chunk_manifest","metrics","identity_contract","integration","layer_semantics"]),
"hazard_damage": s("hazard_damage", "object", {
    "schema":{"const":"soh.world.hazard_damage.v1"}, "status":{"type":"string"}, "native_playable":{"const":False},
    "hazards":{"type":"array","items":{"type":"object","required":["hazard_id","kind","rect","required_capability","severity","unmitigated_hp_per_second_proposal","mitigation","retreat_rule"]}},
    "novice_safe_route":{"type":"object","required":["route_id","max_authored_hazard_tiles"]}, "hazardous_shortcut":{"type":"object"}},
    ["schema","status","native_playable","hazards","novice_safe_route","hazardous_shortcut"]),
"novice_bootstrap": s("novice_bootstrap", "object", {
    "schema":{"const":"soh.world.novice_bootstrap.v1"}, "status":{"type":"string"}, "native_playable":{"const":False},
    "stages":{"type":"array","minItems":3,"items":{"type":"object","required":["stage","poi","route_id","grants","retreat_route_id"]}},
    "bootstrap":{"type":"object"}, "circularity_rule":{"type":"string"}, "safe_route_ids":{"type":"array","items":{"type":"string"}}},
    ["schema","status","native_playable","stages","bootstrap","circularity_rule","safe_route_ids"]),
"material_decisions": s("material_decisions", "object", {
    "schema":{"const":"soh.world.a1_a3_material_decisions.v1"}, "status":{"type":"string"}, "a3_review_source":{"type":"object"},
    "alias_decisions":{"type":"array","minItems":8,"maxItems":8,"items":{"type":"object","required":["material_key","proposed_a3_ids","decision","priority","reason","a3_action","preserved_provenance","preserved_renewal","preserved_sinks"],"properties":{"decision":{"enum":["APPROVE","REJECT","SPLIT","DEFER"]}}}},
    "missing_items":{"type":"array","minItems":12,"maxItems":12,"items":{"type":"object","required":["material_key","priority","dependency","first_hour_blocking"]}},
    "counts":{"type":"object"}, "a3_code_changed_by_a1":{"const":False}},
    ["schema","status","a3_review_source","alias_decisions","missing_items","counts","a3_code_changed_by_a1"]),
"poi_authoring": s("poi_authoring", "object", {
    "schema":{"const":"soh.world.poi_authoring.v1"}, "poi_id":ID, "content_readiness":{"const":"INTERACTION_SPEC_AUTHORED_NOT_NATIVE"}, "native_playable":{"const":False},
    "footprint_radius_tiles":{"type":"integer","minimum":1}, "purpose":{"type":"string"},
    "approach_topology":{"type":"object","required":["nodes","edges","retreat_path","safe_route_id"]},
    "world_state_actions":{"type":"array","minItems":2,"items":{"type":"object","required":["action_id","kind","requires_capabilities","one_time","effects","failure_recovery"]}},
    "rewards":{"type":"array","minItems":1,"items":{"type":"object","required":["reward_id","policy","rarity"]}},
    "persistence":{"type":"object","required":["save_owner","keys","one_time_flags","static_plan_mutation"]},
    "failure_recovery":{"type":"object"}, "map_clues":{"type":"array","minItems":1},
    "interface_requirements":{"type":"array","minItems":3,"items":{"type":"object","required":["owner","test_id","requirement"],"properties":{"owner":{"enum":["A0","A3","A6"]}}}},
    "alternate_approach":{"type":"string"}, "refresh_policy":{"type":"string"}},
    ["schema","poi_id","content_readiness","native_playable","footprint_radius_tiles","purpose","approach_topology","world_state_actions","rewards","persistence","failure_recovery","map_clues","interface_requirements","alternate_approach","refresh_policy"]),
"reader_contract": s("reader_contract", "object", {
    "schema":{"const":"soh.world.reader_contract.v1"}, "world_id":ID, "plan_sha256":{"type":"string","pattern":"^[0-9a-f]{64}$"},
    "frame":{"type":"object"}, "legacy_inset":{"type":"object"}, "chunk_size":{"type":"integer","const":64},
    "required_layers":{"type":"array","items":{"type":"string"},"minItems":10,"maxItems":10},
    "layer_semantics":{"type":"object"}, "sample_cells":{"type":"object"}, "legacy_delegate_contract":{"type":"object"},
    "native_playable":{"const":False}},
    ["schema","world_id","plan_sha256","frame","legacy_inset","chunk_size","required_layers","layer_semantics","sample_cells","legacy_delegate_contract","native_playable"]),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, schema in SCHEMAS.items():
        (OUT / f"{name}.schema.json").write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {len(SCHEMAS)} schemas to {OUT}")
