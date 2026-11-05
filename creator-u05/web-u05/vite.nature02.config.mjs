// Standalone single-file build for the NATURE-02 forest vertical slice.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: __dirname, base: './', plugins: [viteSingleFile()],
  build: {
    outDir: path.resolve(__dirname, 'nature02-dist'), emptyOutDir: true,
    cssCodeSplit: false, assetsInlineLimit: 100000000, modulePreload: false,
    target: 'es2020', minify: 'esbuild',
    rollupOptions: { input: path.resolve(__dirname, 'nature02.html'), output: { inlineDynamicImports: true } }
  }
});
