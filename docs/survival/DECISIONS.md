# Design decision ledger

Each decision carries a state: **LOCKED_USER**, **ENGINEERING_DEFAULT_REVISABLE**, **OPEN**, or **REJECTED**. Agents do not silently upgrade proposed ideas into user-approved product requirements.

| ID | Status | Decision / constraint | Reason / provenance |
| --- | --- | --- | --- |
| D001 | LOCKED_USER | Design the whole world masterplan from the outset, player access expands gradually by in-world threats/gear/terrain/world-state | Explicit user clarification |
| D002 | LOCKED_USER | Keep exactly the current 10 Chapter-1 dungeon buildings within roughly the opening quarter; preserve dungeon interiors | Explicit user clarification |
| D003 | LOCKED_USER | Offline exploration, resource gathering, construction, crafting, loot and research should closely preserve the motivating Last Day Rules experience | Explicit user request |
| D004 | LOCKED_USER | Top-down building must create a usable shelter with true interior, storage and utility, not just upgrades via menu | Explicit user request |
| D005 | LOCKED_USER | Skill Core physical item finite uses; permanent learned reproduction knowledge; different world materials for new cores | Explicit user request |
| D006 | LOCKED_USER | Gold VFX must reproduce full original effect, including on enemies and environment, not approximated or stripped | Historical explicit rule |
| D007 | LOCKED_USER | Agent should work efficiently end-to-end; no approval request for each small internal step | Explicit user request |
| D008 | ENGINEERING_DEFAULT_REVISABLE | Use SOH as root architecture, reuse permissively licensed source modules as reference / selected adapter rather than migrating game onto FOG | Existing SaveService, VFX, Hero architecture |
| D009 | ENGINEERING_DEFAULT_REVISABLE | Use one authoritative SaveService transaction boundary and migration-safe new state domains | Prevent dupes, loss and save incompatibility |
| D010 | ENGINEERING_DEFAULT_REVISABLE | Keep user building geometry in separate dynamic world-state/chunks instead of editing baked static masterplan | Topology, saves, streaming |
| D011 | ENGINEERING_DEFAULT_REVISABLE | Base-building 2D cells with foundation/roof room model and click-drag ghost preview | Best fit for native SOH TileMap |
| D012 | OPEN | Exact Core depletion semantics: per successful cast vs channel time, ability family exceptions, repair possibilities | Requires gameplay design/balance testing |
| D013 | OPEN | Corpse bag expiration, difficulty modes and resource respawn frequencies | Requires playtest |
| D014 | OPEN | Art-kit choice for modular walls/roofs and final biome tile language | Inventory doesn't prove a complete coherent construction kit |
| D015 | OPEN | Final worldwide dimensions, region layouts and exact biome partitioning | Need travel pacing and density tests |
| D016 | REJECTED | Taking an unlicensed proprietary Last Island Unity source/asset dump to implement gameplay | IP/license risk; no authorized repository demonstrated |
| D017 | REJECTED | Labeling 93 registry entries as 93 working Godot skills | 0 native-ready at audited snapshot |
| D018 | REJECTED | Simple uniformly random scattering of materials and landmarks as world layout | User explicitly rejected this map design language |
| D019 | REJECTED | Wholesale import of a second SaveManager and inventory root from The FOG or other project | Source-of-truth conflict |
| D020 | OPEN | Extent of weather, crops/NPC automation and dynamic hostile raids in first production pass | Important long-term mechanics; calibrate scope after functional loop |

**Change policy:** if a LOCKED_USER item appears contradictory with a newly discovered technical fact, mark a conflict and propose alternatives in issue #9; do not silently change it. Record exact date, decision owner and code impact for any later resolution.
