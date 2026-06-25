import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own long-cacheable chunks.
        // NOTE: recharts is intentionally NOT a manual chunk — that would make
        // Vite emit a <link rel="modulepreload"> for it on every page. It's only
        // used by the lazily-imported AnalyticsChart, so leaving it in the
        // dynamic graph keeps the ~384KB charts bundle off the home page.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
