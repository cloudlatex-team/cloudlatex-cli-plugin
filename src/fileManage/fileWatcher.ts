import * as chokidar from 'chokidar';
import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import Logger from './../logger';

export default class FileWatcher extends EventEmitter {
  private fileWatcher?: chokidar.FSWatcher;

  constructor(
    private rootPath: string,
    private fileRepo: FileRepository,
    public readonly watcherFileFilter: (relativePath: string) => boolean,
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
      // ignored: /\.git|\.vswpp|synctex\.gz|main\.pdf|\.workspace|\.vscode|.DS\_Store/ //#TODO
    };
    const fileWatcher = this.fileWatcher = chokidar.watch(this.rootPath, watcherOption);
    return new Promise((resolve, reject) => {
      fileWatcher.on('ready', () => {
        fileWatcher.on('add', (file: string) => this.onWatchingNewFile(file));
        fileWatcher.on('change', (file: string) => this.onWatchedFileChanged(file));
        fileWatcher.on('unlink', (file: string) => this.onWatchedFileDeleted(file));
        resolve();
      });
    });
  }

  private onWatchingNewFile(absPath: string) {
    const relativePath = this.getRelativePath(absPath);
    if(!this.filterWatchingEvent(relativePath)) {
      return;
    }
    let file = this.fileRepo.findBy('relativePath', relativePath);
    if(file) {
      if(!file.watcherSynced) {
        // this file is downloaded from remote
        file.watcherSynced = true;
        this.fileRepo.save();
        return;
      }
      return this.logger.error('New file detected, but already registered.: ' + absPath);
    }
    this.logger.log('new file detected', absPath);
    file = this.fileRepo.new({
      relativePath, 
      localChange: 'create',
      changeLocation: 'local'
    });
    this.fileRepo.save();
    this.emit('change-detected');
  }

  private async onWatchedFileChanged(absPath: string) {
    const relativePath = this.getRelativePath(absPath);
    if(!this.filterWatchingEvent(relativePath)) {
      return;
    }
    const changedFile = this.fileRepo.findBy('relativePath', relativePath);
    if(!changedFile) {
      this.logger.error('local-changed-error', absPath);
      return;
    }
    // file was changed by downloading
    if(!changedFile.watcherSynced) {
      changedFile.watcherSynced = true;
      this.fileRepo.save();
      return;
    }
    changedFile.localChange = 'update';
    this.fileRepo.save();
    this.emit('change-detected');
  }

  private async onWatchedFileDeleted(absPath: string) {
    const relativePath = this.getRelativePath(absPath);
    if(!this.filterWatchingEvent(relativePath)) {
      return;
    }
    const file = this.fileRepo.findBy('relativePath', relativePath);
    if (!file) {
      this.logger.error('local-deleted-error', absPath);
      return;
    }
    // file was deleted by deleteLocal() because remote file is deleted.
    if(!file.watcherSynced) {
      this.fileRepo.delete(file.id);
      this.fileRepo.save();
      return;
    }
    file.watcherSynced = false;
    file.localChange = 'delete';
    this.fileRepo.save();
    this.emit('change-detected');
  }

  private getRelativePath(absPath: string): string {
    return path.relative(this.rootPath, absPath);
  }

  private filterWatchingEvent(relativePath: string): boolean {
    if(this.watcherFileFilter && !this.watcherFileFilter(relativePath)) {
      return false;
    }
    return true;
  }

  public unwatch() {
    this.fileWatcher?.unwatch(this.rootPath);
  }
}