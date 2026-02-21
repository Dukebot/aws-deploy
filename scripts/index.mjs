import dotenv from 'dotenv';
import Deployer from '../src/index.mjs'

dotenv.config()
Deployer.fromEnv().deploy()