# NPC integration browser evidence

Captured from the running Vite game with Playwright 1.55.1 and the real `@sparticuz/chromium` 138.0.2 Chromium binary at a 640×360 viewport (device scale factor 1). Chromium initially lacked `libnspr4.so`; the runtime's own `al2023.tar.br` dependency bundle was extracted to `/tmp/al2023` and supplied with `LD_LIBRARY_PATH`. No image was synthesized or edited.

- `new-game-640x360.png`: New Run → Veyra → Begin the 14 days. Browser snapshot: run `run_y2epef_mwjessz2`, 286 human actors, 81 community records, 68 communities with a physical store entity.
- `save-reload-640x360.png`: a separate real run was saved in browser storage, page reloaded, then Continue selected. Before/after snapshot had the same run ID (`run_y2dn9k_mwjetub5`), 286 people, and identical player global tile coordinates (delta 0,0). The visible return digest is part of the real UI.
- `npc-near-door-640x360.png`: real gameplay with survivors visible near a door. The contextual prompt selected the door; this is **not** evidence of the HumanPanel or completed NPC interaction UX.

These screenshots verify New Game, runtime rendering, and save/reload only. They do not verify the full NPC gameplay sequence, occupation loops, or the interaction panel.
