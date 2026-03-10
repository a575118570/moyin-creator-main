// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Image Host Utilities
 * Upload images to external hosting services for video generation
 */

import { useAPIConfigStore, type ImageHostProvider } from '@/stores/api-config-store';
import { ApiKeyManager, parseApiKeys } from '@/lib/api-key-manager';

// ==================== Types ====================

export interface UploadResult {
  success: boolean;
  url?: string;
  deleteUrl?: string;
  error?: string;
}

export interface UploadOptions {
  name?: string;
  expiration?: number;
  providerId?: string; // Optional: force a specific provider
}

// ==================== Key Managers ====================

type ProviderKeyManagerEntry = {
  manager: ApiKeyManager;
  keyString: string;
};

const imageHostKeyManagers = new Map<string, ProviderKeyManagerEntry>();
let providerCursor = 0;

function getProviderKeyManager(provider: ImageHostProvider): ApiKeyManager {
  const existing = imageHostKeyManagers.get(provider.id);
  if (existing && existing.keyString === provider.apiKey) {
    return existing.manager;
  }
  const manager = new ApiKeyManager(provider.apiKey);
  imageHostKeyManagers.set(provider.id, { manager, keyString: provider.apiKey });
  return manager;
}

// ==================== Helpers ====================

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function resolveUploadUrl(provider: ImageHostProvider): string {
  const uploadPath = (provider.uploadPath || '').trim();
  if (uploadPath && isHttpUrl(uploadPath)) {
    return uploadPath;
  }
  const baseUrl = (provider.baseUrl || '').trim().replace(/\/*$/, '');
  if (!baseUrl && !uploadPath) return '';
  if (!baseUrl && uploadPath) return '';
  if (!uploadPath) return baseUrl;
  const normalizedPath = uploadPath.startsWith('/') ? uploadPath : `/${uploadPath}`;
  return `${baseUrl}${normalizedPath}`;
}

function getByPath(obj: any, path?: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

async function toBase64Data(imageData: string): Promise<string> {
  // If it's a URL, fetch and convert
  if (isHttpUrl(imageData)) {
    try {
      const response = await fetch(imageData, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const parts = dataUrl.split(',');
    return parts.length === 2 ? parts[1] : dataUrl;
    } catch (error) {
      console.error('[ImageHost] Failed to fetch image URL:', error);
      throw new Error('无法获取图片数据，请检查图片 URL 是否可访问');
    }
  }

  // Data URI -> strip prefix
  if (imageData.startsWith('data:')) {
    const parts = imageData.split(',');
    if (parts.length === 2) {
      // 检查是否是有效的 base64 数据
      const base64Data = parts[1];
      // imgbb 要求纯 base64 字符串，不包含 data:image/...;base64, 前缀
      return base64Data;
    }
    // 如果没有逗号分隔，可能是格式错误
    throw new Error('无效的 data URL 格式');
  }

  // Assume already base64
  // 验证 base64 格式（基本检查）
  if (imageData.length > 0 && /^[A-Za-z0-9+/=]+$/.test(imageData)) {
  return imageData;
  }
  
  throw new Error('无效的 base64 图片数据格式');
}

async function uploadWithProvider(
  provider: ImageHostProvider,
  apiKey: string,
  imageData: string,
  options?: UploadOptions
): Promise<UploadResult> {
  try {
    const uploadUrl = resolveUploadUrl(provider);
    if (!uploadUrl) {
      return { success: false, error: '图床上传地址未配置' };
    }

    const fieldName = provider.imageField || 'image';
    const nameField = provider.nameField || 'name';
    const useBinaryUpload = provider.binaryUpload === true;
    
    // 转换图片数据为 base64（后续可按需转换为二进制文件）
    let base64Data: string;
    try {
      base64Data = await toBase64Data(imageData);
      
      // 验证 base64 数据大小（imgbb 限制 32MB 原文件，base64 编码后约 43MB）
      const maxBase64Size = 43 * 1024 * 1024; // 43MB
      if (base64Data.length > maxBase64Size) {
        return { 
          success: false, 
          error: `图片太大：base64 编码后超过 ${Math.round(maxBase64Size / 1024 / 1024)}MB。imgbb 限制单张图片最大 32MB（原文件）。请压缩图片后重试。` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '图片数据格式错误' 
      };
    }

    const formData = new FormData();

    if (useBinaryUpload) {
      // 部分图床（例如 https://img.scdn.io/api_docs.php）要求 multipart 文件上传
      // 这里将 base64 还原成二进制并构造 Blob 作为文件字段
      try {
        const byteString = atob(base64Data);
        const len = byteString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = byteString.charCodeAt(i);
        }
        const mime = 'image/png'; // 大多数图床会自动探测，这里使用通用类型
        const blob = new Blob([bytes], { type: mime });
        const filename = (options?.name || 'upload') + '.png';
        formData.append(fieldName, blob, filename);
      } catch (e) {
        console.error('[ImageHost] Failed to build binary file from base64:', e);
        return {
          success: false,
          error: '无法将图片转换为文件进行上传，请重试或更换图床',
        };
      }
    } else {
      // imgbb 等：要求字段为纯 base64 字符串（不包含 data:image/... 前缀）
    formData.append(fieldName, base64Data);
    }
    
    if (options?.name) {
      formData.append(nameField, options.name);
    }

    const url = new URL(uploadUrl);
    if (provider.apiKeyParam) {
      url.searchParams.set(provider.apiKeyParam, apiKey);
    }
    
    // expiration 参数适配
    // - imgbb: 秒 (60-15552000)
    if (provider.expirationParam && options?.expiration) {
      const expirationSeconds = options.expiration;
      if (provider.platform === 'imgbb') {
        // imgbb expiration 参数验证：必须是正整数（秒），范围 60-15552000（1分钟到180天）
        if (expirationSeconds < 60 || expirationSeconds > 15552000) {
          console.warn(`[ImageHost] Invalid expiration value: ${expirationSeconds}, using default 60 seconds`);
          url.searchParams.set(provider.expirationParam, '60');
        } else {
          url.searchParams.set(provider.expirationParam, String(expirationSeconds));
        }
      } else {
        // 其他平台：默认按秒传
        url.searchParams.set(provider.expirationParam, String(Math.max(1, Math.floor(expirationSeconds))));
      }
    }

    const headers: Record<string, string> = {};
    if (provider.apiKeyHeader) {
      headers[provider.apiKeyHeader] = apiKey;
    }

    // 验证 API Key 格式（imgbb 需要 32 位十六进制字符串）
    if (provider.platform === 'imgbb') {
      const keyPattern = /^[0-9a-fA-F]{32}$/;
      if (!keyPattern.test(apiKey)) {
        return {
          success: false,
          error: `imgbb API Key 格式错误：必须是 32 位十六进制字符串。当前 Key 长度：${apiKey.length}，格式：${apiKey.substring(0, 8)}...。请前往 https://api.imgbb.com/ 获取正确的 API Key。`,
        };
      }
    }

    // 记录请求详情用于调试
    console.log('[ImageHost] Uploading to:', {
      provider: provider.name,
      platform: provider.platform,
      url: url.toString().replace(apiKey, '***'),
      fieldName,
      base64Length: base64Data.length,
      base64Preview: base64Data.substring(0, 50) + '...',
      hasName: !!options?.name,
      expiration: options?.expiration,
      apiKeyLength: apiKey.length,
      apiKeyFormat: provider.platform === 'imgbb' ? 'hex' : 'unknown',
    });

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: formData,
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      let message = data?.error?.message || data?.error?.error_message || data?.message || text || `上传失败: ${response.status}`;
      
      // 特殊处理：imgbb 400 错误的常见原因
      if (response.status === 400 && provider.platform === 'imgbb') {
        // imgbb 400 错误的常见原因：
        // 1. API key 无效或过期
        // 2. 图片数据格式错误（不是有效的 base64）
        // 3. 图片太大（超过 32MB）
        // 4. expiration 参数值无效
        // 5. 错误代码 103: "You have been forbidden to use this website" - 通常表示 API Key 被禁用或 IP 被限制
        
        const errorCode = data?.error?.code;
        
        // 错误代码 103: 被禁止使用
        if (errorCode === 103 || message.includes('forbidden') || message.includes('You have been forbidden')) {
          message = `imgbb API 访问被禁止（错误代码 103）。可能原因：1) API Key 无效或已过期；2) API Key 被禁用；3) IP 地址被限制；4) 请求频率过高。请检查 API Key 是否正确，或前往 https://api.imgbb.com/ 获取新的 API Key。`;
        } else if (message.includes('Invalid API') || message.includes('Invalid key') || message.includes('Invalid API key')) {
          message = `imgbb API Key 无效或已过期。请检查设置中的 API Key 是否正确，或前往 https://api.imgbb.com/ 获取新的 API Key。`;
        } else if (message.includes('image') && (message.includes('invalid') || message.includes('format'))) {
          message = `图片格式错误：imgbb 要求图片必须是有效的 base64 编码。请检查图片数据是否正确。`;
        } else if (message.includes('size') || message.includes('too large')) {
          message = `图片太大：imgbb 限制单张图片最大 32MB。请压缩图片后重试。`;
        } else if (message.includes('expiration')) {
          message = `过期时间参数错误：expiration 必须是正整数（秒）。当前值：${options?.expiration || '未设置'}`;
        } else {
          // 显示原始错误信息，帮助调试
          message = `imgbb 上传失败 (400，错误代码 ${errorCode || '未知'}）：${message}。常见原因：1) API Key 无效或被禁用；2) 图片格式错误；3) 图片太大；4) IP 地址被限制。`;
        }
      } else {
        // 其他图床的错误处理
      if (message.includes('Invalid API') || message.includes('Invalid key') || message.includes('Invalid API key')) {
          const isImgbbKey = provider.platform === 'imgbb';
        if (isImgbbKey && apiKey.startsWith('sk-')) {
          message = `图床API Key格式错误：imgbb需要32位十六进制字符串的API Key，而不是云雾API的Key（sk-开头）。请在设置中配置正确的imgbb API Key。`;
        } else {
          message = `图床API Key无效：${message}。请检查设置中的图床API Key是否正确。`;
        }
      }
      }
      
      // 记录详细错误信息用于调试
      console.error('[ImageHost] Upload failed:', {
        provider: provider.name,
        platform: provider.platform,
        status: response.status,
        error: message,
        errorCode: data?.error?.code,
        responseText: text?.substring(0, 500),
        apiKeyLength: apiKey?.length,
        apiKeyPreview: apiKey?.substring(0, 8) + '...',
        base64Length: base64Data?.length,
        requestUrl: url.toString().replace(apiKey, '***'),
      });
      
      return { success: false, error: message };
    }

    const urlField = getByPath(data, provider.responseUrlField || 'url');
    const deleteField = getByPath(data, provider.responseDeleteUrlField || 'delete_url');

    if (urlField) {
      return {
        success: true,
        url: typeof urlField === 'string' ? urlField : String(urlField),
        deleteUrl: deleteField ? (typeof deleteField === 'string' ? deleteField : String(deleteField)) : undefined,
      };
    }

    return { success: false, error: '上传成功但未返回 URL' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '上传失败' };
  }
}

function getRotatedProviders(providers: ImageHostProvider[]): ImageHostProvider[] {
  if (providers.length <= 1) return providers;
  const start = providerCursor % providers.length;
  providerCursor = (providerCursor + 1) % providers.length;
  return [...providers.slice(start), ...providers.slice(0, start)];
}

// ==================== Unified Upload API ====================

/**
 * Upload image to configured image host providers
 * Supports provider rotation + per-provider key rotation
 */
export async function uploadToImageHost(
  imageData: string,
  options?: UploadOptions
): Promise<UploadResult> {
  const store = useAPIConfigStore.getState();
  const targetProvider = options?.providerId
    ? store.getImageHostProviderById(options.providerId)
    : null;

  const providers = targetProvider
    ? (targetProvider.enabled ? [targetProvider] : [])
    : store.getEnabledImageHostProviders();

  if (!providers || providers.length === 0) {
    return { success: false, error: '图床未配置' };
  }

  const orderedProviders = getRotatedProviders(providers);
  let lastError = '上传失败';

  for (const provider of orderedProviders) {
    // 对于公共图床（如 img.scdn.io），允许“无 API Key”匿名上传
    if (provider.platform === 'img_scdn' && (!provider.apiKey || provider.apiKey.trim().length === 0)) {
      try {
        const result = await uploadWithProvider(provider, '', imageData, options);
        if (result.success) {
          return result;
        }
        lastError = result.error || '上传失败';
      } catch (error) {
        lastError = error instanceof Error ? error.message : '上传失败';
      }
      // 尝试下一个 provider
      continue;
    }

    const keys = parseApiKeys(provider.apiKey);
    if (keys.length === 0) {
      lastError = `图床 ${provider.name} 未配置 API Key（且不支持匿名上传）`;
      continue;
    }

    const keyManager = getProviderKeyManager(provider);
    const maxRetries = Math.min(3, keys.length);

    for (let i = 0; i < maxRetries; i++) {
      const apiKey = keyManager.getCurrentKey();
      if (!apiKey) {
        lastError = '所有 API Key 暂时不可用';
        break;
      }

      let result: UploadResult;
      try {
        result = await uploadWithProvider(provider, apiKey, imageData, options);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : '上传失败' };
      }
      if (result.success) {
        return result;
      }

      lastError = result.error || '上传失败';
      keyManager.markCurrentKeyFailed();
    }
  }

  return { success: false, error: lastError };
}

/**
 * Check if any image host is configured
 */
export function isImageHostConfigured(): boolean {
  return useAPIConfigStore.getState().isImageHostConfigured();
}
