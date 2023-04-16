"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppInfoService = void 0;
const path = require("path");
class AppInfoService {
    constructor(config) {
        this.config = config;
        this._appInfo = {
            loginStatus: 'offline',
            conflictFiles: [],
            loaded: false
        };
    }
    get appInfo() {
        return Object.assign(Object.assign({}, this._appInfo), { conflictFiles: [...this._appInfo.conflictFiles] });
    }
    setLoginStatus(loginStatus) {
        this._appInfo.loginStatus = loginStatus;
    }
    setProjectName(projectName) {
        this._appInfo.projectName = projectName;
    }
    setTarget(compileTarget, targetName) {
        this._appInfo.compileTarget = compileTarget;
        this._appInfo.targetName = targetName;
        // set dependent paths
        this._appInfo.logPath = this._logPath();
        this._appInfo.pdfPath = this._pdfPath();
        this._appInfo.synctexPath = this._synctexPath();
    }
    setLoaded() {
        this._appInfo.loaded = true;
    }
    setConflicts(files) {
        this._appInfo.conflictFiles = files;
    }
    _logPath() {
        return path.posix.join(this.config.outDir || '', this._appInfo.targetName + '.log');
    }
    _pdfPath() {
        return path.posix.join(this.config.outDir || '', this._appInfo.targetName + '.pdf');
    }
    _synctexPath() {
        return path.posix.join(this.config.outDir || '', this._appInfo.targetName + '.synctex');
    }
}
exports.AppInfoService = AppInfoService;
//# sourceMappingURL=appInfoService.js.map