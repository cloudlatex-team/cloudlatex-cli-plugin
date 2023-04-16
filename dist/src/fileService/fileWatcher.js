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
exports.FileWatcher = void 0;
const chokidar = require("chokidar");
const EventEmitter = require("eventemitter3");
const logger_1 = require("../util/logger");
const anymatch_1 = require("anymatch");
const filePath_1 = require("./filePath");
class FileWatcher extends EventEmitter {
    constructor(config, fileRepo, options) {
        super();
        this.config = config;
        this.fileRepo = fileRepo;
        this.initialized = false;
        if (options === null || options === void 0 ? void 0 : options.ignored) {
            this.ignored = options.ignored;
        }
        this.logger = (options === null || options === void 0 ? void 0 : options.logger) || new logger_1.Logger();
    }
    init() {
        this.initialized = false;
        /**
         * Initialize file entries
         */
        this.fileRepo.all().forEach(file => {
            /**
            * Remove entries of ignore files from file db
            */
            if (filePath_1.checkIgnoredByFileInfo(this.config, file, this.ignored || [])) {
                this.logger.info(`Remove entry [${file.relativePath}] from file db`);
                this.fileRepo.delete(file.id);
                return;
            }
            /**
             * Initialize file entry property
             */
            file.watcherSynced = false;
            file.remoteChange = 'no';
        });
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.fileRepo.save();
        const watcherOption = {
            ignored: this.ignored,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        };
        const fileWatcher = this.fileWatcher = chokidar.watch(this.config.rootPath, watcherOption);
        fileWatcher.on('add', (absPath) => this.onFileCreated(filePath_1.toPosixPath(absPath), false));
        fileWatcher.on('addDir', (absPath) => this.onFileCreated(filePath_1.toPosixPath(absPath), true));
        fileWatcher.on('change', (absPath) => this.onFileChanged(filePath_1.toPosixPath(absPath)));
        fileWatcher.on('unlink', (absPath) => this.onFileDeleted(filePath_1.toPosixPath(absPath)));
        fileWatcher.on('unlinkDir', (absPath) => this.onFileDeleted(filePath_1.toPosixPath(absPath)));
        fileWatcher.on('error', (err) => this.onWatchingError(err));
        return new Promise((resolve) => {
            fileWatcher.on('ready', () => {
                this.logger.log('On chokidar ready event');
                // Handle the entry which watcherSynced is false as deleted file
                const notFoundFiles = this.fileRepo.where({ watcherSynced: false });
                notFoundFiles.forEach(notFound => {
                    notFound.watcherSynced = true;
                    notFound.localChange = 'delete';
                });
                this.initialized = true;
                resolve();
                // Emit change if needed
                const changedFiles = this.fileRepo.all().filter(file => file.localChange !== 'no' || file.remoteChange !== 'no');
                if (changedFiles.length) {
                    this.logger.info(`Found changed files after initialization: ${JSON.stringify(changedFiles.map(file => ({
                        path: file.relativePath,
                        localChange: file.localChange,
                    })))}`);
                    this.emitChange();
                }
            });
        });
    }
    onFileCreated(absPath, isFolder = false) {
        if (this.ignored && anymatch_1.default(this.ignored, absPath)) {
            return;
        }
        const relativePath = this.getRelativePath(absPath);
        if (relativePath === '') { // Ignore root entry
            return;
        }
        let file = this.fileRepo.findBy('relativePath', relativePath);
        if (file) {
            if (!file.watcherSynced) {
                // this file is downloaded from remote or detected on initialization
                file.watcherSynced = true;
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                return;
            }
            if (file.localChange === 'delete') {
                // The same named file is deleted and recreated.
                file.localChange = 'update';
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                this.emitChange();
                return;
            }
            const msg = `New ${isFolder ? 'folder' : 'file'} detected, but already registered.: ${absPath}`;
            this.logger.error(msg);
            this.emit('error', msg);
            return;
        }
        this.logger.log(`New ${isFolder ? 'folder' : 'file'} detected: ${absPath}`);
        file = this.fileRepo.new({
            relativePath,
            localChange: 'create',
            changeLocation: 'local',
            watcherSynced: true,
            isFolder
        });
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.fileRepo.save();
        this.emitChange();
    }
    onFileChanged(absPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ignored && anymatch_1.default(this.ignored, absPath)) {
                return;
            }
            const relativePath = this.getRelativePath(absPath);
            const changedFile = this.fileRepo.findBy('relativePath', relativePath);
            if (!changedFile) {
                const msg = `Local-changed-error: The fileInfo is not found at onFileChanged: ${absPath}`;
                this.logger.error(msg);
                this.emit('error', msg);
                return;
            }
            // file was changed by downloading
            if (!changedFile.watcherSynced) {
                changedFile.watcherSynced = true;
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                return;
            }
            if (changedFile.localChange !== 'create') {
                changedFile.localChange = 'update';
            }
            this.logger.log(`Update of ${changedFile.isFolder ? 'folder' : 'file'} detected: ${absPath}`);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
            this.emitChange();
        });
    }
    onFileDeleted(absPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ignored && anymatch_1.default(this.ignored, absPath)) {
                return;
            }
            const relativePath = this.getRelativePath(absPath);
            const file = this.fileRepo.findBy('relativePath', relativePath);
            if (!file) {
                const msg = `Local-changed-error: The fileInfo is not found at onFileDeleted: ${absPath}`;
                this.logger.error(msg);
                this.emit('error', msg);
                return;
            }
            // The file was deleted by deleteLocal() because remote file is deleted.
            if (!file.watcherSynced) {
                this.fileRepo.delete(file.id);
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                return;
            }
            this.logger.log(`Delete of ${file.isFolder ? 'folder' : 'file'} detected: ${absPath}`);
            if (file.localChange === 'create') {
                this.fileRepo.delete(file.id);
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.fileRepo.save();
                this.emit('change-detected');
                return;
            }
            file.localChange = 'delete';
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.fileRepo.save();
            this.emitChange();
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        else {
            this.logger.error('OnWatchingError', err);
            this.emit('error', err.toString());
        }
    }
    emitChange() {
        if (this.initialized) {
            this.emit('change-detected');
        }
    }
    getRelativePath(absPath) {
        return filePath_1.toRelativePath(this.config, absPath);
    }
    stop() {
        this.logger.log('Stop watching file system', this.config.rootPath);
        return this.fileWatcher ? this.fileWatcher.close() : Promise.resolve();
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map