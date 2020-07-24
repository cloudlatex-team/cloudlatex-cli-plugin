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
const index_1 = require("./fileManage/index");
class LatexApp extends EventEmitter {
    constructor(config, decideSyncMode, logger = new logger_1.default()) {
        super();
        this.config = config;
        this.logger = logger;
        this.appInfo = {
            offline: false,
            conflictFiles: []
        };
        this.manager = new index_1.default(config, (conflictFiles) => __awaiter(this, void 0, void 0, function* () {
            this.appInfo.conflictFiles = conflictFiles;
            return decideSyncMode(conflictFiles);
        }), relativePath => {
            if (!this.appInfo.projectName) {
                return ![this.config.outDir].includes(relativePath);
            }
            return ![this.config.outDir, this.logPath, this.pdfPath, this.synctexPath].includes(relativePath);
        }, logger);
    }
    launch() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.manager.init();
            this.manager.on('request-autobuild', () => {
                if (this.config.autoBuild) {
                    this.compile();
                }
            });
            this.manager.on('offline', this.onOffline.bind(this));
            this.manager.on('online', this.onOnline.bind(this));
            yield this.manager.startSync();
        });
    }
    get targetName() {
        if (!this.appInfo.compileTarget) {
            this.logger.error('Project info is not defined');
            throw new Error('Project info is not defined');
        }
        const file = this.manager.fileRepo.findBy('remoteId', this.appInfo.compileTarget);
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
    reload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.manager.startSync();
        });
    }
    compile() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('start-compile');
            try {
                if (!this.appInfo.compileTarget) {
                    const projectInfo = yield this.manager.backend.loadProjectInfo();
                    this.appInfo.compileTarget = projectInfo.compile_target_file_id;
                    this.appInfo.projectName = projectInfo.title;
                }
                const { pdfStream, logStream, synctexStream } = yield this.manager.backend.compileProject();
                // log
                this.manager.fileAdapter.saveAs(this.logPath, logStream).catch(err => {
                    this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
                });
                // download pdf
                this.manager.fileAdapter.saveAs(this.pdfPath, pdfStream).catch(err => {
                    this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
                });
                // download synctex
                if (synctexStream) {
                    this.manager.fileAdapter.saveAs(this.synctexPath, synctexStream).catch(err => {
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
}
exports.default = LatexApp;
//# sourceMappingURL=latexApp.js.map