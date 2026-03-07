import path from 'node:path';
import nacl from 'tweetnacl';
import { base64UrlToBytes, bytesToBase64Url, readText, writeText } from './utils.mjs';

function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const root = process.cwd();
const licensesDir = path.join(root, 'licenses');
const privPath = path.join(licensesDir, 'private.key');

let secretKeyB64Url = '';
try {
  secretKeyB64Url = readText(privPath).trim();
} catch {
  console.error('❌ 未找到私钥：', privPath);
  console.error('请先运行：npm run license:keypair');
  process.exit(1);
}

const daysStr = getArg('days', '30');
const name = getArg('name', '');
const note = getArg('note', '');
const outFile = getArg('out', '');
const noFile = hasFlag('no-file');

const days = Math.max(1, Number(daysStr) || 30);
const now = Math.floor(Date.now() / 1000);
const exp = now + days * 24 * 60 * 60;

const payload = {
  v: 1,
  app: '漫果AI',
  iat: now,
  exp,
  ...(name ? { name } : {}),
  ...(note ? { note } : {}),
};

const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
const secretKey = base64UrlToBytes(secretKeyB64Url);

if (secretKey.length !== 64) {
  console.error('❌ 私钥长度不正确（应为 64 bytes 的 Ed25519 secretKey）');
  process.exit(1);
}

const sig = nacl.sign.detached(payloadBytes, secretKey);
const license = `MG1.${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(sig)}`;

console.log('✅ 开门密钥（复制发送给用户即可）：\n');
console.log(license);
console.log('\n说明：有效期', days, '天；到期时间：', new Date(exp * 1000).toLocaleString());

if (!noFile) {
  const defaultOut = path.join(licensesDir, `license-${now}.txt`);
  const target = outFile ? path.resolve(outFile) : defaultOut;
  writeText(target, license + '\n');
  console.log('\n已保存到文件：', target);
}

