import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(serverDirectory, '../..');
const outputDirectory = resolve(serverDirectory, '.assets');
if (
  !outputDirectory.startsWith(repositoryDirectory + sep) ||
  dirname(outputDirectory) !== serverDirectory
) {
  throw new Error('관리자 화면 빌드 경로를 확인해 주세요.');
}
rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory);
// 서버 코드와 로컬 설정을 배포하지 않도록 공개 화면 파일만 복사합니다.
for (const directory of ['admin', 'css', 'js', 'image', 'issuer', 'vendor']) {
  cpSync(resolve(repositoryDirectory, directory), resolve(outputDirectory, directory), {
    recursive: true,
  });
}
writeFileSync(
  resolve(outputDirectory, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow
/admin/*
  Cache-Control: no-store
  Content-Security-Policy: frame-ancestors 'none'
`,
);
console.log('관리자 정적 화면을 준비했습니다.');
