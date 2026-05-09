import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) {
            return 'charts-vendor'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor'
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-hot-toast')
          ) {
            return 'react-vendor'
          }
          if (
            id.includes('node_modules/styled-components') ||
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/date-fns')
          ) {
            return 'ui-vendor'
          }
        }
      }
    }
  }
}))
