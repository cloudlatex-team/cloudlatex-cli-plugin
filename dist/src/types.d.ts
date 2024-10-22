import { FileInfo, Revision } from './model/fileModel';
import { Matcher } from 'anymatch';
export interface ProjectInfo {
    id: number;
    compileTargetFileRemoteId: Revision;
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
export declare type Account = {
    /** token */
    token: string;
    /** email address */
    email: string;
    /** client ID */
    client: string;
};
export declare type ActivationStatus = 'active' | 'inactive' | 'not-empty-directory-error';
export declare type LoginStatus = 'offline' | 'valid' | 'invalid';
export interface AppInfo {
    activationStatus: ActivationStatus;
    loginStatus: LoginStatus;
    projectName?: string;
    logPath?: string;
    pdfPath?: string;
    synctexPath?: string;
    loaded: boolean;
    conflictFiles: FileInfo[];
    targetFile?: FileInfo;
    files: FileInfo[];
    targetFileCandidates: FileInfo[];
}
export declare type KeyType = number | string;
export declare type ConflictSolution = 'push' | 'pull';
export declare type ChangeState = 'no' | 'update' | 'create' | 'delete';
export declare type ChangeLocation = 'no' | 'local' | 'remote' | 'both';
export declare type UpdateProjectInfoParam = Partial<Omit<ProjectInfo, 'id'>>;
export declare type BaseResultStatus = 'success' | 'invalid-account' | 'offline' | 'no-target-error' | 'unknown-error';
export declare type LoginResult = {
    status: BaseResultStatus;
    appInfo: AppInfo;
    errors?: string[];
};
export declare type ListProjectsResult = {
    status: BaseResultStatus;
    projects: ProjectInfo[];
};
export declare type UpdateProjectInfoResult = {
    status: BaseResultStatus;
    appInfo: AppInfo;
    errors?: string[];
};
export declare type SyncStatus = BaseResultStatus | 'conflict' | 'not-empty-directory';
export declare type SyncResult = {
    status: SyncStatus;
    appInfo: AppInfo;
    errors?: string[];
};
export declare type CompileStatus = BaseResultStatus | 'compiler-error';
export declare type CompileResult = {
    status: CompileStatus;
    logs?: {
        type: 'warning' | 'error';
        file: string;
        line: number;
        message: string;
    }[];
    errors?: string[];
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
