"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai = require("chai");
const anymatch_1 = require("anymatch");
const filePath_1 = require("./../../src/fileService/filePath");
const config = {
    rootPath: '/home/user/tex_proj',
    backend: '',
    endpoint: '',
    projectId: 1,
    storagePath: '',
};
describe('toAbsolutePath', () => {
    it('file path', () => {
        chai.assert.strictEqual(filePath_1.toAbsolutePath(config, 'test/main.tex'), '/home/user/tex_proj/test/main.tex');
    });
    it('directory path', () => {
        chai.assert.strictEqual(filePath_1.toAbsolutePath(config, 'test/child/'), '/home/user/tex_proj/test/child/');
    });
});
describe('toRelativePath', () => {
    it('file path', () => {
        chai.assert.strictEqual(filePath_1.toRelativePath(config, '/home/user/tex_proj/test/main.tex'), 'test/main.tex');
    });
    it('directory path', () => {
        chai.assert.strictEqual(filePath_1.toRelativePath(config, '/home/user/tex_proj/test/child'), 'test/child');
    });
});
describe('toPosixPath', () => {
    it('win file path', () => {
        chai.assert.strictEqual(filePath_1.toPosixPath('data\\origin\\main.tex'), 'data/origin/main.tex');
    });
    it('posix file path', () => {
        chai.assert.strictEqual(filePath_1.toPosixPath('data/origin/main.tex'), 'data/origin/main.tex');
    });
});
describe('dotFileExceptLatexmkrc', () => {
    it('\'main\' should not be matched', () => {
        chai.assert.isFalse(anymatch_1.default(filePath_1.dotFileExceptLatexmkrc, 'main'));
    });
    it('\'.latex\' should be matched', () => {
        chai.assert.isTrue(anymatch_1.default(filePath_1.dotFileExceptLatexmkrc, '.latexm'));
    });
    it('\'.latexmkrc\' should not be matched', () => {
        chai.assert.isFalse(anymatch_1.default(filePath_1.dotFileExceptLatexmkrc, '.latexmkrc'));
    });
    it('\'.latexmkrc\' should be matched', () => {
        chai.assert.isTrue(anymatch_1.default(filePath_1.dotFileExceptLatexmkrc, '.latexmkrc2'));
    });
});
//# sourceMappingURL=filePath.test.js.map