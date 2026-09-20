import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const useHttps = mode === 'https'

  return {
    base: './',
    plugins: [
      react(),
      useHttps && basicSsl()
    ].filter(Boolean),
    resolve: {
      dedupe: ['three']
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      https: useHttps
    }
  }
})
