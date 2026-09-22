import { writeFileSync } from 'node:fs';
import { cssVariables } from '../dist/index.js';
writeFileSync(new URL('../dist/tokens.css', import.meta.url), cssVariables());
console.warn('tokens.css written');
