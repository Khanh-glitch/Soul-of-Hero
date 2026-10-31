"""Independent oracles: claims A7 checks against something other than the owners' prose.

Every check here answers a question whose answer does **not** come from the file
being judged:

* `api_audit` compares GDScript static calls with the engine's own class
  documentation, so a call to a method that does not exist is caught even when the
  owner's CI is green on an import-only step;
* `save_fidelity` compares the save writer with Godot's `JSON.stringify`
  contract, so "reload gives back exactly what I wrote" is a computed condition
  rather than an assumption;
* `knowledge_gate` walks the *actual* recipe/source graph to find whether the
  first-hour progression ladder has a non-circular entry point;
* `authorization_claims` refuses a quantity that is merely *called* authorized:
  the number must exist in the pinned A3 bytes for the same source id.

None of this runs Godot. Each function returns plain data so it can be diffed
between commits, and each returns the *evidence rows* that produced its verdict.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence

DATA_DIR = Path(__file__).resolve().parents[4] / "data" / "survival" / "balance"
ENGINE_API_FILE = DATA_DIR / "engine_api.v1.json"

# A static call in GDScript is written `Type.method(`. Anything after a `#` is a
# comment and never executes, so it is stripped before scanning.
_COMMENT = re.compile(r"#.*$")


def engine_api(path: Optional[Path] = None) -> Dict[str, object]:
    return json.loads((path or ENGINE_API_FILE).read_text(encoding="utf-8"))


def _live_lines(text: str) -> Iterable[tuple]:
    for number, line in enumerate(text.splitlines(), start=1):
        code = _COMMENT.sub("", line)
        if not code.strip() or code.lstrip().startswith("#"):
            continue
        yield number, code


def api_audit(texts: Dict[str, str], api: Optional[Dict[str, object]] = None) -> Dict[str, object]:
    """Flag `Type.method(` where the engine class has no such static method."""
    table = (api or engine_api()).get("static_methods", {})  # type: ignore[union-attr]
    pattern = re.compile(r"\b(" + "|".join(sorted(map(re.escape, table))) + r")\.([A-Za-z_][A-Za-z0-9_]*)\s*\(")
    calls: List[Dict[str, object]] = []
    unknown: List[Dict[str, object]] = []
    for key in sorted(texts):
        if not key.endswith(".gd"):
            continue
        for number, code in _live_lines(texts[key]):
            for match in pattern.finditer(code):
                receiver, name = match.group(1), match.group(2)
                if name == "new":
                    # `Type.new()` is a constructor, not a static method.
                    continue
                allowed = set(table[receiver])
                row = {
                    "file": key,
                    "line": number,
                    "call": f"{receiver}.{name}",
                    "is_engine_static": name in allowed,
                }
                calls.append(row)
                if name not in allowed:
                    unknown.append(row)
    return {
        "audited_types": sorted(table),
        "static_call_count": len(calls),
        "unknown_call_count": len(unknown),
        "unknown_calls": unknown,
        "verdict": "ENGINE_API_CONSISTENT" if not unknown else "UNKNOWN_ENGINE_STATIC",
        "proves": (
            "that no audited built-in class is called through a method it does not expose. It does not "
            "prove the surrounding code runs, only that these calls cannot be the reason it fails."
        ),
    }


def save_fidelity(texts: Dict[str, str]) -> Dict[str, object]:
    """Does the authoritative save writer guarantee a float-exact round trip?

    Godot's `JSON.stringify(value, indent, sort_keys, full_precision)` writes
    floats with `14 - floor(log10(|x|))` decimals unless `full_precision` is true
    (core/io/json.cpp). A value needing more digits therefore comes back from
    `JSON.parse_string` as a *different* double, and any equality check between
    in-memory state and reloaded state fails for reasons unrelated to ownership.
    """
    writers: List[Dict[str, object]] = []
    for key in sorted(texts):
        if not key.endswith(".gd"):
            continue
        for number, code in _live_lines(texts[key]):
            for match in re.finditer(r"JSON\.stringify\(", code):
                tail = code[match.end() : match.end() + 120]
                depth, args = 1, []
                current = ""
                for char in tail:
                    if char in "([{":
                        depth += 1
                    elif char in ")]}":
                        depth -= 1
                        if depth == 0:
                            break
                    elif char == "," and depth <= 2:
                        args.append(current.strip())
                        current = ""
                        continue
                    current += char
                args.append(current.strip())
                full_precision = len(args) >= 4 and args[3].lower() in ("true", "1")
                writers.append(
                    {
                        "file": key,
                        "line": number,
                        "argument_count": len(args),
                        "full_precision": full_precision,
                        "text": code.strip()[:160],
                    }
                )
    # Only the writers that serialise the authoritative document matter for a
    # restart comparison. Telemetry and signature inputs are recorded but not
    # graded, so the verdict cannot be argued away by an unrelated call site.
    authoritative_names = {"snapshot", "_data", "candidate", "document"}
    authority = re.compile(
        r"JSON\.stringify\(\s*(" + "|".join(sorted(authoritative_names)) + r")\b"
    )
    for row in writers:
        row["authoritative"] = bool(authority.search(row["text"]))
    lossy = [row for row in writers if row["authoritative"] and not row["full_precision"]]
    return {
        "writers": writers,
        "lossy_writer_count": len(lossy),
        "lossy_writers": lossy,
        "authoritative_writer_count": len([row for row in writers if row["authoritative"]]),
        "verdict": "ROUND_TRIP_EXACT" if not lossy else "FLOAT_ROUND_TRIP_NOT_GUARANTEED",
        "formula": "decimals = max(1, 14 - floor(log10(abs(value)))) when full_precision is false",
        "proves": (
            "whether a float written by the save writer is guaranteed to reload bit-identically. "
            "It cannot say which field drifted in a native run; it only says the writer allows drift."
        ),
    }


def knowledge_gate(model, catalog: Optional[Dict[str, object]] = None) -> Dict[str, object]:
    """Is the first research station reachable without already owning one?

    Walks the real graph: `station_research` is placed from `research_kit`,
    `research_kit` consumes `knowledge_spares`, and every recipe that produces
    spares is checked for the station it needs. A spare source behind a station
    that itself needs spares is circular and cannot seed the ladder.
    """
    spare_recipes = {
        recipe_id: {
            "station": (recipe.get("station") or "hand"),
            "inputs": recipe.get("inputs") or {},
            "outputs": (recipe.get("outputs") or {}).get("knowledge_spares"),
        }
        for recipe_id, recipe in model.recipes.items()
        if "knowledge_spares" in (recipe.get("outputs") or {})
    }
    loot_sources = {
        source_id: {
            "poi_id": source.get("poi_id"),
            "region_id": source.get("region_id"),
            "yield_per_claim": source.get("yield_per_claim"),
            "cooldown_seconds": source.get("replenishment_seconds"),
        }
        for source_id, source in model.sources.items()
        if source.get("item_id") == "knowledge_spares"
    }
    circular = sorted(
        recipe_id for recipe_id, row in spare_recipes.items() if row["station"] == "research"
    )
    non_circular = sorted(set(spare_recipes) - set(circular))
    kit = model.recipes.get("research_kit") or {}
    kit_spares = int((kit.get("inputs") or {}).get("knowledge_spares", 0))
    per_claim = max([int(row["yield_per_claim"] or 0) for row in loot_sources.values()] or [0])
    claims_needed = -(-kit_spares // per_claim) if per_claim else None

    # Which physical nodes can pay the harvest inputs? A0's own catalog is the
    # only mount that exists today, so it is passed in explicitly.
    harvest_nodes = {}
    for kind, row in (catalog or {}).get("resources", {}).items():
        item = str(row.get("item"))
        harvest_nodes.setdefault(item, []).append(
            {
                "kind": kind,
                "per_hit": int(row.get("per_hit", 0)),
                "hits": int(row.get("hits", 1)),
                "respawn_seconds": int(row.get("respawn_seconds", 0)),
            }
        )

    return {
        "station_piece": "station_research",
        "station_cost": (catalog or {}).get("pieces", {}).get("station_research", {}).get("cost", {}),
        "kit_recipe": {"id": "research_kit", "station": kit.get("station"), "inputs": kit.get("inputs") or {}},
        "kit_spares_required": kit_spares,
        "spare_loot_sources": loot_sources,
        "spare_recipes": spare_recipes,
        "circular_spare_recipes": circular,
        "non_circular_spare_recipes": non_circular,
        "spares_per_claim": per_claim,
        "claims_needed_for_first_station": claims_needed,
        "harvest_nodes_for_kit_inputs": {
            item: harvest_nodes.get(item, []) for item in sorted((kit.get("inputs") or {}))
        },
        "verdict": (
            "SEEDED_ONLY_BY_LOOT"
            if not non_circular and loot_sources
            else "SEEDED_BY_LOOT_AND_RECIPE"
            if loot_sources
            else "SEEDED_BY_RECIPE"
        ),
        "proves": (
            "which single edge the first research station depends on. It is a graph result over the "
            "pinned catalogs, so it does not care how many POIs or recipes exist."
        ),
    }


def authorization_claims(
    texts: Dict[str, str], a3_texts: Dict[str, str]
) -> Dict[str, object]:
    """A quantity is authorized only if the pinned A3 bytes carry it.

    Owners mark their own candidate rows with `AUTHORIZED_BY_A3`, `authorized_by` or
    an `authorization` note. Those are *claims*. This oracle accepts a claim only
    when the same source id appears in A3's own catalog with the same quantity, so
    a fabricated marker cannot become an authorization.
    """
    try:
        a3 = json.loads(a3_texts.get("a3.sources.json", "{}"))
    except Exception:
        a3 = {}
    a3_rows = a3.get("sources", {}) or {}
    a3_by_id = {str(row.get("id")): row for row in a3_rows.values()} if isinstance(a3_rows, dict) else {}

    claims: List[Dict[str, object]] = []
    accepted: List[Dict[str, object]] = []
    rejected: List[Dict[str, object]] = []
    for key in sorted(texts):
        if not key.endswith(".json"):
            continue
        try:
            payload = json.loads(texts[key])
        except Exception:
            continue
        for row in _walk_rows(payload):
            marker = _authorization_marker(row)
            if not marker:
                continue
            source_id = str(row.get("source_id") or row.get("a3_source_id") or row.get("id") or "")
            quantity = row.get("yield_per_claim", row.get("cost_quantity", row.get("quantity")))
            claimed = {"file": key, "source_id": source_id, "quantity": quantity, "marker": marker}
            claims.append(claimed)
            authoritative = a3_by_id.get(source_id)
            if authoritative is None:
                rejected.append({**claimed, "why": "no A3 row with this source id"})
                continue
            known = authoritative.get("yield_per_claim", authoritative.get("cost_quantity"))
            if quantity is not None and known is not None and int(quantity) != int(known):
                rejected.append({**claimed, "why": f"A3 says {known}"})
                continue
            accepted.append({**claimed, "a3_quantity": known})
    return {
        "claim_count": len(claims),
        "accepted": accepted,
        "rejected": rejected,
        "verdict": "NO_UNBACKED_AUTHORIZATION" if not rejected else "UNBACKED_AUTHORIZATION",
        "proves": (
            "that an authorization marker on its own carries no weight: the quantity has to exist in the "
            "pinned A3 catalog for the same source id. It does not prove the price is sensible."
        ),
    }


# --------------------------------------------------------------- identity replay
_POINTS_BLOCK = re.compile(r"const POINTS\s*:?=\s*\{", re.M)


def _balanced(text: str, start: int) -> str:
    """Return the {...} body that opens at `start`, honouring nested braces."""
    depth, index = 0, start
    while index < len(text):
        char = text[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1 : index]
        index += 1
    return ""


def _host_points(host_text: str) -> List[Dict[str, str]]:
    """Every entry of A0's POINTS table, parsed field by field.

    A single flat regex cannot read this table: the fields are ordered differently
    per row and one row overrides `poi`. Parsing the balanced block is boring and
    correct; the alternative produced an empty instance_id and a false PASS.
    """
    block = _POINTS_BLOCK.search(host_text)
    if not block:
        return []
    body = _balanced(host_text, block.end() - 1)
    entries: List[Dict[str, str]] = []
    index = 0
    while index < len(body):
        match = re.compile(r'"([a-z_]+)"\s*:\s*\{').search(body, index)
        if not match:
            break
        inner = _balanced(body, match.end() - 1)
        action = re.search(r'"action"\s*:\s*"([^"]*)"', inner)
        instance = re.search(r'"instance"\s*:\s*"([^"]*)"', inner)
        poi = re.search(r'"poi"\s*:\s*"?([A-Za-z_]+)"?', inner)
        if action:
            entries.append(
                {
                    "point": match.group(1),
                    "action_id": action.group(1),
                    "instance_id": instance.group(1) if instance else "",
                    "poi_id": ("poi_" + poi.group(1).replace("RELAY_POI", "crown_relay_shed"))
                    if poi
                    else "poi_crown_waystation",
                }
            )
        index = match.end() + len(inner)
    return entries
_TEST_INSTANCE = re.compile(r'"instance_id"\s*:\s*"([^"]*)"')


def _json_of(texts: Dict[str, str], key: str) -> Dict[str, object]:
    try:
        value = json.loads(texts.get(key, "") or "{}")
    except Exception:
        return {}
    return value if isinstance(value, dict) else {}


def _bindings(doc: Dict[str, object]) -> Dict[tuple, Dict[str, object]]:
    table: Dict[tuple, Dict[str, object]] = {}
    for raw in (doc or {}).get("bindings", []) or []:
        row = raw if isinstance(raw, dict) else {}
        key = (str(row.get("poi_id", "")), str(row.get("action_id", "")), str(row.get("instance_id", "")))
        table[key] = row
    return table


def host_requests(host_text: str) -> List[Dict[str, object]]:
    """The exact requests the shipped host will send, read from its POINTS table."""
    return _host_points(host_text)


def instance_identity(texts: Dict[str, str], a3_texts: Dict[str, str]) -> Dict[str, object]:
    """Replay the shipped host request against the catalog A0 actually loads.

    A binding is authorized only when the *exact* identity string the host sends
    resolves in the table the owner ships. A0's own lookup is exact equality on
    ``poi_id`` + ``action_id`` + ``instance_id``, so this oracle is not stricter
    than the runtime: it is the runtime, replayed without Godot.
    """
    host = texts.get("a0.waystation_host.gd", "")
    a0_doc = _json_of(texts, "a0.world_source_bindings.v3.json")
    a3_doc = _json_of(a3_texts, "a3.world_source_bindings.v3.json")
    a0 = _bindings(a0_doc)
    a3 = _bindings(a3_doc)
    requests = host_requests(host)
    resolved: List[Dict[str, object]] = []
    unresolved: List[Dict[str, object]] = []
    for request in requests:
        key = (str(request["poi_id"]), str(request["action_id"]), str(request["instance_id"]))
        in_a0 = a0.get(key)
        in_a3 = a3.get(key)
        row = {
            **request,
            "resolved_in_a0_catalog": bool(in_a0),
            "resolved_in_a3_catalog": bool(in_a3),
            "a0_binding_id": (in_a0 or {}).get("binding_id"),
            "a3_binding_id": (in_a3 or {}).get("binding_id"),
        }
        if request["instance_id"]:
            (resolved if in_a0 else unresolved).append(row)
        else:
            # Actions without an instance resolve through `action_for`, recorded
            # separately so an instance claim is never implied.
            row["via"] = "action_for"
            resolved.append(row)

    a0_keys, a3_keys = set(a0), set(a3)
    only_a3 = sorted(a3_keys - a0_keys)
    only_a0 = sorted(a0_keys - a3_keys)
    divergent = []
    for key in sorted(a0_keys & a3_keys):
        fields = {
            name: {"a0": a0[key].get(name), "a3": a3[key].get(name)}
            for name in sorted(set(a0[key]) | set(a3[key]))
            if a0[key].get(name) != a3[key].get(name)
        }
        if fields:
            divergent.append({"identity": key[2], "action_id": key[1], "fields": fields})

    # The fixture that "proved" the reward pays hardcodes its own instance id. If
    # that id differs from the host's, the fixture cannot have exercised the host.
    test_text = texts.get("a0.survival_waystation_authority_test.gd", "")
    test_instances = sorted(set(_TEST_INSTANCE.findall(test_text)))
    host_instances = sorted({row["instance_id"] for row in requests if row["instance_id"]})
    fixture_mismatch = [i for i in test_instances if i and i not in host_instances]

    if unresolved:
        verdict = "HOST_ACTION_UNRESOLVED"
    elif only_a3 or divergent or only_a0:
        verdict = "CATALOG_DIVERGED_BUT_HOST_RESOLVES"
    else:
        verdict = "IDENTITY_CONSISTENT"
    return {
        "verdict": verdict,
        "host_requests": requests,
        "instance_requests": resolved,
        "unresolved_host_requests": unresolved,
        "a0_binding_count": len(a0),
        "a3_binding_count": len(a3),
        "a3_only_bindings": [f"{k[1]}@{k[2]}" for k in only_a3],
        "a0_only_bindings": [f"{k[1]}@{k[2]}" for k in only_a0],
        "divergent_bindings": divergent,
        "fixture_instance_ids": test_instances,
        "host_instance_ids": host_instances,
        "fixture_ids_absent_from_host": fixture_mismatch,
        "rule": (
            "A binding authorizes a physical interaction only when poi_id + action_id + instance_id match "
            "exactly. An alias is an alias: it cannot stand in for the world instance at runtime."
        ),
    }


def _walk_rows(payload, depth: int = 0) -> Iterable[Dict[str, object]]:
    if depth > 6:
        return
    if isinstance(payload, dict):
        yield payload
        for value in payload.values():
            yield from _walk_rows(value, depth + 1)
    elif isinstance(payload, list):
        for value in payload:
            yield from _walk_rows(value, depth + 1)


_MARKERS = ("authorized_by_a3", "authorized_by", "authorization", "authorised_by_a3", "a3_authorized")


def _authorization_marker(row: Dict[str, object]) -> str:
    for key in _MARKERS:
        for actual, value in row.items():
            if str(actual).lower() != key:
                continue
            text = str(value).strip()
            if not text:
                continue
            lowered = text.lower()
            if "a3" in lowered and ("authoriz" in lowered or "authoris" in lowered):
                return f"{actual}={text[:80]}"
    return ""


def audit(
    texts: Dict[str, str],
    a3_texts: Dict[str, str],
    model,
    catalog: Optional[Dict[str, object]] = None,
) -> Dict[str, object]:
    api = api_audit(texts)
    fidelity = save_fidelity(texts)
    knowledge = knowledge_gate(model, catalog)
    authorization = authorization_claims(texts, a3_texts)
    identity = instance_identity(texts, a3_texts)
    return {
        "schema": "soh.balance.oracle.v1",
        "read_this_first": (
            "Five checks that take their answer from outside the file under review: the engine's own class "
            "list, Godot's JSON contract, the recipe/source graph, A3's pinned catalog, and a replay of the "
            "shipped host request against the binding table A0 actually loads."
        ),
        "engine_api": api,
        "save_fidelity": fidelity,
        "knowledge_gate": knowledge,
        "authorization": authorization,
        "instance_identity": identity,
        "holds": {
            "no_unknown_engine_static": api["verdict"] == "ENGINE_API_CONSISTENT",
            "float_round_trip_guaranteed": fidelity["verdict"] == "ROUND_TRIP_EXACT",
            "authorization_backed_by_a3": authorization["verdict"] == "NO_UNBACKED_AUTHORIZATION",
            "host_request_resolves_in_the_loaded_catalog": identity["verdict"] != "HOST_ACTION_UNRESOLVED",
        },
    }
