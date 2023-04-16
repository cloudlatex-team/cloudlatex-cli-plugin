import * as EventEmitter from 'eventemitter3';
import { Logger } from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult, ILatexApp, LoginResult, SyncResult } from './types';
import { FileAdapter } from './fileService/fileAdapter';
import { Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC } from './model/fileModel';
import { IBackend } from './backend/ibackend';
import { AccountService } from './service/accountService';
import { AppInfoService } from './service/appInfoService';
export declare const LATEX_APP_EVENTS: {
    readonly FILE_CHANGED: "file-changed";
    readonly FILE_CHANGE_ERROR: "file-change-error";
};
declare type NoPayloadEvents = typeof LATEX_APP_EVENTS.FILE_CHANGED;
declare type ErrorEvents = typeof LATEX_APP_EVENTS.FILE_CHANGE_ERROR;
declare class LAEventEmitter extends EventEmitter<''> {
}
interface LAEventEmitter {
    emit(eventName: NoPayloadEvents): boolean;
    on(eventName: NoPayloadEvents, callback: () => unknown): this;
    emit(eventName: ErrorEvents, detail: string): boolean;
    on(eventName: ErrorEvents, callback: (detail: string) => unknown): this;
}
export declare class LatexApp extends LAEventEmitter implements ILatexApp {
    private config;
    private accountService;
    private appInfoService;
    private backend;
    private fileAdapter;
    private fileRepo;
    private logger;
    private syncManager;
    private fileWatcher;
    private compilationRunner;
    /**
     * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
     */
    constructor(config: Config, accountService: AccountService<Account>, appInfoService: AppInfoService, backend: IBackend, fileAdapter: FileAdapter, fileRepo: Repository<typeof FILE_INFO_DESC>, decideSyncMode: DecideSyncMode, logger?: Logger);
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
    start(): Promise<LoginResult>;
    /**
     * Login
     */
    login(): Promise<LoginResult>;
    /**
     * Stop watching file system
     */
    stop(): Promise<void>;
    private onValid;
    private onInvalid;
    private onOffline;
    sync(): Promise<SyncResult>;
    /**
     * Compile and save pdf, synctex and log files.
     */
    compile(): Promise<CompileResult>;
    private execCompile;
    private downloadCompilationArtifacts;
    /**
     * Validate account
     *
     * @return Promise<'valid' | 'invalid' | 'offline'>
     */
    private validateAccount;
    private loadProject;
    /**
     * clear local changes to resolve sync problem
     */
    resetLocal(): void;
}
export {};
