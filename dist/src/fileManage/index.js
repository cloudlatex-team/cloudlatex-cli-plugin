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
const type_db_1 = require("type-db");
const path = require("path");
const backendSelector_1 = require("./../backend/backendSelector");
const fileModel_1 = require("./../model/fileModel");
const fileWatcher_1 = require("./fileWatcher");
const syncManager_1 = require("./syncManager");
const FileAdapter_1 = require("./FileAdapter");
const EventEmitter = require("eventemitter3");
/*
 * File management class
 *
 * Instantiate fileAdapter, fileWatcher and syncManager.
 * The fileWatcher detects local changes.
 * The syncManager synchronize local files with remote ones.
 * The file Adapter abstructs file operations of local files and remote ones.
 */
class FileManager extends EventEmitter {
    constructor(config, decideSyncMode, fileFilter, logger) {
        super();
        this.config = config;
        this.decideSyncMode = decideSyncMode;
        this.fileFilter = fileFilter;
        this.logger = logger;
        this.backend = backendSelector_1.default(config);
    }
    get fileAdapter() {
        return this._fileAdapter;
    }
    get fileRepo() {
        return this._fileRepo;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            // DB
            const dbFilePath = path.join(this.config.rootPath, `.${this.config.backend}.json`);
            const db = new type_db_1.TypeDB(dbFilePath);
            try {
                yield db.load();
            }
            catch (err) {
                // Not initialized because there is no db file.
            }
            this._fileRepo = db.getRepository(fileModel_1.FileInfoDesc);
            this._fileRepo.all().forEach(file => {
                file.watcherSynced = true;
            });
            this._fileRepo.save();
            this._fileAdapter = new FileAdapter_1.default(this.config.rootPath, this._fileRepo, this.backend, this.logger);
            // Sync Manager
            this.syncManager = new syncManager_1.default(this._fileRepo, this._fileAdapter, this.decideSyncMode, this.logger);
            // File watcher
            const fileWatcher = new fileWatcher_1.default(this.config.rootPath, this._fileRepo, this.fileFilter, this.logger);
            yield fileWatcher.init();
            fileWatcher.on('change-detected', () => {
                this.startSync();
            });
        });
    }
    startSync() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.backend.validateToken();
                if (!result) {
                    this.logger.error('Your account is invalid.');
                    return;
                }
                this.emit('online');
            }
            catch (err) {
                this.emit('offline');
                return;
            }
            const result = yield this.syncManager.syncSession();
            if (result.success) {
                this.emit('successfully-synced');
                if (result.fileChanged) {
                    this.emit('request-autobuild');
                }
            }
        });
    }
}
exports.default = FileManager;
//# sourceMappingURL=index.js.map