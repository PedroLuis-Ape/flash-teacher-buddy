/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    // Production build settings - minify and no sourcemaps
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'production' ? false : true,
    rollupOptions: {
      output: {
        // Mangle/obfuscate variable names in production
        manualChunks: undefined,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png'],
      manifest: {
        name: 'APE – Apprentice Practice & Enhancement',
        short_name: 'APE',
        description: 'Aplicativo educacional de prática guiada de idiomas por Pedro Luis de Oliveira Silva.',
        theme_color: '#FFD700',
        background_color: '#4B0082',
        display: 'standalone',
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-maskable.png',
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            // Never cache API calls - always go to network
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
