# 手机安装使用指南

## ✅ 已完成的配置

项目已经配置为支持 PWA（渐进式 Web 应用），可以在手机上安装使用。

## 📱 如何在手机上安装

### Android 手机（Chrome/Edge 浏览器）

1. **访问网站**
   - 在手机浏览器中打开部署后的网站地址

2. **添加到主屏幕**
   - Chrome: 点击右上角菜单（三个点）→ "添加到主屏幕" 或 "安装应用"
   - Edge: 点击菜单 → "应用" → "安装此站点为应用"
   - 或者浏览器会自动显示安装横幅，点击"安装"即可

3. **使用应用**
   - 安装后会在主屏幕显示应用图标
   - 点击图标即可像原生应用一样使用

### iPhone/iPad（Safari 浏览器）

1. **访问网站**
   - 在 Safari 浏览器中打开部署后的网站地址

2. **添加到主屏幕**
   - 点击底部分享按钮（方框+箭头图标）
   - 选择"添加到主屏幕"
   - 可以自定义应用名称
   - 点击"添加"

3. **使用应用**
   - 安装后会在主屏幕显示应用图标
   - 点击图标即可使用（会以全屏模式打开，没有浏览器地址栏）

## 🚀 部署步骤

### 1. 构建 Web 版本

```bash
cd moyin-creator-main
npm install
npm run build:web
```

构建产物在 `dist-web/` 目录。

### 2. 生成图标文件（如果还没有）

需要将 `build/icon.png` 调整为以下尺寸并放入 `public/` 目录：
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)

可以使用在线工具：https://www.pwabuilder.com/imageGenerator

### 3. 部署到服务器

将 `dist-web/` 目录的内容部署到：
- **Vercel**: 参考 `WEB_DEPLOY.md`
- **Netlify**: 参考 `WEB_DEPLOY.md`
- **自己的服务器**: 使用 Nginx/Apache 等 Web 服务器

### 4. 确保 HTTPS

⚠️ **重要**: PWA 功能需要 HTTPS 才能正常工作（localhost 除外）

- 如果使用 Vercel/Netlify，会自动提供 HTTPS
- 如果使用自己的服务器，需要配置 SSL 证书

## ✨ PWA 功能特性

- ✅ **离线支持**: Service Worker 会缓存资源，部分功能可离线使用
- ✅ **全屏体验**: 安装后可以全屏使用，没有浏览器地址栏
- ✅ **快速启动**: 像原生应用一样快速启动
- ✅ **自动更新**: 当有新版本时，会自动提示更新

## 🔧 技术说明

- **Manifest**: `public/manifest.json` - 定义应用元数据
- **Service Worker**: `public/sw.js` - 提供离线缓存功能
- **图标**: `public/icon-*.png` - 应用图标
- **移动端适配**: 已添加响应式布局和底部导航栏

## 📝 注意事项

1. **首次访问**: 需要网络连接才能加载应用
2. **数据存储**: 使用浏览器本地存储（IndexedDB/LocalStorage）
3. **文件操作**: 部分功能（如文件导出）在移动端可能有限制
4. **性能**: 复杂项目在低端手机上可能运行较慢

## 🐛 故障排除

### 无法安装？
- 确保网站使用 HTTPS（localhost 除外）
- 检查浏览器是否支持 PWA（Chrome/Edge/Safari 都支持）
- 清除浏览器缓存后重试

### 图标不显示？
- 确保 `public/icon-192.png` 和 `public/icon-512.png` 存在
- 检查 manifest.json 中的图标路径是否正确

### 离线功能不工作？
- 检查 Service Worker 是否已注册（浏览器开发者工具 → Application → Service Workers）
- 确保网站使用 HTTPS
