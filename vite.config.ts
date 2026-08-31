import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import packageJson from './package.json';

const getBasePath = () => {
  if (process.env.BASE_PATH !== undefined) {
    const bp = process.env.BASE_PATH.trim();
    if (!bp || bp === '/') return '/';
    const withLeading = bp.startsWith('/') ? bp : `/${bp}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  }
  if (process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1];
    return repo ? `/${repo}/` : '/';
  }
  return '/';
};

// https://vitejs.dev/config/
export default defineConfig({
  base: getBasePath(),
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || packageJson.version || '1.6.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icon.svg',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-192x192.png',
        'pwa-maskable-512x512.png',
        'assets/*.woff',
        'assets/*.woff2',
        'assets/fonts/*.woff2',
      ],
      manifest: {
        name: '像素記帳',
        short_name: '像素記帳',
        description: '一個像素風格的記帳應用程式',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3a3a3a',
        background_color: '#3a3a3a',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
