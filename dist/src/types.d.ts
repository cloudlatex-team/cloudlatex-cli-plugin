/// <reference types="node" />
import { FileInfo } from './model/fileModel';
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
    outDir?: string | null;
    /** abs path of the root directory of the tex project */
    rootPath: string;
    /** currently only support cloudlatex */
    backend: string;
    /** endpoint url of api */
    endpoint: string;
    /** project ID */
    projectId: number;
    /** set true if automatically compile when any file is saved */
    autoCompile?: boolean;
    /** full path of the directory to save meta data. */
    storagePath?: string | null;
}
export declare type Account = {
    /** token */
    token: string;
    /** email address */
    email: string;
    /** client ID */
    client: string;
};
export declare type LoginStatus = 'offline' | 'valid' | 'invalid';
export interface AppInfo {
    loginStatus: LoginStatus;
    projectName?: string;
    compileTarget?: KeyType;
    targetName?: string;
    logPath?: string;
    pdfPath?: string;
    synctexPath?: string;
    loaded: boolean;
    conflictFiles: FileInfo[];
}
export declare type KeyType = number | string;
export declare type SyncMode = 'upload' | 'download';
export declare type ChangeState = 'no' | 'update' | 'create' | 'delete';
export declare type ChangeLocation = 'no' | 'local' | 'remote' | 'both';
export interface DecideSyncMode {
    (conflictFiles: FileInfo[]): Promise<SyncMode>;
}
export declare type CompileStatus = 'success' | 'compiler-error' | 'no-target-error' | 'unknown-error';
export interface CompileResult {
    status: CompileStatus;
    logStream?: NodeJS.ReadableStream;
    pdfStream?: NodeJS.ReadableStream;
    synctexStream?: NodeJS.ReadableStream;
    logs?: {
        type: 'warning' | 'error';
        file: string;
        line: number;
        message: string;
    }[];
}
