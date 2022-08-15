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
  log(message: unknown, ...optinalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.log) {
      this._log(message, ...optinalParams);
    }
  }

  _log(message: unknown, ...optinalParams: unknown[]): void {
    console.log(message, ...optinalParams);
  }

  info(message: unknown, ...optinalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.info) {
      this._info(message, ...optinalParams);
    }
  }

  _info(message: unknown, ...optinalParams: unknown[]): void {
    console.info(message, ...optinalParams);
  }

  warn(message: unknown, ...optinalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.warn) {
      this._warn(message, ...optinalParams);
    }
  }

  _warn(message: unknown, ...optinalParams: unknown[]): void {
    console.warn(message, ...optinalParams);
  }

  error(message: unknown, ...optinalParams: unknown[]): void {
    if (level2Number[this.logLevel] <= level2Number.error) {
      this._error(message, ...optinalParams);
    }
  }

  _error(message: unknown, ...optinalParams: unknown[]): void {
    console.error(message, ...optinalParams);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function getErrorTraceStr(e: any): string {
  return (e || '').toString() + '\n' + (e && e.stack || '');
}