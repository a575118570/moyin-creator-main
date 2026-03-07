## Web 版运行与部署指南

> 本指南针对纯浏览器 Web 版（不依赖本地 Electron 能力），适合部署到 Vercel / Netlify 等静态站点平台。

---

### 本地运行 Web 版

1. 安装依赖：

```bash
npm install
```

2. 启动 Web 开发服务器：

```bash
npm run dev:web
```

3. 在浏览器访问：

- `http://localhost:5173`

Electron 相关能力（`ipcRenderer`、`storageManager` 等）在 Web 下会自动降级 / 不显示相关设置，不影响基础创作功能。

---

### 构建 Web 版静态文件

```bash
npm run build:web
```

构建产物输出目录：

- `dist-web/`

将该目录部署为「单页应用（SPA）」即可。

---

### 部署到 Vercel

1. 打开 Vercel 控制台，新建项目（Import Git Repository）。
2. 选择包含 `moyin-creator-main` 的仓库。
3. 根目录选择 `moyin-creator-main`。
4. Build 命令：

```bash
npm run build:web
```

5. Output Directory：

```text
dist-web
```

6. Framework Preset：选择 `Vite` 或 `Other` 均可。

保存并部署后，即可通过 Vercel 分配的域名在线访问。

---

### 部署到 Netlify

1. 打开 Netlify，新建站点（Import from Git）。
2. 选择对应仓库，Root directory 选 `moyin-creator-main`。
3. Build command：

```bash
npm run build:web
```

4. Publish directory：

```text
dist-web
```

5. 部署完成后即可通过 Netlify 域名访问。

> 如需支持前端路由（未来如果添加多路由），请在 Vercel/Netlify 中开启「SPA 回退到 index.html」的重写规则。

