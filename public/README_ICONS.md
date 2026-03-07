# PWA 图标生成说明

为了让手机可以安装应用，需要生成以下图标文件：

## 需要的图标尺寸

1. **icon-192.png** - 192x192 像素
2. **icon-512.png** - 512x512 像素

## 生成方法

### 方法 1: 使用在线工具
1. 访问 https://www.pwabuilder.com/imageGenerator
2. 上传 `build/icon.png` 文件
3. 下载生成的图标并重命名后放入 `public/` 目录

### 方法 2: 使用 ImageMagick (命令行)
```bash
# 安装 ImageMagick 后执行
magick build/icon.png -resize 192x192 public/icon-192.png
magick build/icon.png -resize 512x512 public/icon-512.png
```

### 方法 3: 使用在线图片编辑器
1. 打开 `build/icon.png`
2. 分别调整为 192x192 和 512x512 尺寸
3. 导出为 PNG 格式
4. 保存到 `public/` 目录

## 临时方案

如果暂时没有图标文件，应用仍然可以运行，但安装到手机时可能没有图标显示。
