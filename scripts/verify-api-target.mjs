import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const target = process.argv[2];
const targets = {
  production: {
    expected: 'https://api.njambo.fr',
    forbidden: 'https://fapfap.betai.fr'
  },
  preproduction: {
    expected: 'https://fapfap.betai.fr',
    forbidden: 'https://api.njambo.fr'
  }
};

if (!targets[target]) {
  throw new Error('Usage: node scripts/verify-api-target.mjs <production|preproduction>');
}

const javascript = readdirSync('www')
  .filter(file => file.endsWith('.js'))
  .map(file => readFileSync(join('www', file), 'utf8'))
  .join('\n');
const { expected, forbidden } = targets[target];

if (!javascript.includes(expected)) {
  throw new Error(`Build ${target} invalide: API attendue absente (${expected})`);
}
if (javascript.includes(forbidden)) {
  throw new Error(`Build ${target} invalide: API interdite détectée (${forbidden})`);
}

console.log(`Build ${target} vérifié: ${expected}`);
