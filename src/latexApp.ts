import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import Logger from './logger';
import { Config, ProjectInfo, AppInfo, DecideSyncMode, Account } from './types';
import FileAdapter from './fileManage/fileAdapter';
import SyncManager from './fileManage/syncManager';
import FileWatcher from './fileManage/fileWatcher';
import { TypeDB, Repository } from '@moritanian/type-db';
import { FileInfoDesc } from './model/fileModel';
import Backend from './backend/ibackend';
import backendSelector from './backend/backendSelector';
import AccountManager from './accountManager';

// TODO delte db flle when the application is deactivated

type EventType = 'appinfo-updated' | 'start-sync' | 'failed-sync' | 'successfully-synced' | 'start-compile' | 'failed-compile' | 'successfully-compiled';

export default class LatexApp extends EventEmitter<EventType> {
  private config: Config;
  public readonly appInfo: AppInfo;
  private fileAdapter!: FileAdapter;
  private fileRepo!: Repository<typeof FileInfoDesc>;
  private syncManager!: SyncManager;
  private fileWatcher?: FileWatcher;
  private backend: Backend;
  private account: Account | null = null;
  private accountManager: AccountManager<Account>;

  constructor(config: Config, private decideSyncMode: DecideSyncMode, private logger: Logger = new Logger()) {
    super();
    this.config = { ...config, outDir: path.join(config.outDir) };
    this.appInfo = {
      offline: false,
      conflictFiles: []
    };
    this.accountManager = new AccountManager(config.accountStorePath || '');
    this.backend = backendSelector(config, this.accountManager);
  }

  /**
   * setup file management classes
   *
   * Instantiate fileAdapter, fileWatcher and syncManager.
   * The fileWatcher detects local changes.
   * The syncManager synchronize local files with remote ones.
   * The file Adapter abstructs file operations of local files and remote ones.
   */
  async launch() {
    // Account
    await this.accountManager.load();

    // DB
    const dbFilePath = path.join(this.config.storagePath, `.${this.config.backend}.json`);
    const db = new TypeDB(dbFilePath);
    try {
      await db.load();
    } catch (err) {
      // Not initialized because there is no db file.
    }
    this.fileRepo = db.getRepository(FileInfoDesc);
    this.fileRepo.all().forEach(file => {
      file.watcherSynced = true;
    });
    this.fileRepo.save();

    this.fileAdapter = new FileAdapter(this.config.rootPath, this.fileRepo, this.backend, this.logger);

    // Sync Manager
    this.syncManager = new SyncManager(this.fileRepo, this.fileAdapter,
      async (conflictFiles) => {
        this.appInfo.conflictFiles = conflictFiles;
        this.emit('appinfo-updated');
        return this.decideSyncMode(conflictFiles);
      }
      ,this.logger);

    // File watcher
    this.fileWatcher = new FileWatcher(this.config.rootPath, this.fileRepo,
      relativePath => {
        if (!this.appInfo.projectName) {
          return ![this.config.outDir].includes(relativePath);
        }
        return ![this.config.outDir, this.logPath, this.pdfPath, this.synctexPath].includes(relativePath);
      },
      this.logger);
    await this.fileWatcher.init();

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

  async relaunch(config: Config) {
    this.exit();
    this.config = { ...config, outDir: path.join(config.outDir) };
    this.accountManager = new AccountManager(config.accountStorePath || '');
    this.backend = backendSelector(config, this.accountManager);
    this.launch();
  }

  get targetName(): string {
    if (!this.appInfo.compileTarget) {
      this.logger.error('Project info is not defined');
      throw new Error('Project info is not defined');
    }
    const file = this.fileRepo.findBy('remoteId', this.appInfo.compileTarget);
    if (!file) {
      this.logger.error('Target file is not found');
      throw new Error('Target file is not found');
    }
    return path.basename(file.relativePath, '.tex');
  }

  get logPath(): string {
    return path.join(this.config.outDir, this.targetName + '.log');
  }

  get pdfPath(): string {
    return path.join(this.config.outDir, this.targetName + '.pdf');
  }

  get synctexPath(): string {
    return path.join(this.config.outDir, this.targetName + '.synctex');
  }

  private onOnline() {
    this.appInfo.offline = false;
    this.emit('appinfo-updated');
  }

  private onOffline() {
    if (this.appInfo.offline) {
      return;
    }
    this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
    this.appInfo.offline = true;
    this.emit('appinfo-updated');
  }

  /**
   * Compile and save pdf, synctex and log files.
   */
  public async compile() {
    this.emit('start-compile');
    this.logger.log('start compiling');
    let result = null;
    try {
      if (!this.appInfo.compileTarget) {
        const projectInfo = await this.backend.loadProjectInfo();
        this.appInfo.compileTarget = projectInfo.compile_target_file_id;
        this.appInfo.projectName = projectInfo.title;
        this.emit('appinfo-updated');
      }

      result = await this.backend.compileProject();

      if (result.exitCode !== 0) {
        this.logger.warn('Compilation error');
        this.emit('failed-compile', result);
        return;
      }

      // log
      this.fileAdapter.saveAs(this.logPath, result.logStream).catch(err => {
        this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
      });

      // download pdf
      if (result.pdfStream) {
        this.fileAdapter.saveAs(this.pdfPath, result.pdfStream).catch(err => {
          this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
        });
      }

      // download synctex
      if (result.synctexStream) {
        this.fileAdapter.saveAs(this.synctexPath, result.synctexStream).catch(err => {
          this.logger.error('Some error occurred with saving a synctex file.' + JSON.stringify(err));
        });
      }
    } catch (err) {
      this.logger.warn('Some error occured with compilation.' + JSON.stringify(err));
      this.emit('failed-compile', result);
      return;
    }
    this.logger.log('sucessfully compiled');
    this.emit('successfully-compiled', result);
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

  public setAccount(account: Account): void {
    // Keep the reference of this.account
    this.accountManager.save(account);
  }

  /**
   * Start to synchronize files with the remote server
   */
  public async startSync(forceCompile: boolean = false) {
    this.emit('start-sync');
    const result = await this.syncManager.syncSession();
    if (result.success) {
      this.emit('successfully-synced');
      if (forceCompile || (result.fileChanged && this.config.autoBuild)) {
        await this.compile();
      }
    } else {
      this.emit('failed-sync');
    }
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
    if (this.fileWatcher) {
      this.fileWatcher.unwatch();
    }
  }
}
