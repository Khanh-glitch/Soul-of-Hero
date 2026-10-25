# Soul Anchor Relay (L06) - visual review

- Level id: `chapter_1_level_6`
- Map source: `data/levels/chapter_1_level_6.json`
- Source sha256: `32724da3b58cba60e1b431160ee62729baa782dee5d42f925438eb55adb084c8`
- Status: `TECHNICALLY VALID — VISUAL NOT READY`
- Art direction: Soul Anchor Relay — spectral mechanism bound in old stone

## What the native frames show

- Derived facade cells: 2720
- Landmark lights: 90
- Authored entities preserved: 73

### Improved

- Spectral palette reads immediately as a different place from the crypt, and the anchor landmarks cast cool light.

### Still missing against the brief

- The three anchor chambers are distinguished only by a light colour; there is no architecture saying 'chamber'.
- Split lanes are not readable as lanes.

### Next correction pass

- Frame each anchor with a stone housing (plinth, jamb, cap) so the anchor is inside something.
- Mark the split with a central pier rather than an open floor.

## Cost of the layer

- Nodes: 864 (art off) -> 1116 (art on)
- Draw calls: 66 -> 73
- Static memory: 118.9 MiB with the layer on

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
