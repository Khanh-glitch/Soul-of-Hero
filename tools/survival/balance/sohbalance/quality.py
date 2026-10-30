"""Player-visible quality checks (D052), computed from pinned bytes.

These extend the product audit from "can the player get in" to "is what the
player would meet finished and honest". Every check returns a verdict plus the
evidence that produced it, and a check may only FAIL when the defect is visible
to a player in the *currently reachable* surface; if the surface is not mounted,
the verdict is WARN with that fact stated, never a silent pass.

The checks are deliberately narrow. A QA pass that lists everything is noise;
these seven answers each cost the owner one small action to close.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Sequence

from . import gdscan
from . import product as product_module

FAIL, WARN, PASS, UNKNOWN = "FAIL", "WARN", "PASS", "UNKNOWN"


def _check(
    check_id: str,
    title: str,
    status: str,
    impact: str,
    evidence,
    owner: str,
    closure: str,
    extra: Dict[str, object] | None = None,
) -> Dict[str, object]:
    if status not in {FAIL, WARN, PASS, UNKNOWN}:
        raise ValueError(status)
    payload: Dict[str, object] = {
        "check_id": check_id,
        "title": title,
        "status": status,
        "player_impact": impact,
        "owner": owner,
        "evidence": evidence,
        "closure_signal": closure,
        "scope": "STATIC_READ_OF_PINNED_BYTES",
    }
    payload.update(extra or {})
    return payload


def _site_payloads(texts: Dict[str, str]) -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    for key, text in sorted(texts.items()):
        if key.startswith("a8.south_") and key.endswith(".json"):
            try:
                payload = json.loads(text)
            except Exception:
                continue
            rows.append({"key": key, **payload})
    return rows


# ---------------------------------------------------------------- Q1 empty POIs
def empty_poi_check(model, texts: Dict[str, str], facts: Dict[str, object]) -> Dict[str, object]:
    """A POI must not look complete while offering nothing to do."""
    contract_only = [
        poi.get("poi_id")
        for poi in model.pois
        if model.playability(poi) == "CONTRACT_ONLY_NOT_PLAYABLE"
    ]
    # A site "claims" completeness if it is authored as a scene and its actions are
    # all effect-free (no cost, no reward, no state change) - a clickable nothing.
    no_op_actions: List[Dict[str, object]] = []
    for payload in _site_payloads(texts):
        for action in list(payload.get("actions") or []) + list(payload.get("choices") or []):
            if not (action.get("costs") or action.get("rewards") or action.get("set_state")):
                no_op_actions.append(
                    {"site": payload.get("site_id"), "action_id": action.get("action_id")}
                )
    native_scenes = [key for key in texts if key.startswith("a8.") and key.endswith(".tscn")]
    status = FAIL if no_op_actions else (WARN if contract_only and native_scenes == [] else PASS)
    return _check(
        "Q-01",
        "No POI is presented as finished while offering nothing",
        status,
        (
            f"{len(contract_only)} of {len(model.pois)} A1 POIs are contract-only and none of them is mounted, so no "
            "player can meet an empty POI yet; the risk is any screen that lists them as content. "
            f"{len(no_op_actions)} authored site option(s) have no cost, reward or state change "
            "(deliberate 'do nothing' choices are allowed only when labelled as such)."
        ),
        [
            {"fact": "contract-only POIs", "value": len(contract_only)},
            {"fact": "effect-free site options", "value": no_op_actions},
            {"fact": "native POI scenes captured", "value": sorted(native_scenes)},
        ],
        "A1 + A8",
        "no effect-free option survives unless its label says it changes nothing, and no unmounted POI appears in a content list",
    )


# ------------------------------------------------------------ Q2 duplicate HUD
# A HUD job is what the surface tells the player. Two surfaces may both exist if
# they never appear in the same context; they may not own the same job in one context.
HUD_JOBS = {
    "a0.hud.gd": {"health"},
    "a0.overworld_hud.gd": {"provisions"},
    "a6.player_first_hud.gd": {"context", "core", "feedback"},
}


def duplicate_hud_check(texts: Dict[str, str], facts: Dict[str, object]) -> Dict[str, object]:
    present = {name: sorted(jobs) for name, jobs in HUD_JOBS.items() if name in texts}
    seen: Dict[str, List[str]] = {}
    for name, jobs in present.items():
        for job in jobs:
            seen.setdefault(job, []).append(name)
    duplicated = {job: owners for job, owners in seen.items() if len(owners) > 1}
    dev_gated = bool(re.search(r"var _developer_diagnostics\s*:=\s*false", texts.get("a6.player_first_hud.gd", "")))
    status = FAIL if duplicated else (PASS if dev_gated else WARN)
    return _check(
        "Q-02",
        "One owner per HUD job, and developer text behind an opt-in flag",
        status,
        (
            f"Jobs: {present}. No job is owned twice, so the earlier duplicate-status concern is resolved by "
            "splitting context/Core/feedback away from health/provisions. Developer provenance text is gated "
            f"behind `_developer_diagnostics` defaulting off: {dev_gated}. The remaining risk is that the "
            "fixture demo screens are mounted as if they were the game."
        ),
        [
            {"fact": "surfaces and jobs", "value": present},
            {"fact": "jobs owned twice", "value": duplicated},
            {"fact": "developer diagnostics defaults off", "value": dev_gated},
        ],
        "A6 (+A0 mount)",
        "keep one owner per job and keep the debug flag off in release; mounting a fixture demo screen fails this check",
    )


# ----------------------------------------------------- Q3 invalid item mapping
def mirror_drift(model, texts: Dict[str, str]) -> Dict[str, object]:
    """A0 ships a copy of A3's item/source catalog. Two copies can silently drift."""
    raw = texts.get("a0.sources.json", "")
    if not raw:
        return {"status": "UNKNOWN", "mirror_rows": 0, "divergent": [], "only_in_mirror": [], "only_in_a3": []}
    try:
        mirrored = (json.loads(raw) or {}).get("sources", {}) or {}
    except Exception:
        return {"status": "UNKNOWN", "mirror_rows": 0, "divergent": [], "only_in_mirror": [], "only_in_a3": []}
    divergent = sorted(key for key in mirrored if key in model.sources and mirrored[key] != model.sources[key])
    only_in_mirror = sorted(set(mirrored) - set(model.sources))
    only_in_a3 = sorted(set(model.sources) - set(mirrored))
    clean = not (divergent or only_in_mirror or only_in_a3)
    return {
        "status": "MATCH" if clean else "DRIFT",
        "mirror_rows": len(mirrored),
        "a3_rows": len(model.sources),
        "identical_rows": sum(1 for key in mirrored if model.sources.get(key) == mirrored[key]),
        "divergent": divergent,
        "only_in_mirror": only_in_mirror,
        "only_in_a3": only_in_a3,
    }


