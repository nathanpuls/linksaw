import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  publicDir: resolve(__dirname, "../web/app"),
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8799", changeOrigin: true, rewrite: path => path.slice(4) } },
  },
  build: { outDir: resolve(__dirname, "dist"), emptyOutDir: true, sourcemap: true },
});
