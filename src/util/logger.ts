const level2Number = {
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5
};

export class Logger {
  constructor(public logLevel: 'log' | 'info' | 'warn' | 'error' | 'silent' = 'log') {
  }
  log(message: unknown, ...optionalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.log) {
      this._log(message, ...optionalParams);
    }
  }

  _log(message: unknown, ...optionalParams: unknown[]): void {
    console.log(message, ...optionalParams);
  }

  info(message: unknown, ...optionalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.info) {
      this._info(message, ...optionalParams);
    }
  }

  _info(message: unknown, ...optionalParams: unknown[]): void {
    console.info(message, ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.warn) {
      this._warn(message, ...optionalParams);
    }
  }

  _warn(message: unknown, ...optionalParams: unknown[]): void {
    console.warn(message, ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.error) {
      this._error(message, ...optionalParams);
    }
  }

  _error(message: unknown, ...optionalParams: unknown[]): void {
    console.error(message, ...optionalParams);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function getErrorTraceStr(e: any): string {
  return (e || '').toString() + '\n' + (e && e.stack || '');
}