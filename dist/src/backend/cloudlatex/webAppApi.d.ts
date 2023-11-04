/// <reference types="node" />
import { CLProjectInfo, UpdateCLProjectInfoParam, CompileResult } from './types';
import { Config, ProjectInfo, Account } from '../../types';
import { AccountService } from '../../service/accountService';
export declare class CLWebAppApi {
    private config;
    private accountService;
    private apiRoot;
    private apiProjects;
    constructor(config: Config, accountService: AccountService<Account>);
    private headers;
    private fetchOption;
    validateToken(): Promise<boolean>;
    loadProjects(): Promise<ProjectInfo[]>;
    loadProjectInfo(): Promise<CLProjectInfo>;
    updateProjectInfo(param: UpdateCLProjectInfoParam): Promise<CLProjectInfo>;
    loadFiles(): Promise<unknown>;
    createFile(name: string, belonging_to: number | null, is_folder: boolean): Promise<unknown>;
    deleteFile(id: number): Promise<unknown>;
    updateFile(id: number, params: any): Promise<{
        revision: string;
    }>;
    compileProject(): Promise<CompileResult>;
    uploadFile(stream: NodeJS.ReadableStream, relativeDir: string): Promise<unknown>;
    download(url: string): Promise<NodeJS.ReadableStream>;
    downdloadPreview(url: string): Promise<NodeJS.ReadableStream>;
    loadSynctexObject(url: string): Promise<ArrayBuffer>;
}
