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
exports.ClBackend = void 0;
const path = require("path");
const url = require("url");
const pako = require("pako");
const text_encoding_1 = require("text-encoding");
const webAppApi_1 = require("./webAppApi");
const stream_1 = require("../../util/stream");
class ClBackend {
    constructor(config, accountService) {
        this.config = config;
        this.api = new webAppApi_1.CLWebAppApi(config, accountService);
    }
    validateToken() {
        return this.api.validateToken();
    }
    download(file) {
        /*
         * url of some files such as pdf begins with '/'
         *    like '/projects/180901/files/1811770/preview'
         */
        if (file.url[0] === '/') {
            const fileUrl = url.resolve(url.resolve(this.config.endpoint, '..'), file.url);
            return this.api.downdloadPreview(fileUrl);
        }
        return this.api.download(file.url);
    }
    upload(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    file, stream, option) {
        return __awaiter(this, void 0, void 0, function* () {
            let relativeDir = path.posix.dirname(file.relativePath);
            if (relativeDir.length > 1 && relativeDir[0] === '/') {
                relativeDir = relativeDir.slice(1);
            }
            if (relativeDir === '.') {
                relativeDir = '';
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = yield this.api.uploadFile(stream, relativeDir);
            return { remoteId: result.file.id, remoteRevision: result.file.revision };
        });
    }
    createRemote(file, parent) {
        return __awaiter(this, void 0, void 0, function* () {
            const belongs = parent && Number(parent.remoteId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = yield this.api.createFile(path.posix.basename(file.relativePath), belongs, file.isFolder);
            return { remoteId: result.file.id, remoteRevision: result.file.revision };
        });
    }
    updateRemote(file, stream) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield stream_1.streamToString(stream);
            const result = yield this.api.updateFile(file.remoteId, {
                content,
                revision: file.remoteRevision
            });
            return result.revision;
        });
    }
    deleteRemote(file) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.api.deleteFile(file.remoteId);
        });
    }
    loadProjectInfo() {
        return this.api.loadProjectInfo();
    }
    loadFileList() {
        return __awaiter(this, void 0, void 0, function* () {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const res = yield this.api.loadFiles();
            const materialFiles = res.material_files;
            return materialFiles.map(materialFile => {
                return {
                    id: -1,
                    isFolder: !!materialFile.is_folder,
                    relativePath: String(materialFile.full_path),
                    url: String(materialFile.file_url),
                    remoteRevision: materialFile.revision,
                    localRevision: materialFile.revision,
                    localChange: 'no',
                    remoteChange: 'no',
                    changeLocation: 'no',
                    remoteId: Number(materialFile.id),
                    watcherSynced: false
                };
            });
        });
    }
    loadSynctexObject(url) {
        return this.api.loadSynctexObject(url);
    }
    compileProject() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.api.compileProject();
            const exitCode = Number(result.exit_code);
            const logStream = new stream_1.ReadableString(result.log);
            const logs = [...result.errors.map(err => ({
                    line: err.line || 1,
                    message: err.error_log,
                    type: 'error',
                    file: path.posix.join(this.config.rootPath, err.filename || '')
                })), ...result.warnings.map(warn => ({
                    line: warn.line || 1,
                    message: warn.warning_log,
                    type: 'warning',
                    file: path.posix.join(this.config.rootPath, warn.filename || '')
                }))];
            if (exitCode !== 0) {
                return {
                    status: 'compiler-error',
                    logStream,
                    logs
                };
            }
            // pdf
            const pdfStream = yield this.api.download(result.uri);
            // download synctex
            const compressed = yield this.loadSynctexObject(result.synctex_uri);
            const decompressed = pako.inflate(new Uint8Array(compressed));
            let synctexStr = new text_encoding_1.TextDecoder('utf-8').decode(decompressed);
            synctexStr = synctexStr.replace(/\/data\/\./g, this.config.rootPath);
            const synctexStream = new stream_1.ReadableString(synctexStr);
            return {
                status: 'success',
                logStream,
                logs,
                pdfStream,
                synctexStream
            };
        });
    }
}
exports.ClBackend = ClBackend;
//# sourceMappingURL=clBackend.js.map