# Crypt Entrance (L01) - visual review

- Level id: `chapter_1_level_1`
- Map source: `data/levels/crypt_entrance.json`
- Source sha256: `2987734ec11d675f634d013af5e272263c86187be2478282fd9eee3efd77eece`
- Status: `INCOMPLETE — ART DELIVERY FAILED`
- Art direction: Crypt Entrance — the chapter's approachable threshold

## What the native frames show

- Derived facade cells: 2190
- Landmark lights: 6
- Authored entities preserved: 61

### Improved

- The slate-blue floor and flat grey wall tops are now warm sandstone with brick courses, a coping course and side returns, so the first room reads as built masonry.
- Wall torches and banners hang at a fixed rhythm with real point lights, and the room has lit pools instead of uniform brightness.
- A dark paved margin runs around the room, so the walkable floor no longer runs edge to edge into its own walls.

### Still missing against the brief

- The tutorial must stay readable, so the world tint is only 0.95; contrast is therefore weaker here than in later levels, and the room can still read flat.
- There is no doorway frame or arch at the room mouth - transitions are still a gap in a wall.
- Identity is carried by palette and props; nothing in the derived architecture says 'crypt entrance' specifically.

### Next correction pass

- Author a masonry door surround (jambs + lintel) at each room opening.
- Add paired sconces flanking the spawn and the sigil so the eye has a landmark to lock onto immediately.

## Cost of the layer

- Nodes: 677 (art off) -> 748 (art on)
- Draw calls: 74 -> 81
- Static memory: 112.3 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_checkpoint_2.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/after_landmark_2.png`
- `images/after_landmark_3.png`
- `images/before_checkpoint.png`
- `images/before_checkpoint_2.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/before_landmark_2.png`
- `images/before_landmark_3.png`
- `images/crop3x_entry.png`
- `images/crop3x_exit.png`
- `images/crop3x_landmark.png`
- `images/pair_checkpoint.png`
- `images/pair_checkpoint_2.png`
- `images/pair_entry.png`
- `images/pair_exit.png`
- `images/pair_landmark.png`
- `images/pair_landmark_2.png`
- `images/pair_landmark_3.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
