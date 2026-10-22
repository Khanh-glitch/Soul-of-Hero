# LIVING ARSENAL — Generated asset prompt log

## Trạng thái

Phase hiện tại đã có Archer Hero Soul bitmap được tạo bằng image generation
text-only và đưa vào world pickup. Sprite nhân vật/arrow của GandalfHardcore
không được dùng làm reference vì license nguồn cấm AI training. Những nét vẽ
code-native còn lại không được ghi nhận là generated art.

Khi dùng image generation, mọi output phải được ghi tại đây trước khi đánh dấu production candidate và phải đi qua [ASSET_AUDIT.md](ASSET_AUDIT.md), license review, pixel cleanup và in-game readability test.

### GEN-20260716-001 — archer_hero_soul_icon

- Audit backlog: P0 — physical pickup + inventory identity.
- Purpose/runtime path:
  `res://assets/characters/archer/archer_hero_soul_icon_64.png`, reused by
  `archer_hero_soul_drop.tscn`.
- Tool/model/version: built-in `image_gen`; service model version was not
  exposed by the tool.
- Date/operator: 2026-07-16 / Codex imagegen skill.
- Rights to references: no input image or third-party visual reference was
  supplied; generation was text-only.
- Exact prompt:

  > Use case: stylized-concept
  > Asset type: square 2D game pickup and inventory icon
  > Primary request: create one single centered pixel-art Archer Hero Soul
  > Scene/backdrop: a perfectly flat solid chroma-key green #00FF00 background, edge-to-edge
  > Subject: one faceted pale-cyan soul crystal containing a simple, unmistakable golden bow-and-arrow sigil; a subtle violet core is visible inside the crystal; no character likeness
  > Style/medium: polished 16-bit fantasy pixel art, limited palette, crisp hard pixel edges, chunky intentional pixel clusters, nearest-neighbor feel, readable when reduced to 32-64 pixels, no antialiasing
  > Composition/framing: square canvas, icon centered, front-facing, generous even padding, floating object only, strong clean silhouette
  > Color palette: pale cyan crystal, golden-yellow bow-and-arrow sigil, restrained violet inner core; do not use green anywhere in the subject
  > Constraints: background must be one perfectly uniform #00FF00 color with no gradients, texture, lighting variation, floor plane, shadow, reflection, aura, particles, or glow spill; keep subject fully separated from background; no cast shadow or contact shadow; no text, letters, numbers, frame, border, UI panel, watermark, logo, extra objects, or scenery

- Raw output: `assets/characters/archer/generated/archer_hero_soul_icon_chroma.png`,
  1254×1254 RGB, SHA-256
  `36BC9540E35727509FB365C09DC710F5CAC7596D6311E68D6766E5B7C02C6D75`.
- Selected output: `assets/characters/archer/archer_hero_soul_icon_64.png`,
  64×64 RGBA, SHA-256
  `918ADCA7B8DDC99CCECD1460385AFBF2B73CABD68F5006AC607F551B9200740A`.
- Manual edit log: chroma removal with the bundled
  `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill`,
  then nearest-neighbor resize to 64×64. No repaint or third-party compositing.
- Alpha/readability validation: four corners alpha 0; content bounds
  `[16, 6, 48, 57]`; no visible key-green pixel; readable crystal/bow
  silhouette at runtime size.
- Acceptance result: production candidate, integrated; final in-game mobile
  readability remains part of manual presentation QA.

### GEN-20260716-002 — archer_boss_vfx_set

- Audit backlog: P0 — replace prototype-only boss telegraph/mark/phase visuals.
- Purpose/runtime paths:
  - `archer_boss_quick_vfx.png` — Quick Shot telegraph/projectile trail.
  - `archer_boss_pierce_vfx.png` — Armor Piercer and Soul Line trail.
  - `archer_boss_soul_mark_vfx.png` — hostile aim sigil and persistent player mark.
  - `archer_boss_phase_burst_vfx.png` — phase shift, poise break and death burst.
- Tool/model/version: built-in `image_gen`; service model version was not
  exposed by the tool.
