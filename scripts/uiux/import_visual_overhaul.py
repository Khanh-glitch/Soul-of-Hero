#!/usr/bin/env python3
"""Import the exact Creator-supplied Wave 4 ZIP as an isolated, reproducible UI/UX app."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tempfile
import zipfile

BRANCH = "uiux/visual-overhaul-wave4-20261110"
EXPECTED_ZIP_SHA256 = "9a1f0b3ddfe456ac67c7a5ce595dac94c7015305f51f5a6b7690f2a143a32237"
DEST = Path("web/uiux/visual-overhaul")
REQUIRED = ("src/App.tsx", "src/ui/Game.tsx", "src/ui/SurvivorScreen.tsx",
            "src/ui/BuildBar.tsx", "src/ui/dragSlots.tsx", "src/ui/hud.tsx",
            "src/game/pixelfx/pilot.ts", "src/game/pixelfx/owner-vfx.ts",
            "dist-qa/index.html", "package.json")
ASSET_RE = re.compile(r"from '(\./[^']+\.png)\?url'")
DATA_RE = re.compile(r"data:image/png;base64,([A-Za-z0-9+/=]+)")

def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip", type=Path, help="Original soul-of-heroes-visual-overhaul (10).zip")
    ap.add_argument("--include-preview", action="store_true", help="Track 30 MB compiled QA HTML too")
    args = ap.parse_args()
    archive = args.zip.expanduser().resolve()
    if not archive.is_file():
        ap.error(f"ZIP missing: {archive}")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != EXPECTED_ZIP_SHA256:
        ap.error(f"Wrong source ZIP SHA256: {digest}; expected {EXPECTED_ZIP_SHA256}")
    root = Path.cwd()
    if not (root / "web" / "ref" / "OPERATIONS.md").exists():
        ap.error("Run from Soul-of-Hero repository root on the R12-based UI/UX branch")
    if (root / DEST).exists():
        ap.error(f"Destination exists: {DEST}. Do not overwrite an already-imported candidate.")
    parent = root / DEST.parent
    parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        names = set(z.namelist())
        missing = [n for n in REQUIRED if n not in names]
        if missing:
            ap.error("Required files missing: " + ", ".join(missing))
        with tempfile.TemporaryDirectory(prefix="soh-uiux-import-", dir=parent) as temp:
            stage = Path(temp) / "visual-overhaul"
            stage.mkdir()
            count = 0
            for entry in z.infolist():
                name = entry.filename
                path = Path(name)
                if name.startswith("/") or ".." in path.parts or "\\" in name:
                    ap.error(f"Unsafe ZIP path: {name!r}")
                if (entry.external_attr >> 16) & stat.S_IFMT == stat.S_IFLNK:
                    ap.error(f"Unsafe symlink: {name!r}")
                if entry.is_dir() or name == "docs/bible.md" or name.startswith("evidence/"):
                    continue
                if name.startswith("dist-qa/") and not args.include_preview:
                    continue
                output = stage / name
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(z.read(entry))
                count += 1
            # ZIP has zero PNGs. Recover all 54 from its own standalone HTML.
            html = z.read("dist-qa/index.html").decode("utf-8")
            payloads = DATA_RE.findall(html)
            imports = []
            for source in ("pilot.ts", "owner-vfx.ts"):
                text = (stage / "src/game/pixelfx" / source).read_text()
                imports.extend(ASSET_RE.findall(text))
            if len(imports) != 54 or len(payloads) != 54:
                ap.error(f"PixelFX recovery requires 54 imports and 54 PNGs, got {len(imports)}/{len(payloads)}")
            ledger = []
            for relative, encoded in zip(imports, payloads):
                data = base64.b64decode(encoded, validate=True)
                out = (stage / "src/game/pixelfx" / relative).resolve()
                if not out.is_relative_to(stage.resolve()):
                    ap.error(f"Unsafe asset path: {relative}")
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(data)
                ledger.append(f"{git_blob_sha(data)}  {out.relative_to(stage)}")
            (stage / "docs" / "PIXELFX_RECOVERY_GIT_BLOB_SHA1.txt").write_text("\n".join(ledger) + "\n")
            package = json.loads((stage / "package.json").read_text())
            package["name"] = "soh-uiux-visual-overhaul-wave4"
            package.setdefault("scripts", {})["typecheck"] = "tsc --noEmit"
            package["scripts"]["test"] = "vitest run"
            (stage / "package.json").write_text(json.dumps(package, indent=2) + "\n")
            index = (stage / "index.html")
            index.write_text(index.read_text().replace("Arena Web Dev App", "Soul of Hero — UI/UX Visual Overhaul"))
            (stage / ".gitignore").write_text("node_modules/\ndist/\nplaywright-report/\ntest-results/\n*.log\n")
            (stage / "README.md").write_text(
                "# Soul of Hero — UI/UX Visual Overhaul · Wave 4\n\n"
                "Isolated source-driven visual candidate, NOT the authoritative Gameplay runtime.\n"
                "Source: Creator ZIP SHA-256 `" + digest + "`.\n"
                "54 PixelFX PNGs recovered byte-for-byte from the supplied compiled HTML.\n"
                "Old ZIP docs/bible.md intentionally excluded; active canonical Bible is web/ref/bible.md.\n\n"
                "## Run\n`npm ci && npm run verify:assets && npm run typecheck && npm run build`\n"
                "`npm run dev` for browser development. `npm test` for source tests.\n\n"
                "Do not copy src/game, geography, persistence or balance into web/src.\n"
                "Visual adoption requires scoped UI diff, browser acceptance, gameplay/save regressions, and Creator review.\n"
                "The original Wave 4 account is in docs/VISUAL_ARENA_HANDOFF.md as historical evidence, not a current gameplay order.\n")
            if len(ledger) != 54:
                ap.error("Internal asset ledger mismatch")
            os.replace(stage, root / DEST)
    print(f"IMPORTED {count} ZIP files + {len(ledger)} recovered PNGs -> {DEST}")
    print("PIN", digest)
    print("NEXT: cd web/uiux/visual-overhaul && npm ci && npm run verify:assets && npm run typecheck && npm run build")

if __name__ == "__main__":
    main()
