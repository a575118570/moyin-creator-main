# 魔因漫创部署指南

## 项目结构

- **前端**: Electron 桌面应用（`moyin-creator-main`）
- **后端**: FastAPI 服务（`backend`，可选）

---

## 一、Electron 应用部署

### 1. 打包 Windows 安装包

```bash
cd moyin-creator-main
npm run build
```

打包完成后，安装包位于 `release/` 目录：
- `moyin-creator-0.1.7-setup.exe`（安装程序）

### 2. 发布到 GitHub Releases

1. **创建 Release**
   - 访问你的 GitHub 仓库
   - 点击 "Releases" → "Create a new release"
   - 填写版本号（如 `v0.1.7`）
   - 添加发布说明

2. **上传安装包**
   - 将 `release/moyin-creator-0.1.7-setup.exe` 上传到 Release
   - 用户可以直接下载安装

3. **自动发布（使用 GitHub Actions）**

   项目已配置 GitHub Actions，当你推送 tag 时会自动构建并发布：

   ```bash
   # 创建并推送 tag
   git tag v0.1.7
   git push origin v0.1.7
   ```

   GitHub Actions 会自动：
   - 构建 Windows 安装包
   - 创建 GitHub Release
   - 上传安装包

---

## 二、后端部署（可选）

如果你的应用需要后端服务，参考 `../backend/DEPLOY.md` 进行部署。

### 快速部署到 Render.com

1. 访问 https://render.com
2. 连接 GitHub 仓库
3. 选择 `backend` 目录
4. 使用 Docker 部署
5. 设置环境变量
6. 部署完成

详细步骤见 `../backend/DEPLOY.md`

---

## 三、Web 版本部署（可选）

如果你想将前端部署为 Web 应用（而非 Electron）：

### 1. 修改配置

需要修改 `electron.vite.config.ts`，移除 Electron 相关配置，改为纯 Web 构建。

### 2. 部署到静态托管

- **Vercel**: https://vercel.com
- **Netlify**: https://netlify.com
- **GitHub Pages**: 免费，但需要修改构建配置

---

## 四、完整部署流程

### 步骤 1: 准备代码

```bash
# 确保代码已提交到 GitHub
git add .
git commit -m "准备发布 v0.1.7"
git push
```

### 步骤 2: 打包 Electron 应用

```bash
cd moyin-creator-main
npm run build
```

### 步骤 3: 创建 GitHub Release

1. 在 GitHub 上创建 Release
2. 上传安装包
3. 或使用 GitHub Actions 自动发布

### 步骤 4: 部署后端（如需要）

参考 `../backend/DEPLOY.md`

---

## 五、用户安装

用户可以通过以下方式获取应用：

1. **GitHub Releases**
   - 访问 https://github.com/你的用户名/moyin-creator/releases
   - 下载最新版本的 `.exe` 安装包
   - 运行安装程序

2. **自动更新**（未来功能）
   - 可以在应用中集成自动更新功能
   - 使用 `electron-updater` 实现

---

## 六、常见问题

### Q: 打包失败？
A: 确保已安装所有依赖：`npm install`

### Q: 安装包太大？
A: 可以优化依赖，移除不必要的包，或使用 `asar` 压缩（已启用）

### Q: 如何更新应用？
A: 发布新版本到 GitHub Releases，用户下载新安装包覆盖安装

### Q: 需要后端吗？
A: 魔因漫创主要调用外部 API（如云雾API），后端是可选的

---

## 七、生产环境建议

1. **代码签名**
   - Windows 安装包建议进行代码签名
   - 避免用户看到"未知发布者"警告

2. **自动更新**
   - 集成 `electron-updater`
   - 实现应用内自动更新

3. **错误追踪**
   - 集成 Sentry 等错误追踪服务
   - 收集用户反馈

4. **性能监控**
   - 监控 API 调用成功率
   - 优化视频生成流程

---

## 技术支持

如有问题，请提交 Issue 到 GitHub 仓库。
