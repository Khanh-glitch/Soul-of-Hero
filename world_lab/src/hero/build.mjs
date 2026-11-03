// One command rebuilds the complete single-scene milestone:
//   exact SHA/rect/frame ledger -> tracked scene graph -> native 640x360 1x render.
import {buildLedger} from './kit.mjs';
import {buildSceneGraph} from './scene.mjs';
import {renderHero} from './render.mjs';
const l=buildLedger(), s=buildSceneGraph(), r=renderHero();
console.log('HERO_BUILD_OK',JSON.stringify({
  ledger_entries:l.summary.kit_entries,real_crops:l.summary.real_crop_entries,
  tileable_or_trim:l.summary.tileable_or_trim_entries,
  scene:s.id,objects:s.objects.length,rows:s.tile_map.rows.length,
  output:r.output,sha256:r.output_sha256,dimensions:r.dimensions,
  tile_placements:r.tile_placements,mosaic_placements:r.mosaic_placements,
  prop_placements:r.prop_placements,off_palette_pixels:r.off_palette_pixels,
}));
