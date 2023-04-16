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
};
const testFileAndFolderDict = Object.assign({}, testFileDict, {
    [path.posix.join(workdir, imagesDir)]: null,
    [path.posix.join(workdir, imagesSubimagesDir)]: null,
    [path.posix.join(workdir, testDir)]: null,
});
let fileWatcher;
const setupInstances = () => __awaiter(void 0, void 0, void 0, function* () {
    // Sync Mode Decision
    const syncModeRef = { instance: 'upload' };
    const decideSyncMode = () => Promise.resolve(syncModeRef.instance);
    const decideSyncModeSpy = Sinon.spy(decideSyncMode);
    const logger = new logger_1.Logger('error');
    // Files
    const db = new type_db_1.TypeDB();
    const localFiles = db.getRepository(fileModel_1.FILE_INFO_DESC);
    const backend = new backendStub_1.BackendStub();
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
    fsStub_1.default(Object.assign({}, testFileDict));
    // File adapter
    const fileAdapter = new fileAdapter_1.FileAdapter(workdir, localFiles, backend);
    // Sync Manager
    const syncManager = new syncManager_1.SyncManager(localFiles, fileAdapter, decideSyncMode, logger);
    // File watcher
    fileWatcher = new fileWatcher_1.FileWatcher({ rootPath: workdir, backend: '', endpoint: '', projectId: 0 }, localFiles, { logger });
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
            // Apply file changes to remote and local filesystems
            yield this.applyFileChanges();
            // Apply some configuration and sync
            this.instances.backend.isOffline =
                this.config.networkMode === 'offline' || this.config.networkMode === 'offline-and-online';
            this.instances.syncModeRef.instance = this.config.syncMode;
            let syncResult = yield this.instances.syncManager.sync();
            if (this.config.networkMode === 'offline-and-online') {
                // Sync again in online
                this.instances.backend.isOffline = false;
                syncResult = yield this.instances.syncManager.sync();
            }
            // Verify syncronization result
            yield this.verify(syncResult.success);
        });
    }
    applyFileChanges() {
        return __awaiter(this, void 0, void 0, function* () {
            let tasks = [];
            switch (this.config.changeStates.local) {
                case 'create':
                    tasks = tasks.concat(this.changeSet.local.create.map(file => {
                        if (file.isFolder) {
                            return fs.promises.mkdir(path.posix.join(workdir, file.relativePath));
                        }
                        else {
                            return fs.promises.writeFile(path.posix.join(workdir, file.relativePath), this.getChangedContent(file.relativePath, this.config.changeStates.local, 'local'));
                        }
                    }));
                    break;
                case 'update':
                    tasks = tasks.concat(this.changeSet.local.update.map(fileInfo => fs.promises.writeFile(path.posix.join(workdir, fileInfo.relativePath), this.getChangedContent(fileInfo.relativePath, this.config.changeStates.local, 'local'))));
                    break;
                case 'delete':
                    tasks = tasks.concat(this.changeSet.local.delete.map(fileInfo => {
                        if (fileInfo.isFolder) {
                            return fs.promises.rmdir(path.posix.join(workdir, fileInfo.relativePath));
                        }
                        else {
                            return fs.promises.unlink(path.posix.join(workdir, fileInfo.relativePath));
                        }
                    }));
                    break;
            }
            switch (this.config.changeStates.remote) {
                case 'create':
                    tasks = tasks.concat(this.changeSet.remote.create.map(file => this.instances.backend._createInRemote(file, this.getChangedContent(file.relativePath, this.config.changeStates.remote, 'remote'))));
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
                        return this.instances.backend._deleteInRemote({ relativePath: fileInfo.relativePath, isFolder: fileInfo.isFolder });
                    }));
                    break;
            }
            yield Promise.all(tasks);
        });
    }
    computeExpectedFileDict() {
        const expectedFileDict = Object.assign({}, this.fileDict);
        const applyChange = (location) => {
            switch (this.config.changeStates[location]) {
                case 'create':
                    this.changeSet[location]['create'].forEach(file => {
                        expectedFileDict[path.posix.join(workdir, file.relativePath)] = this.getChangedContent(file.relativePath, 'create', location);
                    });
                    break;
                case 'update':
                    this.changeSet[location]['update'].forEach(fileInfo => {
                        expectedFileDict[path.posix.join(workdir, fileInfo.relativePath)] = this.getChangedContent(fileInfo.relativePath, 'update', location);
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
        if (this.config.networkMode === 'offline') {
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
        if (this.config.networkMode !== 'offline') {
            return 'no'; // Changed should be resolved
        }
        if (this.config.changeStates.local === 'create' && this.changeSet.local.create.some(file => (absPath === path.posix.join(workdir, file.relativePath)))) {
            return 'create';
        }
        if (this.config.changeStates.local === 'update' && this.changeSet.local.update.some(fileInfo => (absPath === path.posix.join(workdir, fileInfo.relativePath)))) {
            return 'update';
        }
        if (this.config.changeStates.local === 'delete' && this.changeSet.local.delete.some(fileInfo => (absPath === path.posix.join(workdir, fileInfo.relativePath)))) {
            return 'delete';
        }
        return 'no';
    }
    verify(syncResult) {
        return __awaiter(this, void 0, void 0, function* () {
            const expectedFileDict = this.computeExpectedFileDict();
            if (this.config.networkMode === 'offline') {
                chai.assert.isFalse(syncResult, 'syncResult');
            }
            else {
                chai.assert.isTrue(syncResult, 'syncResult');
            }
            if (this.config.networkMode === 'offline') {
                return;
            }
            const expectedAbsPaths = Object.keys(expectedFileDict);
            // validate the number of files
            chai.assert.lengthOf(this.instances.localFiles.all(), expectedAbsPaths.length, 'number of localFiles');
            chai.assert.lengthOf(this.instances.backend.remoteFiles.all(), expectedAbsPaths.length, 'number of remoteFiles');
            // validate content of each file
            const tasks = [];
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
                chai.assert.strictEqual(localFile.localChange, this.computeExpectedChangeState(absPath), `local.localChange of ${localFile.relativePath}`);
                if (!localFile.isFolder) {
                    tasks.push(assertStream(fs.createReadStream(absPath), expectedContent));
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
describe('FileManager', () => {
    describe('Sync file system', () => {
        tool.TEST_CONFIG_LIST.forEach(config => {
            it(config.describe, () => __awaiter(void 0, void 0, void 0, function* () {
                const instances = yield setupInstances();
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
        tool.TEST_CONFIG_LIST.forEach(config => {
            if (config.changeStates.local === 'update' || config.changeStates.remote === 'update') {
                return; // Cannot update folder
            }
            it(config.describe, () => __awaiter(void 0, void 0, void 0, function* () {
                const instances = yield setupInstances();
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
                const changeSet = {
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
                yield test.executeTest();
            }));
        });
    });
});
afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
    fsStub_1.default.restore();
    yield (fileWatcher === null || fileWatcher === void 0 ? void 0 : fileWatcher.stop());
}));
//# sourceMappingURL=fileManage.test.js.map