/// <reference types="node" />
import { ProjectInfo, KeyType, CompileResult } from '../types';
import { FileInfo, Revision } from '../model/fileModel';
export interface IBackend {
    validateToken(): Promise<boolean>;
    loadProjectInfo(): Promise<ProjectInfo>;
    loadFileList(): Promise<FileInfo[]>;
    upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{
        remoteId: KeyType;
        remoteRevision: Revision;
    }>;
    createRemote(file: FileInfo, parent: FileInfo | null): Promise<{
        remoteId: KeyType;
        remoteRevision: any;
    }>;
    download(file: FileInfo): Promise<NodeJS.ReadableStream>;
    updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType>;
    deleteRemote(file: FileInfo): Promise<unknown>;
    compileProject(): Promise<CompileResult>;
}
