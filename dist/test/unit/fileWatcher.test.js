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
const fileWatcher_1 = require("./../../src/fileService/fileWatcher");
const Sinon = require("sinon");
const chai = require("chai");
const path = require("path");
const fs = require("fs-extra");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("../../src/model/fileModel");
const logger_1 = require("../../src/util/logger");
const tool = require("./../tool/syncTestTool");
const filePath_1 = require("../../src/fileService/filePath");
const fixturePath = filePath_1.toPosixPath(path.resolve(__dirname, './../fixture'));
const workspacePath = filePath_1.toPosixPath(path.resolve(__dirname, './../workspace'));
const setupWorkspace = () => __awaiter(void 0, void 0, void 0, function* () {
    yield cleanupWorkspace();
    yield fs.copy(fixturePath, workspacePath);
    yield tool.sleep(1000);
});
const cleanupWorkspace = () => __awaiter(void 0, void 0, void 0, function* () {
    yield fs.emptyDir(workspacePath);
});
let watcher;
const setupInstances = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const db = new type_db_1.TypeDB();
    const files = db.getRepository(fileModel_1.FILE_INFO_DESC);
    if (!(options === null || options === void 0 ? void 0 : options.noDBEntry)) {
        files.new({ relativePath: 'main.tex' });
    }
    if (options === null || options === void 0 ? void 0 : options.deletedFileDBEntry) {
        files.new({ relativePath: 'deleted.tex' });
    }
    const ignoredFiles = [
        '**/.*',
        '**/ignore_file',
    ];
    watcher = new fileWatcher_1.FileWatcher({ rootPath: workspacePath, backend: '', endpoint: '', projectId: 0 }, files, { ignored: ignoredFiles, logger: new logger_1.Logger('warn') });
    const changedSpy = Sinon.spy();
    const awaitChangeDetection = () => {
        return new Promise((resolve) => {
            watcher === null || watcher === void 0 ? void 0 : watcher.on('change-detected', resolve);
        });
    };
    watcher.on('change-detected', changedSpy);
    yield watcher.init();
    return {
        files,
        watcher,
        changedSpy,
        awaitChangeDetection
    };
});
before(setupWorkspace);
after(cleanupWorkspace);
afterEach(() => __awaiter(void 0, void 0, void 0, function* () {
    if (watcher) {
        yield watcher.stop();
        watcher = null;
    }
}));
describe('FileWatcher', () => {
    describe('Initialization', () => {
        it('db entry should exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files } = yield setupInstances();
            const entry = files.find(1);
            chai.assert.exists(entry);
            chai.assert.isTrue(entry === null || entry === void 0 ? void 0 : entry.watcherSynced);
            chai.assert.equal(entry === null || entry === void 0 ? void 0 : entry.localChange, 'no');
            chai.assert.equal(entry === null || entry === void 0 ? void 0 : entry.remoteChange, 'no');
        }));
        it('db entry should be created if not exists', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files } = yield setupInstances({ noDBEntry: true });
            const entry = files.find(1);
            chai.assert.exists(entry);
            chai.assert.isTrue(entry === null || entry === void 0 ? void 0 : entry.watcherSynced);
            chai.assert.equal(entry === null || entry === void 0 ? void 0 : entry.localChange, 'create');
            chai.assert.equal(entry === null || entry === void 0 ? void 0 : entry.remoteChange, 'no');
        }));
        it('db entry should be checked as deleted if the file does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files } = yield setupInstances({ deletedFileDBEntry: true });
            const entry = files.find(2);
            chai.assert.exists(entry);
            chai.assert.isTrue(entry === null || entry === void 0 ? void 0 : entry.watcherSynced);
            chai.assert.equal(entry === null || entry === void 0 ? void 0 : entry.localChange, 'delete');
            chai.assert.equal(entry === null || entry === void 0 ? void 0 : entry.remoteChange, 'no');
        }));
    });
    describe('Create', () => {
        it('localChange should be "create"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'new_file.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'create');
            yield fs.remove(filePath);
        }));
        it('file that matches the ignore pattern with wildcard should be ignored', () => __awaiter(void 0, void 0, void 0, function* () {
            const { changedSpy } = yield setupInstances();
            const relativePath = '.env';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield tool.sleep(1000);
            chai.assert.isTrue(changedSpy.notCalled);
            yield fs.remove(filePath);
        }));
        it('file that matches the ignore pattern without wildcard should be ignored', () => __awaiter(void 0, void 0, void 0, function* () {
            const { changedSpy } = yield setupInstances();
            const relativePath = 'ignore_file';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield tool.sleep(1000);
            chai.assert.isTrue(changedSpy.notCalled);
            yield fs.remove(filePath);
        }));
    });
    describe('Update', () => {
        it('localChange should be "update"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'main.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.writeFile(filePath, 'updated content');
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'update');
        }));
    });
    describe('Delete', () => {
        it('localChange should be "delete"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'main.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.remove(filePath);
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'delete');
            yield fs.createFile(filePath);
            // await awaitChangeDetection();
        }));
    });
    describe('Create and Update', () => {
        it('localChange should be "create"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'new_file.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.writeFile(filePath, 'updated content');
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'create');
            yield fs.remove(filePath);
        }));
    });
    describe('Create and Update and Delete', () => {
        it('the file should not exist', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'new_file.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.writeFile(filePath, 'updated content');
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.remove(filePath);
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.isNull(file);
        }));
    });
    describe('Delete and recreate', () => {
        it('localChange should be "update"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'main.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.remove(filePath);
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'update');
        }));
    });
    describe('Update, delete and recreate', () => {
        it('localChange should be "update"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'main.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.writeFile(filePath, 'update content');
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.remove(filePath);
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'update');
        }));
    });
    describe('Create, delete and recreate', () => {
        it('localChange should be "create"', () => __awaiter(void 0, void 0, void 0, function* () {
            const { files, awaitChangeDetection } = yield setupInstances();
            const relativePath = 'new_file.tex';
            const filePath = path.resolve(workspacePath, relativePath);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.remove(filePath);
            yield awaitChangeDetection();
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            fs.createFile(filePath);
            yield awaitChangeDetection();
            const file = files.findBy('relativePath', relativePath);
            chai.assert.strictEqual(file && file.localChange, 'create');
        }));
    });
});
//# sourceMappingURL=fileWatcher.test.js.map