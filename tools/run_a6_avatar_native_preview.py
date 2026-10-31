#!/usr/bin/env python3
"""Run the real, SHA-pinned A0 world with privately staged A6 grade-0 art.

Nothing is copied back into the repository except ignored capture evidence. The
A0 source clone is temporary and detached; this does not edit/branch/commit A0.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile

A0_SHA = "69070a1138730536050053c5aa47334b7b2c3836"
REPO_URL = "https://github.com/Khanh-glitch/Soul-of-Hero.git"
A6_FILES = (
    "game/survival/ui/avatar_appearance_adapter.gd",
    "game/survival/ui/avatar_sprite_pipeline.gd",
    "game/survival/ui/a0_avatar_presentation_driver.gd",
    "game/survival/ui/avatar_art_manifest.json",
    "tests/survival/ui/a6_avatar_native_capture.gd",
)
SIZES = {"720p": "1280x720", "2k": "2560x1440", "4k": "3840x2160"}


def run(command: list[str], *, cwd: Path | None = None, log_path: Path | None = None, timeout: int = 300) -> subprocess.CompletedProcess:
    try:
        result = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        partial = error.stdout or ""
        if isinstance(partial, bytes):
            partial = partial.decode("utf-8", errors="replace")
        if log_path:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.write_text(str(partial), encoding="utf-8")
        raise RuntimeError(f"Command exceeded its {timeout}s bound: {' '.join(command)}") from error
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(result.stdout, encoding="utf-8")
    if result.returncode:
        tail = "\n".join(result.stdout.splitlines()[-100:])
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{tail}")
    return result


def validate_private_stage(repo: Path) -> dict:
    private_root = repo / "private_art" / "a6_avatar"
    manifest_path = private_root / "avatar_art_private_runtime.json"
    if not manifest_path.is_file():
        raise RuntimeError("Private art is not staged. Run the staging tool with ZIPs kept outside Git.")
    metadata = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(metadata, dict):
        raise RuntimeError("Private runtime manifest must be a JSON object.")
    if metadata.get("status") != "LOCAL_PRIVATE_PREVIEW_ONLY":
        raise RuntimeError("Private runtime overlay has an unexpected status.")
    characters = metadata.get("characters")
    if not isinstance(characters, dict):
        raise RuntimeError("Private runtime manifest has no character map.")
    for gender in ("male", "female"):
        character = characters.get(gender)
        grades = character.get("armor_grades") if isinstance(character, dict) else None
        grade_zero = grades.get("0") if isinstance(grades, dict) else None
        actions = grade_zero.get("runtime_action_sheets") if isinstance(grade_zero, dict) else None
        if not isinstance(actions, dict) or set(actions) != {
            "idle", "walk", "run", "hurt", "death", "attack", "walk_attack", "run_attack"
        }:
            raise RuntimeError(f"Private {gender} runtime overlay does not contain the eight selected base actions.")
        for action, record in actions.items():
            if not isinstance(record, dict):
                raise RuntimeError(f"Private {gender}/{action} manifest record must be an object.")
            resource_path = str(record.get("texture_path", ""))
            expected_prefix = f"res://private_art/a6_avatar/{gender}/"
            if not resource_path.startswith(expected_prefix):
                raise RuntimeError(f"Private {gender}/{action} texture path escaped its ignored staging directory.")
            image = (repo / resource_path.removeprefix("res://")).resolve()
            if not image.is_relative_to(private_root.resolve()):
                raise RuntimeError(f"Private {gender}/{action} texture path resolves outside ignored staging.")
            if not image.is_file() or hashlib.sha256(image.read_bytes()).hexdigest() != record.get("sha256"):
                raise RuntimeError(f"Private staged {gender}/{action} sheet is missing or differs from its locked member hash.")
    return metadata


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Capture is not a valid PNG: {path}")
    return struct.unpack(">II", data[16:24])


def preflight_a0(project: Path) -> None:
    required = (
        "project.godot",
        "game/overworld/chapter1_overworld.tscn",
        "game/overworld/chapter1_overworld.gd",
        "game/characters/knight/knight.tscn",
        "game/characters/knight/knight.gd",
        "game/autoload/input_bootstrap.gd",
        "game/autoload/save_service.gd",
        "game/survival/gameplay_input_gate.gd",
    )
    missing = [path for path in required if not (project / path).is_file()]
    if missing:
        raise RuntimeError(f"Pinned A0 project is missing required paths: {', '.join(missing)}")
    settings = (project / "project.godot").read_text(encoding="utf-8")
    for autoload in ('InputBootstrap="*res://game/autoload/input_bootstrap.gd"', 'SaveService="*res://game/autoload/save_service.gd"', 'SurvivalService="*res://game/survival/survival_service.gd"'):
        if autoload not in settings:
            raise RuntimeError(f"Pinned A0 autoload preflight failed: {autoload}")
    if re.search(r"(?m)^survival/a0_waystation_candidate\s*=\s*true\b", settings):
        raise RuntimeError("Pinned A0 candidate Waystation route is enabled; preview expects the unchanged legacy production route.")
    input_code = (project / "game/autoload/input_bootstrap.gd").read_text(encoding="utf-8")
    expected_bindings = (
        '&"move_left": [KEY_A, KEY_LEFT]', '&"move_right": [KEY_D, KEY_RIGHT]',
        '&"move_up": [KEY_W, KEY_UP]', '&"move_down": [KEY_S, KEY_DOWN]',
        '&"attack": [KEY_J]', '&"attack": [MOUSE_BUTTON_LEFT]', '&"attack": [JOY_BUTTON_X]',
    )
    for binding in expected_bindings:
        if binding not in input_code:
            raise RuntimeError(f"Pinned A0 InputMap binding changed: {binding}")
    save_code = (project / "game/autoload/save_service.gd").read_text(encoding="utf-8")
    if "func configure_storage(" not in save_code:
        raise RuntimeError("Pinned A0 SaveService.configure_storage is unavailable.")
    knight_code = (project / "game/characters/knight/knight.gd").read_text(encoding="utf-8")
    for fragment in ('enum PlayerState', 'var current_action', 'var facing_direction', 'var action_elapsed', 'func take_damage(', 'func respawn(', 'func _get_action_duration('):
        if fragment not in knight_code:
            raise RuntimeError(f"Pinned A0 KnightController API preflight failed: {fragment}")
    for state in ('IDLE', 'MOVE', 'ATTACK', 'SKILL', 'DASH', 'HURT', 'SWAP', 'INTERACT', 'DEAD'):
        if state not in knight_code:
            raise RuntimeError(f"Pinned A0 PlayerState is missing {state}")
    knight_scene = (project / "game/characters/knight/knight.tscn").read_text(encoding="utf-8")
    if '[node name="Sprite" type="AnimatedSprite2D" parent="."]' not in knight_scene or 'position = Vector2(0, -31)' not in knight_scene:
        raise RuntimeError("Pinned A0 Knight visual anchor changed; review the A6 foot alignment before preview.")
    overworld_code = (project / "game/overworld/chapter1_overworld.gd").read_text(encoding="utf-8")
    for fragment in (
        'func configure(',
        'func is_world_ready(',
        'func _spawn_player(',
        'ProjectSettings.get_setting(WAYSTATION_CANDIDATE_SETTING, false)',
    ):
        if fragment not in overworld_code:
            raise RuntimeError(f"Pinned A0 overworld launch/default-route preflight failed: {fragment}")
    print(
        f"A0 PRE-FLIGHT PASS: exact source pin {A0_SHA}; autoloads, Knight visual API, "
        "world paths and keyboard/mouse/controller bindings match."
    )


def write_blocked_report(report_path: Path, version: str, error: Exception) -> None:
    report = {
        "result": "BLOCKED_OR_FAILED",
        "a0_source_sha": A0_SHA,
        "godot_version": version,
        "native_capture": False,
        "identity_source": "CLI_PREVIEW_FIXTURE_NOT_A0_SAVE",
        "error": str(error),
    }
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--godot", default=os.environ.get("GODOT_BIN", "godot"))
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--keep-composed-project", action="store_true")
    args = parser.parse_args()
    repo = args.repo_root.resolve()
    private_root = repo / "private_art" / "a6_avatar"
    output = (args.output or repo / ".artifacts" / "a6-avatar").resolve()
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "native-preview-report.json"
    version = "NOT_AVAILABLE"
    try:
        private_data = validate_private_stage(repo)
        godot = shutil.which(args.godot)
        if not godot:
            raise RuntimeError(f"Godot is unavailable ({args.godot!r}); this preview requires native Godot 4.7.")
        version = run([godot, "--version"], timeout=15).stdout.strip()
        if not version.startswith("4.7"):
            raise RuntimeError(f"Expected Godot 4.7, found {version!r}.")
        xvfb = shutil.which("xvfb-run")
        if not xvfb and not os.environ.get("DISPLAY"):
            raise RuntimeError("A display server is required; install xvfb-run or run from a desktop session.")
    except (OSError, ValueError, RuntimeError) as error:
        write_blocked_report(report_path, version, error)
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    capture_records: list[dict] = []
    temp_context = tempfile.TemporaryDirectory(prefix="soh-a6-avatar-a0-")
    project = Path(temp_context.name) / "a0"
    try:
        run(["git", "clone", "--quiet", "--filter=blob:none", "--no-checkout", REPO_URL, str(project)])
        run(["git", "fetch", "--quiet", "--depth=1", "origin", A0_SHA], cwd=project)
        run(["git", "checkout", "--quiet", "--detach", A0_SHA], cwd=project)
        actual = run(["git", "rev-parse", "HEAD"], cwd=project).stdout.strip()
        if actual != A0_SHA:
            raise RuntimeError(f"A0 pin mismatch: expected {A0_SHA}, got {actual}")
        preflight_a0(project)
        for relative in A6_FILES:
            target = project / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(repo / relative, target)
        shutil.copytree(private_root, project / "private_art" / "a6_avatar", dirs_exist_ok=True)
        import_log = output / "godot-private-art-import.log"
        run([godot, "--headless", "--editor", "--path", str(project), "--import", "--quit"], log_path=import_log, timeout=180)

        for gender in ("male", "female"):
            for tag, resolution in SIZES.items():
                for old_capture in output.glob(f"{gender}_{tag}_*.png"):
                    old_capture.unlink()
                command = [
                    godot, "--path", str(project), "--windowed", "--resolution", resolution,
                    "--script", "res://tests/survival/ui/a6_avatar_native_capture.gd", "--",
                    f"gender={gender}", f"tag={tag}", f"out={output}",
                    f"actions={'true' if tag == '720p' else 'false'}",
                ]
                if xvfb:
                    command = [xvfb, "-a", "-s", "-screen 0 3840x2160x24", *command]
                log_path = output / f"run-{gender}-{tag}.log"
                run(command, cwd=project, log_path=log_path, timeout=240)
                captures = sorted(output.glob(f"{gender}_{tag}_*.png"))
                if not captures:
                    raise RuntimeError(f"No native screenshots were produced for {gender}/{tag}.")
                expected = tuple(map(int, resolution.split("x")))
                for image in captures:
                    actual_size = png_size(image)
                    if actual_size != expected:
                        raise RuntimeError(f"Wrong screenshot dimensions for {image}: {actual_size} != {expected}")
                    capture_records.append({
                        "file": image.name,
                        "width": actual_size[0],
                        "height": actual_size[1],
                        "sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
                    })
        a6_overlay_hashes = {
            relative: hashlib.sha256((repo / relative).read_bytes()).hexdigest()
            for relative in A6_FILES
        }
        a6_overlay_modified = bool(
            run(["git", "status", "--porcelain", "--", *A6_FILES], cwd=repo).stdout.strip()
        )
        report = {
            "result": "NATIVE_CAPTURED_NOT_HUMAN_REVIEWED",
            "godot_version": version,
            "a0_source_sha": A0_SHA,
            "a6_git_head": run(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip(),
            "a6_overlay_modified": a6_overlay_modified,
            "a6_overlay_sha256": a6_overlay_hashes,
            "source_manifest": {
                "male_archive_sha256": private_data["characters"]["male"]["archive_sha256"],
                "female_archive_sha256": private_data["characters"]["female"]["archive_sha256"],
            },
            "captures": capture_records,
            "identity_source": "CLI_PREVIEW_FIXTURE_NOT_A0_SAVE",
            "action_input_scope": "Preview uses semantic Input actions against the pinned A0 actor; source preflight checks keyboard/mouse/controller InputMap bindings, but no physical-device or fresh-player journey is established.",
            "scope_note": "A0's world, CharacterBody2D, HUD, SaveService and VFX were composed unchanged. Identity was passed as a preview-only projection fixture, not read from A0 selection or persistence. A6 is not mounted into production.",
        }
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        if args.keep_composed_project:
            keep_path = output / "a0-composed-preview"
            if keep_path.exists():
                shutil.rmtree(keep_path)
            shutil.copytree(project, keep_path, ignore=shutil.ignore_patterns(".git", ".godot", "user_data"))
            print(f"Temporary composed source copy retained at {keep_path}; it contains private game sheets.")
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        write_blocked_report(report_path, version, error)
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    finally:
        temp_context.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
