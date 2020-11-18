export interface ProjectInfo {
  id: number;
  compile_target_file_id: number;
  title: string;
}

/**
 * Configuration
 */
export interface Config {
  /** abs path or relative path of the directory to output compilation result */
  outDir: string;

  /** abs path of the root directory of the tex project */
  rootPath: string;

  /** currently only support cloudlatex */
  backend: string;

  /** endpoint url of api */
  endpoint: string;

  /** project ID */
  projectId: number;

  /** set true if automatically compile when any file is saved */
  autoCompile: boolean;

  /** full path of the directory to save meta data. */
  storagePath: string;
}

export type Account = {
  /** token */
  token: string,

  /** email address */
  email: string,

  /** client ID */
  client: string
};

export interface AppInfo {
  offline: boolean;
  projectName?: string;
  compileTarget?: KeyType,
  targetName?: string,
  logPath?: string,
  pdfPath?: string,
  synctexPath?: string,
  loaded: boolean,
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

export type CompileStatus = 'success' | 'compiler-error' | 'no-target-error' | 'saving-file-error' | 'unknown-error';
export interface CompileResult {
  status: CompileStatus,
  logStream?: NodeJS.ReadableStream,
  pdfStream?: NodeJS.ReadableStream,
  synctexStream?: NodeJS.ReadableStream,
  logs?: {
    type: 'warning' | 'error',
    file: string,
    line: number,
    message: string
  }[]
}
