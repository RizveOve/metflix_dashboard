import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'MetFlix Dashboard',
        short_name: 'MetFlix',
        description: 'Manage qBittorrent, WireGuard, and OMV servers',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true
      }
    }
  }
});
