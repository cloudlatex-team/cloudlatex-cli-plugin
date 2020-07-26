export interface ProjectInfo {
  id: number;
  compile_target_file_id: number;
  title: string;
}

/**
 * Configuration
 */
export interface Config {
  /** full path of the directory to output compilation result */
  outDir: string;

  /** full path of the root directory of the tex project*/
  rootPath: string;

  /** currently only support cloudlatex */
  backend: string;

  /** endpoint url of api */
  endpoint: string;

  /** email address of user's account */
  email: string;

  /** clinet ID of user's account */
  client: string;

  /** token of user's account */
  token: string;

  /** project ID */
  projectId: number;

  /** set true if automatically compile when any file is saved */
  autoBuild: boolean;

  /** full path of the directory to save meta data. */
  storagePath: string;
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
