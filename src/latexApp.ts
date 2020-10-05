import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import Logger from './util/logger';
import { Config, DecideSyncMode, Account, CompileResult } from './types';
import FileAdapter from './fileService/fileAdapter';
import SyncManager from './fileService/syncManager';
import FileWatcher from './fileService/fileWatcher';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FileInfoDesc } from './model/fileModel';
import Backend from './backend/ibackend';
import backendSelector from './backend/backendSelector';
import AccountService from './service/accountService';
import AppInfoService from './service/appInfoService';

// TODO syncSession() 返り値 か callback // callbackにしてユーザから直接叩く際は 　返り値？
// TODO syncSession() debounce
// TODO delte db flle when the application is deactivated

type EventType = 'appinfo-updated' | 'start-sync' | 'failed-sync' | 'successfully-synced' | 'start-compile' | 'failed-compile' | 'successfully-compiled';

export default class LatexApp extends EventEmitter<EventType> {
  private syncManager: SyncManager;
  private fileWatcher: FileWatcher;
  /**
   * Is required to compile initilally after launch app
   * and validate account
   */
  private initialCompile = false;

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
        this.emit('appinfo-updated');
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
      } else {
        this.logger.error('error in syncSession: ' + result.errors.join(' '));
        this.emit('failed-sync');
      }
    });

    /**
     * File watcher
     */
    this.fileWatcher = new FileWatcher(config.rootPath, fileRepo,
      relativePath => {
        return ![
          config.outDir,
          appInfoService.appInfo.logPath,
          appInfoService.appInfo.pdfPath,
          appInfoService.appInfo.synctexPath
        ].includes(relativePath);
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
      logger?: Logger
    } = {}): Promise<LatexApp> {
    // Config
    config = { ...config, outDir: path.join(config.outDir) };

    // Account
    const accountService: AccountService<Account> = new AccountService(config.accountStorePath || '');
    await accountService.load();

    // AppInfo
    const appInfoService = new AppInfoService(config);

    // Backend
    const backend = backendSelector(config, accountService);


    // DB
    const dbFilePath = path.join(config.storagePath, `.${config.backend}.json`);
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
    if (this.config.autoCompile && await this.validateAccount() === 'valid') {
      this.initialCompile = true;
      this.startSync();
    }
  }

  /**
   * Relaunch app to change config
   *
   * @param config
   */
  async relaunch(config: Config) {
    this.exit();
    this.config = { ...config, outDir: path.join(config.outDir) };
    this.accountService = new AccountService(config.accountStorePath || '');
    this.backend = backendSelector(config, this.accountService);
    this.launch();
  }

  private onOnline() {
    if (!this.appInfoService.appInfo.offline) {
      return;
    }
    this.appInfoService.setOnline();
    this.logger.info('Your account is validated!');
    this.emit('appinfo-updated');
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
    this.emit('appinfo-updated');
  }

  private async loadProjectInfo() {
    const projectInfo = await this.backend.loadProjectInfo();
    const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
    if (!file) {
      this.logger.error('Target file is not found');
      this.emit('failed-compile', { status: 'no-target' });
      return;
    }
    const targetName = path.basename(file.relativePath, '.tex');
    this.appInfoService.setProjectName(projectInfo.title);
    this.appInfoService.setTarget(projectInfo.compile_target_file_id, targetName);
    this.appInfoService.setLoaded();
    this.emit('appinfo-updated');
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
      promises.push(this.fileAdapter.saveAs(this.appInfoService.appInfo.logPath!, result.logStream).catch(err => {
        this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
      }));

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


  private async _validateAccount(): Promise<'valid' | 'invalid' | 'offline'> {
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
   * Validate account
   *
   * @return Promise<'valid' | 'invalid' | 'offline'>
   */
  public async validateAccount(): Promise<'valid' | 'invalid' | 'offline'> {
    const result = await this._validateAccount();
    if (result === 'offline') {
      this.logger.warn('Cannot connect to the server.');
    }
    return result;
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
