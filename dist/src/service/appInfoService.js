"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppInfoService = void 0;
const path = require("path");
class AppInfoService {
    constructor(config, fileRepo) {
        this.config = config;
        this.fileRepo = fileRepo;
        this.loginStatus = 'offline';
    }
    get appInfo() {
        var _a;
        const files = this.fileRepo.all();
        const targetFile = this.targetFile();
        const targetFileCandidates = files.filter(file => file.relativePath.split(path.posix.sep).length === 1
            && path.posix.extname(file.relativePath) === '.tex');
        return {
            loginStatus: this.loginStatus,
            projectName: (_a = this.projectInfo) === null || _a === void 0 ? void 0 : _a.title,
            logPath: this._logPath(),
            pdfPath: this._pdfPath(),
            synctexPath: this._synctexPath(),
            loaded: !!this.projectInfo,
            conflictFiles: this.fileRepo.where({ 'changeLocation': 'both' }),
            targetFile,
            files,
            targetFileCandidates
        };
    }
    setLoginStatus(loginStatus) {
        this.loginStatus = loginStatus;
    }
    onProjectLoaded(projectInfo) {
        this.projectInfo = projectInfo;
    }
    targetName() {
        var _a;
        if (!this.projectInfo) {
            return '';
        }
        return path.posix.basename(((_a = this.targetFile()) === null || _a === void 0 ? void 0 : _a.relativePath) || 'main', '.tex');
    }
    targetFile() {
        var _a;
        return ((_a = this.projectInfo) === null || _a === void 0 ? void 0 : _a.compileTargetFileRemoteId) !== undefined
            && this.fileRepo.findBy('remoteId', this.projectInfo.compileTargetFileRemoteId)
            || undefined;
    }
    _logPath() {
        return path.posix.join(this.config.outDir || '', this.targetName() + '.log');
    }
    _pdfPath() {
        return path.posix.join(this.config.outDir || '', this.targetName() + '.pdf');
    }
    _synctexPath() {
        return path.posix.join(this.config.outDir || '', this.targetName() + '.synctex');
    }
}
exports.AppInfoService = AppInfoService;
//# sourceMappingURL=appInfoService.js.map