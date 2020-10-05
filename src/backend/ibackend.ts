import { ProjectInfo, Config, KeyType, Account, CompileResult } from '../types';
import { FileInfo } from '../model/fileModel';

export default interface IBackend {
  validateToken(): Promise<boolean>;

  loadProjectInfo(): Promise<ProjectInfo>;

  loadFileList(): Promise<FileInfo[]>;

  upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{remoteId: KeyType, remoteRevision: any}>;

  createRemote(file: FileInfo, parent: FileInfo | null): Promise<{remoteId: KeyType, remoteRevision: any}>;

  download(file: FileInfo): Promise<NodeJS.ReadableStream>;

  updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType>;

  deleteRemote(file: FileInfo): Promise<unknown>;

  compileProject(): Promise<CompileResult>;
};
