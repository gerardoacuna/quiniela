import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function readFixture(name: string): string {
  return readFileSync(join(HERE, '..', 'fixtures', 'pcs', name), 'utf8');
}
