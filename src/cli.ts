#!/usr/bin/env node

import LatexApp from './latexApp';
import { Config, ProjectInfo, AppInfo, SyncMode, DecideSyncMode } from './types';

// TDOO
function main() {
  console.log('cli module is not currently supported');
  return;
  const args = process.argv.slice(2);
  const currentDir = process.cwd();
  const rootPath = currentDir;
  new LatexApp({
    outDir: '.workspace',
    rootPath,
    backend: 'cloudlatex',
    client: '',
    email: '',
    token: '',
    projectId: 0,
    endpoint: 'http://localhost:3000/api',
    autoBuild: true,
    storagePath: rootPath
  }, () => Promise.resolve('upload'));
}

main();
