import { TypeDB, Repository } from '@moritanian/type-db';
import * as path from 'path';
import { Config, DecideSyncMode } from './../types';
import Backend from './../backend/backend';
import backendSelector from './../backend/backendSelector';
import { FileInfoDesc } from './../model/fileModel';
import FileWatcher from './fileWatcher';
import SyncManager from './syncManager';
import FileAdapter from './FileAdapter';
import Logger from './../logger';
import * as  EventEmitter from 'eventemitter3';

/*
 * File management class
 *
 * Instantiate fileAdapter, fileWatcher and syncManager.
 * The fileWatcher detects local changes.
 * The syncManager synchronize local files with remote ones.
 * The file Adapter abstructs file operations of local files and remote ones.
 */
export default class FileManager extends EventEmitter {
  readonly backend: Backend;
  private _fileAdapter!: FileAdapter;
  private _fileRepo!: Repository<typeof FileInfoDesc>;
  private syncManager!: SyncManager;

  public get fileAdapter(): FileAdapter {
    return this._fileAdapter;
  }

  public get fileRepo() {
    return this._fileRepo;
  }

  constructor(
    private config: Config,
    private decideSyncMode: DecideSyncMode,
    private fileFilter: (relativePath: string) => boolean,
    private logger: Logger
  ) {
    super();
    this.backend = backendSelector(config);
  }

  public async init(): Promise<void> {
    // DB
    const dbFilePath = path.join(this.config.rootPath, `.${this.config.backend}.json`);
    const db = new TypeDB(dbFilePath);
    try {
      await db.load();
    } catch (err) {
      // Not initialized because there is no db file.
    }
    this._fileRepo = db.getRepository(FileInfoDesc);
    this._fileRepo.all().forEach(file => {
      file.watcherSynced = true;
    });
    this._fileRepo.save();

    this._fileAdapter = new FileAdapter(this.config.rootPath, this._fileRepo, this.backend, this.logger);

    // Sync Manager
    this.syncManager = new SyncManager(this._fileRepo, this._fileAdapter, this.decideSyncMode, this.logger);

    // File watcher
    const fileWatcher = new FileWatcher(this.config.rootPath, this._fileRepo, this.fileFilter, this.logger);
    await fileWatcher.init();

    fileWatcher.on('change-detected', () => {
      this.startSync();
    });
  }

  public async startSync() {
    try {
      const result = await this.backend.validateToken();
      if (!result) {
        this.logger.error('Your account is invalid.');
        return;
      }
      this.emit('online');
    } catch (err) {
      this.emit('offline');
      return;
    }
    const result = await this.syncManager.syncSession();
    if (result.success) {
      this.emit('successfully-synced');
      if (result.fileChanged) {
        this.emit('request-autobuild');
      }
    }
  }
}