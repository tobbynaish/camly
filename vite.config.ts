import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
})
