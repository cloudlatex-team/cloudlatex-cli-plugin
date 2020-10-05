/// <reference types="node" />
import Backend from '../backend/ibackend';
import { FileRepository, FileInfo } from '../model/fileModel';
export default class FileAdapter {
    protected rootPath: string;
    private fileRepo;
    private backend;
    constructor(rootPath: string, fileRepo: FileRepository, backend: Backend);
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
