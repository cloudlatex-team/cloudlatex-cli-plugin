/// <reference types="node" />
import { FileInfo, Revision } from '../../model/fileModel';
import { IBackend, CompileResult } from '../ibackend';
import { Config, ProjectInfo, KeyType, Account, UpdateProjectInfoParam } from './../../types';
import { AccountService } from '../../service/accountService';
export declare class ClBackend implements IBackend {
    private api;
    private config;
    constructor(config: Config, accountService: AccountService<Account>);
    validateToken(): Promise<boolean>;
    download(file: FileInfo): Promise<NodeJS.ReadableStream>;
    upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: unknown): Promise<{
        remoteId: KeyType;
        remoteRevision: Revision;
    }>;
    createRemote(file: FileInfo, parent: FileInfo | null): Promise<{
        remoteId: KeyType;
        remoteRevision: Revision;
    }>;
    updateRemote(file: FileInfo & {
        remoteId: number;
    }, stream: NodeJS.ReadableStream): Promise<KeyType>;
    deleteRemote(file: FileInfo & {
        remoteId: number;
    }): Promise<unknown>;
    loadProjectList(): Promise<Array<ProjectInfo>>;
    loadProjectInfo(): Promise<ProjectInfo>;
    updateProjectInfo(param: UpdateProjectInfoParam): Promise<unknown>;
    loadFileList(): Promise<FileInfo[]>;
    loadSynctexObject(url: string): Promise<ArrayBuffer>;
    compileProject(): Promise<{
        logStream: NodeJS.ReadableStream;
        pdfStream?: NodeJS.ReadableStream;
        synctexStream?: NodeJS.ReadableStream;
    } & CompileResult>;
}
