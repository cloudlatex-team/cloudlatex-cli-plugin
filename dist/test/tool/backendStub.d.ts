/// <reference types="node" />
import { IBackend } from '../../src/backend/ibackend';
import { ProjectInfo, KeyType } from '../../src/types';
import { Repository } from '@moritanian/type-db';
import { FILE_INFO_DESC, FileInfo } from '../../src/model/fileModel';
export declare class BackendStub implements IBackend {
    isOffline: boolean;
    remoteContents: Record<string, string>;
    remoteFiles: Repository<typeof FILE_INFO_DESC>;
    constructor();
    validateToken(): Promise<boolean>;
    loadProjectInfo(): Promise<ProjectInfo>;
    updateProjectInfo(): Promise<unknown>;
    loadFileList(): Promise<FileInfo[]>;
    upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: unknown): Promise<{
        remoteId: string;
        remoteRevision: string;
    }>;
    createRemote(file: FileInfo, parent: FileInfo | null): Promise<{
        remoteId: KeyType;
        remoteRevision: any;
    }>;
    download(file: FileInfo): Promise<NodeJS.ReadableStream>;
    updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType>;
    deleteRemote(file: FileInfo): Promise<void>;
    compileProject(): Promise<any>;
    _createInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void>;
    _updateInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void>;
    _deleteInRemote(fileInfo: Partial<FileInfo>): Promise<void>;
}
