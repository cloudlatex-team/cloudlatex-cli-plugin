"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Backend {
    constructor(config, accountManager) {
        this.config = config;
        this.accountManager = accountManager;
    }
    validateToken() {
        throw new Error('No implementation');
    }
    loadProjectInfo() {
        throw new Error('No implementation');
    }
    loadFileList() {
        throw new Error('No implementation');
    }
    upload(file, stream, option) {
        throw new Error('No implementation');
    }
    createRemote(file, parent) {
        throw new Error('No implementation');
    }
    download(file) {
        throw new Error('No implementation');
    }
    updateRemote(file, stream) {
        throw new Error('No implementation');
    }
    deleteRemote(file) {
        throw new Error('No implementation');
    }
    compileProject() {
        throw new Error('No implementation');
    }
}
exports.default = Backend;
//# sourceMappingURL=backend.js.map