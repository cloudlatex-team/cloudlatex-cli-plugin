import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import Logger from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult, CompileStatus, AppInfo } from './types';
import FileAdapter from './fileService/fileAdapter';
import SyncManager from './fileService/syncManager';
import FileWatcher from './fileService/fileWatcher';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FileInfoDesc } from './model/fileModel';
import Backend from './backend/ibackend';
import backendSelector from './backend/backendSelector';
import AccountService from './service/accountService';
import AppInfoService from './service/appInfoService';

type NoPayloadEvents = 'start-sync' | 'failed-sync' | 'successfully-synced' | 'start-compile';
class LAEventEmitter extends EventEmitter<''> {
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

const IgnoreFiles = [
  '*.aux',
  '*.bbl',
  '*.blg',
  '*.idx',
  '*.ind',
  '*.lof',
  '*.lot',
  '*.out',
  '*.toc',
  '*.acn',
  '*.acr',
  '*.alg',
  '*.glg',
  '*.glo',
  '*.gls',
  '*.fls',
  '*.log',
  '*.fdb_latexmk',
  '*.snm',
  '*.synctex',
  '*.synctex(busy)',
  '*.synctex.gz(busy)',
  '*.nav'
];

const wildcard2regexp = (wildcardExp: string) => {
  return '^' + wildcardExp.replace(/\./g, '\\\.').replace(/\*/g, '.*').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + '$';
};

export default class LatexApp extends LAEventEmitter {
  private syncManager: SyncManager;
  private fileWatcher: FileWatcher;
  /**
   * Is required to compile initilally after launch app
   * and validate account
   */
  private initialCompile = false;

