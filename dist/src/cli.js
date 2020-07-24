#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const latexApp_1 = require("./latexApp");
// TDOO
function main() {
    console.log('hello');
    return;
    const args = process.argv.slice(2);
    const currentDir = process.cwd();
    const rootPath = currentDir;
    new latexApp_1.default({
        outDir: '.workspace',
        rootPath,
        backend: 'cloudlatex',
        client: '',
        email: '',
        token: '',
        projectId: 0,
        endpoint: 'http://localhost:3000/api',
        autoBuild: true
    }, () => Promise.resolve('upload'));
}
main();
//# sourceMappingURL=cli.js.map