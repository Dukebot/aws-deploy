import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import Deployer from '../src/index.mjs'

// Cargamos el .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadDotenv({ path: path.resolve(__dirname, '.env') });

const deployer = Deployer.fromEnv()
deployer.deploy()