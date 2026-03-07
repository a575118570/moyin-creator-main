@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================
echo   漫果AI 开门密钥生成工具
echo ================================
echo.

:: 确保已安装依赖
if not exist "node_modules" (
  echo 检测到未安装依赖，正在执行 npm install ...
  npm install
  if errorlevel 1 (
    echo npm install 失败，请检查网络或 Node 环境。
    pause
    exit /b 1
  )
)

:: 确保已有密钥对
if not exist "licenses\private.key" (
  echo 尚未生成密钥对，正在自动生成...
  npm run license:keypair
  if errorlevel 1 (
    echo 生成密钥对失败，请在命令行手动执行：npm run license:keypair
    pause
    exit /b 1
  )
)

set /p DAYS=请输入有效天数(默认 30): 
if "%DAYS%"=="" set DAYS=30

set /p NAME=请输入授权对象名称(例如: 用户A): 
if "%NAME%"=="" set NAME=anonymous

set /p NOTE=请输入备注(可留空): 

echo.
echo 正在生成开门密钥...
echo.

call npm run license:issue -- --days %DAYS% --name "%NAME%" --note "%NOTE%"

echo.
echo 已生成开门密钥，已在上方命令行输出，并保存到 licenses\license-时间戳.txt
echo 可以直接复制该密钥发给用户使用。
echo.
pause

