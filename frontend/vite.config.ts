import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to backend services during local development
    proxy: {
      '/api/auth': 'http://localhost:3001',
      '/api/loans': 'http://localhost:3001',
      '/api/credit': 'http://localhost:3002',
      '/api/risk': 'http://localhost:3003',
      '/api/decisions': 'http://localhost:3004',
      '/api/accounts': 'http://localhost:3005',
      '/api/notifications': 'http://localhost:3006',
    },
  },
});
