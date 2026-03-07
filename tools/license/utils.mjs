import fs from 'node:fs';
import path from 'node:path';

export function toBase64Url(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(b64url) {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/')
    + '==='.slice((b64url.length + 3) % 4);
  return padded;
}

export function bytesToBase64Url(bytes) {
  return toBase64Url(Buffer.from(bytes).toString('base64'));
}

export function base64UrlToBytes(b64url) {
  return new Uint8Array(Buffer.from(fromBase64Url(b64url), 'base64'));
}

export function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

