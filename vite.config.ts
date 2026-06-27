/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    '__BUILD_TIMESTAMP__': JSON.stringify(Date.now().toString()),
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'production' ? false : true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: "../glossaryAiExport",
        replacement: path.resolve(__dirname, "./src/features/global-import/glossaryAiExportCore.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // VitePWA temporarily disabled to flush stale Service Worker caches
  ].filter(Boolean),
}));
