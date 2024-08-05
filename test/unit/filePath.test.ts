import chai from 'chai';
import { Config } from '../../src';
import anymatch from 'anymatch';

import { toAbsolutePath, toRelativePath, toPosixPath, dotFileExceptLatexmkrc } from './../../src/fileService/filePath';

const config: Config = {
  rootPath: '/home/user/tex_proj',
  backend: '',
  endpoint: '',
  projectId: 1,
  storagePath: '',
};


describe('toAbsolutePath', () => {
  it('file path', () => {
    chai.assert.strictEqual(
      toAbsolutePath(config, 'test/main.tex'),
      '/home/user/tex_proj/test/main.tex'
    );
  });

  it('directory path', () => {
    chai.assert.strictEqual(
      toAbsolutePath(config, 'test/child/'),
      '/home/user/tex_proj/test/child/'
    );
  });
});

describe('toRelativePath', () => {
  it('file path', () => {
    chai.assert.strictEqual(
      toRelativePath(config, '/home/user/tex_proj/test/main.tex'),
      'test/main.tex'
    );
  });

  it('directory path', () => {
    chai.assert.strictEqual(
      toRelativePath(config, '/home/user/tex_proj/test/child'),
      'test/child'
    );
  });
});

describe('toPosixPath', () => {
  it('win file path', () => {
    chai.assert.strictEqual(
      toPosixPath('data\\origin\\main.tex'),
      'data/origin/main.tex'
    );
  });

  it('posix file path', () => {
    chai.assert.strictEqual(
      toPosixPath('data/origin/main.tex'),
      'data/origin/main.tex'
    );
  });
});

describe('dotFileExceptLatexmkrc', () => {
  it('\'main\' should not be matched', () => {
    chai.assert.isFalse(anymatch(dotFileExceptLatexmkrc, 'main'));
  });

  it('\'.latex\' should be matched', () => {
    chai.assert.isTrue(anymatch(dotFileExceptLatexmkrc, '.latexm'));
  });

  it('\'.latexmkrc\' should not be matched', () => {
    chai.assert.isFalse(anymatch(dotFileExceptLatexmkrc, '.latexmkrc'));
  });

  it('\'.latexmkrc\' should be matched', () => {
    chai.assert.isTrue(anymatch(dotFileExceptLatexmkrc, '.latexmkrc2'));
  });
});