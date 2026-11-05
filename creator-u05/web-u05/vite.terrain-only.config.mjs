// Standalone single-file build for the TERRAIN-ONLY game.
// No React / Tailwind / external assets: every module (including the 21
// WMP-04R1 base64 rasters) is inlined into one HTML file that runs from
// file:// with no server, no network and no new atlas.
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
    outDir: path.resolve(__dirname, 'terrain-only-dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    modulePreload: false,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      input: path.resolve(__dirname, 'terrain-only.html'),
      output: { inlineDynamicImports: true }
    }
  }
});
