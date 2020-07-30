/// <reference types="node" />
import { ProjectInfo, Config, KeyType, Account } from './../types';
import { FileInfo } from './../model/fileModel';
import AccountManager from '../accountManager';
export default class Backend {
    protected config: Config;
    private accountManager;
    constructor(config: Config, accountManager: AccountManager<Account>);
    validateToken(): Promise<boolean>;
    loadProjectInfo(): Promise<ProjectInfo>;
    loadFileList(): Promise<FileInfo[]>;
    upload(file: FileInfo, stream: NodeJS.ReadableStream, option?: any): Promise<{
        remoteId: KeyType;
        remoteRevision: any;
    }>;
    createRemote(file: FileInfo, parent: FileInfo | null): Promise<{
        remoteId: KeyType;
        remoteRevision: any;
    }>;
    download(file: FileInfo): Promise<NodeJS.ReadableStream>;
    updateRemote(file: FileInfo, stream: NodeJS.ReadableStream): Promise<KeyType>;
    deleteRemote(file: FileInfo): Promise<unknown>;
    compileProject(): Promise<{
        logStream: NodeJS.ReadableStream;
        pdfStream: NodeJS.ReadableStream;
        synctexStream?: NodeJS.ReadableStream;
    }>;
}
