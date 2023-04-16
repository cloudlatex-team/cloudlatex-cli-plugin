import * as EventEmitter from 'eventemitter3';
import { FileRepository } from '../model/fileModel';
import { Logger } from '../util/logger';
import { Matcher } from 'anymatch';
import { Config } from '../types';
declare type EventType = 'change-detected' | 'error';
export declare class FileWatcher extends EventEmitter<EventType> {
    private config;
    private fileRepo;
    private fileWatcher?;
    private readonly ignored?;
    private logger;
    private initialized;
    constructor(config: Config, fileRepo: FileRepository, options?: {
        ignored?: Matcher;
        logger?: Logger;
    });
    init(): Promise<void>;
    private onFileCreated;
    private onFileChanged;
    private onFileDeleted;
    private onWatchingError;
    private emitChange;
    private getRelativePath;
    stop(): Promise<void>;
}
export {};
