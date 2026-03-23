import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'
import { barrel } from 'vite-plugin-barrel'
import lucidePreprocess from 'vite-plugin-lucide-preprocess'

export default defineConfig({
  plugins: [lucidePreprocess(), solid(), tailwindcss(), barrel({ packages: ['lucide-solid'] }),],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/documentation': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