- Date/operator: 2026-07-16 / Codex imagegen skill.
- Rights to references: text-only generation with no input image. No
  GandalfHardcore sprite, arrow or screenshot was supplied to the model.
- Exact prompt:

  > Use case: stylized-concept
  > Asset type: production 2D game VFX sprite atlas for a top-down action RPG
  > Primary request: Create one square 2x2 atlas containing exactly four independent Archer boss combat VFX elements, one centered and generously padded inside each equal quadrant.
  > Scene/backdrop: perfectly flat solid chroma-key green #00FF00 edge-to-edge across the entire atlas.
  > Subject and fixed quadrant map:
  > - TOP-LEFT: Quick Shot — one compact cyan arrow streak with a small sharp muzzle-flare burst, fast and readable.
  > - TOP-RIGHT: Armor Piercer — one longer violet-and-cyan arrow streak with a distinct sharp spearhead, heavier and more dangerous than Quick Shot.
  > - BOTTOM-LEFT: Soul Mark — one occult target sigil/rune made of violet, cyan, and restrained gold, circular and immediately readable as a hostile mark.
  > - BOTTOM-RIGHT: Phase Shift / Poise Break — one spectral crescent burst or broken energy ring in violet and cyan, forceful and radial.
  > Style/medium: polished 16-bit fantasy pixel art; crisp hard pixel edges; deliberately pixelated clusters; limited consistent palette; nearest-neighbor appearance; no antialiasing, blur, soft transparency, or painterly rendering.
  > Composition/framing: exact square 2x2 layout; each quadrant contains exactly one isolated effect; all four effects remain fully inside their own quadrant with wide empty green padding; no element crosses the horizontal or vertical center; no separators, borders, panels, labels, or grid lines.
  > Scale/readability: designed to remain readable in top-down gameplay at 32–96 pixels; strong silhouettes and restrained detail; the two projectile streaks point horizontally to the right.
  > Color palette: pale cyan, bright cyan, deep violet, restrained gold highlights, near-white energy cores; do not use #00FF00 in any effect.
  > Constraints: background must be one perfectly uniform #00FF00 color with no gradients, texture, glow spill, shadow, lighting variation, floor plane, or reflections. No character, person, archer likeness, bow, scenery, UI, text, frame, watermark, logo, numbers, or extra objects. Exactly four effects total, exactly one per quadrant.

- Raw output: `archer_boss_vfx_atlas_generated_raw.png`, 1254×1254,
  SHA-256 `975E7F6145AB4523953274699C9311CD470B9B98ADEC5AC339300BA18431DF7E`.
- Selected outputs and SHA-256:
  - Quick 128×64: `E3F9164D78BA887F68D80E1244E1595641A7423D8899DAC14C6346351CE2A3AB`.
  - Pierce 192×96: `757E1778DA0C8035BDD9210EFDF948BD66C3F21E520790DB75E3E392E87533A5`.
  - Mark 128×128: `28308DEC9AE84122C974A883443CF6E0F81F2A9350C69245627C6443BC8D1215`.
  - Phase 128×128: `17AE8D7969754D3F833806E5725747A70E3BFA9440690207350F8892DBC1F369`.
- Edit log: normalized the atlas background to exact `#00FF00`, removed it
  with the bundled chroma helper, split fixed quadrants, cropped/padded and
  resized with nearest-neighbor, then hardened alpha for crisp pixel edges.
- Validation: all outputs RGBA; all corner alpha values 0; zero green residue;
  non-empty centered bounds with padding; no partial-alpha pixels.
- Acceptance result: production candidate integrated as bow-local charge,
  target-bound Soul Mark and phase/poise/death presentation. Per product
  direction, KingdomArcher has no screen-wide line telegraph.

### GEN-20260716-003 — archer_boss_motion_vfx_set

- Audit backlog: P0 — remove baked projectile silhouettes from boss trails and
  give Soul Mark projectile / lateral escape their own readable identities.
