// ============================================================================
// SOUL OF HEROES — VISUAL ARENA · bespoke 16x16 pixel icons for Creator Cores,
// Elemental Cores, Essences, and high-significance world artifacts.
//
// Why this exists:
//   In art.ts, all 11 Cores shared a single 10x10 circle (`case 'core'`) with a
//   two-tone shade. At 1x scale, Vụ nổ lớn, Thiên thạch, Hơi thở của rồng,
//   Gươm Elsa, Hơi thở đất mẹ, Mjolnir, and Lõi quỷ were indistinguishable from
//   berries or coins. Every Core here has its own silhouette, internal facet
//   geometry, and elemental rim light.
// ============================================================================

type G = CanvasRenderingContext2D;
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const P = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };

/** Draw a custom 16x16 icon if this item key has bespoke art; returns true if handled. */
export function drawBespokeIcon(g: G, key: string): boolean {
  switch (key) {
    // 1. Vụ nổ lớn (Common Fire Core) — iron-banded magma bomb-core with twin vents
    case 'core_blast':
      R(g, 6, 1, 4, 2, '#5c666f'); R(g, 7, 1, 2, 1, '#9aa5b0');               // fuse cap
      R(g, 4, 3, 8, 9, '#7a2416'); R(g, 3, 5, 10, 5, '#b63c21');              // iron-red shell
      R(g, 5, 4, 6, 7, '#e86a2a'); R(g, 6, 5, 4, 5, '#ffb84a');               // molten core
      R(g, 7, 6, 2, 3, '#fff6c8');                                            // white-hot heart
      R(g, 3, 7, 10, 1, '#3a424c'); R(g, 7, 3, 1, 9, '#3a424c');              // iron cross-band
      P(g, 2, 4, '#ff9a3a'); P(g, 13, 10, '#ff9a3a'); P(g, 12, 3, '#ffe27a'); // vents
      return true;

    // 2. Thiên thạch (Rare Fire Core) — jagged obsidian meteor split by a solar rift
    case 'core_meteor':
      R(g, 5, 2, 6, 2, '#3a2628'); R(g, 3, 4, 10, 8, '#281a1e');              // charred rock body
      R(g, 4, 3, 8, 9, '#4a2c2a'); R(g, 2, 6, 12, 4, '#3a2224');
      // diagonal blazing rift
      P(g, 11, 3, '#ff7a2a'); P(g, 10, 4, '#ffb84a'); P(g, 9, 5, '#fff6c8');
      R(g, 7, 6, 3, 3, '#ff8a2a'); R(g, 8, 7, 2, 2, '#fffbe0');
      P(g, 6, 8, '#ffb84a'); P(g, 5, 9, '#ff6a1e'); P(g, 4, 10, '#c83a1e');
      // orbiting ember trail
      P(g, 12, 2, '#ffe27a'); P(g, 13, 4, '#ff8a2a'); P(g, 2, 11, '#ff8a2a'); P(g, 3, 13, '#ffe27a');
      return true;

    // 3. Hơi thở của rồng (Top-Tier Fire Core) — horned draconic claw clasping crimson heart
    case 'core_dragon':
      // swept golden horns
      P(g, 2, 2, '#ffe27a'); P(g, 3, 3, '#d89a3c'); P(g, 3, 4, '#9a5a1e');
      P(g, 13, 2, '#ffe27a'); P(g, 12, 3, '#d89a3c'); P(g, 12, 4, '#9a5a1e');
      // crimson scale cradle
      R(g, 4, 4, 8, 8, '#6e181e'); R(g, 3, 6, 10, 5, '#962428');
      // dragon eye / heart slit
      R(g, 5, 5, 6, 6, '#e04828'); R(g, 6, 6, 4, 4, '#ffb84a');
      R(g, 7, 5, 2, 6, '#fff8d0'); P(g, 8, 7, '#ffffff');
      // lower fang talons
      P(g, 4, 12, '#d89a3c'); P(g, 5, 13, '#ffe27a');
      P(g, 11, 12, '#d89a3c'); P(g, 10, 13, '#ffe27a');
      P(g, 7, 13, '#ff6a2a'); P(g, 8, 14, '#ffb84a');
      return true;

    // 4. Gươm Elsa (Rare Water/Frost Core) — six-pointed glacial star & frost blade-crest
    case 'core_elsa':
      // vertical & horizontal ice needles
      R(g, 7, 1, 2, 14, '#7fd8ff'); R(g, 2, 7, 12, 2, '#7fd8ff');
      // diagonal facets
      P(g, 4, 4, '#5c9fc5'); P(g, 5, 5, '#bff4ff'); P(g, 11, 4, '#5c9fc5'); P(g, 10, 5, '#bff4ff');
      P(g, 4, 11, '#5c9fc5'); P(g, 5, 10, '#bff4ff'); P(g, 11, 11, '#5c9fc5'); P(g, 10, 10, '#bff4ff');
      // central diamond prism
      R(g, 6, 5, 4, 6, '#3a8ad0'); R(g, 5, 6, 6, 4, '#9ee8ff');
      R(g, 7, 6, 2, 4, '#ffffff'); P(g, 6, 7, '#e8ffff'); P(g, 9, 8, '#e8ffff');
      return true;

    // 5. Hơi thở đất mẹ (Common Nature Core) — root-bound stone seed with emerald sprout
    case 'core_earthmother':
      // sprout leaves on top
      P(g, 6, 2, '#8fd45a'); P(g, 5, 3, '#6ab04a'); P(g, 9, 2, '#a8e870'); P(g, 10, 3, '#6ab04a');
      R(g, 7, 3, 2, 2, '#4a8a3a');
      // root cradle
      R(g, 4, 5, 8, 7, '#5a3e24'); R(g, 3, 7, 10, 4, '#7a5432');
      P(g, 3, 11, '#4a301a'); P(g, 12, 11, '#4a301a'); P(g, 6, 13, '#5a3e24'); P(g, 9, 13, '#5a3e24');
      // living emerald core
      R(g, 6, 6, 4, 5, '#2e7a3a'); R(g, 6, 7, 4, 3, '#7ae06a');
      P(g, 7, 7, '#e4ffd8'); P(g, 8, 8, '#b8f89a');
      return true;

    // 6. Mjolnir (Rare Nature/Storm Core) — runed storm hammer-sigil with arc forks
    case 'core_mjolnir':
      // hammer head
      R(g, 3, 3, 10, 5, '#4c667d'); R(g, 4, 3, 8, 1, '#9fc4e0');
      R(g, 4, 4, 8, 3, '#6889a8'); R(g, 3, 7, 10, 1, '#2d3f50');
      // glowing storm rune inside head
      R(g, 7, 4, 2, 3, '#bff4ff'); P(g, 6, 5, '#7fd8ff'); P(g, 9, 5, '#7fd8ff'); P(g, 7, 5, '#ffffff');
      // haft + pommel
      R(g, 7, 8, 2, 5, '#7a5232'); R(g, 6, 13, 4, 1, '#c8963c');
      // lightning forks left & right
      P(g, 2, 2, '#e8ffff'); P(g, 1, 4, '#7fd8ff'); P(g, 2, 6, '#e8ffff');
      P(g, 13, 2, '#e8ffff'); P(g, 14, 4, '#7fd8ff'); P(g, 13, 6, '#e8ffff');
      return true;

    // 7. Lõi quỷ (Rare Spirit Core) — horned void chalice with levitating violet eye
    case 'core_demon':
      // curved void horns
      P(g, 3, 1, '#c896ff'); P(g, 2, 2, '#8954ac'); P(g, 2, 3, '#593777'); P(g, 3, 4, '#593777');
      P(g, 12, 1, '#c896ff'); P(g, 13, 2, '#8954ac'); P(g, 13, 3, '#593777'); P(g, 12, 4, '#593777');
      // dark altar crescent
      R(g, 4, 9, 8, 3, '#3a224e'); R(g, 5, 12, 6, 2, '#241432');
      P(g, 3, 8, '#6e3f94'); P(g, 12, 8, '#6e3f94');
      // levitating spirit eye
      R(g, 5, 4, 6, 4, '#8954ac'); R(g, 6, 4, 4, 4, '#d89aff');
      R(g, 7, 5, 2, 2, '#fff2ff'); P(g, 7, 5, '#1a0a24'); // slit pupil
      return true;

    // 8. Four Elemental Cores (distinct from Creator Cores — compact rune-stones)
    case 'core_fire':
      R(g, 5, 3, 6, 10, '#8a2414'); R(g, 4, 5, 8, 6, '#d84820');
      R(g, 6, 5, 4, 5, '#ffb040'); R(g, 7, 6, 2, 3, '#fff6c8');
      P(g, 7, 2, '#ff8a3a'); P(g, 8, 1, '#ffe27a');
      return true;
    case 'core_earth':
      R(g, 4, 4, 8, 8, '#4e3822'); R(g, 5, 3, 6, 10, '#7a5a32');
      R(g, 6, 6, 4, 4, '#c8964a'); P(g, 7, 6, '#ffe2a0');
      P(g, 3, 9, '#6ab04a'); P(g, 12, 6, '#6ab04a');
      return true;
    case 'core_storm':
      R(g, 5, 3, 6, 10, '#2a3a7a'); R(g, 4, 5, 8, 6, '#4a6ad0');
      P(g, 8, 4, '#ffffff'); P(g, 7, 6, '#bff0ff'); P(g, 9, 7, '#ffffff'); P(g, 7, 9, '#bff0ff');
      return true;
    case 'core_frost':
      R(g, 5, 3, 6, 10, '#1e5a7a'); R(g, 4, 5, 8, 6, '#3a9ad0');
      R(g, 6, 6, 4, 4, '#bff4ff'); P(g, 7, 6, '#ffffff'); P(g, 8, 8, '#ffffff');
      return true;

    // 9. Rương ký gửi (Escrow Chest) — iron-banded purple reliquary with brass lockplate
    case 'escrow_chest':
      R(g, 2, 4, 12, 9, '#3d2654'); R(g, 2, 4, 12, 2, '#68428c');
      R(g, 2, 7, 12, 1, '#1a1026');                                          // lid seam
      R(g, 2, 4, 1, 9, '#9aa5b0'); R(g, 13, 4, 1, 9, '#9aa5b0');              // steel corner straps
      R(g, 6, 6, 4, 4, '#c8963c'); R(g, 7, 7, 2, 2, '#fff0b8');               // brass lockplate
      P(g, 4, 5, '#ffe27a'); P(g, 11, 5, '#ffe27a');
      return true;

    default:
      return false;
  }
}
