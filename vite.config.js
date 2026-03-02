import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ncaa-api': {
        target: 'https://ncaa-api.henrygd.me',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ncaa-api/, ''),
      }
    }
  }
})
