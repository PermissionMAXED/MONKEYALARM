import { defineConfig } from 'vite';

// MONKEYALARM! client dev/build config.
// The multiplayer server runs separately (npm run server) on port 3010.
// During development the client proxies socket.io traffic to it.
export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3010',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});
