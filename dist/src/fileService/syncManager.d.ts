import { DecideSyncMode } from '../types';
import FileAdapter from './fileAdapter';
import { FileRepository } from '../model/fileModel';
import * as EventEmitter from 'eventemitter3';
import Logger from '../util/logger';
export declare type SyncResult = {
    success: boolean;
    canceled: boolean;
    fileChanged: boolean;
    errors: string[];
};
declare type EventType = 'sync-finished';
export default class SyncManager extends EventEmitter<EventType> {
    private fileRepo;
    private fileAdapter;
    decideSyncMode: DecideSyncMode;
    private logger;
    private syncing;
    private fileChanged;
    syncSession: () => void;
    constructor(fileRepo: FileRepository, fileAdapter: FileAdapter, decideSyncMode: DecideSyncMode, logger: Logger);
    _syncSession(): Promise<void>;
    private emitSyncResult;
    private sync;
    private generateSyncTasks;
    /**
     * Return task of applying local file change to remote file
     *
     * @param file FileInfo
     */
    private syncWithLocalTask;
    /**
     * Return task of applying remote file change to local file
     *
     * @param file FileInfo
     */
    private syncWithRemoteTask;
    /**
     * Wrap sync task for exceptions
     *
     * @param syncTask
     * @param file FileInfo
     */
    private wrapSyncTask;
    /**
     * Compute priority to handle file change
     *
     * @param file FileInfo
     * @param syncDestination 'local' | 'remote'
     */
    private computePriority;
}
export {};
