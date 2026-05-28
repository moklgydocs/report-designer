import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api requests to backend server in development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Uncomment to rewrite /api prefix:
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
