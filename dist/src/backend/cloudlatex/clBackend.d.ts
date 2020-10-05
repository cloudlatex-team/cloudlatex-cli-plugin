/// <reference types="node" />
import { FileInfo } from '../../model/fileModel';
import IBackend from '../ibackend';
import { Config, ProjectInfo, KeyType, Account, CompileResult } from './../../types';
import AccountService from '../../service/accountService';
export default class ClBackend implements IBackend {
    private api;
    private config;
    constructor(config: Config, accountService: AccountService<Account>);
    validateToken(): Promise<boolean>;
    download(file: FileInfo): Promise<NodeJS.ReadableStream>;
    upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{
        remoteId: KeyType;
        remoteRevision: any;
    }>;
    createRemote(file: FileInfo, parent: FileInfo | null): Promise<{
        remoteId: KeyType;
        remoteRevision: any;
    }>;
    updateRemote(file: FileInfo & {
        remoteId: number;
    }, stream: NodeJS.ReadableStream): Promise<KeyType>;
    deleteRemote(file: FileInfo & {
        remoteId: number;
    }): Promise<any>;
    loadProjectInfo(): Promise<ProjectInfo>;
    loadFileList(): Promise<FileInfo[]>;
    loadSynctexObject(url: string): Promise<any>;
    compileProject(): Promise<{
        logStream: NodeJS.ReadableStream;
        pdfStream?: NodeJS.ReadableStream;
        synctexStream?: NodeJS.ReadableStream;
    } & CompileResult>;
}
