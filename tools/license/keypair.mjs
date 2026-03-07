import path from 'node:path';
import nacl from 'tweetnacl';
import { bytesToBase64Url, ensureDir, writeText } from './utils.mjs';

const root = process.cwd();
const licensesDir = path.join(root, 'licenses');
ensureDir(licensesDir);

const kp = nacl.sign.keyPair();
const publicKeyB64Url = bytesToBase64Url(kp.publicKey);
const secretKeyB64Url = bytesToBase64Url(kp.secretKey);

const pubPath = path.join(licensesDir, 'public.key');
const privPath = path.join(licensesDir, 'private.key');

writeText(pubPath, publicKeyB64Url + '\n');
writeText(privPath, secretKeyB64Url + '\n');

// 自动写入前端公钥文件，确保打包时内置正确公钥
const publicKeyTsPath = path.join(root, 'src', 'lib', 'license', 'public-key.ts');
writeText(
  publicKeyTsPath,
  [
    '// 授权公钥（Ed25519, 32 bytes）base64url 编码字符串',
    '// 由 `npm run license:keypair` 自动写入',
    '// 注意：请勿在仓库中保存私钥（licenses/private.key）',
    `export const LICENSE_PUBLIC_KEY_B64URL = '${publicKeyB64Url}';`,
    '',
  ].join('\n')
);

console.log('✅ 已生成密钥对');
console.log('- 公钥已写入:', pubPath);
console.log('- 私钥已写入:', privPath);
console.log('- 已同步公钥到:', publicKeyTsPath);
console.log('\n下一步：运行 `npm run license:issue -- --days 30 --name 张三` 生成开门密钥，然后重新打包。');

