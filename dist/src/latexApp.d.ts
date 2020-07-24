import * as EventEmitter from 'eventemitter3';
import Logger from './logger';
import { Config, AppInfo, DecideSyncMode } from './types';
export default class LatexApp extends EventEmitter {
    private config;
    private logger;
    private manager;
    readonly appInfo: AppInfo;
    constructor(config: Config, decideSyncMode: DecideSyncMode, logger?: Logger);
    launch(): Promise<void>;
    get targetName(): string;
    get logPath(): string;
    get pdfPath(): string;
    get synctexPath(): string;
    private onOnline;
    private onOffline;
    reload(): Promise<void>;
    compile(): Promise<void>;
}
