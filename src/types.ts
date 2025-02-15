import { FileInfo, Revision } from './model/fileModel';
import { Matcher } from 'anymatch';

export interface ProjectInfo {
  id: number;
  compileTargetFileRemoteId: Revision; // remoteId of compile target file
  title: string;
}

/**
 * Configuration
 */
export interface Config {
  /** abs path or relative path of the directory to output compilation result */
  outDir?: string | null;

  /** abs path of the root directory of the tex project */
  rootPath: string;

  /** currently only support cloudlatex */
  backend: string;

  /** endpoint url of api */
  endpoint: string;

  /** project ID */
  projectId: number;

  /** full path of the directory to save meta data. */
  storagePath?: string | null;

  /** ignore files to watch and upload  */
  ignoredFiles?: Matcher;
}

export type Account = {
  /** token */
  token: string,

  /** email address */
  email: string,

  /** client ID */
  client: string
};

export type ActivationStatus = 'active' | 'inactive' | 'not-empty-directory-error';
export type LoginStatus = 'offline' | 'valid' | 'invalid';

export interface AppInfo {
  activationStatus: ActivationStatus;
  loginStatus: LoginStatus;
  projectName?: string;
  logPath?: string,
  pdfPath?: string,
  synctexPath?: string,
  loaded: boolean,
  conflictFiles: FileInfo[],
  targetFile?: FileInfo,
  files: FileInfo[],
  targetFileCandidates: FileInfo[],
}

export type KeyType = number | string;
export type ConflictSolution = 'push' | 'pull';
export type ChangeState = 'no' | 'update' | 'create' | 'delete';
export type ChangeLocation = 'no' | 'local' | 'remote' | 'both';

export type UpdateProjectInfoParam = Partial<Omit<ProjectInfo, 'id'>>;


export type BaseResultStatus = 'success' | 'invalid-account' | 'offline' | 'no-target-error' | 'unknown-error';

export type LoginResult = {
  status: BaseResultStatus;
  appInfo: AppInfo;
  errors?: string[]
};

export type ListProjectsResult = {
  status: BaseResultStatus;
  projects: ProjectInfo[];
};

export type UpdateProjectInfoResult = {
  status: BaseResultStatus;
  appInfo: AppInfo;
  errors?: string[];
};

export type SyncStatus = BaseResultStatus | 'conflict' | 'not-empty-directory';
export type SyncResult = {
  status: SyncStatus;
  appInfo: AppInfo;
  errors?: string[]
};

export type CompileStatus = BaseResultStatus | 'compiler-error';
export type CompileResult = {
  status: CompileStatus,
  logs?: {
    type: 'warning' | 'error',
    file: string,
    line: number,
    message: string
  }[],
  errors?: string[]
  appInfo: AppInfo;
};

export interface ILatexApp {
  start(): Promise<LoginResult>;
  login(): Promise<LoginResult>;
  sync(): Promise<SyncResult>;
  compile(): Promise<CompileResult>;
  stop(): void;
  resetLocal(): void;
}