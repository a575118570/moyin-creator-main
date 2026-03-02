# 部署/上传到 GitHub（含自动打包）

本项目已包含 GitHub Actions（见 `.github/workflows`），上传到 GitHub 后会自动在 Windows 上构建 Electron 安装包，并在打 tag 时发布 Release。

> 说明：如果你电脑没有命令行 `git`，也没关系，可以用 **GitHub Desktop** 或 GitHub 网页直接上传。

---

## 方式 A（推荐）：用 GitHub Desktop 上传（不需要命令行 git）

1. 安装并打开 **GitHub Desktop**
2. `File -> Add local repository...`
   - 如果提示“不是仓库”，选择 **Create a Repository**（从现有文件创建仓库）
3. 选择项目目录：
   - `G:\ai_qian\moyin-creator-main`
4. 点击 **Publish repository** 发布到你的 GitHub（选择仓库名、Public/Private）

发布完成后，进入 GitHub 仓库页面 -> `Actions`，你会看到 CI 在跑。

---

## 方式 B：用 GitHub 网页上传（适合首次快速上传）

1. 在 GitHub 新建一个仓库（例如：`moyin-creator-main`）
2. 进入仓库页面，点击 **Add file -> Upload files**
3. 把 `G:\ai_qian\moyin-creator-main` 下的文件拖进去上传
4. 提交（Commit changes）

> 注意：网页上传不适合大文件/频繁更新（尤其是 `node_modules/`），推荐优先用 GitHub Desktop。

---

## 自动构建与产物下载

上传到 GitHub 后：

- **每次 push** 会触发：`.github/workflows/ci.yml`
  - 产物在 `Actions -> 对应运行 -> Artifacts` 中下载（`release-windows`）
- **打 tag（以 v 开头）** 会触发：`.github/workflows/release.yml`
  - 例如 tag：`v0.1.8`
  - 会自动创建 GitHub Release，并尝试上传 `release/` 下的安装包文件

---

## 安全提醒（非常重要）

上传前请确认没有把真实的 API Key 写进仓库文件。建议使用占位符（例如 `YOUR_YUNWU_API_KEY_HERE`）并在运行时手动填入。

