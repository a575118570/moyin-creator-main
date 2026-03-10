import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import type { Plugin } from 'vite'

// 插件：禁用 Host 检查，允许所有主机访问
function disableHostCheck(): Plugin {
  return {
    name: 'disable-host-check',
    configureServer(server) {
      // 重写 Host 检查逻辑，允许所有主机
      server.middlewares.use((req, res, next) => {
        // 允许所有 Host 头
        next();
      });
    },
  };
}

// 插件：图片代理（解决分镜切割等场景下的跨域图片 CORS 问题）
// 前端统一请求 /api/proxy-image?url=xxx，由此中间件在服务端拉取远程图片并回传
function imageProxyPlugin(): Plugin {
  return {
    name: 'image-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy-image', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const targetUrl = urlObj.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }

          let parsed: URL;
          try {
            parsed = new URL(targetUrl);
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Invalid url' }));
            return;
          }

          if (!['http:', 'https:'].includes(parsed.protocol)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Invalid URL protocol' }));
            return;
          }

          const upstream = await fetch(parsed.toString(), {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MoyinCreator/0.1',
            },
          });

          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: `Failed to fetch image: ${upstream.status}` }));
            return;
          }

          const contentType = upstream.headers.get('content-type') || 'image/png';
          const arrayBuffer = await upstream.arrayBuffer();

          res.statusCode = 200;
          res.setHeader('Content-Type', contentType);
          // 允许前端在 canvas 中安全读取像素
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(Buffer.from(arrayBuffer));
        } catch (e: any) {
          console.error('[image-proxy] Error:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Failed to proxy image' }));
        }
      });
    },
  };
}


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
  plugins: [
    react(),
    disableHostCheck(), // 禁用 Host 检查，允许手机访问
    imageProxyPlugin(), // 图片代理，解决分镜切割 CORS 问题
  ],
  build: {
    outDir: 'dist-web',
  },
  publicDir: 'public',
  server: {
    host: '0.0.0.0', // 监听所有网络接口，允许手机访问
    port: 5173,
    strictPort: false, // 如果端口被占用，自动尝试下一个可用端口
    cors: true, // 启用 CORS
    // 允许所有主机访问（用于手机端测试）
    allowedHosts: true, // 允许所有主机，包括手机访问（Vite 5 类型为 true|string[]）
    hmr: {
      // 不设置 host，让客户端自动检测正确的地址
      // 客户端会根据当前页面的 host 自动连接
      clientPort: 5173, // HMR 客户端端口
    },
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

