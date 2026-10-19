import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let commit = 'dev';
try {
  commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  }).trim();
} catch {
  // A development archive can be built without Git metadata.
}

const directory = new URL('../src/generated/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('build-info.ts', directory),
  `export const BUILD_INFO = ${JSON.stringify({ version: packageJson.version, commit })} as const;\n`);
