#!/usr/bin/env python3
"""Publish review thumbnails of the R13 authored-continent frames via annotations.

The untouched full-resolution PNGs stay in the CI artifact (and in
`artifacts/visual_authored_*.png`). This produces a deliberately downscaled, lossy
JPEG contact sheet so a reviewer whose sandbox cannot reach the artifact host can
still see *something* — and the thumbnails say which original each came from.

Detail acceptance still requires the original frames: a 640x360 thumbnail cannot
prove a readable HUD at 2160p.
"""
import base64
import hashlib
import io
import pathlib
import sys
import tarfile

from PIL import Image

GROUP_SIZE = 9
CHUNK_SIZE = 3500
MAX_PARTS = 45
NAMES = ("spawn", "walk", "terrain", "source", "source_after_g")
RESOLUTIONS = ("1280x720", "2560x1440", "3840x2160")

root = pathlib.Path("artifacts")
archive = root / "authored-visual-review-thumbnails.tar.gz"
group = int(sys.argv[1])
if group == 0:
    paths = [
        root / f"visual_authored_{name}_{resolution}.png"
        for resolution in RESOLUTIONS
        for name in NAMES
        if (root / f"visual_authored_{name}_{resolution}.png").exists()
    ]
    if not paths:
        raise SystemExit("no authored frames found; nothing to publish")
    for quality in (65, 50, 40, 30):
        with tarfile.open(archive, "w:gz") as tar:
            for path in paths:
                with Image.open(path) as image:
                    image.thumbnail((640, 360), Image.Resampling.NEAREST)
                    buf = io.BytesIO()
                    image.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
                data = buf.getvalue()
                # The file name already carries the resolution it was captured at.
                info = tarfile.TarInfo(f"{path.stem}_review.jpg")
                info.size = len(data)
                tar.addfile(info, io.BytesIO(data))
        if len(base64.b64encode(archive.read_bytes())) <= MAX_PARTS * CHUNK_SIZE:
            break
    else:
        raise SystemExit("review thumbnails exceed the bounded annotation budget")
data = archive.read_bytes()
encoded = base64.b64encode(data).decode("ascii")
parts = [encoded[i : i + CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
sha = hashlib.sha256(data).hexdigest()
for index in range(group * GROUP_SIZE, min((group + 1) * GROUP_SIZE, len(parts))):
    print(f"::notice::A0_AUTHORED_REVIEW_THUMBNAILS {index}/{len(parts)} {sha} {parts[index]}")


def _crops(group_index: int) -> None:
    """1:1 crops of the 720p frames, small enough to survive the annotation budget.

    A thumbnail cannot show whether the HUD is legible, and a whole 2160p frame does
    not fit in an annotation. So this publishes two crops cut at the original pixel
    scale (no resampling of any kind) from the 1280x720 run: the HUD band and a square
    around the camera. The untouched full-resolution PNGs remain the artifact.
    """
    crop_archive = root / "authored-visual-native-crops.tar.gz"
    sources = [
        (root / "visual_authored_spawn_1280x720.png", "spawn"),
        (root / "visual_authored_source_1280x720.png", "source"),
    ]
    present = [(path, name) for path, name in sources if path.exists()]
    if not present:
        raise SystemExit("no 720p authored frames to crop")
    with tarfile.open(crop_archive, "w:gz") as tar:
        for path, name in present:
            with Image.open(path) as image:
                width, height = image.size
                hud = image.crop((0, height - 150, width, height))
                centre = image.crop((width // 2 - 240, height // 2 - 135, width // 2 + 240, height // 2 + 135))
                for label, part in (("hud", hud), ("centre", centre)):
                    buf = io.BytesIO()
                    part.convert("RGB").save(buf, format="JPEG", quality=78, optimize=True)
                    payload = buf.getvalue()
                    info = tarfile.TarInfo(f"1280x720_{name}_{label}_1x.jpg")
                    info.size = len(payload)
                    tar.addfile(info, io.BytesIO(payload))
    blob = crop_archive.read_bytes()
    encoded_crops = base64.b64encode(blob).decode("ascii")
    parts = [encoded_crops[i : i + CHUNK_SIZE] for i in range(0, len(encoded_crops), CHUNK_SIZE)]
    digest = hashlib.sha256(blob).hexdigest()
    for index in range(group_index * GROUP_SIZE, min((group_index + 1) * GROUP_SIZE, len(parts))):
        print(f"::notice::A0_AUTHORED_REVIEW_CROPS {index}/{len(parts)} {digest} {parts[index]}")


if len(sys.argv) > 2 and sys.argv[2] == "crops":
    _crops(group)
