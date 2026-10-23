# Running the Monastic Archive prototype

Authoring (regenerates the art and the room data):

```bash
python3 art_src/author_archive_art.py      # tiles, wall caps, props, light
python3 art_src/room_author.py             # room.json + preview PNGs
python3 art_src/validate_room.py           # layout / clearance / route checks
```

Render the real frames inside Godot 4.7:

```bash
godot --headless --path . --import --quit
xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 \
  godot --path . --rendering-method gl_compatibility --rendering-driver opengl3 \
        --audio-driver Dummy --resolution 1280x720 \
        res://prototypes/environment_art/archive_audition/scene/capture_archive_room.tscn
```

Frames land in `.artifacts/archive_room_*.png` (1280x720).

Walk into the room by hand:

```bash
godot --path . res://prototypes/environment_art/archive_audition/scene/archive_room.tscn
```
