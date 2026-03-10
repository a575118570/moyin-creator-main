// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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
