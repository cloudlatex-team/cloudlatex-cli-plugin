"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChild = void 0;
const path = require("path");
exports.isChild = (base, target) => {
    const relative = path.posix.relative(base, target);
    return !relative.startsWith('..');
};
//# sourceMappingURL=pathUtil.js.map