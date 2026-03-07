import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

// 读取 package.json
const packageJsonPath = path.join(rootDir, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

// 解析当前版本号
const currentVersion = packageJson.version
const versionParts = currentVersion.split('.').map(Number)

// 递增最后一位（patch version）
versionParts[2] = (versionParts[2] || 0) + 1

// 生成新版本号
const newVersion = versionParts.join('.')

// 更新 package.json
packageJson.version = newVersion
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8')

// 更新 electron/main.ts 中的版本号
const mainTsPath = path.join(rootDir, 'electron/main.ts')
let mainTsContent = fs.readFileSync(mainTsPath, 'utf-8')
mainTsContent = mainTsContent.replace(
  /版本\s+0\.\d+\.\d+/g,
  `版本 ${newVersion}`
)
fs.writeFileSync(mainTsPath, mainTsContent, 'utf-8')

// 更新 SettingsPanel.tsx 中的版本号
const settingsPanelPath = path.join(rootDir, 'src/components/panels/SettingsPanel.tsx')
let settingsPanelContent = fs.readFileSync(settingsPanelPath, 'utf-8')
settingsPanelContent = settingsPanelContent.replace(
  /v0\.\d+\.\d+/g,
  `v${newVersion}`
)
fs.writeFileSync(settingsPanelPath, settingsPanelContent, 'utf-8')

console.log(`✅ 版本号已更新: ${currentVersion} → ${newVersion}`)
console.log(`   - package.json`)
console.log(`   - electron/main.ts`)
console.log(`   - src/components/panels/SettingsPanel.tsx`)
