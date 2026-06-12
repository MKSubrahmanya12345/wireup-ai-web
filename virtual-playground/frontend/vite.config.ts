// ??$$$ non-important
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ??$$$ newer code
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
})
