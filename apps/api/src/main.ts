import 'reflect-metadata';

import { startApp } from './bootstrap';
import { loadEnv } from './config/env';

startApp(loadEnv()).catch((e) => {
  console.error(e);
  process.exit(1);
});
