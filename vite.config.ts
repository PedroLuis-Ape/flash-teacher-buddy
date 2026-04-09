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
          // Only split React core — let Vite handle everything else automatically.
          // This prevents cross-chunk import races between react-vendor and ui libs.
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png'],
      devOptions: {
        enabled: false, // Never register SW in dev — avoid stale cache issues
      },
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
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Never cache API / Supabase calls
            urlPattern: /\/(api|rest|auth|functions)\/.*/i,
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
          },
          {
            // Images: NetworkFirst so new assets arrive, with offline fallback
            urlPattern: /\.(png|jpg|jpeg|webp|gif|svg)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 14 // 14 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 5,
            }
          }
        ]
      }
    })
  ].filter(Boolean),
}));
