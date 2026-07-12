import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// Auf GitHub Pages liegt die App unter /camly/ (Projektseite). Lokal (dev und
// preview) bleibt sie unter /, damit npm run dev unverändert startet.
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/camly/' : '/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'camly',
        short_name: 'camly',
        description: 'DXF zu GRBL-G-Code mit KI-Fräsparametern, für die Maslow und jede GRBL-CNC',
        theme_color: '#141413',
        background_color: '#FAF9F5',
        display: 'standalone',
      },
    }),
  ],
}))
