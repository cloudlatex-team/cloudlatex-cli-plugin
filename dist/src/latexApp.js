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
exports.LatexApp = exports.LATEX_APP_EVENTS = void 0;
const path = require("path");
const EventEmitter = require("eventemitter3");
const logger_1 = require("./util/logger");
const pathUtil_1 = require("./util/pathUtil");
const fileAdapter_1 = require("./fileService/fileAdapter");
const syncManager_1 = require("./fileService/syncManager");
const fileWatcher_1 = require("./fileService/fileWatcher");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("./model/fileModel");
const backendSelector_1 = require("./backend/backendSelector");
const accountService_1 = require("./service/accountService");
const appInfoService_1 = require("./service/appInfoService");
/* eslint-disable @typescript-eslint/naming-convention */
exports.LATEX_APP_EVENTS = {
    FILE_CHANGED: 'file-changed',
    FILE_SYNC_SUCCEEDED: 'file-sync-succeeded',
    FILE_SYNC_FAILED: 'file-sync-failed',
    FILE_CHANGE_ERROR: 'file-change-error',
    TARGET_FILE_NOT_FOUND: 'target-file-not-found',
    COMPILATION_STARTED: 'compilation-started',
    COMPILATION_SUCCEEDED: 'compilation-succeeded',
    COMPILATION_FAILED: 'compilation-failed',
    LOGIN_SUCCEEDED: 'login-succeeded',
    LOGIN_FAILED: 'login-failed',
    LOGIN_OFFLINE: 'login-offline',
    PROJECT_LOADED: 'project-loaded',
    UNEXPECTED_ERROR: 'unexpected-error',
};
class LAEventEmitter extends EventEmitter {
}
/* eslint-enable @typescript-eslint/adjacent-overload-signatures */
const IGNORE_FILES = [
    '*.aux',
    '*.bbl',
    '*.blg',
    '*.idx',
    '*.ind',
    '*.lof',
    '*.lot',
    '*.out',
    '*.toc',
    '*.acn',
    '*.acr',
    '*.alg',
    '*.glg',
    '*.glo',
    '*.gls',
    '*.fls',
    '*.log',
    '*.fdb_latexmk',
    '*.snm',
    '*.synctex',
    '*.synctex(busy)',
    '*.synctex.gz(busy)',
    '*.nav'
];
class LatexApp extends LAEventEmitter {
    /**
     * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
     */
    constructor(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger = new logger_1.Logger()) {
        super();
        this.config = config;
        this.accountService = accountService;
        this.appInfoService = appInfoService;
        this.backend = backend;
        this.fileAdapter = fileAdapter;
        this.fileRepo = fileRepo;
        this.logger = logger;
        /**
         * Sync Manager
         */
        this.syncManager = new syncManager_1.SyncManager(fileRepo, fileAdapter, (conflictFiles) => __awaiter(this, void 0, void 0, function* () {
            appInfoService.setConflicts(conflictFiles);
            return decideSyncMode(conflictFiles);
        }), logger);
        this.syncManager.on('sync-finished', (result) => {
            if (result.success) {
                this.emit(exports.LATEX_APP_EVENTS.FILE_SYNC_SUCCEEDED, result);
            }
            else if (result.canceled) {
                // canceled
            }
            else {
                const msg = result.errors.join('\n');
                this.logger.error('Error in synchronizing files: ' + msg);
                this.emit(exports.LATEX_APP_EVENTS.FILE_SYNC_FAILED, msg);
            }
        });
        this.syncManager.on('error', (msg) => {
            this.emit(exports.LATEX_APP_EVENTS.FILE_CHANGE_ERROR, msg);
        });
        /**
         * File watcher
         */
        this.fileWatcher = new fileWatcher_1.FileWatcher(this.config.rootPath, fileRepo, relativePath => {
            const outFilePaths = [
                this.config.outDir,
                appInfoService.appInfo.logPath,
                appInfoService.appInfo.pdfPath,
                appInfoService.appInfo.synctexPath
            ];
            return !outFilePaths.includes(relativePath) &&
                !IGNORE_FILES.some(ignoreFile => relativePath.match(pathUtil_1.wildcard2regexp(ignoreFile)));
        }, logger);
        this.fileWatcher.on('change-detected', () => __awaiter(this, void 0, void 0, function* () {
            this.emit(exports.LATEX_APP_EVENTS.FILE_CHANGED);
        }));
        this.fileWatcher.on('error', (err) => {
            this.emit(exports.LATEX_APP_EVENTS.FILE_CHANGE_ERROR, err);
        });
    }
    get appInfo() {
        return this.appInfoService.appInfo;
    }
    /**
     * setup file management classes
     *
     * Instantiate fileAdapter, fileWatcher and syncManager.
     * The fileWatcher detects local changes.
     * The syncManager synchronize local files with remote ones.
     * The file Adapter abstructs file operations of local files and remote ones.
     */
    static createApp(config, option = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const logger = option.logger || new logger_1.Logger();
            logger.log(`latex-cli ${'2.0.0'}`);
            // Config
            config = this.sanitizeConfig(config);
            // Account
            const accountService = option.accountService || new accountService_1.AccountService();
            yield accountService.load();
            // AppInfo
            const appInfoService = new appInfoService_1.AppInfoService(config);
            // Backend
            const backend = backendSelector_1.backendSelector(config, accountService);
            // DB
            const dbFilePath = config.storagePath ? path.join(config.storagePath, `.${config.projectId}-${config.backend}.json`) : undefined;
            const db = new type_db_1.TypeDB(dbFilePath);
            try {
                yield db.load();
            }
            catch (err) {
                // Not initialized because there is no db file.
            }
            const fileRepo = db.getRepository(fileModel_1.FILE_INFO_DESC);
            fileRepo.all().forEach(file => {
                file.watcherSynced = true;
            });
            fileRepo.save();
            const fileAdapter = new fileAdapter_1.FileAdapter(config.rootPath, fileRepo, backend);
            const defaultDecideSyncMode = () => Promise.resolve('upload');
            const decideSyncMode = option.decideSyncMode || defaultDecideSyncMode;
            return new LatexApp(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger);
        });
    }
    static sanitizeConfig(config) {
        const outDir = config.outDir || config.rootPath;
        let relativeOutDir = path.isAbsolute(outDir) ?
            path.relative(config.rootPath, outDir) :
            path.join(outDir);
        relativeOutDir = relativeOutDir.replace(/\\/g, path.posix.sep); // for windows
        const rootPath = config.rootPath.replace(/\\/g, path.posix.sep); // for windows
        if (relativeOutDir === path.posix.sep || relativeOutDir === `.${path.posix.sep}`) {
            relativeOutDir = '';
        }
        return Object.assign(Object.assign({}, config), { outDir: relativeOutDir, rootPath });
    }
    /**
     * Start to watch file system
     */
    startFileWatcher() {
        return this.fileWatcher.init();
    }
    /**
     * Stop watching file system
     */
    stopFileWatcher() {
        return this.fileWatcher.stop();
    }
    onValid() {
        if (this.appInfoService.appInfo.loginStatus === 'valid') {
            return;
        }
        this.logger.info('Login Successful');
        this.appInfoService.setLoginStatus('valid');
        this.emit(exports.LATEX_APP_EVENTS.LOGIN_SUCCEEDED);
    }
    onInvalid() {
        if (this.appInfoService.appInfo.loginStatus === 'invalid') {
            return;
        }
        this.logger.info('Login failed.');
        this.appInfoService.setLoginStatus('invalid');
        this.emit(exports.LATEX_APP_EVENTS.LOGIN_FAILED);
    }
    onOffline() {
        if (this.appInfoService.appInfo.loginStatus === 'offline') {
            return;
        }
        this.logger.warn('Cannot connect to the server');
        this.appInfoService.setLoginStatus('offline');
        this.emit(exports.LATEX_APP_EVENTS.LOGIN_OFFLINE);
    }
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Start compiling');
            this.emit(exports.LATEX_APP_EVENTS.COMPILATION_STARTED);
            try {
                if (!this.appInfoService.appInfo.loaded) {
                    const projectInfo = yield this.backend.loadProjectInfo();
                    const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
                    if (!file) {
                        this.logger.error('Target file is not found');
                        this.emit(exports.LATEX_APP_EVENTS.TARGET_FILE_NOT_FOUND, '');
                        return { status: 'no-target-error' };
                    }
                    const targetName = path.posix.basename(file.relativePath, '.tex');
                    this.appInfoService.setProjectName(projectInfo.title);
                    this.appInfoService.setTarget(projectInfo.compile_target_file_id, targetName);
                    this.appInfoService.setLoaded();
                    this.emit(exports.LATEX_APP_EVENTS.PROJECT_LOADED, this.appInfo);
                }
                const result = yield this.backend.compileProject();
                if (result.status !== 'success') {
                    this.emit(exports.LATEX_APP_EVENTS.COMPILATION_FAILED, result);
                    return result;
                }
                const promises = [];
                // download log file
                if (result.logStream) {
                    if (this.appInfoService.appInfo.logPath) {
                        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath, result.logStream).catch(err => {
                            const msg = 'Some error occurred with saving a log file.';
                            this.logger.error(msg + logger_1.getErrorTraceStr(err));
                            this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                        }));
                    }
                    else {
                        const msg = 'Log file path is not set';
                        this.logger.error(msg);
                        this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                    }
                }
                // download pdf
                if (result.pdfStream) {
                    if (this.appInfoService.appInfo.pdfPath) {
                        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath, result.pdfStream).catch(err => {
                            const msg = 'Some error occurred with downloading the compiled pdf file.';
                            this.logger.error(msg + logger_1.getErrorTraceStr(err));
                            this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                        }));
                    }
                    else {
                        const msg = 'PDF file path is not set';
                        this.logger.error(msg);
                        this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                    }
                }
                // download synctex
                if (result.synctexStream) {
                    if (this.appInfoService.appInfo.synctexPath) {
                        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath, result.synctexStream).catch(err => {
                            const msg = 'Some error occurred with saving a synctex file.';
                            this.logger.error(msg + logger_1.getErrorTraceStr(err));
                            this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                        }));
                    }
                    else {
                        const msg = 'Synctex file path is not set';
                        this.logger.error(msg);
                        this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                    }
                }
                // wait to download all files
                yield Promise.all(promises);
                this.logger.log('Sucessfully compiled');
                this.emit(exports.LATEX_APP_EVENTS.COMPILATION_SUCCEEDED, result);
                return result;
            }
            catch (err) {
                const msg = 'Some error occurred with compiling.';
                this.logger.warn(msg + logger_1.getErrorTraceStr(err));
                this.emit(exports.LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
                return { status: 'unknown-error' };
            }
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
                    this.onInvalid();
                    return 'invalid';
                }
            }
            catch (err) {
                this.onOffline();
                return 'offline';
            }
            this.onValid();
            return 'valid';
        });
    }
    /**
     * Set account
     *
     * @param account Account
     */
    setAccount(account) {
        this.accountService.save(account);
    }
    /**
     * Start to synchronize files with the remote server
     */
    startSync() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.syncManager.syncSession();
        });
    }
    /**
     * clear local changes to resolve sync problem
     */
    resetLocal() {
        this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
    }
}
exports.LatexApp = LatexApp;
//# sourceMappingURL=latexApp.js.map