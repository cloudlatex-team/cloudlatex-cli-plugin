import { FileWatcher } from './../../src/fileService/fileWatcher.ts';
import Sinon from 'npm:sinon';
import chai from 'npm:chai';
import path from 'node:path';
import fs from 'fs-extra';
import { TypeDB } from 'npm:@moritanian/type-db';
import { FILE_INFO_DESC } from '../../src/model/fileModel.ts';
import { Logger } from '../../src/util/logger.ts';
import * as tool from './../tool/syncTestTool.ts';
import { toPosixPath } from '../../src/fileService/filePath.ts';

const fixturePath = toPosixPath(path.resolve(__dirname, './../fixture'));
const workspacePath = toPosixPath(path.resolve(__dirname, './../workspace'));

const setupWorkspace = async () => {
  await cleanupWorkspace();
  await fs.copy(fixturePath, workspacePath);
  await tool.sleep(1000);
};

const cleanupWorkspace = async () => {
  await fs.emptyDir(workspacePath);
};

let watcher: FileWatcher | null;

const setupInstances = async (options?: { noDBEntry?: boolean, deletedFileDBEntry?: boolean }) => {
  const db = new TypeDB();
  const files = db.getRepository(FILE_INFO_DESC);

  if (!options?.noDBEntry) {
    files.new({ relativePath: 'main.tex' });
  }

  if (options?.deletedFileDBEntry) {
    files.new({ relativePath: 'deleted.tex' });
  }

  const ignoredFiles = [
    '**/.*', // dot file
    '**/ignore_file', // specific file
  ];

  watcher = new FileWatcher(
    { rootPath: workspacePath, backend: '', endpoint: '', projectId: 0 },
    files,
    { ignored: ignoredFiles, logger: new Logger('warn') }
  );

  const changedSpy = Sinon.spy();
  const awaitChangeDetection = () => {
    return new Promise((resolve) => {
      watcher?.on('change-detected', resolve);
    });
  };
  watcher.on('change-detected', changedSpy);

  await watcher.init();
  return {
    files,
    watcher,
    changedSpy,
    awaitChangeDetection
  };
};

before(setupWorkspace);
after(cleanupWorkspace);

afterEach(async () => {
  if (watcher) {
    await watcher.stop();
    watcher = null;
  }
});

describe('FileWatcher', () => {
  describe('Initialization', () => {
    it('db entry should exist', async () => {
      const { files } = await setupInstances();
      const entry = files.find(1);
      chai.assert.exists(entry);
      chai.assert.isTrue(entry?.watcherSynced);
      chai.assert.equal(entry?.localChange, 'no');
      chai.assert.equal(entry?.remoteChange, 'no');

    });

    it('db entry should be created if not exists', async () => {
      const { files } = await setupInstances({ noDBEntry: true });
      const entry = files.find(1);
      chai.assert.exists(entry);
      chai.assert.isTrue(entry?.watcherSynced);
      chai.assert.equal(entry?.localChange, 'create');
      chai.assert.equal(entry?.remoteChange, 'no');
    });

    it('db entry should be checked as deleted if the file does not exist', async () => {
      const { files } = await setupInstances({ deletedFileDBEntry: true });
      const entry = files.find(2);
      chai.assert.exists(entry);
      chai.assert.isTrue(entry?.watcherSynced);
      chai.assert.equal(entry?.localChange, 'delete');
      chai.assert.equal(entry?.remoteChange, 'no');
    });
  });

  describe('Create', () => {
    it('localChange should be "create"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'new_file.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'create');
      await fs.remove(filePath);
    });

    it('file that matches the ignore pattern with wildcard should be ignored', async () => {
      const { changedSpy } = await setupInstances();
      const relativePath = '.env';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);

      await tool.sleep(1000);
      chai.assert.isTrue(changedSpy.notCalled);

      await fs.remove(filePath);
    });

    it('file that matches the ignore pattern without wildcard should be ignored', async () => {
      const { changedSpy } = await setupInstances();
      const relativePath = 'ignore_file';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);

      await tool.sleep(1000);
      chai.assert.isTrue(changedSpy.notCalled);

      await fs.remove(filePath);
    });
  });

  describe('Update', () => {
    it('localChange should be "update"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'main.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.writeFile(filePath, 'updated content');
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'update');
    });
  });

  describe('Delete', () => {
    it('localChange should be "delete"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'main.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.remove(filePath);
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'delete');
      await fs.createFile(filePath);
      // await awaitChangeDetection();
    });
  });


  describe('Create and Update', () => {
    it('localChange should be "create"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'new_file.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.writeFile(filePath, 'updated content');
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'create');
      await fs.remove(filePath);
    });
  });

  describe('Create and Update and Delete', () => {
    it('the file should not exist', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'new_file.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.writeFile(filePath, 'updated content');
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.remove(filePath);
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.isNull(file);
    });
  });

  describe('Delete and recreate', () => {
    it('localChange should be "update"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'main.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.remove(filePath);
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'update');
    });
  });


  describe('Update, delete and recreate', () => {
    it('localChange should be "update"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'main.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.writeFile(filePath, 'update content');
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.remove(filePath);
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'update');
    });
  });

  describe('Create, delete and recreate', () => {
    it('localChange should be "create"', async () => {
      const { files, awaitChangeDetection } = await setupInstances();
      const relativePath = 'new_file.tex';
      const filePath = path.resolve(workspacePath, relativePath);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.remove(filePath);
      await awaitChangeDetection();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      fs.createFile(filePath);
      await awaitChangeDetection();
      const file = files.findBy('relativePath', relativePath);
      chai.assert.strictEqual(file && file.localChange, 'create');
    });
  });
});
