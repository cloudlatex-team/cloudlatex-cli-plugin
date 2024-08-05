import EventEmitter from 'eventemitter3';
import { version } from '../package.json';
import { Logger, getErrorTraceStr } from './util/logger';
import {
  Config, Account, CompileResult, ILatexApp, LoginResult, SyncResult,
  ConflictSolution, UpdateProjectInfoResult, UpdateProjectInfoParam
} from './types';
import { FileAdapter } from './fileService/fileAdapter';
import { SyncManager } from './fileService/syncManager';
import { FileWatcher } from './fileService/fileWatcher';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FileInfo, FILE_INFO_DESC } from './model/fileModel';
import { IBackend, CompileResult as BackendCompileResult } from './backend/ibackend';
import { backendSelector } from './backend/backendSelector';
import { AccountService } from './service/accountService';
import { AppInfoService } from './service/appInfoService';
import {
  calcIgnoredFiles, calcRelativeOutDir, getDBFilePath, toPosixPath, checkIgnoredByFileInfo
} from './fileService/filePath';
import { AsyncRunner } from './util/asyncRunner';

/* eslint-disable @typescript-eslint/naming-convention */
export const LATEX_APP_EVENTS = {
  FILE_CHANGED: 'file-changed', /* LaTeX source files are changed */
  FILE_CHANGE_ERROR: 'file-change-error', /* Invalid LaTeX file chagnes are detected */
} as const;
/* eslint-enable @typescript-eslint/naming-convention */


type NoPayloadEvents = typeof LATEX_APP_EVENTS.FILE_CHANGED;
type ErrorEvents = typeof LATEX_APP_EVENTS.FILE_CHANGE_ERROR;
class LAEventEmitter extends EventEmitter<''> {
}
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
interface LAEventEmitter {
  emit(eventName: NoPayloadEvents): boolean;
  on(eventName: NoPayloadEvents, callback: () => unknown): this;
  emit(eventName: ErrorEvents, detail: string): boolean;
  on(eventName: ErrorEvents, callback: (detail: string) => unknown): this;
}

/* eslint-enable @typescript-eslint/adjacent-overload-signatures */


export class LatexApp extends LAEventEmitter implements ILatexApp {
  private syncManager: SyncManager;
  private fileWatcher: FileWatcher;
  private compilationRunner: AsyncRunner<CompileResult>;

