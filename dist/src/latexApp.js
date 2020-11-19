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
const logger_1 = require("./util/logger");
const fileAdapter_1 = require("./fileService/fileAdapter");
const syncManager_1 = require("./fileService/syncManager");
const fileWatcher_1 = require("./fileService/fileWatcher");
const type_db_1 = require("@moritanian/type-db");
const fileModel_1 = require("./model/fileModel");
const backendSelector_1 = require("./backend/backendSelector");
const accountService_1 = require("./service/accountService");
const appInfoService_1 = require("./service/appInfoService");
class LAEventEmitter extends EventEmitter {
}
const IgnoreFiles = [
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
const wildcard2regexp = (wildcardExp) => {
    return '^' + wildcardExp.replace(/\./g, '\\\.').replace(/\*/g, '.*').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '$';
};
class LatexApp extends LAEventEmitter {
    /**
     * Do not use this constructor and instantiate LatexApp by createApp()
     */
    constructor(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger = new logger_1.default()) {
        super();
        this.config = config;
        this.accountService = accountService;
        this.appInfoService = appInfoService;
        this.backend = backend;
        this.fileAdapter = fileAdapter;
        this.fileRepo = fileRepo;
        this.logger = logger;
        /**
         * Is required to compile initilally after launch app
         * and validate account
         */
        this.initialCompile = false;
        /**
         * Sync Manager
         */
        this.syncManager = new syncManager_1.default(fileRepo, fileAdapter, (conflictFiles) => __awaiter(this, void 0, void 0, function* () {
            appInfoService.setConflicts(conflictFiles);
            return decideSyncMode(conflictFiles);
        }), logger);
        this.syncManager.on('sync-finished', (result) => {
            if (result.success) {
                this.emit('successfully-synced');
                if (this.initialCompile || (result.fileChanged && this.config.autoCompile)) {
                    this.initialCompile = false;
                    this.compile();
                }
            }
            else if (result.canceled) {
            }
            else {
                this.logger.error('error in syncSession: ' + result.errors.join('\n'));
                this.emit('failed-sync');
            }
        });
        /**
         * File watcher
         */
        this.fileWatcher = new fileWatcher_1.default(this.config.rootPath, fileRepo, relativePath => {
            return ![
                this.config.outDir,
                appInfoService.appInfo.logPath,
                appInfoService.appInfo.pdfPath,
                appInfoService.appInfo.synctexPath
            ].includes(relativePath) &&
                !IgnoreFiles
                    .some(ignoreFile => relativePath.match(wildcard2regexp(ignoreFile)));
        }, logger);
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
            // Config
            const relativeOutDir = path.isAbsolute(config.outDir) ?
                path.relative(config.rootPath, config.outDir) :
                path.join(config.outDir);
            config = Object.assign(Object.assign({}, config), { outDir: relativeOutDir });
            // Account
            const accountService = option.accountService || new accountService_1.default();
            yield accountService.load();
            // AppInfo
            const appInfoService = new appInfoService_1.default(config);
            // Backend
            const backend = backendSelector_1.default(config, accountService);
            // DB
            const dbFilePath = path.join(config.storagePath, `.${config.projectId}-${config.backend}.json`);
            const db = new type_db_1.TypeDB(dbFilePath);
            try {
                yield db.load();
            }
            catch (err) {
                // Not initialized because there is no db file.
            }
            const fileRepo = db.getRepository(fileModel_1.FileInfoDesc);
            fileRepo.all().forEach(file => {
                file.watcherSynced = true;
            });
            fileRepo.save();
            // logger
            const logger = option.logger || new logger_1.default();
            const fileAdapter = new fileAdapter_1.default(config.rootPath, fileRepo, backend);
            const defaultDecideSyncMode = () => Promise.resolve('upload');
            const decideSyncMode = option.decideSyncMode || defaultDecideSyncMode;
            return new LatexApp(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger);
        });
    }
    /**
     * Launch application
     */
    launch() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.fileWatcher.init();
            if ((yield this.validateAccount()) !== 'valid') {
                return;
            }
            if (this.config.autoCompile) {
                this.initialCompile = true;
            }
            this.startSync();
        });
    }
    /**
     * Relaunch app to change config
     *
     * @param config
     */
    relaunch(config, accountService) {
        return __awaiter(this, void 0, void 0, function* () {
            this.exit();
            this.config = Object.assign(Object.assign({}, config), { outDir: path.join(config.outDir) });
            if (accountService) {
                this.accountService = accountService;
            }
            this.backend = backendSelector_1.default(config, this.accountService);
            this.launch();
        });
    }
    onOnline() {
        if (!this.appInfoService.appInfo.offline) {
            return;
        }
        this.appInfoService.setOnline();
        this.logger.info('Your account has been validated!');
        this.emit('updated-network', this.appInfoService.appInfo.offline);
    }
    onOffline() {
        if (this.appInfoService.appInfo.offline) {
            return;
        }
        this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
        this.appInfoService.setOffLine();
        this.emit('updated-network', this.appInfo.offline);
    }
    loadProjectInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const projectInfo = yield this.backend.loadProjectInfo();
            const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
            if (!file) {
                this.logger.error('Target file is not found');
                this.emit('failed-compile', { status: 'no-target-error' });
                return;
            }
            const targetName = path.basename(file.relativePath, '.tex');
            this.appInfoService.setProjectName(projectInfo.title);
            this.appInfoService.setTarget(projectInfo.compile_target_file_id, targetName);
            this.appInfoService.setLoaded();
            this.emit('loaded-project', this.appInfo);
        });
    }
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('start-compile');
            this.logger.log('start compiling');
            try {
                if (!this.appInfoService.appInfo.loaded) {
                    yield this.loadProjectInfo();
                }
                let result = yield this.backend.compileProject();
                if (result.status !== 'success') {
                    this.logger.warn('Compilation error', result);
                    this.emit('failed-compile', result);
                    return;
                }
                const promises = [];
                // download log file
                if (result.logStream) {
                    promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath, result.logStream).catch(err => {
                        this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
                    }));
                }
                // download pdf
                if (result.pdfStream) {
                    promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath, result.pdfStream).catch(err => {
                        this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
                    }));
                }
                // download synctex
                if (result.synctexStream) {
                    promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath, result.synctexStream).catch(err => {
                        this.logger.error('Some error occurred with saving a synctex file.' + JSON.stringify(err));
                    }));
                }
                // wait to download all files
                yield Promise.all(promises);
                this.logger.log('sucessfully compiled');
                this.emit('successfully-compiled', result);
            }
            catch (err) {
                this.logger.warn('Some error occured with compilation.' + JSON.stringify(err));
                this.emit('failed-compile', { status: 'unknown-error' });
                return;
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
            this.emit('start-sync');
            yield this.syncManager.syncSession();
        });
    }
    /**
     * clear local changes to resolve sync problem
     */
    resetLocal() {
        this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
        return this.startSync();
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