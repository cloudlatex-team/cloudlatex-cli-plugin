"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const chai = require("chai");
const uuid_1 = require("uuid");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("../../src/model/fileModel");
const fileWatcher_1 = require("../../src/fileService/fileWatcher");
const syncManager_1 = require("../../src/fileService/syncManager");
const fileAdapter_1 = require("../../src/fileService/fileAdapter");
const backendStub_1 = require("../tool/backendStub");
const logger_1 = require("../../src/util/logger");
const tool = require("./../tool/syncTestTool");
const stream_1 = require("../../src/util/stream");
const fsStub_1 = require("./../tool/fsStub");
const workdir = '/workdir';
const testFileDict = {
    [path.posix.join(workdir, 'main.tex')]: 'content',
    [path.posix.join(workdir, 'readme.md')]: 'readme',
    [path.posix.join(workdir, 'images', 'img1.png')]: '',
    [path.posix.join(workdir, 'images', 'img2.png')]: '',
    [path.posix.join(workdir, 'images', 'sub_images', 'sub_img1.png')]: '',
};
const testFileAndFolderDict = Object.assign({}, testFileDict, {
    [path.posix.join(workdir, 'images')]: null,
    [path.posix.join(workdir, 'images', 'sub_images')]: null,
});
let fileWatcher;
const setupInstances = () => __awaiter(void 0, void 0, void 0, function* () {
    // Sync Mode Decision
    let syncModeRef = { instance: 'upload' };
    const decideSyncMode = () => Promise.resolve(syncModeRef.instance);
    const decideSyncModeSpy = Sinon.spy(decideSyncMode);
    const logger = new logger_1.default('error');
    // Files
    const db = new type_db_1.TypeDB();
    const localFiles = db.getRepository(fileModel_1.FileInfoDesc);
    const backend = new backendStub_1.default();
    Object.keys(testFileAndFolderDict).map(absPath => {
        const relativePath = path.posix.relative(workdir, absPath);
        const revision = uuid_1.v4();
        const fileInfo = {
            relativePath,
            isFolder: testFileAndFolderDict[absPath] === null,
            localRevision: revision,
            remoteRevision: revision,
            remoteId: uuid_1.v4(),
            watcherSynced: true,
            localChange: 'no',
            remoteChange: 'no',
        };
        localFiles.new(fileInfo);
        backend.remoteFiles.new(fileInfo);
        backend.remoteContents[fileInfo.remoteId] = testFileAndFolderDict[absPath];
    });
    fsStub_1.default(testFileDict);
    // File adapter
    const fileAdapter = new fileAdapter_1.default(workdir, localFiles, backend);
    // Sync Manager
    const syncManager = new syncManager_1.default(localFiles, fileAdapter, decideSyncMode, logger);
    // File watcher
    fileWatcher = new fileWatcher_1.default(workdir, localFiles, () => true, logger);
    yield fileWatcher.init();
    return {
        decideSyncModeSpy,
        syncModeRef,
        backend,
        localFiles,
        syncManager
    };
});
const assertStream = (stream, expectedString) => __awaiter(void 0, void 0, void 0, function* () {
    const str = yield stream_1.streamToString(stream);
    chai.assert.strictEqual(str, expectedString);
});
class TestSituation {
    constructor(fileDict, changeSet, config, instances) {
        this.fileDict = fileDict;
        this.changeSet = changeSet;
        this.config = config;
        this.instances = instances;
        this.getChangedContent = (relativePath, change, location) => (`"${change}" content of "${relativePath}" in "${location}"`);
    }
    executeTest() {
        return __awaiter(this, void 0, void 0, function* () {
            // Apply some configuration
            this.instances.backend.isOffline = this.config.isOffline;
            this.instances.syncModeRef.instance = this.config.syncMode;
            // Apply file changes to remote and local filesystems
            yield this.applyFileChanges();
            // Wait unitl the system synchronizes local files and remote files
            const waitTask = new Promise((resolve, reject) => {
                this.instances.syncManager.on('sync-finished', resolve);
            });
            this.instances.syncManager.syncSession();
            const syncResult = yield waitTask;
            // await tool.sleep(0);
            // Verify syncronization result
            yield this.verify(syncResult.success);
        });
    }
    applyFileChanges() {
        return __awaiter(this, void 0, void 0, function* () {
            let tasks = [];
            switch (this.config.changeStates.local) {
                case 'create':
                    tasks = tasks.concat(this.changeSet.local.create.map(relativePath => fs.promises.writeFile(path.posix.join(workdir, relativePath), this.getChangedContent(relativePath, this.config.changeStates.local, 'local'))));
                    break;
                case 'update':
                    tasks = tasks.concat(this.changeSet.local.update.map(fileInfo => fs.promises.writeFile(path.posix.join(workdir, fileInfo.relativePath), this.getChangedContent(fileInfo.relativePath, this.config.changeStates.local, 'local'))));
                    break;
                case 'delete':
                    tasks = tasks.concat(this.changeSet.local.delete.map(fileInfo => fs.promises.unlink(path.posix.join(workdir, fileInfo.relativePath))));
                    break;
            }
            switch (this.config.changeStates.remote) {
                case 'create':
                    tasks = tasks.concat(this.changeSet.remote.create.map(relativePath => this.instances.backend._createInRemote({ relativePath }, this.getChangedContent(relativePath, this.config.changeStates.remote, 'remote'))));
                    break;
                case 'update':
                    tasks = tasks.concat(this.changeSet.remote.update.map(fileInfo => {
                        if (fileInfo.remoteId === null) {
                            throw new Error('remoteId is null');
                        }
                        return this.instances.backend._updateInRemote({ relativePath: fileInfo.relativePath }, this.getChangedContent(fileInfo.relativePath, this.config.changeStates.remote, 'remote'));
                    }));
                    break;
                case 'delete':
                    tasks = tasks.concat(this.changeSet.remote.delete.map(fileInfo => {
                        if (fileInfo.remoteId === null) {
                            throw new Error('remoteId is null');
                        }
                        return this.instances.backend._deleteInRemote({ relativePath: fileInfo.relativePath });
                    }));
                    break;
            }
            yield Promise.all(tasks);
        });
    }
    computeExpectedFileDict() {
        let expectedFileDict = Object.assign({}, this.fileDict);
        const applyChange = (location) => {
            switch (this.config.changeStates[location]) {
                case 'create':
                    this.changeSet[location]['create'].forEach(relativePath => {
                        expectedFileDict[path.posix.join(workdir, relativePath)] = this.getChangedContent(relativePath, 'create', location);
                    });
                    break;
                case 'update':
                    this.changeSet[location]['update'].forEach(fileInfo => {
                        expectedFileDict[path.posix.join(workdir, fileInfo.relativePath)] = this.getChangedContent(fileInfo.relativePath, 'update', location);
                    });
                    break;
                case 'delete':
                    this.changeSet[location]['update'].forEach(fileInfo => {
                        delete expectedFileDict[path.posix.join(workdir, fileInfo.relativePath)];
                    });
                    break;
            }
        };
        if (this.config.isOffline) {
            applyChange('local');
        }
        else if (this.config.syncMode === 'upload') {
            // Apply remote changes first and apply local changes later,
            // which emulates the 'upload' mode
            ['remote', 'local'].forEach(applyChange);
        }
        else {
            // Apply local changes first and apply remote changes later,
            // which emulates the 'download' mode
            ['local', 'remote'].forEach(applyChange);
        }
        return expectedFileDict;
    }
    computeExpectedChangeState(absPath) {
        if (!this.config.isOffline) {
            return 'no'; // Changed should be resolved
        }
        if (this.changeSet.local.create.some(relativePath => (absPath === path.posix.join(workdir, relativePath)))) {
            return 'create';
        }
        if (this.changeSet.local.update.some(fileInfo => (absPath === path.posix.join(workdir, fileInfo.relativePath)))) {
            return 'update';
        }
        if (this.changeSet.local.delete.some(fileInfo => (absPath === path.posix.join(workdir, fileInfo.relativePath)))) {
            return 'delete';
        }
        return 'no';
    }
    verify(syncResult) {
        return __awaiter(this, void 0, void 0, function* () {
            const expectedFileDict = this.computeExpectedFileDict();
            if (this.config.isOffline) {
                chai.assert.isFalse(syncResult);
            }
            else {
                chai.assert.isTrue(syncResult);
            }
            const expectedAbsPaths = Object.keys(expectedFileDict);
            // validate the number of files
            chai.assert.lengthOf(this.instances.localFiles.all(), expectedAbsPaths.length, 'number of localFiles');
            chai.assert.lengthOf(this.instances.backend.remoteFiles.all(), expectedAbsPaths.length, 'number of remoteFiles');
            // validate content of each file
            const tasks = [];
            expectedAbsPaths.forEach((absPath) => {
                let expectedContent = expectedFileDict[absPath];
                let relativePath = path.posix.relative(workdir, absPath);
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
                    const remoteContent = this.instances.backend.remoteContents[localFile.remoteId];
                    chai.assert.strictEqual(remoteContent, expectedContent, 'remoteContent');
                }
            });
            yield Promise.all(tasks);
        });
    }
}
afterEach(() => {
    fsStub_1.default.restore();
    fileWatcher.stop();
});
describe('Sync file system', () => {
    tool.TestConfigList.forEach(config => {
        it(config.describe, () => __awaiter(void 0, void 0, void 0, function* () {
            const instances = yield setupInstances();
            const localNewFiles = ['new_file.tex', 'images/new_img.png'];
            const remoteNewFiles = config.conflict ?
                localNewFiles : ['remote_new_file.tex', 'images/remote_new_img.png'];
            const localChangeFiles = [instances.localFiles.all()[1], instances.localFiles.all()[4]];
            const remoteChangeFiles = config.conflict ?
                localChangeFiles : [instances.localFiles.all()[2], instances.localFiles.all()[3]];
            const changeSet = {
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
            yield test.executeTest();
        }));
    });
});
describe('Sync folder test', () => {
    it('Create a folder and a file locally', () => __awaiter(void 0, void 0, void 0, function* () {
        const instances = yield setupInstances();
        const folderAbsPath = path.posix.join(workdir, 'addedFolder');
        const fileAbsPath = path.posix.join(workdir, 'addedFolder', 'file.txt');
        const fileContent = 'file content';
        yield fs.promises.mkdir(folderAbsPath);
        yield fs.promises.writeFile(fileAbsPath, fileContent);
        const syncResult = yield instances.syncManager.syncSession();
        // TODO check the order of sync tasks
    }));
});
//# sourceMappingURL=fileManage.test.js.map