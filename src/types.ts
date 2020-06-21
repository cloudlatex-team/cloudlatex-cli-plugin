import { FileInfo } from './model/fileModel';

export interface ProjectInfo {
  id: number;
  compile_target_file_id: number;
  title: string;
}

export interface Config {
  outDir: string;
  rootPath: string;
  backend: string;
  email: string;
  client: string;
  token: string;
  projectId: number;
}

export interface AppInfo {
  loggedIn: boolean;
  backend?: string;
  projectName?: string;
  projectId?: string;
}

export type KeyType = number | string;
export type SyncMode = 'upload' | 'download';
export type ChangeState = 'no' | 'update' | 'create' | 'delete';
export type ChangeLocation = 'no' | 'local' | 'remote' | 'both';

export interface DecideSyncMode {
  (
    remoteChangedFiles: string[],
    localChangedFiles: string[], 
    bothChangedFiles: string[]
  ): Promise<SyncMode>
}
