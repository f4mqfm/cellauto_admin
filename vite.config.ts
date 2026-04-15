import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// npm run dev: /api → Laravel. Default: localhost. If Apache/nginx több vhosttal
// csak egy konkrét Host fejléccel szolgálja az API-t, állítsd:
//   ADMIN_API_PROXY_TARGET=http://www.cellauto.ro   (vagy ahol a /api/ping él)
const apiProxyTarget = process.env.ADMIN_API_PROXY_TARGET ?? 'http://localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // Csak ['admin.cellauto.ro'] blokkolhatott más Hosttal / proxyn keresztüli elérést.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
})

