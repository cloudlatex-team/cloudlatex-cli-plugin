export interface ProjectInfo {
    id: number;
    compile_target_file_id: number;
    title: string;
}
export interface Config {
    outDir: string;
    rootPath: string;
    backend: string;
    endpoint: string;
    email: string;
    client: string;
    token: string;
    projectId: number;
    autoBuild: boolean;
}
export interface AppInfo {
    offline: boolean;
    projectName?: string;
    compileTarget?: KeyType;
    conflictFiles: string[];
}
export declare type KeyType = number | string;
export declare type SyncMode = 'upload' | 'download';
export declare type ChangeState = 'no' | 'update' | 'create' | 'delete';
export declare type ChangeLocation = 'no' | 'local' | 'remote' | 'both';
export interface DecideSyncMode {
    (conflictFiles: string[]): Promise<SyncMode>;
}
