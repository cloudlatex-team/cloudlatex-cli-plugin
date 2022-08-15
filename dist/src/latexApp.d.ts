import * as EventEmitter from 'eventemitter3';
import { Logger } from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult, AppInfo } from './types';
import { FileAdapter } from './fileService/fileAdapter';
import { SyncResult } from './fileService/syncManager';
import { Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC } from './model/fileModel';
import { IBackend } from './backend/ibackend';
import { AccountService } from './service/accountService';
import { AppInfoService } from './service/appInfoService';
export declare const LATEX_APP_EVENTS: {
    readonly FILE_CHANGED: "file-changed";
    readonly FILE_SYNC_SUCCEEDED: "file-sync-succeeded";
    readonly FILE_SYNC_FAILED: "file-sync-failed";
    readonly FILE_CHANGE_ERROR: "file-change-error";
    readonly TARGET_FILE_NOT_FOUND: "target-file-not-found";
    readonly COMPILATION_STARTED: "compilation-started";
    readonly COMPILATION_SUCCEEDED: "compilation-succeeded";
    readonly COMPILATION_FAILED: "compilation-failed";
    readonly LOGIN_SUCCEEDED: "login-succeeded";
    readonly LOGIN_FAILED: "login-failed";
    readonly LOGIN_OFFLINE: "login-offline";
    readonly PROJECT_LOADED: "project-loaded";
    readonly UNEXPECTED_ERROR: "unexpected-error";
};
declare type NoPayloadEvents = typeof LATEX_APP_EVENTS.FILE_CHANGED | typeof LATEX_APP_EVENTS.LOGIN_SUCCEEDED | typeof LATEX_APP_EVENTS.LOGIN_FAILED | typeof LATEX_APP_EVENTS.LOGIN_OFFLINE | typeof LATEX_APP_EVENTS.COMPILATION_STARTED;
declare type ErrorEvents = typeof LATEX_APP_EVENTS.FILE_SYNC_FAILED | typeof LATEX_APP_EVENTS.FILE_CHANGE_ERROR | typeof LATEX_APP_EVENTS.TARGET_FILE_NOT_FOUND | typeof LATEX_APP_EVENTS.UNEXPECTED_ERROR;
declare type CompilationResultEvents = typeof LATEX_APP_EVENTS.COMPILATION_FAILED | typeof LATEX_APP_EVENTS.COMPILATION_SUCCEEDED;
declare class LAEventEmitter extends EventEmitter<''> {
}
interface LAEventEmitter {
    emit(eventName: NoPayloadEvents): boolean;
    on(eventName: NoPayloadEvents, callback: () => unknown): this;
    emit(eventName: ErrorEvents, detail: string): boolean;
    on(eventName: ErrorEvents, callback: (detail: string) => unknown): this;
    emit(eventName: CompilationResultEvents, arg: CompileResult): boolean;
    on(eventName: CompilationResultEvents, callback: (arg: CompileResult) => unknown): this;
    emit(eventName: typeof LATEX_APP_EVENTS.PROJECT_LOADED, arg: AppInfo): boolean;
    on(eventName: typeof LATEX_APP_EVENTS.PROJECT_LOADED, callback: (arg: AppInfo) => unknown): this;
    emit(eventName: typeof LATEX_APP_EVENTS.FILE_SYNC_SUCCEEDED, arg: SyncResult): boolean;
    on(eventName: typeof LATEX_APP_EVENTS.FILE_SYNC_SUCCEEDED, callback: (arg: SyncResult) => unknown): this;
}
export declare class LatexApp extends LAEventEmitter {
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
    constructor(config: Config, accountService: AccountService<Account>, appInfoService: AppInfoService, backend: IBackend, fileAdapter: FileAdapter, fileRepo: Repository<typeof FILE_INFO_DESC>, decideSyncMode: DecideSyncMode, logger?: Logger);
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
    stopFileWatcher(): Promise<void>;
    private onValid;
    private onInvalid;
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
