import * as EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import Logger from './../logger';
export default class FileWatcher extends EventEmitter {
    private rootPath;
    private fileRepo;
    readonly watcherFileFilter: (relativePath: string) => boolean;
    private logger;
    private fileWatcher;
    constructor(rootPath: string, fileRepo: FileRepository, watcherFileFilter: (relativePath: string) => boolean, logger: Logger);
    init(): Promise<void>;
    private onFileCreated;
    private onFileChanged;
    private onFileDeleted;
    private onWatchingError;
    private getRelativePath;
    unwatch(): void;
}
