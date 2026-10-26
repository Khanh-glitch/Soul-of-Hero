# Castellan Throne (L10) - visual review

- Level id: `chapter_1_level_10`
- Map source: `data/levels/chapter_1_level_10.json`
- Source sha256: `84a5af5d70c5bffcb0e0fd72d5642fbfee4ed65ee0ccc0eb6b84c86ec8a2ae30`
- Status: `COMPLETE — AWAITING OWNER VISUAL REVIEW`
- Art direction: Castellan Throne — the fallen ruler's hall

## What the native frames show

- Derived facade cells: 572
- Landmark lights: 23
- Authored entities preserved: 33

### Improved

- The chapter's last room is built on one axis and reads from the south door: antechamber, nave, crimson runner, four steps, throne, portal, all on the same centre line.
- The throne is colossal and inside the frame - a wide seat with a three-panel back, swept canopy fins, gold finials, a crimson cushion and heavy arms on a four-tier approach - because the map edge is at the top and a throne taller than the frame would be a wall.
- The fight is drawn on the floor: the crimson cross in the arena is the same carpet as the runner, so the crossing lanes of the encounter are the one part of the floor with nothing on it, without a marker and without touching a boss statistic, phase threshold, telegraph or HUD element.
- The portal is the architectural terminus: a moon-lit arch with two gold-banded pillars behind the throne, its cold teal light the only cool light in a room otherwise lit by candles.
- The court carries the chapter's formality: four heavy fluted columns on the arena's pillars, gold-leaf friezes, moon windows in the wall, royal banners, veiled statues, censers and the wreckage of the fight that got this far.

### Still missing against the brief

- The arena's east and west flanks are wide and only lightly furnished; filling them would work against a two-phase boss fight, so they are left open on purpose.
- The four steps read as inlay more than as elevation: the map is one flat floor layer and the art cannot create a height difference.
- Phase two is told by the boss and the HUD, not by the room; the moon windows and cool light are a groundwork for it, not a phase change.

### Next correction pass

- If a phase-two room state is ever wanted, the cheapest lever is the arena's wall windows and the carpet's condition, not new geometry.
- The throne's canopy fins are the one shape worth a second look at 1x zoom.

## Cost of the layer

- Nodes: 641 (art off) -> 726 (art on)
- Draw calls: 93 -> 112
- Static memory: 104.4 MiB with the layer on

## Frames

- `images/after_boss.png`
- `images/after_checkpoint.png`
- `images/after_entry.png`
- `images/after_exit.png`
- `images/before_boss.png`
- `images/before_checkpoint.png`
- `images/before_entry.png`
- `images/before_exit.png`
- `images/crop3x_boss.png`
- `images/crop3x_entry.png`
- `images/crop3x_exit.png`
- `images/pair_boss.png`
- `images/pair_checkpoint.png`
- `images/pair_entry.png`
- `images/pair_exit.png`

Every image above is a native Godot frame from the production `AppRoot`
campaign boot at 1280x720. `before_*` is the same map with the art layer
disabled, so the pair isolates the layer and nothing else. Nothing in this
folder is a plan diagram, a PIL preview or a generated image.
