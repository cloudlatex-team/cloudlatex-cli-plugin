import * as EventEmitter from 'eventemitter3';
import Logger from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult, AppInfo } from './types';
import FileAdapter from './fileService/fileAdapter';
import { Repository } from '@moritanian/type-db';
import { FileInfoDesc } from './model/fileModel';
import Backend from './backend/ibackend';
import AccountService from './service/accountService';
import AppInfoService from './service/appInfoService';
declare type NoPayloadEvents = 'start-sync' | 'failed-sync' | 'successfully-synced' | 'start-compile';
declare class LAEventEmitter extends EventEmitter<''> {
}
interface LAEventEmitter {
    emit(eventName: NoPayloadEvents): boolean;
    on(eventName: NoPayloadEvents, callback: () => unknown): this;
    emit(eventName: 'successfully-compiled', result: CompileResult): void;
    on(eventName: 'successfully-compiled', callback: (result: CompileResult) => unknown): void;
    emit(eventName: 'failed-compile', result: CompileResult): void;
    on(eventName: 'failed-compile', callback: (result: CompileResult) => unknown): void;
    emit(eventName: 'updated-network', arg: boolean): void;
    on(eventName: 'updated-network', callback: (arg: boolean) => unknown): void;
    emit(eventName: 'loaded-project', arg: AppInfo): void;
    on(eventName: 'loaded-project', callback: (arg: AppInfo) => unknown): void;
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
     * Is required to compile initilally after launch app
     * and validate account
     */
    private initialCompile;
    /**
     * Do not use this constructor and instantiate LatexApp by createApp()
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
    /**
     * Launch application
     */
    launch(): Promise<void>;
    /**
     * Relaunch app to change config
     *
     * @param config
     */
    relaunch(config: Config, accountService?: AccountService<Account>): Promise<void>;
    private onOnline;
    private onOffline;
    private loadProjectInfo;
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
    resetLocal(): Promise<void>;
    /**
     * stop watching file changes.
     */
    exit(): void;
}
export {};
