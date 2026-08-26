import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 将字节值格式化为可读体积。
 *
 * @param {number} bytes 字节数。
 * @returns {string} 可读体积字符串。
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 递归收集目录内文件。
 *
 * @param {string} dir 目录路径。
 * @returns {{ path: string; size: number }[]} 文件信息列表。
 */
function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    const stat = statSync(fullPath);
    files.push({ path: fullPath.replace(/\\/g, '/'), size: stat.size });
  }
  return files;
}

const distDir = process.argv[2] ?? 'dist';
let files;

try {
  files = collectFiles(distDir)
    .filter((item) => item.path.endsWith('.js') || item.path.endsWith('.d.ts'))
    .sort((a, b) => b.size - a.size);
} catch {
  console.error('未找到 dist 目录，请先执行 `pnpm build`。');
  process.exit(1);
}

if (files.length === 0) {
  console.log('dist 中没有可分析的 .js 或 .d.ts 文件。');
  process.exit(0);
}

console.log('dist 体积报告（按文件大小降序）：');
for (const file of files) {
  console.log(`${formatBytes(file.size).padStart(10)}  ${file.path}`);
}
