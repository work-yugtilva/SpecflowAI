import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

export const ROOT_ENV_PATH = path.join(repoRoot, '.env');
export const ROOT_ENV_LOCAL_PATH = path.join(repoRoot, '.env.local');

config({ path: ROOT_ENV_PATH, override: false });

if (fs.existsSync(ROOT_ENV_LOCAL_PATH)) {
  config({ path: ROOT_ENV_LOCAL_PATH, override: true });
}
