export default class Logger {
    logLevel: 'log' | 'info' | 'warn' | 'error' | 'silent';
    constructor(logLevel?: 'log' | 'info' | 'warn' | 'error' | 'silent');
    log(message: any, ...optinalParams: any[]): void;
    _log(message: any, ...optinalParams: any[]): void;
    info(message: any, ...optinalParams: any[]): void;
    _info(message: any, ...optinalParams: any[]): void;
    warn(message: any, ...optinalParams: any[]): void;
    _warn(message: any, ...optinalParams: any[]): void;
    error(message: any, ...optinalParams: any[]): void;
    _error(message: any, ...optinalParams: any[]): void;
}
