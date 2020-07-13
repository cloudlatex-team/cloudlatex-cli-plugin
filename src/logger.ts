const Level2Number = {
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5
};

export default class Logger {
  constructor(public logLevel: 'log' | 'info' | 'warn' | 'error' | 'silent' = 'log') {
  }
  log(message: any, ...optinalParams: any[]) {
    if (Level2Number[this.logLevel] <= Level2Number.log) {
      this._log(message, ...optinalParams);
    }
  }

  _log(message: any, ...optinalParams: any[]) {
    console.log(message, ...optinalParams);
  }

  info(message: any, ...optinalParams: any[]) {
    if (Level2Number[this.logLevel] <= Level2Number.info) {
      this._info(message, ...optinalParams);
    }
  }

  _info(message: any, ...optinalParams: any[]) {
    console.info(message, ...optinalParams);
  }

  warn(message: any, ...optinalParams: any[]) {
    if (Level2Number[this.logLevel] <= Level2Number.warn) {
      this._warn(message, ...optinalParams);
    }
  }

  _warn(message: any, ...optinalParams: any[]) {
    console.warn(message, ...optinalParams);
  }

  error(message: any, ...optinalParams: any[]) {
    if (Level2Number[this.logLevel] <= Level2Number.error) {
      this._error(message, ...optinalParams);
    }
  }

  _error(message: any, ...optinalParams: any[]) {
    console.error(message, ...optinalParams);
  }
}
