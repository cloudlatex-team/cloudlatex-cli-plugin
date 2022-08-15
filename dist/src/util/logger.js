"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorTraceStr = exports.Logger = void 0;
const level2Number = {
    log: 1,
    info: 2,
    warn: 3,
    error: 4,
    silent: 5
};
class Logger {
    constructor(logLevel = 'log') {
        this.logLevel = logLevel;
    }
    log(message, ...optinalParams) {
        if (level2Number[this.logLevel] <= level2Number.log) {
            this._log(message, ...optinalParams);
        }
    }
    _log(message, ...optinalParams) {
        console.log(message, ...optinalParams);
    }
    info(message, ...optinalParams) {
        if (level2Number[this.logLevel] <= level2Number.info) {
            this._info(message, ...optinalParams);
        }
    }
    _info(message, ...optinalParams) {
        console.info(message, ...optinalParams);
    }
    warn(message, ...optinalParams) {
        if (level2Number[this.logLevel] <= level2Number.warn) {
            this._warn(message, ...optinalParams);
        }
    }
    _warn(message, ...optinalParams) {
        console.warn(message, ...optinalParams);
    }
    error(message, ...optinalParams) {
        if (level2Number[this.logLevel] <= level2Number.error) {
            this._error(message, ...optinalParams);
        }
    }
    _error(message, ...optinalParams) {
        console.error(message, ...optinalParams);
    }
}
exports.Logger = Logger;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function getErrorTraceStr(e) {
    return (e || '').toString() + '\n' + (e && e.stack || '');
}
exports.getErrorTraceStr = getErrorTraceStr;
//# sourceMappingURL=logger.js.map