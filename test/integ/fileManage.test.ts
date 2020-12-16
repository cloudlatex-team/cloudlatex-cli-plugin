import * as Sinon from 'sinon';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import * as chai from 'chai';
import { v4 as uuid } from 'uuid';

import { TypeDB } from '@moritanian/type-db';
import { FileInfoDesc, FileInfo } from '../../src/model/fileModel';
import FileWatcher from '../../src/fileService/fileWatcher';
import SyncManager, { SyncResult } from '../../src/fileService/syncManager';
import FileAdapter from '../../src/fileService/FileAdapter';
import Backend from '../tool/backendStub';
import Logger from '../../src/util/logger';
import { DecideSyncMode } from '../../src';
import { SyncMode, ChangeState, ChangeLocation } from '../../src/types';

import * as tool from './../tool/syncTestTool';
import { streamToString } from '../../src/util/stream';
import fsStub from './../tool/fsStub';

const workdir = '/workdir';
const testFileDict = {
  [path.join(workdir, 'main.tex')]: 'content',
  [path.join(workdir, 'readme.md')]: 'readme',
  [path.join(workdir, 'images', 'img1.png')]: '',
  [path.join(workdir, 'images', 'img2.png')]: '',
  [path.join(workdir, 'images', 'sub_images', 'sub_img1.png')]: '',
} as const;

const testFileAndFolderDict = Object.assign({}, testFileDict, {
  [path.join(workdir, 'images')]: null,
  [path.join(workdir, 'images', 'sub_images')]: null,
});

let fileWatcher: FileWatcher;
const setupInstances = async () => {

  // Sync Mode Decision
  let syncModeRef: { instance: SyncMode } = { instance: 'upload' };
  const decideSyncMode: DecideSyncMode = () => Promise.resolve(syncModeRef.instance);
  const decideSyncModeSpy = Sinon.spy(decideSyncMode);

  const logger = new Logger('error');

  // Files
  const db = new TypeDB();
  const localFiles = db.getRepository(FileInfoDesc);
  const backend = new Backend();
  Object.keys(testFileAndFolderDict).map(absPath => {
    const relativePath = path.relative(workdir, absPath);
    const revision = uuid();
    const fileInfo: Partial<FileInfo> = {
      relativePath,
      isFolder: testFileAndFolderDict[absPath] === null,
      localRevision: revision,
      remoteRevision: revision,
      remoteId: uuid(),
      watcherSynced: true,
      localChange: 'no',
      remoteChange: 'no',
    };
    localFiles.new(fileInfo);
    backend.remoteFiles.new(fileInfo);
    backend.remoteContents[fileInfo.remoteId as string] = testFileAndFolderDict[absPath];
  });

  fsStub(testFileDict);
  // File adapter
  const fileAdapter = new FileAdapter(workdir, localFiles, backend);

  // Sync Manager
  const syncManager = new SyncManager(localFiles, fileAdapter, decideSyncMode, logger);

  // File watcher
  fileWatcher = new FileWatcher(workdir, localFiles, () => true, logger);
  await fileWatcher.init();

  return {
    decideSyncModeSpy,
    syncModeRef,
    backend,
    localFiles,
    syncManager
  };
};

const assertStream = async (stream: NodeJS.ReadableStream, expectedString: string) => {
  const str = await streamToString(stream);
  chai.assert.strictEqual(str, expectedString);
};

type SideChangeSet = {
  create: string[],
  update: FileInfo[],
  delete: FileInfo[],
};

type ChangeSet = {
  local: SideChangeSet,
  remote: SideChangeSet,
};

class TestSituation {
  constructor(
    private fileDict: Record<string, string>,
    private changeSet: ChangeSet,
    private config: tool.TestConfig,
    private instances: ReturnType<typeof setupInstances> extends Promise<infer T> ? T : never) {
  }

