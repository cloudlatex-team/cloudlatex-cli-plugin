import { ProjectInfo, KeyType, UpdateProjectInfoParam } from '../types';
import { FileInfo, Revision } from '../model/fileModel';

export type CompileResult = {
  status: 'success' | 'no-target-error' | 'compiler-error' | 'unknown-error';
  logStream?: NodeJS.ReadableStream,
  pdfStream?: NodeJS.ReadableStream,
  synctexStream?: NodeJS.ReadableStream,
  logs?: {
    type: 'warning' | 'error',
    file: string,
    line: number,
    message: string
  }[],
};

export interface IBackend {
  validateToken(): Promise<boolean>;

  loadProjectInfo(): Promise<ProjectInfo>;

  updateProjectInfo(param: UpdateProjectInfoParam): Promise<unknown>;

  loadFileList(): Promise<FileInfo[]>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any):
    Promise<{ remoteId: KeyType, remoteRevision: Revision }>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createRemote(file: FileInfo, parent: FileInfo | null): Promise<{ remoteId: KeyType, remoteRevision: any }>;

  download(file: FileInfo): Promise<NodeJS.ReadableStream>;

  updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType>;

  deleteRemote(file: FileInfo): Promise<unknown>;

  compileProject(): Promise<CompileResult>;
}
