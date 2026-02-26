import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Mico VRM Agent 代理
      '/v1/responses': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true
      },
      // GPT-SoVITS TTS 代理 - api_v2.py 端点是 /tts
      '/tts': {
        target: 'http://127.0.0.1:9880',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js?t=[hash]',
        chunkFileNames: 'assets/[name].js?t=[hash]',
        assetFileNames: 'assets/[name].[ext]?t=[hash]'
      }
    }
  }
});
