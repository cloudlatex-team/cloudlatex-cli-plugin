/// <reference types="node" />
import { FileInfo } from '../../model/fileModel';
import Backend from '../backend';
import { Config, ProjectInfo, KeyType } from './../../types';
import { ReadableString } from './../../util';
export default class ClBackend extends Backend {
    private api;
    constructor(config: Config);
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
        pdfStream: NodeJS.ReadableStream;
        logStream: ReadableString;
        synctexStream: ReadableString;
    }>;
}
