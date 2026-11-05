// MAP-GEO-REJOIN-02 verification build.
// The SAME U=0.5 renderer / verbatim terrain painter / display / overview are
// reused. Only the `world` module is swapped for the CORRECTED projection
// overlay (src/mapgeo02/corrected-world.ts); that overlay re-exports the base
// world and overrides just u05Tile / u05TileRaw / terrainBlocked.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORRECTED = path.resolve(__dirname, 'src/mapgeo02/corrected-world.ts');

const correctedWorldAlias = {
  name: 'mapgeo02-corrected-world-alias',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!importer) return null;
    // The overlay itself MUST see the original base world, never itself.
    if (importer === CORRECTED || importer.includes('/src/mapgeo02/corrected-world')) return null;
    if (source !== './world' && source !== '../u05/world') return null;
    const eligible = importer.includes('/src/u05/')
      || importer.includes('/src/terrain-only/')
      || importer.includes('/src/mapgeo02/main.');
    return eligible ? CORRECTED : null;
  }
};

export default defineConfig({
  root: __dirname, base: './',
  plugins: [correctedWorldAlias, viteSingleFile()],
  build: {
    outDir: path.resolve(__dirname, 'mapgeo02-dist'), emptyOutDir: true,
    cssCodeSplit: false, assetsInlineLimit: 100000000, modulePreload: false,
    target: 'es2020', minify: 'esbuild',
    rollupOptions: {
      input: path.resolve(__dirname, 'mapgeo02.html'),
      output: { inlineDynamicImports: true }
    }
  }
});
