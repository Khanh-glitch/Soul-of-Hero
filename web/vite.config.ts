import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0', allowedHosts: true,
  },
  plugins: [
    react(), tailwindcss(), viteSingleFile(),
    // serve the full 244-effect PixelFX pack (web/pixelfx-assets, rebuilt via the
    // documented Foundry intake command) so the FX Lab can lazy-load all pages
    {
      name: 'pixelfx-assets',
      configureServer(srv) {
        const root = path.resolve(__dirname, "pixelfx-assets");
        srv.middlewares.use('/pixelfx-assets', (req: any, res: any, next: any) => {
          try {
            const p = path.join(root, decodeURIComponent((req.url || '/').split('?')[0]));
            if (!p.startsWith(root) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.statusCode = 404; res.end('not found'); return; }
            const ext = path.extname(p);
            res.setHeader('content-type', ext === '.json' ? 'application/json' : 'image/png');
            fs.createReadStream(p).pipe(res);
          } catch { next(); }
        });
      },
    },
  ],
  build: {
    // embed the pilot PixelFX atlases into the single-file dist/index.html (mode A)
    assetsInlineLimit: 64 * 1024 * 1024,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
