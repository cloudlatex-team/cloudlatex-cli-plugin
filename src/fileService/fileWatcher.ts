import * as chokidar from 'chokidar';
import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import { Logger } from '../util/logger';

type EventType = 'change-detected' | 'error';

export class FileWatcher extends EventEmitter<EventType> {
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
      ignored: /\.git|\.cloudlatex\.json|synctex\.gz|\.vscode(\\|\/|$)|.DS_Store/, //#TODO
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    };
    const fileWatcher = this.fileWatcher = chokidar.watch(this.rootPath, watcherOption);
    return new Promise((resolve) => {
      // TODO detect changes before running
      fileWatcher.on('ready', () => {
        this.logger.log('On chokidar ready event');

        fileWatcher.on('add', (absPath) => this.onFileCreated(absPath.replace(/\\/g, path.posix.sep), false));
        fileWatcher.on('addDir', (absPath) => this.onFileCreated(absPath.replace(/\\/g, path.posix.sep), true));
        fileWatcher.on('change', (absPath) => this.onFileChanged(absPath.replace(/\\/g, path.posix.sep)));
        fileWatcher.on('unlink', (absPath) => this.onFileDeleted(absPath.replace(/\\/g, path.posix.sep)));
        fileWatcher.on('unlinkDir', (absPath) => this.onFileDeleted(absPath.replace(/\\/g, path.posix.sep)));
        fileWatcher.on('error', (err) => this.onWatchingError(err));
        resolve();
      });
    });
  }

  private onFileCreated(absPath: string, isFolder = false) {
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

      const msg = `New ${isFolder ? 'folder' : 'file'} detected, but already registered.: ${absPath}`;
      this.logger.error(msg);
      this.emit('error', msg);
      return;
    }
    this.logger.log(
      `New ${isFolder ? 'folder' : 'file'} detected: ${absPath}`
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
      const msg = `Local-changed-error: The fileInfo is not found at onFileChanged: ${absPath}`;
      this.logger.error(msg);
      this.emit('error', msg);
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
      `Update of ${changedFile.isFolder ? 'folder' : 'file'} detected: ${absPath}`
    );

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
      const msg = `Local-changed-error: The fileInfo is not found at onFileDeleted: ${absPath}`;
      this.logger.error(msg);
      this.emit('error', msg);
      return;
    }

    // The file was deleted by deleteLocal() because remote file is deleted.
    if (!file.watcherSynced) {
      this.fileRepo.delete(file.id);
      this.fileRepo.save();
      return;
    }

    this.logger.log(
      `Delete of ${file.isFolder ? 'folder' : 'file'} detected: ${absPath}`
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onWatchingError(err: any) {
    if (process.platform === 'win32' && err['errno'] === -4048 && err['code'] === 'EPERM') {
      /**
       * Ignore permission error on windows
       *
       * https://github.com/nodejs/node/issues/31702
       * https://github.com/paulmillr/chokidar/issues/566
       */
      //
      this.logger.log('Ignore permission error', err);
      return;
    } else {
      this.logger.error('OnWatchingError', err);
      this.emit('error', err.toString());
    }
  }

  private getRelativePath(absPath: string): string {
    return path.posix.relative(this.rootPath, absPath);
  }

  public stop(): Promise<void> {
    this.logger.log('Stop watching file system', this.rootPath);
    return this.fileWatcher ? this.fileWatcher.close() : Promise.resolve();
  }
}