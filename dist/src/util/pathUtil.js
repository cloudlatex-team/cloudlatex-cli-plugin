"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChild = exports.wildcard2regexp = void 0;
const path = require("path");
exports.wildcard2regexp = (wildcardExp) => {
    return new RegExp('^' + wildcardExp.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '$');
};
exports.isChild = (base, target) => {
    const relative = path.posix.relative(base, target);
    return !relative.startsWith('..');
};
//# sourceMappingURL=pathUtil.js.map