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
const chokidar = require("chokidar");
const path = require("path");
const EventEmitter = require("eventemitter3");
const logger_1 = require("../util/logger");
class FileWatcher extends EventEmitter {
    constructor(rootPath, fileRepo, watcherFileFilter = (_) => true, logger = new logger_1.default()) {
        super();
        this.rootPath = rootPath;
        this.fileRepo = fileRepo;
        this.watcherFileFilter = watcherFileFilter;
        this.logger = logger;
    }
    init() {
        const watcherOption = {
            ignored: /\.git|\.cloudlatex\.json|synctex\.gz|\.vscode|.DS\_Store/,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        };
        const fileWatcher = this.fileWatcher = chokidar.watch(this.rootPath, watcherOption);
        return new Promise((resolve, reject) => {
            // TODO detect changes before running
            fileWatcher.on('ready', () => {
                fileWatcher.on('add', (absPath) => this.onFileCreated(absPath, false));
                fileWatcher.on('addDir', (absPath) => this.onFileCreated(absPath, true));
                fileWatcher.on('change', this.onFileChanged.bind(this));
                fileWatcher.on('unlink', this.onFileDeleted.bind(this));
                fileWatcher.on('unlinkDir', this.onFileDeleted.bind(this));
                fileWatcher.on('error', this.onWatchingError.bind(this));
                resolve();
            });
        });
    }
    onFileCreated(absPath, isFolder = false) {
        const relativePath = this.getRelativePath(absPath);
        if (!this.watcherFileFilter(relativePath)) {
            return;
        }
        let file = this.fileRepo.findBy('relativePath', relativePath);
        if (file) {
            if (!file.watcherSynced) {
                // this file is downloaded from remote
                file.watcherSynced = true;
                this.fileRepo.save();
                return;
            }
            if (file.localChange === 'delete') {
                // The same named file is deleted and recreated.
                file.localChange = 'update';
                this.fileRepo.save();
                this.emit('change-detected');
                return;
            }
            return this.logger.error(`New ${isFolder ? 'folder' : 'file'} detected, but already registered.: ${absPath}`);
        }
        this.logger.log(`new ${isFolder ? 'folder' : 'file'} detected: ${absPath}`);
        file = this.fileRepo.new({
            relativePath,
            localChange: 'create',
            changeLocation: 'local',
            watcherSynced: true,
            isFolder
        });
        this.fileRepo.save();
        this.emit('change-detected');
    }
    onFileChanged(absPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const relativePath = this.getRelativePath(absPath);
            if (!this.watcherFileFilter(relativePath)) {
                return;
            }
            const changedFile = this.fileRepo.findBy('relativePath', relativePath);
            if (!changedFile) {
                this.logger.error(`local-changed-error: The fileInfo is not found at onFileChanged: ${absPath}`);
                return;
            }
            // file was changed by downloading
            if (!changedFile.watcherSynced) {
                changedFile.watcherSynced = true;
                this.fileRepo.save();
                return;
            }
            if (changedFile.localChange !== 'create') {
                changedFile.localChange = 'update';
            }
            this.logger.log(`update of ${changedFile.isFolder ? 'folder' : 'file'} detected: ${absPath}`);
            this.fileRepo.save();
            this.emit('change-detected');
        });
    }
    onFileDeleted(absPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const relativePath = this.getRelativePath(absPath);
            if (!this.watcherFileFilter(relativePath)) {
                return;
            }
            const file = this.fileRepo.findBy('relativePath', relativePath);
            if (!file) {
                this.logger.error(`local-changed-error: The fileInfo is not found at onFileDeleted: ${absPath}`);
                return;
            }
            // The file was deleted by deleteLocal() because remote file is deleted.
            if (!file.watcherSynced) {
                this.fileRepo.delete(file.id);
                this.fileRepo.save();
                return;
            }
            this.logger.log(`delete of ${file.isFolder ? 'folder' : 'file'} detected: ${absPath}`);
            if (file.localChange === 'create') {
                this.fileRepo.delete(file.id);
                this.fileRepo.save();
                this.emit('change-detected');
                return;
            }
            file.localChange = 'delete';
            this.fileRepo.save();
            this.emit('change-detected');
        });
    }
    onWatchingError(err) {
        this.logger.error('onWatchingError', err);
    }
    getRelativePath(absPath) {
        return path.relative(this.rootPath, absPath);
    }
    unwatch() {
        var _a;
        (_a = this.fileWatcher) === null || _a === void 0 ? void 0 : _a.unwatch(this.rootPath);
    }
}
exports.default = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map