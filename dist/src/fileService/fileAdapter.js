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
exports.FileAdapter = void 0;
const fs = require("fs");
const path = require("path");
/**
 * FileAdapter class
 *
 * Provide operations of remote and local files
 * The file path is expressed with `path.posix.sep` internally
 * and only convert native path (`path.sep`) when this class operates local file.
 */
class FileAdapter {
    constructor(rootPath, fileRepo, backend) {
        this.rootPath = rootPath;
        this.fileRepo = fileRepo;
        this.backend = backend;
    }
    loadFileList() {
        return this.backend.loadFileList();
    }
    download(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = yield this.backend.download(file);
            file.watcherSynced = false;
            try {
                yield this.saveAs(file.relativePath, stream);
            }
            catch (e) {
                file.watcherSynced = true;
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                throw e;
            }
            file.localChange = 'no';
            file.localRevision = file.remoteRevision;
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
        });
    }
    saveAs(filePath, stream) {
        return __awaiter(this, void 0, void 0, function* () {
            const absPath = path.isAbsolute(filePath) ? filePath : path.posix.join(this.rootPath, filePath);
            const dirname = path.posix.dirname(absPath);
            if (dirname !== this.rootPath) {
                try {
                    yield fs.promises.mkdir(dirname.replace(new RegExp(path.posix.sep, 'g'), path.sep));
                }
                catch (err) {
                    // Already exists
                }
            }
            return yield new Promise((resolve, reject) => {
                const fileStream = fs.createWriteStream(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
                stream.pipe(fileStream);
                stream.on('error', (err) => {
                    reject(err);
                });
                fileStream.on('error', (err) => {
                    reject(err);
                });
                fileStream.on('finish', () => {
                    resolve();
                });
            });
        });
    }
    createLocalFolder(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const absPath = path.posix.join(this.rootPath, file.relativePath);
            try {
                yield fs.promises.mkdir(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
            }
            catch (err) {
                // Allow only the error that file is alraady exist.
                if (err.code !== 'EEXIST') {
                    throw err;
                }
            }
            file.localChange = 'no';
            file.localRevision = file.remoteRevision;
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
            return;
        });
    }
    createRemoteFolder(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const parent = this.fileRepo.findBy('relativePath', path.posix.dirname(file.relativePath));
            const { remoteId, remoteRevision } = yield this.backend.createRemote(file, parent);
            file.remoteId = remoteId;
            file.localRevision = remoteRevision;
            file.localChange = 'no';
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    upload(file, option) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = fs.createReadStream(path.posix.join(this.rootPath, file.relativePath).replace(new RegExp(path.posix.sep, 'g'), path.sep));
            const { remoteId, remoteRevision } = yield this.backend.upload(file, stream, option);
            file.remoteId = remoteId;
            file.localRevision = remoteRevision;
            file.localChange = 'no';
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
        });
    }
    updateRemote(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = fs.createReadStream(path.posix.join(this.rootPath, file.relativePath).replace(new RegExp(path.posix.sep, 'g'), path.sep));
            file.localRevision = yield this.backend.updateRemote(file, stream);
            file.localChange = 'no';
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
        });
    }
    deleteRemote(file) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.backend.deleteRemote(file);
            this.fileRepo.delete(file.id);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
        });
    }
    deleteLocal(file) {
        return __awaiter(this, void 0, void 0, function* () {
            file.watcherSynced = false;
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
            const absPath = path.posix.join(this.rootPath, file.relativePath);
            if (file.isFolder) {
                try {
                    yield fs.promises.rmdir(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
                }
                catch (err) {
                    // Allow the error that file is already deleted
                    if (err.code !== 'ENOENT') {
                        throw err;
                    }
                }
                return;
            }
            try {
                yield fs.promises.unlink(absPath.replace(new RegExp(path.posix.sep, 'g'), path.sep));
            }
            catch (err) {
                file.watcherSynced = true;
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                // Allow the error that file is already deleted
                if (err.code !== 'ENOENT') {
                    throw err;
                }
            }
        });
    }
}
exports.FileAdapter = FileAdapter;
//# sourceMappingURL=fileAdapter.js.map