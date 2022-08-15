"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppInfoService = void 0;
const path = require("path");
class AppInfoService {
    constructor(config) {
        this.config = config;
        this.appInfo = {
            loginStatus: 'offline',
            conflictFiles: [],
            loaded: false
        };
    }
    setLoginStatus(loginStatus) {
        this.appInfo.loginStatus = loginStatus;
    }
    setProjectName(projectName) {
        this.appInfo.projectName = projectName;
    }
    setTarget(compileTarget, targetName) {
        this.appInfo.compileTarget = compileTarget;
        this.appInfo.targetName = targetName;
        // set dependent paths
        this.appInfo.logPath = this._logPath();
        this.appInfo.pdfPath = this._pdfPath();
        this.appInfo.synctexPath = this._synctexPath();
    }
    setLoaded() {
        this.appInfo.loaded = true;
    }
    setConflicts(files) {
        this.appInfo.conflictFiles = files;
    }
    _logPath() {
        return path.posix.join(this.config.outDir || '', this.appInfo.targetName + '.log');
    }
    _pdfPath() {
        return path.posix.join(this.config.outDir || '', this.appInfo.targetName + '.pdf');
    }
    _synctexPath() {
        return path.posix.join(this.config.outDir || '', this.appInfo.targetName + '.synctex');
    }
}
exports.AppInfoService = AppInfoService;
//# sourceMappingURL=appInfoService.js.map