  async executeTest() {
    // Apply some configuration
    this.instances.backend.isOffline = this.config.isOffline;
    this.instances.syncModeRef.instance = this.config.syncMode;

    // Apply file changes to remote and local filesystems
    await this.applyFileChanges();

    // Wait unitl the system synchronizes local files and remote files
    const waitTask = new Promise((resolve: (result: SyncResult) => void, reject) => {
      this.instances.syncManager.on('sync-finished', resolve);
    });
    this.instances.syncManager.syncSession();
    const syncResult = await waitTask;
    // await tool.sleep(0);

    // Verify syncronization result
    await this.verify(syncResult.success);
  }

  private async applyFileChanges() {
    let tasks: Promise<void>[] = [];
    switch (this.config.changeStates.local) {
      case 'create':
        tasks = tasks.concat(this.changeSet.local.create.map(
          relativePath => fs.promises.writeFile(
            path.join(workdir, relativePath),
            this.getChangedContent(relativePath, this.config.changeStates.local, 'local')
          )
        ));
        break;
      case 'update':
        tasks = tasks.concat(this.changeSet.local.update.map(
          fileInfo => fs.promises.writeFile(
            path.join(workdir, fileInfo.relativePath),
            this.getChangedContent(fileInfo.relativePath, this.config.changeStates.local, 'local')
          )
        ));
        break;
      case 'delete':
        tasks = tasks.concat(this.changeSet.local.delete.map(
          fileInfo => fs.promises.unlink(path.join(workdir, fileInfo.relativePath))
        ));
        break;
    }

    switch (this.config.changeStates.remote) {
      case 'create':
        tasks = tasks.concat(this.changeSet.remote.create.map(
          relativePath => this.instances.backend._createInRemote(
            { relativePath },
            this.getChangedContent(relativePath, this.config.changeStates.remote, 'remote')
          )
        ));
        break;
      case 'update':
        tasks = tasks.concat(this.changeSet.remote.update.map(
          fileInfo => {
            if (fileInfo.remoteId === null) {
              throw new Error('remoteId is null');
            }
            return this.instances.backend._updateInRemote(
              { relativePath: fileInfo.relativePath },
              this.getChangedContent(fileInfo.relativePath, this.config.changeStates.remote, 'remote')
            );
          }
        ));
        break;
      case 'delete':
        tasks = tasks.concat(this.changeSet.remote.delete.map(
          fileInfo => {
            if (fileInfo.remoteId === null) {
              throw new Error('remoteId is null');
            }
            return this.instances.backend._deleteInRemote(
              { relativePath: fileInfo.relativePath }
            );
          }
        ));
        break;
    }
    await Promise.all(tasks);
  }

  private getChangedContent = (relativePath: string, change: ChangeState, location: ChangeLocation): string => (
    `"${change}" content of "${relativePath}" in "${location}"`
  );

  private computeExpectedFileDict(): Record<string, string> {
    let expectedFileDict: Record<string, string> = Object.assign({}, this.fileDict);
    const applyChange = (location: 'local' | 'remote') => {
      switch (this.config.changeStates[location]) {
        case 'create':
          this.changeSet[location]['create'].forEach(relativePath => {
            expectedFileDict[path.join(workdir, relativePath)] = this.getChangedContent(relativePath, 'create', location);
          });
          break;
        case 'update':
          this.changeSet[location]['update'].forEach(fileInfo => {
            expectedFileDict[path.join(workdir, fileInfo.relativePath)] = this.getChangedContent(fileInfo.relativePath, 'update', location);
          });
          break;
        case 'delete':
          this.changeSet[location]['update'].forEach(fileInfo => {
            delete expectedFileDict[path.join(workdir, fileInfo.relativePath)];
          });
          break;
      }
    };
    if (this.config.isOffline) {
      applyChange('local');
    } else if (this.config.syncMode === 'upload') {
      // Apply remote changes first and apply local changes later,
      // which emulates the 'upload' mode
      (['remote', 'local'] as const).forEach(applyChange);
    } else {
      // Apply local changes first and apply remote changes later,
      // which emulates the 'download' mode
      (['local', 'remote'] as const).forEach(applyChange);
    }
    return expectedFileDict;
  }

