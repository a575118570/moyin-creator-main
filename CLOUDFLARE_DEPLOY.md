# Cloudflare Pages 部署指南（推荐 - 无限带宽）

## 🎉 为什么选择 Cloudflare Pages？

- ✅ **无限带宽**（完全免费）
- ✅ **500 构建/月**（比 Netlify 的 300 分钟更宽松）
- ✅ **全球 CDN**，访问速度快
- ✅ **自动 HTTPS**
- ✅ **自动部署**（GitHub 推送自动更新）
- ✅ **完全免费**，无需信用卡

---

## 🚀 快速部署步骤

### 方法一：连接 GitHub 仓库（推荐 - 自动部署）

#### 1. 确保代码已推送到 GitHub

如果还没有 GitHub 仓库，先创建：

```bash
cd G:\ai_qian\moyin-creator-main
git init
git add .
git commit -m "Initial commit"
# 在 GitHub 创建新仓库，然后：
git remote add origin https://github.com/你的用户名/moyin-creator.git
git push -u origin main
```

#### 2. 部署到 Cloudflare Pages

1. **访问 Cloudflare Pages**
   - 打开 https://pages.cloudflare.com
   - 使用 GitHub 账号登录（或注册 Cloudflare 账号）

2. **创建项目**
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 授权 Cloudflare 访问你的 GitHub 账号
   - 选择仓库：`moyin-creator` 或你的仓库名

3. **配置构建设置**
   - **Project name**: `moyin-creator`（或自定义）
   - **Production branch**: `main`（或 `master`）
   - **Framework preset**: `Vite`（或选择 `None`）
   - **Build command**: `npm run build:web`
   - **Build output directory**: `dist-web`
   - **Root directory**: `/`（留空，如果仓库在根目录）

4. **环境变量（如果需要）**
   - 点击 "Environment variables"
   - 添加必要的环境变量（如果有）

5. **部署**
   - 点击 "Save and Deploy"
   - 等待 2-3 分钟，构建完成
   - 获得免费域名：`https://moyin-creator.pages.dev`（或自定义名称）

#### 3. 自动部署设置

- ✅ 每次推送到 `main` 分支会自动触发部署
- ✅ 可以在 Cloudflare Pages 控制台查看部署历史
- ✅ 支持预览部署（Pull Request 会自动创建预览）

---

### 方法二：直接上传 dist-web 文件夹（最简单）

如果不想连接 GitHub，可以直接上传构建好的文件：

1. **构建项目**
   ```bash
   cd G:\ai_qian\moyin-creator-main
   npm install
   npm run build:web
   ```

2. **访问 Cloudflare Pages**
   - 打开 https://pages.cloudflare.com
   - 登录 Cloudflare 账号

3. **上传文件**
   - 点击 "Create a project"
   - 选择 "Upload assets"
   - 拖拽 `dist-web` 文件夹中的所有文件
   - 项目名称：`moyin-creator`
   - 点击 "Deploy site"

4. **完成**
   - 立即获得免费域名
   - 可以随时重新上传更新

---

## 📱 手机访问和安装

部署完成后：

1. **在手机上访问**
   - 打开浏览器，访问你的 Cloudflare Pages 域名
   - 例如：`https://moyin-creator.pages.dev`

2. **安装到主屏幕**
   - **Android（Chrome）**：
     - 浏览器会显示"安装应用"提示
     - 点击"安装"即可
   - **iPhone（Safari）**：
     - 点击分享按钮（方框+箭头）
     - 选择"添加到主屏幕"
     - 点击"添加"

详细步骤见 `MOBILE_INSTALL.md`

---

## 🔄 更新部署

### 如果使用 GitHub 连接：
```bash
cd G:\ai_qian\moyin-creator-main
# 修改代码后
git add .
git commit -m "Update"
git push
# Cloudflare Pages 会自动部署
```

### 如果使用直接上传：
1. 重新构建：`npm run build:web`
2. 在 Cloudflare Pages 控制台，点击 "Upload new version"
3. 拖拽新的 `dist-web` 文件夹内容

---

## ⚙️ 自定义域名（可选）

1. 在 Cloudflare Pages 项目设置中
2. 点击 "Custom domains"
3. 添加你的域名
4. 按照提示配置 DNS 记录

---

## 📊 与 Netlify 对比

| 特性 | Netlify | Cloudflare Pages |
|------|---------|------------------|
| 免费带宽 | 100GB/月 | **无限** ✅ |
| 免费构建 | 300 分钟/月 | **500 次/月** ✅ |
| 全球 CDN | ✅ | ✅ |
| 自动部署 | ✅ | ✅ |
| 自定义域名 | ✅ | ✅ |

**结论**：Cloudflare Pages 的免费额度更宽松，特别适合需要大量带宽的项目！

---

## ✅ 总结

**推荐使用 Cloudflare Pages**，因为：
1. 无限带宽（Netlify 只有 100GB/月）
2. 500 构建/月（Netlify 只有 300 分钟/月）
3. 完全免费
4. 部署简单
5. 性能优秀

**最快部署方式**：
1. 访问 https://pages.cloudflare.com
2. 登录（GitHub 或 Cloudflare 账号）
3. 连接 GitHub 仓库或直接上传 `dist-web` 文件夹
4. 配置构建命令：`npm run build:web`
5. 输出目录：`dist-web`
6. 点击部署，完成！

---

## 🆘 遇到问题？

- **构建失败**：检查构建命令和输出目录是否正确
- **页面空白**：确保 `dist-web` 文件夹中有 `index.html`
- **样式丢失**：检查 CSS 文件路径是否正确
- **需要帮助**：查看 Cloudflare Pages 文档：https://developers.cloudflare.com/pages/
