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
import AccountManager from './manager/accountManager';
import AppInfoManager from './manager/appInfoManager';

// TODO delte db flle when the application is deactivated

type EventType = 'appinfo-updated' | 'start-sync' | 'failed-sync' | 'successfully-synced' | 'start-compile' | 'failed-compile' | 'successfully-compiled';

export default class LatexApp extends EventEmitter<EventType> {
  private config: Config;
  private appInfoManager: AppInfoManager;
  private fileAdapter!: FileAdapter;
  private fileRepo!: Repository<typeof FileInfoDesc>;
  private syncManager!: SyncManager;
  private fileWatcher?: FileWatcher;
  private backend: Backend;
  private accountManager: AccountManager<Account>;

  constructor(config: Config, private decideSyncMode: DecideSyncMode, private logger: Logger = new Logger()) {
    super();
    this.config = { ...config, outDir: path.join(config.outDir) };
    this.appInfoManager = new AppInfoManager(this.config);
    this.accountManager = new AccountManager(config.accountStorePath || '');
    this.backend = backendSelector(config, this.accountManager);
  }

  get appInfo() {
    return this.appInfoManager.appInfo;
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
        this.appInfoManager.setConflicts(conflictFiles);
        this.emit('appinfo-updated');
        return this.decideSyncMode(conflictFiles);
      }
      ,this.logger);

    // File watcher
    this.fileWatcher = new FileWatcher(this.config.rootPath, this.fileRepo,
      relativePath => {
        return ![
          this.config.outDir,
          this.appInfoManager.appInfo.logPath,
          this.appInfoManager.appInfo.pdfPath,
          this.appInfoManager.appInfo.synctexPath
        ].includes(relativePath);
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

  /**
   * Relaunch app to change config
   *
   * @param config
   */
  async relaunch(config: Config) {
    this.exit();
    this.config = { ...config, outDir: path.join(config.outDir) };
    this.accountManager = new AccountManager(config.accountStorePath || '');
    this.backend = backendSelector(config, this.accountManager);
    this.launch();
  }

  private onOnline() {
    if (!this.appInfoManager.appInfo.offline) {
      return;
    }
    this.appInfoManager.setOnline();
    this.logger.info('Your account is validated!');
    this.emit('appinfo-updated');
  }

  private onOffline() {
    if (this.appInfoManager.appInfo.offline) {
      return;
    }
    this.logger.warn(`The network is offline or some trouble occur with the server.
      You can edit your files, but your changes will not be reflected on the server
      until it is enable to communicate with the server.
      `);
    this.appInfoManager.setOffLine();
    this.emit('appinfo-updated');
  }

  /**
   * Compile and save pdf, synctex and log files.
   */
  public async compile() {
    this.emit('start-compile');
    this.logger.log('start compiling');
    try {
      if (!this.appInfoManager.appInfo.compileTarget) {
        const projectInfo = await this.backend.loadProjectInfo();
        const file = this.fileRepo.findBy('remoteId', projectInfo.compile_target_file_id);
        if (!file) {
          this.logger.error('Target file is not found');
          this.emit('failed-compile', { status: 'no-target' });
          return;
        }
        const targetName = path.basename(file.relativePath, '.tex');
        this.appInfoManager.setProjectName(projectInfo.title);
        this.appInfoManager.setTarget(projectInfo.compile_target_file_id, targetName);
        this.emit('appinfo-updated');
      }

      let result = await this.backend.compileProject();

      if (result.status !== 'success') {
        this.logger.warn('Compilation error', result);
        this.emit('failed-compile', result);
        return;
      }

      // log
      this.fileAdapter.saveAs(this.appInfoManager.appInfo.logPath!, result.logStream).catch(err => {
        this.logger.error('Some error occurred with saving a log file.' + JSON.stringify(err));
      });

      // download pdf
      if (result.pdfStream) {
        this.fileAdapter.saveAs(this.appInfoManager.appInfo.pdfPath!, result.pdfStream).catch(err => {
          this.logger.error('Some error occurred with downloading the compiled pdf file.' + JSON.stringify(err));
        });
      }

      // download synctex
      if (result.synctexStream) {
        this.fileAdapter.saveAs(this.appInfoManager.appInfo.synctexPath!, result.synctexStream).catch(err => {
          this.logger.error('Some error occurred with saving a synctex file.' + JSON.stringify(err));
        });
      }

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

  public setAccount(account: Account): void {
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
