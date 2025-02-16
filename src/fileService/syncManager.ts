import { ConflictSolution, KeyType, ChangeState } from '../types';
import { FileAdapter } from './fileAdapter';
import { FileRepository, FileInfo } from '../model/fileModel';
import * as path from 'path';
import { getErrorTraceStr, Logger } from '../util/logger';
import { AsyncRunner } from '../util/asyncRunner';

export type SyncResult = {
  success: boolean;
  conflict: boolean;
  errors: string[]
};

type SyncTaskResult = {
  success: boolean;
  message: string;
};

type SyncTask = 'download' | 'createLocalFolder' | 'createRemoteFolder' |
  'upload' | 'updateRemote' | 'deleteRemote' | 'deleteLocal' | 'no';

type CheckIgnored = (file: FileInfo) => boolean;

export class SyncManager {
  private runner: AsyncRunner<SyncResult>;
  private conflictSolution?: ConflictSolution;
  constructor(
    private fileRepo: FileRepository,
    private fileAdapter: FileAdapter,
    private logger: Logger,
    private checkIgnored: CheckIgnored = () => false,
  ) {
    this.runner = new AsyncRunner<SyncResult>(() => {
      return this.execSync();
    });
  }

  public async sync(conflictSolution?: ConflictSolution): Promise<SyncResult> {
    this.conflictSolution = conflictSolution;
    return this.runner.run();
  }

