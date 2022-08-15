"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendSelector = void 0;
const clBackend_1 = require("./cloudlatex/clBackend");
function backendSelector(config, accountService) {
    if (config.backend === 'cloudlatex') {
        return new clBackend_1.ClBackend(config, accountService);
    }
    else {
        throw new Error('Unknown backend detected: ' + config.backend);
    }
}
exports.backendSelector = backendSelector;
//# sourceMappingURL=backendSelector.js.map