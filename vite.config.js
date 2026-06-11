import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  build: {
    minify: true,
    target: 'esnext'
  },
  plugins: [react()],
  define: {
    'process.env': {}
  }
});
