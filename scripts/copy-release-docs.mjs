import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 发布打包前把仓库根 `docs/` 复制到 `packages/main-ui/docs/`，
 * 使 `pnpm pack` 产物保持与 0.1.x 一致的「包内携带文档」形态。
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(repoRoot, 'docs');
const target = join(repoRoot, 'packages', 'main-ui', 'docs');

if (!existsSync(source)) {
  console.error('未找到根目录 docs/，无法复制发布文档。');
  process.exit(1);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, filter: (path) => !path.includes('mailbox') });
console.log('已把根目录 docs/ 复制到 packages/main-ui/docs/（排除 mailbox 治理目录）。');
