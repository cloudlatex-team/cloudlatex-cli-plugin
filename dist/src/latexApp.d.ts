import * as EventEmitter from 'eventemitter3';
import Logger from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult, AppInfo } from './types';
import FileAdapter from './fileService/fileAdapter';
import { SyncResult } from './fileService/syncManager';
import { Repository } from '@moritanian/type-db';
import { FileInfoDesc } from './model/fileModel';
import Backend from './backend/ibackend';
import AccountService from './service/accountService';
import AppInfoService from './service/appInfoService';
declare type NoPayloadEvents = 'sync-failed' | 'file-changed';
declare class LAEventEmitter extends EventEmitter<''> {
}
interface LAEventEmitter {
    emit(eventName: NoPayloadEvents): boolean;
    on(eventName: NoPayloadEvents, callback: () => unknown): this;
    emit(eventName: 'network-updated', arg: boolean): void;
    on(eventName: 'network-updated', callback: (arg: boolean) => unknown): void;
    emit(eventName: 'project-loaded', arg: AppInfo): void;
    on(eventName: 'project-loaded', callback: (arg: AppInfo) => unknown): void;
    emit(eventName: 'successfully-synced', arg: SyncResult): void;
    on(eventName: 'successfully-synced', callback: (arg: SyncResult) => unknown): void;
}
export default class LatexApp extends LAEventEmitter {
    private config;
    private accountService;
    private appInfoService;
    private backend;
    private fileAdapter;
    private fileRepo;
    private logger;
    private syncManager;
    private fileWatcher;
    /**
     * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
     */
    constructor(config: Config, accountService: AccountService<Account>, appInfoService: AppInfoService, backend: Backend, fileAdapter: FileAdapter, fileRepo: Repository<typeof FileInfoDesc>, decideSyncMode: DecideSyncMode, logger?: Logger);
    get appInfo(): AppInfo;
    /**
     * setup file management classes
     *
     * Instantiate fileAdapter, fileWatcher and syncManager.
     * The fileWatcher detects local changes.
     * The syncManager synchronize local files with remote ones.
     * The file Adapter abstructs file operations of local files and remote ones.
     */
    static createApp(config: Config, option?: {
        decideSyncMode?: DecideSyncMode;
        logger?: Logger;
        accountService?: AccountService<Account>;
    }): Promise<LatexApp>;
    private static sanitizeConfig;
    /**
     * Start to watch file system
     */
    startFileWatcher(): Promise<void>;
    /**
     * Stop watching file system
     */
    stopFileWatcher(): void;
    private onOnline;
    private onOffline;
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile(): Promise<CompileResult>;
    /**
     * Validate account
     *
     * @return Promise<'valid' | 'invalid' | 'offline'>
     */
    validateAccount(): Promise<'valid' | 'invalid' | 'offline'>;
    /**
     * Set account
     *
     * @param account Account
     */
    setAccount(account: Account): void;
    /**
     * Start to synchronize files with the remote server
     */
    startSync(): Promise<void>;
    /**
     * clear local changes to resolve sync problem
     */
    resetLocal(): void;
}
export {};
