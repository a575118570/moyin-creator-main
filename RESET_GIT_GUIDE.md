# 删除并重建 Git 项目指南

## 🗑️ 方法一：在 Git 客户端中删除并重建（推荐）

### 如果你使用的是 GitHub Desktop：

1. **删除远程连接**
   - 打开 GitHub Desktop
   - 点击 "Repository" → "Repository settings..."
   - 在 "Remote" 部分，删除或清空远程 URL
   - 点击 "Save"

2. **删除本地 Git 历史**
   - 关闭 GitHub Desktop
   - 在文件管理器中，进入 `G:\ai_qian\moyin-creator-main`
   - 显示隐藏文件（查看 → 显示 → 隐藏的项目）
   - 删除 `.git` 文件夹（如果存在）

3. **重新初始化**
   - 重新打开 GitHub Desktop
   - 点击 "File" → "Add local repository..."
   - 选择 "Create a Repository"
   - 选择目录：`G:\ai_qian\moyin-creator-main`
   - 点击 "Create a Repository"

4. **重新发布到 GitHub**
   - 在 GitHub Desktop 中，点击 "Publish repository"
   - 选择是否公开
   - 点击 "Publish repository"

---

## 🔄 方法二：使用命令行删除并重建

### 步骤 1：删除 Git 历史

在 PowerShell 或 CMD 中执行：

```powershell
# 进入项目目录
cd G:\ai_qian\moyin-creator-main

# 删除 .git 文件夹（删除所有 Git 历史）
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
```

### 步骤 2：重新初始化

```powershell
# 初始化新的 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit - Mobile web version"
```

### 步骤 3：连接到新的 GitHub 仓库

```powershell
# 添加远程仓库（替换为你的新仓库地址）
git remote add origin https://github.com/你的用户名/moyin-creator.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 🆕 方法三：创建全新的 GitHub 仓库

### 步骤 1：在 GitHub 上创建新仓库

1. 访问 https://github.com
2. 点击 "+" → "New repository"
3. 填写信息：
   - **Repository name**: `moyin-creator`（或新名称）
   - **Description**: `AI 驱动的动漫/短剧分镜创作工具`
   - **Visibility**: Public 或 Private
   - **不要**勾选任何初始化选项
4. 点击 "Create repository"

### 步骤 2：删除本地 Git 并重新连接

```powershell
cd G:\ai_qian\moyin-creator-main

# 删除旧的 Git 历史
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue

# 重新初始化
git init
git add .
git commit -m "Initial commit - Fresh start"

# 连接到新仓库
git remote add origin https://github.com/你的用户名/新仓库名.git
git branch -M main
git push -u origin main
```

---

## 🧹 方法四：完全清理并重新开始（最彻底）

### 如果你想完全清理所有 Git 痕迹：

1. **删除 .git 文件夹**
   ```powershell
   cd G:\ai_qian\moyin-creator-main
   Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
   ```

2. **清理 Git 客户端缓存**
   - 在 GitHub Desktop 中，移除这个仓库
   - 关闭 GitHub Desktop

3. **重新开始**
   - 按照上面的方法重新初始化

---

## ⚠️ 注意事项

### 删除前请确认：

1. **备份重要数据**
   - 确保代码已经保存
   - 如果有未提交的重要更改，先备份

2. **检查远程仓库**
   - 如果远程仓库有重要内容，先备份
   - 或者创建新仓库而不是删除旧仓库

3. **清理构建产物（可选）**
   ```powershell
   # 删除构建产物（可选，可以重新构建）
   Remove-Item -Recurse -Force dist-web -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force out -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force release -ErrorAction SilentlyContinue
   ```

---

## ✅ 重建后的步骤

重建完成后，建议：

1. **验证文件**
   - 检查 `.gitignore` 是否正确
   - 确认重要文件都已添加

2. **首次提交**
   ```powershell
   git add .
   git commit -m "Initial commit - Mobile web version"
   git push -u origin main
   ```

3. **配置自动部署**
   - 连接到 Cloudflare Pages
   - 设置自动部署

---

## 🆘 常见问题

### Q: 删除 .git 后，我的代码会丢失吗？
**A:** 不会！`.git` 文件夹只包含版本历史，你的代码文件不会受影响。

### Q: 如何保留某些提交历史？
**A:** 使用 `git log` 查看历史，然后使用 `git cherry-pick` 选择性地保留某些提交。

### Q: 删除后如何恢复？
**A:** 如果只是删除了本地 `.git`，远程仓库（GitHub）上的代码还在，可以重新克隆。

---

## 🎯 推荐流程

**最简单的方法：**

1. 在 GitHub Desktop 中，右键点击仓库 → "Remove"
2. 删除 `G:\ai_qian\moyin-creator-main\.git` 文件夹（如果存在）
3. 在 GitHub Desktop 中，重新添加本地仓库
4. 发布到新的 GitHub 仓库

这样既保留了代码，又有了全新的 Git 历史！
