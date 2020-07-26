import * as chokidar from 'chokidar';
import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import Logger from './../logger';

// TODO unuse eventemitter
export default class FileWatcher extends EventEmitter {
  private fileWatcher!: chokidar.FSWatcher;

  constructor(
    private rootPath: string,
    private fileRepo: FileRepository,
    public readonly watcherFileFilter: (relativePath: string) => boolean = (_) => true,
    private logger: Logger
  ) {
    super();
  }

  public init(): Promise<void> {
    const watcherOption = {
      ignored: /\.git|\.cloudlatex\.json|synctex\.gz|\.vscode|.DS\_Store/, //#TODO
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    };
    this.fileWatcher = chokidar.watch(this.rootPath, watcherOption);
    return new Promise((resolve, reject) => {
      // TODO detect changes before running
      this.fileWatcher.on('ready', () => {
        this.fileWatcher.on('add', (absPath) => this.onFileCreated(absPath, false));
        this.fileWatcher.on('addDir', (absPath) => this.onFileCreated(absPath, true));
        this.fileWatcher.on('change', this.onFileChanged.bind(this));
        this.fileWatcher.on('unlink', this.onFileDeleted.bind(this));
        this.fileWatcher.on('unlinkDir', this.onFileDeleted.bind(this));
        this.fileWatcher.on('error', this.onWatchingError.bind(this));
        resolve();
      });
    });
  }

  private onFileCreated(absPath: string, isFolder: boolean = false) {
    const relativePath = this.getRelativePath(absPath);
    if (!this.watcherFileFilter(relativePath)) {
      return;
    }
    let file = this.fileRepo.findBy('relativePath', relativePath);
    if (file) {
      if (!file.watcherSynced) {
        // this file is downloaded from remote
        file.watcherSynced = true;
        this.fileRepo.save();
        return;
      }
      if (file.localChange === 'delete') {
        // The same named file is deleted and recreated.
        file.localChange = 'update';
        this.fileRepo.save();
        this.emit('change-detected');
        return;
      }
      return this.logger.error(`New ${isFolder ? 'folder' : 'file'} detected, but already registered.: ${absPath}`);
    }
    this.logger.log(
      `new ${isFolder ? 'folder' : 'file'} detected: ${absPath}`
    );
    file = this.fileRepo.new({
      relativePath,
      localChange: 'create',
      changeLocation: 'local',
      watcherSynced: true,
      isFolder
    });
    this.fileRepo.save();
    this.emit('change-detected');
  }

  private async onFileChanged(absPath: string) {
    const relativePath = this.getRelativePath(absPath);
    if (!this.watcherFileFilter(relativePath)) {
      return;
    }
    const changedFile = this.fileRepo.findBy('relativePath', relativePath);
    if (!changedFile) {
      this.logger.error(
        `local-changed-error: The fileInfo is not found at onFileChanged: ${absPath}`
      );
      return;
    }

    // file was changed by downloading
    if (!changedFile.watcherSynced) {
      changedFile.watcherSynced = true;
      this.fileRepo.save();
      return;
    }

    if (changedFile.localChange !== 'create') {
      changedFile.localChange = 'update';
    }
    this.fileRepo.save();
    this.emit('change-detected');
  }

  private async onFileDeleted(absPath: string) {
    const relativePath = this.getRelativePath(absPath);
    if (!this.watcherFileFilter(relativePath)) {
      return;
    }
    const file = this.fileRepo.findBy('relativePath', relativePath);
    if (!file) {
      this.logger.error(
        `local-changed-error: The fileInfo is not found at onFileDeleted: ${absPath}`
      );
      return;
    }

    // The file was deleted by deleteLocal() because remote file is deleted.
    if (!file.watcherSynced) {
      this.fileRepo.delete(file.id);
      this.fileRepo.save();
      return;
    }

    if (file.localChange === 'create') {
      this.fileRepo.delete(file.id);
      this.fileRepo.save();
      this.emit('change-detected');
      return;
    }

    file.localChange = 'delete';
    this.fileRepo.save();
    this.emit('change-detected');
  }

  private onWatchingError (err: any) {
    this.logger.error('onWatchingError', err);
  }

  private getRelativePath(absPath: string): string {
    return path.relative(this.rootPath, absPath);
  }

  public unwatch() {
    this.fileWatcher.unwatch(this.rootPath);
  }
}