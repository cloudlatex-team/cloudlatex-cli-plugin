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
const EventEmitter = require("eventemitter3");
const package_json_1 = require("../package.json");
const logger_1 = require("./util/logger");
const fileAdapter_1 = require("./fileService/fileAdapter");
const syncManager_1 = require("./fileService/syncManager");
const fileWatcher_1 = require("./fileService/fileWatcher");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("./model/fileModel");
const backendSelector_1 = require("./backend/backendSelector");
const accountService_1 = require("./service/accountService");
const appInfoService_1 = require("./service/appInfoService");
const filePath_1 = require("./fileService/filePath");
const asyncRunner_1 = require("./util/asyncRunner");
/* eslint-disable @typescript-eslint/naming-convention */
exports.LATEX_APP_EVENTS = {
    FILE_CHANGED: 'file-changed',
    FILE_CHANGE_ERROR: 'file-change-error',
};
class LAEventEmitter extends EventEmitter {
}
/* eslint-enable @typescript-eslint/adjacent-overload-signatures */
class LatexApp extends LAEventEmitter {
    /**
     * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
     */
    constructor(config, appInfoService, backend, fileAdapter, fileRepo, logger = new logger_1.Logger()) {
        super();
        this.config = config;
        this.appInfoService = appInfoService;
        this.backend = backend;
        this.fileAdapter = fileAdapter;
        this.fileRepo = fileRepo;
        this.logger = logger;
        this.compilationRunner = new asyncRunner_1.AsyncRunner(() => this.execCompile());
        /**
         * Ignore file setting
         */
        const ignoredFiles = filePath_1.calcIgnoredFiles(this.appInfoService);
        const checkIgnored = (file) => {
            return filePath_1.checkIgnoredByFileInfo(this.config, file, ignoredFiles);
        };
        this.logger.log(`IgnoredFiles: ${JSON.stringify(ignoredFiles)}`);
        /**
         * Sync Manager
         */
        this.syncManager = new syncManager_1.SyncManager(fileRepo, fileAdapter, logger, checkIgnored);
        /**
         * File watcher
         */
        this.fileWatcher = new fileWatcher_1.FileWatcher(this.config, fileRepo, {
            ignored: ignoredFiles,
            logger
        });
        this.fileWatcher.on('change-detected', () => __awaiter(this, void 0, void 0, function* () {
            this.emit(exports.LATEX_APP_EVENTS.FILE_CHANGED);
        }));
        this.fileWatcher.on('error', (err) => {
            this.emit(exports.LATEX_APP_EVENTS.FILE_CHANGE_ERROR, err);
        });
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
            logger.log(`latex-cli ${package_json_1.version}`);
            // Config
            config = this.sanitizeConfig(config);
            // Account
            const accountService = option.accountService || new accountService_1.AccountService();
            yield accountService.load();
            // Backend
            const backend = backendSelector_1.backendSelector(config, accountService);
            // DB
            const dbFilePath = filePath_1.getDBFilePath(config);
            const db = new type_db_1.TypeDB(dbFilePath);
            try {
                yield db.load();
            }
            catch (err) {
                // Not initialized because there is no db file.
            }
            const fileRepo = db.getRepository(fileModel_1.FILE_INFO_DESC);
            const fileAdapter = new fileAdapter_1.FileAdapter(config.rootPath, fileRepo, backend);
            // AppInfo
            const appInfoService = new appInfoService_1.AppInfoService(config, fileRepo);
            return new LatexApp(config, appInfoService, backend, fileAdapter, fileRepo, logger);
        });
    }
    static sanitizeConfig(config) {
        const outDir = filePath_1.calcRelativeOutDir(config);
        const rootPath = filePath_1.toPosixPath(config.rootPath);
        return Object.assign(Object.assign({}, config), { outDir, rootPath });
    }
    /**
     * Start to watch file system
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // Login
            const loginResult = yield this.login();
            // Start file watcher
            yield this.fileWatcher.init();
            return loginResult;
        });
    }
    /**
     * Login
     */
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate account
            const accountValidation = yield this.validateAccount();
            if (accountValidation === 'offline') {
                return {
                    status: 'offline',
                    appInfo: this.appInfoService.appInfo,
                };
            }
            else if (accountValidation === 'invalid') {
                return {
                    status: 'invalid-account',
                    appInfo: this.appInfoService.appInfo,
                };
            }
            else if (accountValidation === 'valid') {
                if (!this.appInfoService.appInfo.loaded && this.config.projectId) {
                    const loadResult = yield this.loadProject();
                    if (loadResult !== 'success') {
                        return {
                            status: loadResult,
                            appInfo: this.appInfoService.appInfo,
                        };
                    }
                }
                return {
                    status: 'success',
                    appInfo: this.appInfoService.appInfo
                };
            }
            return {
                status: 'unknown-error',
                appInfo: this.appInfoService.appInfo,
            };
        });
    }
    /**
     * Stop watching file system
     */
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            // Stop watching file system
            yield this.fileWatcher.stop();
            // Remove all event listeners
            this.removeAllListeners();
        });
    }
    onValid() {
        if (this.appInfoService.appInfo.loginStatus === 'valid') {
            return;
        }
        this.logger.info('Login Successful');
        this.appInfoService.setLoginStatus('valid');
    }
    onInvalid() {
        this.logger.info('Login failed.');
        if (this.appInfoService.appInfo.loginStatus === 'invalid') {
            return;
        }
        this.appInfoService.setLoginStatus('invalid');
    }
    onOffline() {
        this.logger.warn('Cannot connect to the server');
        if (this.appInfoService.appInfo.loginStatus === 'offline') {
            return;
        }
        this.appInfoService.setLoginStatus('offline');
    }
    /**
     * Update project info
     */
    updateProjectInfo(param) {
        return __awaiter(this, void 0, void 0, function* () {
            // Login
            const loginResult = yield this.login();
            if (loginResult.status !== 'success') {
                return loginResult;
            }
            try {
                yield this.backend.updateProjectInfo(param);
                this.logger.info('Project info updated');
                const result = yield this.loadProject();
                return { status: result, appInfo: this.appInfoService.appInfo };
            }
            catch (err) {
                const msg = 'Some error occurred with updating project info ';
                this.logger.warn(msg + logger_1.getErrorTraceStr(err));
                return {
                    status: 'unknown-error',
                    appInfo: this.appInfoService.appInfo,
                    errors: [msg],
                };
            }
        });
    }
    /**
     * Synchronize files
     */
    sync(conflictSolution) {
        return __awaiter(this, void 0, void 0, function* () {
            // Login
            const loginResult = yield this.login();
            if (loginResult.status !== 'success') {
                return loginResult;
            }
            // File synchronization
            const result = yield this.syncManager.sync(conflictSolution);
            const status = result.conflict
                ? 'conflict'
                : result.success ? 'success' : 'unknown-error';
            return {
                status,
                errors: result.errors,
                appInfo: this.appInfoService.appInfo,
            };
        });
    }
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.compilationRunner.run();
        });
    }
    execCompile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Compilation is started');
            const errors = [];
            // Load project data if not yet
            if (!this.appInfoService.appInfo.loaded) {
                const loadProjectResult = yield this.loadProject();
                if (loadProjectResult !== 'success') {
                    return {
                        status: loadProjectResult,
                        appInfo: this.appInfoService.appInfo,
                    };
                }
            }
            try {
                // Compile
                const result = yield this.backend.compileProject();
                if (result.status !== 'success') {
                    this.logger.log('Compilation is finished with some errors');
                    return Object.assign(Object.assign({}, result), { appInfo: this.appInfoService.appInfo });
                }
                // Download artifacts
                errors.push(...yield this.downloadCompilationArtifacts(result));
                this.logger.log('Compilation is finished');
                return Object.assign(Object.assign({}, result), { errors, appInfo: this.appInfoService.appInfo });
            }
            catch (err) {
                const msg = 'Some error occurred with compiling: ';
                this.logger.warn(msg + logger_1.getErrorTraceStr(err));
                errors.push(msg);
                return {
                    status: 'unknown-error', errors,
                    appInfo: this.appInfoService.appInfo,
                };
            }
        });
    }
    downloadCompilationArtifacts(result) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            const errors = [];
            // download log file
            if (result.logStream) {
                if (this.appInfoService.appInfo.logPath) {
                    promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath, result.logStream).catch(err => {
                        const msg = 'Some error occurred with saving a log file.';
                        this.logger.error(msg + logger_1.getErrorTraceStr(err));
                        errors.push(msg);
                    }));
                }
                else {
                    const msg = 'Log file path is not set';
                    this.logger.error(msg);
                    errors.push(msg);
                }
            }
            // download pdf
            if (result.pdfStream) {
                if (this.appInfoService.appInfo.pdfPath) {
                    promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath, result.pdfStream).catch(err => {
                        const msg = 'Some error occurred with downloading the compiled pdf file.';
                        this.logger.error(msg + logger_1.getErrorTraceStr(err));
                        errors.push(msg);
                    }));
                }
                else {
                    const msg = 'PDF file path is not set';
                    this.logger.error(msg);
                    errors.push(msg);
                }
            }
            // download synctex
            if (result.synctexStream) {
                if (this.appInfoService.appInfo.synctexPath) {
                    promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath, result.synctexStream).catch(err => {
                        const msg = 'Some error occurred with saving a synctex file.';
                        this.logger.error(msg + logger_1.getErrorTraceStr(err));
                        errors.push(msg);
                    }));
                }
                else {
                    const msg = 'Synctex file path is not set';
                    this.logger.error(msg);
                    errors.push(msg);
                }
            }
            // wait to download all files
            yield Promise.all(promises);
            return errors;
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
    loadProject() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const projectInfo = yield this.backend.loadProjectInfo();
                const fileList = yield this.backend.loadFileList();
                const targetFile = fileList.find(file => file.remoteId === projectInfo.compileTargetFileRemoteId);
                if (!targetFile) {
                    this.logger.error(`Target file ${projectInfo.compileTargetFileRemoteId} is not found`);
                    return 'no-target-error';
                }
                this.appInfoService.onProjectLoaded(projectInfo);
                return 'success';
            }
            catch (err) {
                this.logger.error(logger_1.getErrorTraceStr(err));
                return 'unknown-error';
            }
        });
    }
    /**
     * clear local changes to resolve sync problem
     */
    resetLocal() {
        this.logger.info('resetLocal()');
        this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.fileRepo.save();
    }
}
exports.LatexApp = LatexApp;
//# sourceMappingURL=latexApp.js.map