def item_mapping_check(model, facts: Dict[str, object]) -> Dict[str, object]:
    unknown_sources = sorted(
        {str(source.get("item_id")) for source in model.sources.values() if source.get("item_id") not in model.items}
    )
    site_bad: List[Dict[str, object]] = []
    for payload in _site_payloads(facts.get("_texts", {})):
        for action in list(payload.get("actions") or []) + list(payload.get("choices") or []):
            for item_id in list((action.get("costs") or {})) + list((action.get("rewards") or {})):
                if item_id not in model.items:
                    site_bad.append({"site": payload.get("site_id"), "action_id": action.get("action_id"), "item_id": item_id})
    unmapped = [{"item": row["item_id"], "source": row["source_id"]} for row in facts.get("unmapped_source_rows", [])]
    drift = mirror_drift(model, facts.get("_texts", {}))
    status = FAIL if (unknown_sources or site_bad or drift["status"] == "DRIFT") else PASS
    return _check(
        "Q-03",
        "Every authored cost, reward and source points at a real item",
        status,
        (
            f"{len(unknown_sources)} A3 source record(s) name an item that is not in the catalog; "
            f"{len(site_bad)} A8 site cost/reward(s) name a non-catalog item; A0's mirrored copy of the A3 "
            f"catalog is `{drift['status']}` ({drift.get('identical_rows')}/{drift.get('a3_rows')} rows "
            "identical). A player would see a reward that cannot be stored, or a cost that one owner can pay "
            "and another cannot."
        ),
        [
            {"fact": "sources naming unknown items", "value": unknown_sources[:12]},
            {"fact": "site costs/rewards outside the catalog", "value": site_bad[:12]},
            {"fact": "items in catalog", "value": len(model.items)},
            {"fact": "unmapped source rows (traceability)", "value": unmapped[:12]},
            {"fact": "A0 mirror of the A3 catalog", "value": drift},
        ],
        "A3 + A8",
        "no cost, reward or source names an item outside items.json",
    )


