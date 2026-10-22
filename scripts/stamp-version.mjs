#!/usr/bin/env node
// Runs at deploy time (netlify.toml build command). Cloudflare sits in front of the site and
// tells browsers to keep dashboard.js for 4 hours, so after a deploy a normal reload kept the OLD
// script until a hard refresh. Putting the deploy's version in the script address makes every
// deploy a new address, so a normal reload fetches the new file. index.html itself is never cached.
import { readFileSync, writeFileSync } from 'node:fs';

const version = (process.env.COMMIT_REF || process.env.DEPLOY_ID || String(Date.now())).slice(0, 10);
const file = 'index.html';
const html = readFileSync(file, 'utf8');
const next = html.replace(/dashboard\.js(\?v=[\w.-]*)?"/, `dashboard.js?v=${version}"`);
if (next === html && !html.includes(`dashboard.js?v=${version}"`)) {
  console.error('[stamp-version] could not find the dashboard.js script tag in index.html');
  process.exit(1);
}
writeFileSync(file, next);
console.log(`[stamp-version] dashboard.js?v=${version}`);
