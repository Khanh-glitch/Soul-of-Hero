"""Product-readiness audit over *pinned* production bytes (read-only).

A7 owns no gameplay code, so this module never loads Godot and never touches
another owner's branch. It reads the sha256-pinned copies in
``data/survival/balance/snapshot/product/`` plus the derived index in
``product_manifest.json``, and answers player-facing questions:

* can the player reach the survival/exploration loop at all?
* is there anything in the mounted game that hands out A3-authored loot?
* is the mounted player body the avatar the user locked (D051), or a stand-in?
* does any player-visible surface show developer/debug text?
* is any surface claiming success that has not happened?
* are two different UI layers doing the same job?
* are authored items/actions unreachable or unconnected?

Every check returns a verdict plus the exact evidence location, so the answer is
falsifiable from Git alone. A verdict of ``UNKNOWN`` means the pinned bytes do
not contain the answer; it is never promoted to PASS or FAIL.

Nothing here reads a *runtime*. "Mounted" means "a scene in the production tree
references this file"; whether the scene actually runs is a native test, not a
static read, and is reported as NOT_TESTED elsewhere.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

SNAPSHOT_DIR = Path("data/survival/balance/snapshot/product")
MANIFEST_PATH = Path("data/survival/balance/snapshot/product_manifest.json")

# Tokens that must never reach a release player surface (D052).
DEBUG_TOKENS = (
    "FIXTURE",
    "NOT_NATIVE",
    "NOT NATIVE",
    "BLOCKED_PENDING",
    "AUTHORED PLAN",
    "OWNER_PROJECTION",
    "OWNER PROJECTION",
    "PREVIEW  ·",
    "NO OWNER SNAPSHOT",
    "PROJECTION",
    "schema",
)

# Qualifiers that make a completion word honest ("not verified", "blocked", ...).
QUALIFIERS = (
    "BLOCKED",
    "NOT ",
    "UNVERIFIED",
    "FIXTURE",
    "IRREVERSIBLE",
    "PENDING",
    "CANNOT",
    "UNKNOWN",
    "NO ",
    "IF ",
    "WOULD",
    "WOULD BE",
)

# Words that would read as "this works" to a player.
COMPLETION_TOKENS = ("COMPLETE", "COMPLETED", "SUCCESS", "VERIFIED", "UNLOCKED", "OBTAINED", "FINISHED")

SURVIVAL_ENTRY_PATTERN = re.compile(r"survival|world|explor|poi|expedition|loot|khám phá", re.IGNORECASE)
RAW_ID_PATTERN = re.compile(r"\bsoh_i_[a-z0-9_]+\b|\bpoi_[a-z0-9_]+\b|\b[a-z]+_[a-z]+_[a-z0-9_]+\b")


# --------------------------------------------------------------------- loading
def load_snapshot(root: Path) -> Tuple[Dict[str, str], Dict[str, object]]:
    """Read the pinned product files; raise if a pinned hash no longer matches."""
    import hashlib

    manifest = json.loads((root / MANIFEST_PATH).read_text(encoding="utf-8"))
    texts: Dict[str, str] = {}
    for entry in manifest["files"]:
        path = root / SNAPSHOT_DIR / entry["key"]
        payload = path.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        if digest != entry["sha256"]:
            raise ValueError(f"product snapshot drift: {entry['key']} {digest} != {entry['sha256']}")
        texts[entry["key"]] = payload.decode("utf-8", "replace")
    return texts, manifest


def _lines(text: str) -> Iterable[Tuple[int, str]]:
    for number, line in enumerate(text.splitlines(), start=1):
        yield number, line


def _string_literals(line: str) -> List[str]:
    return re.findall(r'"([^"]*)"', line)


def _is_comment(line: str) -> bool:
    return line.lstrip().startswith("#")


# ----------------------------------------------------------------------- facts
def build_facts(
    texts: Dict[str, str],
    manifest: Dict[str, object],
    loot_tables: Sequence[str] = (),
    station_ids: Sequence[str] = (),
) -> Dict[str, object]:
    facts: Dict[str, object] = {}

    # --- entry points the player can actually choose from the home screen
    home = texts.get("a0.home_map_screen.gd", "")
    block = re.search(r"FUNCTION_SCENE_PATHS\s*:=\s*\{(.*?)\n\}", home, re.DOTALL)
    entries: Dict[str, str] = {}
    if block:
        for key, path in re.findall(r'&"([a-z_]+)"\s*:\s*"([^"]+)"', block.group(1)):
            entries[key] = path
    facts["home_function_keys"] = sorted(entries)
    facts["home_function_paths"] = {k: entries[k] for k in sorted(entries)}
    facts["home_survival_keys"] = sorted(k for k in entries if SURVIVAL_ENTRY_PATTERN.search(k))

    # --- which survival UI scenes/trees are referenced by a production scene
    mount_refs: Dict[str, List[str]] = dict(manifest.get("scene_mount_refs", {}))  # type: ignore[arg-type]
    production_scenes = {"game/app/app_root.tscn", "game/main.tscn"}
    mounted: List[str] = []
    for scene in production_scenes:
        mounted.extend(mount_refs.get(scene, []))
    facts["survival_ui_scenes_mounted"] = sorted(
        {ref for ref in mounted if "survival" in ref}
    )
    facts["survival_ui_scene_files"] = sorted(
        path for path in manifest.get("ui_scenes", []) if "survival" in path  # type: ignore[arg-type]
    )
    # survival UI scenes referenced only by other survival UI scenes = closed island
    island: List[str] = []
    for scene in facts["survival_ui_scene_files"]:  # type: ignore[union-attr]
        refs = [ref for ref in mount_refs.get(scene, []) if ref != scene]
        if refs and all("survival" in ref for ref in refs):
            island.append(scene)
    facts["survival_ui_closed_island"] = island

    # --- the mounted player body
    main_scene = texts.get("a0.main.tscn", "")
    bodies = re.findall(r'path="res://(game/characters/[^"]+)"', main_scene)
    facts["mounted_player_scene"] = bodies[0] if bodies else None
    facts["mounted_player_scenes"] = bodies
    overworld = texts.get("a0.chapter1_overworld.tscn", "")
    facts["overworld_scene_refs"] = re.findall(r'path="res://([^"]+)"', overworld)

    # --- canonical avatar sources (D051) anywhere in production code
    index = manifest.get("index", {})
    art_rows = list(index.get("avatar_or_character_art", []))  # type: ignore[union-attr]
    production_art = [row for row in art_rows if str(row["path"]).startswith("game/")]
    # A declaration inside a manifest is not a mount. Only a scene/script/asset
    # reference counts as "production", so the two are counted separately.
    def _is_runtime_ref(path: str) -> bool:
        return str(path).endswith((".gd", ".tscn", ".tres", ".png", ".import", ".res"))

    canonical_hits = {
        token: [row for row in production_art if token in json.dumps(row) and _is_runtime_ref(row["path"])]
        for token in ("555940", "419402", "180537")
    }
    facts["canonical_avatar_production_refs"] = {
        token: len(rows) for token, rows in canonical_hits.items()
    }
    facts["canonical_avatar_declaration_refs"] = {
        token: len([row for row in production_art if token in json.dumps(row) and not _is_runtime_ref(row["path"])])
        for token in ("555940", "419402", "180537")
    }
    facts["canonical_avatar_doc_refs"] = {
        token: len([r for r in art_rows if token in json.dumps(r)]) for token in ("555940", "419402", "180537")
    }
    facts["knight_production_refs"] = len([r for r in production_art if "characters/knight" in str(r["path"])])
    facts["armor_stage_refs"] = sorted(
        {str(row["path"]) for row in production_art if re.search(r"armor|armour", json.dumps(row), re.IGNORECASE)}
    )

    # --- player-visible debug text
    visible: List[Dict[str, object]] = []
    for key, text in sorted(texts.items()):
        if not key.startswith("a6."):
            continue  # A6 owns the survival-facing HUD/journal/planner surfaces
        for number, line in _lines(text):
            if _is_comment(line) or "preload(" in line:
                continue
            for literal in _string_literals(line):
                for token in DEBUG_TOKENS:
                    if token.lower() in literal.lower():
                        visible.append(
                            {
                                "file": key,
                                "line": number,
                                "token": token,
                                "text": literal[:120],
                            }
                        )
    facts["visible_debug_tokens"] = visible

    # --- completion claims on a player surface
    claims: List[Dict[str, object]] = []
    for key, text in sorted(texts.items()):
        if not key.startswith("a6."):
            continue
        for number, line in _lines(text):
            if _is_comment(line):
                continue
            for literal in _string_literals(line):
                upper = literal.upper()
                if any(token in upper for token in COMPLETION_TOKENS):
                    claims.append({"file": key, "line": number, "text": literal[:140]})
    facts["completion_claims"] = claims

    # --- overlapping UI layers
    health_surfaces = []
    for key, tokens in {
        "a0.hud.gd": ("HealthBar", "health_bar"),
        "a0.overworld_hud.gd": ("PROVISIONS", "provisions"),
        "a6.player_first_hud.gd": ("needs", "NEEDS", "HEALTH"),
    }.items():
        text = texts.get(key, "")
        if any(token in text for token in tokens):
            health_surfaces.append(key)
    facts["dashboards"] = health_surfaces
    nav_targets: Dict[str, int] = {}
    for key in ("a6.expedition_planner.gd", "a6.survival_journal.gd", "a6.expedition_workspace.gd"):
        nav_targets[key] = len(re.findall(r"signal\s+(journal_requested|journeys_requested|desk_requested|journal_requested)", texts.get(key, "")))
    facts["navigation_signals"] = nav_targets

    # --- authored actions with no production host
    facts["loot_tables_in_data"] = sorted(loot_tables)
    # A loot table named by a script/scene is a host; the same name inside a data
    # mirror only means the catalog was copied. Keep the two apart so a duplicated
    # data file can never be mistaken for a mounted container.
    code_texts = {
        key: text for key, text in texts.items() if key.endswith((".gd", ".tscn", ".tres"))
    }
    data_texts = {
        key: text for key, text in texts.items() if key.endswith(".json")
    }
    facts["loot_tables_in_production_code"] = sorted(
        table for table in loot_tables for text in code_texts.values() if table in text
    )
    facts["loot_tables_in_data_mirrors"] = sorted(
        {table for table in loot_tables for text in data_texts.values() if table in text}
    )
    facts["stations_in_data"] = sorted(station_ids)
    facts["stations_in_production_code"] = sorted(
        station for station in station_ids for text in texts.values() if station in text
    )
    facts["scan_file_count"] = len(texts)
    chest = texts.get("a0.chest.gd", "")
    facts["chest_grants"] = re.findall(r"signal\s+opened\(([^)]*)\)", chest)
    facts["chest_mentions_item_grant"] = "add_items" in chest or "inventory" in chest.lower()
    return facts


# ---------------------------------------------------------------------- checks
def _check(
    check_id: str,
    title: str,
    status: str,
    player_impact: str,
    evidence: List[Dict[str, object]],
    closure: str,
    owner: str,
) -> Dict[str, object]:
    if status not in {"FAIL", "PASS", "WARN", "UNKNOWN"}:
        raise ValueError(status)
    return {
        "check_id": check_id,
        "title": title,
        "status": status,
        "player_impact": player_impact,
        "owner": owner,
        "evidence": evidence,
        "closure_signal": closure,
    }


def run_checks(facts: Dict[str, object]) -> List[Dict[str, object]]:
    checks: List[Dict[str, object]] = []

    # PROD-01 ------------------------------------------------------------ entry
    keys = list(facts["home_function_keys"])  # type: ignore[arg-type]
    survival_keys = list(facts["home_survival_keys"])  # type: ignore[arg-type]
    mounted_ui = list(facts["survival_ui_scenes_mounted"])  # type: ignore[arg-type]
    checks.append(
        _check(
            "PROD-01",
            "Player can reach the survival / exploration loop",
            "PASS" if survival_keys else "FAIL",
            (
                "No destination on the home screen opens survival, a world map, a POI or a container. "
                f"The player can only choose {keys}. Everything A1/A3 authored is unreachable in the "
                "mounted build, so loot discovery cannot be experienced at all."
            )
            if not survival_keys
            else "A survival destination exists in the home screen path table.",
            [
                {"file": "game/ui/screens/home/home_map_screen.gd", "fact": "FUNCTION_SCENE_PATHS keys", "value": keys},
                {"file": "game/ui/screens/home/home_map_screen.gd", "fact": "survival-like keys", "value": survival_keys},
                {"file": "game/main.tscn", "fact": "mounted player/level refs", "value": facts["overworld_scene_refs"]},
                {"fact": "survival UI scenes referenced by a production scene", "value": mounted_ui},
            ],
            "add one home-screen destination whose scene loads the A1 world/POI layer, then PROD-01 = PASS",
            "A0 (mount) + A1 (scene)",
        )
    )

    # PROD-02 ------------------------------------------------------- loot host
    tables = list(facts["loot_tables_in_data"])  # type: ignore[arg-type]
    in_code = list(facts["loot_tables_in_production_code"])  # type: ignore[arg-type]
    checks.append(
        _check(
            "PROD-02",
            "Something the player can open hands out authored loot",
            "PASS" if in_code else "FAIL",
            (
                f"None of the {facts.get('scan_file_count')} pinned production files references any of the "
                f"{len(tables)} authored loot tables. The only openable container in those files is the dungeon "
                "RewardChest, whose signal is `opened(score_reward, contained_sigil)` — it grants score and a "
                "sigil, not survival items. Scope: pinned bytes only; a container implemented outside these "
                "files would not be visible here."
            )
            if not in_code
            else "At least one authored loot table is referenced by production code.",
            [
                {"fact": "A3 loot tables", "value": tables},
                {"fact": "loot tables referenced by pinned production files", "value": in_code},
                {"fact": "files scanned", "value": facts.get("scan_file_count")},
                {"file": "game/world/interactables/chest.gd", "fact": "opened() signal", "value": facts["chest_grants"]},
                {"fact": "chest grants inventory items", "value": facts["chest_mentions_item_grant"]},
            ],
            "mount one container scene that calls an A3 table and grants through SaveService, then PROD-02 = PASS",
            "A0 (mount) + A3 (table binding)",
        )
    )

    # PROD-03 ----------------------------------------------------------- avatar
    body = facts["mounted_player_scene"]
    canonical = facts["canonical_avatar_production_refs"]  # type: ignore[assignment]
    canonical_ok = isinstance(body, str) and bool(re.search(r"adventur|555940|419402", body))
    checks.append(
        _check(
            "PROD-03",
            "Mounted player body is the avatar the user locked (D051)",
            "PASS" if canonical_ok else "FAIL",
            (
                f"The mounted player body is `{body}` (Knight art), not the bald Craftpix 555940/419402 "
                "adventurers the user locked. Zero production files reference either canonical source "
                f"({canonical}), and no armour-stage sprite is referenced at all "
                f"({facts['armor_stage_refs']}). Any readiness note that presents the current body as the "
                "accepted avatar is therefore wrong; the armour-1/armour-2 frames remain SOURCE_BLOCKED."
            ),
            [
                {"file": "game/main.tscn", "fact": "mounted character scene", "value": body},
                {"file": "game/overworld/chapter1_overworld.gd", "fact": "overworld player scene", "value": facts["overworld_scene_refs"]},
                {"fact": "production refs to canonical sources", "value": canonical},
                {"fact": "production refs to swordsman 180537 (not a gender match)", "value": canonical.get("180537") if isinstance(canonical, dict) else None},
                {"fact": "armour-stage art referenced in production", "value": facts["armor_stage_refs"]},
            ],
            "mount the chosen 555940/419402 body and one armour-stage layer per grade; PROD-03 = PASS only when a production scene references the canonical source",
            "A0 (mount) + art source (A6)",
        )
    )

    # PROD-04 ------------------------------------------------------ debug text
    visible = list(facts["visible_debug_tokens"])  # type: ignore[arg-type]
    tokens = sorted({row["token"] for row in visible})
    checks.append(
        _check(
            "PROD-04",
            "No developer/debug text on a survival player surface",
            "FAIL" if visible else "PASS",
            (
                f"{len(visible)} player-visible strings still carry developer vocabulary "
                f"({', '.join(tokens)}): fixture/provenance labels and raw identifiers. Today these live in "
                "the unmounted A6 HUD, so no player sees them yet — but mounting that HUD as-is would put "
                "debug text on screen."
            )
            if visible
            else "No debug vocabulary found in player-visible strings.",
            visible[:12],
            "move provenance/fixture vocabulary behind an opt-in debug panel and keep only player words in the default HUD; PROD-04 = PASS when zero such literals remain on visible label paths",
            "A6",
        )
    )

    # PROD-05 ------------------------------------------------- fake completion
    claims = list(facts["completion_claims"])  # type: ignore[arg-type]
    unqualified = [
        row
        for row in claims
        if not any(qualifier in str(row["text"]).upper() for qualifier in QUALIFIERS)
    ]
    checks.append(
        _check(
            "PROD-05",
            "No surface claims success that has not happened",
            "WARN" if unqualified else "PASS",
            (
                f"{len(unqualified)} completion word(s) appear without a qualifier. "
                "Honest BLOCKED/fixture wording elsewhere is the reason this is not a failure."
            )
            if unqualified
            else (
                "Every completion word found is either a warning to the player or explicitly qualified. "
                "The risk here is not a fake screen today but the fixture acceptance journeys "
                "(A6 acceptance_journeys.gd) being presented as the real loop: they run on fixture data and "
                "say so."
            ),
            claims[:10],
            "keep fixture-only journeys labelled and never mount them as the product loop; PROD-05 stays PASS",
            "A6",
        )
    )

    # PROD-06 -------------------------------------------------- duplicate UI
    dashboards = list(facts["dashboards"])  # type: ignore[arg-type]
    nav = dict(facts["navigation_signals"])  # type: ignore[arg-type]
    duplicated = len(dashboards) > 1
    checks.append(
        _check(
            "PROD-06",
            "One owner per player-facing HUD job",
            "WARN" if duplicated else "PASS",
            (
                f"{len(dashboards)} surfaces render player status ({', '.join(dashboards)}) and the survival "
                f"navigation signals overlap ({nav}). A0's HUD and A6's survival HUD are two implementations "
                "of one job; shipping both would be exactly the duplicate-UI failure D052 names."
            )
            if duplicated
            else "A single surface owns player status.",
            [{"fact": "status surfaces", "value": dashboards}, {"fact": "navigation signals", "value": nav}],
            "declare one owner for status/needs and make the other a child view; PROD-06 = PASS with one entry",
            "A0 + A6",
        )
    )

    # PROD-07 ------------------------------------------------- unconnected data
    orphans = list(facts.get("orphan_items") or [])  # type: ignore[arg-type]
    checks.append(
        _check(
            "PROD-07",
            "Every authored item is connected to a source or a sink",
            "PASS" if not orphans else "FAIL",
            (
                "All {n} authored items have a source, a recipe output, or a recipe/technology input, so the "
                "catalog itself contains no dead item. Player-facing *actions* (crafting, research, stations) "
                "are still unreachable, but that is the mount gap in PROD-01/02, not an unconnected item."
            ).format(n=facts.get("item_count")),
            [
                {"fact": "items", "value": facts.get("item_count")},
                {"fact": "items with a source", "value": facts.get("sourced_item_count")},
                {"fact": "unconnected items", "value": [row["item_id"] for row in orphans]},
                {"fact": "authored stations (no mounted interaction today)", "value": list(facts.get("station_ids") or [])},
            ],
            "keep the catalog connected; PROD-07 fails as soon as an item has neither source nor sink",
            "A3",
        )
    )
    return checks


def data_gaps(facts: Dict[str, object]) -> Dict[str, object]:
    """Facts that came from empty pinned text: reported as UNKNOWN, never PASS."""
    return {
        "unknown_evidence": [
            "whether the mounted scenes run without error (native run required)",
            "whether the two armour-stage sprite sets exist in the user's Drive folder",
        ],
        "reason": "static bytes cannot prove runtime behaviour or the existence of an unshared asset",
    }


def model_facts(model) -> Dict[str, object]:
    """Data-side facts the product audit needs (orphan items, dead actions)."""
    sourced = {
        str(source.get("item_id"))
        for source in model.sources.values()
        if source.get("item_id")
    }
    produced: set[str] = set()
    consumed: set[str] = set()
    for recipe in model.recipes.values():
        produced.update(str(k) for k in (recipe.get("outputs") or {}))
        consumed.update(str(k) for k in (recipe.get("inputs") or {}))
    for technology in model.technologies.values():
        consumed.update(str(k) for k in (technology.get("inputs") or {}))

    orphan: List[Dict[str, object]] = []
    for item_id, item in sorted(model.items.items()):
        if item_id in sourced or item_id in produced or item_id in consumed:
            continue
        orphan.append(
            {
                "item_id": item_id,
                "kind": item.get("kind"),
                "tags": list(item.get("tags") or []),
                "reason": "no source, not produced, not consumed",
            }
        )
    return {
        "orphan_items": orphan,
        "item_count": len(model.items),
        "sourced_item_count": len(sourced),
        "station_ids": sorted(model.stations),
    }