- Purpose/runtime paths:
  - `archer_boss_quick_trail_vfx.png` — Quick Arrow trail only, 96×32.
  - `archer_boss_pierce_trail_vfx.png` — Armor Piercer trail only, 128×48.
  - `archer_boss_mark_projectile_vfx.png` — Soul Mark rune aura/trail, 128×64.
  - `archer_boss_dash_trail_vfx.png` — lateral dash/escape foot trail, 96×48.
- Tool/model/version: built-in `image_gen`; service model version was not
  exposed by the tool.
- Date/operator: 2026-07-16 / Codex imagegen skill.
- Rights to references: text-only generation with no input image. No
  GandalfHardcore sprite, arrow, screenshot, or other existing project asset
  was supplied to the model.
- Exact prompt:

  > Use case: stylized-concept
  > Asset type: production 2D game VFX sprite atlas for a top-down pixel-art action RPG
  > Primary request: Create one square 2x2 atlas containing exactly four independent Archer boss motion VFX elements, exactly one effect centered with generous padding inside each equal quadrant.
  > Scene/backdrop: perfectly flat solid chroma-key green #00FF00 edge-to-edge across the entire atlas.
  > Subject and fixed quadrant map:
  > - TOP-LEFT — Quick Arrow TRAIL ONLY: one compact, narrow pale-cyan speed streak tapering from left to right, with a tiny release sparkle at its left tail. It is energy left behind by a fast projectile. Absolutely no arrowhead, no arrow, no shaft, no weapon.
  > - TOP-RIGHT — Armor Piercer TRAIL ONLY: one longer, heavier violet-and-cyan piercing wake with a bright near-white center line and two short broken shock notches. It tapers cleanly to the right. Absolutely no arrowhead, no spearhead, no arrow, no shaft, no weapon.
  > - BOTTOM-LEFT — Soul Mark projectile aura/trail: one horizontal violet-and-cyan occult projectile wake, a small open circular rune halo around the center and short trailing rune fragments behind it; unmistakably magical and different from a normal arrow trail. No arrowhead, no arrow, no shaft, no weapon.
  > - BOTTOM-RIGHT — lateral dash / escape foot trail: one low horizontal cyan-violet afterimage sweep made from two offset crescent foot-skids and a few blocky fading motes, suggesting a fast sideways dodge. No arrowhead, no arrow, no shaft, no character, no feet, no weapon.
  > Style/medium: polished authentic 16-bit fantasy pixel-art VFX; crisp hard-edged pixel clusters; limited consistent palette; nearest-neighbor appearance; strong silhouettes; no painterly rendering, no smooth vector look, no blur, no photorealism.
  > Composition/framing: exact square 2x2 layout; all four effects point or flow horizontally to the right; exactly one isolated effect per quadrant; each remains fully inside its quadrant with wide empty green padding; no element crosses the horizontal or vertical center; no separators, panels, frames, borders, labels, grid lines, UI or text.
  > Scale/readability: each effect must remain readable after reduction to roughly 96–128 pixels wide; restrained detail and clear negative space.
  > Color palette: pale cyan, bright cyan, deep violet, restrained near-white highlights; do not use green anywhere inside any effect.
  > Constraints: background must be one perfectly uniform #00FF00 color with no gradient, texture, glow spill, shadow, lighting variation, floor plane or reflection. No text, letters, numbers, character, person, archer likeness, bow, scenery, UI, watermark, logo or extra objects. Exactly four effects total. Most important invariant: none of the four quadrants may contain an arrowhead, spearhead, arrow shaft, complete arrow, projectile body or weapon.

- Raw output: `archer_boss_motion_vfx_atlas_generated_raw.png`, 1254×1254
  RGB, SHA-256
  `2D4C21D9B253A252156A18D59029A84956021C76C38D0B2FB150C6BE505E2487`.
- Selected outputs and SHA-256:
  - Quick trail 96×32:
    `3A08E9A4A1B060015BD1D300D1775974F6C742347DED15C5433A11E92E3CDEE7`.
  - Pierce trail 128×48:
    `A03CAE7F130DC9FF46A23CCDD244566EFE914921A0682D0C9849C11517769A9C`.
  - Mark projectile 128×64:
    `F6D6B93B229BF660BF4A1FF68E95325C1EBD056D92F03E33C6F82641CCC06676`.
  - Dash trail 96×48:
    `9B04BE9F1C78CFDF14DF6A9334D6522A6E382345E936D60FDE3BD65CE232214F`.
