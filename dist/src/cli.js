#!/usr/bin/env node
"use strict";
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
const latexApp_1 = require("./latexApp");
// TDOO
function main() {
    console.log('cli module is not currently supported');
    return;
    const args = process.argv.slice(2);
    const currentDir = process.cwd();
    const rootPath = currentDir;
    latexApp_1.LatexApp.createApp({
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
//# sourceMappingURL=cli.js.map