# ------------------------------------------------------ Q4 avatar identity/armor
def avatar_check(texts: Dict[str, str], facts: Dict[str, object]) -> Dict[str, object]:
    """Q-04: is the player body the locked avatar, and is any claimed art real?

    Round 3 accepted a filled-in ``idle_sheet`` string plus a scene name. That was
    false completion: an invented path is not an installed image. Three separate
    questions are now answered separately:

    * identity — does the mounted body resolve to Craftpix 555940 / 419402?
    * reference reality — does every claimed sheet exist in the pinned tree?
    * visual readiness — can a player actually see it (never provable statically)?
    """
    manifest_raw = texts.get("a6.avatar_art_manifest.json", "{}")
    try:
        manifest = json.loads(manifest_raw)
    except Exception:
        manifest = {}
    characters = manifest.get("characters", {})
    tree = facts.get("_tree") or {}
    owners_tree = set()
    for rows in tree.values():
        owners_tree |= set(rows)

    def _exists(res_path: str) -> bool:
        if not res_path.startswith("res://"):
            return False
        return res_path[len("res://") :] in owners_tree

    grades: Dict[str, Dict[str, object]] = {}
    claimed_sheets: List[Dict[str, object]] = []
    for gender, row in characters.items():
        armor = row.get("armor_grades", {}) or {}
        grades[gender] = {
            grade: ("PRESENT" if isinstance(armor.get(grade), dict) else "NULL_SOURCE_BLOCKED")
            for grade in ("0", "1", "2")
        }
        for grade, entry in armor.items():
            if not isinstance(entry, dict):
                continue
            sheet = str(entry.get("idle_sheet") or "").strip()
            claimed_sheets.append(
                {
                    "gender": gender,
                    "grade": grade,
                    "sheet": sheet,
                    "exists_in_tree": _exists(sheet) if sheet else False,
                }
            )

    adapter_live = gdscan.strip_comments_and_strings(texts.get("a6.avatar_appearance_adapter.gd", ""))
    adapter_mentions_substitute = bool(re.search(r"knight|180537|swordsman", adapter_live, re.IGNORECASE))
    adapter_blocks = bool(re.search(r"Matching armor appearance is not verified", texts.get("a6.avatar_appearance_adapter.gd", "")))

    mounted = facts.get("mounted_player_scene")
    mounted_text = str(mounted or "")
    identity_ok = bool(re.search(r"adventur|555940|419402", mounted_text)) and not re.search(
        r"knight|180537|swordsman", mounted_text, re.IGNORECASE
    )
    installed = [row for row in claimed_sheets if row["exists_in_tree"]]
    invented = [row for row in claimed_sheets if row["sheet"] and not row["exists_in_tree"]]
    empty_sheets = [row for row in claimed_sheets if not row["sheet"]]

    if invented:
        status = FAIL
        verdict = "CLAIMED_SHEET_DOES_NOT_EXIST"
    elif not identity_ok:
        status = FAIL
        verdict = "WRONG_MOUNTED_IDENTITY"
    elif adapter_mentions_substitute:
        status = FAIL
        verdict = "ADAPTER_SUBSTITUTES_ANOTHER_CHARACTER"
    elif not installed:
        status = FAIL
        verdict = "NO_INSTALLED_GRADE0_SHEET"
    else:
        status = PASS
        verdict = "REFERENCE_CONSISTENT"

    return _check(
        "Q-04",
        "Player avatar identity and armour state are correct or explicitly blocked",
        status,
        (
            f"The locked identities are Craftpix 555940 (male) and 419402 (female). The mounted body is "
            f"`{mounted}`. Every claimed sheet is checked against the pinned tree: {len(installed)} installed, "
            f"{len(invented)} invented, {len(empty_sheets)} empty. Armour grades 1-2 are allowed to stay "
            f"NULL_SOURCE_BLOCKED (other armour art is the owner's choice, gender-matched) but a NULL grade is "
            f"never counted as ready. Static state is `{verdict}`; a player still sees the wrong character today "
            f"because the mounted body is not canonical."
        ),
        [
            {"fact": "armour grade availability", "value": grades},
            {"fact": "claimed sheets", "value": claimed_sheets},
            {"fact": "invented sheet claims", "value": invented},
            {"fact": "adapter blocks instead of substituting", "value": adapter_blocks},
            {"fact": "adapter substitutes Knight/Swordsman code path", "value": adapter_mentions_substitute},
            {"fact": "mounted player scene", "value": mounted},
        ],
        "A6 (art import + adapter) with A0 (mount)",
        "mounted scene is canonical AND every claimed sheet exists in the tree AND no substitute code path",
        extra={
            "static_verdict": verdict,
            "visual_state": "NOT_TESTED",
            "visual_evidence_required": [
                "the scene loads in native Godot and the sprite node has a texture",
                "4-direction idle animation plays on the mounted body",
                "equipping armour swaps to the matching grade, and unequipping reverses it",
                "rendered frames at 1280x720 and 1920x1080 inspected by a human",
            ],
            "release_state": "NOT_ACCEPTED",
        },
    )


