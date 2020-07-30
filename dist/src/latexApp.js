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
const path = require("path");
const EventEmitter = require("eventemitter3");
const logger_1 = require("./logger");
const fileAdapter_1 = require("./fileManage/fileAdapter");
const syncManager_1 = require("./fileManage/syncManager");
const fileWatcher_1 = require("./fileManage/fileWatcher");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("./model/fileModel");
const backendSelector_1 = require("./backend/backendSelector");
const accountManager_1 = require("./accountManager");
// TODO delte db flle when the application is deactivated
class LatexApp extends EventEmitter {
    constructor(config, decideSyncMode, logger = new logger_1.default()) {
        super();
        this.decideSyncMode = decideSyncMode;
        this.logger = logger;
        this.account = null;
        this.config = Object.assign(Object.assign({}, config), { outDir: path.join(config.outDir) });
        this.appInfo = {
            offline: true,
            conflictFiles: []
        };
        this.accountManager = new accountManager_1.default(config.accountStorePath || '');
        this.backend = backendSelector_1.default(config, this.accountManager);
    }
    /**
     * setup file management classes
     *
     * Instantiate fileAdapter, fileWatcher and syncManager.
     * The fileWatcher detects local changes.
     * The syncManager synchronize local files with remote ones.
     * The file Adapter abstructs file operations of local files and remote ones.
     */
    launch() {
        return __awaiter(this, void 0, void 0, function* () {
            // Account
            yield this.accountManager.load();
            // DB
            const dbFilePath = path.join(this.config.storagePath, `.${this.config.backend}.json`);
            const db = new type_db_1.TypeDB(dbFilePath);
            try {
                yield db.load();
            }
            catch (err) {
                // Not initialized because there is no db file.
            }
            this.fileRepo = db.getRepository(fileModel_1.FileInfoDesc);
            this.fileRepo.all().forEach(file => {
                file.watcherSynced = true;
            });
            this.fileRepo.save();
            this.fileAdapter = new fileAdapter_1.default(this.config.rootPath, this.fileRepo, this.backend, this.logger);
            // Sync Manager
            this.syncManager = new syncManager_1.default(this.fileRepo, this.fileAdapter, (conflictFiles) => __awaiter(this, void 0, void 0, function* () {
                this.appInfo.conflictFiles = conflictFiles;
                return this.decideSyncMode(conflictFiles);
            }), this.logger);
            // File watcher
            this.fileWatcher = new fileWatcher_1.default(this.config.rootPath, this.fileRepo, relativePath => {
                if (!this.appInfo.projectName) {
                    return ![this.config.outDir].includes(relativePath);
                }
                return ![this.config.outDir, this.logPath, this.pdfPath, this.synctexPath].includes(relativePath);
            }, this.logger);
            yield this.fileWatcher.init();
            this.fileWatcher.on('change-detected', () => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.validateAccount();
                if (result === 'invalid') {
                    this.logger.error('Your account is invalid.');
                    return;
                }
                if (result === 'offline') {
                    return;
                }
                this.startSync();
            }));
        });
    }
    get targetName() {
        if (!this.appInfo.compileTarget) {
            this.logger.error('Project info is not defined');
            throw new Error('Project info is not defined');
        }
        const file = this.fileRepo.findBy('remoteId', this.appInfo.compileTarget);
        if (!file) {
            this.logger.error('Target file is not found');
            throw new Error('Target file is not found');
        }
        return path.basename(file.relativePath, '.tex');
    }
    get logPath() {
        return path.join(this.config.outDir, this.targetName + '.log');
    }
    get pdfPath() {
        return path.join(this.config.outDir, this.targetName + '.pdf');
    }
    get synctexPath() {
        return path.join(this.config.outDir, this.targetName + '.synctex');
    }
    onOnline() {
        this.appInfo.offline = false;
        this.emit('appinfo-updated');
    }
    onOffline() {
        if (this.appInfo.offline) {
            return;
        }
        this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
        this.appInfo.offline = true;
        this.emit('appinfo-updated');
    }
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('start-compile');
            try {
                if (!this.appInfo.compileTarget) {
                    const projectInfo = yield this.backend.loadProjectInfo();
                    this.appInfo.compileTarget = projectInfo.compile_target_file_id;
                    this.appInfo.projectName = projectInfo.title;
                }
                const { pdfStream, logStream, synctexStream } = yield this.backend.compileProject();
                // log
                this.fileAdapter.saveAs(this.logPath, logStream).catch(err => {
                    this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
                });
                // download pdf
                this.fileAdapter.saveAs(this.pdfPath, pdfStream).catch(err => {
                    this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
                });
                // download synctex
                if (synctexStream) {
                    this.fileAdapter.saveAs(this.synctexPath, synctexStream).catch(err => {
                        this.logger.error('Some error occurred with saving a synctex file.' + JSON.stringify(err));
                    });
                }
            }
            catch (err) {
                this.logger.warn('Some error occured with compilation.' + JSON.stringify(err));
                this.emit('failed-compile');
                return;
            }
            this.emit('successfully-compiled');
        });
    }
    /**
     * Validate account
     *
     * @return Promise<'valid' | 'invalid' | 'offline'>
     */
    validateAccount() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.backend.validateToken();
                if (!result) {
                    this.logger.error('Your account is invalid.');
                    return 'invalid';
                }
                this.onOnline();
            }
            catch (err) {
                this.onOffline();
                return 'offline';
            }
            return 'valid';
        });
    }
    setAccount(account) {
        // Keep the reference of this.account
        this.accountManager.save(account);
    }
    /**
     * Start to synchronize files with the remote server
     */
    startSync() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.syncManager.syncSession();
            if (result.success) {
                if (result.fileChanged && this.config.autoBuild) {
                    this.compile();
                }
            }
        });
    }
    /**
     * stop watching file changes.
     */
    exit() {
        this.fileWatcher.unwatch();
    }
}
exports.default = LatexApp;
//# sourceMappingURL=latexApp.js.map