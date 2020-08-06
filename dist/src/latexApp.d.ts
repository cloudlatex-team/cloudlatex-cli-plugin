import * as EventEmitter from 'eventemitter3';
import Logger from './logger';
import { Config, AppInfo, DecideSyncMode, Account } from './types';
declare type EventType = 'appinfo-updated' | 'start-sync' | 'failed-sync' | 'successfully-synced' | 'start-compile' | 'failed-compile' | 'successfully-compiled';
export default class LatexApp extends EventEmitter<EventType> {
    private decideSyncMode;
    private logger;
    private config;
    readonly appInfo: AppInfo;
    private fileAdapter;
    private fileRepo;
    private syncManager;
    private fileWatcher?;
    private backend;
    private account;
    private accountManager;
    constructor(config: Config, decideSyncMode: DecideSyncMode, logger?: Logger);
    /**
     * setup file management classes
     *
     * Instantiate fileAdapter, fileWatcher and syncManager.
     * The fileWatcher detects local changes.
     * The syncManager synchronize local files with remote ones.
     * The file Adapter abstructs file operations of local files and remote ones.
     */
    launch(): Promise<void>;
    relaunch(config: Config): Promise<void>;
    get targetName(): string;
    get logPath(): string;
    get pdfPath(): string;
    get synctexPath(): string;
    private onOnline;
    private onOffline;
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile(): Promise<void>;
    /**
     * Validate account
     *
     * @return Promise<'valid' | 'invalid' | 'offline'>
     */
    validateAccount(): Promise<'valid' | 'invalid' | 'offline'>;
    setAccount(account: Account): void;
    /**
     * Start to synchronize files with the remote server
     */
    startSync(forceCompile?: boolean): Promise<void>;
    /**
     * clear local changes to resolve sync problem
     */
    resetLocal(): Promise<void>;
    /**
     * stop watching file changes.
     */
    exit(): void;
}
export {};
