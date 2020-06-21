#!/usr/bin/env node

import LatexApp from './latexApp';
import { Config, ProjectInfo, AppInfo, SyncMode, DecideSyncMode } from './types';

function main() {
  console.log('hello');
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
    projectId: 0
  }, () => Promise.resolve('upload'));
}

main();
