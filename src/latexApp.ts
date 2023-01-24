import * as path from 'path';
import { Matcher } from 'anymatch';
import * as  EventEmitter from 'eventemitter3';
import { Logger, getErrorTraceStr } from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult, AppInfo } from './types';
import { FileAdapter } from './fileService/fileAdapter';
import { SyncManager, SyncResult } from './fileService/syncManager';
import { FileWatcher } from './fileService/fileWatcher';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC } from './model/fileModel';
import { IBackend } from './backend/ibackend';
import { backendSelector } from './backend/backendSelector';
import { AccountService } from './service/accountService';
import { AppInfoService } from './service/appInfoService';

/* eslint-disable @typescript-eslint/naming-convention */
export const LATEX_APP_EVENTS = {
  FILE_CHANGED: 'file-changed', /* LaTeX source files are changed */
  FILE_SYNC_SUCCEEDED: 'file-sync-succeeded', /* Succeeded to synchonize LaTeX source files between local and cloud */
  FILE_SYNC_FAILED: 'file-sync-failed', /* Failed to synchonize LaTeX source files */
  FILE_CHANGE_ERROR: 'file-change-error', /* Invalid LaTeX file chagnes are detected */
  TARGET_FILE_NOT_FOUND: 'target-file-not-found', /* LaTeX target file is not found */
  COMPILATION_STARTED: 'compilation-started', /* LaTeX compilation is started */
  COMPILATION_SUCCEEDED: 'compilation-succeeded', /* Succeeded to compile LaTeX source files */
  COMPILATION_FAILED: 'compilation-failed', /* Failed to compile LaTeX source files */
  LOGIN_SUCCEEDED: 'login-succeeded', /* Succeeded to login */
  LOGIN_FAILED: 'login-failed', /* Failed to login */
  LOGIN_OFFLINE: 'login-offline', /* Cannot login due to network problem */
  PROJECT_LOADED: 'project-loaded', /* Project infomantion is loaded */
  UNEXPECTED_ERROR: 'unexpected-error', /* Unexpected error */
} as const;
/* eslint-enable @typescript-eslint/naming-convention */


type NoPayloadEvents = typeof LATEX_APP_EVENTS.FILE_CHANGED | typeof LATEX_APP_EVENTS.LOGIN_SUCCEEDED
  | typeof LATEX_APP_EVENTS.LOGIN_FAILED | typeof LATEX_APP_EVENTS.LOGIN_OFFLINE
  | typeof LATEX_APP_EVENTS.COMPILATION_STARTED;
type ErrorEvents = typeof LATEX_APP_EVENTS.FILE_SYNC_FAILED
  | typeof LATEX_APP_EVENTS.FILE_CHANGE_ERROR | typeof LATEX_APP_EVENTS.TARGET_FILE_NOT_FOUND
  | typeof LATEX_APP_EVENTS.UNEXPECTED_ERROR;
type CompilationResultEvents = typeof LATEX_APP_EVENTS.COMPILATION_FAILED
  | typeof LATEX_APP_EVENTS.COMPILATION_SUCCEEDED;
class LAEventEmitter extends EventEmitter<''> {
}
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
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
/* eslint-enable @typescript-eslint/adjacent-overload-signatures */

// TODO relative/absolute url
// chokidar can accept both relative and absolute pattern
// how about filter function??
// TODO: add file in out dir

const SYSTEM_IGNORED_FILES = [
  '**/.git/**',
  '**/node_modules/**',
  '**/.DS_Store',
];

const DEFAULT_USER_IGNORED_FILES = [
  '**/*.aux',
  '**/*.bbl',
  '**/*.bcf',
  '**/*.blg',
  '**/*.idx',
  '**/*.ind',
  '**/*.lof',
  '**/*.lot',
  '**/*.out',
  '**/*.toc',
  '**/*.acn',
  '**/*.acr',
  '**/*.alg',
  '**/*.glg',
  '**/*.glo',
  '**/*.gls',
  '**/*.ist',
  '**/*.fls',
  '**/*.log',
  '**/*.nav',
  '**/*.snm',
  '**/*.fdb_latexmk',
  '**/*.synctex.gz',
  '**/*.run.xml',
];

export class LatexApp extends LAEventEmitter {
  private syncManager: SyncManager;
  private fileWatcher: FileWatcher;

