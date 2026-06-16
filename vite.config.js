import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'بيوتي تيك',
        short_name: 'بيوتي تيك',
        description: 'منصة صالونات التجميل الأولى في المملكة',
        theme_color: '#A8705A',
        background_color: '#FAF7F2',
        display: 'standalone',
        start_url: '/',
        lang: 'ar',
        dir: 'rtl',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})