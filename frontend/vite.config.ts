// frontend/vite.config.ts (or .js)
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'


export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
      '@config': path.resolve(__dirname, './src/config'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  base: '/',                    // ensure assets resolve from the same origin
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    hmr: { clientPort: 3000 },  // avoid HMR trying another port
    proxy: {
      '/api/ai': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '/api')
      },
      '/api/data/lineage': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data\/lineage/, '/api/lineage')
      },
      '/catalog': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  preview: { port: 4173, strictPort: true },
  build: { outDir: 'dist', sourcemap: true },
})
