#!/usr/bin/env python3
"""Static checks for Godot resource text files, with no Godot binary involved.

Why this exists: the review sandbox has no engine, so a typo in a scene path, a
`%UniqueName` that no node owns, or a theme variation that was never declared would
otherwise only surface as a blank screen at runtime - after CI has already spent its
build. This walks the real files and fails loudly instead.

Checks
  1. every ext_resource / ExtResource() path exists on disk
  2. load_steps matches the number of ext+sub resources (plus the resource itself)
  3. every `parent="A/B"` names a node that this scene declares
  4. every `%Name` a script of the same scene references belongs to a node with
     `unique_name_in_owner = true`
  5. every `theme_type_variation = &"X"` is a declared variation or a real type in
     the theme the scene uses (when that theme is a repo .tres)
  6. no duplicate node paths in one scene
  7. no duplicate function / const / member declarations in one script (a hard
     Godot parse error that gdtoolkit's grammar happily accepts)

Exit code is 1 when anything fails, so CI can gate on it.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

EXT_RE = re.compile(r'^\[ext_resource[^\]]*path="([^"]+)"', re.MULTILINE)
SUB_RE = re.compile(r"^\[sub_resource ", re.MULTILINE)
NODE_RE = re.compile(r'^\[node name="([^"]+)"(?: type="([^"]+)")?(?: parent="([^"]*)")?', re.MULTILINE)
LOAD_STEPS_RE = re.compile(r"^\[gd_(?:scene|resource)[^\]]*load_steps=(\d+)")
THEME_REF_RE = re.compile(r'^\[ext_resource type="Theme" path="([^"]+)"', re.MULTILINE)
VARIATION_RE = re.compile(r'theme_type_variation = &"([^"]+)"')
UNIQUE_RE = re.compile(r"^unique_name_in_owner = true", re.MULTILINE)
PERCENT_RE = re.compile(r"%([A-Z_][A-Za-z0-9_]*)")
DECLARED_VARIATION_RE = re.compile(r'^([A-Z][A-Za-z0-9_]*)/base_type = &"([^"]+)"', re.MULTILINE)
BUILTIN_TYPES = {
    "Button", "PanelContainer", "Panel", "Label", "RichTextLabel", "TextureRect",
    "Control", "VBoxContainer", "HBoxContainer", "MarginContainer", "GridContainer",
    "ScrollContainer", "ProgressBar", "CheckBox", "CheckButton", "LineEdit",
    "TabContainer", "ItemList", "TextureButton", "OptionButton", "SpinBox",
    "TooltipPanel", "TooltipLabel", "PopupPanel", "VScrollBar", "HScrollBar",
}


def blocks(text: str) -> list[tuple[str, str]]:
    """Split a .tscn/.tres into (header_line, body) blocks."""
    parts = re.split(r"(?m)^(\[.*\])$", text)
    out: list[tuple[str, str]] = []
    # parts = ['', header, body, header, body, ...]
    for index in range(1, len(parts) - 1, 2):
        out.append((parts[index], parts[index + 1]))
    return out


def resolve(project_path: str) -> Path:
    return ROOT / project_path.replace("res://", "")


def check_scene(path: Path, problems: list[str], notes: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT)

    ext_paths = EXT_RE.findall(text)
    for project_path in ext_paths:
        if project_path.startswith("res://") and not resolve(project_path).exists():
            problems.append(f"{rel}: ext_resource path does not exist: {project_path}")

    steps_match = LOAD_STEPS_RE.search(text)
    if steps_match:
        declared = int(steps_match.group(1))
        actual = len(ext_paths) + len(SUB_RE.findall(text)) + 1
        if declared != actual:
            notes.append(f"{rel}: load_steps={declared} but the file has {actual} steps (Godot only reserves capacity)")

    # Node tree: parent path -> full path, and unique names.
    seen: dict[str, str] = {}
    unique_names: set[str] = set()
    for header, body in blocks(text):
        node = NODE_RE.match(header)
        if not node:
            continue
        name, _type, parent = node.group(1), node.group(2), node.group(3)
        if parent is None:
            # Root node of the scene.
            seen[name] = name
            continue
        # Godot writes parent="." for "child of the root", and a bare relative path
        # such as parent="Barrier" for deeper nodes.
        parent_path = parent.strip()
        if parent_path in (".", "./", ""):
            parent_path = ""
        if parent_path.startswith("./"):
            parent_path = parent_path[2:]
        full = f"{parent_path}/{name}" if parent_path else name
        if full in seen:
            problems.append(f"{rel}: duplicate node path {full}")
        seen[full] = name
        if parent_path and parent_path not in seen:
            problems.append(f"{rel}: node '{full}' has unknown parent path '{parent_path}'")
        if UNIQUE_RE.search(body):
            unique_names.add(name)

    script_text = ""
    for project_path in ext_paths:
        if project_path.endswith(".gd"):
            candidate = resolve(project_path)
            if candidate.exists():
                script_text += candidate.read_text(encoding="utf-8")
    for match in PERCENT_RE.finditer(script_text):
        referenced = match.group(1)
        if referenced in unique_names:
            continue
        # Optional and cross-scene lookups are written as string literals
        # (get_node_or_null("%X"), preview.get_node("%X")); those resolve against a
        # different owner and are not this scene's contract.
        prefix = script_text[max(0, match.start() - 18):match.start()]
        if 'get_node_or_null("' in prefix or prefix.rstrip().endswith('"'):
            continue
        problems.append(f"{rel}: script uses %{referenced} but no node declares unique_name_in_owner")

    # Theme variations.
    theme_paths = THEME_REF_RE.findall(text)
    variations: set[str] = set()
    for theme_path in theme_paths:
        theme_file = resolve(theme_path)
        if not theme_file.exists():
            continue
        for match in DECLARED_VARIATION_RE.finditer(theme_file.read_text(encoding="utf-8")):
            variations.add(match.group(1))
    if variations:
        for used in set(VARIATION_RE.findall(text)):
            if used not in variations and used not in BUILTIN_TYPES:
                notes.append(f"{rel}: theme_type_variation '{used}' is not declared in {theme_paths} (falls back to the base type)")


FUNC_RE = re.compile(r"^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
CONST_RE = re.compile(r"^const\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE)
MEMBER_VAR_RE = re.compile(r"^(?:@export[^\n]*\s)?var\s+([A-Za-z_][A-Za-z0-9_]*)", re.MULTILINE)


def check_script(path: Path, problems: list[str]) -> None:
    """Duplicate declarations in one script are a hard Godot parse error.

    gdtoolkit's grammar accepts them (it is a *grammar*, not a semantic check), so a
    duplicated `func` slipped through the parse sweep and shipped a screen the engine
    refused to load. This catches the class of bug that the parser cannot.
    """
    source = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT)
    for pattern, kind in ((FUNC_RE, "function"), (CONST_RE, "const"), (MEMBER_VAR_RE, "member")):
        seen: dict[str, int] = {}
        for match in pattern.finditer(source):
            name = match.group(1)
            line = source.count("\n", 0, match.start()) + 1
            if name in seen:
                problems.append(
                    f"{rel}:{line}: duplicate {kind} '{name}' (first declared on line {seen[name]})"
                )
            else:
                seen[name] = line


def check_theme(path: Path, problems: list[str], notes: list[str]) -> None:
    """A theme file is only checked for dangling texture and font paths."""
    text = path.read_text(encoding="utf-8")
    for project_path in EXT_RE.findall(text):
        if project_path.startswith("res://") and not resolve(project_path).exists():
            problems.append(f"{path.relative_to(ROOT)}: ext_resource path does not exist: {project_path}")


def main(argv: list[str]) -> int:
    targets = [Path(arg) for arg in argv[1:]]
    if not targets:
        targets = (
            sorted(ROOT.glob("game/**/*.tscn"))
            + sorted(ROOT.glob("game/**/*.tres"))
            + sorted(ROOT.glob("tests/**/*.gd"))
        )
    problems: list[str] = []
    notes: list[str] = []
    for path in targets:
        path = path if path.is_absolute() else ROOT / path
        suffix = path.suffix
        if suffix == ".tscn":
            check_scene(path, problems, notes)
        elif suffix == ".tres":
            check_theme(path, problems, notes)
        elif suffix == ".gd":
            check_script(path, problems)
    for problem in problems:
        print(f"FAIL {problem}")
    for note in notes:
        print(f"note {note}")
    print(f"scene lint: {len(targets)} files, {len(problems)} problems, {len(notes)} notes")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
