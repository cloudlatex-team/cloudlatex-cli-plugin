import { SyncMode, DecideSyncMode, KeyType } from '../types';
import FileAdapter from './fileAdapter';
import { FileRepository, FileInfo } from '../model/fileModel';
import Logger from './../logger';


// #TODO folder 対応
export default class SyncManager {
  private syncing: boolean = false;
  private syncReserved: boolean = false;
  constructor(
    private fileRepo: FileRepository,
    private fileAdapter: FileAdapter,
    public decideSyncMode: DecideSyncMode,
    private logger: Logger) {
  }

  public async syncSession(): Promise<boolean> {
    if (this.syncing) {
      this.syncReserved = true;
      return true;
    }
    this.logger.info('Synchronizing files with server ...');
    this.syncing = true;
    try {
      await this.sync();
    } catch (e) {
      this.syncing = false;
      // #TODO offline or unauthorized?
      this.logger.error(JSON.stringify(e));
      return false;
    }
    this.syncing = false;

    if (this.syncReserved) {
      this.syncReserved = false;
      setTimeout(this.syncSession.bind(this), 0);
      return false;
    }
    return true;
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
      } else if (file.remoteRevision !== remoteFile.remoteRevision) { // remote updated
        file.remoteChange = 'update';
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
    if (this.fileRepo.findBy('changeLocation', 'both')) { // #TODO only bothChanged?
      syncMode = await this.decideSyncMode(
        this.fileRepo.where({ 'changeLocation': 'remote' }).map(file => file.relativePath),
        this.fileRepo.where({ 'changeLocation': 'local' }).map(file => file.relativePath),
        this.fileRepo.where({ 'changeLocation': 'both' }).map(file => file.relativePath),
      );
    }
    let promises = this.getSyncTasks(syncMode);
    await Promise.all(promises);
  }

  private getSyncTasks(remoteSyncMode: SyncMode): Promise<unknown>[] {
    const tasks: Promise<unknown>[] = [];
    this.fileRepo.all().forEach(file => {
      if (file.changeLocation === 'remote' ||
        (file.changeLocation === 'both' && remoteSyncMode === 'download')) {
        tasks.push(this.syncWithRemoteTask(file));
      } else if (
        file.changeLocation === 'local' ||
        (file.changeLocation === 'both' && remoteSyncMode === 'upload')
      ) {
        tasks.push(this.syncWithLocalTask(file));
      }
    });
    return tasks;
  }

  private syncWithLocalTask(file: FileInfo): Promise<unknown> {
    switch (file.localChange) {
      case 'create':
        return this.fileAdapter.upload(file);
      case 'update':
        if (file.remoteChange === 'delete') {
          return this.fileAdapter.upload(file);
        }
        return this.fileAdapter.updateRemote(file);
      case 'delete':
        if (file.remoteChange === 'delete') {
          this.fileRepo.delete(file.id);
          this.fileRepo.save();
          return Promise.resolve();
        }
        return this.fileAdapter.deleteRemote(file);
      case 'no':
        return Promise.resolve();
    }
  }

  private syncWithRemoteTask(file: FileInfo): Promise<unknown> {
    switch (file.remoteChange) {
      case 'create':
      case 'update':
        return this.fileAdapter.download(file);
      case 'delete':
        if (file.localChange === 'delete') {
          this.fileRepo.delete(file.id);
          this.fileRepo.save();
          return Promise.resolve();
        }
        return this.fileAdapter.deleteLocal(file);
      case 'no':
        return Promise.resolve();
    }
  }
}