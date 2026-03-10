// Cloudflare Pages Functions: Image proxy
// Route: /api/proxy-image?url=https%3A%2F%2Fexample.com%2Fa.png
//
// 用途：
// - 为 Web 端 storyboard/scene 切割提供“同源可读像素”的图片数据
// - 绕过第三方图床未开启 CORS 导致 canvas 被污染的问题

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;
  const url = new URL(request.url);

  // 允许预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const target = url.searchParams.get('url');
  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new Response(JSON.stringify({ error: 'Invalid URL protocol' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 拉取上游图片（不依赖浏览器 CORS）
  const upstream = await fetch(parsed.toString(), {
    // 某些图床会对 UA 进行策略判断
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 MoyinCreator/0.1',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    // Cloudflare 会自动做一定程度的缓存；我们也加上可缓存 header
    cf: {
      cacheTtl: 60 * 60 * 24,
      cacheEverything: true,
    } as any,
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `Failed to fetch image: ${upstream.status}`,
        upstreamStatus: upstream.status,
        upstreamBodyHead: text.slice(0, 200),
      }),
      {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const contentType = upstream.headers.get('content-type') || 'image/png';
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=86400');

  // HEAD 不返回 body
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  return new Response(upstream.body, { status: 200, headers });
};

