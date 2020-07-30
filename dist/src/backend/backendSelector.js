"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clBackend_1 = require("./cloudlatex/clBackend");
function backendSelector(config, accountManager) {
    if (config.backend === 'cloudlatex') {
        return new clBackend_1.default(config, accountManager);
    }
    else {
        throw new Error('Unknown backend detected: ' + config.backend);
    }
}
exports.default = backendSelector;
//# sourceMappingURL=backendSelector.js.map