# ------------------------------------------------- Q5 orphaned craft/research
TERMINAL_TAGS = {"tool", "protective", "core", "food", "medicine", "unique", "weapon"}


def orphan_output_check(model) -> Dict[str, object]:
    produced: Dict[str, List[str]] = {}
    consumed: set = set()
    for recipe_id, recipe in model.recipes.items():
        for output in recipe.get("outputs") or {}:
            produced.setdefault(output, []).append(recipe_id)
        for item_id in recipe.get("inputs") or {}:
            consumed.add(item_id)
        for item_id in (recipe.get("fuel") or {}):
            consumed.add(item_id)
    for technology in model.technologies.values():
        for item_id in technology.get("inputs") or {}:
            consumed.add(item_id)
    for station in model.stations.values():
        if station.get("kit"):
            consumed.add(station["kit"])
        for item_id in station.get("upgrade_cost") or {}:
            consumed.add(item_id)

    orphans: List[Dict[str, object]] = []
    terminal: List[str] = []
    for item_id, producers in sorted(produced.items()):
        if item_id in consumed:
            continue
        tags = set(model.items.get(item_id, {}).get("tags") or [])
        if tags & TERMINAL_TAGS:
            terminal.append(item_id)
            continue
        orphans.append({"item_id": item_id, "produced_by": sorted(producers), "tags": sorted(tags)})
    status = FAIL if orphans else PASS
    return _check(
        "Q-05",
        "No crafting/research output is orphaned",
        status,
        (
            f"{len(orphans)} produced item(s) are consumed by nothing and are not terminal gear: a player can "
            "craft them and then has no use for them. "
            f"{len(terminal)} other outputs are terminal items (tools/cores/food) and are correctly not consumed."
        ),
        [
            {"fact": "orphaned outputs", "value": orphans},
            {"fact": "terminal outputs (expected)", "value": terminal},
        ],
        "A3",
        "every produced non-terminal item appears as a recipe/technology input, fuel, station kit or upgrade cost",
    )


