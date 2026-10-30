# User-locked character and anti-clutter correction (2026-10-30)

Authoritative D051/D052: https://github.com/Khanh-glitch/Soul-of-Hero/blob/docs/ct-loot-discovery-gate-20261030/docs/survival/DECISIONS.md

Two selectable characters: exact user-selected bald and unarmored male/female Drive assets. Equipment drives two later armor looks, L1 and L2, for each character. Equip/unequip, save/reload, death/respawn and combat must reflect actual gear, not experience level or Knight fallback. Previous ZIP titles are not proof of matching bald/armor sprite files. Source currently UNVERIFIED from accessible Drive search, so require actual source match before claiming implemented. No shooting-specific animation requirement.

Player UI quality: essential information only, visually legible at 720p/2K/4K and clean in actual gameplay. No debug enums, fixture labels, raw instance IDs, invented ability readiness, duplicated HUDs, dead buttons, huge text walls, fake completeness or unfinished visible screens. Internal diagnostics must remain available for developers and must be hidden from release mode. Avoid rewriting good UI; finish real action flows and owner-authorized A0 service integration. Fail player release for any known incomplete required flow.
