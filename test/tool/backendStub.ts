/* eslint-disable @typescript-eslint/naming-convention */
import { IBackend } from '../../src/backend/ibackend.ts';
import { ProjectInfo, KeyType } from '../../src/types.ts';
import { TypeDB, Repository } from 'npm:@moritanian/type-db';
import { FILE_INFO_DESC, FileInfo } from '../../src/model/fileModel.ts';
import { v4 as uuid } from 'npm:uuid';
import { ReadableString, streamToString } from '../../src/util/stream.ts';

/*
 * BackendMock Class
 *
 * [Warn]
 *  file.id in remoteFiles is not equal to file.id in local files.
 */
export class BackendStub implements IBackend {
  public isOffline = false;
  public remoteContents: Record<string, string> = {};
  public remoteFiles: Repository<typeof FILE_INFO_DESC>;
  constructor() {
    const remotedb = new TypeDB();
    this.remoteFiles = remotedb.getRepository(FILE_INFO_DESC);
  }

  validateToken(): Promise<boolean> {
    return Promise.resolve(true);
  }

  loadProjectInfo(): Promise<ProjectInfo> {
    if (this.isOffline) {
      return Promise.reject('Network error on loadProjectInfo');
    }
    return Promise.resolve({
      id: 1,
      compileTargetFileRemoteId: 1,
      title: '',
    });
  }

  updateProjectInfo(): Promise<unknown> {
    if (this.isOffline) {
      return Promise.reject('Network error on updateProjectInfo');
    }
    return Promise.resolve({});
  }

  loadFileList(): Promise<FileInfo[]> {
    if (this.isOffline) {
      return Promise.reject('Network error on loadFileList');
    }
    return Promise.resolve(this.remoteFiles.all());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: unknown): Promise<{
    remoteId: string;
    remoteRevision: string;
  }> {
    if (this.isOffline) {
      return Promise.reject('Network error on upload');
    }

    if (file.isFolder) {
      throw new Error('Folder cannot be uploaded');
    }

    const newFile = this.remoteFiles.new({ ...file });
    newFile.id = -1; // reset local id
    const remoteId = newFile.remoteId = uuid();
    const remoteRevision = newFile.remoteRevision = uuid();
    this.remoteContents[remoteId] = await streamToString(stream);
    return {
      remoteId,
      remoteRevision
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  async createRemote(file: FileInfo, parent: FileInfo | null): Promise<{ remoteId: KeyType, remoteRevision: any }> {
    if (this.isOffline) {
      return Promise.reject('Network error on createRemote');
    }
    const newFile = this.remoteFiles.new({ ...file });
    newFile.id = -1; // reset local id
    const remoteId = newFile.remoteId = uuid();
    const remoteRevision = newFile.remoteRevision = uuid();
    return {
      remoteId,
      remoteRevision
    };
  }

  async download(file: FileInfo): Promise<NodeJS.ReadableStream> {
    if (this.isOffline) {
      return Promise.reject('Network error on download');
    }
    const remoteFile = this.remoteFiles.findBy('remoteId', file.remoteId);
    if (!remoteFile) {
      throw new Error('remoteFile is null');
    }

    if (remoteFile.remoteId === null) {
      throw new Error('remoteId is null');
    }
    if (!(remoteFile.remoteId in this.remoteContents)) {
      throw new Error('remote content is not found');
    }
    if (file.isFolder) {
      throw new Error('Folder cannot be downloaded');
    }
    return new ReadableString(this.remoteContents[remoteFile.remoteId]);
  }

  async updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType> {
    if (this.isOffline) {
      return Promise.reject('Network error on updateRemote');
    }
    const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
    if (!targetFile || !targetFile.remoteId) {
      throw new Error('No update target file or no remote id');
    }
    this.remoteContents[targetFile.remoteId] = await streamToString(stream);
    return targetFile.remoteRevision = uuid();
  }

  deleteRemote(file: FileInfo): Promise<void> {
    if (this.isOffline) {
      return Promise.reject('Network error on deleteRemote');
    }
    const targetFile = this.remoteFiles.findBy('remoteId', file.remoteId);
    if (!targetFile) {
      throw new Error('No delete target file');
    }
    this.remoteFiles.delete(targetFile.id);
    delete this.remoteContents[targetFile.id];
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compileProject(): Promise<any> {
    if (this.isOffline) {
      return Promise.reject('Network error on compileProject');
    }
    return Promise.resolve();
  }

  /*
   * File operation methods for test situations
   */
  async _createInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void> {
    const isOffline = this.isOffline;
    this.isOffline = false;
    if (fileInfo.isFolder) {
      await this.createRemote(fileInfo as FileInfo, null);
    } else {
      await this.upload(fileInfo as FileInfo, new ReadableString(content));

    }
    this.isOffline = isOffline;
  }

  async _updateInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void> {
    const isOffline = this.isOffline;
    this.isOffline = false;

    const remoteFiles = this.remoteFiles.where(fileInfo);
    if (!remoteFiles || remoteFiles.length !== 1) {
      throw new Error('Remote file is not found');
    }
    await this.updateRemote(remoteFiles[0], new ReadableString(content));

    this.isOffline = isOffline;
  }

  async _deleteInRemote(fileInfo: Partial<FileInfo>): Promise<void> {
    const isOffline = this.isOffline;

    this.isOffline = false;
    const remoteFiles = this.remoteFiles.where(fileInfo);
    if (!remoteFiles || remoteFiles.length !== 1) {
      throw new Error('Remote file is not found');
    }
    await this.deleteRemote(remoteFiles[0]);

    this.isOffline = isOffline;
    return Promise.resolve();
  }
}
