# A6 source / visual reuse research — checkpoint 2026-10-29

## Internal first

- `project.godot`: 640×360 design viewport, 1280×720 window, canvas_items/expand, nearest filter. No global settings touched. `game/overworld/overworld_hud.gd` is a compact low-opacity HUD; `game/survival/survival_build_system.gd` owns current placement strip, preview and costs. `chapter1_overworld.gd` polls placement input; see modal caveat in README.
- `assets/ui/free_inventory/License.txt`: ElvGames grants personal/commercial use and modification; prohibits selling the asset pack and claiming art as one's own; credit appreciated. Legal scope of pack redistribution or derivative distribution should be reviewed by release owner. **Not imported or modified for this checkpoint.**
- `assets/ui/loot/SOURCE_AND_LICENSE.md`: cutouts of LimeZu RPG Arsenal v1.1; source/license and mapped originals documented there. Do not infer rights for other artwork from repository source license. **Not imported or used here.** Existing sprites/production material need per-pack, per-file license trace before use. UI currently uses Godot default font and code-drawn shapes only.

## Alternatives studied; no code/art copied

1. **REFERENCE_ONLY** GLoot, https://github.com/peter-kish/gloot at `6b09b87ac07a8536779ef1ab0fafc7e99830f948`, repository MIT (`LICENSE`, copyright 2022 Peter Kish). Inspected `addons/gloot/ui/ctrl_inventory_grid.gd`: it binds to GLoot `Inventory` + `GridConstraint`, emitting selections and drag/drop. Good composability, but importing its authority would duplicate SOH's SaveService and require a nontrivial identity/transaction bridge. Artwork rights were not established independently; do not import its images based only on MIT code license.
2. **REFERENCE_ONLY** Swift Inventory, https://github.com/BlodyxCZ/Swift-Inventory-Godot-Addon at `af33f9818d8d95aaf9170fa975b1b594b4a1cc72`, repository MIT (`LICENSE`, copyright 2026 Blodyx). Inspected `Classes/SwiftGrid.gd` binding to `SwiftInventory`; assets/third-party node icons have separate notices in `addons/Swift_Inventory/THIRD_PARTY_NOTICES.md`, including Voxybuns MIT icon derivatives. Example art not independently cleared. Its storage, operations and own resources are not SOH's authoritative inventory. No code or art reused.
3. **REFERENCE_ONLY** Godot official multiple-resolutions documentation, https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html (4.7); evaluate integer stretch and aspect/camera behavior in a dedicated project-wide rendering review. An integer window multiple alone does not certify all pixels or fonts.
4. **BUILD_BESPOKE** isolated Godot controls plus read-only adapter using SOH's actual catalog and SaveService interfaces. Small dependency footprint; no second inventory, no save migrations. Revisit PORT_ADAPT or REUSE_DIRECT only after A0 agrees an authority-preserving bridge and after exact code and independent art licenses are cleared. REJECT wholesale import of either inventory manager; REJECT any unattributed artwork and similar-looking replacement Gold effects.

## Independent-review questions

Is presentation actually legible against real game art and at noninteger scales? Can GUI clicks reach A0's polled build action? Is a known resource hint actually discovered by the current player? Are overflow/keyboard interactions reachable without a mouse? Are Core and recipe projections exactly A3's eventual versioned schema? Do localized names/long translations fit? Until reviewed and tested these are open, not assumptions.

## 2026-10-29 continuation: interaction/focus

- Godot 4.7 [InputEvent propagation](https://docs.godotengine.org/en/4.7/tutorials/inputs/inputevent.html): `_input` precedes GUI; `_unhandled_input` follows GUI; this does not supply an authoritative gate for A0's separate `Input` polling. REFERENCE_ONLY; no code/art copied.
- Godot 4.7 [Keyboard/Controller Navigation and Focus](https://docs.godotengine.org/en/4.7/tutorials/ui/gui_navigation.html): automatic focus neighbors are guesses and can be wrong. This checkpoint starts and restores focus, tests one `ui_focus_next`, and still requires comprehensive keyboard/controller tests. REFERENCE_ONLY.
- BUILD_BESPOKE `expedition_map.gd`: schematic uses only geometric marks and caller-filtered discovered coordinates. This is not a substitute for A1 terrain/art; zero third-party art imported. Revisit integration against A1's actual geography and asset licenses.

## V2 continuation — original source-free pixel marks and fonts

The V2 pass still imports no inventory system and no third-party artwork. Tiny icons are generated as 24×24 logical-pixel `Image`/`ImageTexture` silhouettes in `game/survival/ui/pixel_ui.gd`; the angular folio corner trim is drawn in `pixel_panel.gd`. These are bespoke geometric UI marks, not copies of existing asset-pack art or source-faithful Gold effects. Typography uses the repository's already licensed Handjet body/semibold and Grenze Gotisch semibold files; their upstream source and SIL OFL terms are in `assets/fonts/SOURCES_AND_LICENSES.md`. Existing global nearest texture filtering and viewport scaling remain untouched. Native pixel/camera alignment and physical legibility still require capture and review; see `V2_VISUAL_SYSTEM.md`.
