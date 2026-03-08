# Cloudflare Worker 代理设置指南

## 问题说明

在生产环境（`https://manguoai.top`）访问火山方舟 API 时遇到 CORS 错误，因为浏览器阻止了跨域请求。

## 解决方案

使用 Cloudflare Worker 作为代理服务器，转发 API 请求并添加 CORS 头。

## 部署步骤

### 方法 1：通过 Cloudflare Dashboard（推荐）

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com/
   - 选择你的域名（`manguoai.top`）

2. **创建 Worker**
   - 在左侧菜单找到 "Workers & Pages"
   - 点击 "Create application"
   - 选择 "Create Worker"
   - 给 Worker 命名（例如：`api-proxy`）

3. **配置 Worker 代码**
   - 将 `cloudflare-worker-proxy.js` 文件中的代码复制到 Worker 编辑器
   - 点击 "Save and deploy"

4. **设置路由**
   - 在 Worker 页面，点击 "Triggers"
   - 点击 "Add route"
   - 路由规则：`manguoai.top/api/volcano/*`
   - 选择你的 Worker（`api-proxy`）
   - 点击 "Add route"

5. **验证**
   - 访问 `https://manguoai.top/api/volcano/api/v3/models`（需要 Authorization 头）
   - 应该能正常返回数据，不再有 CORS 错误

### 方法 2：通过 Wrangler CLI

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **创建 Worker 项目**
   ```bash
   wrangler init api-proxy
   cd api-proxy
   ```

4. **配置 `wrangler.toml`**
   ```toml
   name = "api-proxy"
   main = "src/index.js"
   compatibility_date = "2024-01-01"

   [[routes]]
   pattern = "manguoai.top/api/volcano/*"
   zone_name = "manguoai.top"
   ```

5. **创建 `src/index.js`**
   - 将 `cloudflare-worker-proxy.js` 的内容复制到 `src/index.js`

6. **部署**
   ```bash
   wrangler deploy
   ```

## 测试

部署完成后，在浏览器控制台测试：

```javascript
fetch('/api/volcano/api/v3/models', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

## 注意事项

1. **免费额度**
   - Cloudflare Workers 免费版每天有 100,000 次请求
   - 对于大多数应用来说足够使用

2. **性能**
   - Worker 在全球边缘节点运行，延迟很低
   - 适合作为 API 代理

3. **安全性**
   - API Key 会通过 Worker 转发，确保使用 HTTPS
   - 可以考虑在 Worker 中添加额外的验证逻辑

4. **其他 API**
   - 如果需要代理其他 API，可以修改 Worker 代码
   - 或者创建多个 Worker 分别处理不同的 API

## 故障排查

如果仍然遇到 CORS 错误：

1. **检查路由配置**
   - 确认路由规则正确：`manguoai.top/api/volcano/*`
   - 确认 Worker 已部署并激活

2. **检查 Worker 日志**
   - 在 Cloudflare Dashboard 中查看 Worker 的日志
   - 查看是否有错误信息

3. **测试 Worker**
   - 直接访问 Worker URL（例如：`api-proxy.YOUR_SUBDOMAIN.workers.dev/api/volcano/api/v3/models`）
   - 确认 Worker 正常工作

4. **清除缓存**
   - 清除浏览器缓存
   - 硬刷新页面（Ctrl+Shift+R）

## 替代方案

如果不想使用 Cloudflare Worker，可以考虑：

1. **后端 API 服务器**
   - 部署一个简单的后端服务器（Node.js、Python 等）
   - 在后端处理 API 请求并添加 CORS 头

2. **修改 API 配置**
   - 如果可能，联系火山方舟支持，请求添加 CORS 头
   - 或者使用支持 CORS 的 API 端点
