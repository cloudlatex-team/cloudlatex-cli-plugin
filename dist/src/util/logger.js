"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorTraceStr = void 0;
const Level2Number = {
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
        if (Level2Number[this.logLevel] <= Level2Number.log) {
            this._log(message, ...optinalParams);
        }
    }
    _log(message, ...optinalParams) {
        console.log(message, ...optinalParams);
    }
    info(message, ...optinalParams) {
        if (Level2Number[this.logLevel] <= Level2Number.info) {
            this._info(message, ...optinalParams);
        }
    }
    _info(message, ...optinalParams) {
        console.info(message, ...optinalParams);
    }
    warn(message, ...optinalParams) {
        if (Level2Number[this.logLevel] <= Level2Number.warn) {
            this._warn(message, ...optinalParams);
        }
    }
    _warn(message, ...optinalParams) {
        console.warn(message, ...optinalParams);
    }
    error(message, ...optinalParams) {
        if (Level2Number[this.logLevel] <= Level2Number.error) {
            this._error(message, ...optinalParams);
        }
    }
    _error(message, ...optinalParams) {
        console.error(message, ...optinalParams);
    }
}
exports.default = Logger;
function getErrorTraceStr(e) {
    return (e || '').toString() + '\n' + (e && e.trace || '');
}
exports.getErrorTraceStr = getErrorTraceStr;
//# sourceMappingURL=logger.js.map