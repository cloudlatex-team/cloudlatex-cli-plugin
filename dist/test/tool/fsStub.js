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
/* eslint-disable @typescript-eslint/no-explicit-any */
const Sinon = require("sinon");
const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");
const mockFs = require("mock-fs");
function fsStub(files) {
    mockFs(files);
    let watcher;
    const originalChokidarWatch = chokidar.watch;
    const originalCreateWriteStream = fs.createWriteStream;
    const originalWriteFile = fs.promises.writeFile;
    const originalMkdir = fs.promises.mkdir;
    const originalUnlink = fs.promises.unlink;
    const originalRmdir = fs.promises.rmdir;
    const originalRename = fs.promises.rename;
    Sinon.stub(fs, 'createWriteStream').callsFake((path, options) => {
        const stream = originalCreateWriteStream(path, options);
        const statPromise = fs.promises.stat(path);
        stream.on('finish', () => {
            statPromise.then(() => {
                watcher.emit('change', path);
            }).catch(() => {
                watcher.emit('add', path);
            });
        });
        return stream;
    });
    Sinon.stub(fs.promises, 'writeFile').callsFake((path, data, options) => (fs.promises.stat(path).then(() => (originalWriteFile(path, data, options).then(() => 'change'))).catch(() => (originalWriteFile(path, data, options).then(() => 'add'))).then(eventName => {
        watcher.emit(eventName, path);
    })));
    Sinon.stub(fs.promises, 'mkdir').callsFake((path, options) => (fs.promises.stat(path).then(() => {
        throw new Error(`EEXIST: file already exists, mkdir '${path}'`);
    }).catch(() => __awaiter(this, void 0, void 0, function* () {
        const str = yield originalMkdir(path, options);
        watcher.emit('addDir', path);
        return str;
    }))));
    Sinon.stub(fs.promises, 'unlink').callsFake((path) => (originalUnlink(path).then(() => {
        watcher.emit('unlink', path);
    })));
    Sinon.stub(fs.promises, 'rmdir').callsFake((path) => (originalRmdir(path).then(() => {
        watcher.emit('unlinkDir', path);
    })));
    Sinon.stub(fs.promises, 'rename').callsFake((oldPath, newPath) => __awaiter(this, void 0, void 0, function* () {
        function emitRenameFile(oldPath, newPath) {
            watcher.emit('unlink', oldPath);
            watcher.emit('add', newPath);
        }
        function emitRenameDir(oldPath, newPath) {
            watcher.emit('unlinkDir', oldPath);
            watcher.emit('addDir', newPath);
        }
        const isOldDir = (yield fs.promises.stat(oldPath)).isDirectory();
        if (!isOldDir) {
            yield originalRename(oldPath, newPath);
            emitRenameFile(oldPath, newPath);
            return;
        }
        const { files, dirs } = yield readDirRecursive(oldPath.toString());
        yield originalRename(oldPath, newPath);
        emitRenameDir(oldPath, newPath);
        files.forEach(file => {
            emitRenameFile(path.posix.join(oldPath.toString(), file), path.posix.join(newPath.toString(), file));
        });
        dirs.forEach(dir => {
            emitRenameDir(path.posix.join(oldPath.toString(), dir), path.posix.join(newPath.toString(), dir));
        });
    }));
    Sinon.stub(chokidar, 'watch').callsFake((path, option) => {
        return watcher = originalChokidarWatch(path, option);
    });
}
fsStub.restore = function () {
    mockFs.restore();
    Sinon.restore();
};
exports.default = fsStub;
function readDirRecursive(root) {
    return __awaiter(this, void 0, void 0, function* () {
        const files = [];
        const dirs = [];
        const readDir = (dir) => __awaiter(this, void 0, void 0, function* () {
            const entries = yield fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    dirs.push(path.posix.relative(root, path.posix.join(dir, entry.name)));
                    yield readDir(path.posix.join(dir, entry.name));
                }
                else {
                    files.push(path.posix.relative(root, path.posix.join(dir, entry.name)));
                }
            }
        });
        yield readDir(root);
        return { files, dirs };
    });
}
//# sourceMappingURL=fsStub.js.map