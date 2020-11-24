import { SyncMode, DecideSyncMode, KeyType, ChangeLocation, ChangeState } from '../types';
import FileAdapter from './fileAdapter';
import { FileRepository, FileInfo } from '../model/fileModel';
import * as path from 'path';
import * as  EventEmitter from 'eventemitter3';
import * as _ from 'lodash';
import Logger, { getErrorTraceStr } from '../util/logger';

export type SyncResult = {
  success: boolean;
  fileChanged: boolean; // show if any file (not folder) is changed
  errors: string[]
};

type SyncTaskResult = {
  success: boolean;
  message: string;
};

type EventType = 'sync-finished';

export default class SyncManager extends EventEmitter<EventType> {
  private syncing: boolean = false;
  private fileChanged: boolean = false; // Whether any file (not folder) is changed
  public syncSession: () => void;
  constructor(
    private fileRepo: FileRepository,
    private fileAdapter: FileAdapter,
    public decideSyncMode: DecideSyncMode,
    private logger: Logger
  ) {
    super();
    this.syncSession = _.debounce(
      this._syncSession.bind(this),
      5000,
      { trailing: true, leading: true }
    );
  }

  async _syncSession(): Promise<void> {
    this.fileChanged = false;
    if (this.syncing) {
      this.syncSession();
      return;
    }

    this.logger.log('Synchronizing files with server ...');

    this.syncing = true;

    try {
      const results = await this.sync();
      const fails = results.filter(result => !result.success);
      if (fails.length > 0) {
        this.syncing = false;
        this.emitSyncResult({
          success: false,
          fileChanged: this.fileChanged,
          errors: fails.map(result => result.message)
        });
        return;
      }
    } catch (e) {
      this.syncing = false;
      this.logger.log('Failed to sync: ' + getErrorTraceStr(e));
      this.emitSyncResult({
        success: false,
        fileChanged: this.fileChanged,
        errors: [getErrorTraceStr(e)]
      });
      return;
    }

    this.syncing = false;

    this.logger.log('Succeeded in synchronizing!');

    this.emitSyncResult({
      success: true,
      fileChanged: this.fileChanged,
      errors: []
    });
    return;
  }

  private emitSyncResult(result: SyncResult) {
    this.emit('sync-finished', result);
  }

  private async sync() {
    const remoteFileList = await this.fileAdapter.loadFileList();
    const remoteFileDict = remoteFileList.reduce((dict, file) => {
      if (file.remoteId === null) {
        throw new Error('remoteId is null');
      }
      dict[file.remoteId] = file;
      return dict;
    }, {} as Record<KeyType, FileInfo>);

    // Reset remote change state and change location
    this.fileRepo.all().forEach(file => {
      file.remoteChange = 'no';
      file.changeLocation = 'no';
    });

    /*
     * Compare remote and local file
     */
    // Remote to local
    remoteFileList.forEach(remoteFile => {
      let file = this.fileRepo.findBy('remoteId', remoteFile.remoteId);
      if (!file) { // created in remote
        file = this.fileRepo.new(remoteFile);
        file.remoteChange = 'create';
        return;
      }
      file.remoteRevision = remoteFile.remoteRevision;
      file.url = remoteFile.url;
      if (file.localRevision !== file.remoteRevision) { // updated in remote
        file.remoteChange = 'update';
      } else if (file.relativePath !== remoteFile.relativePath) { // renamed in remote
        if (file.localChange === 'no') {
          // express rename as deleting original file and creating renamed file
          file.remoteChange = 'delete';
          const renamedFile = this.fileRepo.new(remoteFile);
          renamedFile.remoteChange = 'create';
        } else if (file.localChange === 'create') {
          this.logger.error(
            `Unexpected situation is detected: remote file is renamed and local file is created: ${file.relativePath}`
          );
        } else if (file.localChange === 'delete') {
          this.logger.error(
            `Unsupported situation is detected: remote file is renamed and local file is deleted: ${file.relativePath}`
          );
        } else if (file.localChange === 'update') {
          this.logger.error(
            `Unsupported situation is detected: remote file is renamed and local file is updated: ${file.relativePath}`
          );
        }
      }
    });
    // Local to remote
    this.fileRepo.all().forEach(file => {
      let remoteFile = file.remoteId && remoteFileDict[file.remoteId];
      if (!remoteFile) { // remote file does not exist
        if (file.remoteId) { // remote file is deleted
          file.remoteChange = 'delete';
          file.remoteId = null;
        }
      }

      // update changeLocation
      if (file.remoteChange !== 'no' && file.localChange !== 'no') {
        file.changeLocation = 'both';
      } else if (file.remoteChange !== 'no') {
        file.changeLocation = 'remote';
      } else if (file.localChange !== 'no') {
        file.changeLocation = 'local';
      }
    });

    this.fileRepo.save();

    let syncMode: SyncMode = 'download';
    if (this.fileRepo.findBy('changeLocation', 'both')) {
      syncMode = await this.decideSyncMode(
        this.fileRepo.where({ 'changeLocation': 'both' }).map(file => file.relativePath),
      );
    }
    return await new TasksExecuter<SyncTaskResult>(
      this.generateSyncTasks(syncMode)
    ).execute();
  }

