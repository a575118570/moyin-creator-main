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
})

