import FileWatcher from './../../src/fileManage/fileWatcher';
import * as Sinon from 'sinon';
import * as chai from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import { TypeDB, Repository } from 'type-db';
import { FileRepository, FileInfoDesc } from '../../src/model/fileModel';
import Logger from './../../src/logger';
import * as tool from './../tool/syncTestTool';

const fixturePath = path.resolve(__dirname, './../fixture');
const workspacePath = path.resolve(__dirname, './../workspace');

const setupWorkspace = async () => {
  await fs.copy(fixturePath, workspacePath);
};

const cleanupWorkspace = async () => {
  await fs.remove(workspacePath);
};

let watcher: FileWatcher | null;

const setupInstances = async () => {
  const db = new TypeDB();
  const files = db.getRepository(FileInfoDesc);
  files.new({ relativePath: 'main.tex', watcherSynced: true });
  watcher =  new FileWatcher(workspacePath, files, () => true, new Logger());
  const changedSpy = Sinon.spy();
  watcher.on('change-detected', changedSpy);
  await watcher.init();
  return {
    files,
    watcher,
    changedSpy
  };
};

before(setupWorkspace);
after(cleanupWorkspace);

afterEach(() => {
  if(watcher) {
    watcher.unwatch();
    watcher = null;
  }
});

describe('Create', () => {
  it('should emit change-detected', (done) => {
    (async () => {
      const { watcher, files, changedSpy } = await setupInstances();
      watcher.once('change-detected', async () => {
        const file = files.findBy('localChange', 'create');
        chai.assert.strictEqual(file?.changeLocation, 'local');
        await fs.remove(path.resolve(workspacePath, './new_file.tex'));
        done();
      });
      await fs.createFile(path.resolve(workspacePath, './new_file.tex'));
    })();
  });
});

describe('Update', () => {
  it('should emit change-detected', (done) => {
    (async () => {
      const { watcher, files, changedSpy } = await setupInstances();
      watcher.on('change-detected', async () => {
        const file = files.findBy('localChange', 'update');
        chai.assert.isNotNull(file);
        done();
      });
      fs.writeFile(path.resolve(workspacePath, './main.tex'), 'content');

    })();
  });
});

describe('Delete', () => {
  it('should emit change-detected', (done) => {
    (async () => {
      const { watcher, files, changedSpy } = await setupInstances();
      await fs.remove(path.resolve(workspacePath, './main.tex'));
      watcher.on('change-detected', async () => {
        const file = files.findBy('localChange', 'delete');
        chai.assert.isNotNull(file);
        done();
      });
    })();
  });
});
