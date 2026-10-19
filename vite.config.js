import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, les appels /api et /webhooks sont renvoyés vers le serveur (par défaut http://localhost:3000) :
// le navigateur croit parler à un seul site, les cookies de connexion fonctionnent sans réglage particulier.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.DEV_API_TARGET || 'http://localhost:3000';
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': { target, changeOrigin: false }, '/webhooks': { target, changeOrigin: false } } },
    preview: { port: 5173, proxy: { '/api': { target, changeOrigin: false } } },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 700 },
  };
});
