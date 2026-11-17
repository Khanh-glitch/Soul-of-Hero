import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { externalVfxPages } from "./scripts/vfx-assets-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  server: { host: '0.0.0.0', allowedHosts: true },
  plugins: [externalVfxPages(), react(), tailwindcss()],
  build: { assetsInlineLimit: 0 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
