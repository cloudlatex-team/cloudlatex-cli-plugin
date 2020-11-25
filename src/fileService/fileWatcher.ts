import * as chokidar from 'chokidar';
import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import Logger from '../util/logger';

type EventType = 'change-detected';

export default class FileWatcher extends EventEmitter<EventType> {
  private fileWatcher?: chokidar.FSWatcher;

  constructor(
    private rootPath: string,
    private fileRepo: FileRepository,
    public readonly watcherFileFilter: (relativePath: string) => boolean = (_) => true,
    private logger: Logger = new Logger()
  ) {
    super();
  }

  public init(): Promise<void> {
    const watcherOption: chokidar.WatchOptions = {
      ignored: /\.git|\.cloudlatex\.json|synctex\.gz|\.vscode|.DS\_Store/, //#TODO
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    };
    this.logger.log('[debug] watch chokidar ' + this.rootPath);
    const fileWatcher = this.fileWatcher = chokidar.watch(this.rootPath, watcherOption);
    return new Promise((resolve, reject) => {
      this.logger.log('[debug] before waiting chokidar ready event');
      // TODO detect changes before running
      fileWatcher.on('ready', () => {
        this.logger.log('[debug] on chokidar ready event');

        fileWatcher.on('add', (absPath) => this.onFileCreated(absPath.replace(/\\/g, path.posix.sep), false));
        fileWatcher.on('addDir', (absPath) => this.onFileCreated(absPath.replace(/\\/g, path.posix.sep), true));
        fileWatcher.on('change', (absPath) => {
          this.logger.log(`[debug] onFileCreated absPath ${absPath} : ${absPath.replace(/\\/g, path.posix.sep)}`);
          this.onFileChanged(absPath.replace(/\\/g, path.posix.sep));
        });
        fileWatcher.on('unlink', (absPath) => this.onFileDeleted(absPath.replace(/\\/g, path.posix.sep)));
        fileWatcher.on('unlinkDir', (absPath) => this.onFileDeleted(absPath.replace(/\\/g, path.posix.sep)));
        fileWatcher.on('error', (err) => this.onWatchingError(err));
        resolve();
      });
    });
  }

  private onFileCreated(absPath: string, isFolder: boolean = false) {
    this.logger.log(`[debug] onFileCreated is called: ${absPath} ${this.getRelativePath(absPath)}`);

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
    this.logger.log('[debug] onFileChanged is called');

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

    this.logger.log(
      `update of ${changedFile.isFolder ? 'folder' : 'file'} detected: ${absPath}`
    );

    this.fileRepo.save();
    this.emit('change-detected');
  }

  private async onFileDeleted(absPath: string) {
    this.logger.log('[debug] onFileDeleted is called');

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

    this.logger.log(
      `delete of ${file.isFolder ? 'folder' : 'file'} detected: ${absPath}`
    );

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

  private onWatchingError(err: any) {
    this.logger.error('onWatchingError', err);
  }

  private getRelativePath(absPath: string): string {
    return path.posix.relative(this.rootPath, absPath);
  }

  public unwatch() {
    this.fileWatcher?.unwatch(this.rootPath);
  }
}