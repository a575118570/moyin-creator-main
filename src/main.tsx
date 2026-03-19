// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Platform tag for CSS scoping (Electron vs Web/Mobile)
// We intentionally keep this lightweight and side-effect free.
const isElectron =
  typeof window !== 'undefined' &&
  (!!(window as any).electronAPI || !!(window as any).ipcRenderer)

if (isElectron) {
  document.documentElement.classList.add('platform-electron')
  document.body.classList.add('platform-electron')
}

// Dev-only: show runtime errors directly on screen (helps debug mobile blank screen without remote devtools)
const isDev = import.meta.env.DEV
const isMobileUA =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
const urlHasDebug =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debug')

if (isDev && !isElectron && (isMobileUA || urlHasDebug)) {
  const el = document.createElement('pre')
  el.id = '__dev_error_overlay__'
  el.style.position = 'fixed'
  el.style.left = '8px'
  el.style.right = '8px'
  el.style.bottom = '8px'
  el.style.maxHeight = '45vh'
  el.style.overflow = 'auto'
  el.style.zIndex = '999999'
  el.style.padding = '10px'
  el.style.borderRadius = '10px'
  el.style.background = 'rgba(0,0,0,0.85)'
  el.style.color = '#fff'
  el.style.fontSize = '12px'
  el.style.lineHeight = '1.35'
  el.style.whiteSpace = 'pre-wrap'
  el.style.wordBreak = 'break-word'
  // Default hidden: only show when an error is captured (so it won't annoy during normal usage)
  el.style.display = 'none'
  el.textContent = ''

  const ensureMounted = () => {
    // Vite module scripts may execute before <body> is available in some environments.
    if (!document.body) return
    if (!document.getElementById(el.id)) document.body.appendChild(el)
  }
  ensureMounted()
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', ensureMounted, { once: true })
  }

  const append = (title: string, msg: string) => {
    // Mount & show on first error
    ensureMounted()
    if (el.style.display === 'none') {
      el.style.display = 'block'
      el.textContent =
        '[dev] 捕获到运行时错误（可在地址加 ?debug=1 强制开启调试）。\n'
    }
    const time = new Date().toISOString().slice(11, 19)
    el.textContent += `\n[${time}] ${title}\n${msg}\n`
  }

  window.addEventListener('error', (e) => {
    const msg = e.error?.stack || e.message || String(e.error || e)
    append('window.error', msg)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r: any = (e as any).reason
    const msg = r?.stack || (typeof r === 'string' ? r : JSON.stringify(r, null, 2))
    append('unhandledrejection', msg || String(r))
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
if (window.ipcRenderer) {
window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log('[Renderer] Main process message:', message)
})
}

// Register Service Worker for PWA（仅在正式环境启用，避免开发环境下频繁自动刷新）
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.ipcRenderer) {
  window.addEventListener('load', () => {
    // 关键：避免浏览器缓存 sw.js，导致旧 SW 持续拦截请求
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        console.log('[SW] Service Worker registered:', registration.scope);
        // 不要在每次启动时强制 update()，手机端可能出现“频繁刷新/闪屏”的体验问题
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error);
      });
  });
}
