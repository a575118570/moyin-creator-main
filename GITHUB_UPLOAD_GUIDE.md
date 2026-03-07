# 上传到 GitHub 指南（无需安装 Git）

## 🚀 方法一：使用 GitHub 网页上传（最简单）

### 步骤 1：创建 GitHub 仓库

1. 访问 https://github.com
2. 登录你的账号（如果没有，先注册）
3. 点击右上角 "+" → "New repository"
4. 填写信息：
   - **Repository name**: `moyin-creator`（或自定义）
   - **Description**: `AI 驱动的动漫/短剧分镜创作工具`
   - **Visibility**: 选择 Public（公开）或 Private（私有）
   - **不要**勾选 "Initialize this repository with a README"
5. 点击 "Create repository"

### 步骤 2：上传文件

1. 在新建的仓库页面，你会看到 "uploading an existing file"
2. 点击 "uploading an existing file" 或 "Add file" → "Upload files"
3. **重要**：不要上传整个文件夹，需要选择文件上传
4. 将 `G:\ai_qian\moyin-creator-main` 下的以下文件和文件夹拖进去：

**需要上传的文件和文件夹：**
- ✅ `src/` 文件夹（整个文件夹）
- ✅ `public/` 文件夹
- ✅ `package.json`
- ✅ `package-lock.json`
- ✅ `vite.web.config.ts`
- ✅ `vite.config.ts`
- ✅ `tsconfig.json`
- ✅ `tsconfig.node.json`
- ✅ `postcss.config.js`
- ✅ `index.html`
- ✅ `README.md`
- ✅ `LICENSE`
- ✅ `.gitignore`
- ✅ `CLOUDFLARE_DEPLOY.md`
- ✅ `FREE_DEPLOY.md`
- ✅ 其他 `.md` 文档文件

**不要上传：**
- ❌ `node_modules/`（太大，GitHub 会自动忽略）
- ❌ `dist-web/`（构建产物，可以不上传）
- ❌ `out/`（构建产物）
- ❌ `release/`（构建产物）
- ❌ `licenses/`（包含密钥，已在 .gitignore 中）

5. 在页面底部填写：
   - **Commit message**: `Initial commit - Mobile web version`
6. 点击 "Commit changes"

### 步骤 3：验证上传

1. 刷新页面，你应该能看到所有文件
2. 检查 `package.json` 是否正确显示
3. 检查 `src/` 文件夹是否完整

---

## 🖥️ 方法二：安装 Git 后使用命令行（推荐长期使用）

### 步骤 1：安装 Git

1. 下载 Git for Windows：https://git-scm.com/download/win
2. 安装时选择默认选项
3. 安装完成后，重启命令行窗口

### 步骤 2：初始化仓库并上传

打开 PowerShell 或 CMD，执行：

```powershell
# 进入项目目录
cd G:\ai_qian\moyin-creator-main

# 初始化 git 仓库
git init

# 添加所有文件（.gitignore 会自动排除不需要的文件）
git add .

# 提交
git commit -m "Initial commit - Mobile web version"

# 添加远程仓库（替换为你的 GitHub 用户名和仓库名）
git remote add origin https://github.com/你的用户名/moyin-creator.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

**注意**：如果 GitHub 要求身份验证，你需要：
1. 使用 Personal Access Token（推荐）
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - 生成新 token，勾选 `repo` 权限
   - 使用 token 作为密码
2. 或使用 GitHub Desktop（见方法三）

---

## 🎨 方法三：使用 GitHub Desktop（最简单，推荐）

### 步骤 1：安装 GitHub Desktop

1. 下载：https://desktop.github.com/
2. 安装并登录你的 GitHub 账号

### 步骤 2：上传项目

1. 打开 GitHub Desktop
2. 点击 "File" → "Add local repository..."
3. 如果提示"不是仓库"，选择 **"Create a Repository"**
4. 选择项目目录：`G:\ai_qian\moyin-creator-main`
5. 填写信息：
   - **Name**: `moyin-creator`
   - **Description**: `AI 驱动的动漫/短剧分镜创作工具`
   - **Local path**: `G:\ai_qian\moyin-creator-main`
6. 点击 "Create a Repository"
7. 在左侧面板，你会看到所有更改的文件
8. 在底部填写：
   - **Summary**: `Initial commit - Mobile web version`
9. 点击 "Commit to main"
10. 点击 "Publish repository"
11. 选择：
    - **Name**: `moyin-creator`（或自定义）
    - **Description**: `AI 驱动的动漫/短剧分镜创作工具`
    - **Visibility**: Public 或 Private
12. 点击 "Publish repository"
13. 完成！

---

## ✅ 上传后做什么？

### 1. 部署到 Cloudflare Pages

上传到 GitHub 后，可以：
1. 访问 https://pages.cloudflare.com
2. 连接你的 GitHub 仓库
3. 配置自动部署
4. 每次 push 代码会自动部署

详细步骤见 `CLOUDFLARE_DEPLOY.md`

### 2. 验证上传

访问你的 GitHub 仓库：
- `https://github.com/你的用户名/moyin-creator`
- 检查所有文件是否正确上传
- 检查 `src/` 文件夹是否完整

---

## 📝 重要提示

### 不要上传的文件（已在 .gitignore 中）：
- ❌ `node_modules/` - 太大，可以通过 `npm install` 重新安装
- ❌ `dist-web/` - 构建产物，可以重新构建
- ❌ `out/` - 构建产物
- ❌ `release/` - 构建产物
- ❌ `licenses/*.txt` - 包含密钥信息
- ❌ `*.env` - 环境变量文件

### 需要上传的重要文件：
- ✅ `src/` - 源代码
- ✅ `public/` - 公共资源
- ✅ `package.json` - 依赖配置
- ✅ `vite.web.config.ts` - 构建配置
- ✅ `.gitignore` - Git 忽略规则

---

## 🆘 遇到问题？

### 问题 1：文件太大无法上传
- **解决**：确保 `node_modules/` 和 `dist-web/` 在 .gitignore 中
- GitHub 单个文件限制 100MB，仓库建议不超过 1GB

### 问题 2：上传失败
- **解决**：检查网络连接，或使用 GitHub Desktop

### 问题 3：需要更新代码
- **方法一**：在 GitHub 网页上直接编辑文件
- **方法二**：使用 GitHub Desktop 同步更改
- **方法三**：使用 Git 命令行 pull → 修改 → commit → push

---

## 🎉 完成！

上传完成后，你的代码就在 GitHub 上了，可以：
1. 部署到 Cloudflare Pages（自动部署）
2. 与他人协作
3. 版本控制
4. 备份代码

有任何问题，随时问我！
