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
const backend_1 = require("../../src/backend/backend");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("../../src/model/fileModel");
const uuid_1 = require("uuid");
const util_1 = require("./../../src/util");
/*
 * BackendMock Class
 *
 * [Warn]
 *  file.id in remoteFiles is not equal to file.id in local files.
 */
class BackendStub extends backend_1.default {
    constructor() {
        super({}, {});
        this.isOffline = false;
        this.remoteContents = {};
        const remotedb = new type_db_1.TypeDB();
        this.remoteFiles = remotedb.getRepository(fileModel_1.FileInfoDesc);
    }
    loadProjectInfo() {
        if (this.isOffline) {
            return Promise.reject();
        }
        return Promise.resolve({
            id: 1,
            compile_target_file_id: 1,
            title: '',
        });
    }
    loadFileList() {
        if (this.isOffline) {
            return Promise.reject();
        }
        return Promise.resolve(this.remoteFiles.all());
    }
    upload(file, stream, option) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject();
            }
            const newFile = this.remoteFiles.new(Object.assign({}, file));
            newFile.id = -1; // reset local id
            const remoteId = newFile.remoteId = uuid_1.v4();
            const remoteRevision = newFile.remoteRevision = uuid_1.v4();
            this.remoteContents[remoteId] = yield util_1.streamToString(stream);
            return {
                remoteId,
                remoteRevision
            };
        });
    }
    createRemote(file, parent) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject('offline');
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
                return Promise.reject();
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
            return new util_1.ReadableString(this.remoteContents[remoteFile.remoteId]);
        });
    }
    updateRemote(file, stream) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isOffline) {
                return Promise.reject();
            }
            const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
            if (!targetFile || !targetFile.remoteId) {
                throw new Error('No update target file or no remote id');
            }
            this.remoteContents[targetFile.remoteId] = yield util_1.streamToString(stream);
            return targetFile.remoteRevision = uuid_1.v4();
        });
    }
    deleteRemote(file) {
        if (this.isOffline) {
            return Promise.reject();
        }
        const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
        if (!targetFile) {
            throw new Error('No delete target file');
        }
        this.remoteFiles.delete(targetFile.id);
        delete this.remoteContents[targetFile.id];
        return Promise.resolve();
    }
    compileProject() {
        if (this.isOffline) {
            return Promise.reject();
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
            yield this.upload(fileInfo, new util_1.ReadableString(content));
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
            yield this.updateRemote(remoteFiles[0], new util_1.ReadableString(content));
            this.isOffline = isOffline;
        });
    }
    _deleteInRemote(fileInfo) {
        const isOffline = this.isOffline;
        this.isOffline = false;
        const remoteFiles = this.remoteFiles.where(fileInfo);
        if (!remoteFiles || remoteFiles.length !== 1) {
            throw new Error('Remote file is not found');
        }
        this.deleteRemote(remoteFiles[0]);
        this.isOffline = isOffline;
        return Promise.resolve();
    }
}
exports.default = BackendStub;
//# sourceMappingURL=backendStub.js.map