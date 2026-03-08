/**
 * Cloudflare Worker 代理脚本
 * 用于解决火山方舟 API 的 CORS 问题
 * 
 * 部署步骤：
 * 1. 在 Cloudflare Dashboard 中创建新的 Worker
 * 2. 将以下代码复制到 Worker 编辑器中
 * 3. 设置路由：manguoai.top/api/volcano/*
 * 4. 保存并部署
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // 只处理 /api/volcano/* 路径
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/api/volcano/')) {
    return new Response('Not Found', { status: 404 })
  }

  // 构建目标 URL
  const targetPath = url.pathname.replace('/api/volcano', '')
  const targetUrl = `https://ark.cn-beijing.volces.com${targetPath}${url.search}`

  // 复制请求头（除了 host）
  const headers = new Headers()
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() !== 'host') {
      headers.set(key, value)
    }
  }

  // 添加 CORS 头
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  try {
    // 转发请求到目标 API
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().arrayBuffer() : null,
    })

    // 创建响应并添加 CORS 头
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
