/// <reference types="node" />
import { CompileResult } from './types';
import { Config, ProjectInfo } from '../../types';
export default class CLWebAppApi {
    private config;
    private APIRoot;
    private APIProjects;
    constructor(config: Config);
    private headers;
    validateToken(): Promise<boolean>;
    loadProjects(): Promise<any>;
    loadProjectInfo(): Promise<ProjectInfo>;
    loadFiles(): Promise<any>;
    createFile(name: string, belonging_to: number | null, is_folder: boolean): Promise<any>;
    deleteFile(id: number): Promise<any>;
    updateFile(id: number, params: any): Promise<{
        revision: string;
    }>;
    compileProject(): Promise<CompileResult>;
    uploadFile(stream: NodeJS.ReadableStream, relativeDir: string): Promise<any>;
    download(url: string): Promise<NodeJS.ReadableStream>;
    loadSynctexObject(url: string): Promise<ArrayBuffer>;
}
