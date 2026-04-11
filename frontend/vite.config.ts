// @ts-nocheck
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
      }
    },
    build: {
      outDir: 'dist',
      minify: 'esbuild',
      chunkSizeWarningLimit: 1500,
    }
  };
});