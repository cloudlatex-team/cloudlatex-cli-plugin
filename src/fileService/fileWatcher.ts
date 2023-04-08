import * as chokidar from 'chokidar';
import * as  EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import { Logger } from '../util/logger';
import anymatch, { Matcher } from 'anymatch';
import { checkIgnoredByFileInfo, toPosixPath, toRelativePath } from './filePath';
import { Config } from '../types';


type EventType = 'change-detected' | 'error';

export class FileWatcher extends EventEmitter<EventType> {
  private fileWatcher?: chokidar.FSWatcher;
  private readonly ignored?: Matcher;
  private logger: Logger;
  private initialized = false;
  constructor(
    private config: Config,
    private fileRepo: FileRepository,
    options?: {
      ignored?: Matcher,
      logger?: Logger
    },
  ) {
    super();

    if (options?.ignored) {
      this.ignored = options.ignored;
    }

    this.logger = options?.logger || new Logger();
  }

  public init(): Promise<void> {

    this.initialized = false;

    /**
     * Initialize file entries
     */
    this.fileRepo.all().forEach(file => {
      /**
      * Remove entries of ignore files from file db
      */
      if (checkIgnoredByFileInfo(this.config, file, this.ignored || [])) {
        this.logger.info(`Remove entry [${file.relativePath}] from file db`);
        this.fileRepo.delete(file.id);
        return;
      }

      /**
       * Initialize file entry property
       */
      file.watcherSynced = false;
      file.remoteChange = 'no';
    });
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.fileRepo.save();

    const watcherOption: chokidar.WatchOptions = {
      ignored: this.ignored,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    };
    const fileWatcher = this.fileWatcher = chokidar.watch(this.config.rootPath, watcherOption);

    fileWatcher.on('add', (absPath) => this.onFileCreated(toPosixPath(absPath), false));
    fileWatcher.on('addDir', (absPath) => this.onFileCreated(toPosixPath(absPath), true));
    fileWatcher.on('change', (absPath) => this.onFileChanged(toPosixPath(absPath)));
    fileWatcher.on('unlink', (absPath) => this.onFileDeleted(toPosixPath(absPath)));
    fileWatcher.on('unlinkDir', (absPath) => this.onFileDeleted(toPosixPath(absPath)));
    fileWatcher.on('error', (err) => this.onWatchingError(err));

    return new Promise((resolve) => {
      fileWatcher.on('ready', () => {
        this.logger.log('On chokidar ready event');

        // Handle the entry which watcherSynced is false as deleted file
        const notFoundFiles = this.fileRepo.where({ watcherSynced: false });
        notFoundFiles.forEach(notFound => {
          notFound.watcherSynced = true;
          notFound.localChange = 'delete';
        });

        this.initialized = true;
        resolve();

        // Emit change if needed
        const changedFiles = this.fileRepo.all().filter(
          file => file.localChange !== 'no' || file.remoteChange !== 'no'
        );
        if (changedFiles.length) {
          this.logger.info(
            `Found changed files after initialization: ${JSON.stringify(
              changedFiles.map(file => ({
                path: file.relativePath,
                localChange: file.localChange,
              }))
            )}`
          );
          this.emitChange();
        }
      });
    });
  }

  private onFileCreated(absPath: string, isFolder = false) {
    if (this.ignored && anymatch(this.ignored, absPath)) {
      return;
    }

    const relativePath = this.getRelativePath(absPath);

    if (relativePath === '') { // Ignore root entry
      return;
    }

    let file = this.fileRepo.findBy('relativePath', relativePath);


    if (file) {
      if (!file.watcherSynced) {
        // this file is downloaded from remote or detected on initialization
        file.watcherSynced = true;
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.fileRepo.save();
        return;
      }

      if (file.localChange === 'delete') {
        // The same named file is deleted and recreated.
        file.localChange = 'update';
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.fileRepo.save();
        this.emitChange();
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.fileRepo.save();

    this.emitChange();
  }

  private async onFileChanged(absPath: string) {
    if (this.ignored && anymatch(this.ignored, absPath)) {
      return;
    }

    const relativePath = this.getRelativePath(absPath);
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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.fileRepo.save();
      return;
    }

    if (changedFile.localChange !== 'create') {
      changedFile.localChange = 'update';
    }

    this.logger.log(
      `Update of ${changedFile.isFolder ? 'folder' : 'file'} detected: ${absPath}`
    );

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.fileRepo.save();
    this.emitChange();
  }

  private async onFileDeleted(absPath: string) {
    if (this.ignored && anymatch(this.ignored, absPath)) {
      return;
    }

    const relativePath = this.getRelativePath(absPath);
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
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.fileRepo.save();
      return;
    }

    this.logger.log(
      `Delete of ${file.isFolder ? 'folder' : 'file'} detected: ${absPath}`
    );

    if (file.localChange === 'create') {
      this.fileRepo.delete(file.id);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.fileRepo.save();
      this.emit('change-detected');
      return;
    }

    file.localChange = 'delete';
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.fileRepo.save();
    this.emitChange();
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

  private emitChange() {
    if (this.initialized) {
      this.emit('change-detected');
    }
  }

  private getRelativePath(absPath: string): string {
    return toRelativePath(this.config, absPath);
  }

  public stop(): Promise<void> {
    this.logger.log('Stop watching file system', this.config.rootPath);
    return this.fileWatcher ? this.fileWatcher.close() : Promise.resolve();
  }
}