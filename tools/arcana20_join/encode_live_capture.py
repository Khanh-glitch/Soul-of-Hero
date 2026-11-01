"""Encode real rendered frames by recorded wall time, never fabricate 60 Hz.

The PNG frames are the unscaled native viewport. The source tick may skip if
software rendering cannot keep up, and capture PNG I/O affects cadence. FFV1
is lossless; the MP4 is only a convenient review copy. Original timestamps
and actor/camera positions remain in timeline.json.
"""
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve()
record = json.loads((root / "timeline.json").read_text())
frames = record["frames"]
if len(frames) < 2:
    raise SystemExit("Need at least two actual captured frames")
concat = root / "frames.txt"
with concat.open("w") as f:
    for index, frame in enumerate(frames):
        path = root / frame["file"]
        if not path.is_file():
            raise SystemExit(f"Missing {path}")
        # Paths are generated in RUNNER_TEMP, not supplied by the game.
        f.write("file '" + str(path).replace("'", "'\\''") + "'\n")
        f.write("option framerate 1000\n")
        if index + 1 < len(frames):
            duration = frames[index + 1]["wall_s"] - frame["wall_s"]
            if duration < 0:
                raise SystemExit("Non-monotonic capture time")
            f.write(f"duration {max(0.001, duration):.6f}\n")
    # concat requires a final repeated file for the preceding duration.
    f.write("file '" + str(root / frames[-1]["file"]).replace("'", "'\\''") + "'\n")
    f.write("option framerate 1000\n")
for name, codec in [("native-lossless.mkv", ["-c:v", "ffv1", "-pix_fmt", "bgr0"]),
                    ("review.mp4", ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p"])]:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", str(concat), "-fps_mode", "vfr", *codec, str(root / name)], check=True)
