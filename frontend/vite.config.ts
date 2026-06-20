import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const apiBaseUrl = JSON.stringify(env.VITE_API_BASE_URL || '');

  const devTarget = env.VITE_DEV_TARGET || 'http://localhost:8080';

  return {
    plugins: [
      vue(),
      vuetify({ autoImport: true }),
    ],
    define: {
      'import.meta.env.VITE_API_BASE_URL': apiBaseUrl
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    server: {
      host: true, // Listen on all IP addresses (0.0.0.0)
      port: 3000,
      strictPort: true,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': { target: devTarget, changeOrigin: true },
        '/ws':  { target: devTarget, ws: true, changeOrigin: true }
      },
    },
  };
});