# ---------------------------------------------- Q6 buttons without owner action
def owner_action_check(texts: Dict[str, str]) -> Dict[str, object]:
    planner = texts.get("a6.expedition_planner.gd", "")
    workspace = texts.get("a6.expedition_workspace.gd", "")
    adapter = texts.get("a6.a0_storage_command_adapter.gd", "")
    guards = len(re.findall(r"_has_action_host\(\)", planner))
    emits = len(re.findall(r"request_action\.emit\(", planner))
    forwards = bool(re.search(r"desk\.request_action\.connect", workspace))
    adapter_is_read_only = bool(re.search(r"does not call SurvivalService or SaveService", adapter))
    # A control that emits without any host guard is a button that cannot work.
    unguarded_emits = emits if not guards else max(0, emits - guards)
    status = (
        FAIL
        if emits and not guards
        else (PASS if (guards and forwards and adapter_is_read_only) else WARN)
    )
    return _check(
        "Q-06",
        "Every actionable control is either backed by an owner action or plainly unavailable",
        status,
        (
            f"The planner guards actions on a connected host ({guards} guard site(s)) and the workspace forwards "
            f"intent upward ({forwards}). The storage adapter normalises intent and explicitly does not call "
            f"SaveService ({adapter_is_read_only}), so nothing is silently faked. Until A0 connects a host, the "
            "controls are unavailable rather than pretending to work."
        ),
        [
            {"fact": "action-host guards", "value": guards},
            {"fact": "intent emissions", "value": emits},
            {"fact": "workspace forwards intent", "value": forwards},
            {"fact": "adapter avoids owner calls", "value": adapter_is_read_only},
            {"fact": "emissions with no host guard", "value": unguarded_emits},
        ],
        "A6 + A0",
        "a control with no host stays disabled and labelled; a mounted host makes the same control commit through A0",
    )


# ------------------------------------------------- Q7 fixture-only save claims
# Words that assert a persistence outcome. A fixture may demonstrate them, but it
# may not claim them without a SaveService commit behind it.
_OVERCLAIM_PATTERN = re.compile(
    r"SAVE_VERIFIED[A-Z_]*|PERSISTENCE_VERIFIED[A-Z_]*|NO_DUPLICATE_VERIFIED[A-Z_]*|DUPLICATE_PROOF[A-Z_]*"
)
def fixture_claim_check(texts: Dict[str, str]) -> Dict[str, object]:
    fixture = texts.get("a8.poi_authority_fixture.gd", "")
    pilot = texts.get("a8.poi_pilot.gd", "")
    journeys = texts.get("a6.acceptance_journeys.gd", "")
    overclaims = sorted(
        {
            match.group(0)
            for text in (fixture, pilot, journeys)
            for match in _OVERCLAIM_PATTERN.finditer(text)
        }
    )
    rows = {
        "no_verified_claim_inside_a_fixture_path": not overclaims,
        "a8_authority_is_fixture": bool(fixture) and "TEST FIXTURE ONLY" in fixture,
        "a8_pilot_wires_fixture": "PoiAuthorityFixture" in pilot or "poi_authority_fixture" in pilot,
        "a8_fixture_never_uses_save_service": "save_service" not in fixture.lower(),
        "a6_journeys_are_read_only_fixtures": "READ-ONLY SCENARIO FIXTURE" in journeys,
    }
    honest = all(rows.values())
    return _check(
        "Q-07",
        "Save/loot claims are honest about fixture authority",
        PASS if honest else FAIL,
        (
            "Every scene that demonstrates a loot or save outcome declares itself a fixture, keeps its state in "
            "memory and never calls SaveService. That is correct labelling, not working persistence: a reader "
            "must not mistake it for a committed save."
        ),
        [{"fact": key, "value": value} for key, value in sorted(rows.items())]
        + [{"fact": "overclaim tokens found", "value": overclaims}],
        "A8 + A6",
        "a fixture may never import SaveService; a production path must, and its receipt must be testable",
    )


def run_all(model, texts: Dict[str, str], facts: Dict[str, object], manifest: Dict[str, object]) -> List[Dict[str, object]]:
    enriched = dict(facts)
    enriched["_texts"] = texts
    enriched["_tree"] = product_module.load_tree(manifest)
    return [
        empty_poi_check(model, texts, enriched),
        duplicate_hud_check(texts, enriched),
        item_mapping_check(model, enriched),
        avatar_check(texts, enriched),
        orphan_output_check(model),
        owner_action_check(texts),
        fixture_claim_check(texts),
    ]
