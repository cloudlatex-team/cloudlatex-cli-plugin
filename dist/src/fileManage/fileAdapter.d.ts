/// <reference types="node" />
import Backend from '../backend/backend';
import { FileRepository, FileInfo } from '../model/fileModel';
import Logger from '../logger';
export default class FileAdapter {
    protected rootPath: string;
    private fileRepo;
    private backend;
    protected logger: Logger;
    constructor(rootPath: string, fileRepo: FileRepository, backend: Backend, logger: Logger);
    loadFileList(): Promise<FileInfo[]>;
    download(file: FileInfo): Promise<void>;
    saveAs(relativePath: string, stream: NodeJS.ReadableStream): Promise<void>;
    createLocalFolder(file: FileInfo): Promise<void>;
    createRemoteFolder(file: FileInfo): Promise<void>;
    upload(file: FileInfo, option?: any): Promise<void>;
    updateRemote(file: FileInfo): Promise<void>;
    deleteRemote(file: FileInfo): Promise<void>;
    deleteLocal(file: FileInfo): Promise<void>;
}