  /**
   * Do not use this constructor and instantiate LatexApp by createApp()
   */
  constructor(
    private config: Config,
    private accountService: AccountService<Account>,
    private appInfoService: AppInfoService,
    private backend: Backend,
    private fileAdapter: FileAdapter,
    private fileRepo: Repository<typeof FileInfoDesc>,
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
        this.emit('successfully-synced');
        if (this.initialCompile || (result.fileChanged && this.config.autoCompile)) {
          this.initialCompile = false;
          this.compile();
        }
      } else if (result.canceled) {
      } else {
        this.logger.error('error in syncSession: ' + result.errors.join('\n'));
        this.emit('failed-sync');
      }
    });

    /**
     * File watcher
     */
    this.fileWatcher = new FileWatcher(this.config.rootPath, fileRepo,
      relativePath => {
        return ![
          this.config.outDir,
          appInfoService.appInfo.logPath,
          appInfoService.appInfo.pdfPath,
          appInfoService.appInfo.synctexPath
        ].includes(relativePath) &&
          !IgnoreFiles
            .some(ignoreFile => relativePath.match(wildcard2regexp(ignoreFile)));
      },
      logger);

    this.fileWatcher.on('change-detected', async () => {
      const result = await this.validateAccount();
      if (result === 'invalid') {
        this.logger.error('Your account is invalid.');
        return;
      }
      if (result === 'offline') {
        return;
      }
      this.startSync();
    });
  }

  get appInfo() {
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

    // Config
    const relativeOutDir = path.isAbsolute(config.outDir) ?
      path.relative(config.rootPath, config.outDir) :
      path.join(config.outDir);
    config = { ...config, outDir: relativeOutDir };

    // Account
    const accountService = option.accountService || new AccountService();
    await accountService.load();

    // AppInfo
    const appInfoService = new AppInfoService(config);

    // Backend
    const backend = backendSelector(config, accountService);


    // DB
    const dbFilePath = path.join(config.storagePath, `.${config.projectId}-${config.backend}.json`);
    const db = new TypeDB(dbFilePath);
    try {
      await db.load();
    } catch (err) {
      // Not initialized because there is no db file.
    }
    const fileRepo = db.getRepository(FileInfoDesc);
    fileRepo.all().forEach(file => {
      file.watcherSynced = true;
    });
    fileRepo.save();

    // logger
    const logger = option.logger || new Logger();
    const fileAdapter = new FileAdapter(config.rootPath, fileRepo, backend);
    const defaultDecideSyncMode: DecideSyncMode = () => Promise.resolve('upload');
    const decideSyncMode: DecideSyncMode = option.decideSyncMode || defaultDecideSyncMode;
    return new LatexApp(config, accountService, appInfoService, backend, fileAdapter, fileRepo, decideSyncMode, logger);
  }

  /**
   * Launch application
   */
  public async launch() {
    await this.fileWatcher.init();
    if (await this.validateAccount() !== 'valid') {
      return;
    }
    if (this.config.autoCompile) {
      this.initialCompile = true;
    }
    this.startSync();
  }

  /**
   * Relaunch app to change config
   *
   * @param config
   */
  async relaunch(config: Config, accountService?: AccountService<Account>) {
    this.exit();
    this.config = { ...config, outDir: path.join(config.outDir) };
    if (accountService) {
      this.accountService = accountService;
    }
    this.backend = backendSelector(config, this.accountService);
    this.launch();
  }

  private onOnline() {
    if (!this.appInfoService.appInfo.offline) {
      return;
    }
    this.appInfoService.setOnline();
    this.logger.info('Your account has been validated!');
    this.emit('updated-network', this.appInfoService.appInfo.offline);
  }

  private onOffline() {
    if (this.appInfoService.appInfo.offline) {
      return;
    }
    this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
    this.appInfoService.setOffLine();
    this.emit('updated-network', this.appInfo.offline);
  }

  private async loadProjectInfo() {
    const projectInfo = await this.backend.loadProjectInfo();
    const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
    if (!file) {
      this.logger.error('Target file is not found');
      this.emit('failed-compile', { status: 'no-target-error' });
      return;
    }
    const targetName = path.basename(file.relativePath, '.tex');
    this.appInfoService.setProjectName(projectInfo.title);
    this.appInfoService.setTarget(projectInfo.compile_target_file_id, targetName);
    this.appInfoService.setLoaded();
    this.emit('loaded-project', this.appInfo);
  }

  /**
   * Compile and save pdf, synctex and log files.
   */
  public async compile() {
    this.emit('start-compile');
    this.logger.log('start compiling');
    try {
      if (!this.appInfoService.appInfo.loaded) {
        await this.loadProjectInfo();
      }

      let result = await this.backend.compileProject();

      if (result.status !== 'success') {
        this.logger.warn('Compilation error', result);
        this.emit('failed-compile', result);
        return;
      }

      const promises = [];

      // download log file
      if (result.logStream) {
        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath!, result.logStream).catch(err => {
          this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
        }));
      }

      // download pdf
      if (result.pdfStream) {
        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.pdfPath!, result.pdfStream).catch(err => {
          this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
        }));
      }

      // download synctex
      if (result.synctexStream) {
        promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.synctexPath!, result.synctexStream).catch(err => {
          this.logger.error('Some error occurred with saving a synctex file.' + JSON.stringify(err));
        }));
      }

      // wait to download all files
      await Promise.all(promises);

      this.logger.log('sucessfully compiled');
      this.emit('successfully-compiled', result);
    } catch (err) {
      this.logger.warn('Some error occured with compilation.' + JSON.stringify(err));
      this.emit('failed-compile', { status: 'unknown-error' });
      return;
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
        this.logger.error('Your account is invalid.');
        return 'invalid';
      }
      this.onOnline();
    } catch (err) {
      this.onOffline();
      return 'offline';
    }
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
  public async startSync() {
    this.emit('start-sync');
    await this.syncManager.syncSession();
  }

  /**
   * clear local changes to resolve sync problem
   */
  public resetLocal() {
    this.fileRepo.all().forEach(f => this.fileRepo.delete(f.id));
    return this.startSync();
  }

  /**
   * stop watching file changes.
   */
  public exit() {
    this.fileWatcher.unwatch();
  }
}
