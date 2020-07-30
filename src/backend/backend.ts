import { ProjectInfo, Config, KeyType, Account } from './../types';
import { FileInfo } from './../model/fileModel';
import AccountManager from '../accountManager';

export default class Backend {
  constructor(protected config: Config, private accountManager: AccountManager<Account>) {
  }

  validateToken(): Promise<boolean> {
    throw new Error('No implementation');
  }

  loadProjectInfo(): Promise<ProjectInfo> {
    throw new Error('No implementation');
  }

  loadFileList(): Promise<FileInfo[]> {
    throw new Error('No implementation');
  }

  upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{remoteId: KeyType, remoteRevision: any}> {
    throw new Error('No implementation');
  }

  createRemote(file: FileInfo, parent: FileInfo | null): Promise<{remoteId: KeyType, remoteRevision: any}> {
    throw new Error('No implementation');
  }

  download(file: FileInfo): Promise<NodeJS.ReadableStream> {
    throw new Error('No implementation');
  }

  updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType> {
    throw new Error('No implementation');
  }

  deleteRemote(file: FileInfo): Promise<unknown> {
    throw new Error('No implementation');
  }

  compileProject(): Promise<{
    logStream: NodeJS.ReadableStream,
    pdfStream: NodeJS.ReadableStream,
    synctexStream?: NodeJS.ReadableStream,
  }> {
    throw new Error('No implementation');
  }
}