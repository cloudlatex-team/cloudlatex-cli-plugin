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
            ignored: /\.git|\.cloudlatex\.json|synctex\.gz|\.vscode(\\|\/|$)|.DS\_Store/,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        };
        const fileWatcher = this.fileWatcher = chokidar.watch(this.rootPath, watcherOption);
        return new Promise((resolve, reject) => {
            // TODO detect changes before running
            fileWatcher.on('ready', () => {
                this.logger.log('On chokidar ready event');
                fileWatcher.on('add', (absPath) => this.onFileCreated(absPath.replace(/\\/g, path.posix.sep), false));
                fileWatcher.on('addDir', (absPath) => this.onFileCreated(absPath.replace(/\\/g, path.posix.sep), true));
                fileWatcher.on('change', (absPath) => this.onFileChanged(absPath.replace(/\\/g, path.posix.sep)));
                fileWatcher.on('unlink', (absPath) => this.onFileDeleted(absPath.replace(/\\/g, path.posix.sep)));
                fileWatcher.on('unlinkDir', (absPath) => this.onFileDeleted(absPath.replace(/\\/g, path.posix.sep)));
                fileWatcher.on('error', (err) => this.onWatchingError(err));
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
        this.logger.log(`New ${isFolder ? 'folder' : 'file'} detected: ${absPath}`);
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
                this.logger.error(`Local-changed-error: The fileInfo is not found at onFileChanged: ${absPath}`);
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
            this.logger.log(`Update of ${changedFile.isFolder ? 'folder' : 'file'} detected: ${absPath}`);
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
                this.logger.error(`Local-changed-error: The fileInfo is not found at onFileDeleted: ${absPath}`);
                return;
            }
            // The file was deleted by deleteLocal() because remote file is deleted.
            if (!file.watcherSynced) {
                this.fileRepo.delete(file.id);
                this.fileRepo.save();
                return;
            }
            this.logger.log(`Delete of ${file.isFolder ? 'folder' : 'file'} detected: ${absPath}`);
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
        if (process.platform === 'win32' && err['errno'] === -4048 && err['code'] === 'EPERM') {
            /**
             * Ignore permission error on windows
             *
             * https://github.com/nodejs/node/issues/31702
             * https://github.com/paulmillr/chokidar/issues/566
             */
            //
            this.logger.log('Ignore permission error', err);
            return;
        }
        {
            this.logger.error('OnWatchingError', err);
        }
    }
    getRelativePath(absPath) {
        return path.posix.relative(this.rootPath, absPath);
    }
    stop() {
        this.logger.log('Stop watching file system', this.rootPath);
        return this.fileWatcher ? this.fileWatcher.close() : Promise.resolve();
    }
}
exports.default = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map