/**
 * Compilación del panel del servidor (carpeta admin/ → dist/admin). Es una web aparte del juego:
 * el servidor público NO la sirve; solo la sirve el puerto local del panel (ver src/server/admin.ts).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'admin',
  base: './',
  plugins: [react()],
  build: { outDir: '../dist/admin', emptyOutDir: true },
  server: { port: 5174, proxy: { '/api': 'http://127.0.0.1:3010' } },
});
