# Ossuary Fork (L02) - visual review

- Level id: `chapter_1_level_2`
- Map source: `data/levels/chapter_1_level_2.json`
- Source sha256: `abff2dcd9694b791d2903f1e38fada91067a542275577879afeee493eca68a0e`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Ossuary Fork — burial galleries, bone masonry

## What the native frames show

- Derived facade cells: 6424
- Landmark lights: 1
- Authored entities preserved: 64

### Improved

- The Ossuary Fork's walls are built from what the place is made of: coursed long bones with dark seams, a skull frieze set into the framed course at eye height, and plain bone coursing above it. The frieze is one band, not a stamped motif on every row.
- A bone arch stands over the crossing the level is named for, with a lantern either side of it, and banks of skulls are built into the wall where the fork's ways meet.
- The halls are furnished as an ossuary is: ranks of bone stacks in three kinds (a plain stack, one crowned with a skull, one with a shaft), with passages between them.
- Charnel fires burn cold in two places and are the only cool light in the level, which gives the warm bone stone something to answer.

### Still missing against the brief

- The fork does not yet tell the player which way is dangerous: both branches are furnished and lit the same way, and the brief asks the environment to signal the choice.
- The big halls are still unevenly furnished. At the level's densest camera position the frame holds two bone stacks and a lot of bare paving; the rank stride leaves more empty floor than the room's character can carry.
- The plain bone coursing is close to the value of bleach, so in a wide frame the walls out-punch the props standing in front of them.

### Next correction pass

- Signal the risky branch with a spill, a rubble fall or a darker paving family, and leave the safe branch plain.
- Decide furniture density inside a hall, not only along its walls: a second, offset rank in the large rooms.
- Drop the wall coursing a value so the props carry the light.

## Cost of the layer

- Nodes: 695 (art off) -> 810 (art on)
- Draw calls: 72 -> 94
- Static memory: 143.7 MiB with the layer on

## Frames

- `images/after_checkpoint.png`
- `images/after_checkpoint_2.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/after_landmark.png`
- `images/after_landmark_2.png`
- `images/after_landmark_3.png`
- `images/after_landmark_4.png`
- `images/before_checkpoint.png`
- `images/before_checkpoint_2.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/before_landmark.png`
- `images/before_landmark_2.png`
- `images/before_landmark_3.png`
- `images/before_landmark_4.png`
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
- `images/pair_landmark_4.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
