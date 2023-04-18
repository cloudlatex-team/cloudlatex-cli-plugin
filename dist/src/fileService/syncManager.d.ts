import { ConflictSolution } from '../types';
import { FileAdapter } from './fileAdapter';
import { FileRepository, FileInfo } from '../model/fileModel';
import { Logger } from '../util/logger';
export declare type SyncResult = {
    success: boolean;
    conflict: boolean;
    errors: string[];
};
declare type CheckIgnored = (file: FileInfo) => boolean;
export declare class SyncManager {
    private fileRepo;
    private fileAdapter;
    private logger;
    private checkIgnored;
    private runner;
    private conflictSolution?;
    constructor(fileRepo: FileRepository, fileAdapter: FileAdapter, logger: Logger, checkIgnored?: CheckIgnored);
    sync(conflictSolution?: ConflictSolution): Promise<SyncResult>;
    private execSync;
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
     * Create priorityTask
     *
     * @param task syncTask
     * @param file file to sync
     * @param priority priority of the task
     */
    private createPriorityTask;
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