  /**
   * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
   */
  constructor(
    private config: Config,
    private accountService: AccountService<Account>,
    private appInfoService: AppInfoService,
    private backend: IBackend,
    private fileAdapter: FileAdapter,
    private fileRepo: Repository<typeof FILE_INFO_DESC>,
    decideSyncMode: DecideSyncMode,
    private logger: Logger = new Logger()) {
    super();

    /**
     * Sync Manager
     */
    this.syncManager = new SyncManager(fileRepo, fileAdapter,
      async (conflictFiles) => {
        appInfoService.setConflicts(conflictFiles);
        return decideSyncMode(conflictFiles);
      }
      , logger);

    this.syncManager.on('sync-finished', (result) => {
      if (result.success) {
        this.emit(LATEX_APP_EVENTS.FILE_SYNC_SUCCEEDED, result);
      } else if (result.canceled) {
        // canceled
      } else {
        const msg = result.errors.join('\n');
        this.logger.error('Error in synchronizing files: ' + msg);
        this.emit(LATEX_APP_EVENTS.FILE_SYNC_FAILED, msg);
      }
    });

    this.syncManager.on('error', (msg) => {
      this.emit(LATEX_APP_EVENTS.FILE_CHANGE_ERROR, msg);
    });

    /**
     * File watcher
     */
    const isGeneratedFiles = (absPath: string) => {
      const relativePath = path.posix.relative(this.config.rootPath, absPath);
      return [
        appInfoService.appInfo.logPath,
        appInfoService.appInfo.pdfPath,
        appInfoService.appInfo.synctexPath
      ].includes(relativePath);
    };

    const ignoreFiles: Matcher = [
      ...SYSTEM_IGNORED_FILES,
      isGeneratedFiles,
    ];

    if (config.ignoreFiles) {
      if (Array.isArray(config.ignoreFiles)) {
        ignoreFiles.push(...config.ignoreFiles);
      } else {
        ignoreFiles.push(config.ignoreFiles);
      }
    } else {
      ignoreFiles.push(...DEFAULT_USER_IGNORED_FILES);
    }

    this.logger.log(`ignoreFiles: ${JSON.stringify(ignoreFiles)}`);


    this.fileWatcher = new FileWatcher(this.config.rootPath, fileRepo,
      {
        ignored: ignoreFiles,
        logger
      });

    this.fileWatcher.on('change-detected', async () => {
      this.emit(LATEX_APP_EVENTS.FILE_CHANGED);
    });

    this.fileWatcher.on('error', (err) => {
      this.emit(LATEX_APP_EVENTS.FILE_CHANGE_ERROR, err);
    });
  }

  get appInfo(): AppInfo {
    return this.appInfoService.appInfo;
  }

  /**
   * setup file management classes
   *
   * Instantiate fileAdapter, fileWatcher and syncManager.
   * The fileWatcher detects local changes.
   * The syncManager synchronize local files with remote ones.
   * The file Adapter abstructs file operations of local files and remote ones.
   */
  static async createApp(config: Config, option: {
    decideSyncMode?: DecideSyncMode,
    logger?: Logger,
    accountService?: AccountService<Account>
  } = {}): Promise<LatexApp> {

    const logger = option.logger || new Logger();
    logger.log(`latex-cli ${'1.0.0'}`);

    // Config
    config = this.sanitizeConfig(config);

    // Account
    const accountService = option.accountService || new AccountService();
    await accountService.load();

    // AppInfo
    const appInfoService = new AppInfoService(config);

    // Backend
    const backend = backendSelector(config, accountService);

    // DB
    const dbFilePath = config.storagePath ? path.join(
      config.storagePath, `.${config.projectId}-${config.backend}.json`
    ) : undefined;
    const db = new TypeDB(dbFilePath);
    try {
      await db.load();
    } catch (err) {
      // Not initialized because there is no db file.
    }
    const fileRepo = db.getRepository(FILE_INFO_DESC);
    fileRepo.all().forEach(file => {
      file.watcherSynced = true;
    });
    fileRepo.save();

    const fileAdapter = new FileAdapter(config.rootPath, fileRepo, backend);
    const defaultDecideSyncMode: DecideSyncMode = () => Promise.resolve('upload');
    const decideSyncMode: DecideSyncMode = option.decideSyncMode || defaultDecideSyncMode;
    return new LatexApp(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger);
  }

  private static sanitizeConfig(config: Config): Config {
    const outDir = config.outDir || config.rootPath;
    let relativeOutDir = path.isAbsolute(outDir) ?
      path.relative(config.rootPath, outDir) :
      path.join(outDir);
    relativeOutDir = relativeOutDir.replace(/\\/g, path.posix.sep); // for windows
    const rootPath = config.rootPath.replace(/\\/g, path.posix.sep); // for windows
    if (relativeOutDir === path.posix.sep || relativeOutDir === `.${path.posix.sep}`) {
      relativeOutDir = '';
    }
    return { ...config, outDir: relativeOutDir, rootPath };
  }

  /**
   * Start to watch file system
   */
  public startFileWatcher(): Promise<void> {
    return this.fileWatcher.init();
  }


