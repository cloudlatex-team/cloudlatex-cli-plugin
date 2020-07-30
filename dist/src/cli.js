#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const latexApp_1 = require("./latexApp");
// TDOO
function main() {
    console.log('cli module is not currently supported');
    return;
    const args = process.argv.slice(2);
    const currentDir = process.cwd();
    const rootPath = currentDir;
    const latexApp = new latexApp_1.default({
        outDir: '.workspace',
        rootPath,
        backend: 'cloudlatex',
        projectId: 0,
        endpoint: 'http://localhost:3000/api',
        autoBuild: true,
        storagePath: rootPath
    }, () => Promise.resolve('upload'));
    latexApp.setAccount({
        email: '',
        token: '',
        client: ''
    });
}
main();
//# sourceMappingURL=cli.js.map