import * as EventEmitter from 'eventemitter3';
import Logger from './logger';
import { Config, AppInfo, DecideSyncMode, Account } from './types';
export default class LatexApp extends EventEmitter {
    private decideSyncMode;
    private logger;
    private config;
    readonly appInfo: AppInfo;
    private fileAdapter;
    private fileRepo;
    private syncManager;
    private fileWatcher;
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
    startSync(): Promise<void>;
    /**
     * stop watching file changes.
     */
    exit(): void;
}