  private computeExpectedChangeState(absPath: string): ChangeState {
    if (!this.config.isOffline) {
      return 'no'; // Changed should be resolved
    }
    if (this.changeSet.local.create.some(relativePath => (
      absPath === path.join(workdir, relativePath)
    ))) {
      return 'create';
    }
    if (this.changeSet.local.update.some(fileInfo => (
      absPath === path.join(workdir, fileInfo.relativePath)
    ))) {
      return 'update';
    }
    if (this.changeSet.local.delete.some(fileInfo => (
      absPath === path.join(workdir, fileInfo.relativePath)
    ))) {
      return 'delete';
    }
    return 'no';
  }

  private async verify(syncResult: boolean) {
    const expectedFileDict = this.computeExpectedFileDict();
    if (this.config.isOffline) {
      chai.assert.isFalse(syncResult);
    } else {
      chai.assert.isTrue(syncResult);
    }


    const expectedAbsPaths = Object.keys(expectedFileDict);
    // validate the number of files
    chai.assert.lengthOf(this.instances.localFiles.all(), expectedAbsPaths.length, 'number of localFiles');
    chai.assert.lengthOf(this.instances.backend.remoteFiles.all(), expectedAbsPaths.length, 'number of remoteFiles');

    // validate content of each file
    const tasks: Promise<unknown>[] = [];
    expectedAbsPaths.forEach((absPath) => {
      let expectedContent = expectedFileDict[absPath];
      let relativePath = path.relative(workdir, absPath);

      // local
      const localFile = this.instances.localFiles.findBy('relativePath', relativePath);
      chai.assert.isNotNull(localFile);
      if (!localFile) {
        return;
      }
      chai.assert.isTrue(localFile.watcherSynced, `localFile.watcherSynced of ${localFile.relativePath}`);
      chai.assert.strictEqual(localFile.localChange, this.computeExpectedChangeState(absPath), `local.localChange of ${localFile.relativePath}`);
      if (!localFile.isFolder) {
        tasks.push(assertStream(fs.createReadStream(absPath), expectedContent));
      }

      if (this.config.isOffline) {
        return;
      }

      // remote
      if (!localFile.isFolder) {
        const remoteContent = this.instances.backend.remoteContents[localFile.remoteId as string];
        chai.assert.strictEqual(remoteContent, expectedContent, 'remoteContent');
      }
    });
    await Promise.all(tasks);
  }

}

afterEach(() => {
  fsStub.restore();
  fileWatcher.stop();
});


describe('Sync file system', () => {
  tool.TestConfigList.forEach(config => {
    it(config.describe, async () => {
      const instances = await setupInstances();
      const localNewFiles = ['new_file.tex', 'images/new_img.png'];
      const remoteNewFiles = config.conflict ?
        localNewFiles : ['remote_new_file.tex', 'images/remote_new_img.png'];
      const localChangeFiles = [instances.localFiles.all()[1], instances.localFiles.all()[4]];
      const remoteChangeFiles = config.conflict ?
        localChangeFiles : [instances.localFiles.all()[2], instances.localFiles.all()[3]];
      const changeSet: ChangeSet = {
        'local': {
          'create': localNewFiles,
          'update': localChangeFiles,
          'delete': localChangeFiles
        },
        'remote': {
          'create': remoteNewFiles,
          'update': remoteChangeFiles,
          'delete': remoteChangeFiles
        },
      };
      const test = new TestSituation(testFileAndFolderDict, changeSet, config, instances);
      await test.executeTest();
    });
  });
});

describe('Sync folder test', () => {
  it('Create a folder and a file locally', async () => {
    const instances = await setupInstances();
    const folderAbsPath = path.join(workdir, 'addedFolder');
    const fileAbsPath = path.join(workdir, 'addedFolder', 'file.txt');
    const fileContent = 'file content';
    await fs.promises.mkdir(folderAbsPath);
    await fs.promises.writeFile(fileAbsPath, fileContent);
    const syncResult = await instances.syncManager.syncSession();
    // TODO check the order of sync tasks
  });
});
