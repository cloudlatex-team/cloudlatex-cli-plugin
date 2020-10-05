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
const fixturePath = path.resolve(__dirname, './../fixture');
const workspacePath = path.resolve(__dirname, './../workspace');
const setupWorkspace = () => __awaiter(void 0, void 0, void 0, function* () {
    yield fs.copy(fixturePath, workspacePath);
    yield tool.sleep(1000);
});
const cleanupWorkspace = () => __awaiter(void 0, void 0, void 0, function* () {
    yield fs.remove(workspacePath);
});
let watcher;
const setupInstances = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = new type_db_1.TypeDB();
    const files = db.getRepository(fileModel_1.FileInfoDesc);
    files.new({ relativePath: 'main.tex', watcherSynced: true });
    watcher = new fileWatcher_1.default(workspacePath, files, () => true, new logger_1.default('warn'));
    const changedSpy = Sinon.spy();
    const awaitChangeDetection = () => {
        return new Promise((resolve, reject) => {
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
afterEach(() => {
    if (watcher) {
        watcher.unwatch();
        watcher = null;
    }
});
describe('Create', () => {
    it('localChange should be "create"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'new_file.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.createFile(filePath);
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'create');
        yield fs.remove(filePath);
    }));
});
describe('Update', () => {
    it('localChange should be "update"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'main.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.writeFile(filePath, 'updated content');
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'update');
    }));
});
describe('Delete', () => {
    it('localChange should be "delete"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'main.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.remove(filePath);
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'delete');
        fs.createFile(filePath);
        // await awaitChangeDetection();
    }));
});
describe('Create and Update', () => {
    it('localChange should be "create"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'new_file.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.createFile(filePath);
        yield awaitChangeDetection();
        fs.writeFile(filePath, 'updated content');
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'create');
        yield fs.remove(filePath);
    }));
});
describe('Create and Update and Delete', () => {
    it('the file should not exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'new_file.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.createFile(filePath);
        yield awaitChangeDetection();
        fs.writeFile(filePath, 'updated content');
        yield awaitChangeDetection();
        fs.remove(filePath);
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.isNull(file);
    }));
});
describe('Delete and recreate', () => {
    it('localChange should be "update"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'main.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.remove(filePath);
        yield awaitChangeDetection();
        fs.createFile(filePath);
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'update');
    }));
});
describe('Update, delete and recreate', () => {
    it('localChange should be "update"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'main.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.writeFile(filePath, 'update content');
        yield awaitChangeDetection();
        fs.remove(filePath);
        yield awaitChangeDetection();
        fs.createFile(filePath);
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'update');
    }));
});
describe('Create, delete and recreate', () => {
    it('localChange should be "create"', () => __awaiter(void 0, void 0, void 0, function* () {
        const { watcher, files, awaitChangeDetection } = yield setupInstances();
        const relativePath = 'new_file.tex';
        const filePath = path.resolve(workspacePath, relativePath);
        fs.createFile(filePath);
        yield awaitChangeDetection();
        fs.remove(filePath);
        yield awaitChangeDetection();
        fs.createFile(filePath);
        yield awaitChangeDetection();
        const file = files.findBy('relativePath', relativePath);
        chai.assert.strictEqual(file && file.localChange, 'create');
    }));
});
//# sourceMappingURL=fileWatcher.test.js.map