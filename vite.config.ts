/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Déployé sur GitHub Pages sous /family-game/. Corriger ici si le dépôt est renommé.
export default defineConfig({
  base: '/family-game/',
  build: {
    target: 'safari15',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Jeux de famille',
        short_name: 'Jeux',
        description: 'Jeux de société pour jouer en famille, hors ligne.',
        start_url: '/family-game/',
        scope: '/family-game/',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#1E3D34',
        theme_color: '#1E3D34',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Précache tout le bundle : l'app doit fonctionner sans réseau après une
        // seule visite. Pas de stratégie réseau, il n'y a pas de réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
