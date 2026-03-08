import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 纯 Web 环境下使用的 Vite 配置（不引入 Electron 插件）
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@opencut/ai-core/services/prompt-compiler': path.resolve(
        __dirname,
        './src/packages/ai-core/services/prompt-compiler.ts',
      ),
      '@opencut/ai-core/api/task-poller': path.resolve(
        __dirname,
        './src/packages/ai-core/api/task-poller.ts',
      ),
      '@opencut/ai-core/protocol': path.resolve(
        __dirname,
        './src/packages/ai-core/protocol/index.ts',
      ),
      '@opencut/ai-core': path.resolve(__dirname, './src/packages/ai-core/index.ts'),
    },
  },
  plugins: [react()],
  build: {
    outDir: 'dist-web',
  },
  publicDir: 'public',
  server: {
    proxy: {
      // 代理火山方舟 API 请求，解决 CORS 问题
      '/api/volcano': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/volcano/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
})

