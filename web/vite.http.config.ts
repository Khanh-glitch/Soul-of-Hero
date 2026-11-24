// Portable HTTP build (multi-file, no single-file inlining). Used for browser evidence under tight memory.
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { externalVfxPages } from "./scripts/vfx-assets-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [externalVfxPages(), react(), tailwindcss()],
  server: { host: "0.0.0.0", allowedHosts: true },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { assetsInlineLimit: 0, outDir: "dist-http", emptyOutDir: true },
});
