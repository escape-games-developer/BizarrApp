import { defineConfig } from "vite";
import react            from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target:    "es2020",
    outDir:    "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separar vendor chunk para mejor cache
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    // HTTPS requerido para geolocalización en dispositivos reales
    // https: true,
  },
});
