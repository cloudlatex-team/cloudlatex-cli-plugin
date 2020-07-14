export interface ProjectInfo {
  id: number;
  compile_target_file_id: number;
  title: string;
}

export interface Config {
  outDir: string;
  rootPath: string;
  backend: string;
  endpoint: string;
  email: string;
  client: string;
  token: string;
  projectId: number;
}

export interface AppInfo {
  offline: boolean;
  projectName?: string;
  compileTarget?: KeyType,
  conflictFiles: string[]
}

export type KeyType = number | string;
export type SyncMode = 'upload' | 'download';
export type ChangeState = 'no' | 'update' | 'create' | 'delete';
export type ChangeLocation = 'no' | 'local' | 'remote' | 'both';

export interface DecideSyncMode {
  (
    conflictFiles: string[]
  ): Promise<SyncMode>
}
