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

  // 复制请求头（除了 host 和 CORS 相关头）
  const headers = new Headers()
  const corsHeaders = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-request-method', 'access-control-request-headers']
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase()
    // 排除 host 和 CORS 相关头（这些不应该转发到目标 API）
    if (lowerKey !== 'host' && !corsHeaders.includes(lowerKey)) {
      headers.set(key, value)
    }
  }

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
    // 调试：记录请求信息
    const authHeader = headers.get('Authorization')
    const allHeaders = {}
    for (const [key, value] of headers.entries()) {
      if (key.toLowerCase() === 'authorization') {
        allHeaders[key] = value.substring(0, 30) + '...' // 只显示前30个字符
      } else {
        allHeaders[key] = value
      }
    }
    console.log('[Worker] Forwarding request:', {
      method: request.method,
      targetUrl,
      hasAuth: !!authHeader,
      authPrefix: authHeader ? authHeader.substring(0, 30) + '...' : 'none',
      allHeaders: allHeaders,
    })
    
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