  /**
   * Do not use this constructor. Be sure to instantiate LatexApp by createApp()
   */
  constructor(
    private config: Config,
    private appInfoService: AppInfoService,
    private backend: IBackend,
    private fileAdapter: FileAdapter,
    private fileRepo: Repository<typeof FILE_INFO_DESC>,
    private logger: Logger = new Logger(),
  ) {
    super();

    this.compilationRunner = new AsyncRunner(() => this.execCompile());

    /**
     * Ignore file setting
     */
    const ignoredFiles = calcIgnoredFiles(this.appInfoService);

    const checkIgnored = (file: FileInfo) => {
      return checkIgnoredByFileInfo(this.config, file, ignoredFiles);
    };

    this.logger.log(`IgnoredFiles: ${JSON.stringify(ignoredFiles)}`);


    /**
     * Sync Manager
     */
    this.syncManager = new SyncManager(fileRepo, fileAdapter, logger, checkIgnored);


    /**
     * File watcher
     */
    this.fileWatcher = new FileWatcher(this.config, fileRepo,
      {
        ignored: ignoredFiles,
        logger
      });

    this.fileWatcher.on('change-detected', async () => {
      this.emit(LATEX_APP_EVENTS.FILE_CHANGED);
    });

    this.fileWatcher.on('error', (err) => {
      this.emit(LATEX_APP_EVENTS.FILE_CHANGE_ERROR, err);
    });
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
    logger?: Logger,
    accountService?: AccountService<Account>
  } = {}): Promise<LatexApp> {

    const logger = option.logger || new Logger();
    logger.log(`latex-cli ${version}`);

    // Config
    config = this.sanitizeConfig(config);

    // Account
    const accountService = option.accountService || new AccountService();
    await accountService.load();

    // Backend
    const backend = backendSelector(config, accountService);

    // DB
    const dbFilePath = getDBFilePath(config);
    const db = new TypeDB(dbFilePath);
    try {
      await db.load();
    } catch (err) {
      // Not initialized because there is no db file.
    }
    const fileRepo = db.getRepository(FILE_INFO_DESC);

    const fileAdapter = new FileAdapter(config.rootPath, fileRepo, backend);

    // AppInfo
    const appInfoService = new AppInfoService(config, fileRepo);

    return new LatexApp(config, appInfoService, backend, fileAdapter, fileRepo, logger);
  }

  private static sanitizeConfig(config: Config): Config {
    const outDir = calcRelativeOutDir(config);
    const rootPath = toPosixPath(config.rootPath);
    return { ...config, outDir, rootPath };
  }

  /**
   * Start to watch file system
   */
  public async start(): Promise<LoginResult> {
    // Login
    const loginResult = await this.login();

    // Start file watcher
    await this.fileWatcher.init();

    return loginResult;
  }

  /**
   * Login
   */
  public async login(): Promise<LoginResult> {
    // Validate account
    const accountValidation = await this.validateAccount();
    if (accountValidation === 'offline') {
      return {
        status: 'offline',
        appInfo: this.appInfoService.appInfo,
      };
    } else if (accountValidation === 'invalid') {
      return {
        status: 'invalid-account',
        appInfo: this.appInfoService.appInfo,
      };
    } else if (accountValidation === 'valid') {

      if (!this.appInfoService.appInfo.loaded && this.config.projectId) {

        const loadResult = await this.loadProject();
        if (loadResult !== 'success') {
          return {
            status: loadResult,
            appInfo: this.appInfoService.appInfo,
          };
        }
      }

      return {
        status: 'success',
        appInfo: this.appInfoService.appInfo
      };
    }

    return {
      status: 'unknown-error',
      appInfo: this.appInfoService.appInfo,
    };
  }

  /**
   * Stop watching file system
   */
  public async stop(): Promise<void> {
    // Stop watching file system
    await this.fileWatcher.stop();

    // Remove all event listeners
    this.removeAllListeners();
  }

  private onValid() {
    if (this.appInfoService.appInfo.loginStatus === 'valid') {
      return;
    }
    this.logger.info('Login Successful');
    this.appInfoService.setLoginStatus('valid');
  }

  private onInvalid() {
    this.logger.info('Login failed.');
    if (this.appInfoService.appInfo.loginStatus === 'invalid') {
      return;
    }
    this.appInfoService.setLoginStatus('invalid');
  }

  private onOffline() {
    this.logger.warn('Cannot connect to the server');
    if (this.appInfoService.appInfo.loginStatus === 'offline') {
      return;
    }
    this.appInfoService.setLoginStatus('offline');
  }

  /**
   * Update project info
   */
  public async updateProjectInfo(param: UpdateProjectInfoParam): Promise<UpdateProjectInfoResult> {
    // Login
    const loginResult = await this.login();
    if (loginResult.status !== 'success') {
      return loginResult;
    }

    try {
      await this.backend.updateProjectInfo(param);
      this.logger.info('Project info updated');

      const result = await this.loadProject();
      return { status: result, appInfo: this.appInfoService.appInfo };
    } catch (err) {
      const msg = 'Some error occurred with updating project info ';
      this.logger.warn(msg + getErrorTraceStr(err));
      return {
        status: 'unknown-error',
        appInfo: this.appInfoService.appInfo,
        errors: [msg],
      };
    }
  }

  /**
   * Synchronize files
   */
  public async sync(conflictSolution?: ConflictSolution): Promise<SyncResult> {
    // Login
    const loginResult = await this.login();
    if (loginResult.status !== 'success') {
      return loginResult;
    }

    // File synchronization
    const result = await this.syncManager.sync(conflictSolution);

    const status = result.conflict
      ? 'conflict'
      : result.success ? 'success' : 'unknown-error';
    return {
      status,
      errors: result.errors,
      appInfo: this.appInfoService.appInfo,
    };
  }

  /**
   * Compile and save pdf, synctex and log files.
   */
  public async compile(): Promise<CompileResult> {
    return this.compilationRunner.run();
  }

  private async execCompile(): Promise<CompileResult> {
    this.logger.log('Compilation is started');

    const errors: string[] = [];

    // Load project data if not yet
    if (!this.appInfoService.appInfo.loaded) {
      const loadProjectResult = await this.loadProject();
      if (loadProjectResult !== 'success') {
        return {
          status: loadProjectResult,
          appInfo: this.appInfoService.appInfo,

        };
      }
    }

    try {
      // Compile
      const result = await this.backend.compileProject();
      if (result.status !== 'success') {
        this.logger.log('Compilation is finished with some errors');
        return {
          ...result,
          appInfo: this.appInfoService.appInfo,
        };
      }

      // Download artifacts
      errors.push(...await this.downloadCompilationArtifacts(result));

      this.logger.log('Compilation is finished');

      return {
        ...result,
        errors,
        appInfo: this.appInfoService.appInfo,
      };
    } catch (err) {
      const msg = 'Some error occurred with compiling: ';
      this.logger.warn(msg + getErrorTraceStr(err));
      errors.push(msg);
      return {
        status: 'unknown-error', errors,
        appInfo: this.appInfoService.appInfo,
      };
    }
  }

  private async downloadCompilationArtifacts(result: BackendCompileResult) {
    const promises = [];
    const errors = [];

    // download log file
    if (result.logStream) {
      if (this.appInfoService.appInfo.logPath) {
        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath, result.logStream).catch(err => {
          const msg = 'Some error occurred with saving a log file.';
          this.logger.error(msg + getErrorTraceStr(err));
          errors.push(msg);
        }));
      } else {
        const msg = 'Log file path is not set';
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    // download pdf
    if (result.pdfStream) {
      if (this.appInfoService.appInfo.pdfPath) {
        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath, result.pdfStream).catch(err => {
          const msg = 'Some error occurred with downloading the compiled pdf file.';
          this.logger.error(msg + getErrorTraceStr(err));
          errors.push(msg);
        }));
      } else {
        const msg = 'PDF file path is not set';
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    // download synctex
    if (result.synctexStream) {
      if (this.appInfoService.appInfo.synctexPath) {
        promises.push(
          this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath, result.synctexStream).catch(err => {
            const msg = 'Some error occurred with saving a synctex file.';
            this.logger.error(msg + getErrorTraceStr(err));
            errors.push(msg);
          })
        );
      } else {
        const msg = 'Synctex file path is not set';
        this.logger.error(msg);
        errors.push(msg);
      }
    }

    // wait to download all files
    await Promise.all(promises);

    return errors;
  }

  /**
   * Validate account
   *
   * @return Promise<'valid' | 'invalid' | 'offline'>
   */
  private async validateAccount(): Promise<'valid' | 'invalid' | 'offline'> {
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

  private async loadProject(): Promise<'success' | 'no-target-error' | 'unknown-error'> {
    try {
      const projectInfo = await this.backend.loadProjectInfo();
      const fileList = await this.backend.loadFileList();
      const targetFile = fileList.find(file => file.remoteId === projectInfo.compileTargetFileRemoteId);
      if (!targetFile) {
        this.logger.error(`Target file ${projectInfo.compileTargetFileRemoteId} is not found`);
        return 'no-target-error';
      }
      this.appInfoService.onProjectLoaded(projectInfo);
      return 'success';
    } catch (err) {
      this.logger.error(getErrorTraceStr(err));
      return 'unknown-error';
    }
  }


  /**
   * clear local changes to resolve sync problem
   */
  public resetLocal(): void {
    this.logger.info('resetLocal()');
    this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.fileRepo.save();
  }
}
