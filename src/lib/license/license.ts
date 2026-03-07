import nacl from 'tweetnacl';
import { LICENSE_PUBLIC_KEY_B64URL } from './public-key';

export type LicensePayload = {
  v: 1;
  app: '漫果AI';
  iat: number; // seconds
  exp: number; // seconds
  note?: string;
  name?: string;
};

export type LicenseStatus =
  | { valid: true; payload: LicensePayload; reason?: undefined }
  | { valid: false; payload?: LicensePayload; reason: string };

const LICENSE_PREFIX = 'MG1';

function toBase64Url(b64: string) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url: string) {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/')
    + '==='.slice((b64url.length + 3) % 4);
  return padded;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return toBase64Url(btoa(binary));
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = fromBase64Url(b64url);
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function utf8Bytes(s: string) {
  return new TextEncoder().encode(s);
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function verifyLicenseKey(licenseKey: string, nowSeconds = Math.floor(Date.now() / 1000)): LicenseStatus {
  const trimmed = (licenseKey || '').trim();
  if (!trimmed) return { valid: false, reason: '未输入开门密钥' };

  if (!LICENSE_PUBLIC_KEY_B64URL) {
    return { valid: false, reason: '未配置授权公钥（请先在开发者电脑运行 npm run license:keypair 并重新打包）' };
  }

  const parts = trimmed.split('.');
  if (parts.length !== 3) return { valid: false, reason: '密钥格式错误（应为 MG1.payload.signature）' };
  const [prefix, payloadB64, sigB64] = parts;
  if (prefix !== LICENSE_PREFIX) return { valid: false, reason: '密钥前缀不匹配' };

  const payloadBytes = base64UrlToBytes(payloadB64);
  const sigBytes = base64UrlToBytes(sigB64);
  const pubBytes = base64UrlToBytes(LICENSE_PUBLIC_KEY_B64URL);

  const ok = nacl.sign.detached.verify(payloadBytes, sigBytes, pubBytes);
  if (!ok) return { valid: false, reason: '密钥验签失败（可能被篡改/公钥不匹配）' };

  const payloadRaw = new TextDecoder().decode(payloadBytes);
  const payload = safeJsonParse<LicensePayload>(payloadRaw);
  if (!payload) return { valid: false, reason: '密钥内容解析失败' };

  if (payload.v !== 1) return { valid: false, payload, reason: '密钥版本不支持' };
  if (payload.app !== '漫果AI') return { valid: false, payload, reason: '密钥不属于本应用' };

  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    return { valid: false, payload, reason: '密钥缺少时间信息' };
  }
  if (nowSeconds < payload.iat - 60) {
    return { valid: false, payload, reason: '系统时间异常（早于密钥签发时间）' };
  }
  if (nowSeconds > payload.exp) {
    return { valid: false, payload, reason: '密钥已过期' };
  }

  return { valid: true, payload };
}

export function formatLicenseHint(payload?: LicensePayload) {
  if (!payload) return '';
  const exp = new Date(payload.exp * 1000).toLocaleString();
  const name = payload.name ? `授权给：${payload.name}` : '';
  const note = payload.note ? `备注：${payload.note}` : '';
  return [name, note, `到期时间：${exp}`].filter(Boolean).join(' / ');
}

export function normalizeLicenseKey(input: string) {
  // 允许用户粘贴带空格/换行的密钥
  return (input || '').trim().replace(/\s+/g, '');
}

// 给工具链用（浏览器侧不用）
export const __internal = {
  bytesToBase64Url,
  base64UrlToBytes,
  utf8Bytes,
};

