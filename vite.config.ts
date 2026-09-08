/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Repère de version affiché dans l'écran Joueurs, pour vérifier après un
// déploiement que l'iPad tourne bien sur le bon commit (voir CHANGELOG.md).
function getCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

// Déployé sur GitHub Pages sous /Family-game/. Corriger ici si le dépôt est renommé.
export default defineConfig({
  base: '/Family-game/',
  define: {
    __APP_COMMIT__: JSON.stringify(getCommitSha()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'safari15',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Enregistré à la main dans src/pwa.ts, pour pouvoir revérifier une mise
      // à jour au retour au premier plan (voir ce fichier pour le pourquoi).
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Jeux de famille',
        short_name: 'Jeux',
        description: 'Jeux de société pour jouer en famille, hors ligne.',
        start_url: '/Family-game/',
        scope: '/Family-game/',
        display: 'fullscreen',
        orientation: 'portrait',
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