  private generateSyncTasks(remoteSyncMode: SyncMode): PriorityTask<SyncTaskResult>[] {
    const tasks: PriorityTask<SyncTaskResult>[] = [];
    this.fileRepo.all().forEach(file => {
      if (file.changeLocation === 'remote' ||
        (file.changeLocation === 'both' && remoteSyncMode === 'download')) {
        tasks.push(this.syncWithRemoteTask(file));
        this.logger.log('pull: ' + file.relativePath);
        if (!file.isFolder) {
          this.fileChanged = true;
        }
      } else if (
        file.changeLocation === 'local' ||
        (file.changeLocation === 'both' && remoteSyncMode === 'upload')
      ) {
        tasks.push(this.syncWithLocalTask(file));
        this.logger.log('push: ' + file.relativePath);

        if (!file.isFolder) {
          this.fileChanged = true;
        }
      }
    });
    return tasks;
  }

  /**
   * Return task of applying local file change to remote file
   *
   * @param file FileInfo
   */
  private syncWithLocalTask(file: FileInfo): PriorityTask<SyncTaskResult> {
    const priority = this.computePriority(file, 'local');
    switch (file.localChange) {
      case 'create':
        if (file.isFolder) {
          return new PriorityTask(this.wrapSyncTask('createRemoteFolder', file), priority);
        }
        return new PriorityTask(this.wrapSyncTask('upload', file), priority);
      case 'update':
        if (file.remoteChange === 'delete') {
          if (file.isFolder) {
            return new PriorityTask(this.wrapSyncTask('createRemoteFolder', file), priority);
          }
          return new PriorityTask(this.wrapSyncTask('upload', file), priority);
        }
        return new PriorityTask(this.wrapSyncTask('updateRemote', file), priority);
      case 'delete':
        if (file.remoteChange === 'delete') {
          // The same file is already deleted both in local and remote.
          this.fileRepo.delete(file.id);
          this.fileRepo.save();
          return new PriorityTask(() => Promise.resolve({ success: true, message: '' }), priority);
        }
        return new PriorityTask(this.wrapSyncTask('deleteRemote', file), priority);
      case 'no':
        return new PriorityTask(() => Promise.resolve({ success: true, message: '' }), priority);
    }
  }

