import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const testFiles = [
  ...globSync('src/**/*.test.ts'),
  ...globSync('scripts/**/*.test.ts'),
].sort();
if (testFiles.length === 0) {
  console.error('No test files found under src/**/*.test.ts or scripts/**/*.test.ts');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', '--test', ...testFiles],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
