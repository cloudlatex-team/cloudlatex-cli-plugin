import fs from 'fs';
import path from 'path';
import chai from 'chai';
import { v4 as uuid } from 'uuid';

import { TypeDB } from '@moritanian/type-db';
import { FILE_INFO_DESC, FileInfo } from '../../src/model/fileModel';
import { FileWatcher } from '../../src/fileService/fileWatcher';
import { SyncManager, SyncResult } from '../../src/fileService/syncManager';
import { FileAdapter } from '../../src/fileService/fileAdapter';
import { BackendStub } from '../tool/backendStub';
import { Logger } from '../../src/util/logger';
import { ChangeState, ChangeLocation } from '../../src/types';

import * as tool from './../tool/syncTestTool';
import { streamToString } from '../../src/util/stream';
import fsStub from './../tool/fsStub';

const workdir = '/workdir';

const maintex = path.posix.join('main.tex');
const readmemd = path.posix.join('readme.md');
const imagesImg1png = path.posix.join('images', 'img1.png');
const imagesImg2png = path.posix.join('images', 'img2.png');
const imagesSubimagesSubimg1 = path.posix.join('images', 'sub_images', 'sub_img1.png');
const testAtxt = path.posix.join('test', 'a.txt');

const imagesDir = path.posix.join('images');
const imagesSubimagesDir = path.posix.join('images', 'sub_images');
const testDir = path.posix.join('test');

const testFileDict = {
  [path.posix.join(workdir, maintex)]: 'content',
  [path.posix.join(workdir, readmemd)]: 'readme',
  [path.posix.join(workdir, imagesImg1png)]: '',
  [path.posix.join(workdir, imagesImg2png)]: '',
  [path.posix.join(workdir, imagesSubimagesSubimg1)]: '',
  [path.posix.join(workdir, testAtxt)]: 'a',
} as const;

const testFileAndFolderDict = Object.assign({}, testFileDict, {
  [path.posix.join(workdir, imagesDir)]: null,
  [path.posix.join(workdir, imagesSubimagesDir)]: null,
  [path.posix.join(workdir, testDir)]: null,
});

