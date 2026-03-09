import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // During build (production), we bake in a unique placeholder string.
  // The Docker entrypoint (sed) will replace this placeholder with the actual
  // environment variable at container startup.
  // During dev, we use the actual env variable (if provided) or fallback to empty string (which uses the relative proxy).
  const apiBaseUrl = command === 'build' 
    ? '__VITE_API_BASE_URL_PLACEHOLDER__' 
    : JSON.stringify(env.VITE_API_BASE_URL || '');

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
        '/api': {
          target: 'http://api:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