  private async execSync(): Promise<SyncResult> {
    this.logger.info('File synchronization is started');

    let remoteFileList: FileInfo[];
    let remoteFileDict: Record<KeyType, FileInfo> = {};
    try {
      remoteFileList = (await this.fileAdapter.loadFileList())
        .filter(remoteFile => {
          // Filter by ignore file settings
          return !this.checkIgnored(remoteFile);
        });

      remoteFileDict = remoteFileList.reduce((dict, file) => {
        if (file.remoteId === null) {
          // TODO: recover
          throw new Error('remoteId is null');
        }
        dict[file.remoteId] = file;
        return dict;
      }, {} as Record<KeyType, FileInfo>);
    } catch (err) {
      return {
        success: false,
        conflict: false,
        errors: [getErrorTraceStr(err)]
      };
    }


    this.fileRepo.all().forEach(file => {
      // Remove ignored file entry
      if (this.checkIgnored(file)) {
        this.fileRepo.delete(file.id);
        return;
      }

      // Reset remote change state and change location
      file.remoteChange = 'no';
      file.changeLocation = 'no';
    });

    /*
     * Compare remote and local file
     */
    // Remote to local
    remoteFileList.forEach(remoteFile => {
      let file = this.fileRepo.findBy('remoteId', remoteFile.remoteId);
      if (!file) {

        file = this.fileRepo.findBy('relativePath', remoteFile.relativePath);
        if (file && file.isFolder) {
          // Folders with the same name have been created in local and remote
          file.remoteId = remoteFile.remoteId;
          file.localChange = 'no';
          return;
        } else if (file) {
          // Files with the same name have been created in local and remote
          this.logger.log(`${file.relativePath} have been created in both local and remote`);
          file.remoteChange = 'create';
          file.localChange = 'create';
          file.url = remoteFile.url;
          file.remoteId = remoteFile.remoteId;
          file.remoteRevision = remoteFile.remoteRevision;
          return;
        }

        // created in remote
        file = this.fileRepo.new(remoteFile);
        file.remoteChange = 'create';
        return;
      }

      file.remoteRevision = remoteFile.remoteRevision;
      file.url = remoteFile.url;

      if (file.relativePath !== remoteFile.relativePath) { // renamed in remote
        if (file.localChange === 'no') {
          this.logger.log(`Remote file is renamed: ${file.relativePath} -> ${remoteFile.relativePath}`);
          // express rename as deleting original file and creating renamed file
          file.remoteChange = 'delete';

          const renamedFile = this.fileRepo.new(remoteFile);
          renamedFile.remoteChange = 'create';
        } else if (file.localChange === 'create') {
          const msg = 'Unexpected situation is detected:'
            + ` remote file is renamed and local file is created: ${file.relativePath}`;
          this.logger.error(msg);
        } else if (file.localChange === 'delete') {
          this.logger.log(`Remote file is renamed: ${file.relativePath} -> ${remoteFile.relativePath} 
            and local file is deleted`);

          this.fileRepo.delete(file.id);

          const renamedFile = this.fileRepo.findBy('relativePath', remoteFile.relativePath);
          if (renamedFile) {
            this.updateFileState(renamedFile, remoteFile);
          } else {
            const renamedFile = this.fileRepo.new(remoteFile);
            renamedFile.remoteChange = 'create';
          }
        } else if (file.localChange === 'update') {
          this.logger.log(`Remote file is renamed: ${file.relativePath} -> ${remoteFile.relativePath} 
          and local file is updated`);

          file.localChange = 'create';
          file.remoteId = null;
          file.remoteRevision = null;
          file.url = '';

          const renamedFile = this.fileRepo.new(remoteFile);
          renamedFile.remoteChange = 'create';
        }
      } else if (file.localChange === 'create') {
        // The same file is already created both in local and remote.
        if (file.isFolder) {
          file.remoteChange = 'no';
          file.localChange = 'no';
        } else {
          file.remoteChange = 'create';
          file.localChange = 'create';
        }
      } else if (file.localRevision !== file.remoteRevision) { // updated in remote
        file.remoteChange = 'update';
      }
    });

    // Local to remote
    this.fileRepo.all().forEach(file => {
      const remoteFile = file.remoteId && remoteFileDict[file.remoteId];
      if (!remoteFile) { // remote file does not exist
        if (file.remoteId) { // remote file is deleted
          file.remoteChange = 'delete';
        } else { // local file is created
          file.localChange = 'create';
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

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.fileRepo.save();

    if (this.fileRepo.findBy('changeLocation', 'both')) {
      this.logger.info('File conflict is detected');



      if (this.conflictSolution) {
        this.logger.info(`Use '${this.conflictSolution}' for conflictSolution`);
      } else {
        this.logger.info('conflictSolution is not provided');



        return {
          success: false,
          conflict: true,
          errors: [],
        };
      }
    }

    const results = await (new TasksExecuter<SyncTaskResult>(
      this.generateSyncTasks()
    )).execute();

    const fails = results.filter(result => !result.success);
    if (fails.length > 0) {
      this.logger.info('File synchronization is failed');

      return {
        success: false,
        conflict: false,
        errors: fails.map(result => result.message)
      };
    }

    this.logger.info('File synchronization is finished');

    return {
      success: true,
      conflict: false,
      errors: [],
    };
  }

  private updateFileState(localFile: FileInfo, remoteFile: FileInfo) {
    const remoteChange = this.decideRemoteChange(localFile, remoteFile);
    const localChange = localFile.localChange;

    if (localChange === 'delete' && remoteChange === 'delete') {
      // The same file is already deleted both in local and remote.
      this.fileRepo.delete(localFile.id);
      return;
    }

    localFile.remoteChange = remoteChange;
    localFile.url = remoteFile.url;
    localFile.remoteId = remoteFile.remoteId;
    localFile.remoteRevision = remoteFile.remoteRevision;


    if (localChange === 'create' && remoteChange === 'create' && localFile.isFolder) {
      // The same folder is already created both in local and remote.
      localFile.localChange = 'no';
      localFile.remoteChange = 'no';
    }
  }

  /**
   * Compare local and remote file whose relativePath is the same and decide remote change state
   */
  // TODO: support case that localFile is undefined
  private decideRemoteChange(localFile: FileInfo, remoteFile?: FileInfo): ChangeState {
    if (remoteFile) {
      if (localFile.localChange === 'create') {
        return 'create';
      } else {
        if (localFile.localRevision === remoteFile.remoteRevision) {
          return 'no';
        } else {
          return 'update';
        }
      }
    } else {
      if (localFile.localChange === 'create') {
        return 'no';
      } else {
        return 'delete';
      }
    }
  }

  private generateSyncTasks(): PriorityTask<SyncTaskResult>[] {
    const tasks: PriorityTask<SyncTaskResult>[] = [];
    this.fileRepo.all().forEach(file => {
      if (file.changeLocation === 'remote' ||
        (file.changeLocation === 'both' && this.conflictSolution === 'pull')) {
        const task = this.syncWithRemoteTask(file);
        tasks.push(task);
        this.logger.log(`Pull:  ${file.relativePath} ${task.name}`);
      } else if (
        file.changeLocation === 'local' ||
        (file.changeLocation === 'both' && this.conflictSolution === 'push')
      ) {
        const task = this.syncWithLocalTask(file);
        tasks.push(task);
        this.logger.log(`Push: ${file.relativePath} ${task.name}`);
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
          return this.createPriorityTask('createRemoteFolder', file, priority);
        }

        if (file.remoteChange === 'create') {
          return this.createPriorityTask('updateRemote', file, priority);
        }

        return this.createPriorityTask('upload', file, priority);
      case 'update':
        if (file.remoteChange === 'delete') {
          if (file.isFolder) {
            return this.createPriorityTask('createRemoteFolder', file, priority);
          }
          return this.createPriorityTask('upload', file, priority);
        }
        return this.createPriorityTask('updateRemote', file, priority);
      case 'delete':
        if (file.remoteChange === 'delete') {
          // The same file is already deleted both in local and remote.
          this.fileRepo.delete(file.id);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.fileRepo.save();
          return this.createPriorityTask('no', file, priority);
        }
        return this.createPriorityTask('deleteRemote', file, priority);
      case 'no':
        return this.createPriorityTask('no', file, priority);
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
        if (file.isFolder) {
          return this.createPriorityTask('createLocalFolder', file, priority);
        }
        return this.createPriorityTask('download', file, priority);
      case 'update':
        if (file.isFolder) {
          return this.createPriorityTask('createLocalFolder', file, priority);
        }
        return this.createPriorityTask('download', file, priority);
      case 'delete':
        if (file.localChange === 'delete') {
          // The same file is already deleted both in local and remote.
          this.fileRepo.delete(file.id);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.fileRepo.save();
          return this.createPriorityTask('no', file, priority);
        }
        return this.createPriorityTask('deleteLocal', file, priority);
      case 'no':
        return this.createPriorityTask('no', file, priority);
    }
  }

  /**
   * Create priorityTask
   *
   * @param task syncTask
   * @param file file to sync
   * @param priority priority of the task
   */
  private createPriorityTask(task: SyncTask, file: FileInfo, priority: number) {
    return new PriorityTask(
      this.wrapSyncTask(task, file),
      priority,
      task,
    );
  }

  /**
   * Wrap sync task for exceptions
   *
   * @param syncTask
   * @param file FileInfo
   */
  private wrapSyncTask(
    task: SyncTask,
    file: FileInfo
  ): () => Promise<SyncTaskResult> {
    return async () => {
      // Nothing to do
      if (task === 'no') {
        return {
          success: true,
          message: '',
        };
      }

      try {
        await this.fileAdapter[task](file);
      } catch (e) {
        const message = `${task} : '${file.relativePath}' :  ${(e && (e as Error).stack || '')}`;
        this.logger.error(message);
        return {
          success: false,
          message,
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
    const change: ChangeState = syncDestination === 'local' ?
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
    const taskSeries: Array<() => Promise<Result[]>> = [];
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
    while ((task = taskSeries.pop())) {
      results.push(...await task());
    }
    return results;
  }
}