- Edit log: sampled eight atlas-border pixels for the chroma key; applied a
  deterministic soft distance matte equivalent to thresholds 12/220, hardened
  alpha at 0.30, removed only green-dominant spill, split the four fixed
  quadrants, cropped opaque bounds, preserved aspect ratio, and resized with
  nearest-neighbor onto the exact transparent canvases. No repaint, reference
  compositing, or runtime code edit.
- Validation: all four selected files are RGBA with transparent corners, zero
  partial-alpha pixels, zero opaque exact-key-green pixels, non-empty padded
  bounds, and the requested exact dimensions. Visual review confirms no
  character, UI, text, discrete arrowhead, arrow shaft, or complete arrow.
- Acceptance result: production asset integrated. Quick/Pierce/Mark use these
  motion-only textures behind the separate physical arrow sprite; Escape uses
  the generated foot-skid trail.

## Style prefix canonical

```text
LIVING ARSENAL pixel art, 3/4 top-down perspective, not side-view platformer,
native 16 px environment grid, hero body 24–32 px on a fixed 48x48 or 64x64
transparent canvas, crisp 1 px outline, no anti-aliasing, no subpixel blur,
fixed foot anchor, short shadow directly beneath feet, upper-left key light,
cold desaturated crypt palette; Sword gold-white, Bow cyan, Axe orange-red;
readable mobile silhouette at 640x360; no text unless explicitly requested.
```

Không dùng prefix trên một cách mù quáng cho UI 9-patch/font/audio. Mỗi item phải lấy kích thước/deliverable từ backlog P0/P1/P2.

## Entry template

```markdown
### GEN-YYYYMMDD-001 — <asset_id>

- Audit backlog: P0-xx / P1-xx / P2-xx
- Purpose/runtime path:
- Tool/model/version:
- Date/operator:
- Rights to references:
- Exact prompt:
  > ...
- Negative constraints:
  > no isometric, no side-platform pose, no blurred pixels, no baked background...
- Reference files + ownership/license:
- Requested dimensions/alpha/frame grid:
- Raw outputs and hashes:
- Selected output:
- Manual edit log: crop, palette, pixel cleanup, frame/pivot alignment
- License/terms snapshot:
- In-game screenshots: 640x360, 16:9, 20:9
- Acceptance result: rejected / prototype / production candidate
- Reviewer and follow-up:
```

## Animation generation rules

- Không yêu cầu model tạo một spritesheet lớn rồi tự giả định cell; tạo pose/keyframe có kiểm soát, sau đó pixel artist cleanup và align.
- Frame canvas, foot anchor, socket và light direction không đổi giữa frame.
- Idle/run tối thiểu có N/E/S/W nếu mục tiêu là art coherent; E có thể flip W. Action directions theo scope của audit.
- Gameplay timing đến từ resource, không kéo dài action chỉ để khớp số frame đẹp.
- Collision/hitbox không bake vào PNG.

## UI generation rules

- Icon source 32×32 hoặc 48×48, padding nhất quán, silhouette khác nhau không chỉ đổi màu.
- Text tiếng Việt không được bake vào generated image; dùng font/layout trong Godot.
- Panel cần 9-patch border/padding được ghi rõ.
- Xuất transparent PNG và giữ source/layer nếu tool hỗ trợ.

## Reject conditions

- Perspective khiến nhân vật trông như platform game trên map top-down.
- Pixel density/outline/light direction không khớp reference scale.
- Alpha có matte, frame bị trim hoặc pivot nhảy.
- Weapon/telegraph chỉ phân biệt bằng màu.
- Output chứa logo/text lỗi, chi tiết quá nhỏ ở logical 640×360.
- Không lưu được prompt, tool/version, terms hoặc bằng chứng quyền reference.
