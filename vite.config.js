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
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
    host: true,  // ← agregar esto para testear desde el celu
    // https: true,  // descomentar cuando necesites geo en celu real
  },
});