export declare class Logger {
    logLevel: 'log' | 'info' | 'warn' | 'error' | 'silent';
    constructor(logLevel?: 'log' | 'info' | 'warn' | 'error' | 'silent');
    log(message: unknown, ...optinalParams: unknown[]): void;
    _log(message: unknown, ...optinalParams: unknown[]): void;
    info(message: unknown, ...optinalParams: unknown[]): void;
    _info(message: unknown, ...optinalParams: unknown[]): void;
    warn(message: unknown, ...optinalParams: unknown[]): void;
    _warn(message: unknown, ...optinalParams: unknown[]): void;
    error(message: unknown, ...optinalParams: unknown[]): void;
    _error(message: unknown, ...optinalParams: unknown[]): void;
}
export declare function getErrorTraceStr(e: any): string;