  /**
   * Stop watching file system
   */
  public stopFileWatcher(): Promise<void> {
    return this.fileWatcher.stop();
  }

  private onValid() {
    if (this.appInfoService.appInfo.loginStatus === 'valid') {
      return;
    }
    this.logger.info('Login Successful');
    this.appInfoService.setLoginStatus('valid');
    this.emit(LATEX_APP_EVENTS.LOGIN_SUCCEEDED);
  }

  private onInvalid() {
    if (this.appInfoService.appInfo.loginStatus === 'invalid') {
      return;
    }
    this.logger.info('Login failed.');
    this.appInfoService.setLoginStatus('invalid');
    this.emit(LATEX_APP_EVENTS.LOGIN_FAILED);
  }

  private onOffline() {
    if (this.appInfoService.appInfo.loginStatus === 'offline') {
      return;
    }
    this.logger.warn('Cannot connect to the server');
    this.appInfoService.setLoginStatus('offline');
    this.emit(LATEX_APP_EVENTS.LOGIN_OFFLINE);
  }

  /**
   * Compile and save pdf, synctex and log files.
   */
  public async compile(): Promise<CompileResult> {
    this.logger.log('Start compiling');
    this.emit(LATEX_APP_EVENTS.COMPILATION_STARTED);
    try {
      if (!this.appInfoService.appInfo.loaded) {
        const projectInfo = await this.backend.loadProjectInfo();
        const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
        if (!file) {
          this.logger.error('Target file is not found');
          this.emit(LATEX_APP_EVENTS.TARGET_FILE_NOT_FOUND, '');
          return { status: 'no-target-error' };
        }
        const targetName = path.posix.basename(file.relativePath, '.tex');
        this.appInfoService.setProjectName(projectInfo.title);
        this.appInfoService.setTarget(projectInfo.compile_target_file_id, targetName);
        this.appInfoService.setLoaded();
        this.emit(LATEX_APP_EVENTS.PROJECT_LOADED, this.appInfo);
      }

      const result = await this.backend.compileProject();

      if (result.status !== 'success') {
        this.emit(LATEX_APP_EVENTS.COMPILATION_FAILED, result);
        return result;
      }

      const promises = [];

      // download log file
      if (result.logStream) {
        if (this.appInfoService.appInfo.logPath) {
          promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath, result.logStream).catch(err => {
            const msg = 'Some error occurred with saving a log file.';
            this.logger.error(msg + getErrorTraceStr(err));
            this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
          }));
        } else {
          const msg = 'Log file path is not set';
          this.logger.error(msg);
          this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);

        }
      }

      // download pdf
      if (result.pdfStream) {
        if (this.appInfoService.appInfo.pdfPath) {
          promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath, result.pdfStream).catch(err => {
            const msg = 'Some error occurred with downloading the compiled pdf file.';
            this.logger.error(msg + getErrorTraceStr(err));
            this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
          }));
        } else {
          const msg = 'PDF file path is not set';
          this.logger.error(msg);
          this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
        }
      }

      // download synctex
      if (result.synctexStream) {
        if (this.appInfoService.appInfo.synctexPath) {
          promises.push(
            this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath, result.synctexStream).catch(err => {
              const msg = 'Some error occurred with saving a synctex file.';
              this.logger.error(msg + getErrorTraceStr(err));
              this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);

            })
          );
        } else {
          const msg = 'Synctex file path is not set';
          this.logger.error(msg);
          this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
        }
      }

      // wait to download all files
      await Promise.all(promises);

      this.logger.log('Sucessfully compiled');
      this.emit(LATEX_APP_EVENTS.COMPILATION_SUCCEEDED, result);

      return result;
    } catch (err) {
      const msg = 'Some error occurred with compiling.';
      this.logger.warn(msg + getErrorTraceStr(err));
      this.emit(LATEX_APP_EVENTS.UNEXPECTED_ERROR, msg);
      return { status: 'unknown-error' };
    }
  }

  /**
   * Validate account
   *
   * @return Promise<'valid' | 'invalid' | 'offline'>
   */
  public async validateAccount(): Promise<'valid' | 'invalid' | 'offline'> {
    try {
      const result = await this.backend.validateToken();
      if (!result) {
        this.onInvalid();
        return 'invalid';
      }
    } catch (err) {
      this.onOffline();
      return 'offline';
    }
    this.onValid();
    return 'valid';
  }

  /**
   * Set account
   *
   * @param account Account
   */
  public setAccount(account: Account): void {
    this.accountService.save(account);
  }

  /**
   * Start to synchronize files with the remote server
   */
  public async startSync(): Promise<void> {
    await this.syncManager.syncSession();
  }

  /**
   * clear local changes to resolve sync problem
   */
  public resetLocal(): void {
    this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
  }
}
