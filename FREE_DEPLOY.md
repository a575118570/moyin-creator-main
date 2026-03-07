# 免费部署方案（无需服务器）

## 🎉 好消息：完全免费，无需购买服务器！

你可以使用以下免费服务部署，然后在手机上安装使用：

---

## 方案一：Vercel（推荐）⭐

### 优势
- ✅ **完全免费**，无需信用卡
- ✅ **自动 HTTPS**，PWA 功能完美支持
- ✅ **全球 CDN**，访问速度快
- ✅ **自动部署**，GitHub 推送自动更新
- ✅ **自定义域名**（可选）

### 部署步骤

#### 1. 准备 GitHub 仓库
```bash
# 如果还没有 GitHub 仓库，先创建
cd moyin-creator-main
git init
git add .
git commit -m "Initial commit"
# 在 GitHub 创建新仓库，然后：
git remote add origin https://github.com/你的用户名/moyin-creator.git
git push -u origin main
```

#### 2. 部署到 Vercel
1. **访问 Vercel**
   - 打开 https://vercel.com
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add New" → "Project"
   - 选择你的 GitHub 仓库
   - 如果仓库在子目录，设置：
     - **Root Directory**: `moyin-creator-main`

3. **配置构建**
   - **Framework Preset**: 选择 `Vite` 或 `Other`
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `dist-web`
   - **Install Command**: `npm install`（自动检测）

4. **部署**
   - 点击 "Deploy"
   - 等待 1-2 分钟，部署完成
   - 获得免费域名：`https://你的项目名.vercel.app`

5. **在手机上安装**
   - 用手机浏览器访问 `https://你的项目名.vercel.app`
   - 按照 `MOBILE_INSTALL.md` 中的步骤安装到主屏幕

---

## 方案二：Netlify

### 优势
- ✅ **完全免费**
- ✅ **自动 HTTPS**
- ✅ **拖拽部署**（最简单）
- ✅ **持续部署**（GitHub 集成）

### 部署步骤

#### 方法 A：拖拽部署（最简单）

1. **构建项目**
   ```bash
   cd moyin-creator-main
   npm install
   npm run build:web
   ```

2. **访问 Netlify**
   - 打开 https://www.netlify.com
   - 使用 GitHub/邮箱注册

3. **拖拽部署**
   - 在 Netlify 首页，找到 "Want to deploy a new site without connecting to Git?"
   - 直接将 `dist-web` 文件夹拖拽到页面
   - 等待部署完成
   - 获得免费域名：`https://随机名称.netlify.app`

#### 方法 B：GitHub 集成（推荐）

1. **连接 GitHub**
   - 在 Netlify 点击 "Add new site" → "Import an existing project"
   - 选择 "GitHub"，授权访问
   - 选择你的仓库

2. **配置构建**
   - **Base directory**: `moyin-creator-main`
   - **Build command**: `npm run build:web`
   - **Publish directory**: `moyin-creator-main/dist-web`

3. **部署**
   - 点击 "Deploy site"
   - 等待部署完成

4. **自定义域名（可选）**
   - 在站点设置中可以修改域名

---

## 方案三：GitHub Pages

### 优势
- ✅ **完全免费**
- ✅ **GitHub 集成**
- ✅ **自定义域名**支持

### 限制
- ⚠️ 需要配置 GitHub Actions 自动构建
- ⚠️ 域名格式：`https://用户名.github.io/仓库名`

### 部署步骤

1. **创建 GitHub Actions 工作流**

   在项目根目录创建 `.github/workflows/deploy.yml`：

   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'npm'
             cache-dependency-path: moyin-creator-main/package-lock.json
         
         - name: Install dependencies
           working-directory: ./moyin-creator-main
           run: npm ci
         
         - name: Build
           working-directory: ./moyin-creator-main
           run: npm run build:web
         
         - name: Deploy to GitHub Pages
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./moyin-creator-main/dist-web
   ```

2. **启用 GitHub Pages**
   - 在仓库设置中，找到 "Pages"
   - Source 选择 "GitHub Actions"
   - 保存

3. **访问**
   - 推送代码后，Actions 会自动构建部署
   - 访问：`https://你的用户名.github.io/仓库名`

---

## 方案四：Cloudflare Pages

### 优势
- ✅ **完全免费**
- ✅ **全球 CDN**，速度极快
- ✅ **无限带宽**
- ✅ **自动 HTTPS**

### 部署步骤

1. **访问 Cloudflare Pages**
   - 打开 https://pages.cloudflare.com
   - 使用 Cloudflare 账号登录（免费注册）

2. **连接 GitHub**
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 授权 GitHub 访问

3. **配置项目**
   - **Project name**: 自定义名称
   - **Production branch**: `main`
   - **Build command**: `npm run build:web`
   - **Build output directory**: `dist-web`
   - **Root directory**: `moyin-creator-main`

4. **部署**
   - 点击 "Save and Deploy"
   - 等待部署完成
   - 获得域名：`https://项目名.pages.dev`

---

## 📊 免费服务对比

| 服务 | 免费额度 | 自定义域名 | 自动部署 | 推荐度 |
|------|----------|------------|----------|--------|
| **Vercel** | 无限 | ✅ 支持 | ✅ 是 | ⭐⭐⭐⭐⭐ |
| **Netlify** | 100GB/月 | ✅ 支持 | ✅ 是 | ⭐⭐⭐⭐⭐ |
| **GitHub Pages** | 1GB/仓库 | ✅ 支持 | ✅ 是 | ⭐⭐⭐⭐ |
| **Cloudflare Pages** | 无限 | ✅ 支持 | ✅ 是 | ⭐⭐⭐⭐⭐ |

---

## 🚀 推荐流程（最快）

### 最快方案：Vercel（5 分钟部署）

1. **准备代码**（如果已有 GitHub 仓库，跳过）
   ```bash
   cd moyin-creator-main
   git init
   git add .
   git commit -m "Ready for deployment"
   # 在 GitHub 创建仓库并推送
   ```

2. **部署到 Vercel**
   - 访问 https://vercel.com
   - 登录 → 导入项目 → 选择仓库
   - 配置：
     - Root Directory: `moyin-creator-main`
     - Build Command: `npm run build:web`
     - Output Directory: `dist-web`
   - 点击 Deploy

3. **完成！**
   - 获得免费域名：`https://xxx.vercel.app`
   - 自动配置 HTTPS
   - 可以在手机上访问并安装

---

## 📱 手机安装步骤

部署完成后，在手机上：

### Android（Chrome）
1. 打开浏览器，访问你的网站地址
2. 浏览器会显示"安装应用"提示
3. 点击"安装"即可

### iPhone（Safari）
1. 打开 Safari，访问你的网站地址
2. 点击分享按钮（方框+箭头）
3. 选择"添加到主屏幕"
4. 点击"添加"

详细步骤见 `MOBILE_INSTALL.md`

---

## ✅ 总结

**不需要购买服务器！** 使用以上任一免费服务即可：

1. **最快**：Vercel（推荐）
2. **最简单**：Netlify 拖拽部署
3. **最灵活**：GitHub Pages（需要配置 Actions）

所有服务都提供：
- ✅ 免费 HTTPS（PWA 必需）
- ✅ 免费域名
- ✅ 自动部署
- ✅ 全球 CDN

选择任意一个，5-10 分钟即可完成部署，然后在手机上安装使用！
