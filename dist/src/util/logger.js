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
    log(message, ...optionalParams) {
        if (level2Number[this.logLevel] <= level2Number.log) {
            this._log(message, ...optionalParams);
        }
    }
    _log(message, ...optionalParams) {
        console.log(message, ...optionalParams);
    }
    info(message, ...optionalParams) {
        if (level2Number[this.logLevel] <= level2Number.info) {
            this._info(message, ...optionalParams);
        }
    }
    _info(message, ...optionalParams) {
        console.info(message, ...optionalParams);
    }
    warn(message, ...optionalParams) {
        if (level2Number[this.logLevel] <= level2Number.warn) {
            this._warn(message, ...optionalParams);
        }
    }
    _warn(message, ...optionalParams) {
        console.warn(message, ...optionalParams);
    }
    error(message, ...optionalParams) {
        if (level2Number[this.logLevel] <= level2Number.error) {
            this._error(message, ...optionalParams);
        }
    }
    _error(message, ...optionalParams) {
        console.error(message, ...optionalParams);
    }
}
exports.Logger = Logger;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function getErrorTraceStr(e) {
    return (e || '').toString() + '\n' + (e && e.stack || '');
}
exports.getErrorTraceStr = getErrorTraceStr;
//# sourceMappingURL=logger.js.map