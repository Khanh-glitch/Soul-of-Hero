// Standalone single-file build for the NATURE-01 five-biome pilot.
// Same verbatim terrain painter + 21 WMP-04R1 rasters as the untouched baseline,
// plus a separate toggleable decorative nature layer. No React / no external
// assets / no new atlas: runs from file:// with no server and no network.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: path.resolve(__dirname, 'nature01-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    modulePreload: false,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      input: path.resolve(__dirname, 'nature01.html'),
      output: { inlineDynamicImports: true }
    }
  }
});
