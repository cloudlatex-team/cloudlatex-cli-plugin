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
exports.BackendStub = void 0;
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("../../src/model/fileModel");
const uuid_1 = require("uuid");
const stream_1 = require("../../src/util/stream");
/*
 * BackendMock Class
 *
 * [Warn]
 *  file.id in remoteFiles is not equal to file.id in local files.
 */
class BackendStub {
    constructor() {
        this.isOffline = false;
        this.remoteContents = {};
        const remotedb = new type_db_1.TypeDB();
        this.remoteFiles = remotedb.getRepository(fileModel_1.FILE_INFO_DESC);
    }
    validateToken() {
        return Promise.resolve(true);
    }
    loadProjectList() {
        if (this.isOffline) {
            return Promise.reject('Network error on loadProjectList');
        }
        return Promise.resolve([]);
    }
    loadProjectInfo() {
        if (this.isOffline) {
            return Promise.reject('Network error on loadProjectInfo');
        }
        return Promise.resolve({
            id: 1,
            compileTargetFileRemoteId: 1,
            title: '',
        });
    }
    updateProjectInfo() {
        if (this.isOffline) {
            return Promise.reject('Network error on updateProjectInfo');
        }
        return Promise.resolve({});
    }
    loadFileList() {
        if (this.isOffline) {
            return Promise.reject('Network error on loadFileList');
        }
        return Promise.resolve(this.remoteFiles.all());
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    upload(file, stream, option) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject('Network error on upload');
            }
            if (file.isFolder) {
                throw new Error('Folder cannot be uploaded');
            }
            const newFile = this.remoteFiles.new(Object.assign({}, file));
            newFile.id = -1; // reset local id
            const remoteId = newFile.remoteId = uuid_1.v4();
            const remoteRevision = newFile.remoteRevision = uuid_1.v4();
            this.remoteContents[remoteId] = yield stream_1.streamToString(stream);
            return {
                remoteId,
                remoteRevision
            };
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    createRemote(file, parent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject('Network error on createRemote');
            }
            const newFile = this.remoteFiles.new(Object.assign({}, file));
            newFile.id = -1; // reset local id
            const remoteId = newFile.remoteId = uuid_1.v4();
            const remoteRevision = newFile.remoteRevision = uuid_1.v4();
            return {
                remoteId,
                remoteRevision
            };
        });
    }
    download(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject('Network error on download');
            }
            const remoteFile = this.remoteFiles.findBy('remoteId', file.remoteId);
            if (!remoteFile) {
                throw new Error('remoteFile is null');
            }
            if (remoteFile.remoteId === null) {
                throw new Error('remoteId is null');
            }
            if (!(remoteFile.remoteId in this.remoteContents)) {
                throw new Error('remote content is not found');
            }
            if (file.isFolder) {
                throw new Error('Folder cannot be downloaded');
            }
            return new stream_1.ReadableString(this.remoteContents[remoteFile.remoteId]);
        });
    }
    updateRemote(file, stream) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject('Network error on updateRemote');
            }
            const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
            if (!targetFile || !targetFile.remoteId) {
                throw new Error('No update target file or no remote id');
            }
            this.remoteContents[targetFile.remoteId] = yield stream_1.streamToString(stream);
            return targetFile.remoteRevision = uuid_1.v4();
        });
    }
    deleteRemote(file) {
        if (this.isOffline) {
            return Promise.reject('Network error on deleteRemote');
        }
        const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
        if (!targetFile) {
            throw new Error('No delete target file');
        }
        this.remoteFiles.delete(targetFile.id);
        delete this.remoteContents[targetFile.id];
        return Promise.resolve();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compileProject() {
        if (this.isOffline) {
            return Promise.reject('Network error on compileProject');
        }
        return Promise.resolve();
    }
    /*
     * File operation methods for test situations
     */
    _createInRemote(fileInfo, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const isOffline = this.isOffline;
            this.isOffline = false;
            if (fileInfo.isFolder) {
                yield this.createRemote(fileInfo, null);
            }
            else {
                yield this.upload(fileInfo, new stream_1.ReadableString(content));
            }
            this.isOffline = isOffline;
        });
    }
    _updateInRemote(fileInfo, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const isOffline = this.isOffline;
            this.isOffline = false;
            const remoteFiles = this.remoteFiles.where(fileInfo);
            if (!remoteFiles || remoteFiles.length !== 1) {
                throw new Error('Remote file is not found');
            }
            yield this.updateRemote(remoteFiles[0], new stream_1.ReadableString(content));
            this.isOffline = isOffline;
        });
    }
    _deleteInRemote(fileInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const isOffline = this.isOffline;
            this.isOffline = false;
            const remoteFiles = this.remoteFiles.where(fileInfo);
            if (!remoteFiles || remoteFiles.length !== 1) {
                throw new Error('Remote file is not found');
            }
            yield this.deleteRemote(remoteFiles[0]);
            this.isOffline = isOffline;
            return Promise.resolve();
        });
    }
    _renameInRemote(fileInfo, newRelativePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const remoteFiles = this.remoteFiles.where(fileInfo);
            if (!remoteFiles || remoteFiles.length !== 1) {
                throw new Error('Remote file is not found');
            }
            remoteFiles[0].relativePath = newRelativePath;
            return Promise.resolve();
        });
    }
}
exports.BackendStub = BackendStub;
//# sourceMappingURL=backendStub.js.map