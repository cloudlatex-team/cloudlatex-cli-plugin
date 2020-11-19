/// <reference types="node" />
import IBackend from '../../src/backend/ibackend';
import { ProjectInfo, KeyType } from '../../src/types';
import { Repository } from '@moritanian/type-db';
import { FileInfoDesc, FileInfo } from '../../src/model/fileModel';
export default class BackendStub implements IBackend {
    isOffline: boolean;
    remoteContents: Record<string, string>;
    remoteFiles: Repository<typeof FileInfoDesc>;
    constructor();
    validateToken(): Promise<boolean>;
    loadProjectInfo(): Promise<ProjectInfo>;
    loadFileList(): Promise<FileInfo[]>;
    upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{
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
    compileProject(): any;
    _createInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void>;
    _updateInRemote(fileInfo: Partial<FileInfo>, content: string): Promise<void>;
    _deleteInRemote(fileInfo: Partial<FileInfo>): Promise<void>;
}