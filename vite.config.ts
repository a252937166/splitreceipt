import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Hosts allowed to reach the dev and preview servers (Vite's Host-header check).
// A leading dot matches the domain and every subdomain. Nothing else is allowed.
const allowedHosts = ['localhost', '127.0.0.1', '.preview.studio.arc.io']

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/splitreceipt/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['react', 'react-dom'],
  },
  server: { host: '127.0.0.1', strictPort: true, cors: false, allowedHosts },
  preview: { host: '127.0.0.1', strictPort: true, cors: false, allowedHosts },
}))
