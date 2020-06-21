import * as Sinon from 'sinon';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import * as chai from 'chai';
import * as mockFs from 'mock-fs';
import { v4 as uuid } from 'uuid';

import { TypeDB } from 'type-db';
import { FileInfoDesc, FileInfo } from '../../src/model/fileModel';
import FileWatcher from '../../src/fileManage/fileWatcher';
import SyncManager from '../../src/fileManage/syncManager';
import FileAdapter from '../../src/fileManage/FileAdapter';
import Backend from '../tool/backendStub';
import Logger from '../../src/logger';
import { DecideSyncMode } from '../../src';
import { SyncMode, ChangeState, ChangeLocation } from '../../src/types';

import * as tool from './../tool/syncTestTool';
import { streamToString, ReadableString } from './../../src/util';
import fsStub from './../tool/fsStub';

const workdir = '/workdir';
const testFileDict = {
  [path.join(workdir, 'main.tex')]: 'content', 
  [path.join(workdir, 'readme.md')]: 'readme', 
  [path.join(workdir, 'images', 'img1.png')]: '', 
  [path.join(workdir, 'images', 'img2.png')]: '', 
  [path.join(workdir, 'images', 'sub_images', 'sub_img1.png')]: '',
} as const;

let fileWatcher: FileWatcher;
const setupInstances = async () => {

  // Sync Mode Decision
  const syncModeDecision: {func: DecideSyncMode, mode: SyncMode} = {
    func: function(){ return Promise.resolve(this.mode);},
    mode: 'upload'
  };
  const decideSyncModeSpy = Sinon.spy(syncModeDecision.func);

  const logger = new Logger();

  // Files
  const db = new TypeDB();
  const localFiles = db.getRepository(FileInfoDesc);
  const backend = new Backend();
  Object.keys(testFileDict).map(absPath => {
    const relativePath = path.relative(workdir, absPath);
    const fileInfo: Partial<FileInfo> = {
      relativePath,
      isFolder: false,
      remoteRevision: uuid(),
      remoteId: uuid(),
      watcherSynced: true,
      localChange: 'no',
      remoteChange: 'no',
    };
    localFiles.new(fileInfo);
    backend.remoteFiles.new(fileInfo);
    backend.remoteContents[fileInfo.remoteId as string] = testFileDict[absPath];
  });
  fsStub(testFileDict);
  // File adapter
  const fileAdapter = new FileAdapter(workdir, localFiles, backend, logger);

  // Sync Manager
  const syncManager = new SyncManager(localFiles, fileAdapter, syncModeDecision.func);  

  // File watcher
  fileWatcher = new FileWatcher(workdir, localFiles, () => true, logger);
  await fileWatcher.init();

  return {
    decideSyncModeSpy,
    syncModeDecision,
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
    private instances: ReturnType<typeof setupInstances> extends Promise<infer T> ? T : never) 
  {
  }

  async executeTest() {
    // Apply some configuration
    this.instances.backend.isOffline = this.config.isOffline;
    this.instances.syncModeDecision.mode = this.config.syncMode;

    // Apply file changes to remote and local filesystems
    await this.applyFileChanges();

    // Wait unitl the system synchronizes local files and remote files
    const syncResult = await this.instances.syncManager.syncSession();
    await tool.sleep(0);
    // Verify syncronization result
    await this.verify(syncResult);
  }

  private async applyFileChanges() {
    let tasks: Promise<void>[] = [];
    switch(this.config.changeStates.local) {
      case 'create':
        tasks = tasks.concat(this.changeSet.local.create.map(
          relativePath => fs.promises.writeFile(
            path.join(workdir, relativePath),
            this.getNewContent(relativePath, this.config.changeStates.local, 'local')
          )
        ));
        break;
      case 'update':
        tasks = tasks.concat(this.changeSet.local.update.map(
          fileInfo => fs.promises.writeFile(
            path.join(workdir, fileInfo.relativePath), 
            this.getNewContent(fileInfo.relativePath, this.config.changeStates.local, 'local')
          )
        ));
        break;
      case 'delete':
        tasks = tasks.concat(this.changeSet.local.delete.map(
          fileInfo => fs.promises.unlink(path.join(workdir, fileInfo.relativePath))
        ));
        break;
    }
  
    switch(this.config.changeStates.remote) {
      case 'create':
        tasks = tasks.concat(this.changeSet.remote.create.map(
          relativePath => this.instances.backend._createInRemote(
            { relativePath },
            this.getNewContent(relativePath, this.config.changeStates.remote, 'remote')
          )
        ));
        break;
      case 'update':
        tasks = tasks.concat(this.changeSet.remote.update.map(
          fileInfo => {
            if(fileInfo.remoteId === null) {
              throw new Error('remoteId is null');
            }
            return this.instances.backend._updateInRemote(
              { relativePath: fileInfo.relativePath },
              this.getNewContent(fileInfo.relativePath, this.config.changeStates.remote, 'remote')
            );
          }
        ));
        break;
      case 'delete':
        tasks = tasks.concat(this.changeSet.remote.delete.map(
          fileInfo => {
            if(fileInfo.remoteId === null) {
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

  private getNewContent = (relativePath: string, change: ChangeState, location: ChangeLocation): string => (
    `"${change}" content of "${relativePath}" in "${location}"`
  );

  private computeExpectedFileDict(): Record<string, string> {
    let expectedFileDict: Record<string, string> = Object.assign({}, this.fileDict);
    const applyChange = (location: 'local' | 'remote') => {
      switch(this.config.changeStates[location]) {
        case 'create':
          this.changeSet[location]['create'].forEach(relativePath => {
            expectedFileDict[path.join(workdir, relativePath)] = this.getNewContent(relativePath, 'create', location);
          });
          break;
        case 'update':
          this.changeSet[location]['update'].forEach(fileInfo => {
            expectedFileDict[path.join(workdir, fileInfo.relativePath)] = this.getNewContent(fileInfo.relativePath, 'update', location);
          });
          break;
        case 'delete':
          this.changeSet[location]['update'].forEach(fileInfo => {
            delete expectedFileDict[path.join(workdir, fileInfo.relativePath)];
          });
          break;
      }
    };

    if(this.config.syncMode === 'upload') {
      (['remote', 'local'] as const).forEach(applyChange);
    } else {
      (['local', 'remote'] as const).forEach(applyChange);
    }
    return expectedFileDict;
  }

  private async verify(syncResult: boolean) {
    const expectedFileDict = this.computeExpectedFileDict();
    // TDOO
    if(this.config.isOffline) {

    }

    chai.assert.isTrue(syncResult);

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
      if(!localFile) {
        return;
      }
      chai.assert.isTrue(localFile.watcherSynced, 'localFile.watcherSynced');
      chai.assert.strictEqual(localFile.localChange, 'no', 'local.localChange');
      tasks.push(assertStream(fs.createReadStream(absPath), expectedContent));
      
      // remote
      const remoteContent = this.instances.backend.remoteContents[localFile.remoteId as string];
      chai.assert.strictEqual(remoteContent, expectedContent, 'remoteContent');
    });
    await Promise.all(tasks);
  }

}

afterEach(() => {
  fsStub.restore();
  fileWatcher.unwatch();
});


describe('Sync file system', () => {
  tool.TestConfigList.slice(5,6).forEach(config => {
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
      const test = new TestSituation(testFileDict, changeSet, config, instances);
      await test.executeTest();
    });
  });
});
