import { DecideSyncMode } from '../types';
import FileAdapter from './fileAdapter';
import { FileRepository } from '../model/fileModel';
import Logger from './../logger';
declare type SyncResult = {
    success: boolean;
    fileChanged: boolean;
};
export default class SyncManager {
    private fileRepo;
    private fileAdapter;
    decideSyncMode: DecideSyncMode;
    private logger;
    private syncing;
    private syncReserved;
    private fileChanged;
    constructor(fileRepo: FileRepository, fileAdapter: FileAdapter, decideSyncMode: DecideSyncMode, logger: Logger);
    syncSession(): Promise<SyncResult>;
    private sync;
    private generateSyncTasks;
    private syncWithLocalTask;
    private syncWithRemoteTask;
    private computePriority;
}
export {};
