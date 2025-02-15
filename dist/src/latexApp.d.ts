import * as EventEmitter from 'eventemitter3';
import { Logger } from './util/logger';
import { Config, Account, CompileResult, ILatexApp, LoginResult, SyncResult, ConflictSolution, UpdateProjectInfoResult, UpdateProjectInfoParam, ListProjectsResult } from './types';
import { FileAdapter } from './fileService/fileAdapter';
import { Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC } from './model/fileModel';
import { IBackend } from './backend/ibackend';
import { AccountService } from './service/accountService';
import { AppInfoService } from './service/appInfoService';
import { SYNC_DESC } from './model/syncModel';
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
    private appInfoService;
    private backend;
    private fileAdapter;
    private fileRepo;
    private syncRepo;
    private logger;
    private syncManager;
    private fileWatcher;
    private compilationRunner;
    private emitFileChangeEvent;
    /**
     * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
     */
    constructor(config: Config, appInfoService: AppInfoService, backend: IBackend, fileAdapter: FileAdapter, fileRepo: Repository<typeof FILE_INFO_DESC>, syncRepo: Repository<typeof SYNC_DESC>, logger?: Logger);
    /**
     * setup file management classes
     *
     * Instantiate fileAdapter, fileWatcher and syncManager.
     * The fileWatcher detects local changes.
     * The syncManager synchronize local files with remote ones.
     * The file Adapter abstructs file operations of local files and remote ones.
     */
    static createApp(config: Config, option?: {
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
     * List projeect
     */
    listProjects(): Promise<ListProjectsResult>;
    /**
     * Stop watching file system
     */
    stop(): Promise<void>;
    private onValid;
    private onInvalid;
    private onOffline;
    /**
     * Update project info
     */
    updateProjectInfo(param: UpdateProjectInfoParam): Promise<UpdateProjectInfoResult>;
    /**
     * Synchronize files
     */
    sync(conflictSolution?: ConflictSolution): Promise<SyncResult>;
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
    resetLocal(): Promise<void>;
}
export {};
