#!/usr/bin/env node

/* eslint-disable */

import { LatexApp } from './latexApp';
import { Config, ProjectInfo, AppInfo, ConflictSolution } from './types';

// TDOO
function main() {
  console.log('cli module is not currently supported');
  return;
  const args = process.argv.slice(2);
  const currentDir = process.cwd();
  const rootPath = currentDir;
  LatexApp.createApp({
    outDir: '.workspace',
    rootPath,
    backend: 'cloudlatex',
    projectId: 0,
    endpoint: 'http://localhost:3000/api',
    storagePath: rootPath
  }).then(latexApp => {

  });

}

main();
