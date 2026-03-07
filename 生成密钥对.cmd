@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================
echo   漫果AI 授权密钥对生成工具
echo ================================
echo.

if not exist "node_modules" (
  echo 检测到未安装依赖，正在执行 npm install ...
  npm install
  if errorlevel 1 (
    echo npm install 失败，请检查网络或 Node 环境。
    pause
    exit /b 1
  )
)

echo 正在生成新的 Ed25519 密钥对...
echo 注意：旧的私钥仍然保留在 licenses\private.key（如已存在会被覆盖）。
echo.

call npm run license:keypair

echo.
echo 已生成新的密钥对：
echo - 公钥：licenses\public.key
echo - 私钥：licenses\private.key  (务必妥善保存，绝对不要发给用户)
echo.
pause