let fileWatcher: FileWatcher;
const setupInstances = async () => {

  const logger = new Logger('error');

  // Files
  const db = new TypeDB();
  const localFiles = db.getRepository(FILE_INFO_DESC);
  const backend = new BackendStub();
  Object.keys(testFileAndFolderDict).map(absPath => {
    const relativePath = path.posix.relative(workdir, absPath);
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

  fsStub({ ...testFileDict });
  // File adapter
  const fileAdapter = new FileAdapter(workdir, localFiles, backend);

  // Sync Manager
  const syncManager = new SyncManager(localFiles, fileAdapter, logger);

  // File watcher
  fileWatcher = new FileWatcher({ rootPath: workdir, backend: '', endpoint: '', projectId: 0 }, localFiles, { logger });
  await fileWatcher.init();

  return {
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
  create: Array<{ relativePath: string, isFolder: boolean }>,
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
    // Apply file changes to remote and local filesystems
    await this.applyFileChanges();

    // Apply some configuration and sync
    this.instances.backend.isOffline =
      this.config.networkMode === 'offline' || this.config.networkMode === 'offline-and-online';
    let syncResult = await this.instances.syncManager.sync(this.config.conflictSolution);

    if (this.config.networkMode === 'offline-and-online') {
      // Sync again in online
      this.instances.backend.isOffline = false;
      syncResult = await this.instances.syncManager.sync(this.config.conflictSolution);
    }

    // Verify syncronization result
    await this.verify(syncResult);
  }

  private async applyFileChanges() {
    let tasks: Promise<void>[] = [];
    switch (this.config.changeStates.local) {
      case 'create':
        tasks = tasks.concat(this.changeSet.local.create.map(
          file => {
            if (file.isFolder) {
              return fs.promises.mkdir(path.posix.join(workdir, file.relativePath));
            } else {
              return fs.promises.writeFile(
                path.posix.join(workdir, file.relativePath),
                this.getChangedContent(file.relativePath, this.config.changeStates.local, 'local'));
            }

          }
        ));
        break;
      case 'update':
        tasks = tasks.concat(this.changeSet.local.update.map(
          fileInfo => fs.promises.writeFile(
            path.posix.join(workdir, fileInfo.relativePath),
            this.getChangedContent(fileInfo.relativePath, this.config.changeStates.local, 'local')
          )
        ));
        break;
      case 'delete':
        tasks = tasks.concat(this.changeSet.local.delete.map(
          fileInfo => {
            if (fileInfo.isFolder) {
              return fs.promises.rmdir(path.posix.join(workdir, fileInfo.relativePath));
            } else {
              return fs.promises.unlink(path.posix.join(workdir, fileInfo.relativePath));
            }
          }
        ));
        break;
    }

    switch (this.config.changeStates.remote) {
      case 'create':
        tasks = tasks.concat(this.changeSet.remote.create.map(
          file => this.instances.backend._createInRemote(
            file,
            this.getChangedContent(file.relativePath, this.config.changeStates.remote, 'remote')
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
              { relativePath: fileInfo.relativePath, isFolder: fileInfo.isFolder }
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
    const expectedFileDict: Record<string, string> = Object.assign({}, this.fileDict);
    const applyChange = (location: 'local' | 'remote') => {
      switch (this.config.changeStates[location]) {
        case 'create':
          this.changeSet[location]['create'].forEach(file => {
            expectedFileDict[
              path.posix.join(workdir, file.relativePath)
            ] = this.getChangedContent(file.relativePath, 'create', location);
          });
          break;
        case 'update':
          this.changeSet[location]['update'].forEach(fileInfo => {
            expectedFileDict[
              path.posix.join(workdir, fileInfo.relativePath)
            ] = this.getChangedContent(fileInfo.relativePath, 'update', location);
          });
          break;
        case 'delete':
          this.changeSet[location]['delete'].forEach(fileInfo => {
            const absPath = path.posix.join(workdir, fileInfo.relativePath);
            if (absPath in expectedFileDict) {
              delete expectedFileDict[absPath];
            }
          });
          break;
      }
    };
    if (this.config.networkMode === 'offline' || (this.config.conflict && !this.config.conflictSolution)) {
      applyChange('local');
    } else if (this.config.conflictSolution === 'push') {
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
    if (this.config.networkMode !== 'offline') {
      return 'no'; // Changed should be resolved
    }
    if (this.config.changeStates.local === 'create' && this.changeSet.local.create.some(file => (
      absPath === path.posix.join(workdir, file.relativePath)
    ))) {
      return 'create';
    }
    if (this.config.changeStates.local === 'update' && this.changeSet.local.update.some(fileInfo => (
      absPath === path.posix.join(workdir, fileInfo.relativePath)
    ))) {
      return 'update';
    }
    if (this.config.changeStates.local === 'delete' && this.changeSet.local.delete.some(fileInfo => (
      absPath === path.posix.join(workdir, fileInfo.relativePath)
    ))) {
      return 'delete';
    }
    return 'no';
  }

  private async verify(syncResult: SyncResult) {
    const expectedFileDict = this.computeExpectedFileDict();

    if (this.config.networkMode !== 'offline' && this.config.conflict && !this.config.conflictSolution) {
      chai.assert.isTrue(syncResult.conflict, 'syncResult.conflict');
    } else {
      chai.assert.isFalse(syncResult.conflict, 'syncResult.conflict');

    }

    if (this.config.networkMode === 'offline' || (this.config.conflict && !this.config.conflictSolution)) {
      chai.assert.isFalse(syncResult.success, 'syncResult.success');
      return;
    }
    chai.assert.isTrue(syncResult.success, 'syncResult.success');


    const expectedAbsPaths = Object.keys(expectedFileDict);
    // validate the number of files
    chai.assert.lengthOf(this.instances.localFiles.all(), expectedAbsPaths.length, 'number of localFiles');
    chai.assert.lengthOf(this.instances.backend.remoteFiles.all(), expectedAbsPaths.length, 'number of remoteFiles');

    // validate content of each file
    const tasks: Promise<unknown>[] = [];
    expectedAbsPaths.forEach((absPath) => {
      const expectedContent = expectedFileDict[absPath];
      const relativePath = path.posix.relative(workdir, absPath);

      // local
      const localFile = this.instances.localFiles.findBy('relativePath', relativePath);
      chai.assert.isNotNull(localFile);
      if (!localFile) {
        return;
      }
      chai.assert.isTrue(localFile.watcherSynced, `localFile.watcherSynced of ${localFile.relativePath}`);
      chai.assert.strictEqual(
        localFile.localChange,
        this.computeExpectedChangeState(absPath),
        `local.localChange of ${localFile.relativePath}`
      );
      if (!localFile.isFolder) {
        tasks.push(assertStream(fs.createReadStream(absPath), expectedContent));
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

describe('FileManager', () => {
  describe('Sync file system', () => {
    tool.TEST_CONFIG_LIST.forEach(config => {
      it(config.describe, async () => {
        const instances = await setupInstances();
        const localNewFiles = [
          { relativePath: 'new_file.tex', isFolder: false },
          { relativePath: 'images/new_img.png', isFolder: false }
        ];
        const remoteNewFiles = config.conflict ?
          localNewFiles : [
            { relativePath: 'remote_new_file.tex', isFolder: false },
            { relativePath: 'images/remote_new_img.png', isFolder: false }
          ];
        const localChangeFiles = [
          instances.localFiles.where({ relativePath: readmemd })[0],
          instances.localFiles.where({ relativePath: imagesSubimagesSubimg1 })[0],
        ];
        const remoteChangeFiles = config.conflict ?
          localChangeFiles : [
            instances.localFiles.where({ relativePath: imagesImg1png })[0],
            instances.localFiles.where({ relativePath: imagesImg2png })[0]
          ];
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
    tool.TEST_CONFIG_LIST.forEach(config => {
      if (config.changeStates.local === 'update' || config.changeStates.remote === 'update') {
        return; // Cannot update folder
      }

      it(config.describe, async () => {
        const instances = await setupInstances();
        const localNewFiles = [
          { relativePath: 'new_folder', isFolder: true },
          { relativePath: 'new_folder/new_img.png', isFolder: false }
        ];
        const remoteNewFiles = config.conflict ? localNewFiles : [
          { relativePath: 'remote_new_folder', isFolder: true },
          { relativePath: 'remote_new_folder/new_img.png', isFolder: false }
        ];
        const localDeleteFiles = [
          instances.localFiles.where({ relativePath: imagesSubimagesSubimg1 })[0],
          instances.localFiles.where({ relativePath: imagesSubimagesDir })[0]
        ];
        const remoteDeleteFiles = config.conflict ? localDeleteFiles : [
          instances.localFiles.where({ relativePath: testAtxt })[0],
          instances.localFiles.where({ relativePath: testDir })[0],
        ];
        const changeSet: ChangeSet = {
          'local': {
            'create': localNewFiles,
            'update': [],
            'delete': localDeleteFiles
          },
          'remote': {
            'create': remoteNewFiles,
            'update': [],
            'delete': remoteDeleteFiles,
          },
        };

        const test = new TestSituation(testFileAndFolderDict, changeSet, config, instances);
        await test.executeTest();
      });


    });
  });
});

afterEach(async () => {
  fsStub.restore();
  await fileWatcher?.stop();
});
