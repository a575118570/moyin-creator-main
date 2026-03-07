import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.join(__dirname, '../build')

// 确保 build 目录存在
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

// 创建一个现代风格的水果图标 SVG
// 渐变背景 + 多种水果组合设计（苹果、橙子、葡萄等）
const svg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 背景渐变 -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B6B"/>
      <stop offset="50%" style="stop-color:#FF8E53"/>
      <stop offset="100%" style="stop-color:#FF6B9D"/>
    </linearGradient>
    <!-- 苹果渐变 -->
    <linearGradient id="apple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF4757"/>
      <stop offset="100%" style="stop-color:#EE5A6F"/>
    </linearGradient>
    <!-- 橙子渐变 -->
    <linearGradient id="orange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFA502"/>
      <stop offset="100%" style="stop-color:#FF6348"/>
    </linearGradient>
    <!-- 葡萄渐变 -->
    <radialGradient id="grape" cx="50%" cy="30%">
      <stop offset="0%" style="stop-color:#A55EEA"/>
      <stop offset="100%" style="stop-color:#8854D0"/>
    </radialGradient>
    <!-- 叶子渐变 -->
    <linearGradient id="leaf" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#26DE81"/>
      <stop offset="100%" style="stop-color:#20BF6B"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
    </filter>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- 圆角背景 -->
  <rect x="32" y="32" width="448" height="448" rx="90" fill="url(#bg)" filter="url(#shadow)"/>
  
  <!-- 装饰性光效 -->
  <ellipse cx="150" cy="150" rx="100" ry="70" fill="white" opacity="0.15"/>
  <ellipse cx="380" cy="380" rx="80" ry="60" fill="white" opacity="0.1"/>
  
  <!-- 主苹果（中心） -->
  <ellipse cx="256" cy="280" rx="100" ry="110" fill="url(#apple)" filter="url(#shadow)"/>
  <!-- 苹果高光 -->
  <ellipse cx="230" cy="250" rx="35" ry="45" fill="white" opacity="0.4"/>
  <!-- 苹果叶子 -->
  <path d="M 256 180 Q 240 160 250 150 Q 260 160 256 180" fill="url(#leaf)" filter="url(#shadow)"/>
  <path d="M 256 180 Q 270 160 280 150 Q 270 160 256 180" fill="url(#leaf)" filter="url(#shadow)"/>
  
  <!-- 左侧橙子 -->
  <circle cx="140" cy="320" r="65" fill="url(#orange)" filter="url(#shadow)"/>
  <!-- 橙子纹理 -->
  <circle cx="140" cy="320" r="50" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <circle cx="140" cy="320" r="40" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <!-- 橙子高光 -->
  <ellipse cx="125" cy="300" rx="20" ry="25" fill="white" opacity="0.3"/>
  
  <!-- 右侧葡萄串 -->
  <circle cx="370" cy="250" r="28" fill="url(#grape)" filter="url(#shadow)"/>
  <circle cx="390" cy="280" r="28" fill="url(#grape)" filter="url(#shadow)"/>
  <circle cx="350" cy="280" r="28" fill="url(#grape)" filter="url(#shadow)"/>
  <circle cx="370" cy="310" r="28" fill="url(#grape)" filter="url(#shadow)"/>
  <!-- 葡萄高光 -->
  <circle cx="365" cy="245" r="8" fill="white" opacity="0.5"/>
  <circle cx="385" cy="275" r="8" fill="white" opacity="0.5"/>
  <circle cx="345" cy="275" r="8" fill="white" opacity="0.5"/>
  <!-- 葡萄叶子 -->
  <path d="M 370 220 Q 350 200 360 190 Q 370 200 370 220" fill="url(#leaf)" filter="url(#shadow)"/>
  
  <!-- 小装饰水果（樱桃） -->
  <circle cx="180" cy="200" r="20" fill="#FF3838" filter="url(#shadow)"/>
  <circle cx="200" cy="195" r="20" fill="#FF3838" filter="url(#shadow)"/>
  <ellipse cx="190" cy="185" rx="8" ry="12" fill="url(#leaf)"/>
  
  <!-- 小装饰水果（草莓） -->
  <ellipse cx="320" cy="380" rx="22" ry="28" fill="#FF6B9D" filter="url(#shadow)"/>
  <ellipse cx="315" cy="360" rx="6" ry="8" fill="url(#leaf)"/>
  <ellipse cx="325" cy="358" rx="5" ry="7" fill="url(#leaf)"/>
  <circle cx="318" cy="375" r="2" fill="white" opacity="0.6"/>
  <circle cx="322" cy="385" r="2" fill="white" opacity="0.6"/>
  
  <!-- AI 标识（可选的小星星装饰） -->
  <circle cx="400" cy="150" r="6" fill="white" opacity="0.9" filter="url(#glow)"/>
  <circle cx="420" cy="140" r="4" fill="white" opacity="0.7"/>
  <circle cx="110" cy="400" r="5" fill="white" opacity="0.8"/>
</svg>
`

async function generateIcons() {
  console.log('🎨 生成图标中...')
  
  const pngPath = path.join(buildDir, 'icon.png')
  const icoPath = path.join(buildDir, 'icon.ico')
  
  // 生成 512x512 PNG
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .png()
    .toFile(pngPath)
  console.log('✅ 生成 icon.png (512x512)')
  
  // 生成多尺寸 PNG 用于 ICO
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    sizes.map(size => 
      sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toBuffer()
    )
  )
  
  // 转换为 ICO
  const icoBuffer = await pngToIco(pngBuffers)
  fs.writeFileSync(icoPath, icoBuffer)
  console.log('✅ 生成 icon.ico (多尺寸)')
  
  console.log(`\n📁 图标已保存到: ${buildDir}`)
}

generateIcons().catch(console.error)
