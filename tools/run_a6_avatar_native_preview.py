#!/usr/bin/env python3
"""Run the real, SHA-pinned A0 world with privately staged A6 grade-0 art.

Nothing is copied back into the repository except ignored capture evidence. The
A0 source clone is temporary and detached; this does not edit/branch/commit A0.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile

A0_SHA = "5387bed6260cb7b9bd4d8229ee759dee08a0d918"
REPO_URL = "https://github.com/Khanh-glitch/Soul-of-Hero.git"
A6_FILES = (
    "game/survival/ui/avatar_appearance_adapter.gd",
    "game/survival/ui/avatar_sprite_pipeline.gd",
    "game/survival/ui/a0_avatar_presentation_driver.gd",
    "game/survival/ui/avatar_art_manifest.json",
    "tests/survival/ui/a6_avatar_native_capture.gd",
)
SIZES = {"720p": "1280x720", "2k": "2560x1440", "4k": "3840x2160"}


def run(command: list[str], *, cwd: Path | None = None, log_path: Path | None = None) -> subprocess.CompletedProcess:
    result = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(result.stdout, encoding="utf-8")
    if result.returncode:
        tail = "\n".join(result.stdout.splitlines()[-100:])
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(command)}\n{tail}")
    return result


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Capture is not a valid PNG: {path}")
    return struct.unpack(">II", data[16:24])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--godot", default=os.environ.get("GODOT_BIN", "godot"))
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--keep-composed-project", action="store_true")
    args = parser.parse_args()
    repo = args.repo_root.resolve()
    private_root = repo / "private_art" / "a6_avatar"
    private_manifest = private_root / "avatar_art_private_runtime.json"
    if not private_manifest.is_file():
        raise RuntimeError("Private art is not staged. Run tools/stage_a6_avatar_art.py with both ZIPs outside the repository.")
    godot = shutil.which(args.godot)
    if not godot:
        raise RuntimeError(f"Godot is unavailable ({args.godot!r}); this preview requires native Godot 4.7.")
    version = run([godot, "--version"]).stdout.strip()
    if not version.startswith("4.7"):
        raise RuntimeError(f"Expected Godot 4.7, found {version!r}.")
    xvfb = shutil.which("xvfb-run")
    if not xvfb and not os.environ.get("DISPLAY"):
        raise RuntimeError("A display server is required; install xvfb-run or run from a desktop session.")

    output = (args.output or repo / ".artifacts" / "a6-avatar").resolve()
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "native-preview-report.json"
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
        for relative in A6_FILES:
            target = project / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(repo / relative, target)
        shutil.copytree(private_root, project / "private_art" / "a6_avatar", dirs_exist_ok=True)
        import_log = output / "godot-private-art-import.log"
        run([godot, "--headless", "--editor", "--path", str(project), "--import", "--quit"], log_path=import_log)

        private_data = json.loads(private_manifest.read_text(encoding="utf-8"))
        for gender in ("male", "female"):
            for tag, resolution in SIZES.items():
                command = [
                    godot, "--path", str(project), "--windowed", "--resolution", resolution,
                    "--script", "res://tests/survival/ui/a6_avatar_native_capture.gd", "--",
                    f"gender={gender}", f"tag={tag}", f"out={output}",
                    f"actions={'true' if tag == '720p' else 'false'}",
                ]
                if xvfb:
                    command = [xvfb, "-a", "-s", "-screen 0 3840x2160x24", *command]
                log_path = output / f"run-{gender}-{tag}.log"
                run(command, cwd=project, log_path=log_path)
                captures = sorted(output.glob(f"{gender}_{tag}_*.png"))
                if not captures:
                    raise RuntimeError(f"No native screenshots were produced for {gender}/{tag}.")
                expected = tuple(map(int, resolution.split("x")))
                for image in captures:
                    actual_size = png_size(image)
                    if actual_size != expected:
                        raise RuntimeError(f"Wrong screenshot dimensions for {image}: {actual_size} != {expected}")
                    capture_records.append({"file": image.name, "width": actual_size[0], "height": actual_size[1]})
        report = {
            "result": "NATIVE_CAPTURED_NOT_HUMAN_REVIEWED",
            "godot_version": version,
            "a0_source_sha": A0_SHA,
            "a6_source_sha": run(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip(),
            "source_manifest": {
                "male_archive_sha256": private_data["characters"]["male"]["archive_sha256"],
                "female_archive_sha256": private_data["characters"]["female"]["archive_sha256"],
            },
            "captures": capture_records,
            "scope_note": "A0's world, CharacterBody2D, input, HUD, SaveService and VFX were composed unchanged. Identity was passed as a preview-only A0 projection. This is not an A0 identity-selection feature or production mount.",
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
        report_path.write_text(json.dumps({"result":"BLOCKED_OR_FAILED", "a0_source_sha":A0_SHA, "godot_version":version, "error":str(error)}, indent=2) + "\n", encoding="utf-8")
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    finally:
        temp_context.cleanup()


if __name__ == "__main__":
    raise SystemExit(main())