  /**
   * Return task of applying remote file change to local file
   *
   * @param file FileInfo
   */
  private syncWithRemoteTask(file: FileInfo): PriorityTask<SyncTaskResult> {
    const priority = this.computePriority(file, 'remote');
    switch (file.remoteChange) {
      case 'create':
      case 'update':
        if (file.isFolder) {
          return new PriorityTask(this.wrapSyncTask('createLocalFolder', file), priority);
        }
        return new PriorityTask(this.wrapSyncTask('download', file), priority);
      case 'delete':
        if (file.localChange === 'delete') {
          // The same file is already deleted both in local and remote.
          this.fileRepo.delete(file.id);
          this.fileRepo.save();
          return new PriorityTask(() => Promise.resolve({ success: true, message: '' }), priority);
        }
        return new PriorityTask(this.wrapSyncTask('deleteLocal', file), priority);
      case 'no':
        return new PriorityTask(() => Promise.resolve({ success: true, message: '' }), priority);
    }
  }

  /**
   * Wrap sync task for error
   *
   * @param syncTask
   * @param file FileInfo
   */
  private wrapSyncTask(
    task: 'download' | 'createLocalFolder' | 'createRemoteFolder' |
      'upload' | 'updateRemote' | 'deleteRemote' | 'deleteLocal',
    // syncTask: (file: FileInfo) => Promise<unknown>,
    file: FileInfo
  ): () => Promise<SyncTaskResult> {
    return async () => {
      try {
        await this.fileAdapter[task](file);
      } catch (e) {
        return {
          success: false,
          message: `${task} : '${file.relativePath}' : ${file.url} : ${(e && e.stack || '')}`
        };
      }
      return {
        success: true,
        message: ''
      };
    };
  }

  /**
   * Compute priority to handle file change
   *
   * @param file FileInfo
   * @param syncDestination 'local' | 'remote'
   */
  private computePriority(file: FileInfo, syncDestination: 'local' | 'remote'): number {
    let change: ChangeState = syncDestination === 'local' ?
      file.localChange :
      file.remoteChange;

    switch (change) {
      case 'create':
      case 'update':
        /*
        *  Creation priority is inversely correlated with the depth of the path
        *  because folder should be created from the root.
        *
        *  For example (priority : relativePath):
        *    0 : folder1/
        *    -1: folder1/folder2/
        *    -2: folder1/folder2/folder3/
        */
        return - (file.relativePath.split(path.posix.sep).length - 1);
      case 'delete':
        /*
        *  Deletion priority is correlated with the depth of the path
        *  because folder should be deleted from the deep end.
        *
        *  For example (priority : relativePath):
        *    2: folder1/folder2/folder3/
        *    1: folder1/folder2/
        *    0: folder1/
        */
        return file.relativePath.split(path.posix.sep).length - 1;
    }
    return 0; // Default priority is 0
  }
}

class PriorityTask<Result = unknown> {
  constructor(
    public readonly run: () => Promise<Result>,
    public readonly priority: number,
    public readonly name: string = ''
  ) {
  }
}

/*
 * TasksExecuter class
 *
 * Execute tasks which have the same priority concurently
 * and execute tasks which have different priority in series in order of the priority.
 */
class TasksExecuter<Result = unknown> {
  constructor(private taskList: PriorityTask<Result>[]) {
  }

  async execute(): Promise<Result[]> {
    const results: Result[] = [];
    const taskSeries = [];
    const sortedTaskList = this.taskList.sort((task1, task2) => task1.priority - task2.priority);
    // sortedTaskList[0] has lowest priority and sortedTaskList[-1] has highest priority.
    while (sortedTaskList.length > 0) {
      const priority = sortedTaskList[0].priority;
      const concurrentTasks: PriorityTask<Result>[] = [];
      while (sortedTaskList.length > 0 && sortedTaskList[0].priority === priority) {
        concurrentTasks.push(sortedTaskList.shift() as PriorityTask<Result>);
      }
      taskSeries.push(() => Promise.all(concurrentTasks.map(task => task.run())));
    }
    let task;
    while (task = taskSeries.pop()) {
      results.push(...await task());
    }
    return results;
  }
}