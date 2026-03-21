import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_ENV_PATH = path.resolve(currentDir, '../../../.env');

config({ path: ROOT_ENV_PATH, override: false });
