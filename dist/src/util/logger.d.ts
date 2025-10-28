export declare class Logger {
    logLevel: 'log' | 'info' | 'warn' | 'error' | 'silent';
    constructor(logLevel?: 'log' | 'info' | 'warn' | 'error' | 'silent');
    log(message: unknown, ...optionalParams: unknown[]): void;
    _log(message: unknown, ...optionalParams: unknown[]): void;
    info(message: unknown, ...optionalParams: unknown[]): void;
    _info(message: unknown, ...optionalParams: unknown[]): void;
    warn(message: unknown, ...optionalParams: unknown[]): void;
    _warn(message: unknown, ...optionalParams: unknown[]): void;
    error(message: unknown, ...optionalParams: unknown[]): void;
    _error(message: unknown, ...optionalParams: unknown[]): void;
}
export declare function getErrorTraceStr(e: any): string;
