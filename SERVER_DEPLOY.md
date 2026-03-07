# 服务器镜像选择与部署指南

## 📋 项目需求分析

- **前端**: React + Vite 构建的静态网站（SPA）
- **后端**: FastAPI（Python）服务（可选）
- **部署方式**: 静态文件 + Nginx 或容器化部署

## 🎯 推荐的镜像选择

### 方案一：宝塔Linux面板 ⭐ 推荐

**适合场景**：
- 需要图形化管理界面
- 不熟悉 Linux 命令行
- 需要同时部署前端和后端
- 需要 SSL 证书管理

**优势**：
- ✅ 图形化界面，操作简单
- ✅ 内置 Nginx、MySQL、Python 等环境
- ✅ 一键配置 SSL 证书（Let's Encrypt）
- ✅ 支持文件管理、数据库管理等
- ✅ 适合新手和快速部署

**部署步骤**：
1. 选择"宝塔Linux面板"镜像
2. 安装完成后，通过面板访问地址登录
3. 在"网站"中添加站点，指向 `dist-web/` 目录
4. 配置 SSL 证书（HTTPS）
5. 如需后端，在"软件商店"安装 Python 项目管理器

---

### 方案二：1Panel

**适合场景**：
- 需要现代化管理界面
- 喜欢 Docker 容器化
- 需要多应用管理

**优势**：
- ✅ 现代化 UI 设计
- ✅ 基于 Docker，应用隔离
- ✅ 支持多种应用一键部署
- ✅ 资源占用相对较低

**部署步骤**：
1. 选择"1Panel"镜像
2. 登录管理面板
3. 使用"网站"功能部署静态站点
4. 或使用 Docker 部署

---

### 方案三：系统镜像 + 手动配置

**适合场景**：
- 熟悉 Linux 命令行
- 需要完全控制服务器
- 追求最小化资源占用

**推荐系统**：
- Ubuntu 22.04 LTS
- CentOS 7/8
- Debian 11

**部署步骤**：
1. 选择 Ubuntu/CentOS 系统镜像
2. SSH 连接服务器
3. 安装 Nginx：
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install nginx -y
   
   # CentOS
   sudo yum install nginx -y
   ```
4. 上传 `dist-web/` 文件到服务器
5. 配置 Nginx（见下方配置示例）
6. 安装 SSL 证书（使用 Certbot）

---

### 方案四：Docker 镜像

**适合场景**：
- 熟悉 Docker
- 需要容器化部署
- 需要多环境隔离

**优势**：
- ✅ 环境隔离，易于管理
- ✅ 可移植性强
- ✅ 支持 Docker Compose 编排

**部署步骤**：
1. 选择 Docker 镜像或系统镜像后安装 Docker
2. 创建 Dockerfile 和 docker-compose.yml
3. 使用 Docker 部署

---

## 🚀 详细部署配置

### 宝塔面板部署步骤

#### 1. 安装宝塔面板
- 选择"宝塔Linux面板"镜像后，系统会自动安装
- 记录面板访问地址和账号密码

#### 2. 上传前端文件
1. 在本地构建前端：
   ```bash
   cd moyin-creator-main
   npm install
   npm run build:web
   ```
2. 在宝塔面板"文件"中，上传 `dist-web/` 目录的所有文件
3. 建议上传到 `/www/wwwroot/your-domain.com/` 目录

#### 3. 创建网站
1. 点击"网站" → "添加站点"
2. 填写域名（或使用 IP 地址）
3. 根目录选择上传的文件目录
4. 选择"纯静态"或"PHP 纯静态"
5. 点击"提交"

#### 4. 配置 SSL 证书（重要！PWA 需要 HTTPS）
1. 在网站列表中，点击"设置"
2. 选择"SSL"标签
3. 选择"Let's Encrypt"免费证书
4. 填写邮箱，勾选域名
5. 点击"申请"，等待完成
6. 开启"强制 HTTPS"

#### 5. 配置 Nginx（SPA 路由支持）
1. 在网站设置中，点击"配置文件"
2. 在 `location /` 块中添加：
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```
3. 保存并重载 Nginx

#### 6. 部署后端（可选）
1. 在"软件商店"安装"Python 项目管理器"
2. 创建 Python 项目，选择 Python 3.11
3. 上传后端代码到项目目录
4. 安装依赖：`pip install -r requirements.txt`
5. 启动项目：`uvicorn main:app --host 0.0.0.0 --port 8000`
6. 在网站设置中添加反向代理，指向 `http://127.0.0.1:8000`

---

### Nginx 配置示例（手动部署）

创建配置文件 `/etc/nginx/sites-available/moyin-creator`：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP
    
    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL 证书配置（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # 网站根目录
    root /var/www/moyin-creator;
    index index.html;
    
    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Service Worker 和 Manifest 不缓存
    location ~* \.(sw\.js|manifest\.json)$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/moyin-creator /etc/nginx/sites-enabled/
sudo nginx -t  # 测试配置
sudo systemctl reload nginx  # 重载配置
```

---

## 📊 镜像对比表

| 镜像 | 难度 | 适用场景 | 推荐度 |
|------|------|----------|--------|
| **宝塔Linux面板** | ⭐ 简单 | 新手、快速部署、图形化管理 | ⭐⭐⭐⭐⭐ |
| **1Panel** | ⭐⭐ 中等 | 现代化界面、Docker 用户 | ⭐⭐⭐⭐ |
| **系统镜像** | ⭐⭐⭐ 较难 | 熟悉 Linux、完全控制 | ⭐⭐⭐ |
| **Docker** | ⭐⭐⭐ 较难 | 容器化、多应用管理 | ⭐⭐⭐⭐ |

---

## ✅ 最终推荐

**对于大多数用户，推荐选择：宝塔Linux面板**

**理由**：
1. ✅ 操作最简单，图形化界面
2. ✅ 内置所需环境（Nginx、Python 等）
3. ✅ 一键配置 SSL 证书（PWA 必需）
4. ✅ 文件管理、数据库管理等功能齐全
5. ✅ 适合快速部署和后续维护

**如果熟悉 Docker，可以选择：Docker 镜像**

---

## 🔧 部署后检查清单

- [ ] 前端文件已上传到服务器
- [ ] Nginx 配置正确，支持 SPA 路由
- [ ] SSL 证书已配置（HTTPS）
- [ ] Service Worker 可以正常注册
- [ ] 手机可以访问并安装 PWA
- [ ] 后端 API 已配置（如需要）
- [ ] 防火墙端口已开放（80, 443）

---

## 📝 注意事项

1. **HTTPS 必需**：PWA 功能需要 HTTPS，务必配置 SSL 证书
2. **SPA 路由**：确保 Nginx 配置了 `try_files` 支持前端路由
3. **Service Worker**：确保 `sw.js` 和 `manifest.json` 可以正常访问
4. **跨域问题**：如果前后端分离，需要配置 CORS
5. **资源限制**：注意服务器内存和 CPU 限制，避免超载
