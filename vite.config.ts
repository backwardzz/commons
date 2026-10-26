import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — чтобы сборка открывалась и с GitHub Pages, и из любой подпапки
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5190 },
  test: { environment: 'node' },
} as never);
